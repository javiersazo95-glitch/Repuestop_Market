import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, Search, Filter, SlidersHorizontal, MapPin, ShieldCheck,
  Star, ArrowLeft, X, CheckCircle2, RotateCcw,
  Store, Tag, Truck, Bike, Globe, ChevronLeft, ChevronRight, ChevronDown, Car, Wrench
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import { getShippingIconConfig } from './NewOnboardedStoresSection';
import { useAuth } from '../context/AuthContext';
import { getPublicStoresApi } from '../services/api';
import { adaptPage, adaptStore } from '../services/adapters';
import MarketplaceSellerCard from './MarketplaceSellerCard';

// El backend acota el tamaño de página a 100. El directorio filtra y pagina en
// cliente, así que se trae un bloque grande y se deja que la UI haga el resto.
const STORES_FETCH_SIZE = 100;

export default function StoresDirectoryView({ onBackToStore, onSelectStore }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('texto') || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [selectedCategoryType, setSelectedCategoryType] = useState('TODAS');
  const [selectedRegion, setSelectedRegion] = useState('TODAS');
  const [selectedShipping, setSelectedShipping] = useState('TODAS');
  const [selectedBrand, setSelectedBrand] = useState('TODAS');
  const [sortBy, setSortBy] = useState('relevancia');
  const [openFilterSections, setOpenFilterSections] = useState({ business: true, shipping: true });

  // Debounce de 400ms para evitar una petición por cada tecla presionada
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (searchQuery.trim()) {
          next.set('texto', searchQuery.trim());
        } else {
          next.delete('texto');
        }
        return next;
      }, { replace: true });
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery, setSearchParams]);

  // TanStack Query: Cargas en caché, cancelables, deduplicadas y con texto al servidor
  const { data: stores = [], isLoading: storesLoading, error: queryError } = useQuery({
    queryKey: qk.stores({ size: STORES_FETCH_SIZE, texto: debouncedSearchQuery }),
    queryFn: ({ signal }) => getPublicStoresApi({ page: 0, size: STORES_FETCH_SIZE, texto: debouncedSearchQuery, signal }),
    select: (data) => adaptPage(data, adaptStore).items,
  });

  const storesError = queryError ? (queryError.message || 'No se pudo cargar el directorio de tiendas.') : null;

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  // Filter options list
  const CATEGORY_TYPES = [
    'TODAS',
    'Importador y Distribuidor Directo',
    'Casa de Repuestos Multimarca',
    'Desarmaduría Certificada',
    'Distribuidor Oficial de Marca'
  ];

  const REGIONS = [
    'TODAS',
    'Santiago, RM',
    'Concepción, Biobío',
    'San Antonio, Valparaíso',
    'Antofagasta'
  ];

  const SHIPPING_OPTIONS = [
    'TODAS',
    'Retiro en tienda',
    'Envío dentro de la comuna',
    'Envío fuera de la comuna'
  ];

  const BRANDS = [
    'TODAS',
    'Toyota',
    'Nissan',
    'Hyundai',
    'Chevrolet',
    'Ford',
    'Volkswagen'
  ];

  // Reset to Page 1 on any filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategoryType, selectedRegion, selectedShipping, selectedBrand, sortBy, itemsPerPage]);

  // Synchronize authenticated user profile photo / cover photo with their store card
  const getSyncedStores = () => {
    return stores.map(store => {
      const isCurrentUserStore =
        user &&
        (store.id === user.sellerId ||
         store.id === user.userId ||
         store.id === 'store-tiensoft' ||
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
  };

  const syncedStores = getSyncedStores();

  // Filtering Logic
  const filteredStores = syncedStores.filter(store => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = store.nombre?.toLowerCase().includes(q);
      const matchRut = store.rut?.toLowerCase().includes(q);
      const matchCity = store.ciudad?.toLowerCase().includes(q);
      const matchSpec = store.especialidad?.toLowerCase().includes(q);
      const matchType = store.tipo?.toLowerCase().includes(q);
      if (!matchName && !matchRut && !matchCity && !matchSpec && !matchType) {
        return false;
      }
    }

    if (selectedCategoryType !== 'TODAS' && store.tipo !== selectedCategoryType) {
      return false;
    }

    if (selectedRegion !== 'TODAS' && store.ciudad !== selectedRegion) {
      return false;
    }

    if (selectedShipping !== 'TODAS') {
      const methods = store.metodosEnvio || [];
      const hasMethod = methods.some(m => m.toLowerCase().includes(selectedShipping.toLowerCase()));
      if (!hasMethod) return false;
    }

    if (selectedBrand !== 'TODAS') {
      const specs = (store.especialidad || '').toLowerCase();
      if (!specs.includes(selectedBrand.toLowerCase())) return false;
    }

    return true;
  });

  // Sorting Logic
  const sortedStores = [...filteredStores].sort((a, b) => {
    if (sortBy === '+publicaciones') {
      return (b.totalPublicaciones || 0) - (a.totalPublicaciones || 0);
    }
    if (sortBy === 'rating') {
      return (b.rating || 0) - (a.rating || 0);
    }
    if (sortBy === 'recientes') {
      return b.id === 'store-tiensoft' ? -1 : 1;
    }
    return 0;
  });

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(sortedStores.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(sortedStores.length, currentPage * itemsPerPage);
  const paginatedStores = sortedStores.slice(startIndex, endIndex);

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
    setSelectedCategoryType('TODAS');
    setSelectedRegion('TODAS');
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

  const businessTypeIcon = (index) => {
    if (index === 0) return SlidersHorizontal;
    if (index === 1) return Globe;
    if (index === 2) return Store;
    if (index === 3) return Wrench;
    return ShieldCheck;
  };

  function parseSpecialties(raw) {
    if (!raw) return ['Toyota', 'Nissan', 'Hyundai'];
    return String(raw)
      .split(/[,·]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

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
              <span>Mostrando <strong>{sortedStores.length}</strong> tiendas encontradas</span>
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

            {/* Filter 1: Tipo / Giro de Tienda */}
            <div className={`filter-section-group ${openFilterSections.business ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('business')} aria-expanded={openFilterSections.business}>
                <span className="filter-group-label"><Building2 size={13} /> Tipo de Empresa / Giro</span><ChevronDown size={16} />
              </button>
              {openFilterSections.business && <div className="filter-options-list">
                {CATEGORY_TYPES.map((type, index) => {
                  const TypeIcon = businessTypeIcon(index);
                  return <button key={type} className={`filter-option-btn ${selectedCategoryType === type ? 'active' : ''}`} onClick={() => setSelectedCategoryType(type)}>
                    <span className="filter-condition-icon"><TypeIcon size={14} /></span>
                    <span className="filter-option-copy"><strong>{type === 'TODAS' ? 'Todas las Tiendas' : type}</strong><small>{type === 'TODAS' ? 'Explorar todo el directorio' : 'Tiendas verificadas'}</small></span>
                    {selectedCategoryType === type ? <CheckCircle2 size={18} className="check-active" /> : <ChevronRight size={16} className="filter-option-chevron" />}
                  </button>;
                })}
              </div>}
            </div>

            {/* Filter 2: Ciudad / Ubicación */}
            <div className="filter-section-group compact-select-section">
              <label className="filter-group-label"><MapPin size={13} /> Ciudad / Ubicación</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="sidebar-select-input"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r === 'TODAS' ? 'Todas las Ciudades' : r}</option>
                ))}
              </select>
            </div>

            {/* Filter 3: Métodos de Envío */}
            <div className={`filter-section-group ${openFilterSections.shipping ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('shipping')} aria-expanded={openFilterSections.shipping}>
                <span className="filter-group-label"><Truck size={13} /> Método de Envío</span><ChevronDown size={16} />
              </button>
              {openFilterSections.shipping && <div className="filter-options-list">
                {SHIPPING_OPTIONS.map((method) => {
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

            {/* Filter 4: Especialidad de Marcas */}
            <div className="filter-section-group compact-select-section">
              <label className="filter-group-label"><Tag size={13} /> Marcas que Comercializa</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="sidebar-select-input"
              >
                {BRANDS.map((b) => (
                  <option key={b} value={b}>{b === 'TODAS' ? 'Todas las Marcas' : b}</option>
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
            {storesLoading ? (
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
                      Mostrando del <strong>{startIndex + 1}</strong> al <strong>{endIndex}</strong> de <strong>{sortedStores.length}</strong> tiendas (Página {currentPage} de {totalPages})
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
