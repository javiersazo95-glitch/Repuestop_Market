import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Clock, Gavel, Lightbulb, MapPin, MinusCircle, Package, PackageCheck,
  ShieldCheck, Star, Trophy, Truck, X, XCircle,
} from 'lucide-react';
import { acceptAuctionOffer, getAuctionDetail, markAuctionOfferSeen } from '../services/auctionApi';
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

function OfferCard({ quote, index, fit, auction, isSuggested, isBest, isOpen, confirming, busy, onAskConfirm, onCancel, onAccept }) {
  const [expanded, setExpanded] = useState(false);
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
  const canAccept = isOpen && !accepted && !discarded && hasValidLines;
  const missing = quote.itemsFaltantes || [];

  return (
    <article className={`ao-offer fit-${fit.level} ${accepted ? 'is-winner' : ''} ${discarded ? 'is-discarded' : ''}`}>
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
          {!accepted && !discarded && <span className={`ao-tag fit-${fit.level}`}>{LEVEL_LABEL[fit.level]}</span>}
          {isBest && !accepted && !discarded && <span className="ao-tag is-best">Menor precio</span>}
          {discarded && <span className="ao-tag is-muted">Sin repuestos pendientes</span>}
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

      <DeliveryBox quote={quote} />

      {expanded && (
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

      {canAccept && (
        <footer className="ao-offer-foot">
          {confirming ? (
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
            <button type="button" className="ao-btn-primary" onClick={onAskConfirm}>
              <Gavel size={15} /> {missing.length > 0 ? 'Aceptar esta oferta (parcial)' : 'Aceptar esta oferta'}
            </button>
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
export default function AuctionOffersModal({ isOpen, onClose, auctionId, onChanged, onOpenPurchase }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);

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
  const competing = offers.filter((quote) => !quote.aceptada && quote.estado !== 'DESCARTADA');
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

  const vehicle = detail ? [detail.marca, detail.modelo, detail.anio].filter(Boolean).join(' ') : '';

  return (
    <div className="ao-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="ao-modal" role="dialog" aria-modal="true" aria-label="Ofertas recibidas">
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
            </div>
          )}

          {isOpenAuction && pendingItems.length > 0 && pendingItems.length < items.length && (
            <div className="ao-pending-banner" role="status">
              <strong>Quedan {pendingItems.length} {pendingItems.length === 1 ? 'repuesto' : 'repuestos'} por adjudicar</strong>
              <span>{pendingItems.map((item) => item.repuesto).join(' · ')}</span>
            </div>
          )}

          {suggestion && (
            <div className={`ao-suggestion fit-${suggestion.level}`} role="note">
              <Lightbulb size={18} />
              <div>
                <strong>Sugerencia</strong>
                <p>{suggestion.reason}</p>
                <small className="ao-legend">
                  <i className="fit-ok" /> Cumple <i className="fit-warn" /> Revisar <i className="fit-bad" /> No cumple
                </small>
              </div>
            </div>
          )}

          {error && <p className="ao-error" role="alert"><AlertCircle size={15} /> {error}</p>}
          {loading && !detail ? (
            <p className="ao-muted">Cargando ofertas…</p>
          ) : offers.length === 0 && detail ? (
            <div className="ao-empty">
              <Gavel size={30} />
              <strong>Aún no recibes ofertas</strong>
              <p>Las casas de repuestos ya fueron notificadas. Te avisaremos cuando llegue la primera.</p>
            </div>
          ) : (
            offers.map((quote, index) => {
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
                />
              );
            })
          )}

          {acceptedCount > 0 && (
            <p className="ao-secure"><ShieldCheck size={15} /> Las ofertas aceptadas se pagan juntas, en un solo pedido de varias tiendas, desde "Ver mi pedido y pagar".</p>
          )}
        </div>
      </div>
    </div>
  );
}
