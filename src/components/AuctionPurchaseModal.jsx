import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, Gavel, PackageCheck, ShieldCheck, ShoppingCart, Truck, X } from 'lucide-react';
import { getAuctionPurchase } from '../services/auctionApi';
import { auctionCheckoutPath } from '../routes/paths';
import AuctionAvatar from './AuctionAvatar';
import '../styles/auction-purchase.css';

const nf = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const money = (value) => (value == null ? '—' : nf.format(value));

/**
 * El pedido del comprador armado con las ofertas que aceptó: cada tienda con sus repuestos, precios y envío,
 * los totales y lo que aún falta adjudicar. Desde aquí se paga todo junto, como una compra de varias tiendas.
 */
export default function AuctionPurchaseModal({ isOpen, onClose, auctionId, onSeeOffers }) {
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPurchase(await getAuctionPurchase(auctionId));
    } catch (err) {
      setError(err?.message || 'No pudimos cargar tu pedido.');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    load();
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, load, onClose]);

  if (!isOpen) return null;

  const stores = purchase?.tiendas || [];
  const hasPending = (purchase?.itemsPendientes || 0) > 0;

  const pay = () => {
    onClose();
    navigate(auctionCheckoutPath(auctionId));
  };

  return (
    <div className="ap-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="ap-modal" role="dialog" aria-modal="true" aria-label="Tu pedido">
        <header className="ap-head">
          <div>
            <span className="ap-eyebrow"><PackageCheck size={14} /> Tu pedido</span>
            <h2>{purchase?.titulo || 'Pedido de repuestos'}</h2>
            {purchase && (
              <p>{stores.length} {stores.length === 1 ? 'tienda' : 'tiendas'} · {purchase.itemsAdjudicados} de {purchase.itemsTotal} {purchase.itemsTotal === 1 ? 'repuesto adjudicado' : 'repuestos adjudicados'}</p>
            )}
          </div>
          <button type="button" className="ap-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="ap-body">
          {error && <p className="ap-error" role="alert"><AlertCircle size={15} /> {error}</p>}
          {loading && !purchase ? <p className="ap-muted">Cargando tu pedido…</p> : null}

          {purchase && stores.length === 0 && !loading && (
            <div className="ap-empty">
              <Gavel size={30} />
              <strong>Aún no aceptas ninguna oferta</strong>
              <p>Cuando aceptes una oferta, sus repuestos aparecerán aquí junto con los de las demás tiendas.</p>
            </div>
          )}

          {stores.map((store) => (
            <article key={store.cotizacionId} className={`ap-store ${store.pagada ? 'is-paid' : ''}`}>
              <header className="ap-store-head">
                <AuctionAvatar className="ap-store-avatar" src={store.tiendaLogoUrl} name={store.tienda} isStore />
                <div>
                  <strong>{store.tienda}</strong>
                  <small><Truck size={12} /> {store.metodoEntrega}{store.plazoEntrega ? ` · ${store.plazoEntrega}` : ''}{store.garantia ? ` · Garantía ${store.garantia}` : ''}</small>
                </div>
                {store.pagada
                  ? <span className="ap-tag is-paid"><CheckCircle2 size={12} /> Pagada</span>
                  : <span className="ap-tag"><Clock size={12} /> Por pagar</span>}
              </header>

              <table className="ap-lines">
                <thead>
                  <tr><th>Repuesto pedido</th><th>Producto de la tienda</th><th className="is-num">Cant.</th><th className="is-num">Precio unit.</th><th className="is-num">Subtotal</th></tr>
                </thead>
                <tbody>
                  {store.lineas.map((line) => (
                    <tr key={line.itemId}>
                      <td><strong>{line.repuesto}</strong>{line.vehiculo ? <small>{line.vehiculo}</small> : null}</td>
                      <td>{line.productoTitulo}</td>
                      <td className="is-num">{line.cantidad}</td>
                      <td className="is-num">{money(line.precioUnitario)}</td>
                      <td className="is-num">{money(line.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={4}>Productos</td><td className="is-num">{money(store.subtotal)}</td></tr>
                  <tr><td colSpan={4}>Envío ({store.metodoEntrega})</td><td className="is-num">{store.costoEnvio > 0 ? money(store.costoEnvio) : 'Sin costo'}</td></tr>
                  <tr className="is-total"><td colSpan={4}>Total {store.tienda}</td><td className="is-num">{money(store.total)}</td></tr>
                </tfoot>
              </table>
            </article>
          ))}

          {hasPending && (
            <div className="ap-pending">
              <strong>Aún faltan {purchase.itemsPendientes} {purchase.itemsPendientes === 1 ? 'repuesto' : 'repuestos'} por adjudicar</strong>
              <ul>{purchase.pendientes.map((name) => <li key={name}>{name}</li>)}</ul>
              <p>Siguen disponibles para que otras tiendas ofrezcan solo lo que falta. Puedes pagar lo aceptado ahora y completar el resto después.</p>
              {onSeeOffers && (
                <button type="button" className="ap-btn-outline" onClick={() => { onClose(); onSeeOffers(); }}>Ver ofertas recibidas</button>
              )}
            </div>
          )}
        </div>

        {purchase && stores.length > 0 && (
          <footer className="ap-foot">
            <dl className="ap-totals">
              <div><dt>Productos</dt><dd>{money(purchase.subtotal)}</dd></div>
              <div><dt>Envíos</dt><dd>{purchase.costoEnvio > 0 ? money(purchase.costoEnvio) : 'Sin costo'}</dd></div>
              <div className="is-total"><dt>Total del pedido</dt><dd>{money(purchase.total)}</dd></div>
              {purchase.totalPorPagar !== purchase.total && <div><dt>Por pagar</dt><dd>{money(purchase.totalPorPagar)}</dd></div>}
            </dl>
            <div className="ap-foot-actions">
              <p><ShieldCheck size={14} /> Pagas una sola vez; el dinero de cada tienda queda retenido hasta tu recepción conforme.</p>
              <button type="button" className="ap-btn-primary" onClick={pay} disabled={!purchase.puedePagar}>
                <ShoppingCart size={16} /> {purchase.puedePagar ? `Pagar ${money(purchase.totalPorPagar)}` : 'Pedido pagado'}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
