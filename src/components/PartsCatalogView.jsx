import React, { useState, useEffect } from 'react';
import {
  Search, Filter, SlidersHorizontal, ShieldCheck, MapPin, Star, Package,
  Clock, ArrowRight, ArrowLeft, X, CheckCircle2, RotateCcw, Tag, Truck,
  ChevronLeft, ChevronRight, Eye, ShoppingCart, Car, Wrench, Layers, AlertCircle, Globe, MessageSquare
} from 'lucide-react';
// CategoryIconTile y SIDEBAR_CATEGORIES se usaban sin estar importados, por lo que la
// vista lanzaba ReferenceError al montarse (el ErrorBoundary la reemplazaba por completo).
import CategoryIconTile from './CategoryIconTile';
import {
  SIDEBAR_CATEGORIES, CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID, CATEGORY_IMAGE_BY_ID
} from '../data/categories';
import { getPublicProductsApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptPage, adaptProduct, adaptVehicle } from '../services/adapters';

// El backend acota el tamaño de página a 100. Esta vista filtra y pagina en cliente,
// así que se trae un bloque grande y la UI hace el resto del trabajo.
const CATALOG_FETCH_SIZE = 100;

export default function PartsCatalogView({
  onBackToStore,
  onAddToCart,
  onQuickView,
  onOpenQuote,
  activeVehicle: initialActiveVehicle
}) {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [activeVehicle, setActiveVehicle] = useState(initialActiveVehicle);
  const [patentInput, setPatentInput] = useState('');
  const [patentError, setPatentError] = useState('');
  const [patentSearching, setPatentSearching] = useState(false);

  // Catálogo real: GET /api/v1/inventario/productos (endpoint público).
  useEffect(() => {
    let isMounted = true;

    getPublicProductsApi({ page: 0, size: CATALOG_FETCH_SIZE, sort: 'createdAt,desc' })
      .then((data) => {
        if (!isMounted) return;
        setProducts(adaptPage(data, adaptProduct).items);
        setProductsError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setProductsError(err.message || 'No se pudo cargar el catálogo de repuestos.');
      })
      .finally(() => {
        if (isMounted) setProductsLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [selectedCondition, setSelectedCondition] = useState('TODOS');
  const [selectedOrigin, setSelectedOrigin] = useState('TODOS');
  const [selectedBrand, setSelectedBrand] = useState('TODAS');
  const [purchaseType, setPurchaseType] = useState('TODOS'); // 'TODOS' | 'DIRECTA' | 'COTIZACION'
  const [onlyCompatible, setOnlyCompatible] = useState(!!initialActiveVehicle);
  const [onlyFastDelivery, setOnlyFastDelivery] = useState(false);
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [sortBy, setSortBy] = useState('relevancia');

  // Identificación real por patente: GET /api/v1/vehiculos/patente/{patente}.
  const handlePatentSearch = async (e) => {
    e.preventDefault();
    if (!patentInput.trim()) {
      setPatentError('Ingresa una patente (ej. BBCL12)');
      return;
    }

    setPatentSearching(true);
    setPatentError('');
    try {
      const resolved = adaptVehicle(await searchVehicleByPatenteApi(patentInput.trim()));
      if (resolved && !resolved.requiereIngresoManual && resolved.marca) {
        setActiveVehicle(resolved);
        setOnlyCompatible(true);
      } else {
        setActiveVehicle(null);
        setPatentError(resolved?.mensaje || 'No se encontró vehículo para esta patente.');
      }
    } catch (err) {
      setActiveVehicle(null);
      setPatentError(err.message || 'No se pudo consultar la patente.');
    } finally {
      setPatentSearching(false);
    }
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Filter options lists
  const CONDITIONS = [
    'TODOS',
    'Nuevo OEM Original',
    'Nuevo Alternativo Homologado',
    'Usado Certificado Desarmaduría'
  ];

  const ORIGINS = [
    'TODOS',
    'Japón',
    'Alemania',
    'Brasil'
  ];

  const BRANDS = [
    'TODAS',
    'Toyota',
    'Nissan',
    'Hyundai',
    'Chevrolet',
    'Ford',
    'Mazda'
  ];

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery, selectedCategory, selectedCondition, selectedOrigin,
    selectedBrand, onlyCompatible, onlyFastDelivery, maxPrice, sortBy, itemsPerPage
  ]);

  // Technical Filtering Logic
  const filteredProducts = products.filter((prod) => {
    // 1. Text Search Query (Title, Category, OEM Code, Seller Name, Brand)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = prod.titulo?.toLowerCase().includes(q);
      const matchOem = prod.oemCode?.toLowerCase().includes(q);
      const matchCat = prod.categoria?.toLowerCase().includes(q);
      const matchSub = prod.subcategoria?.toLowerCase().includes(q);
      const matchSeller = prod.vendedor?.toLowerCase().includes(q);
      const matchCompat = (prod.compatibilidad || []).some(
        c => c.marca?.toLowerCase().includes(q) || c.modelo?.toLowerCase().includes(q)
      );

      if (!matchTitle && !matchOem && !matchCat && !matchSub && !matchSeller && !matchCompat) {
        return false;
      }
    }

    // 2. Category Filter
    if (selectedCategory !== 'TODAS' && prod.categoria !== selectedCategory) {
      return false;
    }

    // 3. Technical Condition Filter
    if (selectedCondition !== 'TODOS' && prod.condicion && prod.condicion !== selectedCondition) {
      return false;
    }

    // 4. Origin Filter
    if (selectedOrigin !== 'TODOS' && prod.origen && prod.origen !== selectedOrigin) {
      return false;
    }

    // 5. Brand Specialty Filter
    if (selectedBrand !== 'TODAS') {
      const hasBrand = (prod.compatibilidad || []).some(
        c => c.marca?.toLowerCase() === selectedBrand.toLowerCase()
      );
      if (!hasBrand) return false;
    }

    // 6. Active Garage Vehicle Compatibility Toggle
    if (onlyCompatible && activeVehicle) {
      const matchesVehicle = (prod.compatibilidad || []).some(
        c => c.marca?.toLowerCase() === activeVehicle.marca?.toLowerCase() &&
             c.modelo?.toLowerCase() === activeVehicle.modelo?.toLowerCase()
      );
      if (!matchesVehicle) return false;
    }

    // 7. Fast Delivery Toggle
    if (onlyFastDelivery && prod.envioRapido === false) {
      return false;
    }

    // 8. Purchase Type / Modalidad Filter (Precio Directo vs Solo Cotización)
    if (purchaseType === 'DIRECTA') {
      const isQuoteOnly = prod.soloCotizacion || !prod.precio || prod.precio === 0;
      if (isQuoteOnly) return false;
    } else if (purchaseType === 'COTIZACION') {
      const isQuoteOnly = prod.soloCotizacion || !prod.precio || prod.precio === 0;
      if (!isQuoteOnly) return false;
    }

    // 9. Max Price Filter
    if (prod.precio > maxPrice) {
      return false;
    }

    return true;
  });

  // Sorting Logic
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'precio-asc') {
      return a.precio - b.precio;
    }
    if (sortBy === 'precio-desc') {
      return b.precio - a.precio;
    }
    if (sortBy === 'vendidos') {
      return (b.vendidos || 0) - (a.vendidos || 0);
    }
    if (sortBy === 'descuento') {
      return (b.descuento || 0) - (a.descuento || 0);
    }
    // Relevancia default
    return 0;
  });

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(sortedProducts.length, currentPage * itemsPerPage);
  const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      const controlBar = document.querySelector('.catalog-control-bar');
      if (controlBar) {
        controlBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('TODAS');
    setSelectedCondition('TODOS');
    setSelectedOrigin('TODOS');
    setSelectedBrand('TODAS');
    setOnlyCompatible(false);
    setOnlyFastDelivery(false);
    setMaxPrice(1000000);
    setSortBy('relevancia');
    setCurrentPage(1);
  };

  return (
    <div className="parts-catalog-view-wrapper">
      {/* 1. Catalog Hero Header */}
      <div className="catalog-hero-banner">
        <div className="container catalog-hero-content">
          <button className="btn-back-marketplace" onClick={onBackToStore}>
            <ArrowLeft size={16} />
            <span>Volver al Inicio</span>
          </button>

          <div className="catalog-hero-text">
            <div className="catalog-hero-badge">
              <Wrench size={14} />
              <span>CATÁLOGO TÉCNICO OFICIAL REPUESTOP.CL</span>
            </div>
            <h1>Inventario General de Repuestos</h1>
            <p>
              Busca y filtra repuestos mecánicos, eléctricos y de carrocería con código OEM, origen verificado y calce 100% garantizado.
            </p>
          </div>

          {activeVehicle && (
            <div className="active-vehicle-pill-banner">
              <Car size={16} className="text-blue-400" />
              <span>Vehículo Activo en Garaje: <strong>{activeVehicle.marca} {activeVehicle.modelo} ({activeVehicle.patente})</strong></span>
              <button
                className={`btn-toggle-compat ${onlyCompatible ? 'active' : ''}`}
                onClick={() => setOnlyCompatible(!onlyCompatible)}
              >
                <span>{onlyCompatible ? '✓ Mostrando solo compatibles' : 'Filtrar por mi vehículo'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="container catalog-main-container">
        {/* 1. Patent Filter Console Bar */}
        <div className="patent-filter-box-bar">
          <div className="patent-filter-header-title">
            <Car size={18} className="text-blue-500" />
            <span>Filtrar Repuestos del Catálogo por Patente:</span>
          </div>

          <form onSubmit={handlePatentSearch} className="patent-filter-form-inline">
            <input
              type="text"
              placeholder="Ingresa patente (ej. BBCL12)..."
              value={patentInput}
              onChange={(e) => setPatentInput(e.target.value)}
              className="patent-filter-input"
            />
            <button type="submit" className="btn-patent-search-blue" disabled={patentSearching}>
              <Search size={14} />
              <span>{patentSearching ? 'Buscando…' : 'Buscar Vehículo'}</span>
            </button>
          </form>

          {activeVehicle && (
            <div className="active-patent-verified-chip">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Vehículo: <strong>{activeVehicle.marca} {activeVehicle.modelo} ({activeVehicle.patente})</strong></span>
              <button
                className={`btn-toggle-compat-mini ${onlyCompatible ? 'active' : ''}`}
                onClick={() => setOnlyCompatible(!onlyCompatible)}
              >
                {onlyCompatible ? '✓ Solo compatibles' : 'Filtrar calce'}
              </button>
            </div>
          )}
        </div>

        {patentError && <div className="patent-error-msg">{patentError}</div>}

        {/* 2. Top Control Bar (Search & Sort) */}
        <div className="catalog-control-bar">
          <div className="search-bar-catalog-box">
            <Search size={18} className="search-box-icon" />
            <input
              type="text"
              placeholder="Buscar por repuesto, código OEM (ej. 04465-0D150), marca o vendedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-catalog-input"
            />
            {searchQuery && (
              <button className="btn-clear-search-dir" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="control-bar-right-group">
            <div className="results-count-badge">
              <span>Mostrando <strong>{sortedProducts.length}</strong> de {products.length} repuestos</span>
            </div>

            <div className="sort-dropdown-box">
              <span className="sort-label">Ordenar por:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select-input">
                <option value="relevancia">Recomendados / Relevancia</option>
                <option value="precio-asc">Precio: Menor a Mayor</option>
                <option value="precio-desc">Precio: Mayor a Menor</option>
                <option value="vendidos">Más Vendidos</option>
                <option value="descuento">Mayor Descuento</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Main 2-Column Content Layout (Technical Sidebar + Parts Grid) */}
        <div className="catalog-content-grid">
          {/* Sidebar Technical Filters (Left 280px) */}
          <aside className="catalog-sidebar-filters">
            <div className="sidebar-filters-header">
              <div className="sidebar-title-group">
                <SlidersHorizontal size={16} />
                <span>Filtros Técnicos Avanzados</span>
              </div>

              {(selectedCategory !== 'TODAS' || selectedCondition !== 'TODOS' || selectedOrigin !== 'TODOS' || selectedBrand !== 'TODAS' || purchaseType !== 'TODOS' || searchQuery || onlyCompatible || onlyFastDelivery) && (
                <button className="btn-reset-filters-mini" onClick={handleResetFilters}>
                  <RotateCcw size={12} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>

            {/* Filter 0: Modalidad / Origen de Compra */}
            <div className="filter-section-group">
              <label className="filter-group-label"><ShoppingCart size={13} /> Modalidad de Compra</label>
              <div className="filter-options-list">
                <button
                  className={`filter-option-btn ${purchaseType === 'TODOS' ? 'active' : ''}`}
                  onClick={() => setPurchaseType('TODOS')}
                >
                  <span>Todos los Repuestos</span>
                  {purchaseType === 'TODOS' && <CheckCircle2 size={14} className="check-active" />}
                </button>
                <button
                  className={`filter-option-btn ${purchaseType === 'DIRECTA' ? 'active' : ''}`}
                  onClick={() => setPurchaseType('DIRECTA')}
                >
                  <span>Con Precio Directo</span>
                  {purchaseType === 'DIRECTA' && <CheckCircle2 size={14} className="check-active" />}
                </button>
                <button
                  className={`filter-option-btn ${purchaseType === 'COTIZACION' ? 'active' : ''}`}
                  onClick={() => setPurchaseType('COTIZACION')}
                >
                  <span>Solo Bajo Cotización</span>
                  {purchaseType === 'COTIZACION' && <CheckCircle2 size={14} className="check-active" />}
                </button>
              </div>
            </div>

            {/* Filter 1: Categoría del Repuesto */}
            <div className="filter-section-group">
              <label className="filter-group-label"><Layers size={13} /> Categoría del Repuesto</label>
              <div className="filter-options-list">
                <button
                  className={`filter-option-btn ${selectedCategory === 'TODAS' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('TODAS')}
                >
                  <span>Todas las Categorías</span>
                  {selectedCategory === 'TODAS' && <CheckCircle2 size={14} className="check-active" />}
                </button>
                {SIDEBAR_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    className={`filter-option-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <span>{cat.nombre}</span>
                    {selectedCategory === cat.id && <CheckCircle2 size={14} className="check-active" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter 2: Condición / Estado Técnico */}
            <div className="filter-section-group">
              <label className="filter-group-label"><ShieldCheck size={13} /> Condición Técnica</label>
              <div className="filter-options-list">
                {CONDITIONS.map((cond) => (
                  <button
                    key={cond}
                    className={`filter-option-btn ${selectedCondition === cond ? 'active' : ''}`}
                    onClick={() => setSelectedCondition(cond)}
                  >
                    <span>{cond === 'TODOS' ? 'Todos los Estados' : cond}</span>
                    {selectedCondition === cond && <CheckCircle2 size={14} className="check-active" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter 3: Origen / Procedencia */}
            <div className="filter-section-group">
              <label className="filter-group-label"><Globe size={13} /> Origen / Fabricación</label>
              <select
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                className="sidebar-select-input"
              >
                {ORIGINS.map((o) => (
                  <option key={o} value={o}>{o === 'TODOS' ? 'Todos los Orígenes' : o}</option>
                ))}
              </select>
            </div>

            {/* Filter 4: Marca del Vehículo */}
            <div className="filter-section-group">
              <label className="filter-group-label"><Car size={13} /> Marca de Vehículo</label>
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

            {/* Filter 5: Opciones Rápidas */}
            <div className="filter-section-group">
              <label className="filter-group-label"><Truck size={13} /> Opciones de Despacho</label>
              <label className="checkbox-filter-label">
                <input
                  type="checkbox"
                  checked={onlyFastDelivery}
                  onChange={(e) => setOnlyFastDelivery(e.target.checked)}
                />
                <span>Solo con Envío Rápido el mismo día</span>
              </label>
            </div>

            {/* Clear All Filters Button */}
            <button className="btn-clear-all-filters-wide" onClick={handleResetFilters}>
              <RotateCcw size={14} />
              <span>Restablecer Filtros</span>
            </button>
          </aside>

          {/* Parts Cards Column (Right Grid) */}
          <main className="catalog-parts-main">
            {productsLoading ? (
              <div className="directory-empty-state">
                <Package size={56} className="empty-icon-gray" />
                <h3>Cargando catálogo…</h3>
                <p>Consultando los repuestos publicados por las tiendas.</p>
              </div>
            ) : productsError ? (
              <div className="directory-empty-state">
                <AlertCircle size={56} className="empty-icon-gray" />
                <h3>No se pudo cargar el catálogo</h3>
                <p>{productsError}</p>
              </div>
            ) : paginatedProducts.length > 0 ? (
              <>
                <div className="parts-cards-grid-catalog">
                  {paginatedProducts.map((prod) => (
                    <div key={prod.id} className="latest-part-card-rich">
                      <div className="part-card-top-tag">
                        <span className="time-ago-pill">
                          <ShieldCheck size={12} /> {prod.condicion || 'Nuevo OEM'}
                        </span>
                        <span className="stock-count-pill">{prod.stock || 12} en stock</span>
                      </div>

                      <div className="part-card-img-box" onClick={() => onQuickView(prod)}>
                        <CategoryIconTile
                          iconName={CATEGORY_ICON_BY_ID[prod.categoria]}
                          color={CATEGORY_COLOR_BY_ID[prod.categoria]}
                          image={CATEGORY_IMAGE_BY_ID[prod.categoria]}
                          size={36}
                        />
                        {prod.descuento > 0 && (
                          <span className="discount-red-badge">-{prod.descuento}% OFF</span>
                        )}
                      </div>

                      <div className="part-card-body-rich">
                        {prod.oemCode && <span className="oem-code-tag">OEM: {prod.oemCode}</span>}
                        <h3 className="part-title" onClick={() => onQuickView(prod)}>{prod.titulo}</h3>

                        <div className="part-compat-sub">
                          <CheckCircle2 size={13} className="text-green-icon" />
                          <span>
                            {prod.compatibilidad && prod.compatibilidad.length > 0
                              ? `Calza en ${prod.compatibilidad[0].marca} ${prod.compatibilidad[0].modelo}`
                              : 'Compatibilidad Multimarca Garantizada'}
                          </span>
                        </div>

                        <div className="vendor-info-line">
                          <ShieldCheck size={14} className="text-blue-icon" />
                          <strong>{prod.vendedor}</strong>
                          <span className="city-span"><MapPin size={11} /> {prod.ciudadVendedor || 'Santiago, RM'}</span>
                        </div>

                        <div className="price-and-action-row">
                          <div className="price-stack">
                            {prod.soloCotizacion || !prod.precio || prod.precio === 0 ? (
                              <span className="price-main-bold quote-only-text" style={{ color: '#0066ff', fontSize: '12px' }}>
                                Bajo Cotización
                              </span>
                            ) : (
                              <>
                                <span className="price-main-bold">${Number(prod.precio).toLocaleString('es-CL')}</span>
                                {prod.precioOriginal > prod.precio && (
                                  <span className="price-old">${Number(prod.precioOriginal).toLocaleString('es-CL')}</span>
                                )}
                              </>
                            )}
                          </div>

                          <div className="part-btn-group">
                            {prod.soloCotizacion || !prod.precio || prod.precio === 0 ? (
                              <button
                                className="btn-add-cart-red btn-quote-chat-only"
                                title="Cotizar por chat con la tienda"
                                onClick={() => onOpenQuote ? onOpenQuote(prod) : onQuickView(prod)}
                              >
                                <MessageSquare size={14} />
                                <span>Cotizar</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  className="btn-quote-chat"
                                  title="Vista Rápida"
                                  onClick={() => onQuickView(prod)}
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  className="btn-add-cart-red"
                                  onClick={() => onAddToCart(prod)}
                                >
                                  <ShoppingCart size={15} />
                                  <span>Comprar</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 4. Pagination Bar */}
                <div className="directory-pagination-bar">
                  <div className="pagination-info">
                    <span>
                      Mostrando del <strong>{startIndex + 1}</strong> al <strong>{endIndex}</strong> de <strong>{sortedProducts.length}</strong> repuestos (Página {currentPage} de {totalPages})
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
                        <option value={12}>12 por página</option>
                        <option value={24}>24 por página</option>
                        <option value={36}>36 por página</option>
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
                <Wrench size={56} className="empty-icon-gray" />
                <h3>No se encontraron repuestos con los filtros seleccionados</h3>
                <p>Intenta ajustar la búsqueda por código OEM o seleccionar una categoría más amplia.</p>
                <button className="btn-reset-filters-large" onClick={handleResetFilters}>
                  <RotateCcw size={16} />
                  <span>Limpiar Filtros y Ver Todos</span>
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
