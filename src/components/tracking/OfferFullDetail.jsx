import React, { useEffect, useMemo, useState } from 'react';
import { availabilityLabel, availabilitySentence } from '../../utils/availability';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Box, CheckCircle2, ChevronRight, CreditCard, FileText, GitCompare, MessageSquare, Star } from 'lucide-react';
import { acceptAuctionOffer, markAuctionOfferSeen, rejectAuctionOffer } from '../../services/auctionApi';
import { resolveMediaUrl } from '../../services/api';
import { auctionCheckoutPath } from '../../routes/paths';
import ConfirmDialog from '../ConfirmDialog';
import { TrackingCells, TrackingTag } from './TrackingDetail';

const DELIVERY_ORDER = ['Mismo día / Retiro inmediato', '24 horas', '48 horas', '3 a 5 días hábiles', 'A coordinar con cliente'];
const formatCLP = (value) => (value == null || Number.isNaN(Number(value)) ? '—' : `$${Math.round(Number(value)).toLocaleString('es-CL')}`);
const formatWhen = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const totalOf = (quote) => Number(quote.precioFinal || quote.precio || 0);
const deliveryRank = (quote) => { const index = DELIVERY_ORDER.indexOf(quote.tiempoEntrega ?? ''); return index < 0 ? DELIVERY_ORDER.length : index; };

/** Estado de la oferta para el comprador y si todavía puede aceptarla o rechazarla. */
export function quoteStatus(auction, quote) {
  if (quote.estado === 'RECHAZADA') return { label: 'Rechazada', tone: 'lost', actionable: false };
  if (quote.esGanadora || quote.id === auction.cotizacionGanadoraId) return { label: 'Ganadora', tone: 'ok', actionable: false };
  if (quote.estado === 'ACEPTADA' || quote.estado === 'PAGO_PENDIENTE') return { label: 'Aceptada', tone: 'ok', actionable: false };
  if (quote.estado === 'PAGADA') return { label: 'Pagada', tone: 'ok', actionable: false };
  if (auction.estado !== 'ACTIVA') return { label: 'Cerrada', tone: 'lost', actionable: false };
  return { label: 'Por revisar', tone: 'warn', actionable: Boolean(auction.esCreador) && !quote.esPrivada };
}

function Section({ icon: Icon, title, children }) {
  return <section className="ofd-section"><h4><Icon size={15} /> {title}</h4>{children}</section>;
}

/**
 * Oferta de una casa de repuestos a pantalla completa (`OfferFullDetail.tsx` de la app): quién la hizo, cuánto cuesta frente
 * al presupuesto y a las demás ofertas, sus condiciones y cada repuesto que incluye. Desde aquí el comprador la acepta o la
 * rechaza. Al abrirla, la tienda se entera de que fue revisada.
 */
export default function OfferFullDetail({ auction, quote, onClose, onChanged }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(null); // 'accept' | 'reject'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (quote && auction.esCreador && !quote.esPrivada) markAuctionOfferSeen(auction.id, quote.id).catch(() => {});
  }, [quote, auction.id, auction.esCreador]);

  const comparable = useMemo(
    () => (auction.cotizaciones || []).filter((item) => !item.esPrivada && item.estado !== 'RECHAZADA' && totalOf(item) > 0),
    [auction.cotizaciones],
  );
  const byPrice = useMemo(() => [...comparable].sort((a, b) => totalOf(a) - totalOf(b)), [comparable]);
  if (!quote) return null;

  const status = quoteStatus(auction, quote);
  const total = totalOf(quote);
  const budget = auction.presupuestoMaximo ?? null;
  const cheapest = byPrice[0];
  const fastestRank = Math.min(...comparable.map(deliveryRank), DELIVERY_ORDER.length);
  const pricePosition = byPrice.findIndex((item) => item.id === quote.id);
  const average = comparable.length > 0 ? comparable.reduce((sum, item) => sum + totalOf(item), 0) / comparable.length : 0;
  const vsCheapest = cheapest && cheapest.id !== quote.id ? total - totalOf(cheapest) : 0;
  const lines = quote.lineas ?? [];
  const canPay = Boolean(auction.esCreador) && (quote.esGanadora || quote.id === auction.cotizacionGanadoraId);
  const fastest = deliveryRank(quote) === fastestRank && comparable.length > 1;

  const run = async () => {
    const kind = confirm;
    setBusy(true);
    setError('');
    try {
      const updated = kind === 'accept' ? await acceptAuctionOffer(auction.id, quote.id) : await rejectAuctionOffer(auction.id, quote.id);
      onChanged?.(updated);
      setConfirm(null);
      if (kind === 'accept') setAccepted(true); else onClose();
    } catch (err) {
      setError(err?.message || (kind === 'accept' ? 'No pudimos aceptar la oferta.' : 'No pudimos rechazar la oferta.'));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="ofd" role="dialog" aria-modal="true" aria-label="Detalle de la oferta">
      <header className="ofd-top">
        <button type="button" onClick={onClose} aria-label="Volver a las ofertas"><ArrowLeft size={20} /> Ofertas</button>
        <strong>Detalle de la oferta</strong>
        <span />
      </header>
      <div className="ofd-content">
        <div className="ofd-card">
          <div className="ofd-store">
            <span className="ofd-logo">{quote.tiendaLogoUrl ? <img src={resolveMediaUrl(quote.tiendaLogoUrl)} alt="" /> : (quote.nombreTienda || 'T').slice(0, 1)}</span>
            <div>
              <strong>{quote.nombreTienda}</strong>
              <small><Star size={12} /> {quote.tiendaRating ? `Evaluación ${Number(quote.tiendaRating).toFixed(1)} de 5` : 'Sin evaluaciones aún'}</small>
            </div>
            <TrackingTag label={status.label} tone={status.tone} />
          </div>
          <small className="ofd-muted">{`Oferta N.º ${quote.id} · enviada ${formatWhen(quote.fechaEnvio)}`}</small>
        </div>

        <div className="ofd-card">
          <small className="ofd-label">TOTAL DE LA OFERTA</small>
          <strong className="ofd-total">{quote.esPrivada ? 'Confidencial' : formatCLP(total)}</strong>
          <TrackingCells cells={[
            { label: 'Tu presupuesto', value: budget ? (total <= budget ? `Dentro (${formatCLP(budget)})` : `Sobre en ${formatCLP(total - budget)}`) : 'Sin tope', tone: budget ? (total <= budget ? 'ok' : 'bad') : undefined },
            { label: 'Precio', value: pricePosition < 0 ? '—' : pricePosition === 0 ? `La más baja de ${comparable.length}` : `${pricePosition + 1}ª de ${comparable.length}`, tone: pricePosition === 0 ? 'ok' : undefined },
            { label: 'Plazo', value: fastest ? 'Entre las más rápidas' : quote.tiempoEntrega || '—', tone: fastest ? 'ok' : undefined },
          ]} />
          {vsCheapest > 0 && <small className="ofd-muted">{`${formatCLP(vsCheapest)} más que la oferta más baja (${cheapest?.nombreTienda}).`}</small>}
          {average > 0 && comparable.length > 1 && <small className="ofd-muted">{`Promedio de las ${comparable.length} ofertas: ${formatCLP(average)}.`}</small>}
        </div>

        {byPrice.length > 1 && (
          <div className="ofd-card">
            <Section icon={GitCompare} title={`Comparación con las otras ofertas (${byPrice.length})`}>
              <div className="ofd-compare is-head"><span>TIENDA</span><span>PLAZO</span><span>TOTAL</span></div>
              {byPrice.map((item) => (
                <div key={item.id} className={`ofd-compare ${item.id === quote.id ? 'is-current' : ''}`}>
                  <span>{item.id === quote.id ? `${item.nombreTienda} (esta)` : item.nombreTienda}</span>
                  <span>{item.tiempoEntrega || '—'}</span>
                  <strong>{formatCLP(totalOf(item))}</strong>
                </div>
              ))}
            </Section>
          </div>
        )}

        <div className="ofd-card">
          <Section icon={FileText} title="Condiciones">
            <TrackingCells cells={[{ label: 'Disponibilidad', value: availabilityLabel(quote.disponibilidadDias) || '—', tone: quote.disponibilidadDias > 0 ? 'primary' : undefined }, { label: 'Plazo de entrega', value: quote.tiempoEntrega || '—' }]} />
            {availabilitySentence(quote.disponibilidadDias) && <p className="trk-note">{availabilitySentence(quote.disponibilidadDias)} El plazo de entrega corre desde ese momento.</p>}
            <TrackingCells cells={[{ label: 'Método de entrega', value: quote.tipoEntrega || '—' }]} />
            <TrackingCells cells={[{ label: 'Garantía', value: quote.garantia || '—' }, { label: 'Vigencia de la oferta', value: quote.vigencia || '—' }]} />
          </Section>
        </div>

        {lines.length > 0 && (
          <div className="ofd-card">
            <Section icon={Box} title={`Repuestos que incluye (${lines.length})`}>
              {lines.map((line) => {
                const body = (
                  <>
                    <span className="ofd-line-photo">{line.productoFotoUrl ? <img src={resolveMediaUrl(line.productoFotoUrl)} alt="" /> : <Box size={18} />}</span>
                    <span className="ofd-line-copy">
                      <small>{String(line.repuesto || '').toUpperCase()}</small>
                      <strong>{line.productoTitulo || 'Repuesto'}</strong>
                      <small>{`${line.cantidad} u. × ${formatCLP(line.precioUnitario)}`}</small>
                    </span>
                    <span className="ofd-line-side"><strong>{formatCLP(line.precioTotal)}</strong>{line.adjudicada ? <TrackingTag label="Aceptado" tone="ok" /> : line.vigente === false ? <TrackingTag label="No vigente" tone="lost" /> : null}</span>
                    {line.productoId && <ChevronRight size={16} />}
                  </>
                );
                return line.productoId
                  ? <Link key={line.itemId} className="ofd-line" to={`/repuestos/${line.productoId}`}>{body}</Link>
                  : <div key={line.itemId} className="ofd-line">{body}</div>;
              })}
            </Section>
          </div>
        )}

        {quote.notas && <div className="ofd-card"><Section icon={MessageSquare} title="Observaciones de la tienda"><p>{quote.notas}</p></Section></div>}
        {quote.estado === 'RECHAZADA' && quote.motivoRechazo && <p className="ofd-muted">{`La rechazaste: ${quote.motivoRechazo}`}</p>}
      </div>

      {(status.actionable || canPay) && (
        <footer className="ofd-footer">
          {status.actionable ? (
            <>
              <button type="button" className="ofd-btn" disabled={busy} onClick={() => { setError(''); setConfirm('reject'); }}>Rechazar</button>
              <button type="button" className="ofd-btn is-primary" disabled={busy} onClick={() => { setError(''); setConfirm('accept'); }}><CheckCircle2 size={18} /> Aceptar oferta</button>
            </>
          ) : (
            <button type="button" className="ofd-btn is-primary" onClick={() => { onClose(); navigate(auctionCheckoutPath(auction.id)); }}><CreditCard size={18} /> Ir a pagar</button>
          )}
        </footer>
      )}

      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title={confirm === 'accept' ? 'Aceptar oferta' : 'Rechazar oferta'}
        message={confirm === 'accept'
          ? `¿Aceptar la oferta de ${quote.nombreTienda} por ${formatCLP(total)}? Las demás ofertas por los mismos repuestos quedarán superadas. Luego completas el pago de lo aceptado.`
          : `¿Rechazar la oferta de ${quote.nombreTienda}? La tienda verá que la rechazaste.`}
        confirmLabel={confirm === 'accept' ? 'Aceptar' : 'Rechazar'}
        cancelLabel="Volver"
        tone={confirm === 'accept' ? 'warning' : 'danger'}
        isBusy={busy}
        error={error}
        onConfirm={run}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        isOpen={accepted}
        title="Oferta aceptada"
        message={`Avisamos a ${quote.nombreTienda}. Paga lo aceptado para que la tienda prepare tu pedido.`}
        confirmLabel="Pagar ahora"
        cancelLabel="Más tarde"
        tone="success"
        onConfirm={() => { setAccepted(false); onClose(); navigate(auctionCheckoutPath(auction.id)); }}
        onCancel={() => { setAccepted(false); onClose(); }}
      />
    </div>,
    document.body,
  );
}
