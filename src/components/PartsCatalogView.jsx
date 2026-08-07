import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Filter, SlidersHorizontal, ShieldCheck, MapPin, Star, Package,
  Clock, ArrowRight, ArrowLeft, X, CheckCircle2, RotateCcw, Tag, Truck,
  ChevronLeft, ChevronRight, ChevronDown, Eye, ShoppingCart, Car, Wrench, Layers, AlertCircle, Globe, MessageSquare, Info
} from 'lucide-react';
// CategoryIconTile y NAVIGATION_CATEGORIES se usaban sin estar importados, por lo que la
// vista lanzaba ReferenceError al montarse (el ErrorBoundary la reemplazaba por completo).
import CategoryIconTile from './CategoryIconTile';
import MarketplaceProductCard from './MarketplaceProductCard';
import {
  NAVIGATION_CATEGORIES, CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID, CATEGORY_IMAGE_BY_ID
} from '../data/categories';
import { getPartCategoriesApi, getPublicProductsApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptPage, adaptProduct, adaptVehicle } from '../services/adapters';

// El backend acota el tamaño de página a 100. Esta vista filtra y pagina en cliente,
// así que se trae un bloque grande y la UI hace el resto del trabajo.
const CATALOG_FETCH_SIZE = 100;

export default function PartsCatalogView({
  onBackToStore,
  onAddToCart,
  onQuickView,
  onOpenQuote,
  activeVehicle: initialActiveVehicle,
  initialCatalogFilter = null,
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
    const normalizeName = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]/g, '');

    const loadProducts = async () => {
      let categoriaId = initialCatalogFilter?.categoryId;
      // Si el Home se presiona antes de que termine su catálogo auxiliar,
      // resolvemos aquí el ID real en vez de caer al alias visual "motor".
      if (!categoriaId && initialCatalogFilter?.categoryName) {
        const categories = await getPartCategoriesApi();
        categoriaId = (Array.isArray(categories) ? categories : [])
          .find((category) => normalizeName(category.nombre) === normalizeName(initialCatalogFilter.categoryName))?.id;
      }
      return getPublicProductsApi({ page: 0, size: CATALOG_FETCH_SIZE, categoriaId, subcategoriaId: initialCatalogFilter?.subcategoryId, sort: 'createdAt,desc' });
    };

    loadProducts()
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
  }, [initialCatalogFilter?.categoryId, initialCatalogFilter?.categoryName, initialCatalogFilter?.subcategoryId]);

  const [searchQuery, setSearchQuery] = useState('');
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
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filterPanelRef = useRef(null);
  const [filterDrawerHeight, setFilterDrawerHeight] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    setSelectedCategory(initialCatalogFilter?.category || 'TODAS');
    setSelectedSubcategory(initialCatalogFilter?.subcategory || 'TODAS');
  }, [initialCatalogFilter?.category, initialCatalogFilter?.subcategory]);

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

  const toggleFilterSection = (section) => {
    setOpenFilterSections((current) => ({ ...current, [section]: !current[section] }));
  };

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
    setIsFiltersOpen(false);
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
              Busca y filtra repuestos mecánicos, eléctricos y de carrocería con código OEM, origen verificado y calce 100% garantizado.
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
        <div className="patent-filter-box-bar">
          <div className="patent-filter-header-title">
            <Car size={18} className="text-blue-500" />
            <span>
              <strong>FILTRAR POR <b>PATENTE O VIN</b></strong>
              <small>Encuentra repuestos exactos para tu vehículo</small>
            </span>
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
      </div>

      <div className="container catalog-main-container">
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

          <button className="catalog-open-filters" type="button" onClick={() => setIsFiltersOpen(true)}>
            <Filter size={18} /><span>Filtros</span><ChevronRight size={16} />
          </button>

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
        <div className={`catalog-content-grid catalog-main-content-grid product-filter-drawer-layout ${isFiltersOpen ? 'filters-open' : ''}`} style={isFiltersOpen && filterDrawerHeight ? { minHeight: `${filterDrawerHeight}px` } : undefined}>
          {isFiltersOpen && <button className="catalog-filter-backdrop" type="button" aria-label="Cerrar filtros" onClick={() => setIsFiltersOpen(false)} />}
          {/* Sidebar Technical Filters (Left 280px) */}
          <aside ref={filterPanelRef} className="catalog-sidebar-filters catalog-advanced-filter-panel">
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
                <button className="btn-close-filter-drawer" type="button" onClick={() => setIsFiltersOpen(false)} aria-label="Cerrar filtros" title="Cerrar filtros">
                  <X size={16} />
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
