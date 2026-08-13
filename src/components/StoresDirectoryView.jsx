import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, Search, Filter, SlidersHorizontal, MapPin, ShieldCheck,
  Star, ArrowLeft, X, CheckCircle2, RotateCcw,
  Store, Tag, Truck, Bike, ChevronLeft, ChevronRight, ChevronDown, Car
} from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import { getShippingIconConfig } from './NewOnboardedStoresSection';
import { useAuth } from '../context/AuthContext';
import { getPublicStoresApi } from '../services/api';
import { adaptPage, adaptStore } from '../services/adapters';
import MarketplaceSellerCard from './MarketplaceSellerCard';

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

  // Página real: paginada por el servidor con texto + comuna. Es la fuente
  // por defecto mientras no haya un filtro u orden que el backend no resuelve.
  const {
    data: pageData,
    isLoading: pageLoading,
    error: pageQueryError,
  } = useQuery({
    queryKey: qk.stores({ page: currentPage, size: itemsPerPage, texto: debouncedSearchQuery, comuna: backendComuna }),
    queryFn: ({ signal }) => getPublicStoresApi({
      page: currentPage - 1, size: itemsPerPage, texto: debouncedSearchQuery, comuna: backendComuna, signal,
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
    queryKey: qk.stores({ pool: true, texto: debouncedSearchQuery, comuna: backendComuna }),
    queryFn: ({ signal }) => getPublicStoresApi({
      page: 0, size: FILTER_POOL_SIZE, texto: debouncedSearchQuery, comuna: backendComuna, signal,
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
  const hasLocalFilters =
    selectedGiro !== 'TODAS' ||
    selectedShipping !== 'TODAS' ||
    selectedBrand !== 'TODAS' ||
    (sortBy !== 'relevancia' && sortBy !== 'recientes');

  const isLoading = hasLocalFilters ? poolLoading : pageLoading;
  const queryError = hasLocalFilters ? poolQueryError : pageQueryError;
  const storesError = queryError ? (queryError.message || 'No se pudo cargar el directorio de tiendas.') : null;

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
  }, [searchQuery, selectedGiro, selectedComuna, selectedShipping, selectedBrand, sortBy, itemsPerPage]);

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
    setSortBy('relevancia');
    setCurrentPage(1);
  };

  const toggleFilterSection = (section) => {
    setOpenFilterSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const handleApplyFilters = () => {
    document.querySelector('.directory-stores-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
              <span><strong>100% Tiendas<br />Acreditadas</strong><small>Verificadas y confiables</small></span>
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

      <div className="container directory-main-container">
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

          <div className="control-bar-right-group">
            <div className="results-count-badge">
              <span>Mostrando <strong>{totalElements}</strong> tiendas encontradas</span>
              {poolMayBeIncomplete && (
                <small className="results-count-note">
                  Puede haber más resultados: afina la búsqueda o la comuna para verlos todos.
                </small>
              )}
            </div>

            <div className="sort-dropdown-box">
              <span className="sort-label">Ordenar:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select-input">
                <option value="relevancia">Recomendados / Relevancia</option>
                <option value="+publicaciones">Más Publicaciones en Stock</option>
                <option value="rating">Mejor Calificación (Rating)</option>
                <option value="recientes">Ingresadas Recientemente</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Main 2-Column Content Layout (Sidebar Filters + Stores Grid) */}
        <div className="directory-content-grid directory-advanced-content-grid">
          {/* Sidebar Filters Column (Left 280px) */}
          <aside className="directory-sidebar-filters catalog-sidebar-filters catalog-advanced-filter-panel directory-advanced-filter-panel">
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
                    <span className="filter-option-copy"><strong>{type === 'TODAS' ? 'Todas las Tiendas' : type}</strong><small>{type === 'TODAS' ? 'Explorar todo el directorio' : 'Tiendas verificadas'}</small></span>
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
              <span>Aplicar Filtros y Ver Tiendas</span>
            </button>
            <p className="filter-security-note"><ShieldCheck size={14} /> Solo mostramos tiendas verificadas.</p>
          </aside>

          {/* Stores Cards Column (Right Grid) */}
          <main className="directory-stores-main">
            {isLoading ? (
              <div className="directory-empty-state">
                <Building2 size={56} className="empty-icon-gray" />
                <h3>Cargando tiendas…</h3>
                <p>Consultando el directorio de casas de repuestos acreditadas.</p>
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
                      />
                    );
                  })}
                </div>

                {/* 4. Pagination Bar */}
                <div className="directory-pagination-bar">
                  <div className="pagination-info">
                    <span>
                      Mostrando del <strong>{startIndex + 1}</strong> al <strong>{endIndex}</strong> de <strong>{totalElements}</strong> tiendas (Página {currentPage} de {totalPages})
                    </span>
                  </div>

                  <div className="pagination-controls-group">
                    <div className="per-page-selector">
                      <span>Ver:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="select-per-page"
                      >
                        <option value={6}>6 tiendas</option>
                        <option value={12}>12 tiendas</option>
                        <option value={24}>24 tiendas</option>
                      </select>
                    </div>

                    <div className="page-buttons-list">
                      <button
                        className="btn-page-nav"
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                        title="Página Anterior"
                      >
                        <ChevronLeft size={16} />
                        <span>Anterior</span>
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          className={`btn-page-number ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        className="btn-page-nav"
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                        title="Página Siguiente"
                      >
                        <span>Siguiente</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Empty Filter State */
              <div className="directory-empty-state">
                <Building2 size={56} className="empty-icon-gray" />
                <h3>No se encontraron tiendas con estos filtros</h3>
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
