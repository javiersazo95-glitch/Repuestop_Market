import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowUpDown, ChevronDown, LayoutGrid, List, Loader2, MapPin, RotateCcw, Search, SlidersHorizontal, Wrench, X,
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../data/talleresData';
import usePagedList from '../../hooks/usePagedList';
import ListPager from '../ListPager';
import { CheckRow, FilterSection, countBy } from '../ListFilters';
import { MAX_SEARCH_LENGTH } from '../../utils/inputLimits';
import { FaultCard, diagnosisCountOf, normalizeComuna, textOf } from './FaultsList';

const FAULT_SCOPES = [
  { value: 'TODAS', label: 'Todas las fallas' },
  { value: 'SIN_DIAG', label: 'Sin diagnóstico' },
  { value: 'CON_DIAG', label: 'Con diagnóstico' },
];
const FAULT_CONDITIONS = [
  { value: 'NO_SE_MUEVE', label: 'No se mueve' },
  { value: 'RECOGIDA', label: 'Hay que ir a buscarlo' },
];
const FAULT_STATES = [
  { value: 'ABIERTA', label: 'Abierta' },
  { value: 'CERRADA', label: 'Cerrada' },
];
const nf = new Intl.NumberFormat('es-CL');

const matchesCondition = (fault, value) => (value === 'NO_SE_MUEVE' ? fault.seMueve === false : fault.requiereRecogida === true);
const matchesState = (fault, value) => (value === 'ABIERTA' ? fault.vigente !== false : fault.vigente === false);
// Lo que el usuario ya eligió no desaparece de la lista aunque ya no tenga datos.
const withSelected = (options, selected) => [
  ...options,
  ...selected.filter((value) => !options.some((option) => option.value === value)).map((value) => ({ value, count: 0 })),
];

/**
 * Mural de fallas en escritorio (/fallas): el mismo esqueleto que Encargos de repuestos (pestañas, barra de herramientas y
 * panel de filtros con casillas). Las opciones salen de la pestaña abierta y solo aparecen las que tienen datos.
 */
export default function FaultsMural({ lists, view, setView, loading, error, onRetry, isLoggedIn, isWorkshop, user }) {
  const mineKey = isWorkshop ? 'COMMENTED' : 'MINE';
  const source = lists[view] || [];
  const myComuna = isWorkshop ? user?.comuna || '' : '';
  const [searchQuery, setSearchQuery] = useState('');
  const [tipos, setTipos] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [regiones, setRegiones] = useState([]);
  const [condiciones, setCondiciones] = useState([]);
  const [estados, setEstados] = useState([]);
  const [scope, setScope] = useState('TODAS');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('list');
  const [onlyMyComuna, setOnlyMyComuna] = useState(false);
  const [openSections, setOpenSections] = useState({ tipo: true, marca: true, modelo: true, region: true, condicion: true, estado: true });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const toggleSection = (id) => setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  const toggleIn = (setter, value, checked) => setter((current) => (checked ? [...current, value] : current.filter((item) => item !== value)));
  // Las opciones salen de la pestaña abierta: al cambiar de pestaña se sueltan los filtros elegidos.
  useEffect(() => {
    setTipos([]); setMarcas([]); setModelos([]); setRegiones([]); setCondiciones([]); setEstados([]); setScope('TODAS');
  }, [view]);

  const typeLabel = (id) => SERVICE_CATEGORIES.find((category) => category.id === id)?.label || id;
  const tipoOptions = useMemo(() => withSelected(countBy(source, (fault) => fault.categoria), tipos), [source, tipos]);
  const marcaOptions = useMemo(() => withSelected(countBy(source, (fault) => fault.marca), marcas), [source, marcas]);
  const modeloOptions = useMemo(
    () => withSelected(countBy(source.filter((fault) => marcas.length === 0 || marcas.includes(fault.marca)), (fault) => fault.modelo), modelos),
    [source, marcas, modelos],
  );
  const regionOptions = useMemo(() => withSelected(countBy(source, (fault) => fault.region), regiones), [source, regiones]);
  const conditionOptions = useMemo(
    () => withSelected(
      FAULT_CONDITIONS.map((option) => ({ value: option.value, count: source.filter((fault) => matchesCondition(fault, option.value)).length })).filter((option) => option.count > 0),
      condiciones,
    ),
    [source, condiciones],
  );
  const stateOptions = useMemo(
    () => withSelected(
      FAULT_STATES.map((option) => ({ value: option.value, count: source.filter((fault) => matchesState(fault, option.value)).length })).filter((option) => option.count > 0),
      estados,
    ),
    [source, estados],
  );

  const tabMatches = useMemo(() => {
    const needle = searchQuery.trim().toLocaleLowerCase('es');
    return source.filter((fault) => (!needle || textOf(fault).toLocaleLowerCase('es').includes(needle))
      && (tipos.length === 0 || tipos.includes(fault.categoria))
      && (marcas.length === 0 || marcas.includes(fault.marca))
      && (modelos.length === 0 || modelos.includes(fault.modelo))
      && (regiones.length === 0 || regiones.includes(fault.region))
      && (condiciones.length === 0 || condiciones.some((value) => matchesCondition(fault, value)))
      && (estados.length === 0 || estados.some((value) => matchesState(fault, value)))
      && (!onlyMyComuna || !myComuna || normalizeComuna(fault.comuna) === normalizeComuna(myComuna)));
  }, [source, searchQuery, tipos, marcas, modelos, regiones, condiciones, estados, onlyMyComuna, myComuna]);

  const scopeCounts = useMemo(() => ({
    TODAS: tabMatches.length,
    SIN_DIAG: tabMatches.filter((fault) => diagnosisCountOf(fault) === 0).length,
    CON_DIAG: tabMatches.filter((fault) => diagnosisCountOf(fault) > 0).length,
  }), [tabMatches]);

  const items = useMemo(() => tabMatches
    .filter((fault) => scope === 'TODAS' || (scope === 'SIN_DIAG' ? diagnosisCountOf(fault) === 0 : diagnosisCountOf(fault) > 0))
    .sort((a, b) => (sortBy === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt))),
  [tabMatches, scope, sortBy]);

  const { pageItems, pagerProps } = usePagedList(
    items,
    JSON.stringify([view, searchQuery, tipos, marcas, modelos, regiones, condiciones, estados, scope, sortBy, onlyMyComuna]),
    view === 'OPEN' ? 12 : 10,
  );

  const activeFiltersCount = tipos.length + marcas.length + modelos.length + regiones.length + condiciones.length + estados.length
    + (searchQuery.trim() ? 1 : 0) + (scope !== 'TODAS' ? 1 : 0) + (onlyMyComuna ? 1 : 0);
  const resetFilters = () => {
    setSearchQuery(''); setTipos([]); setMarcas([]); setModelos([]); setRegiones([]); setCondiciones([]); setEstados([]);
    setScope('TODAS'); setOnlyMyComuna(false);
  };

  const mineTab = { value: mineKey, label: isWorkshop ? 'Mis diagnósticos' : 'Mis fallas', count: (lists[mineKey] || []).length };
  const openTab = { value: 'OPEN', label: 'Mural público', count: (lists.OPEN || []).length };
  // Quien ya tiene fallas propias abre en ellas; sin ninguna, primero el mural (igual que la app y Encargos).
  const tabs = isLoggedIn ? (mineTab.count > 0 ? [mineTab, openTab] : [openTab, mineTab]) : null;
  const isMine = view !== 'OPEN';

  let empty;
  if (view === 'OPEN') {
    empty = activeFiltersCount > 0
      ? ['No encontramos fallas con estos filtros', 'Prueba cambiando o limpiando los filtros de búsqueda.']
      : ['Aún no hay fallas abiertas', isWorkshop ? 'Cuando un cliente registre una falla, la verás aquí para dejar tu diagnóstico.' : 'Cuando alguien registre una falla, aparecerá aquí.'];
  } else if (view === 'COMMENTED') {
    empty = ['Aún no dejas diagnósticos', 'Comenta una falla abierta para que el cliente conozca tu taller.'];
  } else {
    empty = ['No has registrado fallas', 'Cuéntanos qué le pasó a tu vehículo y los talleres te enviarán su diagnóstico.'];
  }

  return (
    <div className="aw-page ft-aw-embed">
      <div className="ft-wide-shell">
        <div className="aw-layout">
          {isFiltersOpen && <button type="button" className="aw-backdrop" aria-label="Cerrar filtros" onClick={() => setIsFiltersOpen(false)} />}
          <aside className={`aw-sidebar ${isFiltersOpen ? 'is-open' : ''}`} aria-label="Filtrar fallas">
            <div className="catalog-sidebar-filters catalog-advanced-filter-panel aw-filters">
              <button type="button" className="aw-filters-close" onClick={() => setIsFiltersOpen(false)}><X size={19} /> Cerrar filtros</button>
              <div className="sidebar-filters-header">
                <div className="sidebar-title-group"><SlidersHorizontal size={22} /><span><strong>Filtrar fallas</strong></span></div>
              </div>

              <div className="aw-search">
                <Search size={17} />
                <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar falla..." aria-label="Buscar falla" maxLength={MAX_SEARCH_LENGTH} />
                {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}
              </div>

              {tipoOptions.length > 0 && (
                <FilterSection id="tipo" label="Tipo de falla" isOpen={openSections.tipo} onToggle={toggleSection}>
                  {tipoOptions.map(({ value, count }) => (
                    <CheckRow key={value} label={typeLabel(value)} count={count} checked={tipos.includes(value)} onChange={(checked) => toggleIn(setTipos, value, checked)} />
                  ))}
                </FilterSection>
              )}
              {marcaOptions.length > 0 && (
                <FilterSection id="marca" label="Marca del vehículo" isOpen={openSections.marca} onToggle={toggleSection}>
                  {marcaOptions.map(({ value, count }) => (
                    <CheckRow key={value} label={value} count={count} checked={marcas.includes(value)} onChange={(checked) => toggleIn(setMarcas, value, checked)} />
                  ))}
                </FilterSection>
              )}
              {modeloOptions.length > 0 && (
                <FilterSection id="modelo" label="Modelo del vehículo" isOpen={openSections.modelo} onToggle={toggleSection}>
                  {modeloOptions.map(({ value, count }) => (
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
              {conditionOptions.length > 0 && (
                <FilterSection id="condicion" label="Condición del vehículo" isOpen={openSections.condicion} onToggle={toggleSection}>
                  {conditionOptions.map(({ value, count }) => (
                    <CheckRow key={value} label={FAULT_CONDITIONS.find((option) => option.value === value)?.label || value} count={count} checked={condiciones.includes(value)} onChange={(checked) => toggleIn(setCondiciones, value, checked)} />
                  ))}
                </FilterSection>
              )}
              {isMine && stateOptions.length > 0 && (
                <FilterSection id="estado" label="Estado" isOpen={openSections.estado} onToggle={toggleSection}>
                  {stateOptions.map(({ value, count }) => (
                    <CheckRow key={value} label={FAULT_STATES.find((option) => option.value === value)?.label || value} count={count} checked={estados.includes(value)} onChange={(checked) => toggleIn(setEstados, value, checked)} />
                  ))}
                </FilterSection>
              )}

              <button type="button" className="aw-clear" onClick={resetFilters} disabled={activeFiltersCount === 0}><RotateCcw size={15} /> Limpiar filtros</button>
              <button type="button" className="aw-filters-apply" onClick={() => setIsFiltersOpen(false)}>Ver {items.length} {items.length === 1 ? 'falla' : 'fallas'}</button>
            </div>
          </aside>

          <section className="aw-main">
            {tabs && (
              <div className="aw-tabs" role="tablist" aria-label="Fallas automotrices">
                {tabs.map((item) => (
                  <button key={item.value} type="button" role="tab" aria-selected={view === item.value} className={view === item.value ? 'is-active' : ''} onClick={() => setView(item.value)}>
                    {item.label} ({nf.format(item.count)})
                  </button>
                ))}
              </div>
            )}
            <div className="aw-toolbar">
              <button type="button" className="aw-toolbar-filters" onClick={() => setIsFiltersOpen(true)}>
                <SlidersHorizontal size={16} /> Filtros{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
              </button>
              <label className="aw-select">
                <select value={scope} onChange={(event) => setScope(event.target.value)} aria-label="Fallas según diagnóstico">
                  {FAULT_SCOPES.map((option) => <option key={option.value} value={option.value}>{option.label} ({nf.format(scopeCounts[option.value])})</option>)}
                </select>
                <ChevronDown size={16} />
              </label>
              <span className="aw-count"><strong>{nf.format(items.length)}</strong> {items.length === 1 ? 'resultado' : 'resultados'}</span>
              {myComuna && (
                <button type="button" aria-pressed={onlyMyComuna} className={`ft-tab ${onlyMyComuna ? 'is-active' : ''}`} onClick={() => setOnlyMyComuna((current) => !current)}>
                  <MapPin size={14} aria-hidden="true" /> Solo mi comuna ({myComuna})
                </button>
              )}
              <label className="aw-select aw-select-sort">
                <ArrowUpDown size={15} />
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar por">
                  <option value="recent">Más recientes</option>
                  <option value="oldest">Más antiguas</option>
                </select>
                <ChevronDown size={16} />
              </label>
              <div className="aw-view-toggle" role="group" aria-label="Tipo de vista">
                <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-label="Vista de lista" aria-pressed={viewMode === 'list'}><List size={18} /></button>
                <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-label="Vista de cuadrícula" aria-pressed={viewMode === 'grid'}><LayoutGrid size={18} /></button>
              </div>
            </div>

            {error ? (
              <div className="aw-empty">
                <div className="aw-empty-icon is-error"><AlertCircle size={30} /></div>
                <h3>No pudimos cargar las fallas</h3>
                <p>{error}</p>
                <button type="button" className="aw-btn-publish" onClick={onRetry}>Reintentar</button>
              </div>
            ) : loading ? (
              <div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando fallas…</div>
            ) : items.length === 0 ? (
              <div className="aw-empty">
                <div className="aw-empty-icon"><Wrench size={30} /></div>
                <h3>{empty[0]}</h3>
                <p>{empty[1]}</p>
                {activeFiltersCount > 0 && (
                  <div className="aw-empty-actions">
                    <button type="button" className="aw-btn-outline" onClick={resetFilters}><RotateCcw size={15} /> Limpiar filtros</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className={`ft-fault-list ${viewMode === 'grid' ? 'is-grid' : ''}`}>
                  {pageItems.map((fault) => (
                    <FaultCard
                      key={fault.id}
                      fault={fault}
                      showStatus={!isWorkshop && view === 'MINE'}
                      showClient={isWorkshop}
                      fromMural={view === 'OPEN'}
                      ownerActions={!isWorkshop && view === 'MINE' ? { onChanged: onRetry } : null}
                    />
                  ))}
                </div>
                <ListPager pagerProps={pagerProps} itemLabel="fallas" />
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
