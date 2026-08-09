import React, { useState, useEffect } from 'react';
import {
  Search, SlidersHorizontal, ShieldCheck, MapPin, Star, Package,
  ArrowLeft, X, CheckCircle2, RotateCcw, Truck, ChevronLeft, ChevronRight, ChevronDown,
  ShoppingCart, Car, Wrench, Layers, Building2, MessageSquare, AlertCircle,
  Heart, Share2, Image, PenLine, ArrowRight, HelpCircle,
  CarFront, Barcode, CircleHelp, RefreshCw, Tag
} from 'lucide-react';
import { NAVIGATION_CATEGORIES } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';
import MarketplaceProductCard from './MarketplaceProductCard';
import { parseShippingMethods, resolveShippingService } from '../data/shippingMethods';
import { getStoreProductsApi, getStoreProfileApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptPage, adaptProduct, adaptStore, adaptVehicle } from '../services/adapters';

// El backend acota el tamaño de página a 100; esta vista filtra y pagina en cliente.
const STORE_PRODUCTS_FETCH_SIZE = 100;
const STORE_FILTER_BRANDS = ['TODAS', 'Toyota', 'Nissan', 'Hyundai', 'Chevrolet', 'Kia', 'Mazda', 'Suzuki', 'Mitsubishi'];
const STORE_FILTER_CONDITIONS = ['TODOS', 'Nuevo OEM Original', 'Nuevo Alternativo Homologado', 'Usado Certificado Desarmaduría'];

const SEARCH_MODES = [
  { id: 'patente', label: 'Buscar por patente', icon: CarFront, placeholder: 'Ej: BB-CL-12' },
  { id: 'vin', label: 'Buscar por VIN', icon: Barcode, placeholder: 'Ingresa los 17 caracteres del VIN' },
  { id: 'oem', label: 'Buscar por código OEM', icon: Tag, placeholder: 'Ej: 04465-0D150' },
  { id: 'repuesto', label: 'Buscar por repuesto', icon: Search, placeholder: 'Ej: Pastillas de freno, filtro de aceite, Bosch...' }
];

const samplePatentes = ['BB-CL-12', 'HG-89-21', 'AA-123-BB', 'JJ-TT-45'];
const sampleOemCodes = ['04465-0D150', '90919-01253', '26300-35505', '15400-PLM-A02'];
const sampleKeywords = ['Pastillas de freno', 'Filtro de aceite', 'Amortiguador', 'Bomba de agua'];

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
  const [searchMode, setSearchMode] = useState('patente');
  const [inputValue, setInputValue] = useState(initialActiveVehicle?.patente || '');

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
      metodosEnvio: Array.isArray(inputStore.metodosEnvio) ? inputStore.metodosEnvio : ['Retiro en tienda'],
      logoUrl: inputStore.logoUrl || null,
      coverUrl: inputStore.coverUrl || null,
      descripcion: inputStore.descripcion || '',
      direccion: inputStore.direccion || '',
      telefono: inputStore.telefono || '',
      email: inputStore.email || '',
      esOficial: !!inputStore.esOficial
    };
  };

  const currentStore = fetchedStore || resolveStore(store);
  const storeId = currentStore?.id;
  const rating = Number(currentStore.rating ?? 0);
  const reviewCount = Number(currentStore.reviewCount ?? 0);
  const responseRate = currentStore.responseRate != null ? Number(currentStore.responseRate) : null;
  const shippingMethods = parseShippingMethods(currentStore.metodosEnvio);
  const isVerified = currentStore.esOficial || rating >= 4.5;

  // Ficha pública de la tienda: GET /api/v1/tiendas/{proveedorId}
  useEffect(() => {
    if (!storeId) return undefined;
    let isMounted = true;

    getStoreProfileApi(storeId)
      .then((data) => {
        if (isMounted) setFetchedStore(adaptStore(data));
      })
      .catch(() => {
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

  const currentSearchMode = SEARCH_MODES.find((m) => m.id === searchMode) || SEARCH_MODES[0];

  const selectSearchMode = (modeId) => {
    setSearchMode(modeId);
    setPatentError('');
    if (modeId === 'patente') {
      setInputValue(activeVehicle?.patente || patentInput || '');
    } else if (modeId === 'vin') {
      setInputValue(patentInput || '');
    } else if (modeId === 'oem' || modeId === 'repuesto') {
      setInputValue(searchQuery || '');
    }
  };

  const handleUnifiedSearch = async (valToUse) => {
    const value = (valToUse !== undefined ? valToUse : inputValue).trim();
    if (!value) {
      if (searchMode === 'patente') {
        setPatentError('Ingresa una patente válida (ej. BB-CL-12)');
      } else if (searchMode === 'vin') {
        setPatentError('Ingresa los 17 caracteres del VIN');
      } else if (searchMode === 'oem') {
        setPatentError('Ingresa un código OEM (ej. 04465-0D150)');
      } else {
        setPatentError('Ingresa un término para buscar repuestos');
      }
      return;
    }

    setPatentError('');

    if (searchMode === 'patente' || searchMode === 'vin') {
      setPatentSearching(true);
      setPatentInput(value);
      try {
        const resolved = adaptVehicle(await searchVehicleByPatenteApi(value));
        if (resolved && !resolved.requiereIngresoManual && resolved.marca) {
          setActiveVehicle(resolved);
          setOnlyCompatible(true);
          setInputValue(resolved.patente || value);
        } else {
          setActiveVehicle(null);
          setPatentError(resolved?.mensaje || 'No encontramos ese vehículo. Verifica la patente o VIN e intenta de nuevo.');
        }
      } catch (err) {
        setActiveVehicle(null);
        setPatentError(err.message || 'No se pudo consultar la patente o VIN. Intenta nuevamente.');
      } finally {
        setPatentSearching(false);
      }
    } else if (searchMode === 'oem' || searchMode === 'repuesto') {
      setSearchQuery(value);
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

    // 3. Technical Condition
    if (selectedCondition !== 'TODOS' && prod.condicion && prod.condicion !== selectedCondition) {
      return false;
    }

    // 4. Vehicle Compatibility
    if (onlyCompatible && activeVehicle) {
      const matchesVehicle = (prod.compatibilidad || []).some(
        c => c.marca?.toLowerCase() === activeVehicle.marca?.toLowerCase() &&
             c.modelo?.toLowerCase() === activeVehicle.modelo?.toLowerCase()
      );
      if (!matchesVehicle) return false;
    }

    // 5. Purchase Type / Modalidad Filter (Precio Directo vs Solo Cotización)
    if (purchaseType === 'DIRECTA') {
      const isQuoteOnly = prod.soloCotizacion || !prod.precio || prod.precio === 0;
      if (isQuoteOnly) return false;
    } else if (purchaseType === 'COTIZACION') {
      const isQuoteOnly = prod.soloCotizacion || !prod.precio || prod.precio === 0;
      if (!isQuoteOnly) return false;
    }

    return true;
  });

  // Sorting Logic
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

  const toggleFollow = () => setIsFollowing(!isFollowing);

  const handleShare = async () => {
    const shareData = {
      title: currentStore.nombre,
      text: `Mira los repuestos de ${currentStore.nombre} en RepuesTop`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareFeedback('Compartido');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareFeedback('Enlace copiado');
      }
    } catch {
      setShareFeedback('Enlace copiado');
    }
    setTimeout(() => setShareFeedback(''), 2500);
  };

  const handleResetStoreFilters = () => {
    setSearchQuery('');
    setInputValue('');
    setSelectedCategory('TODAS');
    setSelectedCondition('TODOS');
    setSelectedBrand('TODAS');
    setOnlyCompatible(false);
    setPurchaseType('TODOS');
    setSortBy('relevancia');
    setCurrentPage(1);
  };

  const toggleFilterSection = (section) => {
    setOpenFilterSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="store-public-profile-wrapper">
      {/* 1. Header Banner & Store Info */}
      <div className="store-header-banner">
        <div className="store-cover-image">
          {currentStore.coverUrl ? (
            <img src={currentStore.coverUrl} alt="Portada de la tienda" />
          ) : (
            <div className="store-cover-placeholder" />
          )}
          <div className="store-cover-overlay" />
          <button className="btn-back-stores" onClick={onBackToStores}>
            <ArrowLeft size={16} />
            <span>Volver a Tiendas</span>
          </button>
          {onEditStore && (
            <button className="btn-edit-store-profile" onClick={onEditStore} title="Editar mi tienda">
              <PenLine size={15} />
              <span>Editar tienda</span>
            </button>
          )}
        </div>

        <div className="container store-profile-content">
          <div className="store-main-info-card">
            <div className="store-avatar-box">
              {currentStore.logoUrl ? (
                <img src={currentStore.logoUrl} alt={currentStore.nombre} />
              ) : (
                <div className="store-avatar-fallback">
                  <Building2 size={36} />
                </div>
              )}
              {isVerified && <span className="verified-badge-icon" title="Tienda Verificada Oficial"><ShieldCheck size={18} /></span>}
            </div>

            <div className="store-info-details">
              <div className="store-title-badge-row">
                <h1>{currentStore.nombre}</h1>
                {isVerified && <span className="badge-official-store"><ShieldCheck size={13} /> TIENDA VERIFICADA</span>}
              </div>

              <p className="store-subtitle-meta">
                <span>{currentStore.tipo}</span> • <MapPin size={13} /> {currentStore.ciudad} • RUT: {currentStore.rut}
              </p>

              {currentStore.descripcion && (
                <p className="store-description-text">{currentStore.descripcion}</p>
              )}

              <div className="store-action-buttons">
                <button
                  className={`btn-follow-store ${isFollowing ? 'following' : ''}`}
                  onClick={toggleFollow}
                >
                  <Heart size={16} className={isFollowing ? 'fill-current' : ''} />
                  <span>{isFollowing ? 'Siguiendo tienda' : 'Seguir tienda'}</span>
                </button>

                <button className="btn-share-store" onClick={handleShare}>
                  <Share2 size={16} />
                  <span>{shareFeedback || 'Compartir'}</span>
                </button>
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
        {/* 2. License Plate & Inventory Unified Filter Console inside Store View */}
        <div className="light-search-panel catalog-unified-search-panel">
          <div className="light-search-tabs" role="tablist" aria-label="Tipos de búsqueda">
            {SEARCH_MODES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={searchMode === item.id}
                  className={searchMode === item.id ? 'active' : ''}
                  onClick={() => selectSearchMode(item.id)}
                >
                  <Icon size={20} /> <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className={`light-search-form ${searchMode !== 'patente' ? 'mode-no-country' : ''}`}>
            <div className="light-input-row">
              {searchMode === 'patente' && (
                <button className="country-selector" type="button">
                  <span>🇨🇱</span><strong>CHILE</strong><ChevronRight size={14} />
                </button>
              )}
              <div className="light-query-field">
                <input
                  type="text"
                  placeholder={currentSearchMode.placeholder}
                  value={inputValue}
                  onChange={(event) => {
                    const val = searchMode === 'patente' || searchMode === 'vin' || searchMode === 'oem'
                      ? event.target.value.toUpperCase()
                      : event.target.value;
                    setInputValue(val);
                    if (searchMode === 'oem' || searchMode === 'repuesto') {
                      setSearchQuery(val);
                    }
                    if (patentError) setPatentError('');
                  }}
                  onKeyDown={(event) => event.key === 'Enter' && handleUnifiedSearch()}
                />
                {searchMode === 'patente' && (
                  <button type="button" className="plate-help">
                    <CircleHelp size={14} /> ¿Dónde está mi patente?
                  </button>
                )}
              </div>
            </div>

            <button
              className="light-primary-search"
              onClick={() => handleUnifiedSearch()}
              disabled={patentSearching}
              type="button"
            >
              {patentSearching ? <RefreshCw size={21} className="spin-icon" /> : <Search size={22} />}
              {searchMode === 'patente'
                ? `Buscar vehículo en ${currentStore.nombre}`
                : searchMode === 'vin'
                  ? 'Buscar por VIN'
                  : searchMode === 'oem'
                    ? `Buscar por código OEM en ${currentStore.nombre}`
                    : `Buscar repuestos en ${currentStore.nombre}`}
            </button>

            {patentError && (
              <div className="light-search-error">
                <AlertCircle size={14} /> {patentError}
              </div>
            )}

            {activeVehicle && (
              <div className="light-active-vehicle">
                <CheckCircle2 size={17} />
                <span>Vehículo activo: <strong>{activeVehicle.marca} {activeVehicle.modelo} ({activeVehicle.patente})</strong></span>
                <button
                  type="button"
                  className={`btn-toggle-compat-mini ${onlyCompatible ? 'active' : ''}`}
                  onClick={() => setOnlyCompatible(!onlyCompatible)}
                  style={{ marginLeft: 'auto' }}
                >
                  {onlyCompatible ? '✓ Solo compatibles' : 'Filtrar calce'}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveVehicle(null); setOnlyCompatible(false); }}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px 6px' }}
                  title="Quitar vehículo"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="popular-searches">
              <span>
                {searchMode === 'patente'
                  ? 'Patentes populares:'
                  : searchMode === 'oem'
                    ? 'Códigos OEM sugeridos:'
                    : searchMode === 'vin'
                      ? 'Ejemplos VIN:'
                      : 'Búsquedas populares:'}
              </span>
              {(searchMode === 'patente' ? samplePatentes : searchMode === 'oem' ? sampleOemCodes : sampleKeywords).map((item) => (
                <button key={item} type="button" onClick={() => { setInputValue(item); handleUnifiedSearch(item); }}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

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
                  placeholder="Filtrar por código OEM, repuesto, marca o modelo en esta tienda..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (searchMode === 'oem' || searchMode === 'repuesto') {
                      setInputValue(e.target.value);
                    }
                  }}
                  className="search-catalog-input"
                />
                {searchQuery && (
                  <button
                    className="btn-clear-search-dir"
                    onClick={() => {
                      setSearchQuery('');
                      if (searchMode === 'oem' || searchMode === 'repuesto') setInputValue('');
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
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
        <div className="catalog-content-grid store-catalog-main-content-grid">
          {/* Left Technical Filters Sidebar */}
          <aside className="catalog-sidebar-filters catalog-advanced-filter-panel store-advanced-filter-panel">
            <div className="sidebar-filters-header">
              <div className="sidebar-title-group">
                <SlidersHorizontal size={25} />
                <span><strong>Filtros Avanzados</strong><small>Filtra el inventario de {currentStore.nombre}</small></span>
              </div>

              <div className="filter-panel-header-actions">
                <button className="btn-reset-filters-mini" onClick={handleResetFilters}><RotateCcw size={15} /><span>Limpiar</span></button>
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
