import React, { useState, useEffect, useRef } from 'react';
import {
  Search, SlidersHorizontal, ShieldCheck, MapPin, Star, Package,
  ArrowLeft, X, CheckCircle2, RotateCcw, Truck, ChevronLeft, ChevronRight, ChevronDown,
  ShoppingCart, Car, Wrench, Layers, Building2, MessageSquare, AlertCircle,
  Heart, Share2, Image, PenLine, Bike, Store, ArrowRight, HelpCircle
} from 'lucide-react';
import { NAVIGATION_CATEGORIES } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';
import MarketplaceProductCard from './MarketplaceProductCard';
import { getStoreProductsApi, getStoreProfileApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptPage, adaptProduct, adaptStore, adaptVehicle } from '../services/adapters';

// El backend acota el tamaño de página a 100; esta vista filtra y pagina en cliente.
const STORE_PRODUCTS_FETCH_SIZE = 100;
const STORE_FILTER_BRANDS = ['TODAS', 'Toyota', 'Nissan', 'Hyundai', 'Chevrolet', 'Kia', 'Mazda', 'Suzuki', 'Mitsubishi'];
const STORE_FILTER_CONDITIONS = ['TODOS', 'Nuevo OEM Original', 'Nuevo Alternativo Homologado', 'Usado Certificado Desarmaduría'];

function normalizeShippingMethods(methods) {
  if (Array.isArray(methods)) return methods.filter(Boolean);
  return String(methods || '').split(',').map((method) => method.trim()).filter(Boolean);
}

function getShippingService(method) {
  const normalized = String(method || '').toLowerCase();
  if (normalized.includes('retiro') || normalized.includes('tienda')) return { icon: Store, label: 'Retiro en tienda' };
  if (normalized.includes('dentro') || normalized.includes('comuna')) return { icon: Bike, label: method };
  return { icon: Truck, label: method || 'Despacho disponible' };
}

export default function StorePublicProfileView({
  store,
  onBackToStores,
  onQuickView,
  onOpenQuote,
  activeVehicle: initialActiveVehicle,
  onEditStore
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
  const [isFollowing, setIsFollowing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [openFilterSections, setOpenFilterSections] = useState({ purchase: true, category: true, condition: true });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filterPanelRef = useRef(null);
  const [filterDrawerHeight, setFilterDrawerHeight] = useState(0);

  useEffect(() => {
    if (!isFiltersOpen || !filterPanelRef.current) {
      setFilterDrawerHeight(0);
      return undefined;
    }

    const panel = filterPanelRef.current;
    const measurePanel = () => setFilterDrawerHeight(Math.ceil(panel.getBoundingClientRect().height) + 16);
    measurePanel();
    const observer = new ResizeObserver(measurePanel);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [isFiltersOpen]);

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
      rut: inputStore.rut || '',
      tipo: inputStore.tipo || 'Casa de Repuestos Multimarca',
      ciudad: inputStore.ciudad || 'Santiago, RM',
      totalPublicaciones: inputStore.totalPublicaciones ?? 0,
      rating: inputStore.rating ?? 0,
      reviewCount: inputStore.reviewCount ?? 0,
      responseRate: inputStore.responseRate ?? null,
      marcasEspecialistas: Array.isArray(inputStore.marcasEspecialistas) ? inputStore.marcasEspecialistas : [],
      especialidad: Array.isArray(inputStore.marcasEspecialistas) && inputStore.marcasEspecialistas.length
        ? inputStore.marcasEspecialistas.map((marca) => marca.nombre).filter(Boolean).join(', ')
        : (inputStore.especialidad || 'Multimarca'),
      descripcion: inputStore.descripcion || inputStore.description || inputStore.tipo || 'Casa de Repuestos Multimarca',
      metodosEnvio: inputStore.metodosEnvio || ['Retiro en tienda', 'Envío dentro de la comuna'],
      coverUrl: inputStore.coverUrl || '/tiensoft_cover.jpg',
      logoUrl: inputStore.logoUrl || (inputStore.nombre?.toLowerCase().includes('tiensoft') ? '/tiensoft_logo.jpg' : null),
      bgColor: inputStore.bgColor || '#0066ff',
      initials: inputStore.initials || 'TS'
    };
  };

  // La ficha traída del backend manda sobre lo que llegó por prop (el directorio
  // entrega una versión resumida de la tienda).
  const storeProfileSource = fetchedStore && typeof store === 'object' && store
    ? {
        ...store,
        ...fetchedStore,
        logoUrl: fetchedStore.logoUrl || store.logoUrl || store.userProfileUrl,
        coverUrl: fetchedStore.coverUrl || store.coverUrl,
      }
    : (fetchedStore || store);
  const resolvedStore = resolveStore(storeProfileSource);
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

  const toggleFilterSection = (section) => {
    setOpenFilterSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const handleApplyStoreFilters = () => {
    setIsFiltersOpen(false);
    document.querySelector('.store-public-profile-wrapper .catalog-parts-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const shippingMethods = normalizeShippingMethods(currentStore.metodosEnvio);
  const rating = Number(currentStore.rating ?? 0);
  const reviewCount = Number(currentStore.reviewCount ?? 0);
  const responseRate = currentStore.responseRate ?? (rating > 0 ? Math.min(99, 94 + Math.round(rating)) : null);
  const isVerified = currentStore.verificada !== false;

  const handleShareStore = async () => {
    const shareData = {
      title: currentStore.nombre,
      text: `Revisa el catálogo de ${currentStore.nombre} en RepuesTop`,
      url: window.location.href,
    };

    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(window.location.href);
      setShareFeedback('Enlace copiado');
      window.setTimeout(() => setShareFeedback(''), 1800);
    } catch (error) {
      if (error?.name !== 'AbortError') setShareFeedback('No se pudo compartir');
    }
  };

  return (
    <div className="store-public-profile-wrapper">
      {/* 1. Store Cover & Profile Hero Banner */}
      <div className="store-public-hero-banner" style={{ '--store-cover': `url("${currentStore.coverUrl || '/tiensoft_cover.jpg'}")` }}>
        <div className="container store-hero-inner">
          <div className="store-hero-topbar">
            <button className="btn-back-marketplace" onClick={onBackToStores}>
              <ArrowLeft size={17} />
              <span>Volver a tiendas</span>
            </button>
            {onEditStore && (
              <button className="store-cover-edit-action" type="button" onClick={onEditStore}>
                <Image size={18} />
                <span><strong>Personalizar portada</strong><small>Editar logo e imagen de fondo</small></span>
              </button>
            )}
          </div>

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
              <span className="store-avatar-rating"><Star size={13} /> {rating ? rating.toFixed(1) : '—'}</span>
              {onEditStore && <button className="store-avatar-edit" type="button" onClick={onEditStore} aria-label="Editar imagen de perfil"><PenLine size={15} /></button>}
            </div>

            <div className="store-header-info-col">
              <div className="store-rut-badge">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>RUT: <strong>{currentStore.rut || 'No informado'}</strong> • Tienda Acreditada</span>
              </div>

              <h1 className="store-profile-name">{currentStore.nombre}</h1>
              <p className="store-profile-description">{currentStore.descripcion || currentStore.tipo}</p>
              <p className="store-profile-sub"><MapPin size={15} /> <strong>{currentStore.ciudad || 'Chile'}</strong><span>•</span>Especialidad: <strong>{currentStore.especialidad || currentStore.tipo}</strong></p>

              <div className="store-service-icons" aria-label="Servicios de la tienda">
                {shippingMethods.map((method) => {
                  const service = getShippingService(method);
                  const ServiceIcon = service.icon;
                  return <span key={method} title={service.label}><ServiceIcon size={15} /> {service.label}</span>;
                })}
              </div>
            </div>

            <div className="store-header-actions-col">
              <button
                className="btn-store-quote-main"
                onClick={() => onOpenQuote({ titulo: `Cotización General - ${currentStore.nombre}`, vendedor: currentStore.nombre })}
              >
                <MessageSquare size={19} />
                <span>Solicitar cotización directa</span>
                <ArrowRight size={18} />
              </button>

              <div className="store-social-actions">
                <button type="button" className={isFollowing ? 'active' : ''} onClick={() => setIsFollowing((value) => !value)}><Heart size={17} fill={isFollowing ? 'currentColor' : 'none'} /> {isFollowing ? 'Siguiendo' : 'Seguir tienda'}</button>
                <button type="button" onClick={handleShareStore}><Share2 size={17} /> {shareFeedback || 'Compartir'}</button>
              </div>
            </div>

            <div className="store-metrics-row">
              <div><span><Star size={19} /></span><p><strong>{rating ? rating.toFixed(1) : '—'}</strong><small>{reviewCount ? `${reviewCount.toLocaleString('es-CL')} evaluaciones` : 'Calificación de la tienda'}</small></p></div>
              <div><span><Package size={19} /></span><p><strong>{Number(currentStore.totalPublicaciones ?? 0).toLocaleString('es-CL')}</strong><small>Repuestos en stock</small></p></div>
              <div><span><Truck size={19} /></span><p><strong>{shippingMethods.length ? `${shippingMethods.length} opciones` : 'Consultar'}</strong><small>Servicios de entrega</small></p></div>
              <div><span><ShieldCheck size={19} /></span><p><strong>{isVerified ? 'Tienda verificada' : 'Tienda registrada'}</strong><small>{responseRate ? `${responseRate}% tasa de respuesta` : 'Información acreditada'}</small></p></div>
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

      <div className="container catalog-main-container store-profile-search-stack">
        {/* 2. License Plate Filter Console inside Store View */}
        <div className="patent-filter-box-bar">
          <div className="patent-filter-header-title">
            <Car size={24} />
            <span><strong>Buscar por patente</strong><small>Encuentra repuestos específicos para tu vehículo</small></span>
          </div>

          <form onSubmit={handlePatentSearch} className="patent-filter-form-inline">
            <input
              type="text"
              placeholder="Ingresa patente (ej. BBCL12)..."
              value={patentInput}
              onChange={(e) => setPatentInput(e.target.value)}
              className="patent-filter-input"
            />
            <HelpCircle className="store-search-help" size={17} />
            <button type="submit" className="btn-patent-search-blue" disabled={patentSearching}>
              <Search size={17} />
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
          <div className="store-inventory-search-title">
            <span><Search size={29} /></span>
            <p><strong>Buscar en el inventario de {currentStore.nombre}</strong><small>Más de {Number(currentStore.totalPublicaciones ?? 0).toLocaleString('es-CL')} repuestos disponibles</small></p>
          </div>
          <div className="store-inventory-search-body">
            <div className="store-inventory-search-row">
              <div className="search-bar-catalog-box">
                <Search size={18} className="search-box-icon" />
                <input
                  type="text"
                  placeholder="Buscar por nombre de repuesto, código OEM, marca o modelo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-catalog-input"
                />
                {searchQuery && <button className="btn-clear-search-dir" onClick={() => setSearchQuery('')}><X size={14} /></button>}
              </div>
              <button className="store-open-filters" type="button" onClick={() => setIsFiltersOpen(true)}><SlidersHorizontal size={18} /> Filtros <ChevronRight size={16} /></button>
            </div>
            <div className="store-popular-searches">
              <span>Búsquedas populares:</span>
              {['Pastillas de freno', 'Filtro de aceite', 'Alternador', 'Amortiguadores', 'Kit de distribución'].map((term) => <button type="button" key={term} onClick={() => setSearchQuery(term)}>{term}</button>)}
            </div>
          </div>
        </div>

        <div className="store-results-toolbar">
          <span>Mostrando <strong>{sortedProducts.length}</strong> repuestos de {currentStore.nombre}</span>
          <label>Ordenar por:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="relevancia">Recomendados / Relevancia</option>
              <option value="precio-asc">Precio: Menor a Mayor</option>
              <option value="precio-desc">Precio: Mayor a Menor</option>
              <option value="vendidos">Más Vendidos</option>
            </select>
          </label>
        </div>

        {/* 4. 2-Column Content Layout (Sidebar + Grid) */}
        <div className={`catalog-content-grid store-catalog-main-content-grid product-filter-drawer-layout ${isFiltersOpen ? 'filters-open' : ''}`} style={isFiltersOpen && filterDrawerHeight ? { minHeight: `${filterDrawerHeight}px` } : undefined}>
          {isFiltersOpen && <button className="catalog-filter-backdrop" type="button" aria-label="Cerrar filtros" onClick={() => setIsFiltersOpen(false)} />}
          {/* Left Technical Filters Sidebar */}
          <aside ref={filterPanelRef} className="catalog-sidebar-filters catalog-advanced-filter-panel store-advanced-filter-panel">
            <div className="sidebar-filters-header">
              <div className="sidebar-title-group">
                <SlidersHorizontal size={25} />
                <span><strong>Filtros Avanzados</strong><small>Filtra el inventario de {currentStore.nombre}</small></span>
              </div>

              <div className="filter-panel-header-actions">
                <button className="btn-reset-filters-mini" onClick={handleResetFilters}><RotateCcw size={15} /><span>Limpiar</span></button>
                <button className="btn-close-filter-drawer" type="button" onClick={() => setIsFiltersOpen(false)} aria-label="Cerrar filtros" title="Cerrar filtros"><X size={16} /></button>
              </div>
            </div>

            {/* Filter 0: Modalidad de Compra */}
            <div className={`filter-section-group ${openFilterSections.purchase ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('purchase')} aria-expanded={openFilterSections.purchase}>
                <span className="filter-group-label"><ShoppingCart size={13} /> Modalidad de Compra</span><ChevronDown size={16} />
              </button>
              {openFilterSections.purchase && <div className="filter-options-list">
                <button
                  className={`filter-option-btn ${purchaseType === 'TODOS' ? 'active' : ''}`}
                  onClick={() => setPurchaseType('TODOS')}
                >
                  <span className="filter-choice-dot">{purchaseType === 'TODOS' && <CheckCircle2 size={18} />}</span>
                  <span className="filter-option-copy"><strong>Todos los Repuestos</strong><small>Ver todo el inventario</small></span>
                </button>
                <button
                  className={`filter-option-btn ${purchaseType === 'DIRECTA' ? 'active' : ''}`}
                  onClick={() => setPurchaseType('DIRECTA')}
                >
                  <span className="filter-choice-dot">{purchaseType === 'DIRECTA' && <CheckCircle2 size={18} />}</span>
                  <span className="filter-option-copy"><strong>Con Precio Directo</strong><small>Compra inmediata</small></span>
                </button>
                <button
                  className={`filter-option-btn ${purchaseType === 'COTIZACION' ? 'active' : ''}`}
                  onClick={() => setPurchaseType('COTIZACION')}
                >
                  <span className="filter-choice-dot">{purchaseType === 'COTIZACION' && <CheckCircle2 size={18} />}</span>
                  <span className="filter-option-copy"><strong>Solo Bajo Cotización</strong><small>Requiere evaluación</small></span>
                </button>
              </div>}
            </div>

            {/* Filter 1: Categorías */}
            <div className={`filter-section-group ${openFilterSections.category ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('category')} aria-expanded={openFilterSections.category}>
                <span className="filter-group-label"><Layers size={13} /> Categoría del Repuesto</span><ChevronDown size={16} />
              </button>
              {openFilterSections.category && <div className="filter-options-list category-options-scroll">
                <button
                  className={`filter-option-btn ${selectedCategory === 'TODAS' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('TODAS')}
                >
                  <span className="filter-category-icon filter-category-icon-all"><Layers size={13} /></span>
                  <span className="filter-option-copy"><strong>Todas las Categorías</strong><small>Explorar el catálogo completo</small></span>
                  {selectedCategory === 'TODAS' && <CheckCircle2 size={14} className="check-active" />}
                </button>
                {NAVIGATION_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    className={`filter-option-btn ${selectedCategory === cat.filterId ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.filterId)}
                  >
                    <CategoryIconTile iconName={cat.iconName} color={cat.color} size={9} className="filter-category-icon" />
                    <span className="filter-option-copy"><strong>{cat.nombre}</strong></span>
                    {selectedCategory === cat.filterId ? <CheckCircle2 size={18} className="check-active" /> : <ChevronRight size={16} className="filter-option-chevron" />}
                  </button>
                ))}
              </div>}
            </div>

            {/* Filter 2: Condición */}
            <div className={`filter-section-group ${openFilterSections.condition ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('condition')} aria-expanded={openFilterSections.condition}>
                <span className="filter-group-label"><ShieldCheck size={13} /> Condición Técnica</span><ChevronDown size={16} />
              </button>
              {openFilterSections.condition && <div className="filter-options-list">
                {STORE_FILTER_CONDITIONS.map((cond, index) => (
                  <button
                    key={cond}
                    className={`filter-option-btn ${selectedCondition === cond ? 'active' : ''}`}
                    onClick={() => setSelectedCondition(cond)}
                  >
                    <span className="filter-condition-icon">{index === 0 ? <CheckCircle2 size={14} /> : index === 1 ? <Package size={14} /> : index === 2 ? <ShieldCheck size={14} /> : <RotateCcw size={14} />}</span>
                    <span className="filter-option-copy"><strong>{cond === 'TODOS' ? 'Todos los Estados' : cond}</strong><small>{cond === 'TODOS' ? 'Mostrar todas las opciones' : index === 1 ? 'Producto 100% original' : index === 2 ? 'Alternativa de calidad' : 'Revisado y garantizado'}</small></span>
                    {selectedCondition === cond && <CheckCircle2 size={14} className="check-active" />}
                  </button>
                ))}
              </div>}
            </div>

            <div className="filter-section-group compact-select-section">
              <label className="filter-group-label"><Car size={13} /> Marca de Vehículo</label>
              <select value={selectedBrand} onChange={(event) => setSelectedBrand(event.target.value)} className="sidebar-select-input">
                {STORE_FILTER_BRANDS.map((brand) => <option key={brand} value={brand}>{brand === 'TODAS' ? 'Todas las Marcas' : brand}</option>)}
              </select>
            </div>

            <button className="btn-clear-all-filters-wide" onClick={handleApplyStoreFilters}>
              <Search size={18} />
              <span>Aplicar Filtros y Ver Resultados</span>
            </button>
            <p className="filter-security-note"><ShieldCheck size={14} /> Inventario exclusivo de {currentStore.nombre}.</p>
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
                    <MarketplaceProductCard
                      key={prod.id}
                      product={prod}
                      onView={onQuickView}
                      fallbackCity={currentStore.ciudad || 'Santiago, RM'}
                    />
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
