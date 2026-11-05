import React, { useState } from 'react';
import {
  ArrowUpDown, CalendarDays, Car, Check, ChevronRight, Clock, Cog, CreditCard, Eye, Gavel, MapPin, Package, Plus, Search,
  SlidersHorizontal, Store, Tag, Telescope, Wallet, X,
} from 'lucide-react';
import SectionHero, { HeroChip } from './ui/SectionHero';
import { resolveMediaUrl } from '../services/api';
import { pendingSummary } from '../utils/auctionPending';
import { paymentDeadlineInfo } from '../utils/paymentDeadline';
import { useAuth } from '../context/AuthContext';
import { needNews, newOffersCount } from '../utils/trackingNews';
import { useTrackingSeen } from '../hooks/useTrackingSeen';
import TrackingDetail from './tracking/TrackingDetail';
import NeedTrackingDetail from './tracking/NeedTrackingDetail';
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

function AuctionCardMobile({ auction, status, now, onOpen, pendingQuestions = null, tracking = null, showPayment = false }) {
  const toPay = showPayment ? Math.max(0, (auction.ofertasAceptadas || 0) - (auction.ofertasPagadas || 0)) : 0;
  const deadline = toPay > 0 ? paymentDeadlineInfo(auction.pagoPendienteVenceEn, now) : null;
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
            <span className={`am-card-state is-${toPay > 0 ? 'por-pagar' : status.key}`}>{toPay > 0 ? 'Por pagar' : status.label}</span>
            <button type="button" className="am-card-view" onClick={() => onOpen(auction.id, toPay > 0 ? { offers: true } : undefined)} aria-label={toPay > 0 ? 'Ver ofertas y pagar' : 'Ver búsqueda'}>
              <Eye size={13} /> {toPay > 0 ? 'Ver ofertas y pagar' : 'Ver búsqueda'} <ChevronRight size={13} />
            </button>
          </div>
          <h3 className="am-card-title">{auction.repuestoSolicitado}</h3>
          {/* Preview de lo que espera al comprador, como la app: pastilla ámbar con punto bajo el título. */}
          {pendingQuestions != null && pendingSummary(offers, pendingQuestions) && (
            <span className="am-card-pending" aria-label={pendingSummary(offers, pendingQuestions)}>
              <i aria-hidden="true" />{pendingSummary(offers, pendingQuestions)}
            </span>
          )}
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
      {toPay > 0 && (
        <div className={`am-card-pay ${deadline?.expired ? 'is-expired' : ''}`}>
          <CreditCard size={18} aria-hidden="true" />
          <span>
            {toPay === 1 ? 'Tienes 1 oferta aceptada por pagar.' : `Tienes ${toPay} ofertas aceptadas por pagar.`}
            {deadline && <><br />{deadline.text}</>}
          </span>
          <button type="button" onClick={() => onOpen(auction.id, { offers: true })}><CreditCard size={14} aria-hidden="true" /> Pagar</button>
        </div>
      )}
      {tracking && (() => {
        const key = `need:${auction.id}`;
        const seenValue = tracking.seen[key];
        const news = needNews({ totalCotizaciones: offers, preguntasPendientes: pendingQuestions ?? 0 }, seenValue);
        return (
          <div className="am-card-tracking">
            <TrackingDetail news={news} onClose={() => tracking.markSeen(key, news.signature)}>
              <NeedTrackingDetail auctionId={auction.id} newOffers={newOffersCount(offers, seenValue)} onChanged={tracking.onChanged} />
            </TrackingDetail>
          </div>
        );
      })()}

    </article>
  );
}

/**
 * Listado de búsquedas de repuestos para el celular: idéntico al de la app (banner, búsqueda con íconos de
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
  /** La casa de repuestos ve lo que buscan los compradores (no publica): cambia la etiqueta y la bajada del hero. */
  forStores = false,
  /** Dentro de la intranet: sin alto de pantalla completa (la barra inferior y el título ya son de la cuenta). */
  embedded = false,
  onOpenAuction,
  onTrackingChanged,
  filtersPanel,
  /** "Mural publico (N)" / "Mis búsquedas (N)" (null sin sesion de quien publica), como la app. */
  tabs = null,
  tab = 'MURAL',
  onTabChange,
  /** Preguntas sin responder por búsqueda, solo en "Mis búsquedas". */
  pendingQuestions = null,
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);
  const { user } = useAuth();
  const { seen, markSeen } = useTrackingSeen(user?.userId ?? user?.id);
  const mineTab = tab === 'MIS';

  return (
    <main className={`am-page am-list${embedded ? ' is-embedded' : ''}`}>
      <SectionHero
        gradient={['#0B3B91', '#0066ff', '#2E9BFF']}
        eyebrow={{ icon: forStores ? <Telescope /> : <Search />, label: mineTab ? 'SEGUIMIENTO' : forStores ? 'ENCARGOS' : 'ENCARGAR' }}
        title={mineTab ? 'Mis búsquedas' : forStores ? 'Atender encargos' : 'Encargar repuesto'}
        subtitle={mineTab
          ? 'Sigue tus búsquedas y las ofertas que recibiste de las tiendas.'
          : forStores
            ? 'Mira qué repuestos buscan los compradores y envía tu oferta.'
            : 'Publica el repuesto que buscas y recibe ofertas de varias tiendas.'}
        art={(
          <>
            <span className="ak-hero-halo" />
            <span className="ak-hero-disc"><Cog /></span>
            <span className="ak-hero-lens" style={{ color: '#0052cc' }}><Search /></span>
            <HeroChip className="is-top" icon={<Tag />} label="3 ofertas" color="#0052cc" />
            <HeroChip className="is-bottom" icon={<Store />} label="Tiendas" color="#0F766E" />
          </>
        )}
      />

      {tabs && (
        <div className="am-tabs" role="tablist" aria-label="Búsqueda de repuestos">
          {tabs.map((item) => (
            <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} className={tab === item.value ? 'is-active' : ''} onClick={() => { onTabChange?.(item.value); setVisibleCount(8); }}>
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      )}

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
          aria-label="Ordenar búsquedas"
          aria-expanded={sortOpen}
        >
          <ArrowUpDown size={22} />
        </button>
      </div>


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
          <h2>No pudimos cargar las búsquedas</h2>
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
          <h2>No hay búsquedas de repuestos en esta sección</h2>
          {canCreate && <p>Publica lo que necesitas para recibir cotizaciones de tiendas verificadas.</p>}
          {activeFiltersCount > 0 && <button type="button" className="am-btn am-btn-outline" onClick={onResetFilters}>Limpiar filtros</button>}
          {canCreate && <button type="button" className="am-btn" onClick={onCreate}>Publicar búsqueda de repuesto</button>}
        </div>
      ) : (
        <div className="am-list-cards">
          {rows.slice(0, visibleCount).map(({ auction, status }) => (
            <AuctionCardMobile key={auction.id} auction={auction} status={status} now={now} onOpen={onOpenAuction} showPayment={mineTab} pendingQuestions={pendingQuestions ? Number(pendingQuestions[auction.id] || 0) : null} tracking={mineTab && pendingQuestions ? { seen, markSeen, onChanged: onTrackingChanged } : null} />
          ))}
          {rows.length > visibleCount && (
            <button type="button" className="am-btn am-btn-outline" onClick={() => setVisibleCount((count) => count + 8)}>
              Ver más búsquedas ({rows.length - visibleCount})
            </button>
          )}
        </div>
      )}

      {canCreate && (
        <button type="button" className="am-fab" onClick={onCreate} aria-label="Publicar una búsqueda de repuestos">
          <Plus size={26} />
        </button>
      )}

      <div className="aw-page am-filters-host">{filtersPanel}</div>
    </main>
  );
}

