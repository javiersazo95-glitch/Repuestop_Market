import '../styles/profile-auctions.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, CalendarDays, Car, CheckCircle2, Clock, Gavel, Inbox, Lock, MapPin, Package, PackageCheck, Pencil, Plus,
  ReceiptText, Search, ShoppingCart, Tag, X,
} from 'lucide-react';
import { getAuctionDetail, getMyAuctionRequests } from '../services/auctionApi';
import { resolveMediaUrl } from '../services/api';
import { auctionDetailPath, profilePurchasePath, profileOrderPath } from '../routes/paths';
import { useAuth } from '../context/AuthContext';
import CreateAuctionModal from './CreateAuctionModal';
import AuctionOffersModal from './AuctionOffersModal';
import AuctionPurchaseModal from './AuctionPurchaseModal';
import ListPager from './ListPager';
import usePagedList from '../hooks/usePagedList';
import { EmptyState } from './ProfileDashboard';

const HOUR = 60 * 60 * 1000;

/**
 * Etapa de un pedido de subasta en su camino a la compra: ofertas abiertas -> pedido armado con las ofertas
 * aceptadas (por pagar) -> pagado. Un pedido puede seguir abierto para los repuestos que falten adjudicar.
 */
function resolveStage(auction, now) {
  const remaining = new Date(auction.fechaLimite).getTime() - now;
  const open = auction.estado === 'ACTIVA' && remaining > 0;
  const accepted = auction.ofertasAceptadas || 0;
  const paid = auction.ofertasPagadas || 0;
  const pendingItems = (auction.totalItems || 1) - (auction.itemsAdjudicados || 0);
  const flags = { open, pendingItems, accepted, paid };
  if (accepted > paid) return { key: 'quote', label: 'Pedido por pagar', step: 2, ...flags };
  if (open) {
    const base = remaining < HOUR ? { key: 'ending', label: 'Por finalizar' } : { key: 'open', label: accepted > 0 ? 'Pedido parcial pagado' : 'Activa' };
    return { ...base, step: accepted > 0 ? 3 : 1, ...flags };
  }
  if (accepted > 0 && paid === accepted) return { key: 'purchased', label: pendingItems > 0 ? 'Pagado parcialmente' : 'Comprada', step: 3, ...flags };
  return { key: 'closed', label: auction.estado === 'CANCELADA' ? 'Cancelada' : 'Sin adjudicar', step: 0, ...flags };
}

function formatRemaining(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} ${days === 1 ? 'día' : 'días'} ${hours} h restantes`;
  return `${hours} h ${minutes % 60} min restantes`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

const FILTERS = [
  ['all', 'Todas'],
  ['active', 'En curso'],
  ['purchases', 'Compras'],
  ['history', 'Historial'],
];

function AuctionRow({ auction, stage, now, isSeller, onNavigate, onOpenOffers, onOpenPurchase, onEdit, editBusy }) {
  const [blockedNotice, setBlockedNotice] = useState(false);
  const canEdit = auction.editable !== false;
  const vehicle = [auction.marca, auction.modelo, auction.anio].filter(Boolean).join(' ');
  const location = [auction.comuna, auction.region].filter(Boolean).join(', ');
  const offers = auction.totalCotizaciones || 0;
  const photo = auction.fotoPrincipalUrl ? resolveMediaUrl(auction.fotoPrincipalUrl) : null;
  const isRunning = stage.open;
  const totalItems = auction.totalItems || 1;
  const awarded = auction.itemsAdjudicados || 0;

  const actions = [];
  if (stage.key === 'quote') {
    actions.push({ label: 'Ver mi pedido y pagar', icon: ShoppingCart, onClick: () => onOpenPurchase(auction), primary: true });
    if (isRunning && stage.pendingItems > 0) actions.push({ label: `Ver ofertas (${offers})`, icon: Gavel, onClick: () => onOpenOffers(auction) });
  } else if (isRunning) {
    actions.push({ label: offers > 0 ? `Ver ofertas (${offers})` : 'Ver ofertas', icon: Gavel, onClick: () => onOpenOffers(auction), primary: true });
    if (stage.accepted > 0) actions.push({ label: 'Ver mi pedido', icon: PackageCheck, onClick: () => onOpenPurchase(auction) });
  } else if (stage.key === 'purchased' && auction.pedidoId) {
    actions.push({
      label: 'Seguir compra', icon: PackageCheck, primary: true,
      onClick: () => onNavigate(isSeller ? profilePurchasePath(auction.pedidoId) : profileOrderPath(auction.pedidoId)),
    });
  }

  const facts = [
    { icon: Car, label: 'Vehículo', value: vehicle },
    { icon: Tag, label: 'Categoría', value: auction.categoria },
    { icon: MapPin, label: 'Ubicación', value: location },
    { icon: CalendarDays, label: 'Publicada', value: formatDate(auction.createdAt) },
  ].filter((fact) => fact.value);

  return (
    <article className={`pa-card is-${stage.key}`}>
      <div className="pa-card-top">
        <div className="pa-thumb">{photo ? <img src={photo} alt="" loading="lazy" /> : <Package size={28} />}</div>

        <div className="pa-card-main">
          <div className="pa-card-head">
            <h3>{auction.repuestoSolicitado}</h3>
            <span className={`pa-badge is-${stage.key}`}>{stage.label}</span>
          </div>
          <span className="pa-card-id">Pedido N.º {auction.id} · {totalItems} {totalItems === 1 ? 'repuesto' : 'repuestos'}</span>
          <dl className="pa-facts">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label}><dt><Icon size={13} /> {label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          {totalItems > 1 && (
            <div className="pa-progress" aria-label={`${awarded} de ${totalItems} repuestos adjudicados`}>
              <div className="pa-progress-track"><span style={{ width: `${(awarded / totalItems) * 100}%` }} /></div>
              <small>{awarded} de {totalItems} repuestos adjudicados{stage.pendingItems > 0 ? ` · faltan ${stage.pendingItems}` : ''}</small>
            </div>
          )}
        </div>

        <div className="pa-card-side">
          <div className="pa-stat">
            <strong>{offers}</strong>
            <small>{offers === 1 ? 'oferta recibida' : 'ofertas recibidas'}</small>
          </div>
          {stage.accepted > 0 && (
            <div className="pa-stat">
              <strong>{stage.accepted}</strong>
              <small>{stage.accepted === 1 ? 'tienda aceptada' : 'tiendas aceptadas'}</small>
            </div>
          )}
          {isRunning && (
            <div className={`pa-stat ${stage.key === 'ending' ? 'is-urgent' : ''}`}>
              <strong><Clock size={14} /> {formatRemaining(new Date(auction.fechaLimite).getTime() - now)}</strong>
              <small>para recibir ofertas</small>
            </div>
          )}
        </div>
      </div>

      <div className="pa-card-foot">
        <ol className="pa-steps" aria-label="Avance de la compra">
          {['Ofertas', 'Pedido', 'Pago'].map((label, index) => {
            const done = index + 1 < stage.step || (stage.key === 'purchased' && stage.pendingItems === 0);
            const current = !done && index + 1 === stage.step;
            return (
              <li key={label} className={done ? 'is-done' : current ? 'is-current' : ''}>
                <span>{done ? <CheckCircle2 size={14} /> : index + 1}</span>
                {label}
              </li>
            );
          })}
        </ol>
        <div className="pa-card-actions">
          <button type="button" className="pa-btn-link" onClick={() => onNavigate(auctionDetailPath(auction.id))}>
            Ver detalle <ArrowRight size={14} />
          </button>
          <button
            type="button"
            className={`pa-btn-secondary pa-btn-edit ${canEdit ? '' : 'is-locked'}`}
            aria-disabled={!canEdit}
            onClick={() => (canEdit ? onEdit(auction) : setBlockedNotice((value) => !value))}
            disabled={editBusy}
          >
            {canEdit ? <Pencil size={15} /> : <Lock size={15} />} Editar
          </button>
          {actions.map((action) => (
            <button key={action.label} type="button" className={action.primary ? 'pa-btn-primary' : 'pa-btn-secondary'} onClick={action.onClick}>
              <action.icon size={15} /> {action.label}
            </button>
          ))}
        </div>
      </div>
      {blockedNotice && !canEdit && (
        <p className="pa-edit-notice" role="alert"><Lock size={14} /> {auction.motivoNoEditable || 'Este pedido ya no se puede editar.'}</p>
      )}
    </article>
  );
}

/** Pestaña "Subastas" de Mis compras: publicar una necesidad, su historial y el seguimiento hasta la compra. */
export default function ProfileAuctionsPanel() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isSeller = String(user?.role || role || '').toUpperCase() === 'SELLER';

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [offersAuctionId, setOffersAuctionId] = useState(null);
  const [purchaseAuctionId, setPurchaseAuctionId] = useState(null);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editBusyId, setEditBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getMyAuctionRequests();
      setAuctions(Array.isArray(data) ? data : data?.content || []);
      setError('');
    } catch (err) {
      setError(err?.message || 'No pudimos cargar tus necesidades de compra.');
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
    active: rows.filter(({ stage }) => stage.open).length,
    withOffers: rows.filter(({ auction, stage }) => stage.open && auction.totalCotizaciones > 0).length,
    toPay: rows.filter(({ stage }) => stage.key === 'quote').length,
    purchased: rows.filter(({ stage }) => stage.key === 'purchased').length,
  }), [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(({ auction, stage }) => {
      if (filter === 'active' && !(stage.open || stage.key === 'quote')) return false;
      if (filter === 'purchases' && !(stage.accepted > 0)) return false;
      if (filter === 'history' && stage.open) return false;
      if (!query) return true;
      return `${auction.repuestoSolicitado} ${auction.marca || ''} ${auction.modelo || ''} ${auction.categoria || ''}`.toLowerCase().includes(query);
    });
  }, [rows, filter, search]);

  const { pageItems, pagerProps } = usePagedList(visibleRows, JSON.stringify([filter, search]));

  const openEdit = async (auction) => {
    setEditBusyId(auction.id);
    try {
      setEditing(await getAuctionDetail(auction.id));
    } catch (err) {
      setError(err?.message || 'No pudimos abrir tu pedido para editarlo.');
    } finally {
      setEditBusyId(null);
    }
  };

  const handleCreated = (created) => {
    if (created?.id) navigate(auctionDetailPath(created.id));
    else load();
  };

  return (
    <div className="profile-panel seller-quotes-panel">
      <div className="seller-quotes-heading">
        <div>
          <span className="seller-quotes-eyebrow"><Gavel size={14} /> Necesidades de compra</span>
          <h2 className="profile-panel-title">Necesidades de compra</h2>
          <p>Arma un pedido con todos los repuestos que necesitas, recibe ofertas de las tiendas y acepta las que te sirvan, aunque cubran solo una parte. Lo aceptado se paga junto, en un solo pedido de varias tiendas.</p>
        </div>
        <div className="seller-quotes-heading-actions">
          <button type="button" className="pa-btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} /> Publicar necesidad
          </button>
        </div>
      </div>

      <div className="seller-quotes-summary">
        <article><Gavel size={18} /><span><strong>{summary.active}</strong>Activas</span></article>
        <article className="is-sent"><Inbox size={18} /><span><strong>{summary.withOffers}</strong>Con ofertas</span></article>
        <article className="is-pending"><ReceiptText size={18} /><span><strong>{summary.toPay}</strong>Pedidos por pagar</span></article>
        <article className="is-unread"><PackageCheck size={18} /><span><strong>{summary.purchased}</strong>Compradas</span></article>
      </div>

      <div className="seller-quotes-toolbar">
        <label className="seller-quotes-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar repuesto, vehículo o categoría..." />{search && <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={13} /></button>}</label>
        <div className="seller-quotes-filters" role="group" aria-label="Filtrar necesidades de compra">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <EmptyState label="Cargando tus necesidades de compra..." />
      ) : error ? (
        <div className="pa-error" role="alert"><AlertCircle size={16} /> {error} <button type="button" onClick={load}>Reintentar</button></div>
      ) : rows.length === 0 ? (
        <EmptyState label="Aún no has publicado ninguna necesidad de compra." />
      ) : visibleRows.length === 0 ? (
        <EmptyState label="No encontramos necesidades de compra con esos filtros." />
      ) : (
        <>
          <div className="pa-list">
            {pageItems.map(({ auction, stage }) => (
              <AuctionRow key={auction.id} auction={auction} stage={stage} now={now} isSeller={isSeller} onNavigate={navigate} onOpenOffers={(item) => setOffersAuctionId(item.id)} onOpenPurchase={(item) => setPurchaseAuctionId(item.id)} onEdit={openEdit} editBusy={editBusyId === auction.id} />
            ))}
          </div>
          <ListPager pagerProps={pagerProps} itemLabel="necesidades" />
        </>
      )}

      <AuctionOffersModal
        isOpen={offersAuctionId != null}
        auctionId={offersAuctionId}
        onClose={() => setOffersAuctionId(null)}
        onChanged={load}
        onOpenPurchase={() => setPurchaseAuctionId(offersAuctionId)}
      />

      <AuctionPurchaseModal
        isOpen={purchaseAuctionId != null}
        auctionId={purchaseAuctionId}
        onClose={() => { setPurchaseAuctionId(null); load(); }}
        onSeeOffers={() => setOffersAuctionId(purchaseAuctionId)}
      />

      <CreateAuctionModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={handleCreated} />
      {editing && (
        <CreateAuctionModal isOpen auction={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
