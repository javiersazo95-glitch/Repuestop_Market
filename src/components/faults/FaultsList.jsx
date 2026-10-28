import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, CalendarDays, Camera, Car, ChevronRight, FileText, Filter, Loader2,
  MapPin, MessageCircle, Plus, RotateCcw, Search, Settings, Wrench,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCommentedFaults, getMyFaults, getOpenFaults, timeSince } from '../../services/faultApi';
import { faultDetailPath } from '../../routes/paths';
import { resolveMediaUrl } from '../../services/api';
import { SERVICE_CATEGORIES } from '../../data/automotiveAdsData';
import CreateFaultModal from './CreateFaultModal';
import '../../styles/faults.css';

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

const textOf = (fault) => [
  fault.titulo, fault.descripcion, fault.antesDelFallo, fault.marca, fault.modelo,
  fault.vehiculo, fault.comuna, fault.region, ...(fault.sintomas || []),
].filter(Boolean).join(' ');

function faultTypeOf(fault) {
  const selected = SERVICE_CATEGORIES.find((category) => category.id === fault.categoria && category.id !== 'TODAS');
  if (selected) return { label: selected.label, key: 'category', emoji: selected.emoji };
  const text = textOf(fault);
  const match = FAULT_TYPES.find(([, pattern]) => pattern.test(text)) || FAULT_TYPES.at(-1);
  return { label: match[0], key: match[2], emoji: null };
}

const diagnosisCountOf = (fault) => Number(
  fault.cantidadDiagnosticos ?? fault.totalDiagnosticos ?? fault.diagnosticosCount ?? fault.diagnosticos?.length ?? 0,
) || 0;

function FaultCard({ fault, showStatus, showClient, fromMural }) {
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
  const mobility = fault.seMueve === true ? 'Sí, se puede mover' : fault.seMueve === false ? 'No se puede mover' : 'No informado';

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
          {showStatus && <span className={`ft-badge ${fault.vigente ? '' : 'is-closed'}`}>{fault.vigente ? 'Abierta' : 'Cerrada'}</span>}
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
        <span className={`ft-type-pill is-${type.key}`}>{type.emoji ? <span aria-hidden="true">{type.emoji}</span> : <Wrench size={15} />} {type.label}</span>
        <dl>
          <div><dt><Settings size={14} /> Tipo de falla</dt><dd>{fault.sintomas?.[0] || type.label}</dd></div>
          <div><dt><FileText size={14} /> Título del anuncio</dt><dd>{fault.titulo || 'Sin título'}</dd></div>
          <div><dt><Car size={14} /> Movilidad</dt><dd>{mobility}</dd></div>
          <div><dt><MessageCircle size={14} /> Diagnósticos</dt><dd>{diagnosisCount} {diagnosisCount === 1 ? 'diagnóstico' : 'diagnósticos'}</dd></div>
        </dl>
        <Link to={faultDetailPath(fault)} state={{ fromMural }} className="ft-btn ft-btn-primary ft-detail-button" aria-label={`Ver detalle de ${vehicle}`}>
          Ver detalle <ChevronRight size={16} />
        </Link>
      </div>
    </article>
  );
}

export default function FaultsList({ heading = true, onMetricsChange }) {
  const { role, isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const isWorkshop = role === 'WORKSHOP';
  const [view, setView] = useState('OPEN');
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const open = await getOpenFaults();
      let other = [];
      if (isLoggedIn) other = await (isWorkshop ? getCommentedFaults() : getMyFaults());
      setLists({ OPEN: Array.isArray(open) ? open : [], [isWorkshop ? 'COMMENTED' : 'MINE']: Array.isArray(other) ? other : [] });
    } catch (err) {
      setError(err?.message || 'No pudimos cargar las fallas.');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, isWorkshop]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!isLoggedIn) setView('OPEN'); }, [isLoggedIn]);

  const source = useMemo(() => lists[view] || [], [lists, view]);
  const brands = useMemo(() => [...new Set(source.map((fault) => fault.marca).filter(Boolean))].sort(), [source]);
  const models = useMemo(() => [...new Set(source.filter((fault) => !brand || fault.marca === brand).map((fault) => fault.modelo).filter(Boolean))].sort(), [source, brand]);
  const regions = useMemo(() => [...new Set(source.map((fault) => fault.region).filter(Boolean))].sort(), [source]);
  const communes = useMemo(() => [...new Set(source.map((fault) => fault.comuna).filter(Boolean))].sort(), [source]);
  const years = useMemo(() => [...new Set(source.map((fault) => Number(fault.anio)).filter(Boolean))].sort((a, b) => b - a), [source]);
  const placeOptions = locationMode === 'region' ? regions : communes;

  const items = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    return source.filter((fault) => (!needle || textOf(fault).toLocaleLowerCase('es').includes(needle))
      && (!brand || fault.marca === brand)
      && (!model || fault.modelo === model)
      && (!yearFrom || Number(fault.anio) >= Number(yearFrom))
      && (!yearTo || Number(fault.anio) <= Number(yearTo))
      && (locationMode === 'all' || !place || (locationMode === 'region' ? fault.region === place : fault.comuna === place))
      && (selectedTypes.length === 0 || selectedTypes.includes(fault.categoria))
      && (locationMode !== 'mine' || !user?.comuna || fault.comuna === user.comuna))
      .sort((a, b) => sort === 'oldest'
        ? new Date(a.createdAt) - new Date(b.createdAt)
        : new Date(b.createdAt) - new Date(a.createdAt));
  }, [source, query, brand, model, yearFrom, yearTo, locationMode, place, selectedTypes, sort, user?.comuna]);

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
    setModel(''); setYearFrom(''); setYearTo(''); setSelectedTypes([]);
  };
  const empty = view === 'OPEN'
    ? ['No encontramos fallas', 'Prueba cambiando o limpiando los filtros de búsqueda.']
    : view === 'COMMENTED'
      ? ['Aún no dejas diagnósticos', 'Comenta una falla abierta para que el cliente conozca tu taller.']
      : ['No has registrado fallas', 'Cuéntanos qué le pasó a tu vehículo y los talleres te enviarán su diagnóstico.'];

  const results = loading ? <div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando fallas…</div>
    : error ? <div className="ft-empty" role="alert"><AlertCircle size={20} /><strong>No pudimos cargar las fallas</strong>{error}<br /><button type="button" className="ft-btn ft-btn-outline" onClick={load}>Reintentar</button></div>
      : items.length === 0 ? <div className="ft-empty"><Wrench size={22} /><strong>{empty[0]}</strong>{empty[1]}</div>
        : <div className="ft-fault-list">{items.map((fault) => <FaultCard key={fault.id} fault={fault} showStatus={!isWorkshop && view === 'MINE'} showClient={isWorkshop} fromMural={view === 'OPEN'} />)}</div>;

  if (!heading) {
    return (
      <div className="ft-profile-faults">
        <div className="ft-mural-toolbar">
          <div className="ft-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={view === 'OPEN'} className={`ft-tab ${view === 'OPEN' ? 'is-active' : ''}`} onClick={() => setView('OPEN')}>Mural público ({lists.OPEN.length})</button>
            <button type="button" role="tab" aria-selected={view !== 'OPEN'} className={`ft-tab ${view !== 'OPEN' ? 'is-active' : ''}`} onClick={() => setView(isWorkshop ? 'COMMENTED' : 'MINE')}>{isWorkshop ? 'Mis diagnósticos' : 'Mis fallas'}</button>
          </div>
          {role === 'BUYER' && <button type="button" className="ft-btn ft-btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Registrar una falla</button>}
        </div>
        {results}
        {role === 'BUYER' && <CreateFaultModal isOpen={creating} onClose={() => setCreating(false)} onCreated={(fault) => { setCreating(false); navigate(faultDetailPath(fault)); }} />}
      </div>
    );
  }

  return (
    <div className="ft-mural">
      <div className="ft-wide-shell">
        <div className="ft-mural-grid">
          <aside className="ft-filter-panel" aria-label="Filtros de búsqueda">
            <h2><Filter size={20} /> Filtros de búsqueda</h2>

            <fieldset className="ft-filter-group">
              <legend><MapPin size={17} /> Ubicación</legend>
              <label className="ft-radio"><input type="radio" name="fault-location" checked={locationMode === 'mine'} onChange={() => { setLocationMode('mine'); setPlace(''); }} /> Mi comuna</label>
              <label className="ft-radio"><input type="radio" name="fault-location" checked={locationMode === 'region'} onChange={() => { setLocationMode('region'); setPlace(''); }} /> Mi región</label>
              <label className="ft-radio"><input type="radio" name="fault-location" checked={locationMode === 'all'} onChange={() => { setLocationMode('all'); setPlace(''); }} /> Todo Chile</label>
              <select aria-label="Comuna o región" value={place} onChange={(event) => setPlace(event.target.value)} disabled={locationMode === 'all'}>
                <option value="">{locationMode === 'region' ? user?.region || 'Todas las regiones' : user?.comuna || 'Todas las comunas'}</option>
                {placeOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
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
              {SERVICE_CATEGORIES.filter((category) => category.id !== 'TODAS').map((category) => <label key={category.id} className="ft-check"><input type="checkbox" checked={selectedTypes.includes(category.id)} onChange={() => toggleType(category.id)} /> <span aria-hidden="true">{category.emoji}</span> {category.label}</label>)}
            </fieldset>

            <button type="button" className="ft-btn ft-btn-primary" onClick={() => setQuery(searchText.trim())}><Search size={16} /> Aplicar filtros</button>
            <button type="button" className="ft-btn ft-btn-outline" onClick={clearFilters}><RotateCcw size={16} /> Limpiar filtros</button>
          </aside>

          <main className="ft-results">
            <form className="ft-search-row" onSubmit={(event) => { event.preventDefault(); setQuery(searchText.trim()); }}>
              <label className="ft-search-box"><Search size={19} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Buscar por palabra clave (ej: no enciende, pérdida de potencia, frenos, etc.)" /></label>
              <button type="submit" className="ft-btn ft-btn-primary ft-search-button">Buscar</button>
            </form>
            <div className="ft-results-head">
              <p>Se encontraron <strong>{items.length}</strong> fallas automotrices</p>
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
