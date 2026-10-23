import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, ArrowUpDown, CalendarDays, CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Clock,
  FileText, Gavel, LayoutGrid, List, Lock, MapPin, Package, Plus, RotateCcw, Search,
  SlidersHorizontal, Tag, X,
} from 'lucide-react';
import { getAuctionMetrics, getAuctions } from '../services/auctionApi';
import { resolveMediaUrl } from '../services/api';
import { auctionDetailPath, ROUTES } from '../routes/paths';
import CreateAuctionModal from '../components/CreateAuctionModal';
import MobileStickyBar from '../components/MobileStickyBar';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { useCategories } from '../data/categories';
import '../styles/auctions-list.css';
import '../styles/auction-mobile.css';

const PAGE_SIZE = 8;
const FETCH_SIZE = 200;
const REFRESH_MS = 60 * 1000;
const HOUR = 60 * 60 * 1000;

const ESTADO_OPTIONS = [
  { value: 'ACTIVA', label: 'Activa' },
  { value: 'POR_FINALIZAR', label: 'Por finalizar' },
  { value: 'FINALIZADA', label: 'Finalizada' },
];

const TIEMPO_OPTIONS = [
  { value: 'LT_1H', label: 'Menos de 1 hora' },
  { value: 'HOY', label: 'Hoy' },
  { value: 'GT_24H', label: 'Más de 24 horas' },
];

const SCOPE_OPTIONS = [
  { value: 'TODAS', label: 'Todas las necesidades' },
  { value: 'CON_OFERTAS', label: 'Con ofertas' },
  { value: 'SIN_OFERTAS', label: 'Sin ofertas' },
];

const SORT_OPTIONS = [
  { value: 'RECIENTES', label: 'Más recientes' },
  { value: 'POR_FINALIZAR', label: 'Próximas a finalizar' },
  { value: 'MAS_OFERTAS', label: 'Más ofertas' },
];

const nf = new Intl.NumberFormat('es-CL');

function formatCLP(value) {
  if (value == null) return '';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

/** Estado visible de la tarjeta, calculado con la hora actual para que el cronómetro no se desfase. */
function resolveStatus(auction, now) {
  const remaining = new Date(auction.fechaLimite).getTime() - now;
  if (auction.estado === 'FINALIZADA') return { key: 'finalizada', label: 'Finalizada', remaining: 0 };
  if (auction.estado === 'CANCELADA') return { key: 'finalizada', label: 'Cancelada', remaining: 0 };
  if (auction.estado === 'EXPIRADA' || remaining <= 0) return { key: 'finalizada', label: 'Expirada', remaining: 0 };
  if (remaining < HOUR) return { key: 'por-finalizar', label: 'Por finalizar', remaining };
  return { key: 'activa', label: 'Activa', remaining };
}

function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} ${days === 1 ? 'día' : 'días'} ${String(hours).padStart(2, '0')} h restantes`;
  return `${String(hours).padStart(2, '0')} h ${String(minutes).padStart(2, '0')} min restantes`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatPublished(iso, now) {
  if (!iso) return '';
  const date = new Date(iso);
  const time = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay(date, new Date(now))) return `Publicada hoy, ${time}`;
  if (sameDay(date, new Date(now - 24 * HOUR))) return `Publicada ayer, ${time}`;
  return `Publicada el ${date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

function matchesTiempo(auction, status, value, now) {
  if (status.key === 'finalizada') return false;
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (value === 'LT_1H') return status.remaining < HOUR;
  if (value === 'HOY') return new Date(auction.fechaLimite).getTime() <= endOfToday.getTime();
  if (value === 'GT_24H') return status.remaining > 24 * HOUR;
  return false;
}

function countBy(rows, pick) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = pick(row);
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'));
}

function buildPageNumbers(current, total) {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
  const sorted = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
    result.push(p);
  });
  return result;
}

function FilterSection({ id, label, isOpen, onToggle, children }) {
  return (
    <div className={`filter-section-group ${isOpen ? 'is-open' : 'is-collapsed'}`}>
      <button className="filter-group-toggle" type="button" onClick={() => onToggle(id)} aria-expanded={isOpen}>
        <span className="filter-group-label">{label}</span>
        <ChevronDown size={16} />
      </button>
      {isOpen && <div className="aw-filter-body">{children}</div>}
    </div>
  );
}

function CheckRow({ checked, onChange, label, count }) {
  return (
    <label className={`aw-check ${checked ? 'is-checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="aw-check-label">{label}</span>
      {count != null && <span className="aw-check-count">{count}</span>}
    </label>
  );
}

function AuctionRow({ auction, status, now, onOpen }) {
  const vehicle = [auction.marca, auction.modelo, auction.anio].filter(Boolean).join(' ');
  const detail = [vehicle, auction.motor].filter(Boolean).join(' · ');
  const location = [auction.comuna, auction.region].filter(Boolean).join(', ');
  const photo = auction.fotoPrincipalUrl ? resolveMediaUrl(auction.fotoPrincipalUrl) : null;
  const offers = auction.totalCotizaciones || 0;

  return (
    <article className={`aw-card is-${status.key}`}>
      <div className="aw-card-thumb">
        {photo ? <img src={photo} alt={auction.repuestoSolicitado} loading="lazy" /> : <Package size={34} />}
      </div>

      <div className="aw-card-main">
        <h3 className="aw-card-title">{auction.repuestoSolicitado}</h3>
        {detail && <p className="aw-card-vehicle">{detail}</p>}
        <div className="aw-card-meta">
          <span><CalendarDays size={14} /> {formatPublished(auction.createdAt, now)}</span>
          {location && <span><MapPin size={14} /> {location}</span>}
        </div>
        <div className="aw-card-chips">
          {auction.categoria ? <span className="is-category"><Tag size={12} /> {auction.categoria}</span> : null}
          <span><Package size={12} /> {auction.cantidad} {auction.cantidad === 1 ? 'unidad' : 'unidades'}</span>
          {auction.presupuestoMaximo ? <span className="is-budget">Tope {formatCLP(auction.presupuestoMaximo)}</span> : null}
          <span><Lock size={12} /> {offers} {offers === 1 ? 'oferta' : 'ofertas'}</span>
        </div>
      </div>

      <div className="aw-card-status">
        <span className={`aw-badge is-${status.key}`}>{status.label}</span>
        {status.key !== 'finalizada' && (
          <span className={`aw-remaining is-${status.key}`}><Clock size={16} /> {formatRemaining(status.remaining)}</span>
        )}
      </div>

      <button type="button" className="aw-card-cta" onClick={() => onOpen(auction.id)}>
        Ver necesidad <ArrowRight size={16} />
      </button>
    </article>
  );
}

export default function AuctionsPage() {
  useDocumentTitle('Necesidades de compra');
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { HEADER_CATEGORIES } = useCategories();

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const [searchQuery, setSearchQuery] = useState('');
  const [estados, setEstados] = useState(['ACTIVA']);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [regiones, setRegiones] = useState([]);
  const [tiempos, setTiempos] = useState([]);
  const [scope, setScope] = useState('TODAS');
  const [sortBy, setSortBy] = useState('RECIENTES');
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);
  const [openSections, setOpenSections] = useState({ categoria: true, estado: true, marca: true, region: true, tiempo: true });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadAuctions = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getAuctions({ estado: 'TODAS', size: FETCH_SIZE });
      setAuctions(data?.content || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error('Error cargando subastas:', err);
      if (!silent) setError('No pudimos conectar con el servidor de necesidades de compra. Verifica tu conexión o reintenta.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const [metrics, setMetrics] = useState(null);
  const loadMetrics = useCallback(async () => {
    try { setMetrics(await getAuctionMetrics()); } catch { /* sin métricas se muestran los conteos de la lista */ }
  }, []);

  useEffect(() => { loadAuctions(); loadMetrics(); }, [loadAuctions, loadMetrics]);

  // "Actualizadas en tiempo real": la lista se refresca sola y los cronómetros avanzan cada minuto.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      loadAuctions({ silent: true });
      loadMetrics();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadAuctions, loadMetrics]);

  useEffect(() => { setPage(1); }, [searchQuery, estados, categorias, marcas, regiones, tiempos, scope, sortBy]);

  useEffect(() => {
    document.body.style.overflow = isFiltersOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFiltersOpen]);

  const toggleSection = (id) => setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  const toggleIn = (setter, value, checked) => setter((current) => (
    checked ? [...current, value] : current.filter((item) => item !== value)
  ));

  const rows = useMemo(() => auctions.map((auction) => ({ auction, status: resolveStatus(auction, now) })), [auctions, now]);

  // Todas las categorías del catálogo (con su conteo, aunque sea 0), más las que traigan subastas antiguas.
  const categoryOptions = useMemo(() => {
    const counts = new Map(countBy(rows, ({ auction }) => auction.categoria).map(({ value, count }) => [value, count]));
    const names = HEADER_CATEGORIES.map((cat) => cat.nombre);
    counts.forEach((_, name) => { if (!names.includes(name)) names.push(name); });
    return names.map((value) => ({ value, count: counts.get(value) || 0 }));
  }, [rows, HEADER_CATEGORIES]);
  const brandOptions = useMemo(() => countBy(rows, ({ auction }) => auction.marca), [rows]);
  const regionOptions = useMemo(() => countBy(rows, ({ auction }) => auction.region), [rows]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = rows.filter(({ auction, status }) => {
      if (q) {
        const haystack = `${auction.repuestoSolicitado || ''} ${auction.marca || ''} ${auction.modelo || ''} ${auction.patenteAnonimizada || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (estados.length > 0) {
        const ok = estados.some((estado) => {
          if (estado === 'ACTIVA') return status.key === 'activa' || status.key === 'por-finalizar';
          if (estado === 'POR_FINALIZAR') return status.key === 'por-finalizar';
          return status.key === 'finalizada';
        });
        if (!ok) return false;
      }
      if (categorias.length > 0 && !categorias.includes(auction.categoria)) return false;
      if (marcas.length > 0 && !marcas.includes(auction.marca)) return false;
      if (regiones.length > 0 && !regiones.includes(auction.region)) return false;
      if (tiempos.length > 0 && !tiempos.some((value) => matchesTiempo(auction, status, value, now))) return false;
      if (scope === 'CON_OFERTAS' && !(auction.totalCotizaciones > 0)) return false;
      if (scope === 'SIN_OFERTAS' && auction.totalCotizaciones > 0) return false;
      return true;
    });

    const sorters = {
      RECIENTES: (a, b) => new Date(b.auction.createdAt) - new Date(a.auction.createdAt),
      POR_FINALIZAR: (a, b) => new Date(a.auction.fechaLimite) - new Date(b.auction.fechaLimite),
      MAS_OFERTAS: (a, b) => (b.auction.totalCotizaciones || 0) - (a.auction.totalCotizaciones || 0),
    };
    return [...list].sort(sorters[sortBy]);
  }, [rows, searchQuery, estados, categorias, marcas, regiones, tiempos, scope, sortBy, now]);

  // Métricas generales de necesidades de compra: no cambian con los filtros del listado.
  const activeCount = metrics?.solicitudesActivas ?? rows.filter(({ status }) => status.key !== 'finalizada').length;
  const newTodayCount = metrics?.registradasHoy ?? rows.filter(({ auction }) => auction.createdAt && sameDay(new Date(auction.createdAt), new Date(now))).length;
  const offersTodayCount = metrics?.ofertasHoy ?? 0;
  const activeFiltersCount = estados.length + categorias.length + marcas.length + regiones.length + tiempos.length
    + (searchQuery.trim() ? 1 : 0) + (scope !== 'TODAS' ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  const handleResetFilters = () => {
    setSearchQuery('');
    setEstados([]);
    setCategorias([]);
    setMarcas([]);
    setRegiones([]);
    setTiempos([]);
    setScope('TODAS');
  };

  const handleOpenAuction = (id) => navigate(auctionDetailPath(id));

  const handleOpenCreateModal = () => {
    if (!isLoggedIn) {
      const shouldLogin = window.confirm('Debes iniciar sesión para publicar una necesidad de compra. ¿Deseas ir a tu cuenta?');
      if (shouldLogin) navigate(ROUTES.profile);
      return;
    }
    setIsCreateModalOpen(true);
  };

  const handleCreatedSuccess = (created) => {
    if (created && created.id) navigate(auctionDetailPath(created.id));
    else loadAuctions();
  };

  return (
    <main className="aw-page">
      <div className="container aw-shell">
        <nav className="aw-breadcrumb" aria-label="Ruta de navegación">
          <Link to={ROUTES.home}>Inicio</Link>
          <span>/</span>
          <span aria-current="page">Necesidades de compra</span>
        </nav>

        <header className="aw-head">
          <div className="aw-head-text">
            <h1>Necesidades de compra</h1>
            <p>Encuentra solicitudes de compra y ofrece el repuesto que alguien necesita.</p>
          </div>
          <button type="button" className="aw-btn-publish" onClick={handleOpenCreateModal}>
            <Plus size={18} /> Publicar necesidad
          </button>
        </header>

        <section className="aw-stats" aria-label="Resumen de necesidades de compra">
          <div className="aw-stat">
            <span className="aw-stat-icon is-solid"><FileText size={17} /></span>
            <span><strong>{nf.format(activeCount)}</strong><small>solicitudes activas</small></span>
          </div>
          <div className="aw-stat">
            <span className="aw-stat-icon is-solid"><CalendarPlus size={17} /></span>
            <span><strong>{nf.format(newTodayCount)}</strong><small>registradas hoy</small></span>
          </div>
          <div className="aw-stat">
            <span className="aw-stat-icon is-solid"><Gavel size={17} /></span>
            <span><strong>{nf.format(offersTodayCount)}</strong><small>ofertas registradas hoy</small></span>
          </div>
        </section>

        <div className="aw-layout">
          {isFiltersOpen && (
            <button type="button" className="aw-backdrop" aria-label="Cerrar filtros" onClick={() => setIsFiltersOpen(false)} />
          )}

          <aside className={`aw-sidebar ${isFiltersOpen ? 'is-open' : ''}`} aria-label="Filtrar solicitudes">
            <div className="catalog-sidebar-filters catalog-advanced-filter-panel aw-filters">
              <button type="button" className="aw-filters-close" onClick={() => setIsFiltersOpen(false)}>
                <X size={19} /> Cerrar filtros
              </button>
              <div className="sidebar-filters-header">
                <div className="sidebar-title-group">
                  <SlidersHorizontal size={22} />
                  <span><strong>Filtrar solicitudes</strong></span>
                </div>
              </div>

              <div className="aw-search">
                <Search size={17} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar repuesto..."
                  aria-label="Buscar repuesto"
                  maxLength={100}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>
                )}
              </div>

              {categoryOptions.length > 0 && (
                <FilterSection id="categoria" label="Categoría" isOpen={openSections.categoria} onToggle={toggleSection}>
                  {categoryOptions.map(({ value, count }) => (
                    <CheckRow
                      key={value}
                      label={value}
                      count={count}
                      checked={categorias.includes(value)}
                      onChange={(checked) => toggleIn(setCategorias, value, checked)}
                    />
                  ))}
                </FilterSection>
              )}

              <FilterSection id="estado" label="Estado" isOpen={openSections.estado} onToggle={toggleSection}>
                {ESTADO_OPTIONS.map((option) => (
                  <CheckRow
                    key={option.value}
                    label={option.label}
                    checked={estados.includes(option.value)}
                    onChange={(checked) => toggleIn(setEstados, option.value, checked)}
                  />
                ))}
              </FilterSection>

              {brandOptions.length > 0 && (
                <FilterSection id="marca" label="Marca del vehículo" isOpen={openSections.marca} onToggle={toggleSection}>
                  {brandOptions.map(({ value, count }) => (
                    <CheckRow
                      key={value}
                      label={value}
                      count={count}
                      checked={marcas.includes(value)}
                      onChange={(checked) => toggleIn(setMarcas, value, checked)}
                    />
                  ))}
                </FilterSection>
              )}

              {regionOptions.length > 0 && (
                <FilterSection id="region" label="Región" isOpen={openSections.region} onToggle={toggleSection}>
                  {regionOptions.map(({ value, count }) => (
                    <CheckRow
                      key={value}
                      label={value}
                      count={count}
                      checked={regiones.includes(value)}
                      onChange={(checked) => toggleIn(setRegiones, value, checked)}
                    />
                  ))}
                </FilterSection>
              )}

              <FilterSection id="tiempo" label="Tiempo restante" isOpen={openSections.tiempo} onToggle={toggleSection}>
                {TIEMPO_OPTIONS.map((option) => (
                  <CheckRow
                    key={option.value}
                    label={option.label}
                    checked={tiempos.includes(option.value)}
                    onChange={(checked) => toggleIn(setTiempos, option.value, checked)}
                  />
                ))}
              </FilterSection>

              <button type="button" className="aw-clear" onClick={handleResetFilters} disabled={activeFiltersCount === 0}>
                <RotateCcw size={15} /> Limpiar filtros
              </button>
              <button type="button" className="aw-filters-apply" onClick={() => setIsFiltersOpen(false)}>
                Ver {filtered.length} {filtered.length === 1 ? 'solicitud' : 'solicitudes'}
              </button>
            </div>
          </aside>

          <section className="aw-main">
            <div className="aw-scope-chips" role="tablist" aria-label="Tipo de necesidad">
              {SCOPE_OPTIONS.map((option) => (
                <button key={option.value} type="button" role="tab" aria-selected={scope === option.value} className={scope === option.value ? 'is-active' : ''} onClick={() => setScope(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="aw-toolbar">
              <button type="button" className="aw-toolbar-filters" onClick={() => setIsFiltersOpen(true)}>
                <SlidersHorizontal size={16} /> Filtros{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
              </button>

              <label className="aw-select">
                <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Tipo de necesidad">
                  {SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <ChevronDown size={16} />
              </label>

              <span className="aw-count">
                <strong>{nf.format(filtered.length)}</strong> {filtered.length === 1 ? 'resultado' : 'resultados'}
              </span>

              <label className="aw-select aw-select-sort">
                <ArrowUpDown size={15} />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Ordenar por">
                  {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <ChevronDown size={16} />
              </label>

              <div className="aw-view-toggle" role="group" aria-label="Tipo de vista">
                <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Vista de lista" aria-pressed={view === 'list'}>
                  <List size={18} />
                </button>
                <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Vista de cuadrícula" aria-pressed={view === 'grid'}>
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>

            {error ? (
              <div className="aw-empty">
                <div className="aw-empty-icon is-error"><AlertCircle size={30} /></div>
                <h3>Error al cargar las necesidades de compra</h3>
                <p>{error}</p>
                <button type="button" className="aw-btn-publish" onClick={() => loadAuctions()}>Reintentar</button>
              </div>
            ) : loading ? (
              <div className={`aw-list ${view === 'grid' ? 'is-grid' : ''}`} aria-busy="true">
                {[0, 1, 2, 3].map((i) => <div key={i} className="aw-card aw-card-skeleton" />)}
              </div>
            ) : visible.length === 0 ? (
              <div className="aw-empty">
                <div className="aw-empty-icon"><Gavel size={30} /></div>
                <h3>No hay necesidades de compra con estos filtros</h3>
                <p>Prueba cambiando los filtros o publica tú la necesidad de compra para recibir cotizaciones de tiendas verificadas.</p>
                <div className="aw-empty-actions">
                  {activeFiltersCount > 0 && (
                    <button type="button" className="aw-btn-outline" onClick={handleResetFilters}><RotateCcw size={15} /> Limpiar filtros</button>
                  )}
                  <button type="button" className="aw-btn-publish" onClick={handleOpenCreateModal}><Plus size={16} /> Publicar necesidad</button>
                </div>
              </div>
            ) : (
              <>
                <div className={`aw-list ${view === 'grid' ? 'is-grid' : ''}`}>
                  {visible.map(({ auction, status }) => (
                    <AuctionRow key={auction.id} auction={auction} status={status} now={now} onOpen={handleOpenAuction} />
                  ))}
                </div>

                <div className="aw-pagination">
                  <span className="aw-pagination-info">
                    Mostrando {start + 1}–{start + visible.length} de {nf.format(filtered.length)} solicitudes
                  </span>
                  {totalPages > 1 && (
                    <nav className="aw-pages" aria-label="Paginación">
                      <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Página anterior"><ChevronLeft size={16} /></button>
                      {pageNumbers.map((item, index) => (
                        item === '…'
                          ? <span key={`gap-${index}`} className="aw-pages-gap">…</span>
                          : (
                            <button
                              key={item}
                              type="button"
                              className={item === currentPage ? 'active' : ''}
                              aria-current={item === currentPage ? 'page' : undefined}
                              onClick={() => setPage(item)}
                            >
                              {item}
                            </button>
                          )
                      ))}
                      <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Página siguiente"><ChevronRight size={16} /></button>
                    </nav>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <MobileStickyBar label="Solicitudes activas" value={nf.format(activeCount)} hint="¿Necesitas un repuesto?" ariaLabel="Publicar una necesidad">
        <button type="button" className="mobile-sticky-bar__btn" onClick={handleOpenCreateModal}>
          <Plus size={18} /> Publicar necesidad
        </button>
      </MobileStickyBar>

      <CreateAuctionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreatedSuccess}
      />
    </main>
  );
}
