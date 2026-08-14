import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Filter, SlidersHorizontal, ShieldCheck, MapPin, Star, Package,
  Clock, ArrowRight, ArrowLeft, X, CheckCircle2, RotateCcw, Tag, Truck,
  ChevronLeft, ChevronRight, ChevronDown, Eye, ShoppingCart, Car, Wrench, Layers, AlertCircle, Globe, MessageSquare, Info,
  CarFront, Barcode, CircleHelp, RefreshCw
} from 'lucide-react';
// CategoryIconTile y NAVIGATION_CATEGORIES se usaban sin estar importados, por lo que la
// vista lanzaba ReferenceError al montarse (el ErrorBoundary la reemplazaba por completo).
import CategoryIconTile from './CategoryIconTile';
import MarketplaceProductCard from './MarketplaceProductCard';
import ProductCardSkeleton from './skeletons/ProductCardSkeleton';
import { qk } from '../services/queryKeys';
import {
  NAVIGATION_CATEGORIES, CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID, CATEGORY_IMAGE_BY_ID
} from '../data/categories';
import { getPartCategoriesApi, getPublicProductsApi, searchVehicleByPatenteApi, getAddressesApi } from '../services/api';
import { adaptPage, adaptProduct, adaptVehicle } from '../services/adapters';
import { useAuth } from '../context/AuthContext';

// El backend acota el tamaño de página a 100. Esta vista filtra y pagina en cliente,
// así que se trae un bloque grande y la UI hace el resto del trabajo.
const CATALOG_FETCH_SIZE = 100;

const SEARCH_MODES = [
  { id: 'patente', label: 'Buscar por patente', icon: CarFront, placeholder: 'Ej: BB-CL-12' },
  { id: 'oem', label: 'Buscar por código OEM', icon: Tag, placeholder: 'Ej: 04465-0D150' },
  { id: 'repuesto', label: 'Buscar por repuesto', icon: Search, placeholder: 'Ej: Pastillas de freno, filtro de aceite, Bosch...' }
];

const samplePatentes = ['BB-CL-12', 'HG-89-21', 'AA-123-BB', 'JJ-TT-45'];
const sampleOemCodes = ['04465-0D150', '90919-01253', '26300-35505', '15400-PLM-A02'];
const sampleKeywords = ['Pastillas de freno', 'Filtro de aceite', 'Amortiguador', 'Bomba de agua'];

export default function PartsCatalogView({
  onBackToStore,
  onAddToCart,
  onQuickView,
  onOpenQuote,
  activeVehicle: initialActiveVehicle,
  initialCatalogFilter = null,
  initialSearchQuery = '',
  initialPage = 1,
  onNavigationStateChange,
}) {
  const [activeVehicle, setActiveVehicle] = useState(initialActiveVehicle);
  const [patentInput, setPatentInput] = useState('');
  const [patentError, setPatentError] = useState('');
  const [patentSearching, setPatentSearching] = useState(false);
  const [searchMode, setSearchMode] = useState('patente');
  const [inputValue, setInputValue] = useState(initialActiveVehicle?.patente || initialSearchQuery || '');

  // "Filtrar por mi comuna": solo repuestos de tiendas ubicadas en la misma
  // comuna registrada en el perfil del usuario logueado (comprador o vendedor).
  const { user, isLoggedIn } = useAuth();
  const [filterByMyComuna, setFilterByMyComuna] = useState(false);
  const [myComunaId, setMyComunaId] = useState(null);
  const [myComunaNombre, setMyComunaNombre] = useState('');
  const [comunaLookupStatus, setComunaLookupStatus] = useState('idle'); // idle | loading | ready | no-comuna | error
  const [comunaNotice, setComunaNotice] = useState('');
  const activeComunaId = filterByMyComuna ? myComunaId : null;

  const handleToggleComunaFilter = async () => {
    if (filterByMyComuna) {
      setFilterByMyComuna(false);
      setComunaNotice('');
      return;
    }

    if (!isLoggedIn || !user?.userId) {
      setComunaNotice('Debes iniciar sesión y registrar una comuna desde tu perfil para usar este filtro.');
      return;
    }

    if (myComunaId) {
      setFilterByMyComuna(true);
      setComunaNotice('');
      return;
    }

    setComunaLookupStatus('loading');
    setComunaNotice('');
    try {
      const addresses = await getAddressesApi(user.userId);
      const list = Array.isArray(addresses) ? addresses : [];
      const principal = list.find((addr) => addr.esPrincipal) || list[0];
      if (principal?.comunaId) {
        setMyComunaId(principal.comunaId);
        setMyComunaNombre(principal.comunaNombre || '');
        setFilterByMyComuna(true);
        setComunaLookupStatus('ready');
      } else {
        setComunaLookupStatus('no-comuna');
        setComunaNotice('Primero debes registrar una comuna desde tu perfil para poder usar este filtro.');
      }
    } catch (err) {
      setComunaLookupStatus('error');
      setComunaNotice(err.message || 'No pudimos verificar tu comuna registrada. Intenta nuevamente.');
    }
  };

  // Catálogo real con TanStack Query
  const {
    data: products = [],
    isLoading: productsLoading,
    error: productsQueryError
  } = useQuery({
    queryKey: qk.products({
      size: CATALOG_FETCH_SIZE,
      categoryId: initialCatalogFilter?.categoryId,
      subcategoryId: initialCatalogFilter?.subcategoryId,
      comunaId: activeComunaId,
    }),
    queryFn: async ({ signal }) => {
      let categoriaId = initialCatalogFilter?.categoryId;
      if (!categoriaId && initialCatalogFilter?.categoryName) {
        const categories = await getPartCategoriesApi({ signal });
        const normalizeName = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        categoriaId = (Array.isArray(categories) ? categories : [])
          .find((category) => normalizeName(category.nombre) === normalizeName(initialCatalogFilter.categoryName))?.id;
      }
      const data = await getPublicProductsApi({
        page: 0,
        size: CATALOG_FETCH_SIZE,
        categoriaId,
        subcategoriaId: initialCatalogFilter?.subcategoryId,
        comunaId: activeComunaId,
        sort: 'createdAt,desc',
        signal,
      });
      return adaptPage(data, adaptProduct).items;
    },
  });

  const productsError = productsQueryError ? (productsQueryError.message || 'No se pudo cargar el catálogo de repuestos.') : null;

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCatalogFilter?.category || 'TODAS');
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialCatalogFilter?.subcategory || 'TODAS');
  const [selectedCondition, setSelectedCondition] = useState('TODOS');
  const [selectedOrigin, setSelectedOrigin] = useState('TODOS');
  const [selectedBrand, setSelectedBrand] = useState('TODAS');
  const [purchaseType, setPurchaseType] = useState('TODOS'); // 'TODOS' | 'DIRECTA' | 'COTIZACION'
  const [onlyCompatible, setOnlyCompatible] = useState(!!initialActiveVehicle);
  const [onlyFastDelivery, setOnlyFastDelivery] = useState(false);
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [sortBy, setSortBy] = useState('relevancia');
  const [openFilterSections, setOpenFilterSections] = useState({
    purchase: true,
    category: true,
    subcategory: true,
    condition: true,
    shipping: true,
  });
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    setSelectedCategory(initialCatalogFilter?.category || 'TODAS');
    setSelectedSubcategory(initialCatalogFilter?.subcategory || 'TODAS');
  }, [initialCatalogFilter?.category, initialCatalogFilter?.subcategory]);

  // El término de búsqueda también llega por URL (`/repuestos?q=...`), tanto desde
  // el buscador del header como al abrir o compartir un enlace.
  useEffect(() => {
    setSearchQuery(initialSearchQuery);
    if (initialSearchQuery) {
      setInputValue(initialSearchQuery);
      setSearchMode('repuesto');
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    setActiveVehicle(initialActiveVehicle);
    if (initialActiveVehicle) {
      setOnlyCompatible(true);
      if (initialActiveVehicle.patente) {
        setInputValue(initialActiveVehicle.patente);
        setSearchMode('patente');
      }
    }
  }, [initialActiveVehicle]);

  const toggleFilterSection = (section) => {
    setOpenFilterSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const currentSearchMode = SEARCH_MODES.find((m) => m.id === searchMode) || SEARCH_MODES[0];

  const selectSearchMode = (modeId) => {
    setSearchMode(modeId);
    setPatentError('');
    if (modeId === 'patente') {
      setInputValue(activeVehicle?.patente || patentInput || '');
    } else if (modeId === 'oem' || modeId === 'repuesto') {
      setInputValue(searchQuery || '');
    }
  };

  const handleUnifiedSearch = async (valToUse) => {
    const value = (valToUse !== undefined ? valToUse : inputValue).trim();
    if (!value) {
      if (searchMode === 'patente') {
        setPatentError('Ingresa una patente válida (ej. BB-CL-12)');
      } else if (searchMode === 'oem') {
        setPatentError('Ingresa un código OEM (ej. 04465-0D150)');
      } else {
        setPatentError('Ingresa un término para buscar repuestos');
      }
      return;
    }

    setPatentError('');

    if (searchMode === 'patente') {
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
          setPatentError(resolved?.mensaje || 'No encontramos ese vehículo. Verifica la patente e intenta de nuevo.');
        }
      } catch (err) {
        setActiveVehicle(null);
        setPatentError(err.message || 'No se pudo consultar la patente. Intenta nuevamente.');
      } finally {
        setPatentSearching(false);
      }
    } else if (searchMode === 'oem' || searchMode === 'repuesto') {
      setSearchQuery(value);
    }
  };

  // Pagination state (la página vive en la URL: `/repuestos?pagina=3`)
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

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

  // Reset to page 1 when any filter changes.
  const previousFiltersRef = useRef(null);
  useEffect(() => {
    const signature = JSON.stringify([
      searchQuery, selectedCategory, selectedSubcategory, selectedCondition, selectedOrigin,
      selectedBrand, onlyCompatible, onlyFastDelivery, maxPrice, sortBy, itemsPerPage
    ]);
    const previous = previousFiltersRef.current;
    previousFiltersRef.current = signature;
    if (previous === null || previous === signature) return;
    setCurrentPage(1);
  }, [
    searchQuery, selectedCategory, selectedSubcategory, selectedCondition, selectedOrigin,
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

    if (selectedSubcategory !== 'TODAS' && prod.subcategoria !== selectedSubcategory) return false;

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

  useEffect(() => {
    onNavigationStateChange?.({
      category: selectedCategory === 'TODAS' ? null : selectedCategory,
      subcategory: selectedSubcategory === 'TODAS' ? null : selectedSubcategory,
      query: searchQuery,
      page: currentPage,
    });
  }, [onNavigationStateChange, selectedCategory, selectedSubcategory, searchQuery, currentPage]);

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
    setInputValue('');
    setSelectedCategory('TODAS');
    setSelectedSubcategory('TODAS');
    setSelectedCondition('TODOS');
    setSelectedOrigin('TODOS');
    setSelectedBrand('TODAS');
    setOnlyCompatible(false);
    setOnlyFastDelivery(false);
    setMaxPrice(1000000);
    setSortBy('relevancia');
    setCurrentPage(1);
  };

  const handleApplyFilters = () => {
    document.querySelector('.catalog-parts-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const appliedFilterLabel = selectedSubcategory !== 'TODAS'
    ? selectedSubcategory
    : selectedCategory !== 'TODAS'
      ? (NAVIGATION_CATEGORIES.find((category) => category.filterId === selectedCategory)?.nombre || selectedCategory)
      : null;

  const clearAppliedCatalogFilter = () => {
    setSelectedCategory('TODAS');
    setSelectedSubcategory('TODAS');
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
            <h1>Inventario General de <span>Repuestos</span></h1>
            <p>
              Busca y filtra repuestos mecánicos, eléctricos y de carrocería por patente o código OEM con origen verificado y calce 100% garantizado.
            </p>
            <div className="catalog-hero-perks">
              <span><ShieldCheck size={20} /> 100% OEM Verificado</span>
              <span><Package size={20} /> Miles de productos en stock</span>
              <span><Truck size={20} /> Despacho a todo Chile</span>
              <span><ShieldCheck size={20} /> Garantía de compatibilidad</span>
            </div>
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

      <div className="container catalog-patent-console-wrap">
        <div className="light-search-panel catalog-unified-search-panel">
          <div className="catalog-comuna-filter-row">
            <div className="my-comuna-filter-pill">
              <MapPin size={16} className="text-blue-400" />
              <span>Filtrar por mi comuna</span>
              <button
                type="button"
                className={`btn-toggle-compat-mini ${filterByMyComuna ? 'active' : ''}`}
                onClick={handleToggleComunaFilter}
                disabled={comunaLookupStatus === 'loading'}
                title="Muestra solo los repuestos de casas de repuesto ubicadas en tu misma comuna (la comuna registrada en tu perfil)."
              >
                {comunaLookupStatus === 'loading'
                  ? 'Buscando tu comuna...'
                  : filterByMyComuna
                    ? `✓ Solo tiendas en ${myComunaNombre || 'tu comuna'}`
                    : 'Activar filtro'}
              </button>
            </div>
            {comunaNotice && (
              <div className="light-search-error catalog-comuna-notice">
                <AlertCircle size={14} /> {comunaNotice}
              </div>
            )}
          </div>

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
                    const val = searchMode === 'patente' || searchMode === 'oem'
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
                ? 'Buscar vehículo por patente'
                : searchMode === 'oem'
                  ? 'Buscar por código OEM'
                  : 'Buscar repuestos'}
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
      </div>

      <div className="container catalog-main-container">
        {/* 2. Top Control Bar (Search & Sort) */}
        <div className="catalog-control-bar">
          <div className="search-bar-catalog-box">
            <Search size={18} className="search-box-icon" />
            <input
              type="text"
              placeholder="Filtrar por código OEM, repuesto, marca o vendedor..."
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

        {appliedFilterLabel && <div className="catalog-applied-filter-notice">
          <Filter size={15} /><span>Filtro aplicado: <strong>{appliedFilterLabel}</strong></span>
          <button type="button" onClick={clearAppliedCatalogFilter}><X size={14} /> Quitar filtro</button>
        </div>}

        {/* 3. Main 2-Column Content Layout (Technical Sidebar + Parts Grid) */}
        <div className="catalog-content-grid catalog-main-content-grid">
          {/* Sidebar Technical Filters (Left 280px) */}
          <aside className="catalog-sidebar-filters catalog-advanced-filter-panel">
            <div className="sidebar-filters-header">
              <div className="sidebar-title-group">
                <SlidersHorizontal size={25} />
                <span><strong>Filtros Avanzados</strong><small>Encuentra el repuesto exacto para tu vehículo</small></span>
              </div>

              <div className="filter-panel-header-actions">
                <button className="btn-reset-filters-mini" onClick={handleResetFilters}>
                  <RotateCcw size={15} />
                  <span>Limpiar</span>
                </button>
              </div>
            </div>

            {/* Filter 0: Modalidad / Origen de Compra */}
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
                  <span className="filter-option-copy"><strong>Todos los Repuestos</strong><small>Ver todos los productos</small></span>
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

            {/* Filter 1: Categoría del Repuesto */}
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
                  <span className="filter-option-copy"><strong>Todas las Categorías</strong><small>Explorar todo el catálogo</small></span>
                  {selectedCategory === 'TODAS' && <CheckCircle2 size={18} className="check-active" />}
                </button>
                {NAVIGATION_CATEGORIES.map((cat) => {
                  const expanded = expandedCategories[cat.id];
                  return <div className="filter-category-tree" key={cat.id}>
                    <div className={`filter-option-btn ${selectedCategory === cat.filterId ? 'active' : ''}`}>
                      <button type="button" className="filter-category-main-action" onClick={() => { setSelectedCategory(cat.filterId); setSelectedSubcategory('TODAS'); }}>
                        <CategoryIconTile iconName={cat.iconName} color={cat.color} size={9} className="filter-category-icon" />
                        <span className="filter-option-copy"><strong>{cat.nombre}</strong></span>
                      </button>
                      <button type="button" className="filter-subcategory-toggle" aria-label={`Mostrar subcategorías de ${cat.nombre}`} onClick={() => setExpandedCategories((current) => ({ ...current, [cat.id]: !current[cat.id] }))}>
                        <ChevronDown size={16} className={expanded ? 'is-open' : ''} />
                      </button>
                    </div>
                    {expanded && <div className="filter-subcategory-branch">
                      {cat.subcategories.map((subcategory) => <button type="button" key={subcategory} className={`filter-subcategory-option ${selectedSubcategory === subcategory ? 'active' : ''}`} onClick={() => { setSelectedCategory(cat.filterId); setSelectedSubcategory(subcategory); }}>
                        <span className="filter-subcategory-node" />{subcategory}{selectedSubcategory === subcategory && <CheckCircle2 size={15} />}
                      </button>)}
                    </div>}
                  </div>;
                })}
              </div>}
            </div>

            {/* Filter 2: Condición / Estado Técnico */}
            <div className={`filter-section-group ${openFilterSections.condition ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('condition')} aria-expanded={openFilterSections.condition}>
                <span className="filter-group-label"><ShieldCheck size={13} /> Condición Técnica</span><ChevronDown size={16} />
              </button>
              {openFilterSections.condition && <div className="filter-options-list">
                {CONDITIONS.map((cond, conditionIndex) => (
                  <button
                    key={cond}
                    className={`filter-option-btn ${selectedCondition === cond ? 'active' : ''}`}
                    onClick={() => setSelectedCondition(cond)}
                  >
                    <span className="filter-condition-icon">{conditionIndex === 0 ? <CheckCircle2 size={14} /> : conditionIndex === 1 ? <Package size={14} /> : conditionIndex === 2 ? <ShieldCheck size={14} /> : <RotateCcw size={14} />}</span>
                    <span className="filter-option-copy">
                      <strong>{cond === 'TODOS' ? 'Todos los Estados' : cond}</strong>
                      <small>{cond === 'TODOS' ? 'Mostrar todas las opciones' : cond === 'Nuevo OEM Original' ? 'Producto 100% original' : cond === 'Nuevo Alternativo Homologado' ? 'Alternativa de calidad' : 'Revisado y garantizado'}</small>
                    </span>
                    {selectedCondition === cond && <CheckCircle2 size={18} className="check-active" />}
                  </button>
                ))}
              </div>}
            </div>

            {/* Filter 3: Origen / Procedencia */}
            <div className="filter-section-group compact-select-section">
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
            <div className="filter-section-group compact-select-section">
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
            <div className={`filter-section-group ${openFilterSections.shipping ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('shipping')} aria-expanded={openFilterSections.shipping}>
                <span className="filter-group-label"><Truck size={13} /> Opciones de Despacho</span><ChevronDown size={16} />
              </button>
              {openFilterSections.shipping && <label className="checkbox-filter-label">
                <input
                  type="checkbox"
                  checked={onlyFastDelivery}
                  onChange={(e) => setOnlyFastDelivery(e.target.checked)}
                />
                <span><strong>Solo con Envío Rápido el mismo día</strong><small><Info size={12} /> Disponible en comunas seleccionadas.</small></span>
              </label>}
            </div>

            {/* Clear All Filters Button */}
            <button className="btn-clear-all-filters-wide" onClick={handleApplyFilters}>
              <Search size={18} />
              <span>Aplicar Filtros y Ver Resultados</span>
            </button>
            <p className="filter-security-note"><ShieldCheck size={14} /> Tus preferencias están seguras con nosotros.</p>
          </aside>

          {/* Parts Cards Column (Right Grid) */}
          <main className="catalog-parts-main">
            {productsLoading ? (
              <div className="parts-cards-grid-catalog" aria-busy="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
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
                    <MarketplaceProductCard key={prod.id} product={prod} onView={onQuickView} />
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
