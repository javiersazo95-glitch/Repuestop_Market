import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, Search, Filter, SlidersHorizontal, MapPin, ShieldCheck,
  Star, ArrowLeft, X, CheckCircle2, RotateCcw,
  Store, Tag, Truck, Bike, ChevronRight, ChevronDown, Car, CarFront, RefreshCw, ArrowUpDown
} from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import { getShippingIconConfig } from './NewOnboardedStoresSection';
import { useAuth } from '../context/AuthContext';
import { getAddressesApi, getPublicStoresApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptPage, adaptStore, adaptVehicle } from '../services/adapters';
import { normalizePlate, sanitizePlateInput, isValidPlate } from '../utils/vehicleLookup';
import MarketplaceSellerCard from './MarketplaceSellerCard';
import StoreCardSkeleton from './skeletons/StoreCardSkeleton';
import PaginationBar from './PaginationBar';
import { useSavedMarketplaceItems } from '../hooks/useSavedMarketplaceItems';
import { useMarketplace } from '../context/MarketplaceContext';

/**
 * /tiendas/publicas topea `size` en 100. Antes ese tope se pedía SIEMPRE (una
 * sola consulta de 100, sin importar cuántas tiendas hubiera realmente) y todo
 * el filtrado y la paginación se hacían en el cliente sobre ese bloque —
 * pasadas las 100 tiendas, las siguientes quedaban invisibles sin ningún aviso.
 *
 * Ahora hay dos consultas, igual que en la app móvil:
 * - `pageQuery`: la página real que se muestra, paginada por el servidor con
 *   `texto` y `comuna` (los dos filtros que el backend sí resuelve). Escala sin
 *   límite: la tienda 150 se ve igual que la 5.
 * - `poolQuery`: hasta 100 tiendas (ya acotadas por `texto`/`comuna`) para
 *   construir las opciones de los filtros que el backend no soporta (marca,
 *   envío, giro) y para resolverlos en el cliente cuando el usuario los usa.
 *   Solo en ese caso la paginación deja de ser exacta contra el sistema
 *   completo — y el contador de resultados lo dice explícitamente en vez de
 *   fingir un total que no es.
 */
const FILTER_POOL_SIZE = 100;

/**
 * Opciones de filtro derivadas de los datos reales del pool, no de una lista
 * fija en el código. Se deduplica ignorando mayúsculas porque el giro y los
 * métodos de envío los escribe cada vendedor a mano.
 */
function uniqueOptions(values) {
  const byKey = new Map();
  values.forEach((value) => {
    const label = (value || '').toString().trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, label);
  });
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, 'es'));
}

export default function StoresDirectoryView({ onBackToStore, onSelectStore }) {
  const { user } = useAuth();
  const { openAuthModal, activeVehicle, setActiveVehicle } = useMarketplace();
  const { isStoreSaved, toggleStore } = useSavedMarketplaceItems(user?.userId ?? user?.id);
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('texto') || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [selectedGiro, setSelectedGiro] = useState('TODAS');
  const [selectedComuna, setSelectedComuna] = useState(() => searchParams.get('comuna') || 'TODAS');
  const [selectedShipping, setSelectedShipping] = useState('TODAS');
  const [selectedBrand, setSelectedBrand] = useState('TODAS');
  const [sortBy, setSortBy] = useState('relevancia');
  const [openFilterSections, setOpenFilterSections] = useState({ business: true, shipping: true });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [patentInput, setPatentInput] = useState(activeVehicle?.patente || '');
  const [patentError, setPatentError] = useState('');
  const [patentSearching, setPatentSearching] = useState(false);
  const [myComunaLoading, setMyComunaLoading] = useState(false);
  const [comunaNotice, setComunaNotice] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const handlePatentSearch = async () => {
    const patent = normalizePlate(patentInput);
    if (!isValidPlate(patent)) {
      setPatentError('Ingresa una patente válida (ej: ABCD12).');
      return;
    }
    setPatentSearching(true);
    setPatentError('');
    try {
      const vehicle = adaptVehicle(await searchVehicleByPatenteApi(patent));
      if (!vehicle?.marca || vehicle.requiereIngresoManual) {
        setPatentError(vehicle?.mensaje || 'No encontramos ese vehículo.');
        return;
      }
      setActiveVehicle(vehicle);
      setPatentInput(vehicle.patente || patent);
      // NO se toca `selectedBrand`: ese filtro es por "marcas especialistas", una lista que
      // el vendedor declara a mano y que no dice nada de su stock. Aplicarlo al resolver la
      // patente escondia del directorio a tiendas con cientos de repuestos para esa marca
      // solo porque no se habian declarado especialistas en ella.
    } catch (err) {
      setPatentError(err.message || 'No se pudo consultar la patente.');
    } finally {
      setPatentSearching(false);
    }
  };

  const handleMyComuna = async () => {
    // Es un interruptor: si el filtro ya está aplicado, el mismo control lo quita.
    // Antes volvía a pedir la dirección y reaplicaba la misma comuna, dejando al usuario
    // sin una salida rápida hacia el directorio completo.
    if (selectedComuna !== 'TODAS') {
      setSelectedComuna('TODAS');
      setComunaNotice('');
      return;
    }
    if (!user?.userId) {
      setComunaNotice('Inicia sesión y registra una comuna en tu perfil para usar este filtro.');
      return;
    }
    setMyComunaLoading(true);
    setComunaNotice('');
    try {
      const addresses = await getAddressesApi(user.userId);
      const principal = (Array.isArray(addresses) ? addresses : []).find((address) => address.esPrincipal) || addresses?.[0];
      if (!principal?.comunaNombre) {
        setComunaNotice('Registra una comuna en tu perfil para usar este filtro.');
        return;
      }
      setSelectedComuna(principal.comunaNombre);
    } catch (err) {
      setComunaNotice(err.message || 'No pudimos obtener tu comuna.');
    } finally {
      setMyComunaLoading(false);
    }
  };

  // Debounce de 400ms para evitar una petición por cada tecla presionada.
  // La comuna se sincroniza junto al texto porque los dos viajan al backend.
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (searchQuery.trim()) next.set('texto', searchQuery.trim());
        else next.delete('texto');
        if (selectedComuna !== 'TODAS') next.set('comuna', selectedComuna);
        else next.delete('comuna');
        return next;
      }, { replace: true });
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery, selectedComuna, setSearchParams]);

  const backendComuna = selectedComuna !== 'TODAS' ? selectedComuna : undefined;
  // La compatibilidad con el vehiculo la resuelve el servidor: es el unico que ve el
  // inventario completo de cada tienda y el que sabe cuales repuestos son universales.
  // `catalogoId` cuando la patente se resolvio contra el catalogo (el caso normal); la marca
  // queda de respaldo para un vehiculo ingresado a mano, que no tiene fila en el catalogo.
  const backendCatalogoId = activeVehicle?.catalogoId || undefined;
  const backendMarcaVehiculo = backendCatalogoId ? undefined : (activeVehicle?.marca || undefined);

  // Página real: paginada por el servidor con texto + comuna. Es la fuente
  // por defecto mientras no haya un filtro u orden que el backend no resuelve.
  const {
    data: pageData,
    isLoading: pageLoading,
    error: pageQueryError,
  } = useQuery({
    queryKey: qk.stores({ page: currentPage, size: itemsPerPage, texto: debouncedSearchQuery, comuna: backendComuna, marcaVehiculo: backendMarcaVehiculo, catalogoId: backendCatalogoId }),
    queryFn: ({ signal }) => getPublicStoresApi({
      page: currentPage - 1, size: itemsPerPage, texto: debouncedSearchQuery, comuna: backendComuna,
      marcaVehiculo: backendMarcaVehiculo, catalogoId: backendCatalogoId, signal,
    }),
    select: (data) => adaptPage(data, adaptStore),
    placeholderData: keepPreviousData,
  });

  // Pool acotado (mismo texto/comuna, tope 100): alimenta las opciones de los
  // filtros locales y se usa para mostrarlos cuando el usuario los activa.
  const {
    data: poolItems = [],
    isLoading: poolLoading,
    error: poolQueryError,
  } = useQuery({
    queryKey: qk.stores({ pool: true, texto: debouncedSearchQuery, comuna: backendComuna, marcaVehiculo: backendMarcaVehiculo, catalogoId: backendCatalogoId }),
    queryFn: ({ signal }) => getPublicStoresApi({
      page: 0, size: FILTER_POOL_SIZE, texto: debouncedSearchQuery, comuna: backendComuna,
      marcaVehiculo: backendMarcaVehiculo, catalogoId: backendCatalogoId, signal,
    }),
    select: (data) => adaptPage(data, adaptStore).items,
    placeholderData: keepPreviousData,
  });

  const comunaOptions = useMemo(() => uniqueOptions(poolItems.map((s) => s.comuna)), [poolItems]);
  const giroOptions = useMemo(() => uniqueOptions(poolItems.map((s) => s.tipo)), [poolItems]);
  const shippingOptions = useMemo(
    () => uniqueOptions(poolItems.flatMap((s) => s.metodosEnvio || [])),
    [poolItems]
  );
  const brandOptions = useMemo(
    () => uniqueOptions(poolItems.flatMap((s) => (s.marcasEspecialistas || []).map((b) => b.nombre))),
    [poolItems]
  );

  // Solo estos filtros/orden fuerzan el modo pool: comuna y texto ya los
  // resuelve el servidor en `pageQuery`, así que no cuentan aquí. "recientes"
  // no reordena nada: el orden por defecto del backend ya es el más reciente
  // primero, así que equivale a no aplicar ningún orden en el cliente.
  // `activeVehicle` ya NO fuerza el modo pool: la compatibilidad la resuelve el servidor
  // junto con la paginacion, asi que no hay que traerse 100 tiendas para filtrarlas aca.
  const hasLocalFilters =
    selectedGiro !== 'TODAS' ||
    selectedShipping !== 'TODAS' ||
    selectedBrand !== 'TODAS' ||
    (sortBy !== 'relevancia' && sortBy !== 'recientes');
  const hasActiveStoreContext = Boolean(
    searchQuery.trim()
    || selectedGiro !== 'TODAS'
    || selectedComuna !== 'TODAS'
    || selectedShipping !== 'TODAS'
    || selectedBrand !== 'TODAS'
    || activeVehicle?.marca
    || sortBy !== 'relevancia'
  );

  const isLoading = hasLocalFilters ? poolLoading : pageLoading;
  const queryError = hasLocalFilters ? poolQueryError : pageQueryError;
  const storesError = queryError ? (queryError.message || 'No se pudo cargar el directorio de casas de repuestos.') : null;

  // Synchronize authenticated user profile photo / cover photo with their store card
  const applyUserSync = (list) => list.map(store => {
    const isCurrentUserStore =
      user &&
      (store.id === user.sellerId ||
       store.id === user.userId ||
       (user.storeName && store.nombre.toLowerCase().includes(user.storeName.toLowerCase())) ||
       (user.userName && store.nombre.toLowerCase().includes(user.userName.toLowerCase())));

    if (isCurrentUserStore) {
      return {
        ...store,
        logoUrl: user.userProfileUrl || user.logoUrl || store.logoUrl,
        userProfileUrl: user.userProfileUrl || store.userProfileUrl,
        coverUrl: user.coverUrl || store.coverUrl
      };
    }
    return store;
  });

  const pageStores = useMemo(() => applyUserSync(pageData?.items || []), [pageData, user]);
  const poolStores = useMemo(() => applyUserSync(poolItems), [poolItems, user]);

  // Filtrado sobre el pool: solo lo que el backend no resuelve (giro, envío, marca).
  const filteredPoolStores = useMemo(() => poolStores.filter(store => {
    if (selectedGiro !== 'TODAS' && store.tipo !== selectedGiro) return false;
    if (selectedShipping !== 'TODAS') {
      const methods = store.metodosEnvio || [];
      if (!methods.some(m => m.toLowerCase() === selectedShipping.toLowerCase())) return false;
    }
    if (selectedBrand !== 'TODAS') {
      const brands = (store.marcasEspecialistas || []).map(b => (b.nombre || '').toLowerCase());
      if (!brands.includes(selectedBrand.toLowerCase())) return false;
    }
    return true;
  }), [poolStores, selectedGiro, selectedShipping, selectedBrand]);

  const sortedPoolStores = useMemo(() => [...filteredPoolStores].sort((a, b) => {
    if (sortBy === '+publicaciones') return (b.totalPublicaciones || 0) - (a.totalPublicaciones || 0);
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    return 0;
  }), [filteredPoolStores, sortBy]);

  // Con filtros locales activos, se pagina el pool ya filtrado en el cliente.
  // Sin ellos, la página ya viene paginada y ordenada por el servidor.
  const totalElements = hasLocalFilters ? sortedPoolStores.length : (pageData?.total || 0);
  const totalPages = hasLocalFilters
    ? Math.max(1, Math.ceil(sortedPoolStores.length / itemsPerPage))
    : Math.max(1, pageData?.totalPages || 1);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(totalElements, currentPage * itemsPerPage);
  const paginatedStores = hasLocalFilters ? sortedPoolStores.slice(startIndex, endIndex) : pageStores;
  // El pool tiene tope 100: si el filtro local devuelve justo ese tope, puede
  // haber más tiendas que coinciden y que el pool no llegó a traer.
  const poolMayBeIncomplete = hasLocalFilters && poolItems.length >= FILTER_POOL_SIZE;

  // Reset to Page 1 on any filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedGiro, selectedComuna, selectedShipping, selectedBrand, activeVehicle?.marca, sortBy, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      const controlBar = document.querySelector('.directory-control-bar');
      if (controlBar) {
        controlBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedGiro('TODAS');
    setSelectedComuna('TODAS');
    setSelectedShipping('TODAS');
    setSelectedBrand('TODAS');
    setActiveVehicle(null);
    setPatentInput('');
    setSortBy('relevancia');
    setCurrentPage(1);
  };

  const toggleFilterSection = (section) => {
    setOpenFilterSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const handleApplyFilters = () => {
    setMobileFiltersOpen(false);
    requestAnimationFrame(() => {
      document.querySelector('.directory-stores-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="stores-directory-view-wrapper">
      {/* 1. Directory Hero Banner */}
      <div className="directory-hero-banner">
        <div className="container directory-hero-content">
          <button className="btn-back-marketplace" onClick={onBackToStore}>
            <ArrowLeft size={16} />
            <span>Volver al Inicio</span>
          </button>

          <div className="directory-hero-text">
            <div className="directory-hero-badge">
              <Building2 size={14} />
              <span>DIRECTORIO NACIONAL</span>
            </div>
            <h1>Casas de Repuestos <span>Acreditadas</span> en Chile</h1>
            <p>
              Explora más de 500 importadores, distribuidoras y desarmadurías con RUT verificado, local físico y despacho a todo el país.
            </p>
          </div>

          <div className="directory-hero-stats-row">
            <div className="stat-pill-item">
              <ShieldCheck size={24} className="text-emerald-400" />
              <span><strong>100% Casas de repuestos<br />acreditadas</strong><small>Verificadas y confiables</small></span>
            </div>
            <div className="stat-pill-item">
              <Store size={24} className="text-blue-400" />
              <span><strong>+500 Locales<br />en Chile</strong><small>Cobertura nacional</small></span>
            </div>
            <div className="stat-pill-item">
              <Truck size={24} className="text-sky-400" />
              <span><strong>Despacho Directo<br />o Retiro</strong><small>En todo el país</small></span>
            </div>
            <div className="stat-pill-item">
              <CheckCircle2 size={24} className="text-purple-400" />
              <span><strong>RUT Verificado<br />y Validado</strong><small>Seguridad garantizada</small></span>
            </div>
          </div>
        </div>
      </div>

      <div className={`container directory-main-container ${mobileFiltersOpen ? 'mobile-filters-active' : ''}`}>
        {/* 2. Top Control Bar (Search & Sort) */}
        <div className="directory-control-bar">
          <div className="search-bar-directory-box">
            <Search size={18} className="search-box-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre de tienda, RUT, ciudad o especialidad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-directory-input"
            />
            {searchQuery && (
              <button className="btn-clear-search-dir" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="directory-vehicle-filters catalog-vehicle-location-filters">
            <div className="catalog-showcase-patente-control">
              {activeVehicle ? (
                <div className="catalog-showcase-vehicle-filter directory-active-vehicle">
                  <Car size={18} />
                  <span><strong>{activeVehicle.marca} {activeVehicle.modelo}</strong>{activeVehicle.patente && activeVehicle.patente !== 'MANUAL' ? ` · ${activeVehicle.patente}` : ''}</span>
                  <button type="button" onClick={() => { setActiveVehicle(null); setSelectedBrand('TODAS'); setPatentInput(''); }} title="Quitar filtro de vehículo">
                    <X size={15} /> Quitar filtro
                  </button>
                </div>
              ) : (
                <div className="catalog-quick-patente-bar directory-patente-search">
                  <CarFront size={18} className="patente-icon" />
                  <input
                    type="text"
                    placeholder="Patente (ABCD-12)"
                    aria-label="Ingresa tu patente"
                    value={patentInput}
                    onChange={(e) => { setPatentInput(sanitizePlateInput(e.target.value)); setPatentError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handlePatentSearch()}
                    className="patente-quick-input"
                    maxLength={8}
                  />
                  <button type="button" className="btn-quick-patente-submit" onClick={handlePatentSearch} disabled={patentSearching}>
                    {patentSearching ? <RefreshCw size={15} className="spin-icon" /> : 'Buscar'}
                  </button>
                  {patentError && <span className="quick-patente-error">{patentError}</span>}
                </div>
              )}
            </div>

            <div className="catalog-showcase-comuna-control directory-my-comuna-wrap">
              <button
                type="button"
                className={`btn-comuna-toggle-pill directory-my-comuna ${selectedComuna !== 'TODAS' ? 'active' : ''}`}
                onClick={handleMyComuna}
                disabled={myComunaLoading}
                aria-pressed={selectedComuna !== 'TODAS'}
                title={selectedComuna !== 'TODAS' ? 'Quitar filtro de comuna' : 'Filtrar por mi comuna'}
              >
                <MapPin size={17} />
                <span>{myComunaLoading ? 'Buscando comuna…' : selectedComuna !== 'TODAS' ? `En ${selectedComuna}` : 'Mi comuna'}</span>
              </button>
              {comunaNotice && <span className="quick-patente-error">{comunaNotice}</span>}
            </div>
          </div>
        </div>

        {mobileFiltersOpen && <button type="button" className="catalog-mobile-filter-backdrop" onClick={() => setMobileFiltersOpen(false)} aria-label="Cerrar filtros" />}
        <div className="directory-content-grid directory-advanced-content-grid">
          {/* Sidebar Filters Column (Left 280px) */}
          <aside id="directory-filter-panel" className={`directory-sidebar-filters catalog-sidebar-filters catalog-advanced-filter-panel directory-advanced-filter-panel ${mobileFiltersOpen ? 'mobile-filters-open' : ''}`}>
            <button type="button" className="catalog-mobile-filter-close" onClick={() => setMobileFiltersOpen(false)} aria-label="Cerrar filtros"><X size={20} /> Cerrar</button>
            <div className="sidebar-filters-header">
              <div className="sidebar-title-group">
                <SlidersHorizontal size={25} />
                <span><strong>Filtros Avanzados</strong><small>Encuentra la tienda ideal para tu compra</small></span>
              </div>

              <button className="btn-reset-filters-mini" onClick={handleResetFilters}><RotateCcw size={15} /><span>Limpiar</span></button>
            </div>

            {/* Filter 1: Tipo / Giro de Tienda — construido con los giros que
                declararon las tiendas reales, no una lista fija */}
            <div className={`filter-section-group ${openFilterSections.business ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('business')} aria-expanded={openFilterSections.business}>
                <span className="filter-group-label"><Building2 size={13} /> Tipo de Empresa / Giro</span><ChevronDown size={16} />
              </button>
              {openFilterSections.business && <div className="filter-options-list">
                {['TODAS', ...giroOptions].map((type) => (
                  <button key={type} className={`filter-option-btn ${selectedGiro === type ? 'active' : ''}`} onClick={() => setSelectedGiro(type)}>
                    <span className="filter-condition-icon"><Building2 size={14} /></span>
                    <span className="filter-option-copy"><strong>{type === 'TODAS' ? 'Todas las casas de repuestos' : type}</strong><small>{type === 'TODAS' ? 'Explorar todo el directorio' : 'Casas de repuestos verificadas'}</small></span>
                    {selectedGiro === type ? <CheckCircle2 size={18} className="check-active" /> : <ChevronRight size={16} className="filter-option-chevron" />}
                  </button>
                ))}
              </div>}
            </div>

            {/* Filter 2: Comuna — el único filtro (junto al texto) que el
                backend resuelve de verdad; escala sin el tope de 100 del pool */}
            <div className="filter-section-group compact-select-section">
              <label className="filter-group-label"><MapPin size={13} /> Comuna</label>
              <select
                value={selectedComuna}
                onChange={(e) => setSelectedComuna(e.target.value)}
                className="sidebar-select-input"
              >
                <option value="TODAS">Todas las comunas</option>
                {comunaOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Filter 3: Métodos de Envío — igual, construido desde el pool */}
            <div className={`filter-section-group ${openFilterSections.shipping ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('shipping')} aria-expanded={openFilterSections.shipping}>
                <span className="filter-group-label"><Truck size={13} /> Método de Envío</span><ChevronDown size={16} />
              </button>
              {openFilterSections.shipping && <div className="filter-options-list">
                {['TODAS', ...shippingOptions].map((method) => {
                  const shippingConfig = method === 'TODAS' ? { icon: Truck, label: 'Todos los servicios' } : getShippingIconConfig(method);
                  const ShippingIcon = shippingConfig.icon;
                  return <button key={method} className={`filter-option-btn ${selectedShipping === method ? 'active' : ''}`} onClick={() => setSelectedShipping(method)}>
                    <span className="filter-condition-icon"><ShippingIcon size={14} /></span>
                    <span className="filter-option-copy"><strong>{method === 'TODAS' ? 'Todos los Métodos' : method}</strong><small>{method === 'TODAS' ? 'Retiro y despacho disponibles' : shippingConfig.label}</small></span>
                    {selectedShipping === method && <CheckCircle2 size={18} className="check-active" />}
                  </button>;
                })}
              </div>}
            </div>

            {/* Filter 4: Marcas — desde marcasEspecialistas real de cada tienda */}
            <div className="filter-section-group compact-select-section">
              <label className="filter-group-label"><Tag size={13} /> Marcas que Comercializa</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="sidebar-select-input"
              >
                <option value="TODAS">Todas las marcas</option>
                {brandOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <button className="btn-clear-all-filters-wide" onClick={handleApplyFilters}>
              <Search size={18} />
              <span>Aplicar filtros y ver casas de repuestos</span>
            </button>
            <p className="filter-security-note"><ShieldCheck size={14} /> Solo mostramos casas de repuestos verificadas.</p>
          </aside>

          {/* Stores Cards Column (Right Grid) */}
          <main className="directory-stores-main">
            <div className="directory-stores-section-header">
              <div>
                <h2>Casas de repuestos recién publicadas</h2>
                {hasActiveStoreContext ? (
                  <p>
                    Mostrando <strong>{totalElements}</strong> casas de repuestos encontradas.
                    {poolMayBeIncomplete && ' Puede haber más resultados: afina la búsqueda o la comuna para verlos todos.'}
                  </p>
                ) : (
                  <p>Explora casas de repuestos verificadas y encuentra la especialista ideal para tus repuestos.</p>
                )}
              </div>
              <div className="sort-dropdown-box directory-stores-sort">
                <span className="sort-label">Ordenar por:</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select-input" aria-label="Ordenar casas de repuestos">
                  <option value="relevancia">Recomendados</option>
                  <option value="+publicaciones">Más publicaciones en stock</option>
                  <option value="rating">Mejor calificación</option>
                  <option value="recientes">Ingresadas recientemente</option>
                </select>
              </div>
            </div>

            {/* Mobile Actions Row (Search + Filter + Sort) right below title and description */}
            <div className="catalog-mobile-actions-row">
              <div className="catalog-text-search">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  placeholder="Buscar casas de repuestos..."
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Buscar casas de repuestos por texto"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="catalog-mobile-filter-trigger"
                onClick={() => setMobileFiltersOpen(true)}
                aria-controls="directory-filter-panel"
                aria-expanded={mobileFiltersOpen}
              >
                <SlidersHorizontal size={18} /> Filtro
              </button>
              <label className="catalog-mobile-sort-trigger" title="Ordenar casas de repuestos">
                <ArrowUpDown size={20} aria-hidden="true" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Ordenar casas de repuestos"
                >
                  <option value="relevancia">Recomendados</option>
                  <option value="+publicaciones">Más publicaciones en stock</option>
                  <option value="rating">Mejor calificación</option>
                  <option value="recientes">Ingresadas recientemente</option>
                </select>
              </label>
            </div>

            {isLoading ? (
              <div className="stores-cards-grid-directory" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <StoreCardSkeleton key={i} />
                ))}
              </div>
            ) : storesError ? (
              <div className="directory-empty-state">
                <Building2 size={56} className="empty-icon-gray" />
                <h3>No se pudo cargar el directorio</h3>
                <p>{storesError}</p>
              </div>
            ) : paginatedStores.length > 0 ? (
              <>
                <div className={`stores-cards-grid-directory ${paginatedStores.length < 4 ? 'is-incomplete-row' : ''}`}>
                  {paginatedStores.map((store) => {
                    const avatarPhoto = store.logoUrl || store.userProfileUrl || store.imagenUrl;

                    return (
                      <MarketplaceSellerCard
                        key={store.id}
                        store={store}
                        avatarPhoto={avatarPhoto}
                        onView={onSelectStore}
                        isFavorite={isStoreSaved(store.id)}
                        onToggleFavorite={(storeData) => {
                          if (!user) { openAuthModal(); return; }
                          toggleStore(storeData);
                        }}
                        vehicleBrand={activeVehicle?.marca || null}
                        vehicleResolved={Boolean(activeVehicle?.catalogoId)}
                      />
                    );
                  })}
                </div>

                <PaginationBar
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  rangeStart={startIndex + 1}
                  rangeEnd={endIndex}
                  totalItems={totalElements}
                  itemLabel="casas de repuestos"
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={setItemsPerPage}
                  perPageOptions={[6, 12, 24]}
                />
              </>
            ) : (
              /* Empty Filter State */
              <div className="directory-empty-state">
                <Building2 size={56} className="empty-icon-gray" />
                <h3>No se encontraron casas de repuestos con estos filtros</h3>
                <p>Intenta cambiar los filtros seleccionados o realiza una nueva búsqueda por nombre de tienda o ciudad.</p>
                <button className="btn-reset-filters-large" onClick={handleResetFilters}>
                  <RotateCcw size={16} />
                  <span>Limpiar Filtros y Ver Todas</span>
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
