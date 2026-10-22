import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { getAuctionPurchase, payAuctionPurchase } from '../services/auctionApi';
import { confirmOrderPaymentApi, getAddressesApi } from '../services/api';
import { formatRut, isValidRut } from '../services/adapters';
import { auctionDetailPath, profilePath, ROUTES } from '../routes/paths';
import { useAuth } from '../context/AuthContext';
import { useFlag } from '../remoteConfig/hooks';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import '../styles/auction-purchase.css';

const LAST_SUCCESSFUL_ORDER_KEY = 'repuestop_last_successful_order';
const nf = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const money = (value) => (value == null ? '—' : nf.format(value));
const isPickup = (method) => /retiro/i.test(method || '');

/**
 * Pago de una subasta: las ofertas aceptadas de una o varias tiendas se pagan juntas, en un solo pedido
 * de varias tiendas. Los precios y los envíos los fija el servidor con lo que cada tienda ofertó.
 */
export default function AuctionCheckoutPage() {
  useDocumentTitle('Pagar pedido');
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.userId ?? user?.id;
  const SIMULATED_PAYMENT_ENABLED = useFlag('market.checkout.pago-simulado', __DEPLOY_BRANCH__ !== 'main');

  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState('');
  const [documentType, setDocumentType] = useState(user?.facturaRut ? 'FACTURA' : 'BOLETA');
  const [invoice, setInvoice] = useState({ rut: user?.facturaRut ? formatRut(user.facturaRut) : '', razonSocial: user?.facturaRazonSocial || '', giro: user?.facturaGiro || '' });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [choices, setChoices] = useState({});
  const [addressesReady, setAddressesReady] = useState(false);
  const submittingRef = useRef(false);

  // La composición depende de la dirección: cada tienda dice qué entregas llegan ahí. Al cambiarla se recarga
  // y cada tienda vuelve al método que le corresponde para esa dirección.
  useEffect(() => {
    if (userId && !addressesReady) return undefined;
    let active = true;
    getAuctionPurchase(id, addressId || null)
      .then((data) => {
        if (!active) return;
        setPurchase(data);
        setChoices(Object.fromEntries((data?.tiendas || []).map((store) => [store.cotizacionId, store.metodoEntrega])));
        setLoadError('');
      })
      .catch((err) => { if (active) setLoadError(err?.message || 'No pudimos cargar tu pedido.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, addressId, addressesReady, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    getAddressesApi(userId)
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setAddresses(list);
        const principal = list.find((address) => address.esPrincipal) || list[0];
        if (principal) setAddressId(String(principal.id));
      })
      .catch(() => { if (active) setAddresses([]); })
      .finally(() => { if (active) setAddressesReady(true); });
    return () => { active = false; };
  }, [userId]);

  const stores = purchase?.tiendas || [];
  const toPay = useMemo(() => stores.filter((store) => !store.pagada), [stores]);
  const chosenMethod = (store) => choices[store.cotizacionId] || store.metodoEntrega;
  const chosenOption = (store) => (store.opcionesEntrega || []).find((option) => option.metodo === chosenMethod(store));
  const shippingOf = (store) => Number(chosenOption(store)?.costo ?? store.costoEnvio ?? 0);
  const totalOf = (store) => Number(store.subtotal) + shippingOf(store);
  const totalShipping = toPay.reduce((sum, store) => sum + shippingOf(store), 0);
  const totalToPay = toPay.reduce((sum, store) => sum + totalOf(store), 0);
  const needsAddress = toPay.some((store) => !isPickup(chosenMethod(store)));

  const missing = [];
  if (needsAddress && !addressId) missing.push('elige la dirección de despacho');
  if (documentType === 'FACTURA' && (!isValidRut(invoice.rut) || !invoice.razonSocial.trim() || !invoice.giro.trim())) {
    missing.push('completa los datos de la factura (RUT, razón social y giro)');
  }

  const pay = async () => {
    if (submittingRef.current) return;
    if (missing.length > 0) {
      setError(`Para pagar, ${missing.join(' y ')}.`);
      return;
    }
    submittingRef.current = true;
    setPlacing(true);
    setError('');
    try {
      const order = await payAuctionPurchase(id, {
        direccionId: needsAddress && addressId ? Number(addressId) : null,
        tipoDocumentoTributario: documentType,
        facturaRut: documentType === 'FACTURA' ? invoice.rut.trim() : null,
        facturaRazonSocial: documentType === 'FACTURA' ? invoice.razonSocial.trim() : null,
        facturaGiro: documentType === 'FACTURA' ? invoice.giro.trim() : null,
        entregas: Object.fromEntries(toPay.map((store) => [store.cotizacionId, chosenMethod(store)])),
      });

      // En ambientes de prueba la pasarela devuelve un token simulado: se confirma el pago al tiro.
      const isMockToken = Boolean(order?.urlPago && /mock_flow_token_/i.test(order.urlPago));
      if ((SIMULATED_PAYMENT_ENABLED && isMockToken) && order?.id) {
        let finalOrder = order;
        try {
          finalOrder = (await confirmOrderPaymentApi(userId, order.id)) || order;
        } catch (confirmErr) {
          console.warn('No se pudo confirmar el pago simulado:', confirmErr);
        }
        try { sessionStorage.setItem(LAST_SUCCESSFUL_ORDER_KEY, JSON.stringify(finalOrder)); } catch { /* sin almacenamiento */ }
        navigate(ROUTES.purchaseSuccess, { state: { order: finalOrder, isSimulated: true } });
        return;
      }
      try { sessionStorage.setItem(LAST_SUCCESSFUL_ORDER_KEY, JSON.stringify(order)); } catch { /* sin almacenamiento */ }
      if (order?.urlPago) {
        window.location.href = order.urlPago;
        return;
      }
      navigate(ROUTES.purchaseSuccess, { state: { order } });
    } catch (err) {
      setError(err?.message || 'No pudimos generar el pedido. Inténtalo de nuevo.');
      submittingRef.current = false;
      setPlacing(false);
    }
  };

  if (loading) {
    return <main className="apc-page"><div className="container apc-shell"><p className="ap-muted">Cargando tu pedido…</p></div></main>;
  }
  if (loadError || !purchase) {
    return (
      <main className="apc-page">
        <div className="container apc-shell">
          <p className="apc-error" role="alert"><AlertCircle size={16} /> {loadError || 'No pudimos cargar tu pedido.'}</p>
          <Link className="apc-back" to={auctionDetailPath(id)}><ArrowLeft size={15} /> Volver a la subasta</Link>
        </div>
      </main>
    );
  }
  if (!purchase.puedePagar) {
    return (
      <main className="apc-page">
        <div className="container apc-shell">
          <p className="apc-note"><CheckCircle2 size={15} /> Este pedido no tiene nada pendiente de pago.</p>
          <Link className="apc-back" to={profilePath('subastas')}><ArrowLeft size={15} /> Volver a mis subastas</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="apc-page">
      <div className="container apc-shell">
        <Link className="apc-back" to={auctionDetailPath(id)}><ArrowLeft size={15} /> Volver a la subasta</Link>
        <h1 className="apc-title">Pagar pedido</h1>
        <p className="apc-sub">{purchase.titulo} · compra de {toPay.length} {toPay.length === 1 ? 'tienda' : 'tiendas'}, un solo pago.</p>

        <div className="apc-layout">
          <div className="apc-col">
            <section className="apc-card">
              <h2><span>1</span> Tu pedido por tienda</h2>
              {toPay.map((store) => (
                <article key={store.cotizacionId} className="ap-store" style={{ marginBottom: 12 }}>
                  <header className="ap-store-head">
                    <div>
                      <strong>{store.tienda}</strong>
                      <small><Truck size={12} /> {chosenMethod(store)}{store.plazoEntrega ? ` · ${store.plazoEntrega}` : ''}</small>
                    </div>
                    <strong>{money(totalOf(store))}</strong>
                  </header>
                  <table className="ap-lines">
                    <tbody>
                      {store.lineas.map((line) => (
                        <tr key={line.itemId}>
                          <td><strong>{line.repuesto}</strong><small>{line.productoTitulo}</small></td>
                          <td className="is-num">{line.cantidad} × {money(line.precioUnitario)}</td>
                          <td className="is-num">{money(line.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><td colSpan={2}>Envío</td><td className="is-num">{shippingOf(store) > 0 ? money(shippingOf(store)) : 'Sin costo'}</td></tr>
                    </tfoot>
                  </table>
                  {store.avisoEntrega && <p className="apc-note apc-note-warn"><AlertCircle size={14} /> {store.avisoEntrega}</p>}
                  {(store.opcionesEntrega || []).length > 1 && (
                    <div className="apc-delivery" role="radiogroup" aria-label={`Entrega de ${store.tienda}`}>
                      <span className="apc-delivery-title"><Truck size={13} /> Cómo recibes lo de {store.tienda}</span>
                      {store.opcionesEntrega.map((option) => (
                        <label key={option.metodo} className={`apc-delivery-option ${chosenMethod(store) === option.metodo ? 'is-selected' : ''} ${option.disponible ? '' : 'is-disabled'}`}>
                          <input
                            type="radio"
                            name={`delivery-${store.cotizacionId}`}
                            checked={chosenMethod(store) === option.metodo}
                            disabled={!option.disponible}
                            onChange={() => setChoices((current) => ({ ...current, [store.cotizacionId]: option.metodo }))}
                          />
                          <span>
                            <strong>{option.metodo}{option.costo > 0 ? ` · ${money(option.costo)}` : ''}</strong>
                            {!option.disponible && <small>No disponible: {option.motivo}</small>}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </article>
              ))}
              {purchase.itemsPendientes > 0 && (
                <p className="apc-note">Quedan {purchase.itemsPendientes} {purchase.itemsPendientes === 1 ? 'repuesto' : 'repuestos'} sin adjudicar ({purchase.pendientes.join(', ')}). Puedes pagar lo aceptado ahora y completar el resto después.</p>
              )}
            </section>

            {(needsAddress || addresses.length > 0) && (
              <section className="apc-card">
                <h2><span>2</span> Dirección de despacho</h2>
                <p className="apc-note">Las opciones de entrega de cada tienda dependen de esta dirección. Si no llega a tu comuna, te lo indicamos antes de pagar.</p>
                {addresses.length === 0 ? (
                  <p className="apc-note">No tienes direcciones guardadas. <Link to={profilePath('datos')}>Agrega una en tu perfil</Link> y vuelve para pagar.</p>
                ) : (
                  <div className="apc-options">
                    {addresses.map((address) => (
                      <label key={address.id} className={`apc-option ${String(address.id) === addressId ? 'is-selected' : ''}`}>
                        <input type="radio" name="address" value={address.id} checked={String(address.id) === addressId} onChange={() => setAddressId(String(address.id))} />
                        <span><strong>{address.calleYNumero}</strong><small>{[address.comunaNombre, address.regionNombre].filter(Boolean).join(', ')}{address.esPrincipal ? ' · Principal' : ''}</small></span>
                      </label>
                    ))}
                  </div>
                )}
                {addresses.length > 0 && <p className="ap-muted" style={{ marginTop: 8 }}><Link to={profilePath('datos')}>Agregar o editar mis direcciones</Link></p>}
              </section>
            )}

            <section className="apc-card">
              <h2><span>{needsAddress || addresses.length > 0 ? 3 : 2}</span> Documento tributario</h2>
              <div className="apc-options">
                {[['BOLETA', 'Boleta', 'Para personas.'], ['FACTURA', 'Factura', 'Para empresas: requiere RUT, razón social y giro.']].map(([value, label, hint]) => (
                  <label key={value} className={`apc-option ${documentType === value ? 'is-selected' : ''}`}>
                    <input type="radio" name="document" value={value} checked={documentType === value} onChange={() => setDocumentType(value)} />
                    <span><strong>{label}</strong><small>{hint}</small></span>
                  </label>
                ))}
              </div>
              {documentType === 'FACTURA' && (
                <div className="apc-fields">
                  <label>RUT<input value={invoice.rut} onChange={(e) => setInvoice({ ...invoice, rut: formatRut(e.target.value) })} placeholder="12.345.678-9" /></label>
                  <label>Giro<input value={invoice.giro} onChange={(e) => setInvoice({ ...invoice, giro: e.target.value })} /></label>
                  <label className="is-wide">Razón social<input value={invoice.razonSocial} onChange={(e) => setInvoice({ ...invoice, razonSocial: e.target.value })} /></label>
                </div>
              )}
            </section>
          </div>

          <aside className="apc-card apc-summary">
            <h2>Resumen</h2>
            <dl className="ap-totals">
              <div><dt>Productos</dt><dd>{money(toPay.reduce((sum, s) => sum + s.subtotal, 0))}</dd></div>
              <div><dt>Envíos</dt><dd>{totalShipping > 0 ? money(totalShipping) : 'Sin costo'}</dd></div>
              <div className="is-total"><dt>Total a pagar</dt><dd>{money(totalToPay)}</dd></div>
            </dl>
            {error && <p className="apc-error" role="alert" style={{ marginTop: 12 }}><AlertCircle size={15} /> {error}</p>}
            <button type="button" className="ap-btn-primary apc-pay" onClick={pay} disabled={placing}>
              {placing ? <><Loader2 size={16} className="ap-spin" /> Generando pedido…</> : <><ShoppingCart size={16} /> Pagar {money(totalToPay)}</>}
            </button>
            {missing.length > 0 && !error && <p className="ap-muted" style={{ marginTop: 8 }}>Falta: {missing.join(' y ')}.</p>}
            <p className="ap-muted" style={{ marginTop: 12, display: 'flex', gap: 6 }}><ShieldCheck size={14} /> Pagas a través de la plataforma. El dinero de cada tienda queda retenido hasta tu recepción conforme.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
