import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, FileText, MapPin, Package, ReceiptText, ShoppingBag, Sparkles, Truck, XCircle } from 'lucide-react';
import deliveryTruck from '../assets/delivery-truck.webp';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmOrderPaymentApi, getBuyerOrderByIdApi, getBuyerOrderByRefApi, resolveMediaUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { normalizeOrderStatus } from '../data/orderStatusFlow';
import { buyerProfilePath, profileOrderPath, profilePurchasePath, ROUTES } from '../routes/paths';
import { orderDeliverySummary, orderDisplayCode, orderHasShippingDueOnDelivery, orderNumberRef } from '../data/orderIdentity';
import { buildOrderPackages } from '../utils/orderPackages';

const LAST_SUCCESSFUL_ORDER_KEY = 'repuestop_last_successful_order';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function readStoredOrder() {
  try {
    const raw = sessionStorage.getItem(LAST_SUCCESSFUL_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function PurchaseSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  // plan_retorno_flow.md Fase 3: PagoController.retorno redirige aqui con
  // ?status=success&orderId=... El state/sessionStorage cubren el caso feliz (misma
  // pestaña); si no hay datos ahi (otra pestaña/dispositivo, storage limpiado) se
  // trae el pedido por id con el endpoint nuevo.
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const orderIdFromUrl = searchParams.get('orderId');
  const isFailure = status === 'failure';

  // H58 (pruebas de lanzamiento, 30-sep): la copia guardada es la del ULTIMO checkout de esta
  // pestaña. Si la URL trae otro pedido (un pago reintentado desde "Mis pedidos" tras abandonar
  // otro checkout, o el enlace a un comprobante anterior), la copia no sirve: se mostraba el
  // pedido equivocado. Solo se usa cuando coincide con el `orderId` de la URL.
  const storedOrder = useMemo(() => {
    const candidate = location.state?.order || readStoredOrder();
    if (!candidate || !orderIdFromUrl) return candidate;
    const wanted = String(orderIdFromUrl).replace(/\s/g, '');
    const refs = [candidate.numeroPedido, candidate.id]
      .filter((value) => value != null)
      .map((value) => String(value).replace(/\s/g, ''));
    return refs.includes(wanted) ? candidate : null;
  }, [location.state, orderIdFromUrl]);
  const [fetchedOrder, setFetchedOrder] = useState(null);
  // El pedido de la URL no se pudo traer (no es de esta cuenta, no existe, sin sesión).
  const [orderNotFound, setOrderNotFound] = useState(false);
  const effectiveUserId = user?.userId || user?.buyerId || user?.compradorId || user?.id;
  const buyerPurchasesPath = buyerProfilePath(user, 'purchases');
  const buyerPurchasesLabel = String(user?.role || user?.rol || '').toUpperCase() === 'SELLER'
    ? 'Mis compras'
    : 'Mis pedidos';

  useEffect(() => {
    if (!effectiveUserId || isFailure) return undefined;
    const targetOrderId = orderIdFromUrl || storedOrder?.id;
    if (!targetOrderId) return undefined;

    let active = true;
    if (!storedOrder && orderIdFromUrl) {
      // O72 (pruebas de lanzamiento, 25-sep): `orderId` trae el NUMERO PUBLICO del pedido. Se
      // resuelve por numero y recien con el id real se fuerza la confirmacion del pago.
      getBuyerOrderByRefApi(effectiveUserId, orderIdFromUrl)
        .then((data) => (data?.id
          ? confirmOrderPaymentApi(effectiveUserId, data.id).catch(() => data)
          : data))
        .then((data) => { if (active && data) setFetchedOrder(data); })
        .catch(() => { if (active) setOrderNotFound(true); });
      return () => { active = false; };
    }

    if (storedOrder && storedOrder.estado === 'PENDIENTE') {
      confirmOrderPaymentApi(effectiveUserId, storedOrder.id)
        .then((updated) => { if (active && updated) setFetchedOrder(updated); })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [storedOrder, orderIdFromUrl, effectiveUserId, isFailure]);

  // El pedido más fresco manda: `fetchedOrder` es el que devolvió la confirmación de pago
  // del efecto de arriba, así que si existe ya refleja el estado real y `storedOrder`
  // (la copia que dejó el checkout) está desactualizado.
  const order = fetchedOrder || storedOrder;
  const isSimulated = Boolean(location.state?.isSimulated || order?.isSimulatedPayment || /mock|simulaci/i.test(order?.metodoPagoDetalle || ''));

  // El sello del comprobante sale del estado que manda el backend, no de haber llegado a
  // esta pantalla. Un pedido que se queda en PENDIENTE (la pasarela no aprobó, o el
  // comprador abandonó el pago) aparecía igual como "Pagado". PAGADO y cualquier estado
  // posterior -- EN_PREPARACION, ENVIADO, ENTREGADO, FINALIZADO -- sí implican cobro hecho.
  const orderStatus = order ? normalizeOrderStatus(order) : null;
  const isPendingPayment = orderStatus === 'PENDIENTE';
  const isCancelled = orderStatus === 'CANCELADO';
  const pendingOrderId = isPendingPayment ? order?.id : null;

  // O51 (pruebas de lanzamiento, 25-sep): al volver de Flow el webhook suele llegar unos
  // segundos despues, y la pagina se quedaba en "Pago pendiente" hasta recargar. Mientras el
  // pedido siga PENDIENTE se reconsulta cada 3 s, hasta 10 veces (~30 s). Va antes de los
  // return tempranos para no romper el orden de los hooks.
  useEffect(() => {
    if (!effectiveUserId || isFailure || !pendingOrderId) return undefined;
    let active = true;
    let intentos = 0;
    let enCurso = false;
    const intervalo = setInterval(() => {
      if (enCurso) return;
      intentos += 1;
      if (intentos > 10) {
        clearInterval(intervalo);
        return;
      }
      enCurso = true;
      confirmOrderPaymentApi(effectiveUserId, pendingOrderId)
        .catch(() => getBuyerOrderByIdApi(effectiveUserId, pendingOrderId))
        .then((data) => { if (active && data) setFetchedOrder(data); })
        .catch(() => {})
        .finally(() => { enCurso = false; });
    }, 3000);
    return () => {
      active = false;
      clearInterval(intervalo);
    };
  }, [pendingOrderId, effectiveUserId, isFailure]);

  if (isFailure) {
    return (
      <main className="purchase-success-page">
        <section className="purchase-success-card" aria-labelledby="purchase-failure-title">
          <div className="purchase-success-hero">
            <div className="purchase-success-icon" style={{ background: '#fef2f2', color: '#b91c1c' }}><XCircle /></div>
            <h1 id="purchase-failure-title">Tu pago no pudo procesarse</h1>
            <p>El pago fue rechazado o cancelado. Puedes reintentarlo desde {buyerPurchasesLabel}.</p>
          </div>
          <div className="purchase-success-actions">
            <button type="button" className="purchase-success-primary" onClick={() => navigate(buyerPurchasesPath)}>Ir a {buyerPurchasesLabel}</button>
            <button type="button" className="purchase-success-secondary" onClick={() => navigate(ROUTES.catalog)}>Seguir comprando</button>
          </div>
        </section>
      </main>
    );
  }

  // Sin pedido no hay comprobante que mostrar. Antes se pintaba igual uno genérico
  // ("Pedido #confirmado", sello "Pagado", "Despacho a domicilio"): p. ej. al entrar con otra
  // cuenta sobre la compra exitosa de un comprador (pruebas de lanzamiento, 25-sep).
  if (!order) {
    const cargando = Boolean(orderIdFromUrl && effectiveUserId && !orderNotFound);
    return (
      <main className="purchase-success-page">
        <section className="purchase-success-card" aria-labelledby="purchase-missing-title">
          <div className="purchase-success-hero">
            {!cargando && (
              <div className="purchase-success-icon" style={{ background: '#fffbeb', color: '#b45309' }}><AlertTriangle /></div>
            )}
            <h1 id="purchase-missing-title">
              {cargando ? 'Cargando tu pedido…' : 'No encontramos este pedido en tu cuenta'}
            </h1>
            {!cargando && (
              <p>Revisa tus pedidos con la cuenta con que compraste.</p>
            )}
          </div>
          {!cargando && (
            <div className="purchase-success-actions">
              <button type="button" className="purchase-success-primary" onClick={() => navigate(buyerPurchasesPath)}>Ir a {buyerPurchasesLabel}</button>
              <button type="button" className="purchase-success-secondary" onClick={() => navigate(ROUTES.home)}>Ir al inicio</button>
            </div>
          )}
        </section>
      </main>
    );
  }

  const items = order?.items || [];
  // O72: el numero publico ("4827 1936 05"), el mismo que vera en Mis pedidos y que le pide soporte.
  const orderNumber = order?.id ? orderDisplayCode(order) : 'confirmado';
  const isSellerAccount = String(user?.role || user?.rol || '').toUpperCase() === 'SELLER';
  const orderDetailPath = order?.id
    ? (isSellerAccount ? profilePurchasePath(orderNumberRef(order)) : profileOrderPath(orderNumberRef(order)))
    : buyerPurchasesPath;
  const address = [
    order?.compradorDireccion || order?.direccionEntrega || order?.address,
    order?.compradorComuna || order?.comuna,
    order?.compradorRegion || order?.region,
  ].filter(Boolean).join(', ');
  // `tipoEnvio` es la clave interna del backend (`local_delivery`, `courier_por_pagar`...): nunca se
  // muestra cruda, pasa por la misma traduccion que usa el detalle del pedido.
  const shippingMethod = order?.tipoEnvio || (Array.isArray(order?.subordenes) && order.subordenes.length > 0)
    ? orderDeliverySummary(order)
    : (order?.courier || order?.deliveryTerms || 'Entrega por coordinar');
  // Checkout por producto (2026-10-02): con dos o más paquetes (tienda + método + destino) una sola
  // fila mezclaba el método de uno con la dirección de otro ("Envío fuera de la comuna" a la
  // dirección de Temuco). Se muestra un renglón por paquete, igual que el detalle del pedido.
  const deliveryPackages = buildOrderPackages(order, { fallbackAddress: address || null, fallbackMethod: shippingMethod });
  const multiPackage = deliveryPackages.length > 1;
  const isPickup = multiPackage
    ? deliveryPackages.every((pkg) => pkg.kind === 'pickup')
    : /retiro|tienda|store_pickup/i.test(shippingMethod);
  // O85 (pruebas de lanzamiento, 27-sep): el titular sigue al estado del pedido. Recién pagado
  // (PAGADO / EN_PREPARACION) decía "Tu pedido va viajando a su destino" aunque la tienda
  // todavía lo estaba preparando. Con varias tiendas manda el estado derivado (la más atrasada).
  const journeyCopy = (() => {
    if (orderStatus === 'ENVIADO') {
      return isPickup
        ? { title: 'Tu pedido está listo para retirar', note: 'Ya puedes retirarlo en la tienda. Tu código de retiro está en el detalle del pedido.' }
        : { title: 'Tu pedido va viajando a su destino', note: 'La tienda ya despachó tu pedido. Cuando lo recibas, confírmalo en el detalle del pedido.' };
    }
    if (orderStatus === 'ENTREGADO' || orderStatus === 'FINALIZADO') {
      return { title: 'Tu pedido ya fue entregado', note: 'La entrega de tu pedido ya quedó registrada.' };
    }
    return isPickup
      ? { title: 'Tu pedido se está preparando para retiro', note: 'La tienda ya fue notificada y está preparando tu pedido. Te avisaremos cuando esté listo para retirar.' }
      : { title: 'La tienda está preparando tu pedido', note: 'La tienda ya fue notificada y está preparando tu pedido. Te avisamos cuando esté en viaje.' };
  })();
  const subtotal = items.reduce((sum, item) => (
    sum + Number(item.precioUnitario || item.precio || item.unitPrice || 0) * Number(item.cantidad || item.quantity || 1)
  ), 0);
  const shippingFee = Number(String(order?.costoEnvio ?? order?.shippingFee ?? 0).replace(/[^0-9]/g, '')) || 0;
  // H57: el envio fuera de la comuna se paga al recibir; su costo 0 no es "Sin costo".
  const shippingDueOnDelivery = orderHasShippingDueOnDelivery(order);
  const shippingLabel = shippingDueOnDelivery
    ? (shippingFee ? `${formatCLP(shippingFee)} + por pagar al recibir` : 'Por pagar al recibir')
    : (shippingFee ? formatCLP(shippingFee) : 'Sin costo');
  const discount = Number(String(order?.descuento ?? 0).replace(/[^0-9]/g, '')) || 0;
  const total = Number(order?.total || subtotal + shippingFee - discount);
  const documentType = String(order?.tipoDocumentoTributario || order?.documentType || 'BOLETA').toUpperCase();
  const orderDate = (() => {
    const raw = order?.fechaCreacion || order?.createdAt || order?.fecha;
    const date = raw ? new Date(raw) : new Date();
    return Number.isNaN(date.getTime())
      ? new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
      : date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return (
    <main className="purchase-success-page">
      <section className="purchase-success-card" aria-labelledby="purchase-success-title">
        <header className="purchase-receipt-head">
          <div>
            <div className="purchase-receipt-tags">
              <span className="purchase-receipt-label">
                {isPendingPayment ? 'Resumen del pedido' : 'Comprobante de compra'}
              </span>
              {isSimulated && (
                <span className="purchase-simulated-tag"><Sparkles size={11} /> Pago simulado (Pruebas)</span>
              )}
            </div>
            <h1 id="purchase-success-title">Pedido {orderNumber}</h1>
            <p>{orderDate}</p>
          </div>
          {isPendingPayment && (
            <span className="purchase-receipt-state is-pending"><AlertTriangle size={13} /> Pago pendiente</span>
          )}
          {isCancelled && (
            <span className="purchase-receipt-state is-cancelled"><XCircle size={13} /> Cancelado</span>
          )}
          {!isPendingPayment && !isCancelled && (
            <span className="purchase-receipt-state"><Check size={13} strokeWidth={3} /> Pagado</span>
          )}
        </header>

        {isPendingPayment && (
          <p className="purchase-pending-notice">
            <AlertTriangle size={15} />
            <span>
              Todavía no recibimos la confirmación del pago, así que este pedido <strong>no está pagado</strong>.
              Reserva el stock por un plazo limitado y puedes reintentar el pago desde {buyerPurchasesLabel}.
            </span>
          </p>
        )}

        {/* Simulación del pedido viajando a su destino por una carretera continua.
            Solo cuando el pedido está pagado: mientras no lo esté, la tienda no recibió
            nada que preparar, y este bloque contradecía al aviso de "no está pagado" que
            aparece justo encima. */}
        {!isPendingPayment && !isCancelled && (
        <div className="purchase-journey">
          <div className="purchase-journey-header">
            <span className="purchase-journey-badge">
              {/* O52 (pruebas de lanzamiento, 25-sep): con retiro en tienda el pedido no viaja.
                  O85 (27-sep): "va viajando" solo cuando la tienda ya despachó. */}
              <Truck size={15} /> {journeyCopy.title}
            </span>
            <span className="purchase-journey-destination">
              <MapPin size={13} /> {isPickup ? 'Retiro en tienda' : multiPackage ? `${deliveryPackages.length} entregas` : (address || 'Despacho a domicilio')}
            </span>
          </div>
          <div className="purchase-journey-track" aria-hidden="true">
            <div className="journey-road">
              <span className="journey-road-lines" />
            </div>
            <img className="journey-truck" src={deliveryTruck} alt="" />
          </div>
          <p className="purchase-journey-note">
            {/* O52: el aviso de retiro no habla de viaje. */}
            {journeyCopy.note}
          </p>
        </div>
        )}

        {order ? (
          <div className="purchase-success-content">
            <section className="purchase-success-products" aria-labelledby="success-products-title">
              <h2 id="success-products-title"><Package size={19} /> Productos comprados</h2>
              <div className="purchase-success-items">
                {items.map((item, index) => {
                  const name = item.nombre || item.productName || item.name || 'Repuesto';
                  const photo = resolveMediaUrl(item.imagenUrl || item.imageUrl || item.productPhotoUri || item.imageUrls?.[0]);
                  const quantity = Number(item.cantidad || item.quantity || 1);
                  const unitPrice = Number(item.precioUnitario || item.precio || item.unitPrice || 0);
                  return (
                    <article className="purchase-success-item" key={item.productoId || item.id || index}>
                      {photo ? <img src={photo} alt={name} /> : <div className="purchase-success-item-placeholder"><Package /></div>}
                      <div>
                        <strong>{name}</strong>
                        <span>{item.marca || item.brand || item.proveedorNombre || ''}</span>
                        <small>Cantidad: {quantity}</small>
                      </div>
                      <b>{formatCLP(unitPrice * quantity)}</b>
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="purchase-success-summary">
              <h2><ReceiptText size={19} /> Resumen del pedido</h2>
              {multiPackage ? deliveryPackages.map((pkg) => (
                <div className="purchase-success-info-row" key={pkg.key}>
                  {pkg.kind === 'pickup' ? <MapPin size={17} /> : <Truck size={17} />}
                  <div>
                    <span>{pkg.method}</span>
                    <strong>
                      {pkg.kind === 'pickup'
                        ? `Retiro en ${pkg.pickupAddress || pkg.storeName}`
                        : (pkg.address || 'Dirección no registrada')}
                    </strong>
                    <small className="purchase-success-package-items">{pkg.products.join(', ')}</small>
                  </div>
                </div>
              )) : (
                <>
                  <div className="purchase-success-info-row">
                    <Truck size={17} />
                    <div><span>Método de entrega</span><strong>{shippingMethod}</strong></div>
                  </div>
                  {!isPickup && (
                    <div className="purchase-success-info-row">
                      <MapPin size={17} />
                      <div><span>Dirección de envío</span><strong>{address || 'Dirección no registrada'}</strong></div>
                    </div>
                  )}
                </>
              )}
              <div className="purchase-success-info-row">
                <FileText size={17} />
                <div><span>Documento tributario</span><strong>{documentType === 'FACTURA' ? 'Factura' : 'Boleta'}</strong></div>
              </div>
              <div className="purchase-success-totals">
                <div><span>Productos</span><strong>{formatCLP(subtotal)}</strong></div>
                {discount > 0 && <div><span>Descuento</span><strong className="purchase-success-discount">−{formatCLP(discount)}</strong></div>}
                <div><span>Envío</span><strong>{shippingLabel}</strong></div>
                <div className="purchase-success-total"><span>{isPendingPayment ? 'Total a pagar' : isCancelled ? 'Total' : 'Total pagado'}</span><strong>{formatCLP(total)}</strong></div>
              </div>

              {/* Las acciones viven al pie del resumen, no sueltas bajo la página: es
                  donde las ponen los marketplaces locales y donde ya está mirando quien
                  acaba de revisar el total. */}
              <div className="purchase-success-actions">
                <button type="button" className="purchase-success-primary" onClick={() => navigate(orderDetailPath)}>Ver detalle del pedido</button>
                <button type="button" className="purchase-success-secondary" onClick={() => navigate(ROUTES.catalog)}>Seguir comprando</button>
              </div>
            </aside>
          </div>
        ) : (
          <div className="purchase-success-missing">
            <ShoppingBag />
            <p>Tu compra fue confirmada. Puedes consultar todos sus datos en {buyerPurchasesLabel}.</p>
            <div className="purchase-success-actions">
              <button type="button" className="purchase-success-primary" onClick={() => navigate(buyerPurchasesPath)}>Ver detalle del pedido</button>
              <button type="button" className="purchase-success-secondary" onClick={() => navigate(ROUTES.catalog)}>Seguir comprando</button>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}
