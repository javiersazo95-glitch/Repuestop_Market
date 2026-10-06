import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Search, Filter, SlidersHorizontal, ShieldCheck, MapPin,
  X, CheckCircle2, RotateCcw,
  ChevronDown, ChevronRight, ShoppingCart, Car, Wrench, Layers, AlertCircle, Info, Tag, Globe,
  CarFront, RefreshCw, ArrowUpDown, ArrowRight, LayoutGrid, Store
} from 'lucide-react';
import CategoryIconTile from './CategoryIconTile';
import MarketplaceProductCard from './MarketplaceProductCard';
import ProductCardSkeleton from './skeletons/ProductCardSkeleton';
import { qk } from '../services/queryKeys';
import {
  NAVIGATION_CATEGORIES, CAROUSEL_CATEGORIES, HEADER_CATEGORIES
} from '../data/categories';
import {
  getPartCategoriesApi, getPublicProductsApi, getVehicleCatalogPartsApi, searchVehicleByPatenteApi, getAddressesApi,
  getPartSubcategoriesApi, getPartBrandsApi,
  getVehicleCascadeOptionsApi, getPublishedFilterOptionsApi, getPublicPartOriginsApi, getCatalogFilterOptionsApi,
  getVehicleFilterOptionsApi
} from '../services/api';
import { adaptPage, adaptProduct, adaptCompatibleOffersPage, adaptVehicle } from '../services/adapters';
import { useScrollMemory } from '../routes/useScrollMemory';
import { normalizePlate, sanitizePlateInput, isValidPlate } from '../utils/vehicleLookup';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../hooks/useFavorites';
import TextSearchWithSuggestions from './TextSearchWithSuggestions';
import SheetSelect from './SheetSelect';
import { useIsMobile } from '../hooks/useIsMobile';
import PaginationBar from './PaginationBar';

const normalizeNameKey = (value) => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Cuantos repuestos se muestran en la vitrina de entrada, cuando todavia no hay
 * ningun filtro aplicado. Es una consulta acotada; el catalogo paginado completo
 * NO se consulta hasta que el usuario elige un contexto.
 */
// La vitrina inicial combina publicaciones Top y recientes en una sola grilla.
// Los productos Top se anteponen al entrar con “Recomendados”; después se completa
// con el orden que corresponde al filtro seleccionado.
const SHOWCASE_SIZE = 12;

/**
 * Tope de resultados navegables por paginacion. Igual que MercadoLibre (que corta
 * cerca de los 2.000), la idea no es esconder inventario sino empujar a refinar:
 * el OFFSET de Postgres se degrada en paginas profundas y nadie llega a la 800.
 * El buscador y los filtros siguen alcanzando cualquier producto.
 */
const MAX_PAGINATED_RESULTS = 1000;

const CATEGORY_COUNT_FORMATTER = new Intl.NumberFormat('es-CL');

/**
 * Tope del control de precio. `PRICE_CEILING` es a la vez el maximo del deslizador y el
 * valor "sin tope": al llegar ahi no se manda `precioMax` y el filtro queda apagado, para
 * no excluir en silencio los repuestos que valen mas que el maximo del control.
 */
const PRICE_CEILING = 1000000;
const PRICE_STEP = 5000;
const PRICE_PRESETS = [20000, 50000, 100000, 300000];

/** Categoría publicada que corresponde a una de NAVIGATION_CATEGORIES (por id o nombre). */
function findPublishedCategory(filterSource, cat) {
  return (filterSource?.categorias || []).find((c) => String(c.id) === String(cat.id)
    || normalizeNameKey(c.nombre) === normalizeNameKey(cat.nombre));
}

/**
 * Si el valor elegido ya no tiene publicaciones (llega desde la URL o cambió otro filtro), se
 * mantiene en la lista sin conteo: el desplegable no queda en blanco y se puede quitar.
 */
function keepSelected(options, value, label) {
  if (!value || options.some((option) => option.value === String(value))) return options;
  return [{ value: String(value), label: label || String(value) }, ...options];
}

/**
 * Un paso de la cascada marca → modelo → año → versión, con solo lo que tiene repuestos
 * publicados como compatibles. Si falla, la lista queda vacía en vez de romper el panel.
 */
function useVehicleCascadeStep(params, enabled) {
  const { data = null } = useQuery({
    queryKey: qk.vehicleCascadeOptions(params),
    queryFn: async ({ signal }) => {
      try {
        return await getVehicleCascadeOptionsApi({ ...params, signal });
      } catch {
        return null;
      }
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
  return data;
}

/**
 * Condicion tecnica ofrecida en el filtro. RepuesTop opera solo con tiendas verificadas que
 * venden repuesto NUEVO, asi que la unica distincion util para el comprador es si la pieza es
 * la del fabricante o un equivalente homologado.
 *
 * `InventarioValidationSupport.condicionValida` del backend todavia acepta ademas NUEVO, USADO
 * y REACONDICIONADO. Hoy no hay ninguna publicacion con esos valores, pero si alguna se carga
 * (por Excel o por el formulario del vendedor) quedaria fuera de las dos opciones de aqui: se
 * seguiria viendo en el catalogo sin filtrar, pero no bajo ninguna condicion. Cerrar esa puerta
 * es acotar la validacion alla, no ampliar esta lista.
 */
const PART_CONDITIONS = [
  { value: 'ORIGINAL', label: 'Original', hint: 'Pieza nueva del fabricante del vehículo' },
  { value: 'ALTERNATIVO', label: 'Alternativo', hint: 'Pieza nueva equivalente y homologada' },
];

const formatCLP = (value) => `$${Number(value || 0).toLocaleString('es-CL')}`;

/**
 * Desplegable con buscador para listas largas (Tienda y Comuna del panel de filtros), igual
 * que el selector de la app: cerrado ocupa una sola línea, y desde 10 opciones muestra un
 * campo para acotar la lista. La opción elegida nunca desaparece al buscar.
 */
/** "Automatica CVT" -> "Automática"; "Mecánica" -> "Mecánica". Sin dato, nada. */
function transmisionLabel(value) {
  const text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!text || text.includes('no informad')) return '';
  if (/(^|\W)(mec|mecanic|manual|mt)/.test(text)) return 'Mecánica';
  if (/(^|\W)(aut|automatic|cvt|at)/.test(text)) return 'Automática';
  return value;
}

/**
 * Vehículo de su tarjeta (patente o filtro avanzado) en UNA línea compuesta, como en la app:
 * "Toyota Yaris 2018 · 1.5 GLI · Automática · ABCD11". La grilla con una etiqueta por dato
 * partía la tarjeta en varias filas.
 */
function VehicleLine({ parts }) {
  const text = parts.filter(Boolean).join(' · ');
  return <p className="catalog-applied-card-sub" title={text}>{text}</p>;
}

function FilterSearchSelect({ label, icon, allLabel, options, value, onChange, searchPlaceholder, helper }) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  if (isMobile) {
    return (
      <div className="filter-section-group compact-select-section filter-search-select">
        <label className="filter-group-label">{icon} {label}</label>
        <SheetSelect label={label} placeholder={allLabel} options={options} value={value} onChange={onChange} searchable />
        {helper && <small className="filter-search-select-help">{helper}</small>}
      </div>
    );
  }
  const normalized = normalizeNameKey(query);
  const visible = normalized
    ? options.filter((option) => option.value === value || normalizeNameKey(option.label).includes(normalized))
    : options;
  return (
    <div className="filter-section-group compact-select-section filter-search-select">
      <label className="filter-group-label">{icon} {label}</label>
      {options.length >= 10 && (
        <input
          type="search"
          className="filter-search-select-input"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={searchPlaceholder}
        />
      )}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="sidebar-select-input" aria-label={label}>
        <option value="">{allLabel}</option>
        {visible.map((option) => (
          <option key={option.value} value={option.value}>
            {option.count != null ? `${option.label} (${option.count})` : option.label}
          </option>
        ))}
      </select>
      {normalized && visible.length === 0 && <small className="filter-search-select-help">Sin resultados para “{query.trim()}”</small>}
      {helper && !normalized && <small className="filter-search-select-help">{helper}</small>}
    </div>
  );
}

export default function PartsCatalogView({
  onQuickView,
  onOpenQuote: _onOpenQuote,
  activeVehicle: initialActiveVehicle,
  initialCatalogFilter = null,
  initialSearchQuery = '',
  initialPage = 1,
  initialShowAll = false,
  initialAdvancedFilters = null,
  onVehicleChange,
  onNavigationStateChange,
  // Vista de una tienda (StorePublicProfileView): el mismo catálogo con sus mismos filtros,
  // acotado a esa tienda. La tienda no se puede quitar y el carrusel de categorías y la
  // vitrina no aplican (siempre hay contexto: la tienda).
  lockedStoreId = null,
  storeName = '',
  onResultsChange,
}) {
  const embedded = Boolean(lockedStoreId);
  // Los filtros avanzados que trae la URL (al volver de la ficha de un repuesto, recargar o
  // abrir un enlace compartido). Solo siembran el estado inicial: despues manda el panel.
  const [initialAdvanced] = useState(() => initialAdvancedFilters || {});
  const isMobileLayout = useIsMobile();

  // La fila de búsqueda, filtro y orden queda fija bajo el header al hacer scroll (móvil). El
  // header también es fijo y su alto cambia (menú, avisos), así que se mide en vivo.
  const mobileActionsRef = useRef(null);
  const [mobileActionsStuck, setMobileActionsStuck] = useState(false);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return undefined;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--catalog-sticky-top', `${Math.round(header.getBoundingClientRect().height)}px`);
    update();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(header);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--catalog-sticky-top');
    };
  }, []);
  useEffect(() => {
    const row = mobileActionsRef.current;
    if (!row || !isMobileLayout) return undefined;
    const check = () => {
      const top = parseFloat(getComputedStyle(row).top) || 0;
      setMobileActionsStuck(row.getBoundingClientRect().top <= top + 1 && window.scrollY > 0);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [isMobileLayout]);
  const [activeVehicle, setActiveVehicle] = useState(initialActiveVehicle);
  const [patentInput, setPatentInput] = useState('');
  const [patentError, setPatentError] = useState('');
  const [patentSearching, setPatentSearching] = useState(false);
  const [searchMode, setSearchMode] = useState('patente');
  const [inputValue, setInputValue] = useState(initialActiveVehicle?.patente || initialSearchQuery || '');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  // "Ver todos los repuestos": pide el listado paginado completo aunque no haya filtros.
  // Solo por accion explicita (boton o ?todos=1): la entrada a /repuestos sigue siendo la
  // vitrina acotada, que no dispara la consulta sobre todo el inventario.
  const [showAllProducts, setShowAllProducts] = useState(initialShowAll);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [selectedCategory, setSelectedCategory] = useState(initialCatalogFilter?.category || 'TODAS');
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialCatalogFilter?.subcategory || 'TODAS');
  // Despacho rápido sigue fuera del panel: es el único de los filtros originales que no
  // tiene campo en el backend, así que filtrarlo daría resultados falsos.
  // Compatibilidad de vehículo elegida a mano (para quien no tiene la patente a mano).
  // La marca se guarda con id y nombre: el catálogo de modelos se pide por id, pero el
  // filtro del catálogo público compara por NOMBRE (`compatibilidadMarca`).
  const [vehicleBrandId, setVehicleBrandId] = useState(initialAdvanced.vehicleBrandId || '');
  const [vehicleBrandName, setVehicleBrandName] = useState(initialAdvanced.vehicleBrandName || '');
  const [vehicleModel, setVehicleModel] = useState(initialAdvanced.vehicleModel || '');
  const [vehicleYear, setVehicleYear] = useState(initialAdvanced.vehicleYear || '');
  // Versiones (opcional, una o varias): ids de filas del catalogo separados por comas. Regla del
  // 5-oct: es el unico filtro que distingue un GLI de otro; el backend trae exactamente esas
  // versiones mas lo publicado sin version.
  const [vehicleVersionIds, setVehicleVersionIds] = useState(initialAdvanced.vehicleVersionIds || '');
  // Marca del repuesto (Bosch, Brembo, Valeo…). Es `marcaId` del endpoint, distinto de
  // la marca del vehículo: una es quién fabrica la pieza y la otra para qué auto sirve.
  const [partBrandId, setPartBrandId] = useState(initialAdvanced.partBrandId || '');
  // Condición técnica y origen de fabricación. Vuelven al panel ahora que el endpoint los
  // acepta como parámetro: antes se filtraban en el cliente sobre la página actual, y además
  // comparaban contra etiquetas ("Nuevo OEM Original") que el dato real nunca tuvo.
  const [selectedCondition, setSelectedCondition] = useState(initialAdvanced.condition || '');
  const [selectedOrigin, setSelectedOrigin] = useState(initialAdvanced.origin || '');
  // Tienda y comuna de los filtros avanzados (igual que la app): viajan al servidor como
  // `proveedorId` y `comunaId`, sobre todo el catálogo y no sobre la página cargada.
  const [selectedStoreId, setSelectedStoreId] = useState(lockedStoreId ? String(lockedStoreId) : (initialAdvanced.storeId || ''));
  useEffect(() => {
    if (lockedStoreId) setSelectedStoreId(String(lockedStoreId));
  }, [lockedStoreId]);
  const [selectedComunaId, setSelectedComunaId] = useState(initialAdvanced.comunaId || '');
  // Modalidad de compra como interruptor: encendido deja SOLO los que se venden a cotizacion.
  // Antes eran tres opciones con un "Todos los Repuestos" que prometia ver el catalogo entero
  // -justo lo que la vitrina evita- y que al tocarlo no cambiaba nada.
  const [onlyQuoteOnly, setOnlyQuoteOnly] = useState(Boolean(initialAdvanced.quoteOnly));
  const [onlyCompatible, setOnlyCompatible] = useState(!!initialActiveVehicle && initialAdvanced.onlyCompatible !== false);
  const [minPrice, setMinPrice] = useState(initialAdvanced.minPrice || 0);
  const [maxPrice, setMaxPrice] = useState(
    initialAdvanced.maxPrice && initialAdvanced.maxPrice < PRICE_CEILING ? initialAdvanced.maxPrice : PRICE_CEILING
  );
  // El deslizador se mueve contra un borrador local y solo se confirma al soltarlo:
  // `maxPrice` viaja al servidor, asi que arrastrarlo dispararia una consulta por pixel.
  const [priceDraft, setPriceDraft] = useState(maxPrice);
  const [minPriceDraft, setMinPriceDraft] = useState(minPrice > 0 ? String(minPrice) : '');
  const [sortBy, setSortBy] = useState(initialAdvanced.sort || 'relevancia');
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(initialAdvanced.perPage || 12);

  const selectCarouselCategory = (category) => {
    const matchedHeader = HEADER_CATEGORIES.find((h) => h.id === category.id);
    const targetCategory = matchedHeader ? matchedHeader.id : category.nombre;
    setSelectedCategory(targetCategory);
    setSelectedSubcategory('TODAS');
    setCurrentPage(1);
  };

  const { user, isLoggedIn } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites(user?.userId ?? user?.id);
  const [filterByMyComuna, setFilterByMyComuna] = useState(Boolean(initialAdvanced.myComunaId));
  const [myComunaId, setMyComunaId] = useState(initialAdvanced.myComunaId || null);
  const [myComunaNombre, setMyComunaNombre] = useState(initialAdvanced.myComunaName || '');
  const [comunaLookupStatus, setComunaLookupStatus] = useState('idle');
  const [comunaNotice, setComunaNotice] = useState('');
  // La comuna elegida en el panel manda sobre "Mi comuna".
  const activeComunaId = selectedComunaId || (filterByMyComuna ? myComunaId : null);

  const handleToggleComunaFilter = async () => {
    if (filterByMyComuna) {
      setFilterByMyComuna(false);
      setComunaNotice('');
      return;
    }
    if (!isLoggedIn || !user?.userId) {
      setComunaNotice('Inicia sesión y registra una comuna en tu perfil para usar este filtro.');
      return;
    }
    if (myComunaId) {
      setFilterByMyComuna(true);
      return;
    }
    setComunaLookupStatus('loading');
    try {
      const addresses = await getAddressesApi(user.userId);
      const principal = (Array.isArray(addresses) ? addresses : []).find((address) => address.esPrincipal) || addresses?.[0];
      if (!principal?.comunaId) {
        setComunaNotice('Registra una comuna en tu perfil para usar este filtro.');
        return;
      }
      setMyComunaId(principal.comunaId);
      setMyComunaNombre(principal.comunaNombre || 'mi comuna');
      setFilterByMyComuna(true);
    } catch (err) {
      setComunaNotice(err.message || 'No pudimos obtener tu comuna.');
    } finally {
      setComunaLookupStatus('idle');
    }
  };

  // Solo se ofrecen ordenamientos que el backend sabe resolver: `mapSortableField()`
  // acepta precio, createdAt, updatedAt y stock, y cualquier otro valor cae en silencio
  // a `precio`. "Mas vendidos" y "Mayor descuento" se ordenaban despues en el cliente,
  // o sea sobre las 12 filas de la pagina, no sobre el catalogo.
  const backendSort = useMemo(() => {
    switch (sortBy) {
      case 'precio-asc': return 'precio,asc';
      case 'precio-desc': return 'precio,desc';
      case 'recientes': return 'createdAt,desc';
      case 'relevancia':
      default:
        // Al lanzar no hay ventas ni calificaciones, asi que el stock es la unica senal
        // real que tiene el catalogo. Antes era `updatedAt,desc`, que ademas de no
        // recomendar nada era casi lo mismo que "Mas Recientes": `updatedAt` se mueve con
        // cualquier edicion del vendedor.
        return 'stock,desc';
    }
  }, [sortBy]);
  // Con vehiculo (patente o marca/modelo/anio/version del panel), "relevancia" no manda orden: el
  // backend usa su regla (compatible con Top, compatible, universal con Top, universal; en cada
  // grupo lo mas vendido primero). Los demas ordenes se aplican dentro de cada grupo.
  const vehicleSort = sortBy === 'relevancia' ? undefined : backendSort;

  // Lista de categorías persistidas en el backend para resolver IDs reales
  const { data: backendCategories = [], isFetched: categoriesFetched } = useQuery({
    queryKey: qk.categories(),
    queryFn: async ({ signal }) => {
      const list = await getPartCategoriesApi({ signal });
      return Array.isArray(list) ? list : [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const activeCategoryId = useMemo(() => {
    if (selectedCategory === 'TODAS') return initialCatalogFilter?.categoryId || undefined;
    const matched = backendCategories.find((c) => {
      const norm = normalizeNameKey(c.nombre);
      return norm === normalizeNameKey(selectedCategory) ||
             norm === normalizeNameKey(HEADER_CATEGORIES.find((h) => h.id === selectedCategory)?.nombre);
    });
    return matched?.id || initialCatalogFilter?.categoryId || undefined;
  }, [selectedCategory, backendCategories, initialCatalogFilter?.categoryId]);

  // Las subcategorías del panel son nombres fijos de `HEADER_CATEGORIES`, pero el endpoint
  // filtra por `subcategoriaId`. Se resuelve el id real contra el catálogo del backend para
  // que el filtro lo aplique la base de datos y no el navegador sobre la página actual.
  const { data: backendSubcategories = [], isFetched: subcategoriesFetched } = useQuery({
    queryKey: qk.subcategories(activeCategoryId),
    queryFn: async () => {
      const list = await getPartSubcategoriesApi(activeCategoryId);
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(activeCategoryId),
    staleTime: 1000 * 60 * 30,
  });

  const activeSubcategoryId = useMemo(() => {
    if (selectedSubcategory === 'TODAS') return initialCatalogFilter?.subcategoryId || undefined;
    const matched = backendSubcategories.find(
      (sub) => normalizeNameKey(sub.nombre) === normalizeNameKey(selectedSubcategory)
    );
    return matched?.id || initialCatalogFilter?.subcategoryId || undefined;
  }, [selectedSubcategory, backendSubcategories, initialCatalogFilter?.subcategoryId]);

  // Compatibilidad del panel: cada desplegable ofrece solo marcas, modelos, años y versiones
  // con repuestos publicados registrados como compatibles, con su conteo. Antes eran el catálogo
  // completo de vehículos y una lista fija de años, y se podía elegir un auto sin nada publicado.
  // En la vista de una tienda se acota a lo que publica esa tienda.
  const cascadeStoreId = lockedStoreId ? String(lockedStoreId) : undefined;
  const cascadeBrands = useVehicleCascadeStep({ proveedorId: cascadeStoreId }, true);
  const cascadeModels = useVehicleCascadeStep(
    { proveedorId: cascadeStoreId, marcaId: vehicleBrandId },
    Boolean(vehicleBrandId),
  );
  const cascadeYears = useVehicleCascadeStep(
    { proveedorId: cascadeStoreId, marcaId: vehicleBrandId, modelo: vehicleModel },
    Boolean(vehicleBrandId && vehicleModel),
  );
  const cascadeVersions = useVehicleCascadeStep(
    { proveedorId: cascadeStoreId, marcaId: vehicleBrandId, modelo: vehicleModel, anio: vehicleYear },
    Boolean(vehicleBrandId && vehicleModel && vehicleYear),
  );
  const vehicleBrands = cascadeBrands?.marcas || [];

  // Marcas de repuesto. El endpoint acota por NOMBRE de categoría, así que al haber una
  // categoría elegida solo se ofrecen las marcas que fabrican piezas de esa familia.
  const activeCategoryName = useMemo(() => {
    if (selectedCategory === 'TODAS') return undefined;
    const matched = backendCategories.find((c) => c.id === activeCategoryId);
    return matched?.nombre || undefined;
  }, [selectedCategory, backendCategories, activeCategoryId]);

  const { data: partBrands = [] } = useQuery({
    queryKey: qk.brands(activeCategoryName),
    queryFn: async () => {
      const list = await getPartBrandsApi(activeCategoryName);
      return Array.isArray(list) ? list : [];
    },
    staleTime: 1000 * 60 * 30,
  });

  // Orígenes de fabricación presentes en el catálogo. `MarcaRepuesto.paisOrigen` es texto
  // libre, así que la lista la sirve el backend ya descompuesta y deduplicada.
  // Tiendas y comunas de todo el catálogo publicado, no de los productos ya cargados.
  const { data: catalogFilterOptions = { tiendas: [], comunas: [] } } = useQuery({
    queryKey: qk.catalogFilterOptions(),
    queryFn: async ({ signal }) => {
      try {
        const data = await getCatalogFilterOptionsApi({ signal });
        return {
          tiendas: Array.isArray(data?.tiendas) ? data.tiendas : [],
          comunas: Array.isArray(data?.comunas) ? data.comunas : [],
        };
      } catch {
        return { tiendas: [], comunas: [] };
      }
    },
    staleTime: 1000 * 60 * 5,
  });
  const storeFilterOptions = useMemo(() => catalogFilterOptions.tiendas.map((store) => ({
    value: String(store.id),
    label: store.comuna ? `${store.nombre} · ${store.comuna}` : store.nombre,
  })), [catalogFilterOptions.tiendas]);
  const comunaFilterOptions = useMemo(() => catalogFilterOptions.comunas.map((comuna) => ({
    value: String(comuna.id),
    label: comuna.region ? `${comuna.nombre} · ${comuna.region}` : comuna.nombre,
  })), [catalogFilterOptions.comunas]);

  const { data: partOrigins = [] } = useQuery({
    queryKey: qk.partOrigins(),
    queryFn: async ({ signal }) => {
      try {
        const list = await getPublicPartOriginsApi({ signal });
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 30,
  });

  // Si hay un vehículo activo con catalogoId del backend y el filtro de compatibilidad está encendido,
  // consultamos el motor de cruce relacional /vehiculos-catalogo/{id}/repuestos directamente.
  const isVehicleCatalogSearch = Boolean(onlyCompatible && activeVehicle?.catalogoId);

  // Regla del 4-oct: con patente, cada filtro avanzado ofrece solo lo que existe en el universo
  // compatible con el auto (categorias, marcas, condicion, origen, tiendas, comunas, precio y
  // modalidad). Sin patente, o mientras carga, se usan los catalogos completos.
  const { data: vehicleFilters = null } = useQuery({
    // En la vista de una tienda, acotadas a la tienda y al vehiculo a la vez.
    queryKey: qk.vehicleFilterOptions(activeVehicle?.catalogoId, activeVehicle?.anio, cascadeStoreId),
    queryFn: async ({ signal }) => {
      try {
        return await getVehicleFilterOptionsApi(activeVehicle.catalogoId, {
          anio: activeVehicle.anio, proveedorId: cascadeStoreId, signal,
        });
      } catch {
        return null;
      }
    },
    enabled: isVehicleCatalogSearch,
    staleTime: 1000 * 60 * 5,
  });
  const scopedFilters = isVehicleCatalogSearch && vehicleFilters ? vehicleFilters : null;
  /**
   * Compatibilidad enviada al servidor. Manda el vehículo activo (patente) cuando lo hay y
   * no se resolvió por `catalogoId`; si no, mandan los selectores manuales del panel.
   * El backend compara la marca por nombre en minúsculas, así que sirve tal cual venga del
   * catálogo ("TOYOTA") o del cruce por patente ("Toyota").
   */
  const usaVehiculoActivo = Boolean(onlyCompatible && activeVehicle && !isVehicleCatalogSearch);
  const compatibilidadMarca = usaVehiculoActivo
    ? activeVehicle.marca || undefined
    : vehicleBrandName || undefined;
  const compatibilidadModelo = usaVehiculoActivo
    ? activeVehicle.modelo || undefined
    : vehicleModel || undefined;
  const compatibilidadAnio = usaVehiculoActivo
    ? activeVehicle.anio || undefined
    : vehicleYear || undefined;
  const compatibilidadVersionIds = usaVehiculoActivo ? undefined : vehicleVersionIds || undefined;
  // Con vehiculo el backend ordena por grupos de compatibilidad y ventas: "relevancia" no manda
  // orden (el `stock,desc` del catalogo general lo pisaria dentro de cada grupo).
  const catalogSort = (compatibilidadMarca || compatibilidadModelo) ? vehicleSort : backendSort;

  // Sin patente, las opciones de los filtros salen del catálogo publicado (acotado al vehículo
  // del panel y a la tienda, como el listado), con su conteo: no se ofrece nada que devuelva
  // cero. Con patente mandan las del universo compatible (`scopedFilters`). Mientras cargan,
  // o si fallan, quedan los catálogos completos de antes, sin conteo.
  const publishedFilterParams = {
    proveedorId: lockedStoreId ? String(lockedStoreId) : undefined,
    compatibilidadMarca,
    compatibilidadModelo,
    compatibilidadAnio,
    compatibilidadVersionIds,
  };
  const { data: publishedFilters = null } = useQuery({
    queryKey: qk.publishedFilterOptions(publishedFilterParams),
    queryFn: async ({ signal }) => {
      try {
        return await getPublishedFilterOptionsApi({ ...publishedFilterParams, signal });
      } catch {
        return null;
      }
    },
    enabled: !isVehicleCatalogSearch,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });
  const filterSource = isVehicleCatalogSearch ? scopedFilters : publishedFilters;

  const visibleNavigationCategories = useMemo(() => {
    if (!filterSource) return NAVIGATION_CATEGORIES;
    return NAVIGATION_CATEGORIES.map((cat) => {
      const backendCategory = findPublishedCategory(filterSource, cat);
      const isSelected = selectedCategory === cat.id || selectedCategory === cat.nombre;
      if (!backendCategory && !isSelected) return null;
      const subCounts = new Map((filterSource.subcategorias || [])
        .filter((sub) => backendCategory && sub.categoriaId === backendCategory.id)
        .map((sub) => [normalizeNameKey(sub.nombre), sub.productos]));
      const subcategories = (cat.subcategories || []).filter((name) => subCounts.has(normalizeNameKey(name))
        || (isSelected && selectedSubcategory === name));
      return {
        ...cat,
        count: backendCategory?.productos,
        subcategories,
        subcategoryCounts: Object.fromEntries(subcategories.map((name) => [name, subCounts.get(normalizeNameKey(name))])),
      };
    }).filter(Boolean);
  }, [filterSource, selectedCategory, selectedSubcategory]);

  // Ids publicados de la categoría y subcategoría elegidas, con el mismo cruce por id o nombre
  // del panel; si no aparecen en lo publicado, los ids resueltos contra el catálogo maestro.
  const publishedCategoryId = useMemo(() => {
    if (selectedCategory === 'TODAS') return activeCategoryId;
    const navCategory = NAVIGATION_CATEGORIES.find((cat) => selectedCategory === cat.id || selectedCategory === cat.nombre);
    return (navCategory && findPublishedCategory(filterSource, navCategory)?.id) ?? activeCategoryId;
  }, [filterSource, selectedCategory, activeCategoryId]);
  const publishedSubcategoryId = useMemo(() => {
    if (selectedSubcategory === 'TODAS') return activeSubcategoryId;
    const sub = (filterSource?.subcategorias || []).find((item) => String(item.categoriaId) === String(publishedCategoryId)
      && normalizeNameKey(item.nombre) === normalizeNameKey(selectedSubcategory));
    return sub?.id ?? activeSubcategoryId;
  }, [filterSource, selectedSubcategory, publishedCategoryId, activeSubcategoryId]);

  // Marca del repuesto con lo publicado y su conteo dentro de lo elegido: con subcategoría, las
  // marcas de esa subcategoría; con categoría, las de la categoría; si no, todas. Sin datos
  // publicados (cargando o error) queda el cruce maestro categoría→marca, sin conteo.
  const visiblePartBrands = useMemo(() => {
    if (!filterSource) return partBrands;
    const byGroup = (list, groupId) => (list || [])
      .filter((brand) => String(brand.grupoId) === String(groupId));
    if (selectedSubcategory !== 'TODAS' && publishedSubcategoryId != null && filterSource.marcasPorSubcategoria) {
      return byGroup(filterSource.marcasPorSubcategoria, publishedSubcategoryId);
    }
    if (selectedCategory !== 'TODAS' && publishedCategoryId != null && filterSource.marcasPorCategoria) {
      return byGroup(filterSource.marcasPorCategoria, publishedCategoryId);
    }
    return filterSource.marcas || [];
  }, [filterSource, partBrands, selectedCategory, selectedSubcategory, publishedCategoryId, publishedSubcategoryId]);

  const conditionCounts = filterSource
    ? new Map((filterSource.condicionesConteo || (filterSource.condiciones || []).map((nombre) => ({ nombre })))
      .map((condition) => [String(condition.nombre).toUpperCase(), condition.productos]))
    : null;
  const visibleConditions = conditionCounts
    ? PART_CONDITIONS
      .filter((condition) => conditionCounts.has(condition.value) || selectedCondition === condition.value)
      .map((condition) => ({ ...condition, count: conditionCounts.get(condition.value) }))
    : PART_CONDITIONS;

  const visibleOrigins = filterSource
    ? (filterSource.origenesConteo || (filterSource.origenes || []).map((nombre) => ({ nombre })))
      .map((origin) => ({ value: origin.nombre, label: origin.nombre, count: origin.productos }))
    : partOrigins.map((origin) => ({ value: origin, label: origin }));

  const visibleStoreOptions = useMemo(() => keepSelected(filterSource
    ? (filterSource.tiendas || []).map((store) => ({
      value: String(store.id),
      label: store.comuna ? `${store.nombre} · ${store.comuna}` : store.nombre,
      count: store.productos,
    }))
    : storeFilterOptions,
  selectedStoreId,
  storeFilterOptions.find((option) => option.value === String(selectedStoreId))?.label),
  [filterSource, storeFilterOptions, selectedStoreId]);
  // El conteo de una comuna es cuántas tiendas con publicaciones tiene.
  const visibleComunaOptions = useMemo(() => keepSelected(filterSource
    ? (filterSource.comunas || []).map((comuna) => ({
      value: String(comuna.id),
      label: comuna.region ? `${comuna.nombre} · ${comuna.region}` : comuna.nombre,
      count: comuna.tiendas,
    }))
    : comunaFilterOptions,
  selectedComunaId,
  comunaFilterOptions.find((option) => option.value === String(selectedComunaId))?.label),
  [filterSource, comunaFilterOptions, selectedComunaId]);
  // Rango de precio de lo publicado en el alcance actual, con o sin patente: ambos modos
  // descartan los atajos bajo el mínimo y muestran el mismo aviso.
  const scopedMinPrice = filterSource?.precioMin != null ? Number(filterSource.precioMin) : null;
  const scopedMaxPrice = filterSource?.precioMax != null ? Number(filterSource.precioMax) : null;
  const priceRangeLead = (isVehicleCatalogSearch || compatibilidadMarca)
    ? 'Para tu vehículo'
    : (lockedStoreId ? 'En esta tienda' : 'En el catálogo');
  const visiblePricePresets = scopedMinPrice != null
    ? PRICE_PRESETS.filter((preset) => preset >= scopedMinPrice)
    : PRICE_PRESETS;
  const showQuoteOnlyFilter = !filterSource || filterSource.hayCotizacion || onlyQuoteOnly;

  /**
   * El catálogo paginado NO se consulta sin contexto. Entrar a /repuestos y disparar un
   * scan + COUNT(*) sobre todo el inventario visible es lo que no escala a 20k productos,
   * y además una pared de repuestos sin relación no le sirve a nadie. Sin contexto se
   * muestra la vitrina de entrada (categorías con conteo real + destacados acotados).
   */
  const hasActiveContext = Boolean(
    showAllProducts
    || deferredSearchQuery?.trim()
    || selectedCategory !== 'TODAS'
    || activeCategoryId
    || activeComunaId
    || (onlyCompatible && activeVehicle)
    || onlyQuoteOnly
    || selectedCondition
    || selectedOrigin
    || vehicleBrandName
    || vehicleModel
    || vehicleYear
    || partBrandId
    || selectedStoreId
    || minPrice > 0
    || maxPrice < PRICE_CEILING
  );

  /**
   * Categoría y subcategoría llegan como nombre y se traducen a id contra el catálogo
   * del backend. Sin esperar esa resolución, entrar por `/repuestos?categoria=aceite`
   * disparaba primero la consulta SIN filtro (justo la que no queremos) y recién después
   * la filtrada. Se espera a que el catálogo respondió; si el nombre no existe allá,
   * `isFetched` igual libera la consulta y simplemente no se aplica ese filtro.
   */
  const filtersResolved =
    (selectedCategory === 'TODAS' || categoriesFetched)
    && (selectedSubcategory === 'TODAS' || !activeCategoryId || subcategoriesFetched);

  // Consulta paginada real en el servidor
  const {
    data: catalogData = { items: [], total: 0, totalPages: 1, page: 0 },
    isLoading: productsLoading,
    error: productsQueryError,
  } = useQuery({
    queryKey: isVehicleCatalogSearch
      ? qk.vehicleCompatibleProducts(activeVehicle.catalogoId, {
          anio: activeVehicle.anio || undefined,
          sort: vehicleSort,
          page: currentPage - 1,
          size: itemsPerPage,
          texto: deferredSearchQuery?.trim() || undefined,
          categoriaId: activeCategoryId,
          subcategoriaId: activeSubcategoryId,
          marcaId: partBrandId || undefined,
          condicion: selectedCondition || undefined,
          origen: selectedOrigin || undefined,
          comunaId: activeComunaId,
        proveedorId: selectedStoreId || undefined,
          soloCotizacion: onlyQuoteOnly ? true : undefined,
          precioMin: minPrice > 0 ? minPrice : undefined,
          precioMax: maxPrice < PRICE_CEILING ? maxPrice : undefined,
        })
      : qk.products({
          page: currentPage - 1,
          size: itemsPerPage,
          texto: deferredSearchQuery?.trim() || undefined,
          categoryId: activeCategoryId,
          subcategoriaId: activeSubcategoryId,
          comunaId: activeComunaId,
        proveedorId: selectedStoreId || undefined,
          compatibilidadMarca,
          compatibilidadModelo,
          compatibilidadAnio,
          compatibilidadVersionIds,
          marcaId: partBrandId || undefined,
          condicion: selectedCondition || undefined,
          origen: selectedOrigin || undefined,
          precioMin: minPrice > 0 ? minPrice : undefined,
          precioMax: maxPrice < PRICE_CEILING ? maxPrice : undefined,
          sort: catalogSort,
          soloCotizacion: onlyQuoteOnly ? true : undefined,
        }),
    enabled: hasActiveContext && filtersResolved,
    // Al cambiar de pagina la queryKey cambia y, sin esto, `catalogData` cae al valor por
    // defecto mientras llega la respuesta: `totalPages` valdria 1 por un instante y el clamp
    // de mas abajo devolveria al usuario a la pagina 1. Ademas evita que el grid parpadee.
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      if (isVehicleCatalogSearch) {
        const data = await getVehicleCatalogPartsApi(activeVehicle.catalogoId, {
          anio: activeVehicle.anio || undefined,
          sort: vehicleSort,
          page: currentPage - 1,
          size: itemsPerPage,
          texto: deferredSearchQuery?.trim() || undefined,
          categoriaId: activeCategoryId,
          subcategoriaId: activeSubcategoryId,
          marcaId: partBrandId || undefined,
          condicion: selectedCondition || undefined,
          origen: selectedOrigin || undefined,
          comunaId: activeComunaId,
        proveedorId: selectedStoreId || undefined,
          soloCotizacion: onlyQuoteOnly ? true : undefined,
          precioMin: minPrice > 0 ? minPrice : undefined,
          precioMax: maxPrice < PRICE_CEILING ? maxPrice : undefined,
          signal,
        });
        return adaptCompatibleOffersPage(data);
      }

      const data = await getPublicProductsApi({
        page: currentPage - 1,
        size: itemsPerPage,
        texto: deferredSearchQuery?.trim() || undefined,
        categoriaId: activeCategoryId,
        subcategoriaId: activeSubcategoryId,
        comunaId: activeComunaId,
        proveedorId: selectedStoreId || undefined,
        compatibilidadMarca,
        compatibilidadModelo,
        compatibilidadAnio,
        compatibilidadVersionIds,
        marcaId: partBrandId || undefined,
        condicion: selectedCondition || undefined,
        origen: selectedOrigin || undefined,
        precioMin: minPrice > 0 ? minPrice : undefined,
        precioMax: maxPrice < PRICE_CEILING ? maxPrice : undefined,
        soloCotizacion: onlyQuoteOnly ? true : undefined,
        sort: catalogSort,
        signal,
      });
      const adapted = adaptPage(data, adaptProduct);
      return {
        items: adapted.items,
        total: adapted.total,
        totalPages: adapted.totalPages,
        page: adapted.page,
      };
    },
  });

  // Vitrina inicial: una única sección de recién publicados. La recomendación por
  // defecto antepone los productos Top, sin separarlos en otro bloque visual.
  const {
    data: showcase = { items: [] },
    isLoading: showcaseLoading,
  } = useQuery({
    queryKey: qk.products({ vitrina: true, size: SHOWCASE_SIZE, sort: backendSort, topFirst: sortBy === 'relevancia' }),
    enabled: !hasActiveContext,
    staleTime: 1000 * 60 * 5,
    queryFn: async ({ signal }) => {
      if (sortBy !== 'relevancia') {
        const data = await getPublicProductsApi({
          page: 0,
          size: SHOWCASE_SIZE * 2,
          sort: backendSort,
          signal,
        });
        return { items: adaptPage(data, adaptProduct).items };
      }

      const destacados = adaptPage(await getPublicProductsApi({
        page: 0,
        size: SHOWCASE_SIZE,
        soloDestacados: true,
        sort: backendSort,
        signal,
      }), adaptProduct).items;
      const recientes = adaptPage(await getPublicProductsApi({
        page: 0,
        size: SHOWCASE_SIZE + destacados.length,
        sort: backendSort,
        signal,
      }), adaptProduct).items;
      const idsTop = new Set(destacados.map((item) => item.id));
      return {
        items: [...destacados, ...recientes.filter((item) => !idsTop.has(item.id)).slice(0, SHOWCASE_SIZE)],
      };
    },
  });

  const products = catalogData.items;
  // Opciones de los desplegables en el formato { value, label } de SheetSelect.
  // `count` son las publicaciones de cada opción; SheetSelect lo muestra solo en la lista.
  const vehicleBrandOptions = keepSelected(
    vehicleBrands.map((brand) => ({ value: String(brand.id), label: brand.nombre, count: brand.productos })),
    vehicleBrandId, vehicleBrandName,
  );
  const vehicleModelOptions = keepSelected(
    (cascadeModels?.modelos || []).map((model) => ({ value: model.nombre, label: model.nombre, count: model.productos })),
    vehicleModel, vehicleModel,
  );
  const vehicleYearOptions = keepSelected(
    (cascadeYears?.anios || []).map((year) => ({ value: String(year.id ?? year.nombre), label: String(year.nombre), count: year.productos })),
    vehicleYear, vehicleYear,
  );
  const vehicleVersionOptions = String(vehicleVersionIds || '').split(',').filter(Boolean).reduce(
    (options, id) => keepSelected(options, id, `Versión ${id}`),
    (cascadeVersions?.versiones || []).map((version) => ({ value: String(version.id), label: version.nombre, count: version.productos })),
  );
  const partBrandOptions = keepSelected(
    visiblePartBrands.map((brand) => ({ value: String(brand.id), label: brand.nombre, count: brand.productos })),
    partBrandId, [...(filterSource?.marcas || []), ...partBrands]
      .find((brand) => String(brand.id) === String(partBrandId))?.nombre,
  );
  const originOptions = keepSelected(visibleOrigins, selectedOrigin, selectedOrigin);
  // Al volver de la ficha de un repuesto el scroll se devuelve cuando el listado ya esta pintado.
  useScrollMemory(hasActiveContext ? filtersResolved && !productsLoading : !showcaseLoading);
  const totalProducts = catalogData.total;
  useEffect(() => {
    if (!onResultsChange || productsLoading) return;
    onResultsChange({ total: totalProducts, vehicleActive: Boolean(activeVehicle && onlyCompatible) });
  }, [onResultsChange, productsLoading, totalProducts, activeVehicle, onlyCompatible]);
  // Paginación acotada: se navegan hasta MAX_PAGINATED_RESULTS resultados. Más allá,
  // el usuario debe refinar (categoría, patente, texto) en vez de pasar páginas.
  const maxNavigablePages = Math.max(1, Math.ceil(MAX_PAGINATED_RESULTS / itemsPerPage));
  const totalPages = Math.min(Math.max(1, catalogData.totalPages), maxNavigablePages);
  const isResultSetTruncated = totalProducts > MAX_PAGINATED_RESULTS;
  const productsError = productsQueryError ? (productsQueryError.message || 'No se pudo cargar el catálogo de repuestos.') : null;

  const [openFilterSections, setOpenFilterSections] = useState({
    category: true,
    subcategory: true,
    vehicle: true,
    condition: true,
    price: true,
  });
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    if (initialCatalogFilter?.category) setSelectedCategory(initialCatalogFilter.category);
    if (initialCatalogFilter?.subcategory) setSelectedSubcategory(initialCatalogFilter.subcategory);
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

  const keepCompatibleOffRef = useRef(initialAdvanced.onlyCompatible === false);
  useEffect(() => {
    setActiveVehicle(initialActiveVehicle);
    if (initialActiveVehicle) {
      // Al volver con el filtro del vehiculo quitado (`compatible=0`) se respeta esa decision.
      if (keepCompatibleOffRef.current) keepCompatibleOffRef.current = false;
      else setOnlyCompatible(true);
      if (initialActiveVehicle.patente) {
        setInputValue(initialActiveVehicle.patente);
        setSearchMode('patente');
      }
    }
  }, [initialActiveVehicle]);

  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  // El borrador ya está en el render actual (cada `onChange` re-renderiza), así que
  // confirmar es copiarlo tal cual al estado que alimenta la consulta.
  // Bajar el máximo por debajo del mínimo dejaría un rango invertido (cero resultados sin
  // explicación), así que el mínimo lo acompaña hacia abajo.
  const applyMaxPrice = (value) => {
    setMaxPrice(value);
    if (minPrice > value) {
      setMinPrice(value);
      setMinPriceDraft(value > 0 ? String(value) : '');
    }
  };

  const commitPriceDraft = () => applyMaxPrice(priceDraft);

  /**
   * Precio mínimo. Se acota al techo y nunca puede superar al máximo vigente: un rango
   * invertido devuelve cero resultados sin que se vea por qué, así que se corrige al vuelo
   * y el campo se reescribe con el valor que efectivamente se aplicó.
   */
  const commitMinPrice = () => {
    const parsed = Number(minPriceDraft);
    if (!minPriceDraft.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setMinPrice(0);
      setMinPriceDraft('');
      return;
    }
    const applied = Math.min(Math.max(0, Math.round(parsed)), maxPrice, PRICE_CEILING);
    setMinPrice(applied);
    setMinPriceDraft(String(applied));
  };

  const applyPricePreset = (value) => {
    setPriceDraft(value);
    applyMaxPrice(value);
  };

  const toggleFilterSection = (section) => {
    setOpenFilterSections((current) => ({ ...current, [section]: !current[section] }));
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
      const normalized = normalizePlate(value);
      if (!isValidPlate(normalized)) {
        setPatentError('Patente no válida. Formato: ABCD12 o BB-CL-12');
        return;
      }
      setPatentSearching(true);
      setPatentInput(normalized);
      try {
        const resolved = adaptVehicle(await searchVehicleByPatenteApi(normalized));
        if (resolved && !resolved.requiereIngresoManual && resolved.marca) {
          setActiveVehicle(resolved);
          onVehicleChange?.(resolved);
          setOnlyCompatible(true);
          setInputValue(resolved.patente || normalized);
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

  // La lista de marcas de repuesto se acota a la categoría elegida, así que al cambiar de
  // categoría la marca seleccionada puede dejar de existir en el desplegable: si quedara
  // puesta, el `marcaId` seguiría viajando y el filtro se vería vacío sin motivo visible.
  const categoryNameRef = useRef(null);
  useEffect(() => {
    if (!categoriesFetched) return;
    if (categoryNameRef.current === null) {
      categoryNameRef.current = activeCategoryName ?? '';
      return;
    }
    if (categoryNameRef.current === (activeCategoryName ?? '')) return;
    categoryNameRef.current = activeCategoryName ?? '';
    setPartBrandId('');
  }, [activeCategoryName, categoriesFetched]);

  // Reset to page 1 when any filter changes.
  const previousFiltersRef = useRef(null);
  useEffect(() => {
    const signature = JSON.stringify([
      deferredSearchQuery, selectedCategory, selectedSubcategory, vehicleBrandName, vehicleModel,
      vehicleYear, vehicleVersionIds, partBrandId, selectedCondition, selectedOrigin, onlyQuoteOnly, onlyCompatible,
      minPrice, maxPrice, sortBy, itemsPerPage, selectedStoreId, selectedComunaId
    ]);
    const previous = previousFiltersRef.current;
    previousFiltersRef.current = signature;
    if (previous === null || previous === signature) return;
    setCurrentPage(1);
  }, [
    deferredSearchQuery, selectedCategory, selectedSubcategory, vehicleBrandName, vehicleModel,
    vehicleYear, vehicleVersionIds, partBrandId, selectedCondition, selectedOrigin, onlyQuoteOnly, onlyCompatible,
    minPrice, maxPrice, sortBy, itemsPerPage, selectedStoreId, selectedComunaId
  ]);

  /**
   * Ya no queda ningún filtro de cliente: las dos ramas (catálogo general y compatibilidad por
   * `catalogoId`) resuelven todo en la base de datos.
   *
   * No volver a agregar filtros aquí: operan sobre las filas de la página actual, así que el
   * contador de arriba y los resultados dejan de coincidir apenas hay más de una página.
   */
  const displayedProducts = products;

  // Una URL con `?pagina=9999` (o bajar de 36 a 12 por página) puede dejar la página actual
  // fuera del tope navegable; se devuelve al último rango con resultados.
  //
  // Solo con datos ya cargados: durante un fetch `totalPages` puede no reflejar todavía el
  // conjunto real, y corregir sobre ese valor transitorio expulsa de la página recién pedida.
  useEffect(() => {
    if (!hasActiveContext || productsLoading || totalProducts === 0) return;
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [hasActiveContext, productsLoading, totalProducts, currentPage, totalPages]);

  const startIndex = totalProducts === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalProducts);

  useEffect(() => {
    onNavigationStateChange?.({
      category: selectedCategory === 'TODAS' ? null : selectedCategory,
      subcategory: selectedSubcategory === 'TODAS' ? null : selectedSubcategory,
      query: searchQuery,
      page: currentPage,
      showAll: showAllProducts,
      advanced: {
        vehicleBrandId,
        vehicleBrandName,
        vehicleModel,
        vehicleYear,
        vehicleVersionIds,
        partBrandId,
        condition: selectedCondition,
        origin: selectedOrigin,
        storeId: selectedStoreId,
        comunaId: selectedComunaId,
        myComunaId: filterByMyComuna ? myComunaId : null,
        myComunaName: filterByMyComuna ? myComunaNombre : null,
        quoteOnly: onlyQuoteOnly ? '1' : null,
        minPrice: minPrice > 0 ? minPrice : null,
        maxPrice: maxPrice < PRICE_CEILING ? maxPrice : null,
        sort: sortBy !== 'relevancia' ? sortBy : null,
        perPage: itemsPerPage !== 12 ? itemsPerPage : null,
        onlyCompatible: activeVehicle && !onlyCompatible ? '0' : null,
      },
    });
  }, [
    onNavigationStateChange, selectedCategory, selectedSubcategory, searchQuery, currentPage, showAllProducts,
    vehicleBrandId, vehicleBrandName, vehicleModel, vehicleYear, vehicleVersionIds, partBrandId,
    selectedCondition, selectedOrigin, selectedStoreId, selectedComunaId, filterByMyComuna, myComunaId,
    myComunaNombre, onlyQuoteOnly, minPrice, maxPrice, sortBy, itemsPerPage, activeVehicle, onlyCompatible,
  ]);

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
    setShowAllProducts(false);
    setSearchQuery('');
    setInputValue('');
    setSelectedCategory('TODAS');
    setSelectedSubcategory('TODAS');
    setVehicleBrandId('');
    setVehicleBrandName('');
    setVehicleModel('');
    setVehicleYear('');
    setVehicleVersionIds('');
    setPartBrandId('');
    setSelectedCondition('');
    setSelectedOrigin('');
    setSelectedStoreId(lockedStoreId ? String(lockedStoreId) : '');
    setSelectedComunaId('');
    setOnlyQuoteOnly(false);
    // El filtro de la patente manda: limpiar los filtros avanzados no lo quita. Para eso
    // esta el boton "Quitar filtro" del vehiculo.
    setOnlyCompatible(Boolean(activeVehicle));
    setMinPrice(0);
    setMinPriceDraft('');
    setMaxPrice(PRICE_CEILING);
    setPriceDraft(PRICE_CEILING);
    setSortBy('relevancia');
    setCurrentPage(1);
  };

  const handleApplyFilters = () => {
    setMobileFiltersOpen(false);
    requestAnimationFrame(() => document.querySelector('.catalog-parts-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const appliedFilterLabel = selectedSubcategory !== 'TODAS'
    ? selectedSubcategory
    : selectedCategory !== 'TODAS'
      ? (NAVIGATION_CATEGORIES.find((category) => category.id === selectedCategory)?.nombre || selectedCategory)
      : null;

  // Solo movil (public-mobile.css): con una categoria elegida el carrusel de categorias se
  // pliega (339px sobre los resultados) y "Cambiar" lo vuelve a abrir. En escritorio no hay
  // reglas para estas clases.
  const [isPickingCategory, setIsPickingCategory] = useState(false);
  useEffect(() => { setIsPickingCategory(false); }, [selectedCategory, selectedSubcategory]);

  const clearAppliedCatalogFilter = () => {
    setSelectedCategory('TODAS');
    setSelectedSubcategory('TODAS');
  };

  /**
   * Pines de los filtros avanzados aplicados, visibles sobre los resultados: el comprador ve
   * por que se esta filtrando sin abrir el panel, y quita cada uno con su X. La categoria y el
   * vehiculo de la patente ya tienen su propio aviso arriba, y el vehiculo del panel va en su
   * tarjeta (como la patente en la app), asi que no se repiten como pines.
   */
  const labelOf = (options, value) => options.find((option) => option.value === String(value))?.label;
  const usesPanelVehicle = !(activeVehicle && onlyCompatible) && Boolean(vehicleBrandName || vehicleModel);
  const selectedVersionLabels = String(vehicleVersionIds || '').split(',').filter(Boolean)
    .map((id) => labelOf(vehicleVersionOptions, id) || id);
  const panelVehicleLabel = usesPanelVehicle
    ? [
      [vehicleBrandName, vehicleModel, vehicleYear].filter(Boolean).join(' '),
      selectedVersionLabels.length ? selectedVersionLabels.join(', ') : null,
    ].filter(Boolean).join(' · ')
    : '';
  const clearPanelVehicle = () => {
    setVehicleBrandId('');
    setVehicleBrandName('');
    setVehicleModel('');
    setVehicleYear('');
    setVehicleVersionIds('');
  };
  // "Cambiar": en movil abre el panel; en escritorio lleva a la seccion del panel.
  const openFiltersAt = (section) => {
    if (isMobileLayout) {
      setMobileFiltersOpen(true);
      return;
    }
    if (section) setOpenFilterSections((current) => ({ ...current, [section]: true }));
    requestAnimationFrame(() => document.getElementById('catalog-filter-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const appliedAdvancedFilters = [
    onlyQuoteOnly && { key: 'cotizar', label: 'Solo a cotizar', onRemove: () => setOnlyQuoteOnly(false) },
    partBrandId && {
      key: 'marca',
      label: `Marca: ${labelOf(partBrandOptions, partBrandId) || 'elegida'}`,
      onRemove: () => setPartBrandId(''),
    },
    selectedCondition && {
      key: 'condicion',
      label: PART_CONDITIONS.find((condition) => condition.value === selectedCondition)?.label || selectedCondition,
      onRemove: () => setSelectedCondition(''),
    },
    selectedOrigin && { key: 'origen', label: `Origen: ${selectedOrigin}`, onRemove: () => setSelectedOrigin('') },
    (minPrice > 0 || maxPrice < PRICE_CEILING) && {
      key: 'precio',
      label: minPrice > 0 && maxPrice < PRICE_CEILING
        ? `Precio: ${formatCLP(minPrice)} – ${formatCLP(maxPrice)}`
        : minPrice > 0 ? `Desde ${formatCLP(minPrice)}` : `Hasta ${formatCLP(maxPrice)}`,
      onRemove: () => {
        setMinPrice(0);
        setMinPriceDraft('');
        setMaxPrice(PRICE_CEILING);
        setPriceDraft(PRICE_CEILING);
      },
    },
    selectedStoreId && !lockedStoreId && {
      key: 'tienda',
      label: `Tienda: ${(labelOf(visibleStoreOptions, selectedStoreId) || 'elegida').split(' · ')[0]}`,
      onRemove: () => setSelectedStoreId(''),
    },
    selectedComunaId && {
      key: 'comuna',
      label: `Comuna: ${(labelOf(visibleComunaOptions, selectedComunaId) || 'elegida').split(' · ')[0]}`,
      onRemove: () => setSelectedComunaId(''),
    },
    !selectedComunaId && filterByMyComuna && {
      key: 'miComuna',
      label: `Mi comuna: ${myComunaNombre || 'registrada'}`,
      onRemove: () => setFilterByMyComuna(false),
    },
  ].filter(Boolean);
  const clearAppliedAdvancedFilters = () => appliedAdvancedFilters.forEach((filter) => filter.onRemove());
  const activeAdvancedCount = appliedAdvancedFilters.length + (panelVehicleLabel ? 1 : 0);

  const renderCatalogTextSearch = (placeholder = 'Buscar repuestos') => (
      <TextSearchWithSuggestions
        value={searchQuery}
        onChange={setSearchQuery}
        suggestions={[
          ...NAVIGATION_CATEGORIES.map((category) => ({ label: category.nombre, type: 'category' })),
          ...products.map((product) => ({ label: product.titulo, type: 'product' })),
        ].filter((item) => item.label)}
        placeholder={placeholder}
      />
  );

  const clearActiveVehicle = () => {
    setActiveVehicle(null);
    onVehicleChange?.(null);
    setOnlyCompatible(false);
    setPatentInput('');
  };

  const renderCatalogSearchControls = () => (
    <div className="catalog-showcase-search-controls catalog-post-category-filters">
      {renderCatalogTextSearch()}
      <div className="catalog-vehicle-location-filters">
        <div className="catalog-showcase-patente-control">
          {activeVehicle ? (
            <div className="catalog-showcase-vehicle-filter">
              <Car size={18} />
              <span><strong>{activeVehicle.marca} {activeVehicle.modelo}</strong>{activeVehicle.patente && activeVehicle.patente !== 'MANUAL' ? ` · ${activeVehicle.patente}` : ''}</span>
              <button type="button" onClick={clearActiveVehicle} title="Quitar filtro de vehículo"><X size={15} /> Quitar filtro</button>
            </div>
          ) : (
            <div className="catalog-quick-patente-bar">
              <CarFront size={18} className="patente-icon" />
              <input type="text" placeholder="Patente (ABCD-12)" aria-label="Ingresa tu patente" value={patentInput} onChange={(e) => { const sanitized = sanitizePlateInput(e.target.value); setPatentInput(sanitized); if (patentError) setPatentError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleUnifiedSearch(patentInput)} className="patente-quick-input" maxLength={8} />
              <button type="button" className="btn-quick-patente-submit" onClick={() => handleUnifiedSearch(patentInput)} disabled={patentSearching}>{patentSearching ? <RefreshCw size={15} className="spin-icon" /> : 'Buscar'}</button>
              {patentError && <span className="quick-patente-error">{patentError}</span>}
            </div>
          )}
        </div>
        {!lockedStoreId && <div className="catalog-showcase-comuna-control">
          <button type="button" className={`btn-comuna-toggle-pill ${filterByMyComuna ? 'active' : ''}`} onClick={handleToggleComunaFilter} disabled={comunaLookupStatus === 'loading'}>
            <MapPin size={17} />
            <span>{comunaLookupStatus === 'loading' ? 'Buscando comuna…' : filterByMyComuna ? `En ${myComunaNombre || 'mi comuna'}` : 'Mi comuna'}</span>
          </button>
          {comunaNotice && <span className="quick-patente-error">{comunaNotice}</span>}
        </div>}
      </div>
    </div>
  );

  return (
    <div className={`parts-catalog-view-wrapper${embedded ? ' is-store-embedded' : ''}`}>
      <div className="container catalog-main-container">
        {embedded ? (
          <section className="catalog-showcase-carousel-wrapper store-catalog-toolbar-wrapper" aria-label="Buscar en esta tienda">
            <div className="catalog-showcase-carousel-header">
              <div>
                <h2>Repuestos de {storeName || 'esta tienda'}</h2>
                <p>Los mismos filtros del catálogo, solo con lo que publica esta tienda: patente, categoría, vehículo, marca, condición, origen y precio.</p>
              </div>
            </div>
            {renderCatalogSearchControls()}
          </section>
        ) : (
        <section className={`catalog-showcase-carousel-wrapper ${appliedFilterLabel ? 'has-category' : ''} ${isPickingCategory ? 'is-picking' : ''}`} aria-label="Explora por categorías">
            <div className="catalog-showcase-carousel-header">
              <div>
                <h2>¿Qué repuesto necesitas?</h2>
                <p>Ingresa tu patente para ver solo lo compatible con tu vehículo, o elige una categoría para empezar a filtrar.</p>
              </div>
            </div>
            <div className="category-showcase-carousel">
              <div className="category-carousel-viewport" role="region" aria-label="Categorías de repuestos; desliza para ver todas" tabIndex={0}>
                <div className="category-carousel-track">
                  {CAROUSEL_CATEGORIES.map((category) => {
                    const isSelected = selectedCategory === category.id || selectedCategory === category.nombre;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`category-catalog-card ${isSelected ? 'active-selected' : ''}`}
                        data-category={category.id}
                        onClick={() => selectCarouselCategory(category)}
                      >
                        <div className="category-showcase-image">
                          <img src={category.image} alt="" />
                        </div>
                        <strong>{category.nombre}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {renderCatalogSearchControls()}
        </section>
        )}

        {!hasActiveContext && !showcaseLoading && showcase.items.length > 0 && (
          <div className="catalog-mobile-showcase-heading">
            <h2>Recién publicados</h2>
            <p>Una muestra del catálogo. Filtra por categoría, patente o busca por nombre para ver el resto.</p>
          </div>
        )}
        <div ref={mobileActionsRef} className={`catalog-mobile-actions-row ${mobileActionsStuck ? 'is-stuck' : ''}`}>
          {renderCatalogTextSearch('Buscar repuestos')}
          <button type="button" className="catalog-mobile-filter-trigger" onClick={() => setMobileFiltersOpen(true)} aria-controls="catalog-filter-panel" aria-expanded={mobileFiltersOpen}><SlidersHorizontal size={18} /> Filtro{activeAdvancedCount > 0 && <span className="catalog-mobile-filter-count" aria-label={`${activeAdvancedCount} filtros aplicados`}>{activeAdvancedCount}</span>}</button>
          <label className="catalog-mobile-sort-trigger" title="Ordenar repuestos">
            <ArrowUpDown size={20} aria-hidden="true" />
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar repuestos">
              <option value="relevancia">Recomendados</option>
              <option value="recientes">Más Recientes</option>
              <option value="precio-asc">Precio: Menor a Mayor</option>
              <option value="precio-desc">Precio: Mayor a Menor</option>
            </select>
          </label>
        </div>

        {/* Como en la app: primero el vehículo, abajo los filtros extra y después los resultados. */}
        {activeVehicle && onlyCompatible && (
          <section className="catalog-applied-card" aria-label={`Vehículo consultado: ${activeVehicle.marca} ${activeVehicle.modelo}`}>
            <div className="catalog-applied-card-header">
              <span className="catalog-applied-card-title"><Car size={16} aria-hidden="true" /> Vehículo consultado</span>
              <div className="catalog-applied-card-actions">
                <button type="button" className="catalog-applied-card-close" onClick={clearActiveVehicle} aria-label="Quitar filtro de vehículo consultado"><X size={18} /></button>
              </div>
            </div>
            <VehicleLine
              parts={[
                [activeVehicle.marca, activeVehicle.modelo, activeVehicle.anio].filter(Boolean).join(' '),
                activeVehicle.version,
                transmisionLabel(activeVehicle.transmision),
                activeVehicle.patente && activeVehicle.patente !== 'MANUAL' ? activeVehicle.patente : '',
              ]}
            />
          </section>
        )}

        {panelVehicleLabel && (
          <section className="catalog-applied-card" aria-label={`Vehículo filtrado: ${panelVehicleLabel}`}>
            <div className="catalog-applied-card-header">
              <span className="catalog-applied-card-title"><Car size={16} aria-hidden="true" /> Vehículo filtrado</span>
              <div className="catalog-applied-card-actions">
                <button type="button" className="catalog-applied-card-close" onClick={clearPanelVehicle} aria-label="Quitar filtro de vehículo"><X size={18} /></button>
                <button type="button" className="catalog-applied-card-change" onClick={() => openFiltersAt('vehicle')} aria-label="Cambiar vehículo filtrado">Cambiar <ChevronRight size={13} aria-hidden="true" /></button>
              </div>
            </div>
            <VehicleLine
              parts={[
                [vehicleBrandName, vehicleModel, vehicleYear].filter(Boolean).join(' '),
                selectedVersionLabels.join(', '),
              ]}
            />
          </section>
        )}

        {appliedAdvancedFilters.length > 0 && (
          <section className="catalog-applied-card" aria-label="Filtros aplicados">
            <div className="catalog-applied-card-header">
              <span className="catalog-applied-card-title"><SlidersHorizontal size={16} aria-hidden="true" /> Filtros aplicados</span>
              <div className="catalog-applied-card-actions">
                {appliedAdvancedFilters.length > 1 && (
                  <button type="button" className="catalog-applied-card-clear" onClick={clearAppliedAdvancedFilters} aria-label="Limpiar todos los filtros">Limpiar</button>
                )}
                <button type="button" className="catalog-applied-card-change" onClick={() => openFiltersAt(null)} aria-label="Cambiar filtros">Cambiar <ChevronRight size={13} aria-hidden="true" /></button>
              </div>
            </div>
            <ul className="catalog-applied-pins-list">
              {appliedAdvancedFilters.map((filter) => (
                <li key={filter.key}>
                  <span className="catalog-applied-pin">
                    <span>{filter.label}</span>
                    <button type="button" onClick={filter.onRemove} aria-label={`Quitar filtro ${filter.label}`}>
                      <X size={13} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 2. Top Control Bar (Summary & Sort). Sin contexto no hay resultados que resumir ni ordenar. */}
        {hasActiveContext && (
          <div className="catalog-control-bar">
            <div className="control-bar-left-group">
              <div className="results-count-badge">
                {activeVehicle && onlyCompatible ? (
                  <span><strong>{totalProducts}</strong> repuestos compatibles con tu <strong>{activeVehicle.marca} {activeVehicle.modelo}</strong></span>
                ) : (
                  <span><strong>{totalProducts}</strong> repuestos encontrados</span>
                )}
              </div>
            </div>

            <div className="control-bar-right-group">
              <div className="sort-dropdown-box">
                <span className="sort-label">Ordenar por:</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select-input">
                  <option value="relevancia">Recomendados</option>
                  <option value="recientes">Más Recientes</option>
                  <option value="precio-asc">Precio: Menor a Mayor</option>
                  <option value="precio-desc">Precio: Mayor a Menor</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {appliedFilterLabel && <div className="catalog-applied-filter-notice">
          <Filter size={15} /><span>Filtro aplicado: <strong>{appliedFilterLabel}</strong></span>
          <button type="button" className="catalog-mobile-category-summary" onClick={() => setIsPickingCategory((open) => !open)} aria-expanded={isPickingCategory}>{isPickingCategory ? 'Ocultar' : 'Cambiar'}</button>
          <button type="button" onClick={clearAppliedCatalogFilter}><X size={14} /> Quitar filtro</button>
        </div>}

        {mobileFiltersOpen && <button type="button" className="catalog-mobile-filter-backdrop" aria-label="Cerrar filtros" onClick={() => setMobileFiltersOpen(false)} />}

        {/* 3. Main 2-Column Content Layout (Technical Sidebar + Parts Grid) */}
        <div className="catalog-content-grid catalog-main-content-grid">
          {/* Sidebar Technical Filters (Left 280px) */}
          <aside id="catalog-filter-panel" className={`catalog-sidebar-filters catalog-advanced-filter-panel ${mobileFiltersOpen ? 'mobile-filters-open' : ''}`} aria-label="Filtros del catálogo">
            <button type="button" className="catalog-mobile-filter-close" onClick={() => setMobileFiltersOpen(false)}><X size={19} /> Cerrar filtros</button>
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

            {/* Filter 0: Modalidad de compra. Un interruptor, no tres opciones: el estado
                neutro es no filtrar, y no necesita una opcion propia que lo diga. */}
            {showQuoteOnlyFilter && <div className="filter-section-group">
              <label className="checkbox-filter-label">
                <input
                  type="checkbox"
                  checked={onlyQuoteOnly}
                  onChange={(e) => setOnlyQuoteOnly(e.target.checked)}
                />
                <span>
                  <strong>Solo a cotizar</strong>
                  <small><ShoppingCart size={12} /> Piezas sin precio publicado, que se cotizan con la tienda.</small>
                </span>
              </label>
            </div>}

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
                {visibleNavigationCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const expanded = expandedCategories[cat.id] || isSelected;
                  return <div className="filter-category-tree" key={cat.id}>
                    <div className={`filter-option-btn ${isSelected ? 'active' : ''}`}>
                      <button type="button" className="filter-category-main-action" onClick={() => { setSelectedCategory(isSelected ? 'TODAS' : cat.id); setSelectedSubcategory('TODAS'); }}>
                        <CategoryIconTile iconName={cat.iconName} color={cat.color} size={9} className="filter-category-icon" />
                        <span className="filter-option-copy"><strong>{cat.nombre}{cat.count != null && <span className="filter-option-count"> ({CATEGORY_COUNT_FORMATTER.format(cat.count)})</span>}</strong></span>
                      </button>
                      <button
                        type="button"
                        className="filter-subcategory-toggle"
                        aria-label={`Mostrar subcategorías de ${cat.nombre}`}
                        onClick={() => {
                          const willExpand = !expandedCategories[cat.id];
                          setExpandedCategories((current) => ({ ...current, [cat.id]: willExpand }));
                          if (willExpand) {
                            setSelectedCategory(cat.id);
                            setSelectedSubcategory('TODAS');
                          }
                        }}
                      >
                        <ChevronDown size={16} className={expanded ? 'is-open' : ''} />
                      </button>
                    </div>
                    {expanded && <div className="filter-subcategory-branch">
                      {cat.subcategories.map((subcategory) => {
                        const isSubSelected = selectedSubcategory === subcategory;
                        return (
                          <button type="button" key={subcategory} className={`filter-subcategory-option ${isSubSelected ? 'active' : ''}`} onClick={() => { setSelectedCategory(cat.id); setSelectedSubcategory(isSubSelected ? 'TODAS' : subcategory); }}>
                            <span className="filter-subcategory-checkbox" aria-hidden="true" />
                            <span className="filter-subcategory-text">
                              {subcategory}
                              {cat.subcategoryCounts?.[subcategory] != null && <span className="filter-option-count"> ({CATEGORY_COUNT_FORMATTER.format(cat.subcategoryCounts[subcategory])})</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>}
                  </div>;
                })}
              </div>}
            </div>

            {/* Filter 4: Compatibilidad de vehículo (marca → modelo → año → versión opcional), para
                quien no tiene la patente a mano. Viajan como compatibilidadMarca/Modelo/Anio/VersionId.
                Cada paso ofrece solo lo que tiene repuestos publicados (`opciones-vehiculo`). */}
            <div className={`filter-section-group ${openFilterSections.vehicle ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('vehicle')} aria-expanded={openFilterSections.vehicle}>
                <span className="filter-group-label"><Car size={13} /> Compatibilidad de Vehículo</span><ChevronDown size={16} />
              </button>
              {openFilterSections.vehicle && <div className="filter-stacked-selects">
                {activeVehicle && onlyCompatible && (
                  <p className="filter-select-note">
                    <Info size={12} /> Filtrando por tu {activeVehicle.marca} {activeVehicle.modelo}. Quítalo arriba para elegir otro a mano.
                  </p>
                )}
                <label className="filter-select-field">
                  <span>Marca</span>
                  <SheetSelect
                    label="Marca del vehículo"
                    searchable
                    placeholder="Todas las marcas"
                    options={vehicleBrandOptions}
                    value={vehicleBrandId}
                    disabled={Boolean(activeVehicle && onlyCompatible)}
                    onChange={(id) => {
                      const matched = vehicleBrandOptions.find((b) => b.value === id);
                      setVehicleBrandId(id);
                      setVehicleBrandName(matched?.label || '');
                      // Cambiar de marca invalida modelo, año y versión: la cascada es de esa marca.
                      setVehicleModel('');
                      setVehicleYear('');
                      setVehicleVersionIds('');
                    }}
                  />
                </label>
                <label className="filter-select-field">
                  <span>Modelo</span>
                  <SheetSelect
                    label="Modelo"
                    searchable
                    placeholder={vehicleBrandId ? 'Todos los modelos' : 'Elige una marca primero'}
                    options={vehicleModelOptions}
                    value={vehicleModel}
                    disabled={!vehicleBrandId || Boolean(activeVehicle && onlyCompatible)}
                    onChange={(model) => {
                      setVehicleModel(model);
                      // Los años y versiones ofrecidos son los del modelo: el elegido puede no existir en el nuevo.
                      setVehicleYear('');
                      setVehicleVersionIds('');
                    }}
                  />
                </label>
                <label className="filter-select-field">
                  <span>Año</span>
                  <SheetSelect
                    label="Año"
                    searchable
                    placeholder={vehicleModel ? 'Cualquier año' : 'Elige un modelo primero'}
                    options={vehicleYearOptions}
                    value={vehicleYear}
                    disabled={(!vehicleModel && !vehicleYear) || Boolean(activeVehicle && onlyCompatible)}
                    onChange={(year) => {
                      setVehicleYear(year);
                      // Las versiones dependen del año: la elegida puede no cubrir el nuevo.
                      setVehicleVersionIds('');
                    }}
                  />
                </label>
                <label className="filter-select-field">
                  <span>Versiones (opcional)</span>
                  <SheetSelect
                    label="Versiones"
                    multiple
                    searchable
                    placeholder={vehicleYear ? 'Todas las versiones' : 'Elige un año primero'}
                    options={vehicleVersionOptions}
                    value={vehicleVersionIds}
                    disabled={vehicleVersionOptions.length === 0 || Boolean(activeVehicle && onlyCompatible)}
                    onChange={setVehicleVersionIds}
                  />
                </label>
              </div>}
            </div>

            {/* Filter 5: Marca del Repuesto (`marcaId`). Es quién fabrica la pieza. */}
            <div className="filter-section-group compact-select-section">
              <label className="filter-group-label"><Wrench size={13} /> Marca del Repuesto</label>
              <SheetSelect
                label="Marca del repuesto"
                searchable
                placeholder={activeCategoryName ? `Todas las de ${activeCategoryName}` : 'Todas las marcas'}
                options={partBrandOptions}
                value={partBrandId}
                onChange={setPartBrandId}
              />
            </div>

            {/* Filter 6: Condición Técnica. Viaja como `condicion`, con el vocabulario
                exacto que valida el backend. */}
            <div className={`filter-section-group ${openFilterSections.condition ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('condition')} aria-expanded={openFilterSections.condition}>
                <span className="filter-group-label"><ShieldCheck size={13} /> Condición Técnica</span><ChevronDown size={16} />
              </button>
              {openFilterSections.condition && <div className="filter-options-list">
                <button
                  className={`filter-option-btn ${selectedCondition === '' ? 'active' : ''}`}
                  onClick={() => setSelectedCondition('')}
                >
                  <span className="filter-choice-dot">{selectedCondition === '' && <CheckCircle2 size={18} />}</span>
                  <span className="filter-option-copy"><strong>Original y Alternativo</strong><small>Todo el catálogo es repuesto nuevo</small></span>
                </button>
                {visibleConditions.map((condition) => (
                  <button
                    key={condition.value}
                    className={`filter-option-btn ${selectedCondition === condition.value ? 'active' : ''}`}
                    onClick={() => setSelectedCondition(selectedCondition === condition.value ? '' : condition.value)}
                  >
                    <span className="filter-choice-dot">{selectedCondition === condition.value && <CheckCircle2 size={18} />}</span>
                    <span className="filter-option-copy"><strong>{condition.label}{condition.count != null && <span className="filter-option-count"> ({CATEGORY_COUNT_FORMATTER.format(condition.count)})</span>}</strong><small>{condition.hint}</small></span>
                  </button>
                ))}
              </div>}
            </div>

            {/* Filter 7: Origen de Fabricación. La lista la sirve el backend (`/origenes`). */}
            <div className="filter-section-group compact-select-section">
              <label className="filter-group-label"><Globe size={13} /> Origen / Fabricación</label>
              <SheetSelect
                label="Origen / Fabricación"
                placeholder="Todos los orígenes"
                options={originOptions}
                value={selectedOrigin}
                onChange={setSelectedOrigin}
              />
            </div>

            {/* Filter 5: Precio Máximo. Viaja como `precioMax` al endpoint. */}
            <div className={`filter-section-group ${openFilterSections.price ? 'is-open' : 'is-collapsed'}`}>
              <button className="filter-group-toggle" type="button" onClick={() => toggleFilterSection('price')} aria-expanded={openFilterSections.price}>
                <span className="filter-group-label"><Tag size={13} /> Rango de Precio</span><ChevronDown size={16} />
              </button>
              {openFilterSections.price && <div className="filter-price-box">
                <label className="filter-price-min">
                  <span>Desde</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={PRICE_CEILING}
                    step={1000}
                    placeholder="$0"
                    value={minPriceDraft}
                    onChange={(e) => setMinPriceDraft(e.target.value)}
                    onBlur={commitMinPrice}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitMinPrice(); }}
                  />
                </label>
                <div className="filter-price-readout">
                  <span>Hasta</span>
                  <strong>{priceDraft >= PRICE_CEILING ? 'Sin tope' : formatCLP(priceDraft)}</strong>
                </div>
                <input
                  type="range"
                  className="filter-price-slider"
                  min={0}
                  max={PRICE_CEILING}
                  step={PRICE_STEP}
                  value={priceDraft}
                  aria-label="Precio máximo"
                  onChange={(e) => setPriceDraft(Number(e.target.value))}
                  onPointerUp={commitPriceDraft}
                  onKeyUp={commitPriceDraft}
                  onBlur={commitPriceDraft}
                />
                <div className="filter-price-scale">
                  <span>$0</span>
                  <span>{formatCLP(PRICE_CEILING)}+</span>
                </div>
                {scopedMinPrice != null && scopedMaxPrice != null && (
                  <small className="filter-search-select-help">
                    {priceRangeLead} hay repuestos entre {formatCLP(scopedMinPrice)} y {formatCLP(scopedMaxPrice)}
                  </small>
                )}
                <div className="filter-price-presets">
                  {visiblePricePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`filter-price-chip ${maxPrice === preset ? 'active' : ''}`}
                      onClick={() => applyPricePreset(preset)}
                    >
                      {formatCLP(preset)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`filter-price-chip ${maxPrice >= PRICE_CEILING ? 'active' : ''}`}
                    onClick={() => applyPricePreset(PRICE_CEILING)}
                  >
                    Sin tope
                  </button>
                </div>
              </div>}
            </div>

            {/* Tienda y Comuna, al final como en la app: desplegables con buscador sobre
                todas las tiendas y comunas del catálogo, para que el panel no crezca. */}
            {!lockedStoreId && <FilterSearchSelect
              label="Tienda"
              icon={<Store size={13} />}
              allLabel="Todas las tiendas"
              options={visibleStoreOptions}
              value={selectedStoreId}
              onChange={setSelectedStoreId}
              searchPlaceholder="Buscar tienda"
              helper={visibleStoreOptions.length
                ? `${visibleStoreOptions.length} ${visibleStoreOptions.length === 1 ? 'tienda' : 'tiendas'} con repuestos ${scopedFilters ? 'para tu vehículo' : 'publicados'}`
                : ''}
            />}
            {/* Dentro de una tienda la comuna es una sola: el filtro no aplica. */}
            {!lockedStoreId && <FilterSearchSelect
              label="Comuna"
              icon={<MapPin size={13} />}
              allLabel="Todas las comunas"
              options={visibleComunaOptions}
              value={selectedComunaId}
              onChange={setSelectedComunaId}
              searchPlaceholder="Buscar comuna"
              helper={visibleComunaOptions.length
                ? `${visibleComunaOptions.length} ${visibleComunaOptions.length === 1 ? 'comuna' : 'comunas'} con tiendas${scopedFilters ? ' que tienen repuestos para tu vehículo' : ''}`
                : ''}
            />}

            {/* Clear All Filters Button */}
            <button className="btn-clear-all-filters-wide" onClick={handleApplyFilters}>
              <Search size={18} />
              <span>Aplicar Filtros y Ver Resultados</span>
            </button>
            <p className="filter-security-note"><ShieldCheck size={14} /> Tus preferencias están seguras con nosotros.</p>
          </aside>

          {/* Parts Cards Column (Right Grid) */}
          <main className="catalog-parts-main">
            {!hasActiveContext ? (
              /* Vitrina acotada: una sola sección. En “Recomendados”, los productos Top
                 ocupan los primeros lugares y el resto sigue el orden del backend. */
              <div className="catalog-showcase-block">
                {showcaseLoading ? (
                  <div className="parts-cards-grid-catalog" aria-busy="true">
                    {Array.from({ length: SHOWCASE_SIZE }).map((_, i) => (
                      <ProductCardSkeleton key={i} />
                    ))}
                  </div>
                ) : showcase.items.length === 0 ? (
                  <div className="directory-empty-state">
                    <Wrench size={56} className="empty-icon-gray" />
                    <h3>Todavía no hay repuestos publicados</h3>
                    <p>Vuelve pronto: las tiendas verificadas están cargando su inventario.</p>
                  </div>
                ) : (
                  <>
                    <div className="catalog-showcase-block-header">
                      <div>
                        <h2>Recién publicados</h2>
                        <p>Una muestra del catálogo. Filtra por categoría, patente o busca por nombre para ver el resto.</p>
                      </div>
                      <div className="sort-dropdown-box catalog-showcase-sort">
                        <span className="sort-label">Ordenar por:</span>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select-input" aria-label="Ordenar recién publicados">
                          <option value="relevancia">Recomendados</option>
                          <option value="recientes">Más recientes</option>
                          <option value="precio-asc">Precio: menor a mayor</option>
                          <option value="precio-desc">Precio: mayor a menor</option>
                        </select>
                      </div>
                    </div>
                    <div className="parts-cards-grid-catalog">
                      {showcase.items.map((prod) => (
                        <MarketplaceProductCard
                          key={prod.id}
                          product={prod}
                          onView={onQuickView}
                          isFavorite={isFavorite(prod.id)}
                          onToggleFavorite={isLoggedIn ? toggleFavorite : undefined}
                        />
                      ))}
                    </div>
                    <div className="catalog-showcase-see-all">
                      <button
                        type="button"
                        className="catalog-showcase-see-all-btn"
                        onClick={() => {
                          setCurrentPage(1);
                          setShowAllProducts(true);
                          requestAnimationFrame(() => document.querySelector('.catalog-parts-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                        }}
                      >
                        <LayoutGrid size={18} aria-hidden="true" />
                        <span>Ver todos los repuestos</span>
                        <ArrowRight size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : productsLoading ? (
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
            ) : displayedProducts.length > 0 ? (
              <>
                <div className="parts-cards-grid-catalog">
                  {displayedProducts.map((prod) => (
                    <MarketplaceProductCard
                      key={prod.id}
                      product={prod}
                      onView={onQuickView}
                      isFavorite={isFavorite(prod.id)}
                      onToggleFavorite={isLoggedIn ? toggleFavorite : undefined}
                    />
                  ))}
                </div>

                {isResultSetTruncated && (
                  <div className="catalog-refine-notice">
                    <Info size={16} />
                    <span>
                      Tu búsqueda tiene <strong>{CATEGORY_COUNT_FORMATTER.format(totalProducts)}</strong> resultados
                      y se pueden recorrer los primeros {CATEGORY_COUNT_FORMATTER.format(MAX_PAGINATED_RESULTS)}.
                      Afina con la categoría, tu patente o el nombre del repuesto para llegar al que buscas.
                    </span>
                  </div>
                )}

                <PaginationBar
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  rangeStart={startIndex}
                  rangeEnd={endIndex}
                  totalItems={totalProducts}
                  itemLabel="repuestos"
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
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
