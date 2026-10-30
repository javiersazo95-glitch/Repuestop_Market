import '../styles/profile-auction-management.css';
import '../styles/profile-auction-tracking.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, Bookmark, CheckCircle2, ClipboardList, Clock, Eye, EyeOff, Gavel, PackageSearch, Loader2, MessageCircle, PackageCheck,
  Pencil, Search, Send, Tag, Trophy, User, Wallet, XCircle,
} from 'lucide-react';
import {
  auctionTrackingCode, getAuctionComments, getAuctionDetail, getMyAuctionOffers, getMyAuctionQuestions, getSavedAuctions, postAuctionComment, setAuctionSaved,
} from '../services/auctionApi';
import { auctionDetailPath, profileOrderPath, ROUTES } from '../routes/paths';
import { useAuth } from '../context/AuthContext';
import AuctionQuoteModal from './AuctionQuoteModal';
import AuctionAvatar from './AuctionAvatar';
import { EmptyState } from './ProfileDashboard';

const nf = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const money = (value) => (value == null || Number.isNaN(Number(value)) ? '—' : nf.format(Number(value)));

const STATE_LABEL = {
  ENVIADA: 'Enviada',
  REVISADA: 'Revisada',
  PARCIALMENTE_SUPERADA: 'Parcial',
  ADJUDICADA_A_OTRA: 'Perdida',
  RECHAZADA: 'Rechazada',
  ACEPTADA: 'Ganada',
  PAGO_PENDIENTE: 'Pago pendiente',
  PAGADA: 'Pagada',
  EXPIRADA: 'Expirada',
  CANCELADA: 'Cancelada',
};
// Tono visual de cada estado: azul = en juego, verde = ganada, ámbar = requiere atención, rojo = perdida, gris = cerrada.
const STATE_TONE = {
  ENVIADA: 'blue', REVISADA: 'blue', PARCIALMENTE_SUPERADA: 'amber', ADJUDICADA_A_OTRA: 'red', RECHAZADA: 'red', ACEPTADA: 'green',
  PAGO_PENDIENTE: 'amber', PAGADA: 'teal', EXPIRADA: 'gray', CANCELADA: 'gray',
};
const STATE_ICON = {
  ENVIADA: Send, REVISADA: Eye, PARCIALMENTE_SUPERADA: AlertCircle, ADJUDICADA_A_OTRA: XCircle, RECHAZADA: XCircle, ACEPTADA: Trophy,
  PAGO_PENDIENTE: Clock, PAGADA: Wallet, EXPIRADA: Clock, CANCELADA: XCircle,
};
const LINE_LABEL = { PENDIENTE: 'Compitiendo', GANADA: 'Ganada', ADJUDICADA_A_OTRA: 'Adjudicada a otra', ACEPTADA: 'Aceptada', PAGADA: 'Pagada' };
const LINE_TONE = { PENDIENTE: 'blue', GANADA: 'green', ACEPTADA: 'green', PAGADA: 'teal', ADJUDICADA_A_OTRA: 'gray' };
const POSITION_LABEL = { MAS_BAJA: 'Tu precio es el más bajo', MEDIA: 'Tu precio está en el medio', MAS_ALTA: 'Tu precio es el más alto', UNICA: 'Eres la única oferta' };

const ACTIVE_STATES = ['ENVIADA', 'REVISADA', 'PARCIALMENTE_SUPERADA'];
const WON_STATES = ['ACEPTADA', 'PAGO_PENDIENTE'];
const LOST_STATES = ['ADJUDICADA_A_OTRA', 'RECHAZADA', 'EXPIRADA', 'CANCELADA'];

const FILTERS = [
  ['all', 'Todas'],
  ['active', 'En seguimiento'],
  ['won', 'Ganadas'],
  ['paid', 'Pagadas'],
  ['lost', 'Perdidas'],
  ['saved', 'Guardadas'],
  ['questions', 'Preguntas'],
];

function matchesFilter(offer, filter) {
  if (filter === 'active') return ACTIVE_STATES.includes(offer.estado);
  if (filter === 'won') return WON_STATES.includes(offer.estado);
  if (filter === 'paid') return offer.estado === 'PAGADA';
  if (filter === 'lost') return LOST_STATES.includes(offer.estado);
  return filter !== 'saved' && filter !== 'questions';
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

function StatePill({ estado }) {
  const Icon = STATE_ICON[estado] || Send;
  return <span className={`pt-pill is-${STATE_TONE[estado] || 'blue'}`}><Icon size={13} /> {STATE_LABEL[estado] || estado}</span>;
}

function KpiCard({ icon: Icon, tone, value, label }) {
  return (
    <div className="pt-kpi">
      <span className={`pt-kpi-icon is-${tone}`}><Icon size={22} /></span>
      <span><strong>{value ?? 0}</strong><small>{label}</small></span>
    </div>
  );
}

/** Camino de la oferta: enviada -> revisada por el comprador -> resultado. */
function Stepper({ offer }) {
  const seen = Boolean(offer.vistaEn);
  const decided = !ACTIVE_STATES.includes(offer.estado);
  const lost = LOST_STATES.includes(offer.estado);
  const paid = offer.estado === 'PAGADA';
  const resultLabel = paid ? 'Pedido pagado' : lost ? STATE_LABEL[offer.estado] : WON_STATES.includes(offer.estado) ? 'Aceptada' : 'Decisión del comprador';
  const resultHint = paid ? formatDateTime(offer.actualizadaEn) : decided ? formatDateTime(offer.aceptadaEn || offer.actualizadaEn) : 'Pendiente';
  return (
    <ol className="pt-stepper" aria-label="Seguimiento de la oferta">
      <li className="is-done"><span className="pt-dot"><CheckCircle2 size={14} /></span><strong>Oferta enviada</strong><small>{formatDateTime(offer.enviadaEn)}</small></li>
      <li className={seen ? 'is-done' : ''}><span className="pt-dot">{seen ? <CheckCircle2 size={14} /> : <EyeOff size={12} />}</span><strong>{seen ? 'Comprador la revisó' : 'Aún sin revisar'}</strong><small>{seen ? formatDateTime(offer.vistaEn) : 'Pendiente'}</small></li>
      <li className={decided ? (lost ? 'is-lost' : 'is-done') : ''}><span className="pt-dot">{lost ? <XCircle size={14} /> : decided ? <CheckCircle2 size={14} /> : null}</span><strong>{resultLabel}</strong><small>{resultHint}</small></li>
    </ol>
  );
}

function CompareRow({ icon: Icon, label, value, tone }) {
  if (value == null || value === '') return null;
  return (
    <li className={tone ? `is-${tone}` : ''}>
      <Icon size={16} />
      <span><small>{label}</small><strong>{value}</strong></span>
    </li>
  );
}

/** Preguntas públicas de la búsqueda: la tienda lee lo que preguntaron y responde para afinar su propuesta. */
function PublicQuestions({ auctionId, isOpen }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAuctionComments(auctionId)
      .then((data) => { if (active) setComments(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err?.message || 'No pudimos cargar las preguntas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auctionId]);

  const submit = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setSending(true);
    setError('');
    try {
      const created = await postAuctionComment(auctionId, value);
      setComments((current) => [...current, created]);
      setText('');
    } catch (err) {
      setError(err?.message || 'No pudimos publicar tu respuesta.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="pt-questions" aria-label="Preguntas públicas de la búsqueda">
      <h4><MessageCircle size={16} /> Preguntas públicas de la búsqueda <small>Las preguntas y respuestas son públicas para esta búsqueda de repuestos.</small></h4>
      {loading ? (
        <p className="pt-muted"><Loader2 size={14} className="pg-spin" /> Cargando preguntas…</p>
      ) : comments.length === 0 ? (
        <p className="pt-muted">Aún no hay preguntas sobre esta búsqueda.</p>
      ) : (
        <ul className="pt-comment-list">
          {comments.filter((comment) => comment.respondeAId == null || !comments.some((c) => c.id === comment.respondeAId)).map((comment) => (
            <li key={comment.id} className={comment.autorEsComprador ? 'is-buyer' : comment.autorEsTienda ? 'is-store' : ''}>
              <AuctionAvatar className="pt-avatar" src={comment.autorFotoUrl} name={comment.autor || ''} isStore={comment.autorEsTienda} />
              <div>
                <p><strong>{comment.autorEsComprador ? 'Comentario del comprador' : comment.autor || 'Tienda'}</strong> <small>{formatDateTime(comment.createdAt)}</small></p>
                <p>{comment.texto}</p>
                {comments.filter((reply) => reply.respondeAId === comment.id).map((reply) => (
                  <div key={reply.id} className="pt-reply">
                    <p><strong>Respuesta del cliente</strong> <small>{formatDateTime(reply.createdAt)}</small></p>
                    <p>{reply.texto}</p>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="pg-error" role="alert"><AlertCircle size={14} /> {error}</p>}
      {isOpen && (
        <form className="pt-composer" onSubmit={submit}>
          <input type="text" value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} placeholder="Escribe una respuesta pública…" aria-label="Escribe una respuesta pública" />
          <button type="submit" className="pt-btn is-primary" disabled={sending || !text.trim()}>
            {sending ? <Loader2 size={14} className="pg-spin" /> : <Send size={14} />} Responder públicamente
          </button>
        </form>
      )}
    </section>
  );
}

/** Preguntas que la tienda hizo a las búsquedas, cada una con la respuesta anidada del comprador. */
function MyQuestionsList({ questions, onOpen }) {
  if (questions.length === 0) {
    return <EmptyState label="Aún no has hecho preguntas. Abre una búsqueda de repuestos y pregunta lo que necesites para afinar tu oferta." />;
  }
  return (
    <ul className="pt-myq-list">
      {questions.map((question) => {
        const answered = question.respuestas?.length > 0;
        return (
          <li key={question.id} className={answered ? 'is-answered' : ''}>
            <header>
              <span className="pt-myq-code">{auctionTrackingCode(question.necesidadId)}</span>
              <strong title={question.necesidadTitulo}>{question.necesidadTitulo}</strong>
              <span className={`pt-pill is-${answered ? 'green' : 'amber'}`}>{answered ? 'Respondida' : 'Sin respuesta'}</span>
              <small>{formatDateTime(question.createdAt)}</small>
              <button type="button" className="pt-btn" onClick={() => onOpen(question.necesidadId)}>Ver búsqueda <ArrowRight size={14} /></button>
            </header>
            <p className="pt-myq-text">{question.texto}</p>
            {(question.respuestas || []).map((reply) => (
              <div key={reply.id} className="pt-reply">
                <p><strong>Respuesta del cliente</strong> <small>{formatDateTime(reply.createdAt)}</small></p>
                <p>{reply.texto}</p>
              </div>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

function DetailPanel({ item, busy, onEdit, onOpen, onOrder }) {
  const { necesidad, oferta } = item;
  const budget = necesidad.presupuestoMaximo;
  const overBudget = budget != null && oferta.totalVigente != null && Number(oferta.totalVigente) > Number(budget);
  const open = necesidad.estado === 'ACTIVA' && necesidad.segundosRestantes > 0;
  const offered = (oferta.lineas || []).map((line) => line.producto).filter(Boolean);

  return (
    <aside className="pt-detail" aria-label="Detalle de la propuesta">
      <header className="pt-detail-head">
        <span className="pt-thumb is-lg"><PackageSearch size={26} /></span>
        <div>
          <h3>{necesidad.titulo}</h3>
          <small>Pedido N.º {necesidad.id} · Oferta N.º {oferta.id}</small>
        </div>
        <div className="pt-detail-state">
          <StatePill estado={oferta.estado} />
          <small>Oferta enviada: {formatDateTime(oferta.enviadaEn)}</small>
        </div>
      </header>
      {oferta.detalleEstado && <p className="pt-detail-note">{oferta.detalleEstado}</p>}

      <div className="pt-buyer">
        <span className="pt-avatar-lg"><User size={20} /></span>
        <span><small>Comprador</small><strong>{necesidad.comprador || 'Comprador'}</strong>{necesidad.ubicacion && <em>{necesidad.ubicacion}</em>}</span>
        <button type="button" className="pt-btn" onClick={() => onOpen(necesidad.id)}>Ver búsqueda <ArrowRight size={14} /></button>
      </div>

      <h4 className="pt-section-title"><ClipboardList size={18} /> Comparación de la búsqueda</h4>
      <div className="pt-compare">
        <section className="is-buyer">
          <h5>Lo que pide el comprador</h5>
          <ul>
            <CompareRow icon={Tag} label="Repuestos" value={`${necesidad.itemsTotal} ${necesidad.itemsTotal === 1 ? 'repuesto' : 'repuestos'}`} />
            <CompareRow icon={Gavel} label="Vehículo" value={necesidad.vehiculo} />
            <CompareRow icon={Clock} label="Entrega deseada" value={[necesidad.tiempoMaximoEnvio, necesidad.tipoEnvio].filter(Boolean).join(' · ') || 'Sin plazo'} />
            <CompareRow icon={Wallet} label="Presupuesto / tope" value={budget != null ? `Hasta ${money(budget)}` : 'Sin tope'} />
            {open && <CompareRow icon={Clock} label="Tiempo restante" value={formatRemaining(necesidad.segundosRestantes)} />}
          </ul>
        </section>
        <section className="is-mine">
          <h5>Mi oferta enviada</h5>
          <ul>
            <CompareRow icon={Tag} label="Producto ofrecido" value={offered.length ? offered.join(', ') : null} />
            <CompareRow icon={Wallet} label="Mi precio" value={money(oferta.totalVigente)} tone={overBudget ? 'bad' : undefined} />
            <CompareRow icon={Clock} label="Entrega" value={[oferta.tiempoEntrega, oferta.tipoEntrega].filter(Boolean).join(' · ') || '—'} />
            <CompareRow icon={CheckCircle2} label="Vigencia" value={oferta.vigencia} />
            <CompareRow icon={CheckCircle2} label="Garantía" value={oferta.garantia} />
            <CompareRow icon={ClipboardList} label="Observación" value={oferta.notas} />
          </ul>
        </section>
      </div>
      {overBudget && <p className="pt-warn"><AlertCircle size={14} /> Tu oferta supera el tope del comprador.</p>}
      {oferta.itemsFaltantes?.length > 0 && <p className="pt-warn"><AlertCircle size={14} /> No cubre: {oferta.itemsFaltantes.join(', ')}</p>}

      <Stepper offer={oferta} />
      <p className="pt-compete">
        {oferta.ofertasCompetidoras > 0
          ? `${oferta.ofertasCompetidoras} ${oferta.ofertasCompetidoras === 1 ? 'oferta compite' : 'ofertas compiten'} contigo${oferta.posicionPrecio ? ` · ${POSITION_LABEL[oferta.posicionPrecio] || ''}` : ''}`
          : 'Eres la única oferta por ahora'}
      </p>

      {oferta.lineas?.length > 0 && (
        <ul className="pt-lines">
          {oferta.lineas.map((line) => (
            <li key={line.itemId}>
              <span><strong>{line.repuesto}</strong><small>{line.producto} · {line.cantidad} u. × {money(line.precioUnitario)}</small></span>
              <b>{money(line.precioTotal)}</b>
              <span className={`pt-pill is-${LINE_TONE[line.estado] || 'blue'}`}>{LINE_LABEL[line.estado] || line.estado}</span>
            </li>
          ))}
        </ul>
      )}

      <PublicQuestions auctionId={necesidad.id} isOpen={open} />

      <footer className="pt-detail-actions">
        {oferta.pedidoId && <button type="button" className="pt-btn is-primary" onClick={() => onOrder(oferta.pedidoId)}><PackageCheck size={14} /> Ver pedido</button>}
        {oferta.editable && (
          <button type="button" className="pt-btn" onClick={() => onEdit(necesidad.id)} disabled={busy}>
            {busy ? <Loader2 size={14} className="pg-spin" /> : <Pencil size={14} />} Editar oferta
          </button>
        )}
      </footer>
    </aside>
  );
}

/** Solicitud guardada para seguimiento: lo esencial y si la tienda ya ofertó. */
function SavedRow({ auction, myOffer, onOpen, onRemove, busy }) {
  const vehicle = [auction.marca, auction.modelo, auction.anio].filter(Boolean).join(' ');
  const remaining = Math.max(0, new Date(auction.fechaLimite).getTime() - Date.now());
  const open = auction.estado === 'ACTIVA' && remaining > 0;
  return (
    <tr>
      <td className="pt-code-cell">{auctionTrackingCode(auction.id)}</td>
      <td>{vehicle || '—'}</td>
      <td>{auction.totalCotizaciones || 0} ofertas</td>
      <td><span className={`pt-pill is-${open ? 'blue' : 'gray'}`}>{open ? 'Activa' : 'Cerrada'}</span>{myOffer && <span className="pt-pill is-green">Ya ofertaste</span>}</td>
      <td>{open ? formatRemaining(remaining / 1000) : '—'}</td>
      <td className="pt-row-actions">
        <button type="button" className="pt-btn" onClick={() => onRemove(auction.id)} disabled={busy}><Bookmark size={14} /> Quitar</button>
        <button type="button" className="pt-btn is-primary" onClick={() => onOpen(auction.id)}>Ver <ArrowRight size={14} /></button>
      </td>
    </tr>
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
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [myQuestions, setMyQuestions] = useState([]);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [offersData, savedData, questionsData] = await Promise.all([
        getMyAuctionOffers(), getSavedAuctions().catch(() => []), getMyAuctionQuestions().catch(() => []),
      ]);
      setData(offersData);
      setSaved(Array.isArray(savedData) ? savedData : []);
      setMyQuestions(Array.isArray(questionsData) ? questionsData : []);
    } catch (err) {
      setError(err?.message || 'No pudimos cargar tus ofertas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const offers = useMemo(() => data?.ofertas || [], [data]);
  const counts = useMemo(() => ({
    all: offers.length,
    active: offers.filter((item) => matchesFilter(item.oferta, 'active')).length,
    won: offers.filter((item) => matchesFilter(item.oferta, 'won')).length,
    paid: offers.filter((item) => matchesFilter(item.oferta, 'paid')).length,
    lost: offers.filter((item) => matchesFilter(item.oferta, 'lost')).length,
    saved: saved.length,
    questions: myQuestions.length,
  }), [offers, saved, myQuestions]);

  const text = query.trim().toLowerCase();
  const visible = useMemo(() => offers.filter((item) => matchesFilter(item.oferta, filter)
    && (!text || `${item.necesidad.titulo} ${item.necesidad.vehiculo || ''} ${item.necesidad.comprador || ''} ${item.necesidad.id}`.toLowerCase().includes(text))), [offers, filter, text]);
  const visibleSaved = useMemo(() => saved.filter((auction) => !text
    || `${auction.repuestoSolicitado} ${auction.marca || ''} ${auction.modelo || ''} ${auction.id}`.toLowerCase().includes(text)), [saved, text]);
  const visibleQuestions = useMemo(() => myQuestions.filter((question) => !text
    || `${question.necesidadTitulo} ${question.texto} ${auctionTrackingCode(question.necesidadId)}`.toLowerCase().includes(text)), [myQuestions, text]);
  const myOfferIds = useMemo(() => new Set(offers.map((item) => item.necesidad.id)), [offers]);

  const selected = useMemo(
    () => visible.find((item) => item.oferta.id === selectedId) || visible[0] || null,
    [visible, selectedId],
  );

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

  const wonTotal = (data?.aceptadas ?? 0) + (data?.porPagar ?? 0) + (data?.pagadas ?? 0);

  return (
    <section className="pg-panel pt-panel">
      <header className="pt-header">
        <div>
          <h2>Seguimiento de propuestas</h2>
          <p>Haz seguimiento a tus ofertas, compara tu propuesta con lo que pide el comprador y revisa las preguntas públicas.</p>
        </div>
        <button type="button" className="pt-btn is-primary" onClick={() => navigate(ROUTES.auctions)}>
          <PackageSearch size={15} /> Ver búsquedas públicas
        </button>
      </header>

      {loading ? (
        <div className="pg-loading"><Loader2 size={18} className="pg-spin" /> Cargando tus ofertas…</div>
      ) : (
        <>
          <div className="pt-kpis">
            <KpiCard icon={Send} tone="blue" value={data?.enviadas} label="Enviadas" />
            <KpiCard icon={Eye} tone="violet" value={data?.revisadas} label="Revisadas" />
            <KpiCard icon={Trophy} tone="amber" value={wonTotal} label="Ganadas" />
            <KpiCard icon={Wallet} tone="green" value={data?.pagadas} label="Pagadas" />
          </div>

          {error && <p className="pg-error" role="alert"><AlertCircle size={15} /> {error}</p>}

          <div className="pt-toolbar">
            <div className="pt-tabs" role="tablist" aria-label="Filtrar propuestas">
              {FILTERS.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>
                  {label} ({counts[key]})
                </button>
              ))}
            </div>
            <label className="pt-search"><Search size={15} />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por repuesto, vehículo o comprador…" />
            </label>
          </div>

          {filter === 'questions' ? (
            <MyQuestionsList questions={visibleQuestions} onOpen={(id) => navigate(auctionDetailPath(id))} />
          ) : filter === 'saved' ? (
            visibleSaved.length === 0 ? (
              <EmptyState label="No tienes solicitudes guardadas. Abre una búsqueda de repuestos y presiona «Guardar» para hacerle seguimiento." />
            ) : (
              <div className="pt-table-wrap">
                <table className="pt-table">
                  <thead><tr><th>Búsqueda</th><th>Vehículo</th><th>Ofertas</th><th>Estado</th><th>Tiempo restante</th><th /></tr></thead>
                  <tbody>
                    {visibleSaved.map((auction) => (
                      <SavedRow key={auction.id} auction={auction} myOffer={myOfferIds.has(auction.id)} busy={removingId === auction.id} onOpen={(id) => navigate(auctionDetailPath(id))} onRemove={removeSaved} />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : visible.length === 0 ? (
            <EmptyState label={offers.length === 0 ? 'Aún no has enviado ofertas. Entra a las búsquedas de repuestos públicas y ofrece tus repuestos.' : 'No hay propuestas en este filtro.'} />
          ) : (
            <div className="pt-layout">
              <div className="pt-table-wrap">
                <table className="pt-table">
                  <thead>
                    <tr><th className="pt-col-need">Búsqueda</th><th className="pt-col-vehicle">Vehículo</th><th className="pt-col-state">Estado</th><th className="pt-col-date">Última actividad</th></tr>
                  </thead>
                  <tbody>
                    {visible.map((item) => {
                      const { necesidad, oferta } = item;
                      const active = selected?.oferta.id === oferta.id;
                      return (
                        <tr key={oferta.id} className={active ? 'is-selected' : ''} onClick={() => setSelectedId(oferta.id)} tabIndex={0} aria-selected={active}
                          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(oferta.id); } }}>
                          <td className="pt-code-cell" title={necesidad.titulo}>{auctionTrackingCode(necesidad.id)}</td>
                          <td className="pt-cell-vehicle" title={necesidad.vehiculo || undefined}>{necesidad.vehiculo || '—'}</td>
                          <td><StatePill estado={oferta.estado} /></td>
                          <td className="pt-date">{formatDateTime(oferta.actualizadaEn || oferta.enviadaEn)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {selected && (
                <DetailPanel
                  key={selected.oferta.id}
                  item={selected}
                  busy={busyId === selected.necesidad.id}
                  onEdit={openEdit}
                  onOpen={(id) => navigate(auctionDetailPath(id))}
                  onOrder={(id) => navigate(profileOrderPath(id))}
                />
              )}
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
