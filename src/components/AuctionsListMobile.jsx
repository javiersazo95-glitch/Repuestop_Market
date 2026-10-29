import React, { useState } from 'react';
import {
  ArrowUpDown, CalendarDays, Car, Check, ChevronRight, Clock, Eye, Gavel, MapPin, MessageCircle, Package, Plus, Search,
  SlidersHorizontal, Tag, Wallet, X,
} from 'lucide-react';
import { resolveMediaUrl } from '../services/api';
import { auctionTrackingCode } from '../services/auctionApi';
import { pendingSummary } from '../utils/auctionPending';
import '../styles/auction-app-mobile.css';

const HOUR = 60 * 60 * 1000;

function formatCLP(value) {
  if (value == null) return '';
  return `$${new Intl.NumberFormat('es-CL').format(value)}`;
}

function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return days > 0 ? `${days} ${days === 1 ? 'día' : 'días'} ${pad(hours)} h` : `${pad(hours)} h ${pad(minutes)} min`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Publicado hoy, 10:42" / "ayer" / fecha, igual que la app. */
function formatPublished(iso, now) {
  if (!iso) return '';
  const date = new Date(iso);
  const time = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay(date, new Date(now))) return `Publicado hoy, ${time}`;
  if (sameDay(date, new Date(now - 24 * HOUR))) return `Publicado ayer, ${time}`;
  return `Publicado el ${date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

function AuctionCardMobile({ auction, status, now, onOpen, pendingQuestions = null }) {
  const vehicle = [auction.marca, auction.modelo, auction.anio].filter(Boolean).join(' ') || 'Vehículo';
  const motor = auction.motor || auction.version;
  const location = [auction.comuna, auction.region].filter(Boolean).join(', ');
  const photo = auction.fotoPrincipalUrl ? resolveMediaUrl(auction.fotoPrincipalUrl) : null;
  const offers = auction.totalCotizaciones || 0;
  const open = status.key !== 'finalizada';

  return (
    <article className={`am-card is-${status.key}`}>
      <div className="am-card-top">
        <div className="am-card-thumb">
          {photo ? <img src={photo} alt={auction.repuestoSolicitado} loading="lazy" /> : <Package size={30} />}
        </div>
        <div className="am-card-body">
          <div className="am-card-head">
            <span className={`am-card-state is-${status.key}`}>{status.label}</span>
            <button type="button" className="am-card-view" onClick={() => onOpen(auction.id)} aria-label="Ver necesidad">
              <Eye size={13} /> Ver necesidad <ChevronRight size={13} />
            </button>
          </div>
          <h3 className="am-card-title">{auction.repuestoSolicitado}</h3>
          <span className="am-card-code">Código: {auctionTrackingCode(auction.id)}</span>
          <div className="am-card-info">
            {open && <p className={`am-card-timeline is-${status.key}`}><Clock size={14} /><span>{formatRemaining(status.remaining)} restantes</span></p>}
            <p><Car size={14} /><span>{vehicle}{motor ? ` · Motor ${motor}` : ''}</span></p>
            {auction.createdAt && <p><CalendarDays size={14} /><span>{formatPublished(auction.createdAt, now)}</span></p>}
            {location && <p><MapPin size={14} /><span>{location}</span></p>}
          </div>
        </div>
      </div>

      <div className="am-card-meta">
        <span><Package size={15} /> {auction.cantidad} {auction.cantidad === 1 ? 'unidad' : 'unidades'}</span>
        <span><Wallet size={15} /> {auction.presupuestoMaximo != null ? `${formatCLP(auction.presupuestoMaximo)} máx.` : 'Sin tope'}</span>
        <span><Tag size={15} /> {offers} {offers === 1 ? 'oferta' : 'ofertas'}</span>
      </div>
      {pendingQuestions != null && pendingSummary(offers, pendingQuestions) && (
        <p className="am-card-pending"><MessageCircle size={14} aria-hidden="true" /> {pendingSummary(offers, pendingQuestions)}</p>
      )}

    </article>
  );
}

/**
 * Listado de necesidades de compra para el celular: idéntico al de la app (banner, búsqueda con íconos de
 * filtros y orden, tarjetas con foto y botón "+" flotante). Los filtros avanzados entran desde la derecha.
 */
export default function AuctionsListMobile({
  rows,
  now,
  loading,
  error,
  onRetry,
  searchQuery,
  onSearchChange,
  activeFiltersCount,
  onOpenFilters,
  sortBy,
  sortOptions,
  onSortChange,
  onResetFilters,
  onCreate,
  canCreate = false,
  onOpenAuction,
  filtersPanel,
  /** "Mural publico (N)" / "Mis necesidades (N)" (null sin sesion de quien publica), como la app. */
  tabs = null,
  tab = 'MURAL',
  onTabChange,
  /** Preguntas sin responder por necesidad, solo en "Mis necesidades". */
  pendingQuestions = null,
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);

  return (
    <main className="am-page am-list">
      <section className="am-banner" aria-label="Necesidades de compra: publica lo que necesitas y recibe ofertas de distintas casas de repuestos">
        <div className="am-banner-text">
          <h1>
            <span>Necesidades</span>
            <span className="is-accent">de compra</span>
          </h1>
          <p>Publica lo que necesitas y recibe ofertas de distintas casas de repuestos.</p>
        </div>
        <span className="am-banner-art" aria-hidden="true" />
      </section>

      <div className="am-search-row">
        <label className="am-search">
          <Search size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => { onSearchChange(event.target.value); setVisibleCount(8); }}
            placeholder="Buscar por repuesto o vehículo..."
            aria-label="Buscar por repuesto o vehículo"
            maxLength={100}
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange('')} aria-label="Limpiar búsqueda"><X size={16} /></button>
          )}
        </label>
        <button
          type="button"
          className={`am-icon-btn ${activeFiltersCount > 0 ? 'is-active' : ''}`}
          onClick={() => { setSortOpen(false); onOpenFilters(); }}
          aria-label="Abrir filtros avanzados"
        >
          <SlidersHorizontal size={22} />
          {activeFiltersCount > 0 && <span className="am-icon-badge">{activeFiltersCount}</span>}
        </button>
        <button
          type="button"
          className={`am-icon-btn ${sortOpen || sortBy !== 'RECIENTES' ? 'is-active' : ''}`}
          onClick={() => setSortOpen((open) => !open)}
          aria-label="Ordenar necesidades"
          aria-expanded={sortOpen}
        >
          <ArrowUpDown size={22} />
        </button>
      </div>

      {tabs && (
        <div className="am-tabs" role="tablist" aria-label="Necesidades de compra">
          {tabs.map((item) => (
            <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} className={tab === item.value ? 'is-active' : ''} onClick={() => { onTabChange?.(item.value); setVisibleCount(8); }}>
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      )}

      {sortOpen && (
        <div className="am-sort-menu" role="menu">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={sortBy === option.value}
              className={sortBy === option.value ? 'is-active' : ''}
              onClick={() => { onSortChange(option.value); setSortOpen(false); }}
            >
              <span>{option.label}</span>
              {sortBy === option.value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <div className="am-empty">
          <Gavel size={32} />
          <h2>No pudimos cargar las necesidades</h2>
          <p>{error}</p>
          <button type="button" className="am-btn" onClick={onRetry}>Reintentar</button>
        </div>
      ) : loading ? (
        <div className="am-list-cards" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="am-card am-card-skeleton" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="am-empty">
          <Gavel size={32} />
          <h2>No hay necesidades de compra en esta sección</h2>
          {canCreate && <p>Publica lo que necesitas para recibir cotizaciones de tiendas verificadas.</p>}
          {activeFiltersCount > 0 && <button type="button" className="am-btn am-btn-outline" onClick={onResetFilters}>Limpiar filtros</button>}
          {canCreate && <button type="button" className="am-btn" onClick={onCreate}>Publicar necesidad de repuesto</button>}
        </div>
      ) : (
        <div className="am-list-cards">
          {rows.slice(0, visibleCount).map(({ auction, status }) => (
            <AuctionCardMobile key={auction.id} auction={auction} status={status} now={now} onOpen={onOpenAuction} pendingQuestions={pendingQuestions ? Number(pendingQuestions[auction.id] || 0) : null} />
          ))}
          {rows.length > visibleCount && (
            <button type="button" className="am-btn am-btn-outline" onClick={() => setVisibleCount((count) => count + 8)}>
              Ver más necesidades ({rows.length - visibleCount})
            </button>
          )}
        </div>
      )}

      {canCreate && (
        <button type="button" className="am-fab" onClick={onCreate} aria-label="Publicar una necesidad de compra">
          <Plus size={26} />
        </button>
      )}

      <div className="aw-page am-filters-host">{filtersPanel}</div>
    </main>
  );
}

