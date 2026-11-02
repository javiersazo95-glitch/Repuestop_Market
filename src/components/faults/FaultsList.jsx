import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, Bookmark, CalendarDays, Camera, Car, ChevronRight, FileText, Filter, Loader2,
  ArrowUpDown, ClipboardList, Stethoscope, CheckCircle2, MapPin, MessageCircle, Plus, RotateCcw, Search, Settings, SlidersHorizontal, Truck, Wrench, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCommentedFaults, getMyFaults, getOpenFaults, timeSince } from '../../services/faultApi';
import { faultDetailPath } from '../../routes/paths';
import { resolveMediaUrl } from '../../services/api';
import { SERVICE_CATEGORIES } from '../../data/talleresData';
import CreateFaultModal from './CreateFaultModal';
import FaultsHero from './FaultsHero';
import TrackingDetail from '../tracking/TrackingDetail';
import FallaTrackingDetail, { DiagnosticoTrackingDetail } from '../tracking/FallaTrackingDetail';
import { fallaNews, newOffersCount } from '../../utils/trackingNews';
import { useTrackingSeen } from '../../hooks/useTrackingSeen';
import { useIsMobile } from '../../hooks/useIsMobile';
import usePagedList from '../../hooks/usePagedList';
import ListPager from '../ListPager';
import { MAX_SEARCH_LENGTH } from '../../utils/inputLimits';
import '../../styles/faults.css';
import '../../styles/profile-auctions.css';

const FAULT_TYPES = [
  ['Motor', /motor|arranque|humo|aceite|temperatura/i, 'motor'],
  ['Transmisión', /transmisi|cambio|embrague/i, 'transmission'],
  ['Sistema eléctrico', /el[eé]ctric|bater[ií]a|alternador|check|luz/i, 'electric'],
  ['Frenos', /freno|abs|pedal/i, 'brakes'],
  ['Dirección', /direcci[oó]n|volante/i, 'steering'],
  ['Suspensión', /suspensi[oó]n|amortigu|bache/i, 'suspension'],
  ['Aire acondicionado', /aire|climat|a\/c/i, 'air'],
  ['Otros', /.*/i, 'other'],
];

const normalizeComuna = (comuna) => String(comuna || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
// "Metropolitana" (perfil) calza con "Region Metropolitana de Santiago" (catalogo de las fallas nuevas).
const sameRegion = (a, b) => {
  const left = normalizeComuna(a);
  const right = normalizeComuna(b);
  return Boolean(left && right) && (left === right || left.includes(right) || right.includes(left));
};

const textOf = (fault) => [
  fault.titulo, fault.descripcion, fault.antesDelFallo, fault.marca, fault.modelo,
  fault.vehiculo, fault.comuna, fault.region, ...(fault.sintomas || []),
].filter(Boolean).join(' ');

function faultTypeOf(fault) {
  const selected = SERVICE_CATEGORIES.find((category) => category.id === fault.categoria && category.id !== 'TODAS');
  if (selected) return { label: selected.label, key: 'category' };
  const text = textOf(fault);
  const match = FAULT_TYPES.find(([, pattern]) => pattern.test(text)) || FAULT_TYPES.at(-1);
  return { label: match[0], key: match[2] };
}

// El backend manda `diagnosticos` como cantidad (numero); las otras formas son de respuestas antiguas.
const diagnosisCountOf = (fault) => Number(
  fault.cantidadDiagnosticos ?? fault.totalDiagnosticos ?? fault.diagnosticosCount
    ?? (Array.isArray(fault.diagnosticos) ? fault.diagnosticos.length : fault.diagnosticos) ?? 0,
) || 0;

/** Tarjeta de la falla en el celular: la de la app (vehículo, la falla, contexto y diagnósticos, separados por líneas). */
function FaultCardMobile({ fault, showStatus, showClient, fromMural, isSaved, onToggleSaved, vehicle, vehicleData, place, type, diagnosisCount, coverPhoto, tracking }) {
  const symptoms = (fault.sintomas || []).slice(0, 3);
  return (
    <article className="ftm-card">
      {onToggleSaved && (
        <button type="button" className={`ftm-save ${isSaved ? 'is-saved' : ''}`} aria-pressed={isSaved} aria-label={isSaved ? 'Quitar falla de favoritos' : 'Guardar falla en favoritos'} onClick={() => onToggleSaved(fault)}>
          <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      )}
      <Link to={faultDetailPath(fault)} state={{ fromMural }} className="ftm-press" aria-label={`Ver detalle de ${vehicle}`}>
        <div className="ftm-vehicle">
          <span className={`ftm-thumb ${coverPhoto ? '' : 'is-empty'}`}>
            {coverPhoto ? <img src={resolveMediaUrl(coverPhoto)} alt="" loading="lazy" /> : <Car size={28} />}
          </span>
          <div className="ftm-vehicle-body">
            <div className="ftm-chips">
              {fault.propia && <span className="ftm-chip is-primary">Mi falla</span>}
              {showStatus && <span className={`ftm-chip ${fault.vigente ? 'is-ok' : ''}`}>{fault.vigente ? 'Abierta' : 'Cerrada'}</span>}
              {!showStatus && <span className={`ftm-chip ${diagnosisCount > 0 ? 'is-ok' : 'is-warn'}`}>{diagnosisCount > 0 ? 'Con diagnóstico' : 'Pendiente'}</span>}
            </div>
            {fault.requiereRecogida && <span className="ftm-chip is-warn"><Truck size={12} aria-hidden="true" /> {showClient ? 'Hay que ir a buscar el vehículo' : 'Piden recogida del vehículo'}</span>}
            <strong>{vehicle}</strong>
            {vehicleData.length > 0 && <span className="ftm-data">{vehicleData.join(' • ')}</span>}
          </div>
        </div>
        <hr />
        <div className="ftm-block">
          <p>{fault.titulo || 'Sin título'}</p>
          <div className="ftm-chips">
            <span className="ftm-chip is-primary"><Wrench size={12} aria-hidden="true" /> {type.label}</span>
            {fault.subcategoria && <span className="ftm-chip is-primary">{fault.subcategoria}</span>}
            {fault.seMueve === false && <span className="ftm-chip is-error">No se mueve</span>}
            {symptoms.map((symptom) => <span key={symptom} className="ftm-chip is-primary">{symptom}</span>)}
          </div>
        </div>
        <hr />
        <div className="ftm-meta">
          {showClient && !fault.propia && <span>{fault.clienteNombre || 'Cliente'}</span>}
          <span><CalendarDays size={12} /> {timeSince(fault.createdAt)}</span>
          {place && <span><MapPin size={12} /> {place}</span>}
        </div>
        <div className="ftm-footer">
          <span className="ftm-diag"><MessageCircle size={12} /> {diagnosisCount === 0 ? 'Sin diagnósticos aún' : `${diagnosisCount} ${diagnosisCount === 1 ? 'taller diagnosticó' : 'talleres diagnosticaron'}`}</span>
          {showClient
            ? <span className={`ftm-action ${diagnosisCount === 0 ? 'is-primary' : ''}`}>{diagnosisCount === 0 ? 'Diagnosticar' : 'Ver detalle'}</span>
            : <ChevronRight size={20} className="ftm-chev" />}
        </div>
      </Link>
      {tracking && (() => {
        // Taller: su historial siempre se puede abrir (lo que dejó en la falla y lo que respondió el cliente).
        if (tracking.workshopUserId != null) {
          const key = `diag:${fault.id}`;
          const news = { hasNews: false, hasRecords: true, summary: '', history: 'Lo que dejaste en esta falla', signature: tracking.seen[key] ?? '' };
          return (
            <div className="ftm-tracking">
              <TrackingDetail news={news}>
                <DiagnosticoTrackingDetail faultId={fault.id} myUserId={tracking.workshopUserId} />
              </TrackingDetail>
            </div>
          );
        }
        const key = `falla:${fault.id}`;
        const seenValue = tracking.seen[key];
        const news = fallaNews({ diagnosticos: diagnosisCount, preguntasPendientes: fault.preguntasPendientes }, seenValue);
        return (
          <div className="ftm-tracking">
            <TrackingDetail news={news} onClose={() => tracking.markSeen(key, news.signature)}>
              <FallaTrackingDetail faultId={fault.id} vigente={fault.vigente !== false} newDiagnoses={newOffersCount(diagnosisCount, seenValue)} onChanged={tracking.onChanged} />
            </TrackingDetail>
          </div>
        );
      })()}
    </article>
  );
}

/** Tarjeta de una falla del mural. Tambien la usa Favoritos, con `onToggleSaved` para quitarla de los guardados. */
export function FaultCard({ fault, showStatus, showClient, fromMural, isSaved = false, onToggleSaved, tracking = null }) {
  const place = [fault.comuna, fault.region].filter(Boolean).join(', ');
  const vehicle = [fault.marca, fault.modelo].filter(Boolean).join(' ') || fault.vehiculo;
  const vehicleData = [fault.anio, fault.motor || fault.combustible].filter(Boolean);
  const description = fault.descripcion || fault.quePaso || fault.descripcionGeneral || fault.antesDelFallo || fault.titulo || 'El usuario no agregó detalles sobre lo ocurrido.';
  const type = faultTypeOf(fault);
  const previewPhotos = [fault.fotoVehiculo || fault.fotoUrl, ...(fault.fotos || [])].filter(Boolean).filter((photo, index, list) => list.indexOf(photo) === index);
  const backendPhotoCount = Number(fault.cantidadFotos);
  const photoCount = Math.max(previewPhotos.length, Number.isFinite(backendPhotoCount) ? backendPhotoCount : 0);
  const coverPhoto = previewPhotos[0];
  const diagnosisCount = diagnosisCountOf(fault);
  const isMobile = useIsMobile();
  const mobility = fault.seMueve === true ? 'Sí, se puede mover' : fault.seMueve === false ? 'No se puede mover' : 'No informado';

  if (isMobile) {
    return <FaultCardMobile {...{ fault, showStatus, showClient, fromMural, isSaved, onToggleSaved, vehicle, vehicleData, place, type, diagnosisCount, coverPhoto, tracking }} />;
  }

  return (
    <article className="ft-fault-card">
      <div className="ft-fault-media">
        {coverPhoto
          ? <img src={resolveMediaUrl(coverPhoto)} alt={vehicle} loading="lazy" />
          : <span aria-hidden="true"><Car size={44} /></span>}
        {photoCount > 0 && <span className="ft-photo-count"><Camera size={14} /> {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}</span>}
      </div>

      <div className="ft-fault-summary">
        <div className="ft-card-badges">
          {fault.propia && <span className="ft-badge is-mine">Mi falla</span>}
          {fault.requiereRecogida && <span className="ft-badge is-pickup"><Truck size={13} aria-hidden="true" /> {showClient ? 'Hay que ir a buscar el vehículo' : 'Piden recogida del vehículo'}</span>}
          {showStatus && <span className={`ft-badge ${fault.vigente ? '' : 'is-closed'}`}>{fault.vigente ? 'Abierta' : 'Cerrada'}</span>}
          {fault.subcategoria && <span className="ft-badge">{fault.subcategoria}</span>}
        </div>
        <h3>{vehicle}</h3>
        {vehicleData.length > 0 && <p className="ft-vehicle-data">{vehicleData.map((item) => <span key={item}>{item}</span>)}</p>}
        <div className="ft-fault-what"><strong>¿Qué pasó?</strong><p className="ft-fault-description">{description}</p></div>
        <div className="ft-fault-meta">
          {place && <span><MapPin size={15} /> {place}</span>}
          <span><CalendarDays size={15} /> {timeSince(fault.createdAt)}</span>
          {showClient && !fault.propia && <span>{fault.clienteNombre || 'Cliente'}</span>}
        </div>
      </div>

      <div className="ft-fault-detail">
        <span className={`ft-type-pill is-${type.key}`}><Wrench size={15} /> {type.label}</span>
        <dl>
          <div><dt><Settings size={14} /> Tipo de falla</dt><dd>{fault.sintomas?.[0] || type.label}</dd></div>
          <div><dt><FileText size={14} /> Título del anuncio</dt><dd>{fault.titulo || 'Sin título'}</dd></div>
          <div><dt><Car size={14} /> Movilidad</dt><dd>{mobility}</dd></div>
          {fault.requiereRecogida && <div><dt><Truck size={14} /> Recogida</dt><dd>El cliente necesita que vayan por el vehículo</dd></div>}
          <div><dt><MessageCircle size={14} /> Diagnósticos</dt><dd>{diagnosisCount === 0 ? 'Sin diagnósticos aún' : `${diagnosisCount} ${diagnosisCount === 1 ? 'taller diagnosticó' : 'talleres diagnosticaron'}`}</dd></div>
        </dl>
        <Link to={faultDetailPath(fault)} state={{ fromMural }} className="ft-btn ft-btn-primary ft-detail-button" aria-label={`Ver detalle de ${vehicle}`}>
          Ver detalle <ChevronRight size={16} />
        </Link>
        {onToggleSaved && (
          <button type="button" className={`ft-btn ft-btn-outline ${isSaved ? 'is-saved' : ''}`} aria-pressed={isSaved} onClick={() => onToggleSaved(fault)}>
            <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? 'Guardada' : 'Guardar'}
          </button>
        )}
      </div>
    </article>
  );
}

export default function FaultsList({ heading = true, onMetricsChange }) {
  const { role, isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const isWorkshop = role === 'WORKSHOP';
  // Intranet del celular: solo el seguimiento de lo propio (Mis fallas / Mis diagnósticos), con el banner de la app; el mural
  // público vive en /fallas.
  const isMobile = useIsMobile();
  // Intranet (sin encabezado): siempre solo lo propio, en celular y en escritorio.
  const mineOnly = !heading && isMobile;
  const intranet = !heading;
  const { seen, markSeen } = useTrackingSeen(user?.userId ?? user?.id);
  const [view, setView] = useState(intranet ? (isWorkshop ? 'COMMENTED' : 'MINE') : 'OPEN');
  const [lists, setLists] = useState({ OPEN: [], MINE: [], COMMENTED: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [locationMode, setLocationMode] = useState('all');
  const [place, setPlace] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [sort, setSort] = useState('recent');
  // Intranet de escritorio: filtro rápido por estado, como en Búsqueda de repuestos.
  const [statusFilter, setStatusFilter] = useState('all');
  // Taller: ranura para ver solo las fallas de su comuna (sin tildes ni mayúsculas, "Ñuñoa" = "NUNOA").
  const [onlyMyComuna, setOnlyMyComuna] = useState(false);
  const myComuna = isWorkshop ? user?.comuna || '' : '';
  // Celular: los filtros entran como panel lateral derecho (como en Búsqueda de repuestos).
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const open = intranet ? [] : await getOpenFaults();
      let other = [];
      if (isLoggedIn) other = await (isWorkshop ? getCommentedFaults() : getMyFaults());
      setLists({ OPEN: Array.isArray(open) ? open : [], [isWorkshop ? 'COMMENTED' : 'MINE']: Array.isArray(other) ? other : [] });
    } catch (err) {
      setError(err?.message || 'No pudimos cargar las fallas.');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, isWorkshop, intranet]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!isLoggedIn && !intranet) setView('OPEN'); }, [isLoggedIn, intranet]);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchText.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const source = useMemo(() => lists[view] || [], [lists, view]);
  const brands = useMemo(() => [...new Set(source.map((fault) => fault.marca).filter(Boolean))].sort(), [source]);
  const models = useMemo(() => [...new Set(source.filter((fault) => !brand || fault.marca === brand).map((fault) => fault.modelo).filter(Boolean))].sort(), [source, brand]);
  const regions = useMemo(() => [...new Set(source.map((fault) => fault.region).filter(Boolean))].sort(), [source]);
  const communes = useMemo(() => [...new Set(source.map((fault) => fault.comuna).filter(Boolean))].sort(), [source]);
  const years = useMemo(() => [...new Set(source.map((fault) => Number(fault.anio)).filter(Boolean))].sort((a, b) => b - a), [source]);
  const placeOptions = locationMode === 'region' ? regions : communes;
  const userComuna = user?.comuna || '';
  const userRegion = user?.region || '';

  const items = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    return source.filter((fault) => (!needle || textOf(fault).toLocaleLowerCase('es').includes(needle))
      && (!brand || fault.marca === brand)
      && (!model || fault.modelo === model)
      && (!yearFrom || Number(fault.anio) >= Number(yearFrom))
      && (!yearTo || Number(fault.anio) <= Number(yearTo))
      && (locationMode !== 'mine' || !userComuna || normalizeComuna(fault.comuna) === normalizeComuna(userComuna))
      && (locationMode !== 'region' || !(place || userRegion) || sameRegion(fault.region, place || userRegion))
      && (locationMode !== 'all' || !place || normalizeComuna(fault.comuna) === normalizeComuna(place))
      && (selectedTypes.length === 0 || selectedTypes.includes(fault.categoria))
      && (statusFilter === 'all'
        || (statusFilter === 'open' && fault.vigente !== false)
        || (statusFilter === 'closed' && fault.vigente === false)
        || (statusFilter === 'diagnosed' && diagnosisCountOf(fault) > 0)
        || (statusFilter === 'pending' && diagnosisCountOf(fault) === 0))
      && (!onlyMyComuna || !myComuna || normalizeComuna(fault.comuna) === normalizeComuna(myComuna)))
      .sort((a, b) => sort === 'oldest'
        ? new Date(a.createdAt) - new Date(b.createdAt)
        : new Date(b.createdAt) - new Date(a.createdAt));
  }, [source, query, brand, model, yearFrom, yearTo, locationMode, place, selectedTypes, sort, userComuna, userRegion, onlyMyComuna, myComuna, statusFilter]);

  // El mural público va de a 12 (como las búsquedas de repuestos); mis fallas y las comentadas, de a 10.
  const { pageItems, pagerProps } = usePagedList(
    items,
    JSON.stringify([view, query, brand, model, yearFrom, yearTo, locationMode, place, selectedTypes, sort, onlyMyComuna, statusFilter]),
    view === 'OPEN' ? 12 : 10
  );

  useEffect(() => {
    if (!onMetricsChange) return;
    onMetricsChange({
      loading,
      failed: Boolean(error),
      faults: items.length,
      withoutDiagnosis: items.filter((fault) => diagnosisCountOf(fault) === 0).length,
      immobilized: items.filter((fault) => fault.seMueve === false).length,
    });
  }, [items, loading, error, onMetricsChange]);

  const toggleType = (type) => setSelectedTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  const clearFilters = () => {
    setSearchText(''); setQuery(''); setLocationMode('all'); setPlace(''); setBrand('');
    setModel(''); setYearFrom(''); setYearTo(''); setSelectedTypes([]); setOnlyMyComuna(false);
  };
  const myComunaToggle = myComuna ? (
    <button type="button" aria-pressed={onlyMyComuna} className={`ft-tab ${onlyMyComuna ? 'is-active' : ''}`} onClick={() => setOnlyMyComuna((current) => !current)}>
      <MapPin size={14} aria-hidden="true" /> Solo mi comuna ({myComuna})
    </button>
  ) : null;
  // Con filtros puestos se sugiere limpiarlos; sin filtros simplemente aun no hay fallas abiertas.
  const hasFilters = Boolean(searchText.trim() || query || locationMode !== 'all' || place || brand || model || yearFrom || yearTo || selectedTypes.length || onlyMyComuna);
  const empty = view === 'OPEN'
    ? (hasFilters
      ? ['No encontramos fallas', 'Prueba cambiando o limpiando los filtros de búsqueda.']
      : ['Aún no hay fallas abiertas', isWorkshop ? 'Cuando un cliente registre una falla, la verás aquí para dejar tu diagnóstico.' : 'Cuando alguien registre una falla, aparecerá aquí.'])
    : view === 'COMMENTED'
      ? ['Aún no dejas diagnósticos', 'Comenta una falla abierta para que el cliente conozca tu taller.']
      : ['No has registrado fallas', 'Cuéntanos qué le pasó a tu vehículo y los talleres te enviarán su diagnóstico.'];

  const results = loading ? <div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando fallas…</div>
    : error ? <div className="ft-empty" role="alert"><AlertCircle size={20} /><strong>No pudimos cargar las fallas</strong>{error}<br /><button type="button" className="ft-btn ft-btn-outline" onClick={load}>Reintentar</button></div>
      : items.length === 0 ? <div className="ft-empty"><Wrench size={22} /><strong>{empty[0]}</strong>{empty[1]}</div>
        : <><div className="ft-fault-list">{pageItems.map((fault) => <FaultCard key={fault.id} fault={fault} showStatus={!isWorkshop && view === 'MINE'} showClient={isWorkshop} fromMural={view === 'OPEN'} tracking={isMobile && ((!isWorkshop && view === 'MINE') || (isWorkshop && view === 'COMMENTED')) ? { seen, markSeen, onChanged: () => load(), workshopUserId: isWorkshop ? (user?.userId ?? user?.id) : null } : null} />)}</div><ListPager pagerProps={pagerProps} itemLabel="fallas" /></>;

  if (!heading && !mineOnly) {
    const mine = lists[isWorkshop ? 'COMMENTED' : 'MINE'];
    const summary = {
      total: mine.length,
      open: mine.filter((fault) => fault.vigente !== false).length,
      closed: mine.filter((fault) => fault.vigente === false).length,
      diagnosed: mine.filter((fault) => diagnosisCountOf(fault) > 0).length,
      pending: mine.filter((fault) => diagnosisCountOf(fault) === 0).length,
    };
    const filters = isWorkshop
      ? [['all', 'Todas'], ['open', 'Abiertas'], ['closed', 'Cerradas']]
      : [['all', 'Todas'], ['open', 'Abiertas'], ['pending', 'Sin diagnóstico'], ['diagnosed', 'Con diagnóstico'], ['closed', 'Cerradas']];
    const title = isWorkshop ? 'Mis diagnósticos' : 'Mis fallas';
    return (
      <div className="profile-panel seller-quotes-panel ft-profile-faults">
        <div className="seller-quotes-heading">
          <div>
            <span className="seller-quotes-eyebrow"><Wrench size={14} /> Fallas automotrices</span>
            <h2 className="profile-panel-title">{title}</h2>
            <p>{isWorkshop
              ? 'Las fallas de clientes en las que dejaste tu diagnóstico. Desde aquí les haces seguimiento.'
              : 'Registra lo que le pasa a tu vehículo, recibe el diagnóstico de los talleres y agenda con el que prefieras. Aquí le haces seguimiento a cada falla.'}</p>
          </div>
          {role === 'BUYER' && (
            <div className="seller-quotes-heading-actions">
              <button type="button" className="pa-btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Publicar falla</button>
            </div>
          )}
        </div>

        <div className="seller-quotes-summary">
          <article><ClipboardList size={18} /><span><strong>{summary.total}</strong>{isWorkshop ? 'Diagnósticos' : 'Registradas'}</span></article>
          <article className="is-sent"><Wrench size={18} /><span><strong>{summary.open}</strong>Abiertas</span></article>
          {isWorkshop
            ? <article className="is-pending"><CheckCircle2 size={18} /><span><strong>{summary.closed}</strong>Cerradas</span></article>
            : <>
              <article className="is-pending"><MessageCircle size={18} /><span><strong>{summary.pending}</strong>Sin diagnóstico</span></article>
              <article className="is-unread"><Stethoscope size={18} /><span><strong>{summary.diagnosed}</strong>Con diagnóstico</span></article>
            </>}
        </div>

        <div className="seller-quotes-toolbar">
          <label className="seller-quotes-search"><Search size={15} /><input value={searchText} maxLength={MAX_SEARCH_LENGTH} onChange={(event) => setSearchText(event.target.value)} placeholder="Buscar por falla, vehículo o comuna..." />{searchText && <button type="button" onClick={() => { setSearchText(''); setQuery(''); }} aria-label="Limpiar búsqueda"><X size={13} /></button>}</label>
          <div className="seller-quotes-filters" role="group" aria-label={`Filtrar ${title.toLowerCase()}`}>
            {filters.map(([value, label]) => (
              <button key={value} type="button" className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>{label}</button>
            ))}
          </div>
        </div>

        {results}
        {role === 'BUYER' && <CreateFaultModal isOpen={creating} onClose={() => setCreating(false)} onCreated={(fault) => { setCreating(false); navigate(faultDetailPath(fault)); }} />}
      </div>
    );
  }

  return (
    <div className={`ft-mural ${mineOnly ? 'is-mine' : ''}`}>
      {mineOnly && <div className="ft-m-hero"><FaultsHero isWorkshop={isWorkshop} mine={view !== 'OPEN'} /></div>}
      {mineOnly && role === 'BUYER' && <button type="button" className="ft-m-fab" onClick={() => setCreating(true)} aria-label="Registrar una falla automotriz"><Plus size={26} /></button>}
      <div className="ft-wide-shell">
        <div className="ft-mural-grid">
          {filtersOpen && <button type="button" className="ft-m-only ft-m-backdrop" aria-label="Cerrar filtros" onClick={() => setFiltersOpen(false)} />}
          <aside className={`ft-filter-panel ${filtersOpen ? 'is-open' : ''}`} aria-label="Filtros de búsqueda">
            <h2><Filter size={20} /> Filtros de búsqueda <button type="button" className="ft-m-only ft-m-close" aria-label="Cerrar filtros" onClick={() => setFiltersOpen(false)}><X size={20} /></button></h2>

            <fieldset className="ft-filter-group">
              <legend><MapPin size={17} /> Ubicación</legend>
              <label className="ft-radio"><input type="radio" name="fault-location" checked={locationMode === 'mine'} disabled={!userComuna} onChange={() => { setLocationMode('mine'); setPlace(''); }} /> Mi comuna{userComuna ? ` (${userComuna})` : ''}</label>
              <label className="ft-radio"><input type="radio" name="fault-location" checked={locationMode === 'region'} onChange={() => { setLocationMode('region'); setPlace(''); }} /> {userRegion ? 'Mi región' : 'Por región'}</label>
              <label className="ft-radio"><input type="radio" name="fault-location" checked={locationMode === 'all'} onChange={() => { setLocationMode('all'); setPlace(''); }} /> Todo Chile</label>
              {!userComuna && <small className="ft-filter-hint">{isLoggedIn ? 'Agrega tu comuna en tu perfil para filtrar por ella.' : 'Inicia sesión para filtrar por tu comuna.'}</small>}
              {locationMode !== 'mine' && (
                <select aria-label={locationMode === 'region' ? 'Región' : 'Comuna'} value={place} onChange={(event) => setPlace(event.target.value)}>
                  <option value="">{locationMode === 'region' ? userRegion || 'Todas las regiones' : 'Todas las comunas'}</option>
                  {placeOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              )}
            </fieldset>

            <label><span><Car size={17} /> Marca del vehículo</span><select value={brand} onChange={(event) => { setBrand(event.target.value); setModel(''); }}><option value="">Todas las marcas</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Modelo</span><select value={model} onChange={(event) => setModel(event.target.value)}><option value="">Todos los modelos</option>{models.map((item) => <option key={item}>{item}</option>)}</select></label>

            <fieldset className="ft-filter-group">
              <legend><CalendarDays size={17} /> Año</legend>
              <div className="ft-year-row">
                <select aria-label="Año desde" value={yearFrom} onChange={(event) => setYearFrom(event.target.value)}><option value="">Desde</option>{years.map((item) => <option key={item}>{item}</option>)}</select>
                <select aria-label="Año hasta" value={yearTo} onChange={(event) => setYearTo(event.target.value)}><option value="">Hasta</option>{years.map((item) => <option key={item}>{item}</option>)}</select>
              </div>
            </fieldset>

            <fieldset className="ft-filter-group ft-type-filter">
              <legend><Wrench size={17} /> Tipo de falla</legend>
              {SERVICE_CATEGORIES.filter((category) => category.id !== 'TODAS').map((category) => <label key={category.id} className="ft-check"><input type="checkbox" checked={selectedTypes.includes(category.id)} onChange={() => toggleType(category.id)} /> {category.label}</label>)}
            </fieldset>

            <button type="button" className="ft-btn ft-btn-outline" onClick={clearFilters}><RotateCcw size={16} /> Limpiar filtros</button>
          </aside>

          <main className="ft-results">
            <div className="ft-m-only ft-m-controls">
              {isLoggedIn && (
                <div className="ft-m-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={view === 'OPEN'} className={view === 'OPEN' ? 'is-active' : ''} onClick={() => setView('OPEN')}>Mural público ({lists.OPEN.length})</button>
                  <button type="button" role="tab" aria-selected={view !== 'OPEN'} className={view !== 'OPEN' ? 'is-active' : ''} onClick={() => setView(isWorkshop ? 'COMMENTED' : 'MINE')}>Mis fallas ({lists[isWorkshop ? 'COMMENTED' : 'MINE'].length})</button>
                </div>
              )}
              <div className="ft-m-row">
                <label className="ft-m-search"><Search size={18} /><input value={searchText} maxLength={MAX_SEARCH_LENGTH} onChange={(event) => setSearchText(event.target.value)} placeholder="Buscar por falla o vehículo..." aria-label="Buscar fallas" />{searchText && <button type="button" onClick={() => { setSearchText(''); setQuery(''); }} aria-label="Limpiar búsqueda"><X size={16} /></button>}</label>
                <button type="button" className={`ft-m-icon ${hasFilters ? 'is-active' : ''}`} onClick={() => setFiltersOpen(true)} aria-label="Abrir filtros avanzados"><SlidersHorizontal size={22} /></button>
                <label className={`ft-m-icon ${sort !== 'recent' ? 'is-active' : ''}`}><ArrowUpDown size={22} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar fallas"><option value="recent">Más recientes</option><option value="oldest">Más antiguas</option></select></label>
              </div>
            </div>
            <form className="ft-search-row" onSubmit={(event) => { event.preventDefault(); setQuery(searchText.trim()); }}>
              <label className="ft-search-box"><Search size={19} /><input value={searchText} maxLength={MAX_SEARCH_LENGTH} onChange={(event) => setSearchText(event.target.value)} placeholder="Buscar por palabra clave (ej: no enciende, pérdida de potencia, frenos, etc.)" /></label>
              <button type="submit" className="ft-btn ft-btn-primary ft-search-button">Buscar</button>
            </form>
            <div className="ft-results-head">
              <p>Se encontraron <strong>{items.length}</strong> fallas automotrices</p>
              {myComunaToggle}
              <label>Ordenar por: <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Más recientes</option><option value="oldest">Más antiguas</option></select></label>
            </div>
            {results}
          </main>
        </div>
      </div>

      {isLoggedIn && role === 'BUYER' && <CreateFaultModal isOpen={creating} onClose={() => setCreating(false)} onCreated={(fault) => { setCreating(false); navigate(faultDetailPath(fault)); }} />}
    </div>
  );
}
