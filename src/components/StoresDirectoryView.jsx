import React, { useState, useEffect } from 'react';
import {
  Building2, Search, Filter, SlidersHorizontal, MapPin, ShieldCheck,
  Star, Package, Clock, ArrowRight, ArrowLeft, X, CheckCircle2, RotateCcw,
  Store, Tag, Truck, Bike, Globe, ChevronLeft, ChevronRight, Car
} from 'lucide-react';
import { getShippingIconConfig } from './NewOnboardedStoresSection';
import { useAuth } from '../context/AuthContext';
import { getPublicStoresApi } from '../services/api';
import { adaptPage, adaptStore } from '../services/adapters';

// El backend acota el tamaño de página a 100. El directorio filtra y pagina en
// cliente, así que se trae un bloque grande y se deja que la UI haga el resto.
const STORES_FETCH_SIZE = 100;

export default function StoresDirectoryView({ onBackToStore, onSelectStore }) {
  const { user } = useAuth();
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryType, setSelectedCategoryType] = useState('TODAS');
  const [selectedRegion, setSelectedRegion] = useState('TODAS');
  const [selectedShipping, setSelectedShipping] = useState('TODAS');
  const [selectedBrand, setSelectedBrand] = useState('TODAS');
  const [sortBy, setSortBy] = useState('relevancia');

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

  // Directorio real de tiendas: GET /api/v1/tiendas/publicas (endpoint público).
  useEffect(() => {
    let isMounted = true;

    getPublicStoresApi({ page: 0, size: STORES_FETCH_SIZE })
      .then((data) => {
        if (!isMounted) return;
        setStores(adaptPage(data, adaptStore).items);
        setStoresError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setStoresError(err.message || 'No se pudo cargar el directorio de tiendas.');
      })
      .finally(() => {
        if (isMounted) setStoresLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

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
              <span>DIRECTORIO NACIONAL DE TIENDAS Y DESARMADURÍAS</span>
            </div>
            <h1>Casas de Repuestos Acreditadas en Chile</h1>
            <p>
              Explora más de 500 importadores, distribuidoras y desarmadurías con RUT verificado, local físico y despacho a todo el país.
            </p>
          </div>

          <div className="directory-hero-stats-row">
            <div className="stat-pill-item">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>100% Tiendas Acreditadas</span>
            </div>
            <div className="stat-pill-item">
              <Store size={16} className="text-blue-400" />
              <span>+500 Locales en Chile</span>
            </div>
            <div className="stat-pill-item">
              <Truck size={16} className="text-sky-400" />
              <span>Despacho Directo o Retiro</span>
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
        <div className="directory-content-grid">
          {/* Sidebar Filters Column (Left 280px) */}
          <aside className="directory-sidebar-filters">
            <div className="sidebar-filters-header">
              <div className="sidebar-title-group">
                <SlidersHorizontal size={16} />
                <span>Filtros de Tienda</span>
              </div>

              {(selectedCategoryType !== 'TODAS' || selectedRegion !== 'TODAS' || selectedShipping !== 'TODAS' || selectedBrand !== 'TODAS' || searchQuery) && (
                <button className="btn-reset-filters-mini" onClick={handleResetFilters}>
                  <RotateCcw size={12} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>

            {/* Filter 1: Tipo / Giro de Tienda */}
            <div className="filter-section-group">
              <label className="filter-group-label">Tipo de Empresa / Giro</label>
              <div className="filter-options-list">
                {CATEGORY_TYPES.map((type) => (
                  <button
                    key={type}
                    className={`filter-option-btn ${selectedCategoryType === type ? 'active' : ''}`}
                    onClick={() => setSelectedCategoryType(type)}
                  >
                    <span>{type === 'TODAS' ? 'Todas las Tiendas' : type}</span>
                    {selectedCategoryType === type && <CheckCircle2 size={14} className="check-active" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter 2: Ciudad / Ubicación */}
            <div className="filter-section-group">
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
            <div className="filter-section-group">
              <label className="filter-group-label"><Truck size={13} /> Método de Envío</label>
              <div className="filter-options-list">
                {SHIPPING_OPTIONS.map((method) => (
                  <button
                    key={method}
                    className={`filter-option-btn ${selectedShipping === method ? 'active' : ''}`}
                    onClick={() => setSelectedShipping(method)}
                  >
                    <span>{method === 'TODAS' ? 'Todos los Métodos' : method}</span>
                    {selectedShipping === method && <CheckCircle2 size={14} className="check-active" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter 4: Especialidad de Marcas */}
            <div className="filter-section-group">
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

            {/* Clear All Filters Large Button */}
            <button className="btn-clear-all-filters-wide" onClick={handleResetFilters}>
              <RotateCcw size={14} />
              <span>Restablecer Filtros</span>
            </button>
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
                <div className="stores-cards-grid-directory">
                  {paginatedStores.map((store) => {
                    const specialties = parseSpecialties(store.especialidad);
                    const avatarPhoto = store.logoUrl || store.userProfileUrl || store.imagenUrl;
                    const coverPhoto = store.coverUrl;

                    return (
                      <div key={store.id} className="seller-exact-card seller-horizontal-card">
                        {/* Top Banner Accent */}
                        <div
                          className="seller-card-cover-header"
                          style={{
                            backgroundImage: coverPhoto
                              ? `url(${coverPhoto})`
                              : 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0066ff 100%)',
                          }}
                        >
                          <div className="green-onboard-pill store-verified-pill top-right-verified">
                            <ShieldCheck size={13} strokeWidth={2.5} />
                            <span>{store.verificadoFecha}</span>
                          </div>
                        </div>

                        {/* Main Info Row (Avatar + Title + Category) */}
                        <div className="seller-card-body-content">
                          <div className="seller-avatar-header-row">
                            <div className="seller-avatar-wrapper">
                              {avatarPhoto ? (
                                <div className="seller-avatar-circle seller-photo-avatar">
                                  <img src={avatarPhoto} alt={store.nombre} className="seller-avatar-img" />
                                </div>
                              ) : (
                                <div
                                  className="seller-avatar-circle seller-gradient-avatar"
                                  style={{
                                    background: `linear-gradient(135deg, ${store.bgColor || '#0066ff'} 0%, #0f172a 100%)`,
                                    color: store.textColor || '#ffffff',
                                  }}
                                >
                                  <span>{store.initials}</span>
                                </div>
                              )}
                              <div className="seller-avatar-online-dot" title="Tienda Activa en Línea" />
                            </div>

                            <div className="seller-main-title-box">
                              <div className="seller-title-rut-row">
                                <h3 className="seller-name">{store.nombre}</h3>
                                <span className="seller-rut-badge">RUT {store.rut}</span>
                              </div>
                              <span className="seller-type-chip">{store.tipo}</span>
                            </div>
                          </div>

                          {/* Location & Commercial Address */}
                          <div className="seller-type-location-row">
                            <span className="seller-location">
                              <MapPin size={13} className="pin-icon" />
                              <span>{store.ciudad} (Local Físico Verificado)</span>
                            </span>
                          </div>

                          {/* Specialty Line with Pills */}
                          <div className="seller-specialty-pills-row">
                            <span className="spec-label">Especialidad:</span>
                            <div className="specialty-pills-list">
                              {specialties.slice(0, 4).map((spec, i) => (
                                <span key={i} className="specialty-pill">{spec}</span>
                              ))}
                            </div>
                          </div>

                          {/* Rich 3-Column Metrics Bar */}
                          <div className="seller-stats-3col-bar">
                            <div className="stat-col-item">
                              <Package size={14} className="stat-icon-blue" />
                              <div className="stat-text-group">
                                <strong>+{Number(store.totalPublicaciones || 1400).toLocaleString('es-CL')}</strong>
                                <span>Repuestos</span>
                              </div>
                            </div>

                            <div className="stat-col-item">
                              <Star size={14} className="stat-icon-amber" />
                              <div className="stat-text-group">
                                <strong>{store.rating || 4.9} / 5.0</strong>
                                <span>Calificación</span>
                              </div>
                            </div>

                            <div className="stat-col-item">
                              <Clock size={14} className="stat-icon-green" />
                              <div className="stat-text-group">
                                <strong>&lt; 15 min</strong>
                                <span>Respuesta</span>
                              </div>
                            </div>
                          </div>

                          {/* Shipping Icons Row */}
                          <div className="seller-shipping-icons-row">
                            <span className="shipping-label-small">Envíos:</span>
                            <div className="shipping-icons-list">
                              {(store.metodosEnvio || ['Retiro en tienda', 'Envío dentro de la comuna', 'Envío fuera de la comuna']).map((method, i) => {
                                const config = getShippingIconConfig(method);
                                const Icon = config.icon;
                                return (
                                  <div
                                    key={i}
                                    className="shipping-icon-badge"
                                    style={{ color: config.color, backgroundColor: config.bg }}
                                    title={config.label}
                                  >
                                    <Icon size={14} />
                                    <span className="shipping-tooltip-text">{config.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Bottom Full-Width Action Button */}
                          <div className="seller-catalog-link-box">
                            <button
                              className="btn-view-catalog-link"
                              onClick={() => onSelectStore?.(store)}
                            >
                              <span>Ver catálogo de tienda</span>
                              <ArrowRight size={14} className="btn-arrow-icon" />
                            </button>
                          </div>
                        </div>
                      </div>
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
