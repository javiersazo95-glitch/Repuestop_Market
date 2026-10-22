import '../styles/profile-auction-management.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, Bookmark, Car, ChevronDown, CheckCircle2, Clock, Eye, EyeOff, Gavel, Loader2, MapPin, PackageCheck, Pencil,
  Search, Tag, User, Users,
} from 'lucide-react';
import { getAuctionDetail, getMyAuctionOffers, getSavedAuctions, setAuctionSaved } from '../services/auctionApi';
import { auctionDetailPath, profileOrderPath, ROUTES } from '../routes/paths';
import { useAuth } from '../context/AuthContext';
import AuctionQuoteModal from './AuctionQuoteModal';
import { EmptyState } from './ProfileDashboard';

const nf = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const money = (value) => (value == null || Number.isNaN(Number(value)) ? '—' : nf.format(Number(value)));

const STATE_LABEL = {
  ENVIADA: 'Enviada',
  REVISADA: 'Revisada por el comprador',
  PARCIALMENTE_SUPERADA: 'Parcialmente superada',
  ADJUDICADA_A_OTRA: 'Adjudicada a otra oferta',
  ACEPTADA: 'Aceptada',
  PAGO_PENDIENTE: 'Pago pendiente',
  PAGADA: 'Pagada',
  EXPIRADA: 'Expirada',
  CANCELADA: 'Cancelada',
};
// Tono visual de cada estado: azul = en juego, verde = ganada, ámbar = requiere atención, gris = perdida/cerrada.
const STATE_TONE = {
  ENVIADA: 'blue', REVISADA: 'blue', PARCIALMENTE_SUPERADA: 'amber', ADJUDICADA_A_OTRA: 'gray', ACEPTADA: 'green',
  PAGO_PENDIENTE: 'amber', PAGADA: 'green', EXPIRADA: 'gray', CANCELADA: 'gray',
};
const LINE_LABEL = { PENDIENTE: 'Compitiendo', GANADA: 'Ganada', ADJUDICADA_A_OTRA: 'Adjudicada a otra', ACEPTADA: 'Aceptada', PAGADA: 'Pagada' };
const LINE_TONE = { PENDIENTE: 'blue', GANADA: 'green', ACEPTADA: 'green', PAGADA: 'green', ADJUDICADA_A_OTRA: 'gray' };
const POSITION_LABEL = { MAS_BAJA: 'Tu precio es el más bajo', MEDIA: 'Tu precio está en el medio', MAS_ALTA: 'Tu precio es el más alto', UNICA: 'Eres la única oferta' };

const FILTERS = [
  ['all', 'Todas'],
  ['active', 'En juego'],
  ['won', 'Ganadas'],
  ['closed', 'Cerradas'],
  ['saved', 'Guardadas'],
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

function formatRemaining(seconds) {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} ${days === 1 ? 'día' : 'días'} ${hours} h`;
  return `${hours} h ${minutes % 60} min`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Camino de la oferta: enviada -> revisada por el comprador -> resultado. */
function Timeline({ offer }) {
  const result = (() => {
    switch (offer.estado) {
      case 'ADJUDICADA_A_OTRA': return { label: 'El comprador eligió otra oferta', tone: 'lost' };
      case 'PARCIALMENTE_SUPERADA': return { label: 'Parte de tus repuestos fue a otra oferta', tone: 'warn' };
      case 'ACEPTADA': return { label: 'Aceptada: el comprador debe pagar', tone: 'done' };
      case 'PAGO_PENDIENTE': return { label: 'Pedido creado, esperando el pago', tone: 'warn' };
      case 'PAGADA': return { label: 'Pagada: ya es un pedido tuyo', tone: 'done' };
      case 'EXPIRADA': return { label: 'La subasta cerró sin adjudicarte', tone: 'lost' };
      case 'CANCELADA': return { label: 'La subasta fue cancelada', tone: 'lost' };
      default: return { label: 'Esperando decisión', tone: 'idle' };
    }
  })();
  const seen = Boolean(offer.vistaEn);
  return (
    <ol className="pg-timeline" aria-label="Seguimiento de la oferta">
      <li className="is-done"><CheckCircle2 size={15} /><span><strong>Enviada</strong><small>{formatDateTime(offer.enviadaEn)}</small></span></li>
      <li className={seen ? 'is-done' : ''}>{seen ? <Eye size={15} /> : <EyeOff size={15} />}
        <span><strong>{seen ? 'Revisada por el comprador' : 'Aún sin revisar'}</strong>{seen && <small>{formatDateTime(offer.vistaEn)}</small>}</span></li>
      <li className={`is-${result.tone}`}><Gavel size={15} /><span><strong>{result.label}</strong>
        {offer.aceptadaEn && <small>{formatDateTime(offer.aceptadaEn)}</small>}</span></li>
    </ol>
  );
}

function ConditionRow({ label, buyer, mine, tone }) {
  return (
    <div className={`pg-cond ${tone ? `is-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{buyer}</strong>
      <em>{mine}</em>
    </div>
  );
}

function OfferCard({ item, onEdit, onOpen, onOrder, busy }) {
  const { necesidad, oferta } = item;
  const [expanded, setExpanded] = useState(false);
  const tone = STATE_TONE[oferta.estado] || 'blue';
  const budget = necesidad.presupuestoMaximo;
  const overBudget = budget != null && oferta.totalVigente != null && Number(oferta.totalVigente) > Number(budget);
  const open = necesidad.estado === 'ACTIVA' && necesidad.segundosRestantes > 0;
  const facts = [
    { icon: Car, label: 'Vehículo', value: necesidad.vehiculo },
    { icon: Tag, label: 'Categoría', value: necesidad.categoria },
    { icon: MapPin, label: 'Ubicación', value: necesidad.ubicacion },
    { icon: User, label: 'Comprador', value: necesidad.comprador },
  ].filter((fact) => fact.value);

  return (
    <article className={`pg-card is-${tone}`}>
      <div className="pg-top">
      <header className="pg-card-head">
        <div className="pg-card-title">
          <h3>{necesidad.titulo}</h3>
          <span className={`pg-badge is-${tone}`}>{STATE_LABEL[oferta.estado] || oferta.estado}</span>
        </div>
        <span className="pg-card-id">Pedido N.º {necesidad.id} · {necesidad.itemsTotal} {necesidad.itemsTotal === 1 ? 'repuesto' : 'repuestos'} · Oferta N.º {oferta.id}</span>
        {oferta.detalleEstado && <p className="pg-detail">{oferta.detalleEstado}</p>}
        <div className="pg-chips">
          <span className={`pg-chip ${oferta.vistaEn ? 'is-ok' : ''}`}>{oferta.vistaEn ? <Eye size={13} /> : <EyeOff size={13} />}{oferta.vistaEn ? 'Revisada por el comprador' : 'Sin revisar'}</span>
          <span className="pg-chip"><Users size={13} />{oferta.ofertasCompetidoras > 0 ? `${oferta.ofertasCompetidoras} ${oferta.ofertasCompetidoras === 1 ? 'oferta compite' : 'ofertas compiten'}` : 'Única oferta'}</span>
          {open && <span className="pg-chip"><Clock size={13} />{formatRemaining(necesidad.segundosRestantes)}</span>}
          {oferta.itemsFaltantes?.length > 0 && <span className="pg-chip is-warn"><AlertCircle size={13} />Faltan {oferta.itemsFaltantes.length}</span>}
        </div>
        <dl className="pg-facts">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label}><dt><Icon size={13} /> {label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      </header>
      <div className="pg-figures">
        <div><small>Mi oferta</small><strong>{money(oferta.totalVigente)}</strong></div>
        <div><small>Tope del comprador</small><strong>{budget != null ? money(budget) : 'Sin tope'}</strong></div>
        <div><small>Entrega</small><strong>{oferta.tipoEntrega || '—'}</strong></div>
        <div><small>Plazo</small><strong>{oferta.tiempoEntrega || '—'}</strong></div>
        <div><small>Enviada</small><strong>{formatDateTime(oferta.enviadaEn)}</strong></div>
        <div><small>Vigencia</small><strong>{oferta.vigencia || '—'}</strong></div>
      </div>
      <aside className="pg-side">
        <div className="pg-total"><small>Total vigente</small><strong className={overBudget ? 'is-over' : ''}>{money(oferta.totalVigente)}</strong>{overBudget && <em>Sobre el tope</em>}</div>
        <div className="pg-actions">
          <button type="button" className="pg-btn" onClick={() => onOpen(necesidad.id)}>Ver subasta <ArrowRight size={14} /></button>
          <button type="button" className={`pg-btn pg-toggle ${expanded ? 'is-open' : ''}`} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Ocultar detalle' : 'Ver detalle'} <ChevronDown size={14} />
          </button>
          {oferta.editable && (
            <button type="button" className="pg-btn" onClick={() => onEdit(necesidad.id)} disabled={busy}>
              {busy ? <Loader2 size={14} className="pg-spin" /> : <Pencil size={14} />} Editar oferta
            </button>
          )}
          {oferta.pedidoId && (
            <button type="button" className="pg-btn is-primary" onClick={() => onOrder(oferta.pedidoId)}>
              <PackageCheck size={14} /> Ver pedido
            </button>
          )}
        </div>
      </aside>
      </div>

      {expanded && <div className="pg-body">
        <section className="pg-col">
          <h4>Seguimiento</h4>
          <Timeline offer={oferta} />
          <p className="pg-compete">
            <Users size={14} />
            {oferta.ofertasCompetidoras > 0
              ? `${oferta.ofertasCompetidoras} ${oferta.ofertasCompetidoras === 1 ? 'oferta compite' : 'ofertas compiten'} contigo${oferta.posicionPrecio ? ` · ${POSITION_LABEL[oferta.posicionPrecio] || ''}` : ''}`
              : 'Eres la única oferta por ahora'}
          </p>
        </section>

        <section className="pg-col">
          <h4>Tu oferta vs. lo que pide el comprador</h4>
          <div className="pg-conds">
            <div className="pg-cond pg-cond-head"><span /><strong>Comprador</strong><em>Tu oferta</em></div>
            <ConditionRow
              label="Presupuesto"
              buyer={budget != null ? `hasta ${money(budget)}` : 'Sin tope'}
              mine={money(oferta.totalVigente)}
              tone={budget == null ? '' : overBudget ? 'bad' : 'ok'}
            />
            <ConditionRow label="Plazo de envío" buyer={necesidad.tiempoMaximoEnvio || 'Sin plazo'} mine={oferta.tiempoEntrega || '—'} />
            <ConditionRow label="Entrega" buyer={necesidad.tipoEnvio || 'Cualquiera'} mine={oferta.tipoEntrega || '—'} />
            <ConditionRow label="Garantía" buyer="—" mine={oferta.garantia || '—'} />
            <ConditionRow label="Vigencia" buyer="—" mine={oferta.vigencia || '—'} />
          </div>
          {oferta.itemsFaltantes?.length > 0 && (
            <p className="pg-missing"><AlertCircle size={14} /> No cubre: {oferta.itemsFaltantes.join(', ')}</p>
          )}
        </section>
      </div>}

      {expanded && <ul className="pg-lines">
        {oferta.lineas.map((line) => (
          <li key={line.itemId}>
            <span className="pg-line-name"><strong>{line.repuesto}</strong><small>{line.producto} · {line.cantidad} u. × {money(line.precioUnitario)}</small></span>
            <span className="pg-line-price">{money(line.precioTotal)}</span>
            <span className={`pg-badge is-${LINE_TONE[line.estado] || 'blue'}`}>{LINE_LABEL[line.estado] || line.estado}</span>
          </li>
        ))}
      </ul>}

    </article>
  );
}

/** Solicitud guardada para seguimiento: lo esencial y si la tienda ya ofertó. */
function SavedCard({ auction, myOffer, onOpen, onRemove, busy }) {
  const vehicle = [auction.marca, auction.modelo, auction.anio].filter(Boolean).join(' ');
  const location = [auction.comuna, auction.region].filter(Boolean).join(', ');
  const remaining = Math.max(0, new Date(auction.fechaLimite).getTime() - Date.now());
  const open = auction.estado === 'ACTIVA' && remaining > 0;
  return (
    <article className="pg-card">
      <div className="pg-card-head">
        <div className="pg-card-title">
          <h3>{auction.repuestoSolicitado}</h3>
          <span className={`pg-badge ${open ? '' : 'is-gray'}`}>{open ? 'Activa' : 'Cerrada'}</span>
          {myOffer && <span className="pg-badge is-green">Ya ofertaste</span>}
        </div>
        <span className="pg-card-id">Pedido N.º {auction.id} · {auction.totalItems || 1} {(auction.totalItems || 1) === 1 ? 'repuesto' : 'repuestos'}</span>
        <dl className="pg-facts">
          {vehicle && <div><dt><Car size={13} /> Vehículo</dt><dd>{vehicle}</dd></div>}
          {auction.categoria && <div><dt><Tag size={13} /> Categoría</dt><dd>{auction.categoria}</dd></div>}
          {location && <div><dt><MapPin size={13} /> Ubicación</dt><dd>{location}</dd></div>}
          {open && <div><dt><Clock size={13} /> Tiempo restante</dt><dd>{formatRemaining(remaining / 1000)}</dd></div>}
          <div><dt><Users size={13} /> Ofertas recibidas</dt><dd>{auction.totalCotizaciones || 0}</dd></div>
        </dl>
      </div>
      <div className="pg-foot">
        <span />
        <div className="pg-actions">
          <button type="button" className="pg-btn" onClick={() => onRemove(auction.id)} disabled={busy}><Bookmark size={14} /> Quitar de guardadas</button>
          <button type="button" className="pg-btn is-primary" onClick={() => onOpen(auction.id)}>Ver subasta <ArrowRight size={14} /></button>
        </div>
      </div>
    </article>
  );
}

export default function ProfileAuctionManagementPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const sellerId = user?.sellerId || user?.proveedorId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [offersData, savedData] = await Promise.all([getMyAuctionOffers(), getSavedAuctions().catch(() => [])]);
      setData(offersData);
      setSaved(Array.isArray(savedData) ? savedData : []);
    } catch (err) {
      setError(err?.message || 'No pudimos cargar tus ofertas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const offers = useMemo(() => data?.ofertas || [], [data]);
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return offers.filter((item) => matchesFilter(item.oferta, filter)
      && (!text || `${item.necesidad.titulo} ${item.necesidad.vehiculo || ''} ${item.necesidad.id}`.toLowerCase().includes(text)));
  }, [offers, filter, query]);

  const myOfferIds = useMemo(() => new Set(offers.map((item) => item.necesidad.id)), [offers]);
  const visibleSaved = useMemo(() => {
    const text = query.trim().toLowerCase();
    return saved.filter((auction) => !text || `${auction.repuestoSolicitado} ${auction.marca || ''} ${auction.modelo || ''} ${auction.id}`.toLowerCase().includes(text));
  }, [saved, query]);

  const removeSaved = async (auctionId) => {
    setRemovingId(auctionId);
    try {
      await setAuctionSaved(auctionId, false);
      setSaved((current) => current.filter((auction) => auction.id !== auctionId));
    } catch (err) {
      setError(err?.message || 'No pudimos quitar la solicitud de guardadas.');
    } finally {
      setRemovingId(null);
    }
  };

  const openEdit = async (auctionId) => {
    setBusyId(auctionId);
    try {
      const detail = await getAuctionDetail(auctionId);
      setEditing(detail);
    } catch (err) {
      setError(err?.message || 'No pudimos abrir la oferta para editarla.');
    } finally {
      setBusyId(null);
    }
  };

  const counters = [
    { key: 'enviadas', label: 'Ofertas enviadas', value: data?.enviadas },
    { key: 'revisadas', label: 'Revisadas por el comprador', value: data?.revisadas },
    { key: 'aceptadas', label: 'Aceptadas', value: data?.aceptadas },
    { key: 'porPagar', label: 'Por pagar', value: data?.porPagar },
    { key: 'pagadas', label: 'Pagadas', value: data?.pagadas },
    { key: 'superadas', label: 'Adjudicadas a otra', value: data?.superadas },
  ];

  return (
    <section className="pg-panel">
      <header className="pg-header">
        <div>
          <h2><Gavel size={20} /> Gestión subastas</h2>
          <p>Sigue cada oferta que enviaste: si el comprador la revisó, si eligió otra y en qué etapa va la venta.</p>
        </div>
        <button type="button" className="pg-btn is-primary" onClick={() => navigate(ROUTES.auctions)}>
          <Gavel size={15} /> Ver subastas públicas
        </button>
      </header>

      {loading ? (
        <div className="pg-loading"><Loader2 size={18} className="pg-spin" /> Cargando tus ofertas…</div>
      ) : (
        <>
          <div className="pg-counters">
            {counters.map(({ key, label, value }) => (
              <div key={key} className="pg-counter"><strong>{value ?? 0}</strong><small>{label}</small></div>
            ))}
          </div>

          {error && <p className="pg-error" role="alert"><AlertCircle size={15} /> {error}</p>}

          <div className="pg-toolbar">
            <div className="pg-filters" role="tablist" aria-label="Filtrar ofertas">
              {FILTERS.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>{label}{key === 'saved' && saved.length > 0 ? ` (${saved.length})` : ''}</button>
              ))}
            </div>
            <label className="pg-search"><Search size={15} />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por repuesto, vehículo o N.º" />
            </label>
          </div>

          {filter === 'saved' ? (
            visibleSaved.length === 0 ? (
              <EmptyState label="No tienes solicitudes guardadas. Abre una subasta y presiona «Guardar» para hacerle seguimiento." />
            ) : (
              <div className="pg-list">
                {visibleSaved.map((auction) => (
                  <SavedCard
                    key={auction.id}
                    auction={auction}
                    myOffer={myOfferIds.has(auction.id)}
                    busy={removingId === auction.id}
                    onOpen={(id) => navigate(auctionDetailPath(id))}
                    onRemove={removeSaved}
                  />
                ))}
              </div>
            )
          ) : visible.length === 0 ? (
            <EmptyState label={offers.length === 0 ? 'Aún no has enviado ofertas. Entra a las subastas públicas y ofrece tus repuestos.' : 'No hay ofertas en este filtro.'} />
          ) : (
            <div className="pg-list">
              {visible.map((item) => (
                <OfferCard
                  key={item.oferta.id}
                  item={item}
                  busy={busyId === item.necesidad.id}
                  onEdit={openEdit}
                  onOpen={(id) => navigate(auctionDetailPath(id))}
                  onOrder={(id) => navigate(profileOrderPath(id))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <AuctionQuoteModal
          isOpen
          onClose={() => setEditing(null)}
          auction={editing}
          myQuote={editing.miCotizacion}
          sellerId={sellerId}
          onSuccess={load}
        />
      )}
    </section>
  );
}
