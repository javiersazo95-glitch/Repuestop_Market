import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Clock, Gavel, Lightbulb, MapPin, MinusCircle, Package, PackageCheck,
  ShieldCheck, Star, Trophy, Truck, X, XCircle,
} from 'lucide-react';
import { acceptAuctionOffer, getAuctionDetail, markAuctionOfferSeen, rejectAuctionOffer } from '../services/auctionApi';
import AuctionAvatar from './AuctionAvatar';
import AuctionImageViewer from './AuctionImageViewer';
import { resolveMediaUrl } from '../services/api';
import { evaluateOffer, shippingClass, suggestOffer } from '../utils/auctionOfferFit';
import '../styles/auction-offers.css';

const nf = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const money = (value) => (value == null ? '—' : nf.format(value));

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Term({ label, value }) {
  return (
    <div className="ao-term">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

const LEVEL_LABEL = { ok: 'Cumple lo solicitado', warn: 'Revisar condiciones', bad: 'No cumple todo' };
const CHECK_SHORT = { budget: 'Presupuesto', deadline: 'Plazo', shipping: 'Envío', quantity: 'Repuestos' };
const CHECK_ICON = { ok: CheckCircle2, warn: AlertTriangle, bad: XCircle, neutral: MinusCircle };

function FitPanel({ fit, auction }) {
  const cap = Number(auction.presupuestoMaximo) || 0;
  const usage = fit.budgetUsage;
  return (
    <section className={`ao-fit is-${fit.level}`} aria-label="Evaluación frente a tu solicitud">
      <h4>Evaluación frente a lo que pediste</h4>
      <ul>
        {fit.checks.map((check) => {
          const Icon = CHECK_ICON[check.status];
          return (
            <li key={check.key} className={`is-${check.status}`}>
              <Icon size={16} />
              <span><strong>{check.key === 'quantity' && fit.coverage && fit.coverage.totalItems > 1 ? 'Repuestos' : check.label}</strong>{check.detail}</span>
            </li>
          );
        })}
      </ul>
      {cap > 0 && usage != null && (
        <div className="ao-budget" aria-hidden="true">
          <div className="ao-budget-track">
            <span className={`is-${fit.checks[0].status}`} style={{ width: `${Math.min(100, usage * 100)}%` }} />
          </div>
          <small>{Math.round(usage * 100)}% de tu tope de {money(cap)}</small>
        </div>
      )}
    </section>
  );
}

/** Tabla de las líneas de una oferta: qué repuesto pedido cubre, con qué producto de la tienda y a qué precio. */
function LinesTable({ quote }) {
  if (!quote.lineas || quote.lineas.length === 0) return null;
  return (
    <table className="ao-lines">
      <thead>
        <tr><th>Repuesto pedido</th><th>Producto de la tienda</th><th className="is-num">Cant.</th><th className="is-num">Precio unit.</th><th className="is-num">Subtotal</th></tr>
      </thead>
      <tbody>
        {quote.lineas.map((line) => (
          <tr key={line.itemId} className={line.vigente ? '' : 'is-void'}>
            <td><strong>{line.repuesto}</strong>{!line.vigente && <small>Ya adjudicado a otra oferta</small>}</td>
            <td>{line.productoTitulo}</td>
            <td className="is-num">{line.cantidad}</td>
            <td className="is-num">{money(line.precioUnitario)}</td>
            <td className="is-num">{money(line.precioTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Cómo y desde dónde se entrega: dónde está la tienda, la dirección si es retiro y qué pasa con el costo del envío. */
function DeliveryBox({ quote }) {
  const kind = shippingClass(quote.tipoEntrega);
  const place = [quote.tiendaComuna, quote.tiendaRegion].filter(Boolean).join(', ');
  if (!kind || kind === 'any') return null;
  if (kind === 'pickup') {
    return (
      <div className="ao-delivery is-pickup" role="note">
        <MapPin size={16} />
        <div>
          <strong>Retiro en tienda{place ? ` · tienda en ${place}` : ''}</strong>
          <small>{quote.direccionRetiro ? <>Retiras en <b>{quote.direccionRetiro}</b>.</> : 'La tienda te indicará la dirección de retiro.'} Esta oferta solo conviene si puedes ir a buscarlo.</small>
        </div>
      </div>
    );
  }
  if (kind === 'home') {
    return (
      <div className="ao-delivery is-home" role="note">
        <Truck size={16} />
        <div>
          <strong>Despacho a domicilio dentro de la comuna{place ? ` · tienda en ${place}` : ''}</strong>
          <small>{quote.costoEnvio > 0 ? <>El envío cuesta <b>{money(quote.costoEnvio)}</b> y se suma al total al pagar.</> : 'Sin costo de envío.'}</small>
        </div>
      </div>
    );
  }
  return (
    <div className="ao-delivery is-courier" role="note">
      <Truck size={16} />
      <div>
        <strong>Despacho a domicilio por pagar{place ? ` · tienda en ${place}` : ''}</strong>
        <small>La tienda está en otra comuna: envía por courier y <b>el costo del envío no está incluido</b>; lo pagas aparte, al recibirlo.</small>
      </div>
    </div>
  );
}

function OfferCard({ quote, index, fit, auction, isSuggested, isBest, isOpen, confirming, busy, onAskConfirm, onCancel, onAccept, onReject, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [photoOpen, setPhotoOpen] = useState(false);
  const seenSent = useRef(false);
  // La tienda ve "Revisada por el comprador" en Gestión subastas apenas se abre el detalle de su oferta.
  useEffect(() => {
    if (!expanded || seenSent.current || !auction?.id || !quote?.id) return;
    seenSent.current = true;
    markAuctionOfferSeen(auction.id, quote.id).catch(() => { seenSent.current = false; });
  }, [expanded, auction?.id, quote?.id]);
  const coverage = fit.coverage;
  const validLines = (quote.lineas || []).filter((line) => line.vigente);
  const accepted = quote.aceptada;
  const discarded = !accepted && quote.estado === 'DESCARTADA';
  const hasValidLines = !quote.lineas || quote.lineas.length === 0 ? true : validLines.length > 0;
  const total = coverage ? coverage.total : (quote.precioFinal ?? quote.precio);
  const rejected = !accepted && quote.estado === 'RECHAZADA';
  const canAccept = isOpen && !accepted && !discarded && !rejected && hasValidLines;
  const missing = quote.itemsFaltantes || [];
  const included = validLines.length > 0 ? validLines.map((line) => line.repuesto) : (quote.productoTitulo ? [quote.productoTitulo] : []);
  const toggle = () => setExpanded((value) => !value);
  const tags = (
    <>
      {accepted && <span className="ao-tag is-winner"><Trophy size={12} /> Aceptada</span>}
      {isSuggested && !accepted && <span className="ao-tag is-suggested"><Lightbulb size={12} /> Sugerida</span>}
      {!accepted && !discarded && !rejected && <span className={`ao-tag fit-${fit.level}`}>{LEVEL_LABEL[fit.level]}</span>}
      {isBest && !accepted && !discarded && !rejected && <span className="ao-tag is-best">Menor precio</span>}
      {discarded && <span className="ao-tag is-muted">Sin repuestos pendientes</span>}
      {rejected && <span className="ao-tag is-muted">Rechazada</span>}
    </>
  );
  const quickActions = canAccept && !confirming && !rejecting;

  return (
    <article className={`ao-offer fit-${fit.level} ${accepted ? 'is-winner' : ''} ${discarded || rejected ? 'is-discarded' : ''}`}>
      {compact ? (
        <div className="ao-row" role="row">
          <span className="ao-col-n" role="cell">{index + 1}</span>
          <div className="ao-row-store" role="cell">
            <AuctionAvatar className="ao-offer-avatar" src={quote.tiendaLogoUrl} name={quote.nombreTienda} isStore />
            <div>
              <strong title={quote.nombreTienda}>{quote.nombreTienda}</strong>
              <small><Star size={11} className={quote.tiendaRating ? 'is-rated' : ''} /> {quote.tiendaRating ? Number(quote.tiendaRating).toFixed(1) : 'Sin evaluaciones'} · {formatShortDate(quote.fechaEnvio)}</small>
            </div>
          </div>
          <div className="ao-row-items" role="cell">
            <span className="ao-items-line is-ok" title={included.join(', ')}><CheckCircle2 size={12} /> <b>{included.length} de {included.length + missing.length}</b> {included.length > 0 ? `· ${included.join(', ')}` : ''}</span>
            {missing.length > 0 && <span className="ao-items-line is-miss" title={missing.join(', ')}><AlertTriangle size={12} /> Faltan: {missing.join(', ')}</span>}
          </div>
          <strong className="ao-col-price" role="cell">{money(total)}</strong>
          <span className="ao-col-text" role="cell" title={quote.tiempoEntrega || undefined}>{quote.tiempoEntrega || '—'}</span>
          <span className="ao-col-text" role="cell" title={quote.tipoEntrega || undefined}>{quote.tipoEntrega || '—'}</span>
          <span className="ao-col-text" role="cell" title={quote.garantia || undefined}>{quote.garantia || 'Garantía legal'}</span>
          <div className="ao-row-tags" role="cell">{tags}</div>
          <div className="ao-row-actions" role="cell">
            {quickActions && (
              <>
                <button type="button" className="ao-btn-outline is-reject is-sm" onClick={() => { onCancel(); setRejecting(true); }}><XCircle size={14} /> Rechazar</button>
                <button type="button" className="ao-btn-primary is-sm" onClick={onAskConfirm}><CheckCircle2 size={14} /> Aceptar</button>
              </>
            )}
          </div>
          <button type="button" className={`ao-btn-outline is-sm ao-row-detail ${expanded ? 'is-open' : ''}`} aria-expanded={expanded} onClick={toggle}>
            {expanded ? 'Ocultar' : 'Ver detalle'} <ChevronDown size={14} />
          </button>
        </div>
      ) : (<>
      <header
        className="ao-offer-head"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpanded((value) => !value); } }}
      >
        <span className="ao-offer-index">Oferta {index + 1}</span>
        {quote.tiendaLogoUrl ? (
          <button
            type="button"
            className="ao-offer-avatar-btn"
            onClick={(event) => { event.stopPropagation(); setPhotoOpen(true); }}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={`Ver foto de ${quote.nombreTienda || 'la tienda'}`}
          >
            <AuctionAvatar className="ao-offer-avatar" src={quote.tiendaLogoUrl} name={quote.nombreTienda} isStore />
          </button>
        ) : (
          <AuctionAvatar className="ao-offer-avatar" src={quote.tiendaLogoUrl} name={quote.nombreTienda} isStore />
        )}
        <div className="ao-offer-store">
          <strong>{quote.nombreTienda}</strong>
          <small className="ao-offer-meta">
            <span><Star size={12} className={quote.tiendaRating ? 'is-rated' : ''} /> {quote.tiendaRating ? `Evaluación ${Number(quote.tiendaRating).toFixed(1)} de 5` : 'Sin evaluaciones aún'}</span>
            <span>Oferta enviada el {formatDateTime(quote.fechaEnvio)}</span>
          </small>
        </div>
        <div className="ao-offer-tags">
          {accepted && <span className="ao-tag is-winner"><Trophy size={12} /> Oferta aceptada</span>}
          {isSuggested && !accepted && <span className="ao-tag is-suggested"><Lightbulb size={12} /> Sugerida</span>}
          {!accepted && !discarded && !rejected && <span className={`ao-tag fit-${fit.level}`}>{LEVEL_LABEL[fit.level]}</span>}
          {isBest && !accepted && !discarded && !rejected && <span className="ao-tag is-best">Menor precio</span>}
          {discarded && <span className="ao-tag is-muted">Sin repuestos pendientes</span>}
          {rejected && <span className="ao-tag is-muted">Rechazada</span>}
        </div>
        <div className="ao-offer-total">
          <small>{coverage && coverage.coveredItems < coverage.totalItems ? 'Total de lo que cubre' : 'Total ofertado'}</small>
          <strong>{money(total)}</strong>
        </div>
      </header>

      <div className="ao-preview">
        <span className="ao-preview-product">
          <Package size={14} />
          {coverage && coverage.totalItems > 1
            ? <>Cubre <b>{coverage.coveredItems} de {coverage.totalItems}</b> repuestos{missing.length > 0 ? <em className="ao-missing-inline"> · faltan {missing.length}</em> : null}</>
            : (quote.productoTitulo || 'Repuesto cotizado según requerimiento')}
        </span>
        <ul className="ao-preview-checks" aria-label="Resumen de cumplimiento">
          {fit.checks.map((check) => {
            const Icon = CHECK_ICON[check.status];
            return <li key={check.key} className={`is-${check.status}`} title={check.detail}><Icon size={13} /> {CHECK_SHORT[check.key]}</li>;
          })}
        </ul>
        <button type="button" className="ao-toggle" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Ocultar detalle' : 'Ver detalle'} <ChevronDown size={14} className={expanded ? 'is-open' : ''} />
        </button>
      </div>
      </>)}

      {!compact && <DeliveryBox quote={quote} />}

      {expanded && compact && (
        <div className="ao-detail">
          <section className="ao-detail-main">
            <h5>Repuestos de la oferta</h5>
            <LinesTable quote={quote} />
            {missing.length > 0 && (
              <p className="ao-detail-miss"><AlertTriangle size={14} /> No incluye: <b>{missing.join(', ')}</b>. Si la aceptas, quedan disponibles para otras tiendas.</p>
            )}
            {quote.notas && <p className="ao-detail-notes"><b>Observaciones de la tienda:</b> {quote.notas}</p>}
          </section>
          <aside className="ao-detail-side">
            <h5>Condiciones</h5>
            <dl className="ao-kv">
              <div><dt>Entrega</dt><dd>{quote.tipoEntrega || '—'}</dd></div>
              {quote.costoEnvio > 0 && <div><dt>Costo de envío</dt><dd>{money(quote.costoEnvio)}</dd></div>}
              {quote.envioPorPagar && <div><dt>Costo de envío</dt><dd>Por pagar</dd></div>}
              <div><dt>Plazo</dt><dd>{quote.tiempoEntrega || '—'}</dd></div>
              <div><dt>Garantía</dt><dd>{quote.garantia || 'Garantía legal'}</dd></div>
              <div><dt>Vigencia</dt><dd>{quote.vigencia || '—'}</dd></div>
            </dl>
            <h5>Cumplimiento de lo pedido</h5>
            <ul className="ao-checks">
              {fit.checks.map((check) => {
                const Icon = CHECK_ICON[check.status];
                return <li key={check.key} className={`is-${check.status}`}><Icon size={14} /><span><b>{check.label}</b> {check.detail}</span></li>;
              })}
            </ul>
            <DeliveryBox quote={quote} />
          </aside>
        </div>
      )}

      {expanded && !compact && (
        <div className="ao-offer-body">
          <LinesTable quote={quote} />

          {missing.length > 0 && (
            <div className="ao-missing" role="note">
              <AlertTriangle size={16} />
              <div>
                <strong>Esta oferta no incluye {missing.length === 1 ? 'este repuesto' : 'estos repuestos'}:</strong>
                <ul>{missing.map((name) => <li key={name}>{name}</li>)}</ul>
                <small>Si la aceptas, {missing.length === 1 ? 'quedará disponible' : 'quedarán disponibles'} para que otras tiendas ofrezcan solo eso.</small>
              </div>
            </div>
          )}

          <dl className="ao-terms">
            <Term label="Método de entrega" value={quote.tipoEntrega} />
            {quote.costoEnvio > 0 && <Term label="Costo del envío" value={`${money(quote.costoEnvio)} (se suma al total al pagar)`} />}
            {quote.envioPorPagar && <Term label="Costo del envío" value="Por pagar: no está incluido en el total" />}
            <Term label="Plazo de entrega" value={quote.tiempoEntrega} />
            <Term label="Garantía" value={quote.garantia || 'Garantía legal'} />
            <Term label="Vigencia de la oferta" value={quote.vigencia} />
          </dl>

          <FitPanel fit={fit} auction={auction} />

          {quote.notas && <p className="ao-notes"><strong>Observaciones de la tienda</strong>{quote.notas}</p>}
        </div>
      )}

      {rejected && (
        <footer className="ao-offer-foot is-rejected">
          <p><XCircle size={15} /> Rechazaste esta oferta{quote.motivoRechazo ? `: «${quote.motivoRechazo}»` : ''}. La tienda ya lo sabe y puede mejorarla y reenviarla.</p>
        </footer>
      )}

      {canAccept && !(compact && !rejecting && !confirming) && (
        <footer className="ao-offer-foot">
          {rejecting ? (
            <>
              <label className="ao-reject-reason">
                <span>¿Por qué la rechazas? (opcional, la tienda lo verá)</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} rows={2} placeholder="Ej: el precio supera mi presupuesto, no es el repuesto que busco…" />
              </label>
              <div>
                <button type="button" className="ao-btn-outline" onClick={() => { setRejecting(false); setReason(''); }} disabled={busy}>Volver</button>
                <button type="button" className="ao-btn-danger" onClick={() => onReject(reason)} disabled={busy}>
                  <XCircle size={15} /> {busy ? 'Procesando…' : 'Confirmar rechazo'}
                </button>
              </div>
            </>
          ) : confirming ? (
            <>
              <p>
                <AlertCircle size={15} />
                {validLines.length > 0
                  ? ` Aceptas ${validLines.length} ${validLines.length === 1 ? 'repuesto' : 'repuestos'} de esta tienda por ${money(coverage ? coverage.total : total)}. ${missing.length > 0 ? 'Los repuestos que no incluye seguirán disponibles para otras tiendas.' : 'Con esto completas tu pedido.'}`
                  : ' Aceptas esta oferta.'}
              </p>
              <div>
                <button type="button" className="ao-btn-outline" onClick={onCancel} disabled={busy}>Cancelar</button>
                <button type="button" className="ao-btn-primary" onClick={onAccept} disabled={busy}>
                  <CheckCircle2 size={15} /> {busy ? 'Procesando…' : 'Confirmar aceptación'}
                </button>
              </div>
            </>
          ) : (
            <div className="ao-offer-actions">
              <button type="button" className="ao-btn-outline is-reject" onClick={() => { onCancel(); setRejecting(true); }}>
                <XCircle size={15} /> Rechazar
              </button>
              <button type="button" className="ao-btn-primary" onClick={onAskConfirm}>
                <Gavel size={15} /> {missing.length > 0 ? 'Aceptar esta oferta (parcial)' : 'Aceptar esta oferta'}
              </button>
            </div>
          )}
        </footer>
      )}
      {photoOpen && (
        <AuctionImageViewer photos={[resolveMediaUrl(quote.tiendaLogoUrl)]} title={quote.nombreTienda} onClose={() => setPhotoOpen(false)} className="is-top" />
      )}
    </article>
  );
}

/**
 * Popup con todas las ofertas recibidas por un pedido, cada una como una cotización formal con su cobertura
 * (qué repuestos incluye y cuáles faltan). El comprador acepta las que le sirven, completas o parciales; lo
 * que no se adjudica sigue disponible para otras tiendas. Lo aceptado se paga junto desde "Tu pedido".
 */
export default function AuctionOffersModal({ isOpen, onClose, auctionId, onChanged, onOpenPurchase, fullScreen = false }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [coverFilter, setCoverFilter] = useState('all');
  const [sortBy, setSortBy] = useState('best');
  // En pantalla completa las sugerencias van ocultas; el ícono de la cabecera las activa.
  const [hintsOn, setHintsOn] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDetail(await getAuctionDetail(auctionId));
    } catch (err) {
      setError(err?.message || 'No pudimos cargar las ofertas.');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => { setPage(0); }, [search, statusFilter, coverFilter, sortBy, pageSize]);

  useEffect(() => {
    if (!isOpen) return undefined;
    setConfirmId(null);
    load();
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, load, onClose]);

  const offers = useMemo(() => {
    const list = [...(detail?.cotizaciones || [])];
    const validCount = (quote) => (quote.lineas || []).filter((line) => line.vigente).length;
    return list.sort((a, b) => Number(b.aceptada) - Number(a.aceptada)
      || validCount(b) - validCount(a)
      || (a.precioFinal ?? a.precio ?? 0) - (b.precioFinal ?? b.precio ?? 0));
  }, [detail]);

  if (!isOpen) return null;

  const isOpenAuction = detail?.estado === 'ACTIVA' && new Date(detail.fechaLimite).getTime() > Date.now();
  const acceptedCount = offers.filter((quote) => quote.aceptada).length;
  const competing = offers.filter((quote) => !quote.aceptada && quote.estado !== 'DESCARTADA' && quote.estado !== 'RECHAZADA');
  const suggestion = detail && isOpenAuction && competing.length > 0 ? suggestOffer(detail, competing) : null;
  const prices = competing.map((quote) => evaluateOffer(detail, quote).total).filter((value) => value > 0);
  const bestPrice = competing.length > 1 && prices.length > 0 ? Math.min(...prices) : null;
  const items = detail?.items || [];
  const pendingItems = items.filter((item) => item.pendiente);

  const handleAccept = async (quote) => {
    setBusy(true);
    setError('');
    try {
      await acceptAuctionOffer(auctionId, quote.id);
      setConfirmId(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'No pudimos registrar tu aceptación.');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (quote, reason) => {
    setBusy(true);
    setError('');
    try {
      await rejectAuctionOffer(auctionId, quote.id, reason);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'No pudimos rechazar la oferta.');
    } finally {
      setBusy(false);
    }
  };

  const vehicle = detail ? [detail.marca, detail.modelo, detail.anio].filter(Boolean).join(' ') : '';

  const statusOf = (quote) => {
    if (quote.aceptada) return 'accepted';
    if (quote.estado === 'RECHAZADA') return 'rejected';
    if (quote.estado === 'DESCARTADA') return 'closed';
    return 'open';
  };
  const statusCounts = offers.reduce((acc, quote) => {
    const key = statusOf(quote);
    return { ...acc, [key]: (acc[key] || 0) + 1 };
  }, { all: offers.length });
  const searchText = search.trim().toLowerCase();
  let shown = fullScreen
    ? offers.filter((quote) => (statusFilter === 'all' || statusOf(quote) === statusFilter)
      && (coverFilter === 'all' || (coverFilter === 'full') === ((quote.itemsFaltantes || []).length === 0))
      && (!searchText || [quote.nombreTienda, quote.productoTitulo, ...(quote.lineas || []).flatMap((line) => [line.repuesto, line.productoTitulo])]
        .filter(Boolean).join(' ').toLowerCase().includes(searchText)))
    : offers;
  if (fullScreen && sortBy !== 'best') {
    const validCount = (quote) => (quote.lineas || []).filter((line) => line.vigente).length;
    shown = [...shown].sort((a, b) => {
      if (sortBy === 'price') return evaluateOffer(detail, a).total - evaluateOffer(detail, b).total;
      if (sortBy === 'coverage') return validCount(b) - validCount(a);
      if (sortBy === 'rating') return (Number(b.tiendaRating) || 0) - (Number(a.tiendaRating) || 0);
      return new Date(b.fechaEnvio).getTime() - new Date(a.fechaEnvio).getTime();
    });
  }
  const totalShown = shown.length;
  const totalPages = Math.max(1, Math.ceil(totalShown / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageOffers = fullScreen ? shown.slice(safePage * pageSize, (safePage + 1) * pageSize) : shown;
  const hasFilters = statusFilter !== 'all' || coverFilter !== 'all' || searchText || sortBy !== 'best';

  const view = (
    <div className={`ao-overlay ${fullScreen ? 'is-full' : ''}`} role="presentation" onMouseDown={(event) => { if (!fullScreen && event.target === event.currentTarget) onClose(); }}>
      <div className={`ao-modal ${fullScreen ? 'is-full' : ''}`} role="dialog" aria-modal="true" aria-label="Ofertas recibidas">
        <header className="ao-modal-head">
          <div>
            <span className="ao-eyebrow"><Gavel size={14} /> Ofertas recibidas</span>
            <h2>{detail?.repuestoSolicitado || 'Pedido de repuestos'}</h2>
            {vehicle && <p>{vehicle}{items.length > 0 ? ` · ${items.length} ${items.length === 1 ? 'repuesto' : 'repuestos'}` : ''}</p>}
          </div>
          <button type="button" className="ao-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        {detail && (
          <div className="ao-summary">
            <span><strong>{offers.length}</strong> {offers.length === 1 ? 'oferta' : 'ofertas'}</span>
            {items.length > 0 && <span><PackageCheck size={14} /> <strong>{items.length - pendingItems.length}</strong> de {items.length} repuestos adjudicados</span>}
            {isOpenAuction && <span><Clock size={14} /> Cierra el {formatDateTime(detail.fechaLimite)}</span>}
            {detail.presupuestoMaximo ? <span>Presupuesto tope <strong>{money(detail.presupuestoMaximo)}</strong></span> : null}
            {acceptedCount > 0 && onOpenPurchase && (
              <button type="button" className="ao-summary-cta" onClick={() => { onClose(); onOpenPurchase(); }}>
                Ver mi pedido y pagar ({acceptedCount} {acceptedCount === 1 ? 'tienda' : 'tiendas'})
              </button>
            )}
          </div>
        )}

        <div className="ao-modal-body">
          {detail && (
            <div className="ao-wanted">
              <strong>Lo que pediste</strong>
              <span>Presupuesto tope: <b>{detail.presupuestoMaximo ? money(detail.presupuestoMaximo) : 'sin tope'}</b></span>
              <span>Plazo máximo: <b>{detail.tiempoMaximoEnvio || 'a convenir'}</b></span>
              <span>Envío: <b>{detail.tipoEnvio || 'cualquiera'}</b></span>
              <span>Repuestos: <b>{items.length || 1}</b></span>
              {fullScreen && (
                <button
                type="button"
                className={`ao-hint-btn ${hintsOn ? 'is-on' : ''}`}
                onClick={() => setHintsOn((value) => !value)}
                aria-pressed={hintsOn}
                aria-label={hintsOn ? 'Ocultar sugerencias' : 'Mostrar sugerencias'}
                title={hintsOn ? 'Ocultar sugerencias' : 'Activar sugerencias'}
              >
                <Lightbulb size={18} />
              </button>
            )}
            </div>
          )}

          {isOpenAuction && pendingItems.length > 0 && pendingItems.length < items.length && (
            <div className="ao-pending-banner" role="status">
              <strong>Quedan {pendingItems.length} {pendingItems.length === 1 ? 'repuesto' : 'repuestos'} por adjudicar</strong>
              <span>{pendingItems.map((item) => item.repuesto).join(' · ')}</span>
            </div>
          )}

          {(fullScreen ? hintsOn : suggestion) && (
            <div className={`ao-suggestion fit-${suggestion ? suggestion.level : 'warn'}`} role="note">
              <Lightbulb size={18} />
              <div>
                <strong>Sugerencias</strong>
                <p>{suggestion ? suggestion.reason : 'Aún no hay ofertas vigentes para sugerir.'}</p>
                {fullScreen && (
                  <p className="ao-hint-help">
                    ¿Qué son? Comparamos cada oferta con lo que pediste (presupuesto, plazo máximo, método de envío y repuestos) y te señalamos la que mejor calza.
                    Es solo una guía: tú decides cuál aceptar o rechazar.
                  </p>
                )}
                <small className="ao-legend">
                  <i className="fit-ok" /> Cumple <i className="fit-warn" /> Revisar <i className="fit-bad" /> No cumple
                </small>
              </div>
            </div>
          )}

          {error && <p className="ao-error" role="alert"><AlertCircle size={15} /> {error}</p>}
          {fullScreen && offers.length > 0 && (
            <div className="ao-toolbar">
              <label className="ao-search"><Search size={15} />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por tienda o repuesto…" aria-label="Buscar ofertas" />
              </label>
              <div className="ao-tabs" role="tablist" aria-label="Estado de la oferta">
                {[['all', 'Todas'], ['open', 'Vigentes'], ['accepted', 'Aceptadas'], ['rejected', 'Rechazadas']].map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={statusFilter === key} className={statusFilter === key ? 'is-active' : ''} onClick={() => setStatusFilter(key)}>
                    {label} ({statusCounts[key] || 0})
                  </button>
                ))}
              </div>
              <select value={coverFilter} onChange={(event) => setCoverFilter(event.target.value)} aria-label="Cobertura">
                <option value="all">Cobertura: todas</option>
                <option value="full">Cubren todo</option>
                <option value="partial">Parciales</option>
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar por">
                <option value="best">Orden: recomendado</option>
                <option value="price">Menor precio</option>
                <option value="coverage">Más repuestos</option>
                <option value="rating">Mejor evaluadas</option>
                <option value="recent">Más recientes</option>
              </select>
              {hasFilters && <button type="button" className="ao-clear" onClick={() => { setSearch(''); setStatusFilter('all'); setCoverFilter('all'); setSortBy('best'); }}>Limpiar</button>}
            </div>
          )}
          {loading && !detail ? (
            <p className="ao-muted">Cargando ofertas…</p>
          ) : offers.length === 0 && detail ? (
            <div className="ao-empty">
              <Gavel size={30} />
              <strong>Aún no recibes ofertas</strong>
              <p>Las casas de repuestos ya fueron notificadas. Te avisaremos cuando llegue la primera.</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="ao-empty">
              <Search size={26} />
              <strong>Ninguna oferta coincide con los filtros</strong>
            </div>
          ) : (
            <>
            {fullScreen && (
              <div className="ao-table-head" role="row">
                <span>N.º</span><span>Tienda</span><span>Repuestos (cubre / faltan)</span>
                <span className="is-right">Total</span><span>Plazo</span><span>Entrega</span><span>Garantía</span><span>Cumplimiento</span><span /><span />
              </div>
            )}
            {pageOffers.map((quote, offerIndex) => {
              const index = fullScreen ? safePage * pageSize + offerIndex : offerIndex;
              const fit = evaluateOffer(detail, quote);
              return (
                <OfferCard
                  key={quote.id}
                  quote={quote}
                  index={index}
                  fit={fit}
                  auction={detail}
                  isSuggested={suggestion?.quoteId === quote.id}
                  isBest={bestPrice != null && fit.total === bestPrice}
                  isOpen={isOpenAuction}
                  confirming={confirmId === quote.id}
                  busy={busy}
                  onAskConfirm={() => setConfirmId(quote.id)}
                  onCancel={() => setConfirmId(null)}
                  onAccept={() => handleAccept(quote)}
                  onReject={(reason) => handleReject(quote, reason)}
                  compact={fullScreen}
                />
              );
            })}
            {fullScreen && (
              <div className="ao-pager">
                <span>Mostrando <b>{totalShown === 0 ? 0 : safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, totalShown)}</b> de <b>{totalShown}</b> {totalShown === 1 ? 'oferta' : 'ofertas'}</span>
                <label>Por página
                  <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                    {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <div>
                  <button type="button" className="ao-btn-outline is-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Anterior</button>
                  <span>Pág. {safePage + 1} de {totalPages}</span>
                  <button type="button" className="ao-btn-outline is-sm" disabled={safePage + 1 >= totalPages} onClick={() => setPage(safePage + 1)}>Siguiente</button>
                </div>
              </div>
            )}
            </>
          )}

          {acceptedCount > 0 && (
            <p className="ao-secure"><ShieldCheck size={15} /> Las ofertas aceptadas se pagan juntas, en un solo pedido de varias tiendas, desde "Ver mi pedido y pagar".</p>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(view, document.body) : view;
}
