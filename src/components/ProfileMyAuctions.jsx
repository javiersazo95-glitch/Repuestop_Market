import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, CalendarDays, Car, ChevronRight, ClipboardList, CreditCard, FileText, Gavel, Loader2, Lock, MapPin,
  MessageCircle, Package, PackageCheck, Pencil, Plus, Search, Tag, Wallet, X,
} from 'lucide-react';
import { getAuctionDetail, getMyAuctionRequests, getPendingQuestionCounts } from '../services/auctionApi';
import { timeSince } from '../services/faultApi';
import { resolveMediaUrl } from '../services/api';
import { auctionDetailPath, profileOrderPath } from '../routes/paths';
import { paymentDeadlineInfo } from '../utils/paymentDeadline';
import { MAX_SEARCH_LENGTH } from '../utils/inputLimits';
import usePagedList from '../hooks/usePagedList';
import CreateAuctionModal from './CreateAuctionModal';
import AuctionQuestionsModal from './AuctionQuestionsModal';
import ListPager from './ListPager';
import '../styles/faults.css';
import '../styles/profile-auctions.css';

const HOUR = 60 * 60 * 1000;
const money = (value) => (value == null ? '' : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value));

function formatRemaining(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} ${days === 1 ? 'día' : 'días'} ${hours} h`;
  return `${hours} h ${minutes % 60} min`;
}

/**
 * Etapa de un encargo en su camino a la compra: abierto (esperando ofertas) -> ofertas aceptadas por pagar -> comprado,
 * o cerrado sin comprar. Un encargo puede seguir abierto para los repuestos que falten.
 */
function resolveStage(auction, now) {
  const remaining = new Date(auction.fechaLimite).getTime() - now;
  const open = auction.estado === 'ACTIVA' && remaining > 0;
  const accepted = auction.ofertasAceptadas || 0;
  const paid = auction.ofertasPagadas || 0;
  if (accepted > paid) return { key: 'toPay', label: 'Por pagar', open, remaining, accepted, paid };
  if (open) return { key: 'open', label: remaining < HOUR ? 'Por finalizar' : 'Activa', open, remaining, accepted, paid };
  if (accepted > 0 && paid === accepted) return { key: 'purchased', label: 'Comprada', open, remaining, accepted, paid };
  return { key: 'closed', label: auction.estado === 'CANCELADA' ? 'Cancelada' : 'Sin adjudicar', open, remaining, accepted, paid };
}

const FILTERS = [['all', 'Todas'], ['open', 'En curso'], ['offers', 'Con ofertas'], ['toPay', 'Por pagar'], ['purchased', 'Compradas'], ['closed', 'Cerradas']];

/** Acciones de una tarjeta, como en "Mis fallas": editar (lápiz), ver detalle, ofertas y preguntas. */
function AuctionActions({ auction, stage, pendingQuestions, onChanged }) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const canEdit = auction.editable !== false;
  const offers = auction.totalCotizaciones || 0;

  const startEdit = async () => {
    if (!canEdit) { setNotice((value) => (value ? '' : auction.motivoNoEditable || 'Este pedido ya no se puede editar.')); return; }
    setBusy(true);
    setNotice('');
    try {
      setEditing(await getAuctionDetail(auction.id));
    } catch (err) {
      setNotice(err?.message || 'No pudimos abrir tu pedido para editarlo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mfa">
      <button
        type="button"
        className={`mfa-edit ${canEdit ? '' : 'is-locked'}`}
        aria-label={canEdit ? 'Editar el encargo' : 'El encargo ya no se puede editar'}
        title={canEdit ? 'Editar encargo' : 'Ya no se puede editar'}
        aria-disabled={!canEdit}
        onClick={() => void startEdit()}
        disabled={busy}
      >
        {busy ? <Loader2 size={16} className="spin-icon" /> : canEdit ? <Pencil size={16} /> : <Lock size={16} />}
      </button>
      <div className="pa-card-actions mfa-actions">
        <Link className="pa-btn-link" to={auctionDetailPath(auction.id)} aria-label={`Ver el detalle de ${auction.repuestoSolicitado}`}>
          Ver detalle <ArrowRight size={14} />
        </Link>
        <button type="button" className="pa-btn-secondary" onClick={() => navigate(`${auctionDetailPath(auction.id)}?ofertas=1`)} aria-label={`Ver ofertas (${offers})`}>
          <ClipboardList size={15} /> {stage.key === 'toPay' ? 'Ofertas y pago' : `Ofertas (${offers})`}
        </button>
        <button
          type="button"
          className="pa-btn-secondary"
          onClick={() => setPanel(true)}
          aria-label={pendingQuestions > 0 ? `Preguntas de las tiendas (${pendingQuestions} sin responder)` : 'Preguntas de las tiendas'}
        >
          <MessageCircle size={15} /> Preguntas
          {pendingQuestions > 0 && <span className="mfa-badge">{pendingQuestions > 99 ? '99+' : pendingQuestions}</span>}
        </button>
        {stage.key === 'purchased' && auction.pedidoId && (
          <Link className="pa-btn-secondary" to={profileOrderPath(auction.pedidoId)}><PackageCheck size={15} /> Ver pedido</Link>
        )}
      </div>
      {notice && <p className="pa-edit-notice" role="alert"><Lock size={14} /> {notice}</p>}

      {panel && (
        <AuctionQuestionsModal
          auctionId={auction.id}
          title={auction.repuestoSolicitado}
          canReply={stage.open}
          onPendingChange={() => {}}
          onClose={() => { setPanel(false); onChanged?.(); }}
        />
      )}
      {editing && (
        <CreateAuctionModal
          isOpen
          auction={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); onChanged?.(); }}
        />
      )}
    </div>
  );
}

function AuctionCard({ auction, stage, now, pendingQuestions, onChanged }) {
  const vehicle = [auction.marca, auction.modelo].filter(Boolean).join(' ') || 'Vehículo';
  const vehicleData = [auction.anio, auction.motor].filter(Boolean);
  const place = [auction.comuna, auction.region].filter(Boolean).join(', ');
  const photo = auction.fotoPrincipalUrl ? resolveMediaUrl(auction.fotoPrincipalUrl) : null;
  const offers = auction.totalCotizaciones || 0;
  const totalItems = auction.totalItems || 1;
  const toPay = Math.max(0, stage.accepted - stage.paid);
  const deadline = toPay > 0 ? paymentDeadlineInfo(auction.pagoPendienteVenceEn, now) : null;
  const payText = toPay > 0
    ? `${toPay} ${toPay === 1 ? 'tienda aceptada' : 'tiendas aceptadas'}${deadline ? ` · ${deadline.text}` : ' · pago pendiente'}`
    : stage.key === 'purchased' ? 'Pagado' : 'Sin pagos pendientes';

  return (
    <article className="ft-fault-card">
      <div className="ft-fault-media">
        {photo ? <img src={photo} alt={auction.repuestoSolicitado} loading="lazy" /> : <span aria-hidden="true"><Package size={44} /></span>}
      </div>

      <div className="ft-fault-summary">
        <div className="ft-card-badges">
          <span className="ft-badge is-mine">Mi encargo</span>
          <span className={`ft-badge ${stage.key === 'closed' ? 'is-closed' : ''} ${stage.key === 'toPay' ? 'is-pickup' : ''}`}>
            {stage.key === 'toPay' && <CreditCard size={13} aria-hidden="true" />} {stage.label}
          </span>
          {auction.categoria && <span className="ft-badge">{auction.categoria}</span>}
        </div>
        <h3>{auction.repuestoSolicitado}</h3>
        <p className="ft-vehicle-data"><span>{vehicle}</span>{vehicleData.map((item) => <span key={item}>{item}</span>)}</p>
        <div className="ft-fault-what">
          <strong>¿Qué pedí?</strong>
          <p className="ft-fault-description">{totalItems} {totalItems === 1 ? 'repuesto' : 'repuestos'} · {auction.cantidad} {auction.cantidad === 1 ? 'unidad' : 'unidades'}{auction.descripcion ? `. ${auction.descripcion}` : ''}</p>
        </div>
        <div className="ft-fault-meta">
          {place && <span><MapPin size={15} /> {place}</span>}
          <span><CalendarDays size={15} /> {timeSince(auction.createdAt)}</span>
        </div>
      </div>

      <div className="ft-fault-detail">
        <span className="ft-type-pill is-other"><Gavel size={15} /> Encargo de repuestos</span>
        <dl>
          <div><dt><Wallet size={14} /> Presupuesto</dt><dd>{auction.presupuestoMaximo ? `${money(auction.presupuestoMaximo)} máx.` : 'Sin tope'}</dd></div>
          <div><dt><CalendarDays size={14} /> Plazo</dt><dd>{stage.open ? `Quedan ${formatRemaining(stage.remaining)}` : 'Cerrado'}</dd></div>
          <div><dt><Tag size={14} /> Ofertas</dt><dd>{offers === 0 ? 'Sin ofertas aún' : `${offers} ${offers === 1 ? 'oferta recibida' : 'ofertas recibidas'}`}</dd></div>
          <div><dt><MessageCircle size={14} /> Preguntas</dt><dd>{pendingQuestions > 0 ? `${pendingQuestions} sin responder` : 'Sin preguntas pendientes'}</dd></div>
          <div><dt><CreditCard size={14} /> Pago</dt><dd>{payText}</dd></div>
        </dl>
        <AuctionActions auction={auction} stage={stage} pendingQuestions={pendingQuestions} onChanged={onChanged} />
      </div>
    </article>
  );
}

/**
 * "Encargar repuesto" del perfil del comprador: mismo diseño y misma estructura que "Mis fallas" (encabezado con el botón de
 * publicar, resumen, buscador con filtros y tarjetas con sus acciones).
 */
export default function ProfileMyAuctions() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, pending] = await Promise.all([getMyAuctionRequests(), getPendingQuestionCounts().catch(() => ({}))]);
      setAuctions(Array.isArray(data) ? data : data?.content || []);
      setPendingQuestions(pending && typeof pending === 'object' ? pending : {});
      setError('');
    } catch (err) {
      setError(err?.message || 'No pudimos cargar tus encargos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); load(); }, 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  const rows = useMemo(() => auctions.map((auction) => ({ auction, stage: resolveStage(auction, now) })), [auctions, now]);
  const summary = useMemo(() => ({
    total: rows.length,
    open: rows.filter(({ stage }) => stage.open).length,
    toPay: rows.filter(({ stage }) => stage.key === 'toPay').length,
    purchased: rows.filter(({ stage }) => stage.key === 'purchased').length,
  }), [rows]);

  const visibleRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return rows.filter(({ auction, stage }) => {
      if (filter === 'open' && !stage.open) return false;
      if (filter === 'offers' && !(auction.totalCotizaciones > 0)) return false;
      if (filter === 'toPay' && stage.key !== 'toPay') return false;
      if (filter === 'purchased' && stage.key !== 'purchased') return false;
      if (filter === 'closed' && stage.key !== 'closed') return false;
      if (!query) return true;
      return `${auction.repuestoSolicitado} ${auction.marca || ''} ${auction.modelo || ''} ${auction.categoria || ''} ${auction.comuna || ''}`.toLowerCase().includes(query);
    });
  }, [rows, filter, searchText]);

  const { pageItems, pagerProps } = usePagedList(visibleRows, JSON.stringify([filter, searchText]), 10);

  const results = loading ? <div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando encargos…</div>
    : error ? <div className="ft-empty" role="alert"><AlertCircle size={20} /><strong>No pudimos cargar tus encargos</strong>{error}<br /><button type="button" className="ft-btn ft-btn-outline" onClick={load}>Reintentar</button></div>
      : visibleRows.length === 0
        ? (
          <div className="ft-empty">
            <Gavel size={22} />
            <strong>{rows.length === 0 ? 'Aún no publicas encargos' : 'No encontramos encargos'}</strong>
            {rows.length === 0 ? 'Publica lo que necesitas y aquí verás las ofertas y preguntas de las tiendas.' : 'Prueba cambiando la búsqueda o el filtro.'}
          </div>
        )
        : (
          <>
            <div className="ft-fault-list">
              {pageItems.map(({ auction, stage }) => (
                <AuctionCard key={auction.id} auction={auction} stage={stage} now={now} pendingQuestions={Number(pendingQuestions[auction.id] || 0)} onChanged={load} />
              ))}
            </div>
            <ListPager pagerProps={pagerProps} itemLabel="encargos" />
          </>
        );

  return (
    <div className="profile-panel seller-quotes-panel ft-profile-faults">
      <div className="seller-quotes-heading">
        <div>
          <span className="seller-quotes-eyebrow"><Gavel size={14} /> Búsqueda de repuestos</span>
          <h2 className="profile-panel-title">Encargar repuesto</h2>
          <p>Arma un pedido con todos los repuestos que necesitas, recibe ofertas de las tiendas y acepta las que te sirvan, aunque cubran solo una parte. Aquí le haces seguimiento a cada encargo.</p>
        </div>
        <div className="seller-quotes-heading-actions">
          <button type="button" className="pa-btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Publicar búsqueda</button>
        </div>
      </div>

      <div className="seller-quotes-summary">
        <article><ClipboardList size={18} /><span><strong>{summary.total}</strong>Publicados</span></article>
        <article className="is-sent"><Gavel size={18} /><span><strong>{summary.open}</strong>En curso</span></article>
        <article className="is-pending"><CreditCard size={18} /><span><strong>{summary.toPay}</strong>Por pagar</span></article>
        <article className="is-unread"><PackageCheck size={18} /><span><strong>{summary.purchased}</strong>Comprados</span></article>
      </div>

      <div className="seller-quotes-toolbar">
        <label className="seller-quotes-search"><Search size={15} /><input value={searchText} maxLength={MAX_SEARCH_LENGTH} onChange={(event) => setSearchText(event.target.value)} placeholder="Buscar por repuesto, vehículo o comuna..." />{searchText && <button type="button" onClick={() => setSearchText('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}</label>
        <div className="seller-quotes-filters" role="group" aria-label="Filtrar encargos">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
      </div>

      {results}
      <CreateAuctionModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onSuccess={(created) => { setCreating(false); if (created?.id) navigate(auctionDetailPath(created.id)); else load(); }}
      />
    </div>
  );
}
