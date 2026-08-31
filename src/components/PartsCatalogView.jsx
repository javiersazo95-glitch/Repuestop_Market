import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Search, Filter, SlidersHorizontal, ShieldCheck, MapPin,
  ArrowRight, ArrowLeft, X, CheckCircle2, RotateCcw,
  ChevronLeft, ChevronRight, ChevronDown, ShoppingCart, Car, Wrench, Layers, AlertCircle, Info, Tag, Globe,
  CarFront, RefreshCw
} from 'lucide-react';
import CategoryIconTile from './CategoryIconTile';
import MarketplaceProductCard from './MarketplaceProductCard';
import ProductCardSkeleton from './skeletons/ProductCardSkeleton';
import { qk } from '../services/queryKeys';
import {
  NAVIGATION_CATEGORIES, CAROUSEL_CATEGORIES, HEADER_CATEGORIES
} from '../data/categories';
import {
  getPartCategoriesApi, getPublicProductsApi, getVehicleCatalogPartsApi, searchVehicleByPatenteApi,
  getAddressesApi, getPublicCategoryCountsApi, getPartSubcategoriesApi, getPartBrandsApi,
  getVehicleBrandsApi, getVehicleModelsApi, getPublicPartOriginsApi
} from '../services/api';
import { adaptPage, adaptProduct, adaptCompatibleOffersPage, adaptVehicle } from '../services/adapters';
import { normalizePlate, sanitizePlateInput, isValidPlate } from '../utils/vehicleLookup';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../hooks/useFavorites';

const normalizeNameKey = (value) => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const CAROUSEL_PAGE_SIZE = 6;
const CAROUSEL_PAGE_COUNT = Math.ceil(CAROUSEL_CATEGORIES.length / CAROUSEL_PAGE_SIZE);

/**
 * Cuantos repuestos se muestran en la vitrina de entrada, cuando todavia no hay
 * ningun filtro aplicado. Es una consulta acotada; el catalogo paginado completo
 * NO se consulta hasta que el usuario elige un contexto.
 */
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

/**
 * Años ofrecidos en el filtro de compatibilidad. El backend compara el año contra el rango
 * `anioDesde`/`anioHasta` del producto, asi que basta una lista descendente desde el año
 * actual. Se corta en 1990 porque antes de eso el catalogo de compatibilidades no tiene datos.
 */
const COMPAT_YEARS = Array.from(
  { length: new Date().getFullYear() - 1989 },
  (_, index) => new Date().getFullYear() - index
);

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

export default function PartsCatalogView({
  onBackToStore,
  onQuickView,
  onOpenQuote: _onOpenQuote,
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
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [selectedCategory, setSelectedCategory] = useState(initialCatalogFilter?.category || 'TODAS');
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialCatalogFilter?.subcategory || 'TODAS');
  // Despacho rápido sigue fuera del panel: es el único de los filtros originales que no
  // tiene campo en el backend, así que filtrarlo daría resultados falsos.
  // Compatibilidad de vehículo elegida a mano (para quien no tiene la patente a mano).
  // La marca se guarda con id y nombre: el catálogo de modelos se pide por id, pero el
  // filtro del catálogo público compara por NOMBRE (`compatibilidadMarca`).
  const [vehicleBrandId, setVehicleBrandId] = useState('');
  const [vehicleBrandName, setVehicleBrandName] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  // Marca del repuesto (Bosch, Brembo, Valeo…). Es `marcaId` del endpoint, distinto de
  // la marca del vehículo: una es quién fabrica la pieza y la otra para qué auto sirve.
  const [partBrandId, setPartBrandId] = useState('');
  // Condición técnica y origen de fabricación. Vuelven al panel ahora que el endpoint los
  // acepta como parámetro: antes se filtraban en el cliente sobre la página actual, y además
  // comparaban contra etiquetas ("Nuevo OEM Original") que el dato real nunca tuvo.
  const [selectedCondition, setSelectedCondition] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState('');
  // Modalidad de compra como interruptor: encendido deja SOLO los que se venden a cotizacion.
  // Antes eran tres opciones con un "Todos los Repuestos" que prometia ver el catalogo entero
  // -justo lo que la vitrina evita- y que al tocarlo no cambiaba nada.
  const [onlyQuoteOnly, setOnlyQuoteOnly] = useState(false);
  const [onlyCompatible, setOnlyCompatible] = useState(!!initialActiveVehicle);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(PRICE_CEILING);
  // El deslizador se mueve contra un borrador local y solo se confirma al soltarlo:
  // `maxPrice` viaja al servidor, asi que arrastrarlo dispararia una consulta por pixel.
  const [priceDraft, setPriceDraft] = useState(PRICE_CEILING);
  const [minPriceDraft, setMinPriceDraft] = useState('');
  const [sortBy, setSortBy] = useState('relevancia');
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const [activeCarouselPage, setActiveCarouselPage] = useState(0);

  const moveCategoryCarousel = (direction) => {
    setActiveCarouselPage((page) => (page + direction + CAROUSEL_PAGE_COUNT) % CAROUSEL_PAGE_COUNT);
  };

  const visibleCarouselCategories = Array.from(
    { length: CAROUSEL_PAGE_SIZE },
    (_, index) => CAROUSEL_CATEGORIES[(activeCarouselPage * CAROUSEL_PAGE_SIZE + index) % CAROUSEL_CATEGORIES.length]
  );

  const selectCarouselCategory = (category) => {
    const matchedHeader = HEADER_CATEGORIES.find((h) => h.id === category.id);
    const targetCategory = matchedHeader ? matchedHeader.id : category.nombre;
    setSelectedCategory(targetCategory);
    setSelectedSubcategory('TODAS');
    setCurrentPage(1);
  };

  // "Filtrar por mi comuna": solo repuestos de tiendas ubicadas en la misma
  // comuna registrada en el perfil del usuario logueado (comprador o vendedor).
  const { user, isLoggedIn } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites(user?.userId);
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
        return 'updatedAt,desc';
    }
  }, [sortBy]);

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

  // Conteo real de publicaciones visibles por categoría. Es un GROUP BY agregado
  // (`/inventario/productos/resumen-categorias`), no trae filas de productos.
  const { data: categoryCounts = {} } = useQuery({
    queryKey: qk.categoryCounts(),
    queryFn: async () => {
      try {
        const items = await getPublicCategoryCountsApi();
        const list = Array.isArray(items) ? items : [];
        const byId = {};
        list.forEach((item) => {
          const matched = CAROUSEL_CATEGORIES.find(
            (category) => normalizeNameKey(category.nombre) === normalizeNameKey(item.categoriaNombre)
          );
          if (matched) byId[matched.id] = Number(item.total || 0);
        });
        return byId;
      } catch {
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  // Marcas de vehículo del catálogo real. Antes eran seis nombres escritos a mano, así que
  // un Kia o un Suzuki no se podían filtrar aunque hubiera repuestos publicados para ellos.
  const { data: vehicleBrands = [] } = useQuery({
    queryKey: qk.vehicleBrands(),
    queryFn: async ({ signal }) => {
      const list = await getVehicleBrandsApi({ signal });
      return Array.isArray(list) ? list : [];
    },
    staleTime: 1000 * 60 * 60,
  });

  // Modelos de la marca elegida. Acota el filtro de compatibilidad sin volcar el catálogo
  // completo de modelos, que es enorme.
  const { data: vehicleModels = [] } = useQuery({
    queryKey: qk.vehicleModels(vehicleBrandId),
    queryFn: async () => {
      const list = await getVehicleModelsApi(vehicleBrandId);
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(vehicleBrandId),
    staleTime: 1000 * 60 * 60,
  });

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

  // Tamaño real del catálogo público, sumando el agregado por categoría. Evita pedir un
  // COUNT(*) del listado solo para mostrar un número en la cabecera.
  const totalPublicProducts = useMemo(
    () => Object.values(categoryCounts).reduce((acc, value) => acc + (Number(value) || 0), 0),
    [categoryCounts]
  );

  // Si hay un vehículo activo con catalogoId del backend y el filtro de compatibilidad está encendido,
  // consultamos el motor de cruce relacional /vehiculos-catalogo/{id}/repuestos directamente.
  const isVehicleCatalogSearch = Boolean(onlyCompatible && activeVehicle?.catalogoId);

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

  /**
   * El catálogo paginado NO se consulta sin contexto. Entrar a /repuestos y disparar un
   * scan + COUNT(*) sobre todo el inventario visible es lo que no escala a 20k productos,
   * y además una pared de repuestos sin relación no le sirve a nadie. Sin contexto se
   * muestra la vitrina de entrada (categorías con conteo real + destacados acotados).
   */
  const hasActiveContext = Boolean(
    deferredSearchQuery?.trim()
    || selectedCategory !== 'TODAS'
    || activeCategoryId
    || (onlyCompatible && activeVehicle)
    || activeComunaId
    || onlyQuoteOnly
    || selectedCondition
    || selectedOrigin
    || vehicleBrandName
    || vehicleModel
    || vehicleYear
    || partBrandId
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
          page: currentPage - 1,
          size: itemsPerPage,
          texto: deferredSearchQuery?.trim() || undefined,
          categoriaId: activeCategoryId,
          subcategoriaId: activeSubcategoryId,
          marcaId: partBrandId || undefined,
          condicion: selectedCondition || undefined,
          origen: selectedOrigin || undefined,
          comunaId: activeComunaId,
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
          compatibilidadMarca,
          compatibilidadModelo,
          compatibilidadAnio,
          marcaId: partBrandId || undefined,
          condicion: selectedCondition || undefined,
          origen: selectedOrigin || undefined,
          precioMin: minPrice > 0 ? minPrice : undefined,
          precioMax: maxPrice < PRICE_CEILING ? maxPrice : undefined,
          sort: backendSort,
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
          page: currentPage - 1,
          size: itemsPerPage,
          texto: deferredSearchQuery?.trim() || undefined,
          categoriaId: activeCategoryId,
          subcategoriaId: activeSubcategoryId,
          marcaId: partBrandId || undefined,
          condicion: selectedCondition || undefined,
          origen: selectedOrigin || undefined,
          comunaId: activeComunaId,
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
        compatibilidadMarca,
        compatibilidadModelo,
        compatibilidadAnio,
        marcaId: partBrandId || undefined,
        condicion: selectedCondition || undefined,
        origen: selectedOrigin || undefined,
        precioMin: minPrice > 0 ? minPrice : undefined,
        precioMax: maxPrice < PRICE_CEILING ? maxPrice : undefined,
        soloCotizacion: onlyQuoteOnly ? true : undefined,
        sort: backendSort,
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

  // Vitrina de entrada: una sola página corta de recién publicados. Reemplaza al grid
  // completo mientras no haya contexto, para que /repuestos no se vea vacía.
  const {
    data: showcaseProducts = [],
    isLoading: showcaseLoading,
  } = useQuery({
    queryKey: qk.products({ vitrina: true, size: SHOWCASE_SIZE }),
    enabled: !hasActiveContext,
    staleTime: 1000 * 60 * 5,
    queryFn: async ({ signal }) => {
      const data = await getPublicProductsApi({
        page: 0,
        size: SHOWCASE_SIZE,
        sort: 'createdAt,desc',
        signal,
      });
      return adaptPage(data, adaptProduct).items;
    },
  });

  const products = catalogData.items;
  const totalProducts = catalogData.total;
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
  useEffect(() => {
    setPartBrandId('');
  }, [activeCategoryName]);

  // Reset to page 1 when any filter changes.
  const previousFiltersRef = useRef(null);
  useEffect(() => {
    const signature = JSON.stringify([
      deferredSearchQuery, selectedCategory, selectedSubcategory, vehicleBrandName, vehicleModel,
      vehicleYear, partBrandId, selectedCondition, selectedOrigin, onlyQuoteOnly, onlyCompatible,
      minPrice, maxPrice, sortBy, itemsPerPage
    ]);
    const previous = previousFiltersRef.current;
    previousFiltersRef.current = signature;
    if (previous === null || previous === signature) return;
    setCurrentPage(1);
  }, [
    deferredSearchQuery, selectedCategory, selectedSubcategory, vehicleBrandName, vehicleModel,
    vehicleYear, partBrandId, selectedCondition, selectedOrigin, onlyQuoteOnly, onlyCompatible,
    minPrice, maxPrice, sortBy, itemsPerPage
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
    setVehicleBrandId('');
    setVehicleBrandName('');
    setVehicleModel('');
    setVehicleYear('');
    setPartBrandId('');
    setSelectedCondition('');
    setSelectedOrigin('');
    setOnlyQuoteOnly(false);
    setOnlyCompatible(false);
    setMinPrice(0);
    setMinPriceDraft('');
    setMaxPrice(PRICE_CEILING);
    setPriceDraft(PRICE_CEILING);
    setSortBy('relevancia');
    setCurrentPage(1);
  };

  const handleApplyFilters = () => {
    document.querySelector('.catalog-parts-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const appliedFilterLabel = selectedSubcategory !== 'TODAS'
    ? selectedSubcategory
    : selectedCategory !== 'TODAS'
      ? (NAVIGATION_CATEGORIES.find((category) => category.id === selectedCategory)?.nombre || selectedCategory)
      : null;

  const clearAppliedCatalogFilter = () => {
    setSelectedCategory('TODAS');
    setSelectedSubcategory('TODAS');
  };

  return (
    <div className="parts-catalog-view-wrapper">
      {/* 1. Sleek Compact Catalog Context Bar */}
      <div className="catalog-context-header">
        <div className="container catalog-context-container">
          <div className="catalog-context-left">
            <button className="catalog-breadcrumb-back" onClick={onBackToStore} type="button">
              <ArrowLeft size={16} />
              <span>Volver</span>
            </button>
            <div className="catalog-context-title-group">
              <h1 className="catalog-context-title">
                {searchQuery ? (
                  <>Resultados para <span className="highlight-term">"{searchQuery}"</span></>
                ) : appliedFilterLabel ? (
                  <>Catálogo: <span>{appliedFilterLabel}</span></>
                ) : activeVehicle && onlyCompatible ? (
                  <>Repuestos para <span>{activeVehicle.marca} {activeVehicle.modelo} {activeVehicle.version ? `• ${activeVehicle.version}` : ''}</span></>
                ) : (
                  <>Catálogo General de <span>Repuestos</span></>
                )}
              </h1>
              <span className="catalog-context-counter">
                {activeVehicle && onlyCompatible
                  ? `${totalProducts} repuestos compatibles con tu vehículo y con despacho garantizado`
                  : hasActiveContext
                    ? `${totalProducts} repuestos disponibles en tiendas verificadas de Chile`
                    : `${CATEGORY_COUNT_FORMATTER.format(totalPublicProducts)} repuestos publicados por tiendas verificadas de Chile`}
              </span>
            </div>
          </div>

          <div className="catalog-context-right">
            {activeVehicle ? (
              <div className="catalog-vehicle-badge-active">
                <Car size={18} className="text-blue-500" />
                <div className="vehicle-info-text">
                  <span className="vehicle-title">{activeVehicle.marca} {activeVehicle.modelo}</span>
                  {activeVehicle.patente && activeVehicle.patente !== 'MANUAL' && (
                    <span className="vehicle-plate">{activeVehicle.patente}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={`btn-compat-toggle-pill ${onlyCompatible ? 'active' : ''}`}
                  onClick={() => setOnlyCompatible(!onlyCompatible)}
                  title="Filtrar solo repuestos compatibles con este vehículo"
                >
                  {onlyCompatible ? '✓ Solo compatibles' : 'Filtrar compatibles'}
                </button>
                <button
                  type="button"
                  className="btn-vehicle-clear"
                  onClick={() => { setActiveVehicle(null); setOnlyCompatible(false); }}
                  title="Quitar vehículo"
                  aria-label="Quitar vehículo"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="catalog-quick-patente-bar">
                <CarFront size={18} className="patente-icon" />
                <input
                  type="text"
                  placeholder="Ingresa tu patente (ej: ABCD-12)"
                  value={patentInput}
                  onChange={(e) => {
                    const sanitized = sanitizePlateInput(e.target.value);
                    setPatentInput(sanitized);
                    if (patentError) setPatentError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnifiedSearch(patentInput)}
                  className="patente-quick-input"
                  maxLength={8}
                />
                <button
                  type="button"
                  className="btn-quick-patente-submit"
                  onClick={() => handleUnifiedSearch(patentInput)}
                  disabled={patentSearching}
                >
                  {patentSearching ? <RefreshCw size={15} className="spin-icon" /> : 'Buscar'}
                </button>
                {patentError && <span className="quick-patente-error">{patentError}</span>}
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`btn-comuna-toggle-pill ${filterByMyComuna ? 'active' : ''}`}
                onClick={handleToggleComunaFilter}
                disabled={comunaLookupStatus === 'loading'}
                title="Muestra repuestos de tiendas de tu comuna"
              >
                <MapPin size={17} />
                <span>{filterByMyComuna ? `En ${myComunaNombre || 'mi comuna'}` : 'Mi comuna'}</span>
              </button>
              {comunaNotice && <div className="quick-patente-error">{comunaNotice}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="container catalog-main-container">
        {/* Vitrina de entrada: sin contexto no se lista el catálogo, se ofrece por dónde entrar. */}
        {!hasActiveContext && (
          <section className="catalog-showcase-carousel-wrapper" aria-label="Explora por categorías">
            <div className="catalog-showcase-carousel-header">
              <h2>¿Qué repuesto necesitas?</h2>
              <p>Ingresa tu patente para ver solo lo compatible con tu vehículo, o elige una categoría para empezar a filtrar.</p>
            </div>
            <div className="category-showcase-carousel">
              <button
                type="button"
                className="category-carousel-arrow previous"
                onClick={() => moveCategoryCarousel(-1)}
                aria-label="Ver categorías anteriores"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="category-carousel-viewport">
                <div className="category-carousel-track" key={activeCarouselPage}>
                  {visibleCarouselCategories.map((category, index) => {
                    const isSelected = selectedCategory === category.id || selectedCategory === category.nombre;
                    return (
                      <button
                        key={`${activeCarouselPage}-${category.id}-${index}`}
                        type="button"
                        className={`category-showcase-card ${isSelected ? 'active-selected' : ''}`}
                        data-category={category.id}
                        onClick={() => selectCarouselCategory(category)}
                      >
                        <CategoryIconTile iconName={category.iconName} color={category.color} size={24} className="category-showcase-icon" />
                        <strong>{category.nombre}</strong>
                        <div className="category-showcase-image">
                          <img src={category.image} alt="" />
                        </div>
                        <div className="category-showcase-footer">
                          <span>
                            {typeof categoryCounts[category.id] === 'number'
                              ? `${CATEGORY_COUNT_FORMATTER.format(categoryCounts[category.id])} repuestos`
                              : 'Ver repuestos'}
                          </span>
                          <i style={{ backgroundColor: category.color }}><ArrowRight size={18} /></i>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                className="category-carousel-arrow next"
                onClick={() => moveCategoryCarousel(1)}
                aria-label="Ver siguientes categorías"
              >
                <ArrowRight size={20} />
              </button>
            </div>
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

            {/* Filter 0: Modalidad de compra. Un interruptor, no tres opciones: el estado
                neutro es no filtrar, y no necesita una opcion propia que lo diga. */}
            <div className="filter-section-group">
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
                  const isSelected = selectedCategory === cat.id;
                  const expanded = expandedCategories[cat.id] || isSelected;
                  return <div className="filter-category-tree" key={cat.id}>
                    <div className={`filter-option-btn ${isSelected ? 'active' : ''}`}>
                      <button type="button" className="filter-category-main-action" onClick={() => { setSelectedCategory(isSelected ? 'TODAS' : cat.id); setSelectedSubcategory('TODAS'); }}>
                        <CategoryIconTile iconName={cat.iconName} color={cat.color} size={9} className="filter-category-icon" />
                        <span className="filter-option-copy"><strong>{cat.nombre}</strong></span>
                      </button>
                      <button type="button" className="filter-subcategory-toggle" aria-label={`Mostrar subcategorías de ${cat.nombre}`} onClick={() => setExpandedCategories((current) => ({ ...current, [cat.id]: !current[cat.id] }))}>
                        <ChevronDown size={16} className={expanded ? 'is-open' : ''} />
                      </button>
                    </div>
                    {expanded && <div className="filter-subcategory-branch">
                      {cat.subcategories.map((subcategory) => {
                        const isSubSelected = selectedSubcategory === subcategory;
                        return (
                          <button type="button" key={subcategory} className={`filter-subcategory-option ${isSubSelected ? 'active' : ''}`} onClick={() => { setSelectedCategory(cat.id); setSelectedSubcategory(isSubSelected ? 'TODAS' : subcategory); }}>
                            <span className="filter-subcategory-node" />{subcategory}{isSubSelected && <CheckCircle2 size={15} />}
                          </button>
                        );
                      })}
                    </div>}
                  </div>;
                })}
              </div>}
            </div>

            {/* Filter 4: Compatibilidad de vehículo (marca → modelo → año), para quien no
                tiene la patente a mano. Viajan como compatibilidadMarca/Modelo/Anio. */}
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
                  <select
                    className="sidebar-select-input"
                    value={vehicleBrandId}
                    disabled={Boolean(activeVehicle && onlyCompatible)}
                    onChange={(e) => {
                      const id = e.target.value;
                      const matched = vehicleBrands.find((b) => String(b.id) === id);
                      setVehicleBrandId(id);
                      setVehicleBrandName(matched?.nombre || '');
                      // Cambiar de marca invalida el modelo elegido de la marca anterior.
                      setVehicleModel('');
                    }}
                  >
                    <option value="">Todas las marcas</option>
                    {vehicleBrands.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="filter-select-field">
                  <span>Modelo</span>
                  <select
                    className="sidebar-select-input"
                    value={vehicleModel}
                    disabled={!vehicleBrandId || Boolean(activeVehicle && onlyCompatible)}
                    onChange={(e) => setVehicleModel(e.target.value)}
                  >
                    <option value="">{vehicleBrandId ? 'Todos los modelos' : 'Elige una marca primero'}</option>
                    {vehicleModels.map((model) => (
                      <option key={model.id} value={model.nombre}>{model.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="filter-select-field">
                  <span>Año</span>
                  <select
                    className="sidebar-select-input"
                    value={vehicleYear}
                    disabled={Boolean(activeVehicle && onlyCompatible)}
                    onChange={(e) => setVehicleYear(e.target.value)}
                  >
                    <option value="">Cualquier año</option>
                    {COMPAT_YEARS.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
              </div>}
            </div>

            {/* Filter 5: Marca del Repuesto (`marcaId`). Es quién fabrica la pieza. */}
            <div className="filter-section-group compact-select-section">
              <label className="filter-group-label"><Wrench size={13} /> Marca del Repuesto</label>
              <select
                value={partBrandId}
                onChange={(e) => setPartBrandId(e.target.value)}
                className="sidebar-select-input"
              >
                <option value="">
                  {activeCategoryName ? `Todas las de ${activeCategoryName}` : 'Todas las marcas'}
                </option>
                {partBrands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.nombre}</option>
                ))}
              </select>
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
                {PART_CONDITIONS.map((condition) => (
                  <button
                    key={condition.value}
                    className={`filter-option-btn ${selectedCondition === condition.value ? 'active' : ''}`}
                    onClick={() => setSelectedCondition(selectedCondition === condition.value ? '' : condition.value)}
                  >
                    <span className="filter-choice-dot">{selectedCondition === condition.value && <CheckCircle2 size={18} />}</span>
                    <span className="filter-option-copy"><strong>{condition.label}</strong><small>{condition.hint}</small></span>
                  </button>
                ))}
              </div>}
            </div>

            {/* Filter 7: Origen de Fabricación. La lista la sirve el backend (`/origenes`). */}
            <div className="filter-section-group compact-select-section">
              <label className="filter-group-label"><Globe size={13} /> Origen / Fabricación</label>
              <select
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                className="sidebar-select-input"
              >
                <option value="">Todos los orígenes</option>
                {partOrigins.map((origin) => (
                  <option key={origin} value={origin}>{origin}</option>
                ))}
              </select>
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
                <div className="filter-price-presets">
                  {PRICE_PRESETS.map((preset) => (
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
              /* Vitrina acotada: una sola consulta de 12 recién publicados. El catálogo
                 paginado (y su COUNT sobre todo el inventario) no se pide hasta que hay filtro. */
              <div className="catalog-showcase-block">
                <div className="catalog-showcase-block-header">
                  <h2>Recién publicados</h2>
                  <p>Una muestra del catálogo. Filtra por categoría, patente o busca por nombre para ver el resto.</p>
                </div>
                {showcaseLoading ? (
                  <div className="parts-cards-grid-catalog" aria-busy="true">
                    {Array.from({ length: SHOWCASE_SIZE }).map((_, i) => (
                      <ProductCardSkeleton key={i} />
                    ))}
                  </div>
                ) : showcaseProducts.length > 0 ? (
                  <div className="parts-cards-grid-catalog">
                    {showcaseProducts.map((prod) => (
                      <MarketplaceProductCard
                        key={prod.id}
                        product={prod}
                        onView={onQuickView}
                        isFavorite={isFavorite(prod.id)}
                        onToggleFavorite={isLoggedIn ? toggleFavorite : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="directory-empty-state">
                    <Wrench size={56} className="empty-icon-gray" />
                    <h3>Todavía no hay repuestos publicados</h3>
                    <p>Vuelve pronto: las tiendas verificadas están cargando su inventario.</p>
                  </div>
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

                {/* 4. Pagination Bar */}
                <div className="directory-pagination-bar">
                  <div className="pagination-info">
                    <span>
                      Mostrando del <strong>{startIndex}</strong> al <strong>{endIndex}</strong> de <strong>{totalProducts}</strong> repuestos (Página {currentPage} de {totalPages})
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

                      {totalPages <= 7 ? (
                        Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <button
                            key={pageNum}
                            className={`btn-page-number ${currentPage === pageNum ? 'active' : ''}`}
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </button>
                        ))
                      ) : (
                        (() => {
                          const pages = [];
                          pages.push(1);
                          if (currentPage > 3) pages.push('dots-prev');
                          const start = Math.max(2, currentPage - 1);
                          const end = Math.min(totalPages - 1, currentPage + 1);
                          for (let p = start; p <= end; p++) pages.push(p);
                          if (currentPage < totalPages - 2) pages.push('dots-next');
                          if (totalPages > 1) pages.push(totalPages);

                          return pages.map((item, idx) => {
                            if (typeof item === 'string') {
                              return <span key={`${item}-${idx}`} className="pagination-dots" style={{ padding: '0 6px', color: '#94a3b8' }}>…</span>;
                            }
                            return (
                              <button
                                key={item}
                                className={`btn-page-number ${currentPage === item ? 'active' : ''}`}
                                onClick={() => handlePageChange(item)}
                              >
                                {item}
                              </button>
                            );
                          });
                        })()
                      )}

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
