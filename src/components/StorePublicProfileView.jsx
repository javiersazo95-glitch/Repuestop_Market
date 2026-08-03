import React, { useState, useEffect } from 'react';
import {
  Search, Filter, SlidersHorizontal, ShieldCheck, MapPin, Star, Package,
  Clock, ArrowLeft, X, CheckCircle2, RotateCcw, Truck, ChevronLeft, ChevronRight,
  Eye, ShoppingCart, Car, Wrench, Layers, Building2, Phone, Mail, MessageSquare, Globe, AlertCircle
} from 'lucide-react';
import { SIDEBAR_CATEGORIES, CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID, CATEGORY_IMAGE_BY_ID } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';
import { getStoreProductsApi, getStoreProfileApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptPage, adaptProduct, adaptStore, adaptVehicle } from '../services/adapters';

// El backend acota el tamaño de página a 100; esta vista filtra y pagina en cliente.
const STORE_PRODUCTS_FETCH_SIZE = 100;

export default function StorePublicProfileView({
  store,
  onBackToStores,
  onAddToCart,
  onQuickView,
  onOpenQuote,
  activeVehicle: initialActiveVehicle
}) {
  const [activeVehicle, setActiveVehicle] = useState(initialActiveVehicle);
  const [patentInput, setPatentInput] = useState('');
  const [patentError, setPatentError] = useState('');
  const [patentSearching, setPatentSearching] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseType, setPurchaseType] = useState('TODOS'); // 'TODOS' | 'DIRECTA' | 'COTIZACION'

  // Estos cinco filtros se usaban en el JSX y en la lógica de filtrado pero nunca
  // se declararon, por lo que la vista lanzaba ReferenceError al montarse.
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [selectedCondition, setSelectedCondition] = useState('TODOS');
  const [selectedBrand, setSelectedBrand] = useState('TODAS');
  const [onlyCompatible, setOnlyCompatible] = useState(!!initialActiveVehicle);
  const [sortBy, setSortBy] = useState('relevancia');

  // Datos reales de la tienda y su inventario
  const [storeProducts, setStoreProducts] = useState([]);
  const [storeProductsTotal, setStoreProductsTotal] = useState(null);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [fetchedStore, setFetchedStore] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Safe Store Object Resolution
  const resolveStore = (inputStore) => {
    if (!inputStore) return {
      id: 'store-tiensoft',
      nombre: 'Tiensoft AutoRepuestos',
      rut: '77.589.410-8',
      tipo: 'Importador y Distribuidor Directo',
      ciudad: 'Santiago, RM',
      totalPublicaciones: 2450,
      rating: 4.95,
      especialidad: 'Toyota, Chevrolet, Nissan, Hyundai',
      metodosEnvio: ['Retiro en tienda', 'Envío dentro de la comuna', 'Envío fuera de la comuna'],
      logoUrl: '/tiensoft_logo.jpg',
      coverUrl: '/tiensoft_cover.jpg'
    };

    if (typeof inputStore === 'string') {
      return {
        id: 'store-custom',
        nombre: inputStore,
        rut: '77.589.410-8',
        tipo: 'Casa de Repuestos Multimarca',
        ciudad: 'Santiago, RM',
        totalPublicaciones: 1420,
        rating: 4.9,
        especialidad: 'Toyota, Nissan, Hyundai',
        metodosEnvio: ['Retiro en tienda', 'Envío dentro de la comuna'],
        coverUrl: '/tiensoft_cover.jpg',
        logoUrl: inputStore.toLowerCase().includes('tiensoft') ? '/tiensoft_logo.jpg' : null
      };
    }

    return {
      id: inputStore.id || 'store-1',
      nombre: inputStore.nombre || inputStore.name || 'Tiensoft AutoRepuestos',
      rut: inputStore.rut || '77.589.410-8',
      tipo: inputStore.tipo || 'Casa de Repuestos Multimarca',
      ciudad: inputStore.ciudad || 'Santiago, RM',
      totalPublicaciones: inputStore.totalPublicaciones || 1420,
      rating: inputStore.rating || 4.9,
      especialidad: inputStore.especialidad || 'Toyota, Nissan, Hyundai',
      metodosEnvio: inputStore.metodosEnvio || ['Retiro en tienda', 'Envío dentro de la comuna'],
      coverUrl: inputStore.coverUrl || '/tiensoft_cover.jpg',
      logoUrl: inputStore.logoUrl || (inputStore.nombre?.toLowerCase().includes('tiensoft') ? '/tiensoft_logo.jpg' : null),
      bgColor: inputStore.bgColor || '#0066ff',
      initials: inputStore.initials || 'TS'
    };
  };

  // La ficha traída del backend manda sobre lo que llegó por prop (el directorio
  // entrega una versión resumida de la tienda).
  const resolvedStore = resolveStore(fetchedStore || store);
  const storeId = (typeof store === 'object' && store) ? (store.id ?? null) : null;
  // El total de publicaciones es el totalElements real del inventario de la tienda,
  // no el valor de relleno que arrastra resolveStore.
  const currentStore = storeProductsTotal !== null
    ? { ...resolvedStore, totalPublicaciones: storeProductsTotal }
    : resolvedStore;

  // Ficha pública de la tienda: GET /api/v1/tiendas/{proveedorId}
  useEffect(() => {
    if (!storeId) return undefined;
    let isMounted = true;

    getStoreProfileApi(storeId)
      .then((data) => {
        if (isMounted) setFetchedStore(adaptStore(data));
      })
      .catch(() => {
        // Si la ficha falla se sigue mostrando lo que entregó el directorio.
        if (isMounted) setFetchedStore(null);
      });

    return () => { isMounted = false; };
  }, [storeId]);

  // Inventario real de ESTA tienda: GET /api/v1/tiendas/{proveedorId}/productos
  useEffect(() => {
    if (!storeId) {
      setProductsLoading(false);
      return undefined;
    }

    let isMounted = true;
    setProductsLoading(true);

    getStoreProductsApi(storeId, { page: 0, size: STORE_PRODUCTS_FETCH_SIZE })
      .then((data) => {
        if (!isMounted) return;
        const page = adaptPage(data, adaptProduct);
        setStoreProducts(page.items);
        setStoreProductsTotal(page.total);
        setProductsError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setProductsError(err.message || 'No se pudo cargar el catálogo de esta tienda.');
      })
      .finally(() => {
        if (isMounted) setProductsLoading(false);
      });

    return () => { isMounted = false; };
  }, [storeId]);

  // Identificación real por patente: GET /api/v1/vehiculos/patente/{patente}.
  const handlePatentSearch = async (e) => {
    e.preventDefault();
    if (!patentInput.trim()) {
      setPatentError('Ingresa una patente válida (ej. BBCL12)');
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
        setPatentError(resolved?.mensaje || 'No se encontró el vehículo para esta patente.');
      }
    } catch (err) {
      setActiveVehicle(null);
      setPatentError(err.message || 'No se pudo consultar la patente.');
    } finally {
      setPatentSearching(false);
    }
  };

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedCondition, selectedBrand, onlyCompatible, activeVehicle, sortBy, itemsPerPage]);

  // Filtering Logic
  const filteredProducts = storeProducts.filter((prod) => {
    // 1. Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = prod.titulo?.toLowerCase().includes(q);
      const matchOem = prod.oemCode?.toLowerCase().includes(q);
      const matchCat = prod.categoria?.toLowerCase().includes(q);
      if (!matchTitle && !matchOem && !matchCat) return false;
    }

    // 2. Category
    if (selectedCategory !== 'TODAS' && prod.categoria !== selectedCategory) {
      return false;
    }

    // 3. Condition
    if (selectedCondition !== 'TODOS' && prod.condicion && prod.condicion !== selectedCondition) {
      return false;
    }

    // 4. Purchase Type / Modalidad Filter (Precio Directo vs Solo Cotización)
    if (purchaseType === 'DIRECTA') {
      const isQuoteOnly = prod.soloCotizacion || !prod.precio || prod.precio === 0;
      if (isQuoteOnly) return false;
    } else if (purchaseType === 'COTIZACION') {
      const isQuoteOnly = prod.soloCotizacion || !prod.precio || prod.precio === 0;
      if (!isQuoteOnly) return false;
    }

    // 4. Brand
    if (selectedBrand !== 'TODAS') {
      const hasBrand = (prod.compatibilidad || []).some(
        c => c.marca?.toLowerCase() === selectedBrand.toLowerCase()
      );
      if (!hasBrand) return false;
    }

    // 5. Patent / Vehicle Compatibility Filter
    if (onlyCompatible && activeVehicle) {
      const matchesVehicle = (prod.compatibilidad || []).some(
        c => c.marca?.toLowerCase() === activeVehicle.marca?.toLowerCase() ||
             (c.modelo && c.modelo.toLowerCase().includes(activeVehicle.modelo?.toLowerCase()))
      );
      if (!matchesVehicle) return false;
    }

    return true;
  });

  // Sorting
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'precio-asc') return a.precio - b.precio;
    if (sortBy === 'precio-desc') return b.precio - a.precio;
    if (sortBy === 'vendidos') return (b.vendidos || 0) - (a.vendidos || 0);
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
      const mainGrid = document.querySelector('.store-inventory-control-bar');
      if (mainGrid) {
        mainGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('TODAS');
    setSelectedCondition('TODOS');
    setSelectedBrand('TODAS');
    setOnlyCompatible(false);
    setPatentInput('');
    setSortBy('relevancia');
    setCurrentPage(1);
  };

  return (
    <div className="store-public-profile-wrapper">
      {/* 1. Store Cover & Profile Hero Banner */}
      <div
        className="store-public-hero-banner"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.96) 100%), url('${currentStore.coverUrl || '/directory_hero_warehouse.jpg'}')`
        }}
      >
        <div className="container store-hero-inner">
          <button className="btn-back-marketplace" onClick={onBackToStores}>
            <ArrowLeft size={16} />
            <span>Volver a Tiendas</span>
          </button>

          <div className="store-header-profile-card">
            <div className="store-logo-avatar-wrap">
              {currentStore.logoUrl ? (
                <img src={currentStore.logoUrl} alt={currentStore.nombre} className="store-logo-img" />
              ) : currentStore.bgColor ? (
                <div
                  className="store-logo-initials-box"
                  style={{ backgroundColor: currentStore.bgColor, color: currentStore.textColor || '#ffffff' }}
                >
                  {currentStore.initials || currentStore.nombre.slice(0, 2).toUpperCase()}
                </div>
              ) : (
                <div className="store-logo-initials-box" style={{ backgroundColor: '#0066ff', color: '#ffffff' }}>
                  <Building2 size={32} />
                </div>
              )}
            </div>

            <div className="store-header-info-col">
              <div className="store-rut-badge">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>RUT: <strong>{currentStore.rut || '77.589.410-8'}</strong> • Tienda Acreditada</span>
              </div>

              <h1 className="store-profile-name">{currentStore.nombre}</h1>
              <p className="store-profile-sub">
                {currentStore.tipo || 'Casa de Repuestos Multimarca'} • <MapPin size={13} /> {currentStore.ciudad || 'Santiago, RM'} • Especialidad: <strong>{currentStore.especialidad || 'Toyota, Nissan, Hyundai'}</strong>
              </p>

              <div className="store-metrics-row">
                <span className="metric-pill"><Star size={13} className="text-amber-400" /> {currentStore.rating || 4.9} Rating</span>
                <span className="metric-pill"><Package size={13} /> +{currentStore.totalPublicaciones || 1420} Repuestos en Stock</span>
                <span className="metric-pill"><Truck size={13} /> Envíos a todo Chile</span>
              </div>
            </div>

            <div className="store-header-actions-col">
              <button
                className="btn-store-quote-main"
                onClick={() => onOpenQuote({ titulo: `Cotización General - ${currentStore.nombre}`, vendedor: currentStore.nombre })}
              >
                <MessageSquare size={16} />
                <span>Solicitar Cotización Directa</span>
              </button>

              <div className="store-shipping-methods-pills">
                {(currentStore.metodosEnvio || ['Retiro en tienda', 'Envío dentro de la comuna']).map((method, i) => (
                  <span key={i} className="shipping-method-chip">
                    <CheckCircle2 size={11} /> {method}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Banner so the user ALWAYS knows which store's inventory they are browsing */}
      <div className="persistent-store-sticky-banner container">
        <div className="persistent-store-inner">
          {currentStore.logoUrl ? (
            <img src={currentStore.logoUrl} alt={currentStore.nombre} className="sticky-banner-logo-mini" />
          ) : (
            <Building2 size={18} className="text-blue-600" />
          )}
          <span>Viendo únicamente el catálogo e inventario exclusivo de <strong>{currentStore.nombre}</strong> ({currentStore.rut})</span>
          <span className="store-location-tag"><MapPin size={12} /> {currentStore.ciudad}</span>
        </div>
      </div>

      <div className="container catalog-main-container">
        {/* 2. License Plate Filter Console inside Store View */}
        <div className="patent-filter-box-bar">
          <div className="patent-filter-header-title">
            <Car size={18} className="text-blue-500" />
            <span>Filtrar Repuestos de {currentStore.nombre} por Patente:</span>
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

        {/* 3. Store Search & Control Bar */}
        <div className="catalog-control-bar store-inventory-control-bar">
          <div className="search-bar-catalog-box">
            <Search size={18} className="search-box-icon" />
            <input
              type="text"
              placeholder={`Buscar en el inventario de ${currentStore.nombre} (ej. pastillas, OEM 04465)...`}
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
              <span>Mostrando <strong>{sortedProducts.length}</strong> repuestos en esta tienda</span>
            </div>

            <div className="sort-dropdown-box">
              <span className="sort-label">Ordenar:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select-input">
                <option value="relevancia">Recomendados / Relevancia</option>
                <option value="precio-asc">Precio: Menor a Mayor</option>
                <option value="precio-desc">Precio: Mayor a Menor</option>
                <option value="vendidos">Más Vendidos</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. 2-Column Content Layout (Sidebar + Grid) */}
        <div className="catalog-content-grid">
          {/* Left Technical Filters Sidebar */}
          <aside className="catalog-sidebar-filters">
            <div className="sidebar-filters-header">
              <div className="sidebar-title-group">
                <SlidersHorizontal size={16} />
                <span>Filtros de Tienda</span>
              </div>

              {(selectedCategory !== 'TODAS' || selectedCondition !== 'TODOS' || selectedBrand !== 'TODAS' || searchQuery || onlyCompatible) && (
                <button className="btn-reset-filters-mini" onClick={handleResetFilters}>
                  <RotateCcw size={12} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>

            {/* Filter 0: Modalidad de Compra */}
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

            {/* Filter 1: Categorías */}
            <div className="filter-section-group">
              <label className="filter-group-label"><Layers size={13} /> Categoría</label>
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

            {/* Filter 2: Condición */}
            <div className="filter-section-group">
              <label className="filter-group-label"><ShieldCheck size={13} /> Condición</label>
              <div className="filter-options-list">
                {['TODOS', 'Nuevo OEM Original', 'Nuevo Alternativo Homologado', 'Usado Certificado Desarmaduría'].map((cond) => (
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

            {/* Clear Filters Button */}
            <button className="btn-clear-all-filters-wide" onClick={handleResetFilters}>
              <RotateCcw size={14} />
              <span>Restablecer Filtros</span>
            </button>
          </aside>

          {/* Right Parts Grid */}
          <main className="catalog-parts-main">
            {productsLoading ? (
              <div className="directory-empty-state">
                <Package size={56} className="empty-icon-gray" />
                <h3>Cargando catálogo de la tienda…</h3>
                <p>Consultando los repuestos publicados por {currentStore.nombre}.</p>
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
                          <strong>{currentStore.nombre}</strong>
                          <span className="city-span"><MapPin size={11} /> {currentStore.ciudad || 'Santiago, RM'}</span>
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
                                title="Cotizar con el vendedor"
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

                {/* Pagination */}
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
                      >
                        <span>Siguiente</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="directory-empty-state">
                <Wrench size={56} className="empty-icon-gray" />
                <h3>No se encontraron repuestos en {currentStore.nombre} con los filtros seleccionados</h3>
                <p>Intenta cambiar la patente ingresada o limpiar los filtros de búsqueda.</p>
                <button className="btn-reset-filters-large" onClick={handleResetFilters}>
                  <RotateCcw size={16} />
                  <span>Limpiar Filtros</span>
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
