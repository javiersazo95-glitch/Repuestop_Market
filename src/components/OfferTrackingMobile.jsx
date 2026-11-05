import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark, Car, CheckCircle2, ChevronDown, ChevronUp, Circle, Clock, Eye, FileText, Flag, Loader2, MapPin, Receipt,
  Search, SearchX, SlidersHorizontal, Tag, Users, X, XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getMyAuctionOffers, getSavedAuctions, setAuctionSaved } from '../services/auctionApi';
import { useTrackingSeen } from '../hooks/useTrackingSeen';
import { offerEvents, offerNews } from '../utils/trackingNews';
import { availabilityLabel } from '../utils/availability';
import { auctionDetailPath, profileOrderPath, ROUTES } from '../routes/paths';
import '../styles/offer-tracking-app.css';

// Mismas etiquetas, tonos y filtros que `mobile/app/subastas/seguimiento.tsx`.
const STATE_LABEL = {
  ENVIADA: 'Enviada', REVISADA: 'Revisada por el comprador', PARCIALMENTE_SUPERADA: 'Parcialmente superada',
  ADJUDICADA_A_OTRA: 'Adjudicada a otra oferta', RECHAZADA: 'Rechazada por el comprador', ACEPTADA: 'Aceptada',
  PAGO_PENDIENTE: 'Pago pendiente', PAGADA: 'Pagada', EXPIRADA: 'Expirada', CANCELADA: 'Cancelada',
};
const STATE_TONE = {
  ENVIADA: 'blue', REVISADA: 'blue', PARCIALMENTE_SUPERADA: 'amber', ADJUDICADA_A_OTRA: 'gray', RECHAZADA: 'red', ACEPTADA: 'green',
  PAGO_PENDIENTE: 'amber', PAGADA: 'green', EXPIRADA: 'gray', CANCELADA: 'gray',
};
const LINE_LABEL = { PENDIENTE: 'Compitiendo', GANADA: 'Ganada', ADJUDICADA_A_OTRA: 'Adjudicada a otra', ACEPTADA: 'Aceptada', PAGADA: 'Pagada' };
const LINE_TONE = { PENDIENTE: 'blue', GANADA: 'green', ACEPTADA: 'green', PAGADA: 'green', ADJUDICADA_A_OTRA: 'gray' };
const POSITION_LABEL = {
  MAS_BAJA: 'Tu precio es el más bajo', MEDIA: 'Tu precio está en el medio', MAS_ALTA: 'Tu precio es el más alto', UNICA: 'Eres la única oferta',
};
const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'En curso' },
  { key: 'won', label: 'Ganadas' },
  { key: 'closed', label: 'Cerradas' },
  { key: 'saved', label: 'Guardadas' },
];
const ACTIVE_STATES = ['ENVIADA', 'REVISADA', 'PARCIALMENTE_SUPERADA'];
const WON_STATES = ['ACEPTADA', 'PAGO_PENDIENTE', 'PAGADA'];

function matchesFilter(offer, filter) {
  if (filter === 'saved') return false;
  if (filter === 'active') return ACTIVE_STATES.includes(offer.estado);
  if (filter === 'won') return WON_STATES.includes(offer.estado);
  if (filter === 'closed') return !ACTIVE_STATES.includes(offer.estado) && !WON_STATES.includes(offer.estado);
  return true;
}

const formatCLP = (value) => (value == null || Number.isNaN(Number(value)) ? '—' : `$${Math.round(Number(value)).toLocaleString('es-CL')}`);
const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
function formatRemaining(seconds) {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} ${days === 1 ? 'día' : 'días'} ${hours} h`;
  return `${hours} h ${minutes % 60} min`;
}

function resultStep(offer) {
  switch (offer.estado) {
    case 'ADJUDICADA_A_OTRA': return { title: 'El comprador eligió otra oferta', tone: 'lost', done: true };
    case 'RECHAZADA': return { title: 'El comprador rechazó tu oferta', tone: 'lost', done: true };
    case 'PARCIALMENTE_SUPERADA': return { title: 'Parte de tus repuestos fue a otra oferta', tone: 'warn', done: true };
    case 'ACEPTADA': return { title: 'Aceptada: el comprador debe pagar', tone: 'done', done: true };
    case 'PAGO_PENDIENTE': return { title: 'Pedido creado, esperando el pago', tone: 'warn', done: true };
    case 'PAGADA': return { title: 'Pagada: ya es un pedido tuyo', tone: 'done', done: true };
    case 'EXPIRADA': return { title: 'La búsqueda cerró sin adjudicarte', tone: 'lost', done: true };
    case 'CANCELADA': return { title: 'La búsqueda fue cancelada', tone: 'lost', done: true };
    default: return { title: 'Esperando decisión', tone: undefined, done: false };
  }
}

const Badge = ({ label, tone }) => <span className={`ota-badge is-${tone}`}>{label}</span>;

function Step({ done, tone, title, hint }) {
  return (
    <div className={`ota-step ${done ? 'is-done' : ''} ${tone ? `is-${tone}` : ''}`}>
      {done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      <span><strong>{title}</strong>{hint && <small>{hint}</small>}</span>
    </div>
  );
}

function Cell({ label, value, tone }) {
  return <div className={`ota-cell ${tone ? `is-${tone}` : ''}`}><small>{label}</small><strong>{value}</strong></div>;
}

function ConditionRow({ label, buyer, mine, bad }) {
  return (
    <div className="ota-cond">
      <span className="ota-cond-label">{label}</span>
      <span>{buyer}</span>
      <strong className={bad ? 'is-bad' : ''}>{mine}</strong>
    </div>
  );
}

function OfferCard({ item, seenSignature, onSeen, onOpenNeed, onOpenOrder }) {
  const { necesidad, oferta } = item;
  const [expanded, setExpanded] = useState(false);
  const news = offerNews(oferta, seenSignature);
  const [newsAtOpen, setNewsAtOpen] = useState(false);
  const toggleDetail = () => {
    if (expanded) {
      if (newsAtOpen) onSeen(`offer:${oferta.id}`, news.signature);
    } else {
      setNewsAtOpen(news.hasNews);
    }
    setExpanded((value) => !value);
  };
  const tone = STATE_TONE[oferta.estado] || 'blue';
  const budget = necesidad.presupuestoMaximo;
  const overBudget = budget != null && oferta.totalVigente != null && Number(oferta.totalVigente) > Number(budget);
  const open = necesidad.estado === 'ACTIVA' && (necesidad.segundosRestantes ?? 0) > 0;
  const seen = Boolean(oferta.vistaEn);
  const result = resultStep(oferta);
  const missing = oferta.itemsFaltantes?.length ?? 0;
  const competitors = oferta.ofertasCompetidoras ?? 0;
  const lines = oferta.lineas || [];

  return (
    <article className="ota-card">
      <div className="ota-head">
        <div className="ota-head-copy">
          <strong>{necesidad.titulo}</strong>
          <small>{`N.º ${necesidad.id} · ${necesidad.itemsTotal} ${necesidad.itemsTotal === 1 ? 'repuesto' : 'repuestos'}${necesidad.vehiculo ? ` · ${necesidad.vehiculo}` : ''}`}</small>
        </div>
        <div className="ota-head-right">
          <Badge label={STATE_LABEL[oferta.estado] || oferta.estado} tone={tone} />
          <button type="button" className="ota-need-btn" onClick={() => onOpenNeed(necesidad.id)} aria-label={`Ver búsqueda ${necesidad.id}`}><FileText size={17} /></button>
        </div>
      </div>

      <div className="ota-strip">
        <Cell label="Tu oferta" value={formatCLP(oferta.totalVigente)} tone={overBudget ? 'bad' : undefined} />
        <Cell label="Competencia" value={competitors > 0 ? `${competitors} ${competitors === 1 ? 'oferta' : 'ofertas'}` : 'Sin competencia'} tone={competitors > 0 ? undefined : 'muted'} />
        <Cell label="Comprador" value={seen ? 'Revisada' : 'Sin revisar'} tone={seen ? 'ok' : 'muted'} />
        <Cell label={open ? 'Cierra en' : 'Búsqueda'} value={open ? formatRemaining(necesidad.segundosRestantes ?? 0) : 'Cerrada'} tone={open ? undefined : 'muted'} />
      </div>

      {(overBudget || missing > 0) && (
        <div className="ota-alerts">
          {overBudget && <small className="is-bad">{`Sobre el tope del comprador (${formatCLP(budget)})`}</small>}
          {missing > 0 && <small className="is-warn">{`No cubre ${missing} ${missing === 1 ? 'repuesto' : 'repuestos'}`}</small>}
        </div>
      )}

      <div className="ota-foot">
        <button type="button" className="ota-toggle" onClick={toggleDetail} aria-expanded={expanded} aria-label={news.hasNews ? `Detalle con novedad: ${news.summary}` : 'Detalle'}>
          {news.hasNews && <i className="ota-news-dot" />}
          Detalle {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
        {oferta.pedidoId && (
          <button type="button" className="ota-order-btn" onClick={() => onOpenOrder(oferta.pedidoId)}><Receipt size={15} /> Pedido</button>
        )}
      </div>

      {news.hasNews && !expanded && <small className="ota-news-line">{`Novedad: ${news.summary}`}</small>}

      {expanded && (
        <div className="ota-detail">
          {newsAtOpen && (
            <div className="ota-news">
              <strong>Novedades</strong>
              {offerEvents(oferta).map((event) => {
                const Icon = event.tone === 'ok' ? CheckCircle2 : event.tone === 'lost' ? XCircle : event.tone === 'warn' ? Clock : Eye;
                return (
                  <div key={event.key} className={`ota-news-row is-${event.tone || 'info'}`}>
                    <Icon size={17} /><span>{event.title}</span>{event.at && <small>{formatDateTime(event.at)}</small>}
                  </div>
                );
              })}
              {oferta.pedidoId && <p>Gestiona el despacho desde el botón «Pedido».</p>}
            </div>
          )}
          {oferta.detalleEstado && <p className="ota-muted">{oferta.detalleEstado}</p>}

          <div className="ota-block">
            <strong>Seguimiento</strong>
            <Step done title="Enviada" hint={formatDateTime(oferta.enviadaEn)} />
            <Step done={seen} title={seen ? 'Revisada por el comprador' : 'Aún sin revisar'} hint={seen ? formatDateTime(oferta.vistaEn) : undefined} />
            <Step done={result.done} tone={result.tone} title={result.title} hint={oferta.aceptadaEn ? formatDateTime(oferta.aceptadaEn) : undefined} />
            {competitors > 0 && oferta.posicionPrecio && <p className="ota-muted">{POSITION_LABEL[oferta.posicionPrecio] || ''}</p>}
          </div>

          <div className="ota-block">
            <div className="ota-cond is-head"><strong className="ota-cond-label">Condiciones</strong><small>Pide el comprador</small><small>Tu oferta</small></div>
            <ConditionRow label="Presupuesto" buyer={budget != null ? `hasta ${formatCLP(budget)}` : 'Sin tope'} mine={formatCLP(oferta.totalVigente)} bad={overBudget} />
            <ConditionRow label="Disponible" buyer="—" mine={availabilityLabel(oferta.disponibilidadDias) || '—'} />
            <ConditionRow label="Plazo" buyer={necesidad.tiempoMaximoEnvio || 'Sin plazo'} mine={oferta.tiempoEntrega || '—'} />
            <ConditionRow label="Entrega" buyer={necesidad.tipoEnvio || 'Cualquiera'} mine={oferta.tipoEntrega || '—'} />
            <ConditionRow label="Garantía" buyer="—" mine={oferta.garantia || '—'} />
            <ConditionRow label="Vigencia" buyer="—" mine={oferta.vigencia || '—'} />
            {missing > 0 && <p className="ota-warn-text">{`No cubre: ${oferta.itemsFaltantes.join(', ')}`}</p>}
          </div>

          <div className="ota-block">
            <strong>{`Repuestos de tu oferta (${lines.length})`}</strong>
            {lines.map((line) => (
              <div key={line.itemId} className="ota-line">
                <span className="ota-line-copy">
                  <strong>{line.repuesto}</strong>
                  <small>{`${line.producto} · ${line.cantidad} u. × ${formatCLP(line.precioUnitario)}`}</small>
                </span>
                <span className="ota-line-side">
                  <strong>{formatCLP(line.precioTotal)}</strong>
                  <Badge label={LINE_LABEL[line.estado] || line.estado} tone={LINE_TONE[line.estado] || 'blue'} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function SavedCard({ auction, myOffer, busy, onRemove, onOpenNeed }) {
  const vehicle = [auction.marca, auction.modelo, auction.anio].filter(Boolean).join(' ');
  const remaining = new Date(auction.fechaLimite).getTime() - Date.now();
  const open = auction.estado === 'ACTIVA' && remaining > 0;
  const place = [auction.comuna, auction.region].filter(Boolean).join(', ');
  return (
    <article className="ota-card">
      <div className="ota-head">
        <strong className="ota-head-copy">{auction.repuestoSolicitado}</strong>
        <Badge label={open ? 'Activa' : 'Cerrada'} tone={open ? 'blue' : 'gray'} />
      </div>
      <div className="ota-chips">
        {myOffer && <Badge label="Ya ofertaste" tone="green" />}
        <span className="ota-chip"><Users size={13} /> {`${auction.totalCotizaciones ?? 0} ofertas recibidas`}</span>
        {open && <span className="ota-chip"><Clock size={13} /> {formatRemaining(remaining / 1000)}</span>}
      </div>
      <div className="ota-facts">
        {vehicle && <span><Car size={14} /> {vehicle}</span>}
        {auction.categoria && <span><Tag size={14} /> {auction.categoria}</span>}
        {place && <span><MapPin size={14} /> {place}</span>}
      </div>
      <div className="ota-actions">
        <button type="button" className="ota-btn is-secondary" disabled={busy} onClick={() => onRemove(auction.id)}>Quitar</button>
        <button type="button" className="ota-btn is-primary" onClick={() => onOpenNeed(auction.id)}>Ver búsqueda</button>
      </div>
    </article>
  );
}

/**
 * «Mis ofertas en curso» de la tienda en el celular: `PropuestasSeguimiento` de la app. Cuatro contadores, buscador con
 * el botón de filtro por estado (hoja inferior), las ofertas con su franja de datos y el «Detalle» desplegable, y las guardadas.
 */
export default function OfferTrackingMobile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { seen, markSeen } = useTrackingSeen(user?.userId ?? user?.id);
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [offers, savedList] = await Promise.all([getMyAuctionOffers(), getSavedAuctions().catch(() => [])]);
      setData(offers);
      setSaved(Array.isArray(savedList) ? savedList : []);
    } catch (err) {
      setError(err?.message || 'No pudimos cargar tus ofertas');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const offers = useMemo(() => data?.ofertas || [], [data]);
  const text = query.trim().toLowerCase();
  const visible = useMemo(() => offers.filter((item) => matchesFilter(item.oferta, filter)
    && (!text || `${item.necesidad.titulo} ${item.necesidad.vehiculo || ''} ${item.necesidad.id}`.toLowerCase().includes(text))), [offers, filter, text]);
  const visibleSaved = useMemo(() => saved.filter((auction) => !text
    || `${auction.repuestoSolicitado} ${auction.marca || ''} ${auction.modelo || ''} ${auction.id}`.toLowerCase().includes(text)), [saved, text]);
  const myOfferIds = useMemo(() => new Set(offers.map((item) => item.necesidad.id)), [offers]);

  const removeSaved = async (id) => {
    setRemovingId(id);
    try {
      await setAuctionSaved(id, false);
      setSaved((current) => current.filter((auction) => auction.id !== id));
    } catch (err) {
      setError(err?.message || 'No pudimos quitar la solicitud de guardadas');
    } finally {
      setRemovingId(null);
    }
  };

  const activeCount = offers.filter((item) => ACTIVE_STATES.includes(item.oferta.estado)).length;
  const counters = [
    { label: 'En curso', value: activeCount, highlight: true },
    { label: 'Revisadas', value: data?.revisadas },
    { label: 'Aceptadas', value: data?.aceptadas },
    { label: 'Pagadas', value: data?.pagadas },
  ];
  const filterCount = (key) => (key === 'saved' ? saved.length : offers.filter((item) => matchesFilter(item.oferta, key)).length);
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label || '';
  const openNeed = (id) => navigate(auctionDetailPath(id));
  const openOrder = (orderId) => navigate(profileOrderPath(orderId));
  const list = filter === 'saved' ? visibleSaved : visible;

  return (
    <div className="ota">
      <div className="ota-counters">
        {counters.map((counter) => (
          <div key={counter.label} className={counter.highlight ? 'is-highlight' : ''}>
            <strong>{counter.value ?? 0}</strong><small>{counter.label}</small>
          </div>
        ))}
      </div>
      <div className="ota-search-row">
        <label className="ota-search">
          <Search size={18} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por repuesto, vehículo o N.º" aria-label="Buscar por repuesto, vehículo o N.º" />
        </label>
        <button type="button" className={`ota-filter-btn ${sheetOpen || filter !== 'all' ? 'is-on' : ''}`} onClick={() => setSheetOpen(true)} aria-label={filter === 'all' ? 'Filtrar por estado' : `Filtrar por estado: ${filterLabel}`}>
          <SlidersHorizontal size={20} />
          {filter !== 'all' && <b>1</b>}
        </button>
      </div>
      {error && <p className="ota-error" role="alert">{error}</p>}

      {loading ? (
        <div className="ota-loading"><Loader2 size={22} className="spin-icon" /></div>
      ) : list.length === 0 ? (
        <div className="ota-empty">
          {filter === 'saved' ? <Bookmark size={30} /> : <SearchX size={30} />}
          <strong>
            {filter === 'saved'
              ? 'No tienes solicitudes guardadas. Abre una búsqueda de repuestos y presiona «Guardar» para hacerle seguimiento.'
              : offers.length === 0
                ? 'Aún no has enviado ofertas. Entra a las búsquedas de repuestos y ofrece tus repuestos.'
                : 'No hay ofertas en este filtro.'}
          </strong>
          {offers.length === 0 && filter !== 'saved' && (
            <button type="button" className="ota-btn is-primary" onClick={() => navigate(ROUTES.auctions)}>Ver búsquedas de repuestos</button>
          )}
        </div>
      ) : filter === 'saved' ? (
        visibleSaved.map((auction) => (
          <SavedCard key={auction.id} auction={auction} myOffer={myOfferIds.has(auction.id)} busy={removingId === auction.id} onRemove={removeSaved} onOpenNeed={openNeed} />
        ))
      ) : (
        visible.map((item) => (
          <OfferCard key={item.oferta.id} item={item} seenSignature={seen[`offer:${item.oferta.id}`]} onSeen={markSeen} onOpenNeed={openNeed} onOpenOrder={openOrder} />
        ))
      )}

      {sheetOpen && createPortal(
        <div className="ota-sheet-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSheetOpen(false); }}>
          <div className="ota-sheet" role="dialog" aria-modal="true" aria-label="Filtrar mis ofertas">
            <div className="ota-sheet-grip" />
            <div className="ota-sheet-head">
              <span><strong>Filtrar mis ofertas</strong><small>Por estado de la oferta</small></span>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <div className="ota-sheet-section">
              <div className="ota-sheet-section-head"><Flag size={16} /> <strong>Estado</strong>{filter !== 'all' && <em>{filterLabel}</em>}</div>
              <div className="ota-sheet-grid">
                {FILTERS.map((option) => (
                  <button key={option.key} type="button" className={filter === option.key ? 'is-active' : ''} aria-pressed={filter === option.key} onClick={() => setFilter(option.key)}>
                    {option.label} <small>{option.key === 'all' ? offers.length : filterCount(option.key)}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="ota-sheet-actions">
              <button type="button" className="ota-btn is-secondary" disabled={filter === 'all'} onClick={() => setFilter('all')}>Limpiar</button>
              <button type="button" className="ota-btn is-primary" onClick={() => setSheetOpen(false)}>Ver ofertas</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
