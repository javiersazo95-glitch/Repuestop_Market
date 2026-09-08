import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Building2, ChevronRight, CreditCard, FileText, Loader2, Lock, MapPin, ReceiptText, Sparkles, Store, User,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import {
  checkoutCartApi, checkoutConversationQuoteApi, confirmOrderPaymentApi, getAddressesApi,
  getBuyerConversationsApi, getConversationQuoteApi, resolveMediaUrl,
} from '../services/api';
import { formatRut, isValidRut } from '../services/adapters';
import { isQuoteExpired, quantityFromLabel } from '../utils/quoteFlow';
import { checkoutFallbackShippingMethod, resolveShippingService, shippingMethodPrice } from '../data/shippingMethods';
import { profilePath, ROUTES } from '../routes/paths';
import { useSellerBlocked } from '../hooks/useSellerBlocked';
import BuyerAddressBook from '../components/BuyerAddressBook';
import CheckoutSummaryPanel from '../components/CheckoutSummaryPanel';

const STEPS = [
  { id: 'entrega', label: 'Entrega' },
  { id: 'pago', label: 'Pago' },
];

const LAST_SUCCESSFUL_ORDER_KEY = 'repuestop_last_successful_order';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { isBlocked: isBlockedAccount } = useSellerBlocked();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { cartItems, cartCount, cartTotals, clearCart } = useMarketplace();
  const userId = user?.userId ?? user?.id;

  const location = useLocation();

  // Modo cotización: `/checkout?cotizacion=ID`. El pago de una cotización cerrada vivía
  // dentro del chat con su propia copia de dirección, documento y totales; ahora usa
  // este mismo checkout y esa copia se eliminó.
  const conversacionId = searchParams.get('cotizacion');
  const isQuoteMode = Boolean(conversacionId);
  // El chat pasa los datos de display por `state` para pintar la vista al instante; si
  // se entra por URL directa se recuperan del listado de conversaciones.
  const [quoteContext, setQuoteContext] = useState(location.state?.quoteContext || null);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(isQuoteMode);
  const [quoteError, setQuoteError] = useState('');

  const requestedStep = searchParams.get('paso');
  // Compatibilidad hacia atrás: si la URL o el historial apuntan a 'documento', se normaliza a 'pago'
  const normalizedStep = requestedStep === 'documento' ? 'pago' : requestedStep;
  const step = STEPS.some((entry) => entry.id === normalizedStep) ? normalizedStep : 'entrega';
  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressBookOpen, setAddressBookOpen] = useState(false);

  const [documentType, setDocumentType] = useState(user?.facturaRut ? 'FACTURA' : 'BOLETA');
  const [invoice, setInvoice] = useState({
    rut: user?.facturaRut || '',
    razonSocial: user?.facturaRazonSocial || '',
    giro: user?.facturaGiro || '',
  });

  const [error, setError] = useState('');
  // `placing` sobrevive al vaciado del carrito: sin él, el clearCart posterior al pedido
  // dispararía la guarda de "carrito vacío" y devolvería al usuario a /carrito en vez de
  // dejarlo llegar a la confirmación.
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('SIMULACION');
  const [paymentProcessingStatus, setPaymentProcessingStatus] = useState('');
  const submittingRef = useRef(false);

  // Espejo de `quoteContext` para leerlo dentro del efecto sin ponerlo en sus
  // dependencias: el propio efecto lo escribe, y tenerlo ahí lo hacía dispararse de
  // nuevo y pedir la cotización dos veces.
  const quoteContextRef = useRef(quoteContext);
  useEffect(() => { quoteContextRef.current = quoteContext; }, [quoteContext]);

  useEffect(() => {
    if (!isQuoteMode || !userId) return undefined;
    const contextoActual = quoteContextRef.current;

    let active = true;
    setQuoteLoading(true);
    setQuoteError('');

    Promise.all([
      getConversationQuoteApi(conversacionId),
      contextoActual ? Promise.resolve(null) : getBuyerConversationsApi(userId),
    ])
      .then(([savedQuote, conversations]) => {
        if (!active) return;
        if (!savedQuote) {
          setQuoteError('Esta conversación todavía no tiene una cotización para pagar.');
          return;
        }
        if (isQuoteExpired(savedQuote)) {
          setQuoteError('La cotización venció. Pídele al vendedor que la actualice.');
          return;
        }
        setQuote(savedQuote);
        if (!contextoActual && Array.isArray(conversations)) {
          const found = conversations.find((item) => String(item.id) === String(conversacionId));
          if (found) {
            setQuoteContext({
              conversacionId: found.id,
              productoId: found.productoId,
              productoNombre: found.productoNombre,
              productoImagenUrl: resolveMediaUrl(found.productoImagenUrl),
              proveedorId: found.proveedorId,
              tiendaNombre: found.participante || found.proveedorNombre,
            });
          }
        }
      })
      .catch((loadError) => {
        if (active) setQuoteError(loadError.message || 'No pudimos cargar la cotización.');
      })
      .finally(() => { if (active) setQuoteLoading(false); });

    return () => { active = false; };
  }, [isQuoteMode, conversacionId, userId]);

  /**
   * En modo cotización el checkout trabaja con una sola línea armada desde la propuesta
   * del vendedor: precio acordado, cantidad acordada y las condiciones de entrega que él
   * definió (que reemplazan al selector de envío del carrito).
   */
  const quoteLine = useMemo(() => {
    if (!quote) return null;
    const cantidad = quantityFromLabel(quote.cantidad) || 1;
    const total = Number(quote.precioFinal ?? quote.precio ?? 0);
    const unitario = Number(quote.precioUnitario ?? (cantidad ? total / cantidad : total));
    return {
      id: quoteContext?.productoId || conversacionId,
      titulo: quoteContext?.productoNombre || 'Producto cotizado',
      imagen: quoteContext?.productoImagenUrl || '',
      vendedor: quoteContext?.tiendaNombre || 'Tienda RepuesTop',
      proveedorId: quoteContext?.proveedorId,
      precio: unitario,
      quantity: cantidad,
      total,
      shippingMethod: quote.condicionesEntrega || '',
      shippingFee: 0,
    };
  }, [quote, quoteContext, conversacionId]);

  const lineItems = useMemo(
    () => (isQuoteMode ? (quoteLine ? [quoteLine] : []) : cartItems),
    [isQuoteMode, quoteLine, cartItems]
  );
  const itemCount = isQuoteMode ? (quoteLine?.quantity || 0) : cartCount;
  // El envío de una cotización va acordado dentro de `condicionesEntrega` y lo liquida el
  // backend; acá no se recalcula, se muestra el precio cerrado con el vendedor.
  const totals = isQuoteMode
    ? { subtotal: quoteLine?.total || 0, costoEnvio: 0, total: quoteLine?.total || 0 }
    : cartTotals;

  // Retiro en tienda no necesita dirección de despacho.
  const needsAddress = useMemo(() => lineItems.some((item) => (
    resolveShippingService(item.shippingMethod).name !== 'Retiro en tienda'
  )), [lineItems]);

  const groups = useMemo(() => {
    const byStore = new Map();
    lineItems.forEach((item) => {
      const key = String(item.proveedorId || item.vendedor || item.id);
      if (!byStore.has(key)) {
        byStore.set(key, { key, vendedor: item.vendedor, shippingMethod: item.shippingMethod || '', items: [] });
      }
      byStore.get(key).items.push(item);
    });
    return [...byStore.values()];
  }, [lineItems]);

  const shippingLabel = useMemo(() => {
    const services = lineItems
      .map((item) => item.shippingMethod)
      .filter(Boolean)
      .map((method) => resolveShippingService(method).name);
    if (services.length === 0) return 'Por definir';
    if (services.every((name) => name === 'Retiro en tienda')) return 'Retiro en tienda';
    if (services.some((name) => name === 'Envío fuera de la comuna')) return 'Por pagar';
    return 'Sin costo';
  }, [lineItems]);

  const loadAddresses = useCallback(() => {
    if (!userId) return;
    setAddressesLoading(true);
    getAddressesApi(userId)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAddresses(list);
        const principal = list.find((address) => address.esPrincipal);
        setSelectedAddressId((current) => current || String(principal?.id || list[0]?.id || ''));
      })
      .catch(() => setAddresses([]))
      .finally(() => setAddressesLoading(false));
  }, [userId]);

  useEffect(() => {
    if (needsAddress && userId) loadAddresses();
  }, [needsAddress, userId, loadAddresses]);

  // Se parte de los params actuales en vez de escribir un objeto nuevo: pasarle
  // `{ paso: id }` a setSearchParams reemplaza TODA la query, y eso borraba el
  // `?cotizacion=` al avanzar de paso — el checkout perdía el modo cotización a mitad
  // de camino y la guarda de carrito vacío mandaba al usuario a /carrito.
  const goStep = (id) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (id === 'entrega') next.delete('paso');
      else next.set('paso', id);
      return next;
    }, { replace: false });
    setError('');
  };

  const rutValid = isValidRut(invoice.rut);
  const stepComplete = {
    entrega: !needsAddress || Boolean(selectedAddressId),
    pago: Boolean(paymentMethod) && (documentType !== 'FACTURA' || rutValid),
  };

  // Lo que falta para avanzar, dicho antes de que la persona haga clic: el botón se
  // deshabilita, pero un botón apagado sin explicación es igual de frustrante.
  const missingForStep = {
    entrega: 'Selecciona una dirección de entrega para continuar.',
    pago: documentType === 'FACTURA' && !rutValid
      ? 'Ingresa un RUT válido para emitir la factura.'
      : '',
  }[step];

  const pay = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPlacing(true);
    setError('');
    setPaymentProcessingStatus('Generando el pedido…');
    try {
      const order = isQuoteMode
        ? await checkoutConversationQuoteApi(userId, {
          productoId: quoteContext?.productoId,
          precioUnitario: quoteLine.precio,
          cantidad: quoteLine.quantity,
          metodoEnvio: quoteLine.shippingMethod,
          conversacionId,
          tipoDocumentoTributario: documentType,
          facturaRut: documentType === 'FACTURA' ? invoice.rut.trim() : null,
          facturaRazonSocial: documentType === 'FACTURA' ? invoice.razonSocial.trim() : null,
          facturaGiro: documentType === 'FACTURA' ? invoice.giro.trim() : null,
          direccionId: needsAddress ? Number(selectedAddressId) : null,
        })
        : await checkoutCartApi(userId, {
          direccionId: needsAddress ? String(selectedAddressId) : '',
          metodoEnvio: checkoutFallbackShippingMethod(cartItems),
          tipoDocumentoTributario: documentType,
          facturaRut: documentType === 'FACTURA' ? invoice.rut.trim() : '',
          facturaRazonSocial: documentType === 'FACTURA' ? invoice.razonSocial.trim() : '',
          facturaGiro: documentType === 'FACTURA' ? invoice.giro.trim() : '',
        });
      // Una cotización no toca el carrito: vaciarlo acá borraría productos que la
      // persona dejó guardados para después.
      if (!isQuoteMode) clearCart();

      // ¿Debe simularse el pago?
      // Se simula si el usuario eligió SIMULACION o si el urlPago contiene token mock de prueba
      const isMockToken = Boolean(order?.urlPago && /mock_flow_token_/i.test(order.urlPago));
      const shouldSimulate = paymentMethod === 'SIMULACION' || isMockToken;

      if (shouldSimulate && order?.id) {
        setPaymentProcessingStatus('Simulando confirmación de pago…');
        let finalOrder = order;
        try {
          const confirmed = await confirmOrderPaymentApi(userId, order.id);
          if (confirmed) {
            finalOrder = { ...confirmed, isSimulatedPayment: true };
          } else {
            finalOrder = { ...order, estado: 'PAGADO', isSimulatedPayment: true };
          }
        } catch (confirmErr) {
          console.warn('Confirmación directa de pago simulado omitida, usando fallback:', confirmErr);
          finalOrder = { ...order, estado: 'PAGADO', isSimulatedPayment: true };
        }

        try {
          sessionStorage.setItem(LAST_SUCCESSFUL_ORDER_KEY, JSON.stringify(finalOrder));
        } catch {
          // El state de navegación mantiene la confirmación disponible en esta sesión.
        }

        setPaymentProcessingStatus('¡Pago aprobado con éxito!');
        navigate(ROUTES.purchaseSuccess, { state: { order: finalOrder, isSimulated: true } });
        return;
      }

      // Si no es simulación y trae urlPago de Flow real, redirige a la pasarela
      try {
        sessionStorage.setItem(LAST_SUCCESSFUL_ORDER_KEY, JSON.stringify(order));
      } catch {
        // El state de navegación mantiene la confirmación disponible en esta sesión.
      }
      if (order?.urlPago) {
        window.location.href = order.urlPago;
        return;
      }
      navigate(ROUTES.purchaseSuccess, { state: { order } });
    } catch (submitError) {
      setError(submitError.message || 'No se pudo generar el pedido. Intenta nuevamente.');
      submittingRef.current = false;
      setPlacing(false);
      setPaymentProcessingStatus('');
    }
  };

  const advance = () => {
    if (!stepComplete[step]) {
      setError(missingForStep);
      return;
    }
    if (step === 'pago') { pay(); return; }
    goStep(STEPS[stepIndex + 1].id);
  };

  // Cuenta bloqueada: el backend responde 403 a todo el lado comprador. Se corta antes
  // de que el usuario llene la direccion y el pago falle al final.
  if (isBlockedAccount) {
    return (
      <main className="checkout-page">
        <div className="cart-page-shell">
          <div className="checkout-block">
            <p className="checkout-error">
              <Lock size={15} /> Tu cuenta está bloqueada: no puedes completar compras mientras se revisa tu caso.
            </p>
            <button type="button" className="checkout-summary-back" onClick={() => navigate(profilePath('resumen'))}>
              <ArrowLeft size={15} /> Ir a mi perfil
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!isQuoteMode && cartItems.length === 0 && !placing) return <Navigate to={ROUTES.cart} replace />;

  if (isQuoteMode && (quoteLoading || quoteError || !quoteLine)) {
    return (
      <main className="checkout-page">
        <div className="cart-page-shell">
          {quoteLoading ? (
            <p className="checkout-block-loading"><Loader2 size={16} className="spin-icon" /> Cargando la cotización…</p>
          ) : (
            <div className="checkout-block">
              <p className="checkout-error"><AlertTriangle size={15} /> {quoteError || 'No encontramos esta cotización.'}</p>
              <button type="button" className="checkout-summary-back" onClick={() => navigate(profilePath('cotizaciones'))}>
                <ArrowLeft size={15} /> Volver a mis cotizaciones
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="cart-page-shell">
        <header className="cart-page-head checkout-shopify-header">
          <div className="checkout-shopify-header-top">
            {isQuoteMode
              ? <Link className="cart-page-back" to={profilePath('cotizaciones')}><ArrowLeft size={16} /> Volver a mis cotizaciones</Link>
              : <Link className="cart-page-back" to={ROUTES.cart}><ArrowLeft size={16} /> Volver al carrito</Link>}
            <h1>{isQuoteMode ? 'Pagar cotización' : 'Finalizar compra'}</h1>
          </div>

          <nav className="shopify-breadcrumb-nav" aria-label="Progreso de la compra">
            <Link
              to={isQuoteMode ? profilePath('cotizaciones') : ROUTES.cart}
              className="shopify-breadcrumb-link"
            >
              {isQuoteMode ? 'Cotización' : 'Carrito'}
            </Link>
            <ChevronRight size={13} className="shopify-breadcrumb-sep" />

            <button
              type="button"
              className={`shopify-breadcrumb-step ${step === 'entrega' ? 'is-active' : 'is-completed'}`}
              onClick={() => goStep('entrega')}
            >
              Entrega
            </button>
            <ChevronRight size={13} className="shopify-breadcrumb-sep" />

            <button
              type="button"
              className={`shopify-breadcrumb-step ${step === 'pago' ? 'is-active' : ''}`}
              onClick={() => stepComplete.entrega && goStep('pago')}
              disabled={!stepComplete.entrega}
            >
              Pago y facturación
            </button>
          </nav>
        </header>

        <div className="cart-page-layout">
          <div className="checkout-main">
            {step === 'entrega' && (
              <div className="checkout-main-flow">
                <section className="checkout-block checkout-contact-card" aria-label="Información de contacto">
                  <div className="checkout-contact-header">
                    <span className="checkout-contact-title">
                      <User size={15} /> Información de contacto
                    </span>
                    <span className="checkout-contact-user">
                      {user?.email || user?.nombreCompleto || 'Usuario RepuesTop'}
                    </span>
                  </div>
                  <p className="checkout-contact-note">
                    Recibirás la confirmación del pedido y comprobante de compra en esta cuenta.
                  </p>
                </section>

                <section className="checkout-block" aria-labelledby="checkout-entrega-title">
                  <h2 id="checkout-entrega-title"><MapPin size={16} /> ¿Dónde recibes tu pedido?</h2>

                  {needsAddress ? (
                    <>
                      {addressesLoading ? (
                        <p className="checkout-block-loading"><Loader2 size={15} className="spin-icon" /> Cargando tus direcciones…</p>
                      ) : addresses.length > 0 ? (
                        <div className="checkout-address-list" role="radiogroup" aria-label="Direcciones guardadas">
                          {addresses.map((address) => (
                            <label key={address.id} className={String(address.id) === String(selectedAddressId) ? 'is-selected' : ''}>
                              <input
                                type="radio"
                                name="checkout-address"
                                value={address.id}
                                checked={String(address.id) === String(selectedAddressId)}
                                onChange={(event) => setSelectedAddressId(event.target.value)}
                              />
                              <span className="checkout-address-body">
                                <strong>{address.calleYNumero}</strong>
                                <small>{address.comunaNombre}{address.regionNombre ? `, ${address.regionNombre}` : ''}</small>
                              </span>
                              {address.esPrincipal && <em className="checkout-address-tag">Principal</em>}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="checkout-block-empty"><AlertTriangle size={15} /> Todavía no tienes direcciones guardadas.</p>
                      )}

                      <button
                        type="button"
                        className="checkout-inline-link"
                        onClick={() => setAddressBookOpen((open) => !open)}
                      >
                        {addressBookOpen ? 'Ocultar mis direcciones' : 'Agregar o editar direcciones'}
                      </button>

                      {(addressBookOpen || (!addressesLoading && addresses.length === 0)) && (
                        <div className="checkout-address-book"><BuyerAddressBook usuarioId={userId} /></div>
                      )}
                    </>
                  ) : (
                    <p className="checkout-block-note">
                      Todos los productos son retiro en tienda, así que no necesitamos una dirección de despacho.
                      Coordina el retiro con cada vendedor desde el detalle del pedido.
                    </p>
                  )}

                  {isQuoteMode && (
                    <p className="checkout-block-note checkout-quote-terms">
                      <FileText size={14} /> La entrega ya está acordada en la cotización:
                      {' '}<strong>{quoteLine.shippingMethod || 'a coordinar con la tienda'}</strong>.
                    </p>
                  )}

                  <div className="checkout-delivery-recap">
                    {groups.map((group) => {
                      const service = resolveShippingService(group.shippingMethod);
                      const price = shippingMethodPrice(group.shippingMethod);
                      return (
                        <div key={group.key}>
                          <span><Store size={14} /> {group.vendedor || 'Tienda RepuesTop'}</span>
                          <strong>{service.label}{price ? ` · ${price}` : ''}</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {step === 'pago' && (
              <div className="checkout-main-flow">
                {/* Shopify Recap Box con botones 'Cambiar' para contacto, dirección y método */}
                <div className="shopify-recap-box" aria-label="Resumen de datos de entrega">
                  <div className="shopify-recap-row">
                    <span className="shopify-recap-label">Contacto</span>
                    <span className="shopify-recap-value">{user?.email || user?.nombreCompleto || 'Usuario RepuesTop'}</span>
                    <button type="button" className="shopify-recap-action" onClick={() => goStep('entrega')}>
                      Cambiar
                    </button>
                  </div>

                  <div className="shopify-recap-divider" />

                  <div className="shopify-recap-row">
                    <span className="shopify-recap-label">Enviar a</span>
                    <span className="shopify-recap-value">
                      {needsAddress
                        ? (() => {
                          const address = addresses.find((item) => String(item.id) === String(selectedAddressId));
                          return address ? `${address.calleYNumero}, ${address.comunaNombre}${address.regionNombre ? `, ${address.regionNombre}` : ''}` : 'Dirección seleccionada';
                        })()
                        : 'Retiro en tienda (coordinar con vendedor)'}
                    </span>
                    <button type="button" className="shopify-recap-action" onClick={() => goStep('entrega')}>
                      Cambiar
                    </button>
                  </div>

                  <div className="shopify-recap-divider" />

                  <div className="shopify-recap-row">
                    <span className="shopify-recap-label">Método</span>
                    <span className="shopify-recap-value">{shippingLabel}</span>
                    <button type="button" className="shopify-recap-action" onClick={() => goStep('entrega')}>
                      Cambiar
                    </button>
                  </div>
                </div>

                {/* Métodos de Pago con selector de Simulación */}
                <section className="checkout-block" aria-labelledby="checkout-pago-title">
                  <div className="shopify-section-header">
                    <h2 id="checkout-pago-title"><CreditCard size={16} /> Método de pago</h2>
                    <p className="shopify-section-subtitle">
                      <Lock size={13} /> Todas las transacciones son seguras y están encriptadas.
                    </p>
                  </div>

                  <div className="checkout-payment-options-grid" role="radiogroup" aria-label="Métodos de pago">
                    <label className={`checkout-payment-card-option ${paymentMethod === 'SIMULACION' ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="SIMULACION"
                        checked={paymentMethod === 'SIMULACION'}
                        onChange={() => setPaymentMethod('SIMULACION')}
                      />
                      <div className="checkout-payment-card-body">
                        <div className="checkout-payment-card-header">
                          <strong>Simulación de Pago</strong>
                          <span className="checkout-badge-test"><Sparkles size={12} /> Modo Pruebas</span>
                        </div>
                        <p>Simula la confirmación y aprobación instantánea del pago sin cobro real, ideal para pruebas completas.</p>
                      </div>
                    </label>

                    <label className={`checkout-payment-card-option ${paymentMethod === 'FLOW' ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="FLOW"
                        checked={paymentMethod === 'FLOW'}
                        onChange={() => setPaymentMethod('FLOW')}
                      />
                      <div className="checkout-payment-card-body">
                        <div className="checkout-payment-card-header">
                          <strong>Pasarela Flow</strong>
                          <span className="checkout-badge-flow">Webpay / Tarjetas</span>
                        </div>
                        <p>Redirige a Flow para pago con tarjetas bancarias (crédito, débito o sandbox).</p>
                      </div>
                    </label>
                  </div>

                  {paymentMethod === 'SIMULACION' && (
                    <div className="checkout-simulation-alert">
                      <Sparkles size={16} />
                      <span>
                        <strong>Modo simulación activo:</strong> Al pagar, el pedido se confirmará y pasará al estado <strong>PAGADO</strong> automáticamente para verificar el flujo de compra y preparación.
                      </span>
                    </div>
                  )}
                </section>

                {/* Datos de Facturación (Boleta o Factura) */}
                <section className="checkout-block" aria-labelledby="checkout-billing-title">
                  <div className="shopify-section-header">
                    <h2 id="checkout-billing-title"><ReceiptText size={16} /> Datos de facturación</h2>
                    <p className="shopify-section-subtitle">
                      Selecciona el documento tributario que emitirá el vendedor para tu compra.
                    </p>
                  </div>

                  <div className="cart-document-options">
                    <label className={documentType === 'BOLETA' ? 'selected' : ''}>
                      <input
                        type="radio"
                        name="checkout-document"
                        value="BOLETA"
                        checked={documentType === 'BOLETA'}
                        onChange={(event) => setDocumentType(event.target.value)}
                      />
                      <ReceiptText size={20} />
                      <span>
                        <strong>Boleta electrónica</strong>
                        <small>Compra personal / Consumidor final</small>
                      </span>
                    </label>
                    <label className={documentType === 'FACTURA' ? 'selected' : ''}>
                      <input
                        type="radio"
                        name="checkout-document"
                        value="FACTURA"
                        checked={documentType === 'FACTURA'}
                        onChange={(event) => setDocumentType(event.target.value)}
                      />
                      <Building2 size={20} />
                      <span>
                        <strong>Factura electrónica</strong>
                        <small>Requiere datos tributarios de empresa</small>
                      </span>
                    </label>
                  </div>

                  {documentType === 'FACTURA' && (
                    <div className="cart-invoice-fields">
                      <label>
                        <span>RUT empresa *</span>
                        <input
                          value={invoice.rut}
                          onChange={(event) => setInvoice((current) => ({ ...current, rut: formatRut(event.target.value) }))}
                          placeholder="76.123.456-7"
                          inputMode="text"
                          maxLength={12}
                        />
                        {invoice.rut && !rutValid && <small className="checkout-field-error">El RUT no es válido.</small>}
                      </label>
                      <label>
                        <span>Razón social</span>
                        <input
                          value={invoice.razonSocial}
                          onChange={(event) => setInvoice((current) => ({ ...current, razonSocial: event.target.value }))}
                          placeholder="Nombre de la empresa"
                          maxLength={180}
                        />
                      </label>
                      <label>
                        <span>Giro</span>
                        <input
                          value={invoice.giro}
                          onChange={(event) => setInvoice((current) => ({ ...current, giro: event.target.value }))}
                          placeholder="Actividad comercial"
                          maxLength={150}
                        />
                      </label>
                    </div>
                  )}
                </section>

                {/* Revisión de Productos por Tienda */}
                <section className="checkout-block" aria-labelledby="checkout-review-title">
                  <h2 id="checkout-review-title" className="checkout-subheading-sm">
                    Revisión de productos
                  </h2>

                  <div className="checkout-recap-lines">
                    {groups.map((group) => (
                      <div key={group.key} className="checkout-recap-store">
                        <h3><Store size={14} /> {group.vendedor || 'Tienda RepuesTop'}</h3>
                        {group.items.map((item) => (
                          <p key={item.id}>
                            <span>{item.quantity} × {item.titulo}</span>
                            <strong>{formatCLP(item.precio * item.quantity)}</strong>
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>

                  <p className="checkout-terms-note">
                    Al pagar aceptas los <Link to={ROUTES.terms} target="_blank" rel="noreferrer">Términos y Condiciones</Link> y
                    la <Link to={ROUTES.privacy} target="_blank" rel="noreferrer">Política de Privacidad</Link> de RepuesTop.
                  </p>
                </section>
              </div>
            )}

            {error && <p className="checkout-error"><AlertTriangle size={15} /> {error}</p>}
          </div>

          <CheckoutSummaryPanel
            itemCount={itemCount}
            subtotal={totals.subtotal}
            costoEnvio={totals.costoEnvio}
            total={totals.total}
            shippingLabel={shippingLabel}
            ctaLabel={
              step === 'pago'
                ? (paymentProcessingStatus || (paymentMethod === 'SIMULACION' ? `Simular y pagar ${formatCLP(totals.total)}` : `Pagar ${formatCLP(totals.total)}`))
                : 'Continuar con el pago'
            }
            onCta={advance}
            ctaDisabled={!stepComplete[step] || placing}
            ctaLoading={placing}
            warning={stepComplete[step] ? '' : missingForStep}
          >
            {step === 'pago' && (
              <button
                type="button"
                className="checkout-summary-back"
                onClick={() => goStep('entrega')}
              >
                <ArrowLeft size={15} /> Volver a entrega
              </button>
            )}
          </CheckoutSummaryPanel>
        </div>
      </div>
    </main>
  );
}
