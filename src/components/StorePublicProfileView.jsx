import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import {
  Search, SlidersHorizontal, ShieldCheck, MapPin, Star, Package, Clock,
  ArrowLeft, X, CheckCircle2, RotateCcw, Truck, ChevronLeft, ChevronRight, ChevronDown,
  ShoppingCart, Car, Wrench, Layers, Building2, MessageSquare, AlertCircle,
  Heart, Share2, Image, PenLine, ArrowRight, HelpCircle,
  CarFront, Barcode, CircleHelp, RefreshCw, Tag, Store as StoreIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAVIGATION_CATEGORIES } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';
import MarketplaceProductCard from './MarketplaceProductCard';
import { isProductTopActive } from '../utils/productTop';
import ContextualReportButton from './ContextualReportButton';
import { parseShippingMethods, resolveShippingService } from '../data/shippingMethods';
import { getAddressesApi, getStoreProductsApi, getStoreProfileApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptPage, adaptProduct, adaptStore, adaptVehicle } from '../services/adapters';
import { useSavedMarketplaceItems } from '../hooks/useSavedMarketplaceItems';
import { useMarketplace } from '../context/MarketplaceContext';
import TextSearchWithSuggestions from './TextSearchWithSuggestions';

// El backend acota el tamaño de página a 100; esta vista filtra y pagina en cliente.
const STORE_PRODUCTS_FETCH_SIZE = 100;
const STORE_FILTER_BRANDS = ['TODAS', 'Toyota', 'Nissan', 'Hyundai', 'Chevrolet', 'Kia', 'Mazda', 'Suzuki', 'Mitsubishi'];

export default function StorePublicProfileView({
  store,
  onBackToStores,
  onQuickView,
  onOpenQuote,
  activeVehicle: initialActiveVehicle,
  onEditStore
}) {
  const { user, isLoggedIn } = useAuth();
  const { openAuthModal } = useMarketplace();
  const initialStoreId = typeof store === 'string' ? null : store?.id;

  const [activeVehicle, setActiveVehicle] = useState(initialActiveVehicle);
  const [patentInput, setPatentInput] = useState('');
  const [patentError, setPatentError] = useState('');
  const [patentSearching, setPatentSearching] = useState(false);
  const [inputValue, setInputValue] = useState(initialActiveVehicle?.patente || '');
  const [logoError, setLogoError] = useState(false);
  const [coverError, setCoverError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [onlyQuoteOnly, setOnlyQuoteOnly] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [selectedSubcategory, setSelectedSubcategory] = useState('TODAS');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('TODAS');
  const [onlyCompatible, setOnlyCompatible] = useState(!!initialActiveVehicle);
  const [sortBy, setSortBy] = useState('relevancia');

  // Filtro "Mi comuna", igual que en el catálogo: resuelve la comuna del perfil del usuario
  // y deja solo los repuestos publicados en esa zona.
  const [filterByMyComuna, setFilterByMyComuna] = useState(false);
  const [myComunaNombre, setMyComunaNombre] = useState('');
  const [comunaLookupStatus, setComunaLookupStatus] = useState('idle');
  const [comunaNotice, setComunaNotice] = useState('');

  const [shareFeedback, setShareFeedback] = useState('');
  const [openFilterSections, setOpenFilterSections] = useState({ purchase: true, category: true, condition: true });
  const [expandedCategories, setExpandedCategories] = useState({});
  const { isStoreSaved, toggleStore } = useSavedMarketplaceItems(user?.userId ?? user?.id);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Ficha pública de la tienda con TanStack Query
  // El error NO se traga: si `GET /tiendas/{id}` falla hay que decirlo, no inventar una
  // tienda. Antes devolvia null y el componente caia en un objeto de demostracion, asi
  // que una tienda inexistente -o bloqueada, que ahora responde 404- se veia como una
  // ficha normal con nombre y RUT de otra empresa.
  const { data: fetchedStore, isLoading: storeLoading, isError: storeError } = useQuery({
    queryKey: qk.store(initialStoreId),
    queryFn: async ({ signal }) => adaptStore(await getStoreProfileApi(initialStoreId, { signal })),
    enabled: Boolean(initialStoreId),
    retry: false,
  });

  // Normaliza lo que llega por `state` desde el directorio para pintar la cabecera
  // mientras viaja la ficha completa. NO inventa valores: un dato que el backend no
  // mando se muestra vacio, no con el de una tienda de ejemplo.
  const resolveStore = (inputStore) => {
    if (!inputStore || typeof inputStore === 'string' || !inputStore.nombre) return null;
    return {
      id: inputStore.id,
      nombre: inputStore.nombre,
      rut: inputStore.rut || '',
      tipo: inputStore.tipo || '',
      ciudad: inputStore.ciudad || '',
      totalPublicaciones: inputStore.totalPublicaciones ?? 0,
      rating: inputStore.rating ?? 0,
      reviewCount: inputStore.reviewCount ?? 0,
      responseRate: inputStore.responseRate ?? null,
      responseTimeLabel: inputStore.responseTimeLabel || '',
      verificadoFecha: inputStore.verificadoFecha || '',
      marcasEspecialistas: Array.isArray(inputStore.marcasEspecialistas) ? inputStore.marcasEspecialistas : [],
      metodosEnvio: Array.isArray(inputStore.metodosEnvio) ? inputStore.metodosEnvio : [],
      logoUrl: inputStore.logoUrl || null,
      coverUrl: inputStore.coverUrl || null,
      descripcion: inputStore.descripcion || '',
      direccion: inputStore.direccion || '',
      telefono: inputStore.telefono || '',
      email: inputStore.email || '',
      esOficial: !!inputStore.esOficial,
    };
  };

  // Mientras viaja la ficha se usa lo precargado del directorio, que son datos reales.
  const previewStore = resolveStore(store);
  // Si la ficha fallo, la precarga NO sirve de reemplazo: llegar desde un directorio ya
  // cargado en otra pestana mostraria igual una tienda que el backend acaba de dejar de
  // publicar. El 404 manda sobre lo que traiamos en la mano.
  const currentStore = storeError ? null : (fetchedStore || previewStore);
  // Sin ficha y sin precarga no hay nada que mostrar: o no existe, o dejo de ser
  // publica (suspendida o bloqueada por mediacion, que responden 404).
  const storeUnavailable = storeError || (!currentStore && !storeLoading);
  const storeId = currentStore?.id;
  const rating = Number(currentStore?.rating ?? 0);
  const reviewCount = Number(currentStore?.reviewCount ?? 0);
  const responseRate = currentStore?.responseRate != null ? Number(currentStore.responseRate) : null;
  const shippingMethods = parseShippingMethods(currentStore?.metodosEnvio);
  const specialistBrands = (currentStore?.marcasEspecialistas || [])
    .map((brand) => typeof brand === 'string' ? brand : (brand?.nombre || brand?.name || ''))
    .filter(Boolean);
  const hasSpecialistBrands = specialistBrands.length > 0;
  const isVerified = currentStore?.esOficial || rating >= 4.5;
  const isOwnStore = Boolean(
    onEditStore ||
    (user?.sellerId && (String(user.sellerId) === String(storeId) || String(user.sellerId) === String(currentStore?.proveedorId))) ||
    (user?.storeId && (String(user.storeId) === String(storeId) || String(user.storeId) === String(currentStore?.proveedorId))) ||
    (user?.tiendaId && (String(user.tiendaId) === String(storeId) || String(user.tiendaId) === String(currentStore?.proveedorId))) ||
    (user?.proveedorId && (String(user.proveedorId) === String(storeId) || String(user.proveedorId) === String(currentStore?.proveedorId))) ||
    (user?.userId && String(user.userId) === String(currentStore?.proveedorId || currentStore?.id)) ||
    (user?.id && String(user.id) === String(currentStore?.proveedorId || currentStore?.id)) ||
    (user?.storeName && currentStore?.nombre && user.storeName.toLowerCase().trim() === currentStore.nombre.toLowerCase().trim()) ||
    (user?.nombreTienda && currentStore?.nombre && user.nombreTienda.toLowerCase().trim() === currentStore.nombre.toLowerCase().trim())
  );

  // Inventario real de la tienda con TanStack Query
  const {
    data: productsPageData,
    isLoading: productsLoading,
    error: productsQueryError
  } = useQuery({
    queryKey: qk.storeProducts(storeId, { size: STORE_PRODUCTS_FETCH_SIZE }),
    queryFn: async ({ signal }) => {
      try {
        const data = await getStoreProductsApi(storeId, { page: 0, size: STORE_PRODUCTS_FETCH_SIZE, signal });
        return adaptPage(data, adaptProduct);
      } catch (err) {
        console.warn('No se pudo cargar el inventario de la tienda:', err);
        return { items: [], total: 0 };
      }
    },
    enabled: Boolean(storeId),
  });

  const storeProducts = productsPageData?.items || [];
  const storeProductsTotal = productsPageData?.total || 0;
  const textSearchSuggestions = [
    ...NAVIGATION_CATEGORIES.map((category) => ({ label: category.nombre, type: 'category' })),
    ...storeProducts.map((product) => ({ label: product.titulo, type: 'product' })),
  ].filter((item) => item.label);
  const productsError = productsQueryError ? (productsQueryError.message || 'No se pudo cargar el catálogo de esta tienda.') : null;


  const handleResetFilters = () => {
    setSelectedCategory('TODAS');
    setSelectedSubcategory('TODAS');
    setSelectedCondition('');
    setSelectedBrand('TODAS');
    setOnlyQuoteOnly(false);
    setOnlyCompatible(false);
    setSearchQuery('');
    setInputValue('');
    setPatentInput('');
    setFilterByMyComuna(false);
    setComunaNotice('');
    setSortBy('relevancia');
    setCurrentPage(1);
  };

  const handleApplyStoreFilters = () => {
    setCurrentPage(1);
  };

  // Mismo comportamiento que el catálogo: toma la comuna del perfil y filtra los repuestos
  // a esa zona. Sin sesión o sin comuna registrada, deja un aviso en vez de activarse.
  const handleToggleComunaFilter = async () => {
    if (filterByMyComuna) {
      setFilterByMyComuna(false);
      setComunaNotice('');
      return;
    }
    if (!isLoggedIn || !(user?.userId ?? user?.id)) {
      setComunaNotice('Inicia sesión y registra una comuna en tu perfil para usar este filtro.');
      return;
    }
    if (myComunaNombre) {
      setFilterByMyComuna(true);
      return;
    }
    setComunaLookupStatus('loading');
    try {
      const addresses = await getAddressesApi(user.userId ?? user.id);
      const principal = (Array.isArray(addresses) ? addresses : []).find((address) => address.esPrincipal) || addresses?.[0];
      if (!principal?.comunaNombre) {
        setComunaNotice('Registra una comuna en tu perfil para usar este filtro.');
        return;
      }
      setMyComunaNombre(principal.comunaNombre);
      setFilterByMyComuna(true);
    } catch (err) {
      setComunaNotice(err.message || 'No pudimos obtener tu comuna.');
    } finally {
      setComunaLookupStatus('idle');
    }
  };

  // Búsqueda por patente, igual que el catálogo: resuelve el vehículo y deja el filtro de
  // compatibilidad activo para esta tienda.
  const handleUnifiedSearch = async (valToUse) => {
    const value = (valToUse !== undefined ? valToUse : inputValue).trim();
    if (!value) {
      setPatentError('Ingresa una patente válida (ej. BB-CL-12)');
      return;
    }
    setPatentError('');
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
  };

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedSubcategory, selectedCondition, selectedBrand, onlyCompatible, activeVehicle, sortBy, itemsPerPage, filterByMyComuna, myComunaNombre]);

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
    if (selectedCategory !== 'TODAS') {
      const matchCatId = prod.categoria === selectedCategory;
      const matchCatNombre = prod.categoriaNombre && (
        String(prod.categoriaNombre).toLowerCase() === String(selectedCategory).toLowerCase() ||
        NAVIGATION_CATEGORIES.find((c) => c.id === selectedCategory)?.nombre.toLowerCase() === String(prod.categoriaNombre).toLowerCase()
      );
      if (!matchCatId && !matchCatNombre) return false;
    }

    if (selectedSubcategory !== 'TODAS') {
      const productSubcategory = String(prod.subcategoria || prod.subcategoriaNombre || '').toLowerCase();
      if (productSubcategory !== selectedSubcategory.toLowerCase()) return false;
    }

    // 3. Technical Condition
    if (selectedCondition && prod.condicion && prod.condicion !== selectedCondition) {
      return false;
    }

    // 4. Vehicle Compatibility
    if (onlyCompatible && activeVehicle) {
      const matchesVehicle = (prod.compatibilidad || []).some(
        c => {
          if (activeVehicle.catalogoId && Array.isArray(c.vehiculoCatalogoIds) && c.vehiculoCatalogoIds.includes(Number(activeVehicle.catalogoId))) {
            return true;
          }
          return c.marca?.toLowerCase() === activeVehicle.marca?.toLowerCase() &&
                 c.modelo?.toLowerCase() === activeVehicle.modelo?.toLowerCase();
        }
      );
      if (!matchesVehicle) return false;
    }

    // 5. Purchase Type / Modalidad Filter (Precio Directo vs Solo Cotización)
    if (onlyQuoteOnly) {
      const isQuoteOnly = prod.soloCotizacion || !prod.precio || prod.precio === 0;
      if (!isQuoteOnly) return false;
    }

    // 6. Mi comuna: la tienda tiene una sola ubicación, así que el filtro deja pasar
    // todo si esa comuna coincide con la del usuario y nada si no — el mismo criterio de
    // ubicación que el catálogo, aplicado a la única zona de la tienda.
    if (filterByMyComuna && myComunaNombre) {
      const zona = String(prod.comuna || prod.ciudad || currentStore?.ciudad || '').toLowerCase();
      if (!zona.includes(myComunaNombre.toLowerCase())) return false;
    }

    return true;
  });

  // El contador es una respuesta a una búsqueda, no un dato que deba ocupar
  // espacio al abrir el catálogo sin ninguna condición aplicada.
  const hasAppliedFilters = Boolean(
    searchQuery.trim() ||
    (activeVehicle && onlyCompatible) ||
    filterByMyComuna ||
    onlyQuoteOnly ||
    selectedCategory !== 'TODAS' ||
    selectedSubcategory !== 'TODAS' ||
    selectedCondition !== 'TODOS' ||
    selectedBrand !== 'TODAS'
  );

  // Sorting Logic
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const topPriority = Number(isProductTopActive(b)) - Number(isProductTopActive(a));
    if (topPriority) return topPriority;
    if (sortBy === 'precio-asc') return a.precio - b.precio;
    if (sortBy === 'precio-desc') return b.precio - a.precio;
    if (sortBy === 'recientes') {
      const fecha = (p) => new Date(p.fechaPublicacion || p.createdAt || p.fechaCreacion || 0).getTime() || 0;
      return fecha(b) - fecha(a);
    }
    return 0;
  });

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(sortedProducts.length, currentPage * itemsPerPage);
  const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

  // Los tres botones del paginador la llamaban sin que existiera: con mas de una pagina
  // de repuestos, cualquier clic reventaba la vista de tienda con un ReferenceError.
  const handlePageChange = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

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

  const toggleFilterSection = (section) => {
    setOpenFilterSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (storeUnavailable || !currentStore) {
    return (
      <div className="store-public-profile-wrapper">
        <div className="store-unavailable-panel">
          {storeUnavailable ? (
            <>
              <span className="store-unavailable-icon"><StoreIcon size={30} /></span>
              <h2>Esta tienda no está disponible</h2>
              <p>
                Puede que haya dejado de publicar en RepuesTop o que el enlace no
                corresponda a ninguna tienda. Revisa el directorio para encontrar otras
                tiendas con el repuesto que buscas.
              </p>
              <button type="button" className="btn-auth-primary" onClick={onBackToStores}>
                Ver todas las tiendas
              </button>
            </>
          ) : (
            <p className="store-unavailable-loading">Cargando la tienda…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="store-public-profile-wrapper">
      {/* 1. Header Banner & Store Info */}
      <div className="store-header-banner">
        <div className="store-cover-image">
          {currentStore.coverUrl && !coverError ? (
            <img
              src={currentStore.coverUrl}
              alt={`Portada de ${currentStore.nombre}`}
              className="store-cover-backdrop-img"
              onError={() => setCoverError(true)}
            />
          ) : (
            <div className="store-cover-placeholder" />
          )}
          <div className="store-cover-overlay" />

          <div className="container store-header-actions-bar">
            <button className="btn-back-stores" onClick={onBackToStores} type="button">
              <ArrowLeft size={16} />
              <span>Volver a Tiendas</span>
            </button>
            {onEditStore && (
              <button className="btn-edit-store-profile" onClick={onEditStore} type="button" title="Editar mi tienda">
                <PenLine size={15} />
                <span>Editar tienda</span>
              </button>
            )}
          </div>

          <div className="container store-hero-inner-container">
            <div className="store-hero-left">
              <div className="store-avatar-box">
                {currentStore.logoUrl && !logoError ? (
                  <img
                    src={currentStore.logoUrl}
                    alt={currentStore.nombre}
                    className="store-avatar-img"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="store-avatar-fallback" style={{ backgroundColor: currentStore.bgColor || '#0066ff' }}>
                    <span>{currentStore.initials || 'RT'}</span>
                  </div>
                )}
              </div>

              <div className="store-info-details">
                <div className="store-title-badge-row">
                  <h1>{currentStore.nombre}</h1>
                  {isVerified && <span className="badge-official-store">Tienda verificada</span>}
                </div>

                {currentStore.descripcion && (
                  <p className="store-description-text">{currentStore.descripcion}</p>
                )}

                <p className="store-subtitle-meta">
                  <span className="meta-item"><MapPin size={14} /> {currentStore.ciudad}</span>
                  <span className="meta-divider">|</span>
                  <span className="meta-item"><ShieldCheck size={14} /> RUT: {currentStore.rut}</span>
                </p>

                <div className="store-action-buttons">
                  <button
                    className={`btn-follow-store ${isStoreSaved(currentStore.id) ? 'following' : ''}`}
                    onClick={() => {
                      if (!user) { openAuthModal(); return; }
                      toggleStore(currentStore);
                    }}
                    type="button"
                    title={isStoreSaved(currentStore.id) ? 'Quitar tienda de favoritos' : 'Guardar tienda en favoritos'}
                  >
                    <Heart size={16} className={isStoreSaved(currentStore.id) ? 'fill-current' : ''} />
                    <span>{isStoreSaved(currentStore.id) ? 'Tienda guardada' : 'Guardar tienda'}</span>
                  </button>

                  <button className="btn-share-store" onClick={handleShare} type="button" title="Compartir enlace de la tienda">
                    <Share2 size={16} />
                    <span>{shareFeedback === '¡Enlace copiado!' ? '¡Enlace copiado!' : 'Compartir'}</span>
                  </button>

                  {!isOwnStore && (
                    <ContextualReportButton
                      tipoObjeto="TIENDA"
                      objetoId={storeId}
                      objetoTitulo={currentStore.nombre}
                      className="btn-report-store"
                    />
                  )}
                </div>

                {shareFeedback && (
                  <div className="store-action-toast-banner" role="status">
                    <CheckCircle2 size={14} />
                    <span>{shareFeedback}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="store-hero-right">
              <div className="store-rating-card">
                <span className="rating-card-label">Calificación de la tienda</span>
                <div className="rating-card-score-row">
                  <span className="rating-score-num">{rating.toFixed(1)}</span>
                  <div className="rating-stars-box">
                    <div className="stars-row" aria-label={`${rating.toFixed(1)} de 5 estrellas`}>
                      {Array.from({ length: 5 }, (_, index) => (
                        // .stars-row .star-icon fuerza el relleno azul (!important):
                        // las vacias NO llevan esa clase o se verian llenas igual.
                        <Star key={index} size={16} className={index < Math.round(rating) ? 'star-icon' : 'star-icon-empty'} />
                      ))}
                    </div>
                    <small className="rating-opinions-count">
                      {reviewCount > 0 ? `(${reviewCount.toLocaleString('es-CL')} opiniones)` : 'Sin evaluaciones'}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Metrics Card Strip */}
      <div className="container store-metrics-strip-container">
        <div className="store-metrics-strip-card">
            <div className="metric-strip-item">
              <span className="metric-icon-box"><Package size={22} /></span>
              <div className="metric-text-box">
                <small>Productos publicados</small>
                <strong>{Number(currentStore.totalPublicaciones ?? 0).toLocaleString('es-CL')}</strong>
              </div>
            </div>

            <div className="metric-strip-item">
              <span className="metric-icon-box"><Truck size={22} /></span>
              <div className="metric-text-box">
                <small>Envíos a todo Chile</small>
                <strong>{shippingMethods.length ? `${shippingMethods.length} opciones` : 'Sin métodos declarados'}</strong>
              </div>
            </div>

            {currentStore.responseTimeLabel && (
              <div className="metric-strip-item">
                <span className="metric-icon-box"><Clock size={22} /></span>
                <div className="metric-text-box">
                  <small>Tiempo de respuesta</small>
                  <strong>{currentStore.responseTimeLabel}</strong>
                </div>
              </div>
            )}

            {hasSpecialistBrands && (
              <div className="metric-strip-item">
                <span className="metric-icon-box"><Tag size={22} /></span>
                <div className="metric-text-box">
                  <small>Marcas especialistas</small>
                  {/* Carrusel horizontal: con muchas marcas, unirlas en un solo texto
                      (join) envolvía a varias líneas y deformaba la franja blanca.
                      Ahora cada marca es un chip en una fila que se desliza. */}
                  <div className="specialist-brands-track" title={specialistBrands.join(', ')}>
                    {specialistBrands.map((brand, index) => (
                      <span key={`${brand}-${index}`} className="specialist-brand-chip">{brand}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStore.verificadoFecha && (
              <div className="metric-strip-item">
                <span className="metric-icon-box"><ShieldCheck size={22} /></span>
                <div className="metric-text-box">
                  <small>{isVerified ? 'Tienda registrada' : 'Tienda acreditada'}</small>
                  <strong>{currentStore.verificadoFecha}</strong>
                </div>
              </div>
            )}
          </div>
        </div>

      <div className="container catalog-main-container store-profile-search-stack">
        {/* Filtros rápidos del inventario. El título vive junto a los resultados. */}
        <section className="catalog-showcase-carousel-wrapper store-catalog-toolbar-wrapper" aria-label="Buscar en esta tienda">
          <div className="catalog-showcase-carousel-header">
            <div className="store-catalog-filter-controls">
              <TextSearchWithSuggestions
                value={searchQuery}
                onChange={setSearchQuery}
                suggestions={textSearchSuggestions}
                placeholder="Buscar en esta tienda"
              />
              <div className="catalog-vehicle-location-filters">
                <div className="catalog-showcase-patente-control">
                {activeVehicle ? (
                  <div className="catalog-showcase-vehicle-filter">
                    <Car size={18} />
                    <span><strong>{activeVehicle.marca} {activeVehicle.modelo}</strong>{activeVehicle.patente && activeVehicle.patente !== 'MANUAL' ? ` · ${activeVehicle.patente}` : ''}</span>
                    <button type="button" onClick={() => { setActiveVehicle(null); setOnlyCompatible(false); setInputValue(''); setPatentInput(''); }} title="Quitar filtro de vehículo"><X size={15} /> Quitar filtro</button>
                  </div>
                ) : (
                  <div className="catalog-quick-patente-bar">
                    <CarFront size={18} className="patente-icon" />
                    <input type="text" placeholder="Ingresa tu patente (ej: ABCD-12)" value={inputValue} onChange={(e) => { setInputValue(e.target.value.toUpperCase()); if (patentError) setPatentError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleUnifiedSearch(inputValue)} className="patente-quick-input" maxLength={8} />
                    <button type="button" className="btn-quick-patente-submit" onClick={() => handleUnifiedSearch(inputValue)} disabled={patentSearching}>{patentSearching ? <RefreshCw size={15} className="spin-icon" /> : 'Buscar'}</button>
                    {patentError && <span className="quick-patente-error">{patentError}</span>}
                  </div>
                )}
                </div>
                <div className="catalog-showcase-comuna-control">
                  <button type="button" className={`btn-comuna-toggle-pill ${filterByMyComuna ? 'active' : ''}`} onClick={handleToggleComunaFilter} disabled={comunaLookupStatus === 'loading'}>
                    <MapPin size={17} />
                    <span>{comunaLookupStatus === 'loading' ? 'Buscando comuna…' : filterByMyComuna ? `En ${myComunaNombre || 'mi comuna'}` : 'Mi comuna'}</span>
                  </button>
                  {comunaNotice && <span className="quick-patente-error">{comunaNotice}</span>}
                </div>
              </div>
            </div>
          </div>

          {activeVehicle && (
            <div className="light-active-vehicle store-active-vehicle-inline">
              <CheckCircle2 size={17} />
              <span>Estás viendo solo repuestos compatibles con tu <strong>{activeVehicle.marca} {activeVehicle.modelo} ({activeVehicle.patente})</strong> en esta tienda.</span>
              <button
                type="button"
                className={`btn-toggle-compat-mini ${onlyCompatible ? 'active' : ''}`}
                onClick={() => setOnlyCompatible(!onlyCompatible)}
                style={{ marginLeft: 'auto' }}
              >
                {onlyCompatible ? '✓ Solo compatibles' : 'Filtrar compatibles'}
              </button>
            </div>
          )}
        </section>

        {/* 3. Layout de dos columnas: filtros y resultados de la tienda. */}
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

            {/* Misma modalidad de compra que el catálogo general. */}
            <div className="filter-section-group">
              <label className="checkbox-filter-label">
                <input type="checkbox" checked={onlyQuoteOnly} onChange={(event) => setOnlyQuoteOnly(event.target.checked)} />
                <span><strong>Solo a cotizar</strong><small><ShoppingCart size={12} /> Piezas sin precio publicado, que se cotizan con la tienda.</small></span>
              </label>
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
                {NAVIGATION_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const isExpanded = expandedCategories[cat.id] || isSelected;
                  return (
                    <div className="filter-category-tree" key={cat.id}>
                      <div className={`filter-option-btn ${isSelected ? 'active' : ''}`}>
                        <button
                          type="button"
                          className="filter-category-main-action"
                          onClick={() => { setSelectedCategory(isSelected ? 'TODAS' : cat.id); setSelectedSubcategory('TODAS'); }}
                        >
                          <CategoryIconTile iconName={cat.iconName} color={cat.color} size={9} className="filter-category-icon" />
                          <span className="filter-option-copy"><strong>{cat.nombre}</strong></span>
                        </button>
                        {Array.isArray(cat.subcategories) && cat.subcategories.length > 0 && (
                          <button
                            type="button"
                            className="filter-subcategory-toggle"
                            aria-label={`Mostrar subcategorías de ${cat.nombre}`}
                            aria-expanded={isExpanded}
                            onClick={() => {
                              setExpandedCategories((current) => ({ ...current, [cat.id]: !isExpanded }));
                              if (!isExpanded) { setSelectedCategory(cat.id); setSelectedSubcategory('TODAS'); }
                            }}
                          >
                            <ChevronDown size={16} className={isExpanded ? 'is-open' : ''} />
                          </button>
                        )}
                      </div>
                      {isExpanded && Array.isArray(cat.subcategories) && (
                        <div className="filter-subcategory-branch">
                          {cat.subcategories.map((subcategory) => {
                            const isSubSelected = selectedSubcategory === subcategory;
                            return <button type="button" key={subcategory} className={`filter-subcategory-option ${isSubSelected ? 'active' : ''}`} onClick={() => { setSelectedCategory(cat.id); setSelectedSubcategory(isSubSelected ? 'TODAS' : subcategory); }}>
                              <span className="filter-subcategory-checkbox" aria-hidden="true" />
                              <span className="filter-subcategory-text">{subcategory}</span>
                            </button>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>}
            </div>

            {/* Filter 2: Condición */}
            <div className={`filter-section-group ${openFilterSections.condition ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('condition')} aria-expanded={openFilterSections.condition}>
                <span className="filter-group-label"><ShieldCheck size={13} /> Condición Técnica</span><ChevronDown size={16} />
              </button>
              {openFilterSections.condition && <div className="filter-options-list">
                <button className={`filter-option-btn ${selectedCondition === '' ? 'active' : ''}`} onClick={() => setSelectedCondition('')}>
                  <span className="filter-choice-dot">{selectedCondition === '' && <CheckCircle2 size={18} />}</span>
                  <span className="filter-option-copy"><strong>Original y Alternativo</strong><small>Todo el catálogo de la tienda</small></span>
                </button>
                {['ORIGINAL', 'ALTERNATIVO'].map((cond) => (
                  <button
                    key={cond}
                    className={`filter-option-btn ${selectedCondition === cond ? 'active' : ''}`}
                    onClick={() => setSelectedCondition(selectedCondition === cond ? '' : cond)}
                  >
                    <span className="filter-choice-dot">{selectedCondition === cond && <CheckCircle2 size={18} />}</span>
                    <span className="filter-option-copy"><strong>{cond === 'ORIGINAL' ? 'Original' : 'Alternativo'}</strong><small>{cond === 'ORIGINAL' ? 'Pieza nueva del fabricante' : 'Pieza nueva equivalente y homologada'}</small></span>
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
            <header className="store-catalog-results-heading">
              <div>
                <h2>Repuestos de {currentStore.nombre}</h2>
                <p>Explora el inventario disponible de esta tienda o filtra por la patente de tu vehículo.</p>
                {hasAppliedFilters && <span className="store-catalog-filter-feedback">
                  {activeVehicle && onlyCompatible ? (
                    <><strong>{sortedProducts.length}</strong> repuestos compatibles con tu <strong>{activeVehicle.marca} {activeVehicle.modelo}</strong></>
                  ) : (
                    <><strong>{sortedProducts.length}</strong> repuestos encontrados</>
                  )}
                </span>}
              </div>
              <label className="store-catalog-sort">
                <span>Ordenar por:</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select-input">
                  <option value="relevancia">Recomendados</option>
                  <option value="recientes">Más recientes</option>
                  <option value="precio-asc">Precio: menor a mayor</option>
                  <option value="precio-desc">Precio: mayor a menor</option>
                </select>
              </label>
            </header>
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
