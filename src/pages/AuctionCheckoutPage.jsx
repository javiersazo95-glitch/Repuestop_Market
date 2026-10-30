import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { getAuctionPurchase, payAuctionPurchase } from '../services/auctionApi';
import { confirmOrderPaymentApi } from '../services/api';
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
 * de varias tiendas. Los precios y los envíos los fija el servidor con lo que cada tienda ofertó (28-oct): cada tienda
 * entrega como lo ofertó y el despacho va a la dirección del comprador en la comuna de la búsqueda, sin elegir otra.
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
  const [documentType, setDocumentType] = useState(user?.facturaRut ? 'FACTURA' : 'BOLETA');
  const [invoice, setInvoice] = useState({ rut: user?.facturaRut ? formatRut(user.facturaRut) : '', razonSocial: user?.facturaRazonSocial || '', giro: user?.facturaGiro || '' });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    getAuctionPurchase(id)
      .then((data) => {
        if (!active) return;
        setPurchase(data);
        setLoadError('');
      })
      .catch((err) => { if (active) setLoadError(err?.message || 'No pudimos cargar tu pedido.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const stores = purchase?.tiendas || [];
  const toPay = useMemo(() => stores.filter((store) => !store.pagada), [stores]);
  const chosenMethod = (store) => store.metodoEntrega;
  const isCourierToPay = (method) => /fuera/i.test(method || '');
  const shippingOf = (store) => Number(store.costoEnvio ?? 0);
  const shippingLabel = (store) => (shippingOf(store) > 0 ? money(shippingOf(store)) : isCourierToPay(chosenMethod(store)) ? 'Por pagar al recibir' : 'Sin costo');
  const anyCourierToPay = toPay.some((store) => isCourierToPay(chosenMethod(store)));
  const totalOf = (store) => Number(store.subtotal) + shippingOf(store);
  const totalShipping = toPay.reduce((sum, store) => sum + shippingOf(store), 0);
  const totalToPay = toPay.reduce((sum, store) => sum + totalOf(store), 0);
  const needsAddress = toPay.some((store) => !isPickup(chosenMethod(store)));

  const missing = [];
  if (needsAddress && !purchase?.direccionId) missing.push(`agrega una dirección en ${purchase?.comuna || 'la comuna de tu búsqueda'}`);
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
        direccionId: purchase?.direccionId ?? null,
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
                      {(store.tiendaComuna || store.tiendaRegion) && <small>Tienda en {[store.tiendaComuna, store.tiendaRegion].filter(Boolean).join(', ')}</small>}
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
                      <tr><td colSpan={2}>Envío</td><td className="is-num">{shippingLabel(store)}</td></tr>
                    </tfoot>
                  </table>
                  {isPickup(chosenMethod(store)) && store.direccionRetiro && (
                    <p className="apc-note"><Truck size={14} /> Retiras en <strong>{store.direccionRetiro}</strong>.</p>
                  )}
                  {isCourierToPay(chosenMethod(store)) && <p className="apc-note apc-note-warn"><AlertCircle size={14} /> Despacho a domicilio por pagar: el costo del envío no está incluido, lo pagas aparte al recibirlo.</p>}
                  {store.avisoEntrega && <p className="apc-note apc-note-warn"><AlertCircle size={14} /> {store.avisoEntrega}</p>}
                </article>
              ))}
              {purchase.itemsPendientes > 0 && (
                <p className="apc-note">Quedan {purchase.itemsPendientes} {purchase.itemsPendientes === 1 ? 'repuesto' : 'repuestos'} sin adjudicar ({purchase.pendientes.join(', ')}). Puedes pagar lo aceptado ahora y completar el resto después.</p>
              )}
            </section>

            {needsAddress && (
              <section className="apc-card">
                <h2><span>2</span> Dirección de despacho</h2>
                <p className="apc-note">Las tiendas ofertaron para {purchase.comuna || 'la comuna de tu búsqueda'}: el pedido llega a tu dirección en esa comuna.</p>
                {purchase.direccionId ? (
                  <p className="apc-option is-selected"><span><strong>{purchase.direccionTexto}</strong></span></p>
                ) : (
                  <p className="apc-note apc-note-warn">No tienes una dirección en {purchase.comuna || 'la comuna de tu búsqueda'}. <Link to={profilePath('datos')}>Agrégala en tu perfil</Link> y vuelve para pagar.</p>
                )}
              </section>
            )}

            <section className="apc-card">
              <h2><span>{needsAddress ? 3 : 2}</span> Documento tributario</h2>
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
                  <label>RUT<input value={invoice.rut} maxLength={12} onChange={(e) => setInvoice({ ...invoice, rut: formatRut(e.target.value) })} placeholder="12.345.678-9" /></label>
                  <label>Giro<input value={invoice.giro} maxLength={150} onChange={(e) => setInvoice({ ...invoice, giro: e.target.value })} /></label>
                  <label className="is-wide">Razón social<input value={invoice.razonSocial} maxLength={180} onChange={(e) => setInvoice({ ...invoice, razonSocial: e.target.value })} /></label>
                </div>
              )}
            </section>
          </div>

          <aside className="apc-card apc-summary">
            <h2>Resumen</h2>
            <dl className="ap-totals">
              <div><dt>Productos</dt><dd>{money(toPay.reduce((sum, s) => sum + s.subtotal, 0))}</dd></div>
              <div><dt>Envíos</dt><dd>{totalShipping > 0 ? `${money(totalShipping)}${anyCourierToPay ? ' + por pagar al recibir' : ''}` : anyCourierToPay ? 'Por pagar al recibir' : 'Sin costo'}</dd></div>
              <div className="is-total"><dt>Total a pagar</dt><dd>{money(totalToPay)}</dd></div>
            </dl>
            {anyCourierToPay && <p className="apc-note apc-note-warn"><AlertCircle size={14} /> No incluye el despacho fuera de la comuna: lo pagas al courier cuando recibes el pedido.</p>}
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
