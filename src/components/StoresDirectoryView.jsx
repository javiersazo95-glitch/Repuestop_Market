import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, Search, Filter, SlidersHorizontal, MapPin, ShieldCheck,
  Star, ArrowLeft, X, CheckCircle2, RotateCcw,
  Tag, Truck, Bike, ChevronRight, ChevronDown, Car, CarFront, RefreshCw, ArrowUpDown
} from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import { getShippingIconConfig } from './NewOnboardedStoresSection';
import { useAuth } from '../context/AuthContext';
import { getAddressesApi, getPublicStoreFilterOptionsApi, getPublicStoresApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptPage, adaptStore, adaptVehicle } from '../services/adapters';
import { normalizePlate, sanitizePlateInput, isValidPlate } from '../utils/vehicleLookup';
import MarketplaceSellerCard from './MarketplaceSellerCard';
import storesBannerDesktop from '../assets/stores-directory-banner-desktop.webp';
import storesBannerMobileArt from '../assets/stores-directory-banner-mobile-art.webp';
import StoreCardSkeleton from './skeletons/StoreCardSkeleton';
import PaginationBar from './PaginationBar';
import { useSavedMarketplaceItems } from '../hooks/useSavedMarketplaceItems';
import { useMarketplace } from '../context/MarketplaceContext';
import { useUserLocation } from '../hooks/useUserLocation';
import { distanceKmTo, sortByDistance } from '../utils/geoDistance';

/**
 * /tiendas/publicas topea `size` en 100 y no sabe ordenar por publicaciones, calificación ni
 * distancia. Por eso hay dos consultas, igual que en la app móvil:
 * - `pageQuery`: la página real, paginada por el servidor con texto, vehículo y TODOS los
 *   filtros del panel (comuna, giro, método de envío, marca). Total y páginas son exactos
 *   sobre todas las tiendas: la tienda 150 se ve igual que la 5.
 * - `poolQuery`: solo con un orden que el backend no resuelve (más publicaciones, mejor
 *   calificación o cercanía). Trae hasta 100 tiendas con esos mismos filtros y las ordena y
 *   pagina en el cliente; si llega al tope, el contador avisa que puede haber más.
 * Las opciones del panel y sus conteos salen de /tiendas/publicas/opciones-filtro, sobre todas
 * las tiendas, no de las tiendas cargadas.
 */
const SORT_POOL_SIZE = 100;

/** Items { nombre, tiendas } del backend al formato { value, count } del panel. */
function toCountedOptions(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.nombre)
    .map((item) => ({ value: item.nombre, count: item.tiendas ?? 0 }));
}

/** El valor elegido se mantiene visible aunque ya no tenga tiendas (p. ej. viene de la URL). */
function keepSelectedOption(options, selected) {
  if (selected === 'TODAS' || options.some((option) => option.value.toLowerCase() === selected.toLowerCase())) return options;
  return [{ value: selected, count: 0 }, ...options];
}

const optionText = (option) => `${option.value} (${option.count})`;

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
  // "Cerca de mí" con la ubicación del navegador, igual que la app: distancia en cada card y
  // orden de la más cercana a la más lejana. Sin ubicación cae al filtro "mi comuna" de antes.
  const userLocation = useUserLocation();
  const [isNearbySortActive, setIsNearbySortActive] = useState(false);
  const isLocating = userLocation.status === 'loading';

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

  const handleNearby = async () => {
    // Interruptor: el mismo control quita el orden por cercanía o el filtro de comuna.
    if (isNearbySortActive) {
      setIsNearbySortActive(false);
      setComunaNotice('');
      return;
    }
    if (selectedComuna !== 'TODAS') {
      setSelectedComuna('TODAS');
      setComunaNotice('');
      return;
    }
    const coords = userLocation.coords || await userLocation.requestLocation();
    if (coords) {
      setIsNearbySortActive(true);
      setComunaNotice('');
      return;
    }
    await handleMyComuna({ fallback: true });
  };

  const handleMyComuna = async ({ fallback = false } = {}) => {
    // Es un interruptor: si el filtro ya está aplicado, el mismo control lo quita.
    // Antes volvía a pedir la dirección y reaplicaba la misma comuna, dejando al usuario
    // sin una salida rápida hacia el directorio completo.
    if (selectedComuna !== 'TODAS') {
      setSelectedComuna('TODAS');
      setComunaNotice('');
      return;
    }
    if (fallback && !user?.userId) {
      setComunaNotice('Activa el permiso de ubicación del navegador para ver las casas de repuestos más cercanas.');
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
      if (fallback) setComunaNotice(`No pudimos usar tu ubicación: mostrando casas de repuestos en ${principal.comunaNombre}.`);
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
  const backendAnioVehiculo = backendCatalogoId ? activeVehicle?.anio || undefined : undefined;
  const backendMarcaVehiculo = backendCatalogoId ? undefined : (activeVehicle?.marca || undefined);

  // Filtros del panel que resuelve el servidor (coincidencia exacta sin mayúsculas).
  const serverFilters = {
    texto: debouncedSearchQuery,
    comuna: backendComuna,
    giro: selectedGiro !== 'TODAS' ? selectedGiro : undefined,
    metodoEnvio: selectedShipping !== 'TODAS' ? selectedShipping : undefined,
    marcaEspecialista: selectedBrand !== 'TODAS' ? selectedBrand : undefined,
    marcaVehiculo: backendMarcaVehiculo,
    catalogoId: backendCatalogoId,
    anioVehiculo: backendAnioVehiculo,
  };

  // "recientes" no reordena: el backend ya entrega lo más reciente primero. Ordenar por
  // cercanía solo la página actual engañaría (6 de 100), así que también usa el pool.
  const needsClientSort = (sortBy !== 'relevancia' && sortBy !== 'recientes') || isNearbySortActive;

  const {
    data: pageData,
    isLoading: pageLoading,
    error: pageQueryError,
  } = useQuery({
    queryKey: qk.stores({ page: currentPage, size: itemsPerPage, ...serverFilters }),
    queryFn: ({ signal }) => getPublicStoresApi({ page: currentPage - 1, size: itemsPerPage, ...serverFilters, signal }),
    select: (data) => adaptPage(data, adaptStore),
    placeholderData: keepPreviousData,
    enabled: !needsClientSort,
  });

  const {
    data: poolItems = [],
    isLoading: poolLoading,
    error: poolQueryError,
  } = useQuery({
    queryKey: qk.stores({ pool: true, ...serverFilters }),
    queryFn: ({ signal }) => getPublicStoresApi({ page: 0, size: SORT_POOL_SIZE, ...serverFilters, signal }),
    select: (data) => adaptPage(data, adaptStore).items,
    placeholderData: keepPreviousData,
    enabled: needsClientSort,
  });

  // Opciones y conteos sobre todas las tiendas: ignoran lo elegido en el panel (si no, al
  // elegir una comuna quedaría una sola opción) y respetan el texto y el vehículo.
  const { data: filterOptions = null } = useQuery({
    queryKey: qk.storeFilterOptions({
      texto: debouncedSearchQuery, marcaVehiculo: backendMarcaVehiculo, catalogoId: backendCatalogoId, anioVehiculo: backendAnioVehiculo,
    }),
    queryFn: ({ signal }) => getPublicStoreFilterOptionsApi({
      texto: debouncedSearchQuery, marcaVehiculo: backendMarcaVehiculo, catalogoId: backendCatalogoId, anioVehiculo: backendAnioVehiculo, signal,
    }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  const comunaOptions = useMemo(
    () => keepSelectedOption(toCountedOptions(filterOptions?.comunas), selectedComuna),
    [filterOptions, selectedComuna]
  );
  const giroOptions = useMemo(
    () => keepSelectedOption(toCountedOptions(filterOptions?.giros), selectedGiro),
    [filterOptions, selectedGiro]
  );
  const shippingOptions = useMemo(
    () => keepSelectedOption(toCountedOptions(filterOptions?.metodosEnvio), selectedShipping),
    [filterOptions, selectedShipping]
  );
  const brandOptions = useMemo(
    () => keepSelectedOption(toCountedOptions(filterOptions?.marcasEspecialistas), selectedBrand),
    [filterOptions, selectedBrand]
  );

  const hasActiveStoreContext = Boolean(
    searchQuery.trim()
    || selectedGiro !== 'TODAS'
    || selectedComuna !== 'TODAS'
    || selectedShipping !== 'TODAS'
    || selectedBrand !== 'TODAS'
    || activeVehicle?.marca
    || sortBy !== 'relevancia'
    || isNearbySortActive
  );

  const isLoading = needsClientSort ? poolLoading : pageLoading;
  const queryError = needsClientSort ? poolQueryError : pageQueryError;
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

  const sortedPoolStores = useMemo(() => {
    if (isNearbySortActive && userLocation.coords) {
      return sortByDistance(poolStores, (store) => distanceKmTo(userLocation.coords, store));
    }
    return [...poolStores].sort((a, b) => {
      if (sortBy === '+publicaciones') return (b.totalPublicaciones || 0) - (a.totalPublicaciones || 0);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return 0;
    });
  }, [poolStores, isNearbySortActive, sortBy, userLocation.coords]);

  // Con un orden local se pagina el pool ya ordenado en el cliente; si no, la página ya
  // viene filtrada, paginada y ordenada por el servidor.
  const totalElements = needsClientSort ? sortedPoolStores.length : (pageData?.total || 0);
  const totalPages = needsClientSort
    ? Math.max(1, Math.ceil(sortedPoolStores.length / itemsPerPage))
    : Math.max(1, pageData?.totalPages || 1);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(totalElements, currentPage * itemsPerPage);
  const paginatedStores = needsClientSort ? sortedPoolStores.slice(startIndex, endIndex) : pageStores;
  // El pool tiene tope 100: si lo alcanza, puede haber más tiendas que coinciden y que el
  // orden local no llegó a ver.
  const poolMayBeIncomplete = needsClientSort && poolItems.length >= SORT_POOL_SIZE;

  // Reset to Page 1 on any filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedGiro, selectedComuna, selectedShipping, selectedBrand, activeVehicle?.marca, sortBy, itemsPerPage, isNearbySortActive]);

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
    setIsNearbySortActive(false);
    setComunaNotice('');
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
      {/* 1. Banner del directorio. Escritorio: pieza gráfica completa (texto incluido en la
          imagen). Celular: el mismo banner de la app (DirectoryHero de mobile/app/store-directory):
          tarjeta azul marino con el título como texto real y la ilustración de las casas a la
          derecha, porque la pieza de escritorio queda ilegible a 360px. */}
      <section className="stores-directory-banner" aria-labelledby="stores-directory-title">
        <h1 id="stores-directory-title" className="sr-only">Casas de repuestos verificadas en Chile</h1>
        <div className="stores-directory-banner-desktop">
          <img className="stores-directory-banner-desktop-fill" src={storesBannerDesktop} alt="" aria-hidden="true" />
          <img
            className="stores-directory-banner-desktop-img"
            src={storesBannerDesktop}
            alt="Casas de repuestos - Encuentra casas de repuestos adheridas a Repuestop en todo Chile"
            width="2000"
            height="750"
            fetchPriority="high"
          />
          <button className="stores-directory-banner-back" onClick={onBackToStore}>
            <ArrowLeft size={16} />
            <span>Volver al Inicio</span>
          </button>
        </div>
        <div className="stores-directory-banner-mobile" aria-hidden="true">
          <img src={storesBannerMobileArt} alt="" className="stores-directory-banner-mobile-art" />
          <div className="stores-directory-banner-mobile-copy">
            <strong>Casas de repuestos</strong>
            <span><ShieldCheck size={18} /> Casas verificadas cerca de ti</span>
          </div>
        </div>
      </section>

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
                className={`btn-comuna-toggle-pill directory-my-comuna ${isNearbySortActive || selectedComuna !== 'TODAS' ? 'active' : ''}`}
                onClick={handleNearby}
                disabled={myComunaLoading || isLocating}
                aria-pressed={isNearbySortActive || selectedComuna !== 'TODAS'}
                title={isNearbySortActive
                  ? 'Quitar el orden por cercanía'
                  : selectedComuna !== 'TODAS' ? 'Quitar filtro de comuna' : 'Ver las casas de repuestos más cercanas a mi ubicación'}
              >
                {isLocating ? <RefreshCw size={16} className="spin-icon" /> : <MapPin size={17} />}
                <span>
                  {isLocating ? 'Buscando tu ubicación…'
                    : myComunaLoading ? 'Buscando comuna…'
                      : isNearbySortActive ? 'Más cercanas'
                        : selectedComuna !== 'TODAS' ? `En ${selectedComuna}` : 'Cerca de mí'}
                </span>
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
                {[{ value: 'TODAS' }, ...giroOptions].map(({ value: type, count }) => (
                  <button key={type} className={`filter-option-btn ${selectedGiro === type ? 'active' : ''}`} onClick={() => setSelectedGiro(type)}>
                    <span className="filter-condition-icon"><Building2 size={14} /></span>
                    <span className="filter-option-copy"><strong>{type === 'TODAS' ? 'Todas las casas de repuestos' : type}{count != null && <span className="filter-option-count"> ({count})</span>}</strong><small>{type === 'TODAS' ? 'Explorar todo el directorio' : 'Casas de repuestos verificadas'}</small></span>
                    {selectedGiro === type ? <CheckCircle2 size={18} className="check-active" /> : <ChevronRight size={16} className="filter-option-chevron" />}
                  </button>
                ))}
              </div>}
            </div>

            {/* Filter 2: Comuna, con el conteo de tiendas de todo el directorio */}
            <div className="filter-section-group compact-select-section">
              <label className="filter-group-label"><MapPin size={13} /> Comuna</label>
              <select
                value={selectedComuna}
                onChange={(e) => setSelectedComuna(e.target.value)}
                className="sidebar-select-input"
              >
                <option value="TODAS">Todas las comunas</option>
                {comunaOptions.map((c) => (
                  <option key={c.value} value={c.value}>{optionText(c)}</option>
                ))}
              </select>
            </div>

            {/* Filter 3: Métodos de Envío declarados por las tiendas, con su conteo */}
            <div className={`filter-section-group ${openFilterSections.shipping ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('shipping')} aria-expanded={openFilterSections.shipping}>
                <span className="filter-group-label"><Truck size={13} /> Método de Envío</span><ChevronDown size={16} />
              </button>
              {openFilterSections.shipping && <div className="filter-options-list">
                {[{ value: 'TODAS' }, ...shippingOptions].map(({ value: method, count }) => {
                  const shippingConfig = method === 'TODAS' ? { icon: Truck, label: 'Todos los servicios' } : getShippingIconConfig(method);
                  const ShippingIcon = shippingConfig.icon;
                  return <button key={method} className={`filter-option-btn ${selectedShipping === method ? 'active' : ''}`} onClick={() => setSelectedShipping(method)}>
                    <span className="filter-condition-icon"><ShippingIcon size={14} /></span>
                    <span className="filter-option-copy"><strong>{method === 'TODAS' ? 'Todos los Métodos' : method}{count != null && <span className="filter-option-count"> ({count})</span>}</strong><small>{method === 'TODAS' ? 'Retiro y despacho disponibles' : shippingConfig.label}</small></span>
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
                  <option key={b.value} value={b.value}>{optionText(b)}</option>
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
                    Mostrando <strong>{totalElements}</strong> casas de repuestos encontradas
                    {isNearbySortActive ? ', de la más cercana a la más lejana' : ''}.
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
                        distanceKm={isNearbySortActive ? distanceKmTo(userLocation.coords, store) : null}
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
