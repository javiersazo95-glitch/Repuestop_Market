import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, ArrowUpDown, CalendarDays, CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Clock, CreditCard,
  FileText, Gavel, LayoutGrid, List, Lock, MapPin, MessageCircle, Package, Plus, RotateCcw, Search,
  SlidersHorizontal, X,
} from 'lucide-react';
import { getAuctionMetrics, getAuctions, getMyAuctionOffers, getMyAuctionRequests, getPendingQuestionCounts } from '../services/auctionApi';
import ProfileAuctionManagementPanel from '../components/ProfileAuctionManagementPanel';
import OfferTrackingMobile from '../components/OfferTrackingMobile';
import { resolveMediaUrl } from '../services/api';
import { paymentDeadlineInfo } from '../utils/paymentDeadline';
import { auctionDetailPath, ROUTES } from '../routes/paths';
import CreateAuctionModal from '../components/CreateAuctionModal';
import { pendingSummary } from '../utils/auctionPending';
import MobileStickyBar from '../components/MobileStickyBar';
import AuctionsListMobile from '../components/AuctionsListMobile';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { FilterSection, CheckRow, countBy } from '../components/ListFilters';
import { useDocumentTitle } from '../routes/useDocumentTitle';
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
  { value: 'TODAS', label: 'Todos los encargos' },
  { value: 'CON_OFERTAS', label: 'Con ofertas' },
  { value: 'SIN_OFERTAS', label: 'Sin ofertas' },
  // Solo en "Mis búsquedas": las que tienen ofertas aceptadas esperando el pago.
  { value: 'POR_PAGAR', label: 'Por pagar' },
];

/** Ofertas aceptadas que aún no se pagan (solo existe para quien publicó la búsqueda). */
const offersToPay = (auction) => Math.max(0, (auction.ofertasAceptadas || 0) - (auction.ofertasPagadas || 0));

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

function AuctionRow({ auction, status, now, onOpen, pendingQuestions = null, showPayment = false }) {
  const toPay = showPayment ? offersToPay(auction) : 0;
  const deadline = toPay > 0 ? paymentDeadlineInfo(auction.pagoPendienteVenceEn, now) : null;
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
          <span><Package size={12} /> {auction.cantidad} {auction.cantidad === 1 ? 'unidad' : 'unidades'}</span>
          {auction.presupuestoMaximo ? <span className="is-budget">Tope {formatCLP(auction.presupuestoMaximo)}</span> : null}
          <span><Lock size={12} /> {offers} {offers === 1 ? 'oferta' : 'ofertas'}</span>
        </div>
        {pendingQuestions != null && pendingSummary(offers, pendingQuestions) && (
          <p className="aw-card-pending"><MessageCircle size={13} aria-hidden="true" /> {pendingSummary(offers, pendingQuestions)}</p>
        )}
        {toPay > 0 && (
          <p className={`aw-card-pay ${deadline?.expired ? 'is-expired' : ''}`}>
            <CreditCard size={13} aria-hidden="true" /> {toPay} {toPay === 1 ? 'tienda aceptada' : 'tiendas aceptadas'} · pago pendiente{deadline ? ` · ${deadline.text}` : ''}
          </p>
        )}
      </div>

      <div className="aw-card-status">
        <span className={`aw-badge is-${toPay > 0 ? 'por-pagar' : status.key}`}>{toPay > 0 ? 'Por pagar' : status.label}</span>
        {status.key !== 'finalizada' && (
          <span className={`aw-remaining is-${status.key}`}><Clock size={16} /> {formatRemaining(status.remaining)}</span>
        )}
      </div>

      <button type="button" className="aw-card-cta" onClick={() => onOpen(auction.id, toPay > 0 ? { offers: true } : undefined)}>
        {toPay > 0 ? 'Ver ofertas y pagar' : 'Ver encargo'} <ArrowRight size={16} />
      </button>
    </article>
  );
}

/**
 * `embedded`: la intranet del celular (`/perfil/subastas`) muestra esta misma vista, empezando en "Mis búsquedas", para que
 * el menú del inicio y la cuenta no se vean distintos. `initialTab`: pestaña con la que abre.
 */
export default function AuctionsPage({ embedded = false, initialTab = 'MURAL' }) {
  useDocumentTitle('Encargar repuesto');
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, role } = useAuth();
  const { openAuthModal } = useMarketplace();
  // Publican el comprador y el taller (el backend lo permite y cada búsqueda suma al premio del servicio Diagnostico);
  // una tienda no, aunque entre al perfil de comprador. Sin sesion el boton se muestra y abre el inicio de sesion.
  const canCreate = !isLoggedIn || role === 'BUYER' || role === 'WORKSHOP';
  const isMobile = useIsMobile();

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const [searchQuery, setSearchQuery] = useState('');
  const [estados, setEstados] = useState(['ACTIVA']);           // mural público: abre con las activas
  const [estadosMine, setEstadosMine] = useState([]);              // Mis encargos: abre con todos los estados
  const [marcas, setMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [regiones, setRegiones] = useState([]);
  const [tiempos, setTiempos] = useState([]);
  const [scope, setScope] = useState('TODAS');
  // "Mural publico" / "Mis búsquedas", como la app (26-oct). Lo propio solo existe para quien publica.
  const canSeeMine = isLoggedIn && (role === 'BUYER' || role === 'WORKSHOP');
  const [tab, setTab] = useState(initialTab);
  const estadosActivos = tab === 'MIS' ? estadosMine : estados;
  const setEstadosActivos = tab === 'MIS' ? setEstadosMine : setEstados;
  // Casa de repuestos: como la app, el mural y «Mis ofertas en curso» (el seguimiento de sus propuestas).
  const isSellerViewer = isLoggedIn && role === 'SELLER';
  const [activeOffersCount, setActiveOffersCount] = useState(0);
  useEffect(() => {
    if (!isSellerViewer) return undefined;
    let active = true;
    getMyAuctionOffers()
      .then((data) => {
        if (!active) return;
        const enCurso = (data?.ofertas || []).filter((item) => ['ENVIADA', 'REVISADA', 'PARCIALMENTE_SUPERADA'].includes(item?.oferta?.estado));
        setActiveOffersCount(enCurso.length);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [isSellerViewer, tab]);
  const [myAuctions, setMyAuctions] = useState([]);
  const [mineLoaded, setMineLoaded] = useState(false);
  const initialTabApplied = useRef(false);
  const [pendingQuestions, setPendingQuestions] = useState({});
  const [sortBy, setSortBy] = useState('RECIENTES');
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);
  const [openSections, setOpenSections] = useState({ estado: true, marca: true, modelo: true, region: true, tiempo: true });
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
      if (!silent) setError('No pudimos conectar con el servidor de encargos de repuestos. Verifica tu conexión o reintenta.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const [metrics, setMetrics] = useState(null);
  const loadMetrics = useCallback(async () => {
    try { setMetrics(await getAuctionMetrics()); } catch { /* sin métricas se muestran los conteos de la lista */ }
  }, []);

  // Las búsquedas propias (de cualquier estado) y las preguntas de las tiendas sin responder en cada una.
  const loadMine = useCallback(async () => {
    if (!canSeeMine) { setMyAuctions([]); setPendingQuestions({}); return; }
    try {
      const [list, pending] = await Promise.all([getMyAuctionRequests(), getPendingQuestionCounts().catch(() => ({}))]);
      setMyAuctions(Array.isArray(list) ? list : []);
      setPendingQuestions(pending && typeof pending === 'object' ? pending : {});
    } catch { /* sin la lista propia, la pestaña queda vacía; el mural sigue */ } finally { setMineLoaded(true); }
  }, [canSeeMine]);

  useEffect(() => { loadAuctions(); loadMetrics(); }, [loadAuctions, loadMetrics]);
  useEffect(() => { loadMine(); }, [loadMine]);
  useEffect(() => { if (!canSeeMine) setTab('MURAL'); }, [canSeeMine]);
  // Una sola vez, al conocer sus búsquedas: quien ya publicó abre en lo suyo (solo si nadie pidió otra pestaña).
  useEffect(() => {
    if (initialTabApplied.current || !canSeeMine || !mineLoaded) return;
    initialTabApplied.current = true;
    if (initialTab === 'MURAL' && myAuctions.length > 0) setTab('MIS');
  }, [canSeeMine, mineLoaded, myAuctions, initialTab]);

  // "Actualizadas en tiempo real": la lista se refresca sola y los cronómetros avanzan cada minuto.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      loadAuctions({ silent: true });
      loadMetrics();
      loadMine();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadAuctions, loadMetrics, loadMine]);

  // "Por pagar" solo existe en Mis búsquedas.
  useEffect(() => { if (tab !== 'MIS' && scope === 'POR_PAGAR') setScope('TODAS'); }, [tab, scope]);
  useEffect(() => { setPage(1); }, [searchQuery, estados, estadosMine, marcas, modelos, regiones, tiempos, scope, sortBy, tab]);
  // Las opciones salen de la pestaña abierta: al cambiar de pestaña se sueltan las marcas, modelos, regiones y tiempos elegidos.
  useEffect(() => { setMarcas([]); setModelos([]); setRegiones([]); setTiempos([]); }, [tab]);

  useEffect(() => {
    document.body.style.overflow = isFiltersOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFiltersOpen]);

  const toggleSection = (id) => setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  const toggleIn = (setter, value, checked) => setter((current) => (
    checked ? [...current, value] : current.filter((item) => item !== value)
  ));

  const rows = useMemo(() => auctions.map((auction) => ({ auction, status: resolveStatus(auction, now) })), [auctions, now]);
  const myRows = useMemo(() => myAuctions.map((auction) => ({ auction, status: resolveStatus(auction, now) })), [myAuctions, now]);

  // Solo se ofrecen opciones que tienen datos en la pestaña abierta (con su conteo); lo ya elegido no desaparece.
  const tabRows = tab === 'MIS' ? myRows : rows;
  const withSelected = (options, selected) => [
    ...options,
    ...selected.filter((value) => !options.some((option) => option.value === value)).map((value) => ({ value, count: 0 })),
  ];
  const brandOptions = useMemo(() => withSelected(countBy(tabRows, ({ auction }) => auction.marca), marcas), [tabRows, marcas]);
  // Modelos: si ya hay marcas elegidas, solo los de esas marcas.
  const modelOptions = useMemo(
    () => withSelected(countBy(tabRows.filter(({ auction }) => marcas.length === 0 || marcas.includes(auction.marca)), ({ auction }) => auction.modelo), modelos),
    [tabRows, marcas, modelos],
  );
  const regionOptions = useMemo(() => withSelected(countBy(tabRows, ({ auction }) => auction.region), regiones), [tabRows, regiones]);
  const estadoOptions = useMemo(() => withSelected(
    ESTADO_OPTIONS.map((option) => ({
      ...option,
      count: tabRows.filter(({ status }) => (option.value === 'ACTIVA' ? status.key === 'activa' || status.key === 'por-finalizar'
        : option.value === 'POR_FINALIZAR' ? status.key === 'por-finalizar' : status.key === 'finalizada')).length,
    })).filter((option) => option.count > 0).map((option) => ({ value: option.value, label: option.label, count: option.count })),
    estadosActivos,
  ).map((option) => ({ ...option, label: option.label || ESTADO_OPTIONS.find((item) => item.value === option.value)?.label })), [tabRows, estadosActivos]);
  const tiempoOptions = useMemo(() => withSelected(
    TIEMPO_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      count: tabRows.filter(({ auction, status }) => matchesTiempo(auction, status, option.value, now)).length,
    })).filter((option) => option.count > 0),
    tiempos,
  ).map((option) => ({ ...option, label: option.label || TIEMPO_OPTIONS.find((item) => item.value === option.value)?.label })), [tabRows, tiempos, now]);

  const { muralMatches, mineMatches } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matches = ({ auction, status }, estadosSel) => {
      if (q) {
        const haystack = `${auction.repuestoSolicitado || ''} ${auction.marca || ''} ${auction.modelo || ''} ${auction.patenteAnonimizada || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (estadosSel.length > 0) {
        const ok = estadosSel.some((estado) => {
          if (estado === 'ACTIVA') return status.key === 'activa' || status.key === 'por-finalizar';
          if (estado === 'POR_FINALIZAR') return status.key === 'por-finalizar';
          return status.key === 'finalizada';
        });
        if (!ok) return false;
      }
      if (marcas.length > 0 && !marcas.includes(auction.marca)) return false;
      if (modelos.length > 0 && !modelos.includes(auction.modelo)) return false;
      if (regiones.length > 0 && !regiones.includes(auction.region)) return false;
      if (tiempos.length > 0 && !tiempos.some((value) => matchesTiempo(auction, status, value, now))) return false;
      return true;
    };
    return {
      muralMatches: rows.filter((row) => matches(row, estados)),
      mineMatches: myRows.filter((row) => matches(row, estadosMine)),
    };
  }, [rows, myRows, searchQuery, estados, estadosMine, marcas, modelos, regiones, tiempos, now]);

  const tabMatches = tab === 'MIS' ? mineMatches : muralMatches;
  const scopeCounts = useMemo(() => ({
    TODAS: tabMatches.length,
    CON_OFERTAS: tabMatches.filter(({ auction }) => auction.totalCotizaciones > 0).length,
    SIN_OFERTAS: tabMatches.filter(({ auction }) => !(auction.totalCotizaciones > 0)).length,
    POR_PAGAR: tabMatches.filter(({ auction }) => offersToPay(auction) > 0).length,
  }), [tabMatches]);

  const filtered = useMemo(() => {
    const list = tabMatches.filter(({ auction }) => {
      if (scope === 'CON_OFERTAS' && !(auction.totalCotizaciones > 0)) return false;
      if (scope === 'SIN_OFERTAS' && auction.totalCotizaciones > 0) return false;
      if (scope === 'POR_PAGAR' && offersToPay(auction) === 0) return false;
      return true;
    });

    const sorters = {
      RECIENTES: (a, b) => new Date(b.auction.createdAt) - new Date(a.auction.createdAt),
      POR_FINALIZAR: (a, b) => new Date(a.auction.fechaLimite) - new Date(b.auction.fechaLimite),
      MAS_OFERTAS: (a, b) => (b.auction.totalCotizaciones || 0) - (a.auction.totalCotizaciones || 0),
    };
    return [...list].sort(sorters[sortBy]);
  }, [tabMatches, scope, sortBy]);
  // Sin búsquedas propias el mural va primero (muestra que hay actividad); con búsquedas, lo propio abre la lista.
  const tabMural = { value: 'MURAL', label: 'Mural público', count: muralMatches.length };
  const tabMine = { value: 'MIS', label: 'Mis encargos', count: mineMatches.length };
  const tabOffers = { value: 'OFERTAS', label: 'Mis ofertas en curso', count: activeOffersCount };
  const tabs = canSeeMine
    ? (myAuctions.length > 0 ? [tabMine, tabMural] : [tabMural, tabMine])
    : isSellerViewer ? [tabMural, tabOffers] : null;

  // Métricas generales de búsquedas de repuestos: no cambian con los filtros del listado.
  const activeCount = metrics?.solicitudesActivas ?? rows.filter(({ status }) => status.key !== 'finalizada').length;
  const newTodayCount = metrics?.registradasHoy ?? rows.filter(({ auction }) => auction.createdAt && sameDay(new Date(auction.createdAt), new Date(now))).length;
  const offersTodayCount = metrics?.ofertasHoy ?? 0;
  const activeFiltersCount = estadosActivos.length + marcas.length + modelos.length + regiones.length + tiempos.length
    + (searchQuery.trim() ? 1 : 0) + (scope !== 'TODAS' ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  const handleResetFilters = () => {
    setSearchQuery('');
    setEstados([]);
    setEstadosMine([]);
    setMarcas([]);
    setModelos([]);
    setRegiones([]);
    setTiempos([]);
    setScope('TODAS');
  };

  // `offers`: abre el detalle con el popup de ofertas (donde se paga lo aceptado).
  const handleOpenAuction = (id, options) => navigate(`${auctionDetailPath(id)}${options?.offers ? '?ofertas=1' : ''}`);

  const handleOpenCreateModal = () => {
    if (!isLoggedIn) {
      // `from`: al iniciar sesion se vuelve a este mural y no al perfil (lo resuelve AppLayout). Antes era un
      // window.confirm, que en un navegador embebido no abre nada y dejaba el boton mudo.
      navigate(`${location.pathname}${location.search}`, { replace: true, state: { from: `${location.pathname}${location.search}` } });
      openAuthModal();
      return;
    }
    setIsCreateModalOpen(true);
  };

  const handleCreatedSuccess = (created) => {
    if (created && created.id) navigate(auctionDetailPath(created.id));
    else loadAuctions();
  };

  const filtersPanel = (
    <>
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

            {brandOptions.length > 0 && (
              <FilterSection id="marca" label="Marca del vehículo" isOpen={openSections.marca} onToggle={toggleSection}>
                {brandOptions.map(({ value, count }) => (
                  <CheckRow key={value} label={value} count={count} checked={marcas.includes(value)} onChange={(checked) => toggleIn(setMarcas, value, checked)} />
                ))}
              </FilterSection>
            )}

            {modelOptions.length > 0 && (
              <FilterSection id="modelo" label="Modelo del vehículo" isOpen={openSections.modelo} onToggle={toggleSection}>
                {modelOptions.map(({ value, count }) => (
                  <CheckRow key={value} label={value} count={count} checked={modelos.includes(value)} onChange={(checked) => toggleIn(setModelos, value, checked)} />
                ))}
              </FilterSection>
            )}

            {regionOptions.length > 0 && (
              <FilterSection id="region" label="Región" isOpen={openSections.region} onToggle={toggleSection}>
                {regionOptions.map(({ value, count }) => (
                  <CheckRow key={value} label={value} count={count} checked={regiones.includes(value)} onChange={(checked) => toggleIn(setRegiones, value, checked)} />
                ))}
              </FilterSection>
            )}

            {tiempoOptions.length > 0 && (
              <FilterSection id="tiempo" label="Tiempo restante" isOpen={openSections.tiempo} onToggle={toggleSection}>
                {tiempoOptions.map(({ value, label, count }) => (
                  <CheckRow key={value} label={label} count={count} checked={tiempos.includes(value)} onChange={(checked) => toggleIn(setTiempos, value, checked)} />
                ))}
              </FilterSection>
            )}

            {estadoOptions.length > 0 && (
              <FilterSection id="estado" label="Estado" isOpen={openSections.estado} onToggle={toggleSection}>
                {estadoOptions.map(({ value, label, count }) => (
                  <CheckRow key={value} label={label} count={count} checked={estadosActivos.includes(value)} onChange={(checked) => toggleIn(setEstadosActivos, value, checked)} />
                ))}
              </FilterSection>
            )}

            <button type="button" className="aw-clear" onClick={handleResetFilters} disabled={activeFiltersCount === 0}>
              <RotateCcw size={15} /> Limpiar filtros
            </button>
            <button type="button" className="aw-filters-apply" onClick={() => setIsFiltersOpen(false)}>
              Ver {filtered.length} {filtered.length === 1 ? 'solicitud' : 'solicitudes'}
            </button>
          </div>
        </aside>
    </>
  );

  // «Mis ofertas en curso»: las mismas pestañas arriba y, debajo, el seguimiento de propuestas (`PropuestasSeguimiento` de la app).
  if (isSellerViewer && tab === 'OFERTAS') {
    const tabStrip = (
      <div className={isMobile ? 'am-tabs' : 'aw-tabs'} role="tablist" aria-label="Encargos de repuestos">
        {tabs.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} className={tab === item.value ? 'is-active' : ''} onClick={() => setTab(item.value)}>
            {item.label} ({nf.format(item.count)})
          </button>
        ))}
      </div>
    );
    // En el celular, la misma pantalla de la app (`PropuestasSeguimiento`); en el computador, el panel de seguimiento.
    const panel = isMobile ? <OfferTrackingMobile /> : <ProfileAuctionManagementPanel embedded />;
    if (embedded || isMobile) return <div className="aw-offers-tab">{tabStrip}{panel}</div>;
    return <main className="aw-page"><div className="container aw-shell">{tabStrip}{panel}</div></main>;
  }

  if (isMobile) {
    return (
      <>
        <AuctionsListMobile
          rows={filtered}
          now={now}
          loading={loading}
          error={error}
          onRetry={() => loadAuctions()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFiltersCount={activeFiltersCount}
          onOpenFilters={() => setIsFiltersOpen(true)}
          sortBy={sortBy}
          sortOptions={SORT_OPTIONS}
          onSortChange={setSortBy}
          onResetFilters={handleResetFilters}
          onCreate={handleOpenCreateModal}
          canCreate={canCreate}
          forStores={!canCreate}
          embedded={embedded}
          onOpenAuction={handleOpenAuction}
          onTrackingChanged={() => { loadMine(); loadAuctions({ silent: true }); }}
          filtersPanel={filtersPanel}
          tabs={tabs}
          tab={tab}
          onTabChange={setTab}
          pendingQuestions={tab === 'MIS' ? pendingQuestions : null}
        />
        <CreateAuctionModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreatedSuccess}
        />
      </>
    );
  }

  return (
    <main className="aw-page">
      <div className="container aw-shell">
        <nav className="aw-breadcrumb" aria-label="Ruta de navegación">
          <Link to={ROUTES.home}>Inicio</Link>
          <span>/</span>
          <span aria-current="page">Encargos de repuestos</span>
        </nav>

        <header className="aw-head">
          <div className="aw-head-text">
            <h1>Encargos de repuestos</h1>
            <p>Encuentra solicitudes de compra y ofrece el repuesto que alguien necesita.</p>
          </div>
          {canCreate && (
            <button type="button" className="aw-btn-publish" onClick={handleOpenCreateModal}>
              <Plus size={18} /> Publicar encargo
            </button>
          )}
        </header>

        <section className="aw-stats" aria-label="Resumen de encargos de repuestos">
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
          {filtersPanel}

          <section className="aw-main">
            {tabs && (
              <div className="aw-tabs" role="tablist" aria-label="Encargos de repuestos">
                {tabs.map((item) => (
                  <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} className={tab === item.value ? 'is-active' : ''} onClick={() => setTab(item.value)}>
                    {item.label} ({nf.format(item.count)})
                  </button>
                ))}
              </div>
            )}
            <div className="aw-scope-chips" role="tablist" aria-label="Tipo de búsqueda">
              {SCOPE_OPTIONS.filter((option) => option.value !== 'POR_PAGAR' || tab === 'MIS').map((option) => (
                <button key={option.value} type="button" role="tab" aria-selected={scope === option.value} className={scope === option.value ? 'is-active' : ''} onClick={() => setScope(option.value)}>
                  {option.label} ({nf.format(scopeCounts[option.value])})
                </button>
              ))}
            </div>
            <div className="aw-toolbar">
              <button type="button" className="aw-toolbar-filters" onClick={() => setIsFiltersOpen(true)}>
                <SlidersHorizontal size={16} /> Filtros{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
              </button>

              <label className="aw-select">
                <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Tipo de búsqueda">
                  {SCOPE_OPTIONS.filter((option) => option.value !== 'POR_PAGAR' || tab === 'MIS').map((option) => <option key={option.value} value={option.value}>{option.label} ({nf.format(scopeCounts[option.value])})</option>)}
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
                <h3>Error al cargar los encargos de repuestos</h3>
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
                <h3>{tab === 'MIS' && myAuctions.length === 0 ? 'Aún no publicas encargos de repuestos' : 'No hay encargos de repuestos con estos filtros'}</h3>
                <p>{tab === 'MIS' && myAuctions.length === 0 ? 'Publica lo que necesitas y aquí verás las ofertas y preguntas de las tiendas.' : 'Prueba cambiando los filtros o publica tú el encargo de repuestos para recibir cotizaciones de tiendas verificadas.'}</p>
                <div className="aw-empty-actions">
                  {activeFiltersCount > 0 && (
                    <button type="button" className="aw-btn-outline" onClick={handleResetFilters}><RotateCcw size={15} /> Limpiar filtros</button>
                  )}
                  {canCreate && <button type="button" className="aw-btn-publish" onClick={handleOpenCreateModal}><Plus size={16} /> Publicar encargo</button>}
                </div>
              </div>
            ) : (
              <>
                <div className={`aw-list ${view === 'grid' ? 'is-grid' : ''}`}>
                  {visible.map(({ auction, status }) => (
                    <AuctionRow key={auction.id} auction={auction} status={status} now={now} onOpen={handleOpenAuction} showPayment={tab === 'MIS'} pendingQuestions={tab === 'MIS' ? Number(pendingQuestions[auction.id] || 0) : null} />
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

      {canCreate && (
        <MobileStickyBar label="Solicitudes activas" value={nf.format(activeCount)} hint="¿Necesitas un repuesto?" ariaLabel="Publicar un encargo">
          <button type="button" className="mobile-sticky-bar__btn" onClick={handleOpenCreateModal}>
            <Plus size={18} /> Publicar encargo
          </button>
        </MobileStickyBar>
      )}

      <CreateAuctionModal
        isOpen={isLoggedIn && isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreatedSuccess}
      />
    </main>
  );
}
