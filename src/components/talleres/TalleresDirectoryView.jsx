import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Wrench, Plus, Search, RotateCcw, Loader2, WifiOff, AlertTriangle,
  RefreshCw, SlidersHorizontal, X, Car, MapPin, Settings, ArrowUpDown, ArrowRight,
  CheckCircle2, Sparkles, ShieldCheck, Zap
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../data/talleresData';
import { fetchTalleres, getCachedTalleres, TALLERES_UPDATED_EVENT } from '../../services/talleresStorage';
import { searchVehicleByPatenteApi } from '../../services/api';
import { getFaultCategories } from '../../services/faultApi';
import {
  isValidPlate, normalizePlate, lookupVehicleByPlate, formatVehicleLabel, getRecentPlates, addRecentPlate
} from '../../utils/vehicleLookup';
import {
  buildTallerSuggestionIndex, matchTallerSuggestions, tallerMatchesSearch, normalizeSearchText, tallerServiceNames,
  matchingServices
} from '../../utils/tallerSearch';
import { useAuth } from '../../context/AuthContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAppNavigation } from '../../routes/useAppNavigation';
import { useEffectAfterMount, useRestoredState } from '../../routes/useRestoredState';
import { useScrollMemory } from '../../routes/useScrollMemory';
import { useUserLocation } from '../../hooks/useUserLocation';
import { distanceKmTo, sortByDistance } from '../../utils/geoDistance';
import { useSavedMarketplaceItems } from '../../hooks/useSavedMarketplaceItems';
import TallerCard from './TallerCard';
import TalleresSearchBar from './TalleresSearchBar';
import TalleresFiltersSidebar, { ALL_BRANDS, ALL_COMMUNES, ALL_TAGS } from './TalleresFiltersSidebar';
import TalleresFilterModal from './TalleresFilterModal';
import BookingModal from './BookingModal';
import './ads-wall.css';
import './ads-wall-redesign.css';
import './taller-card.css';
// Va DESPUES del rediseño: solo distribucion para <=768px; el escritorio no cambia.
import '../../styles/talleres-mobile.css';
import { canBookTaller } from '../../utils/tallerBooking';

const PAGE_SIZE = 12;
// Filtros y "cargar mas" del buscador, recuperados al volver de un perfil.
const VIEW_ID = 'talleres';

// Sugerencias del campo movil (en escritorio las pinta AdsSearchBar).
const SUGGESTION_META = {
  servicio: { Icon: Search, hint: 'Servicio' },
  taller: { Icon: Search, hint: 'Taller' },
  categoria: { Icon: Settings, hint: 'Categoría' },
  comuna: { Icon: MapPin, hint: 'Comuna' },
};
const SORT_OPTIONS = [
  { value: 'relevancia', label: 'Más relevantes' },
  { value: 'precio-menor', label: 'Precio: menor a mayor' },
  { value: 'precio-mayor', label: 'Precio: mayor a menor' },
  { value: 'recientes', label: 'Más nuevos en RepuesTop' },
];

/**
 * Precio "desde" que importa para ordenar: el del servicio que busca el cliente si el taller lo
 * ofrece, y si no el más bajo de su catálogo. Sin monto (a cotizar) queda al final.
 */
function sortPrice(taller, matchedPrices) {
  const prices = matchedPrices.length > 0 ? matchedPrices : (taller.priceFrom != null ? [taller.priceFrom] : []);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export default function TalleresDirectoryView() {
  const { isLoggedIn, user } = useAuth();
  const { openAuthModal } = useMarketplace();
  const nav = useAppNavigation();
  const { isTallerSaved, toggleTaller } = useSavedMarketplaceItems(user?.userId ?? user?.id);

  const userComuna = (user?.comuna || '').trim();

  // El buscador vive en el backend; localStorage solo guarda la ultima copia para
  // que la grilla no parpadee en vacio mientras responde la red.
  const [talleres, setTalleres] = useState(() => getCachedTalleres());
  // Categorias de servicio con sus subcategorias: completan el filtro aunque ningun taller las ofrezca aun.
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isStale, setIsStale] = useState(false);

  const loadTalleres = useCallback(async ({ signal } = {}) => {
    setIsLoading(true);
    try {
      const { talleres: list, fromCache, error } = await fetchTalleres({ signal });
      setTalleres(list);
      setIsStale(fromCache);
      setLoadError(fromCache ? error : null);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadTalleres({ signal: controller.signal });
    return () => controller.abort();
  }, [loadTalleres]);

  useEffect(() => {
    getFaultCategories().then((items) => setServiceCatalog(Array.isArray(items) ? items : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const handleUpdated = (e) => {
      if (Array.isArray(e.detail)) setTalleres(e.detail);
    };
    window.addEventListener(TALLERES_UPDATED_EVENT, handleUpdated);
    return () => window.removeEventListener(TALLERES_UPDATED_EVENT, handleUpdated);
  }, []);

  // --- Filtros ---
  const [searchInput, setSearchInput] = useRestoredState(VIEW_ID, 'searchInput', '');
  const [searchQuery, setSearchQuery] = useRestoredState(VIEW_ID, 'searchQuery', '');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useRestoredState(VIEW_ID, 'selectedCategory', 'TODAS');
  const [selectedCommune, setSelectedCommune] = useRestoredState(VIEW_ID, 'selectedCommune', ALL_COMMUNES);
  const [selectedServiceTag, setSelectedServiceTag] = useRestoredState(VIEW_ID, 'selectedServiceTag', ALL_TAGS);
  // Filtro por marca especialista del taller (paridad con la app, ads-wall.tsx).
  const [selectedSpecialistBrand, setSelectedSpecialistBrand] = useRestoredState(VIEW_ID, 'selectedSpecialistBrand', ALL_BRANDS);
  const [onlyBooking, setOnlyBooking] = useRestoredState(VIEW_ID, 'onlyBooking', false);
  const [onlyWhatsapp, setOnlyWhatsapp] = useRestoredState(VIEW_ID, 'onlyWhatsapp', false);
  const [only24Hours, setOnly24Hours] = useRestoredState(VIEW_ID, 'only24Hours', false);
  const [onlyHomeService, setOnlyHomeService] = useRestoredState(VIEW_ID, 'onlyHomeService', false);
  const [sortBy, setSortBy] = useRestoredState(VIEW_ID, 'sortBy', 'relevancia');

  const [searchMode, setSearchMode] = useRestoredState(VIEW_ID, 'searchMode', 'service'); // 'service' | 'plate'
  const [plateQuery, setPlateQuery] = useRestoredState(VIEW_ID, 'plateQuery', '');
  const [plateVehicle, setPlateVehicle] = useRestoredState(VIEW_ID, 'plateVehicle', null);
  const [plateError, setPlateError] = useState('');
  const [isPlateSearching, setIsPlateSearching] = useState(false);
  // Con patente: por defecto tambien entran los talleres sin marca declarada (multimarca).
  const [includeMultibrand, setIncludeMultibrand] = useRestoredState(VIEW_ID, 'includeMultibrand', true);
  const [recentPlates, setRecentPlates] = useState(() => getRecentPlates());

  // Modal de filtros: solo celular. En escritorio los filtros viven en la sidebar.
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useRestoredState(VIEW_ID, 'visibleCount', PAGE_SIZE);

  const [selectedTallerForBooking, setSelectedTallerForBooking] = useState(null);

  // El texto se aplica con retardo: mientras se escribe solo se recalculan las
  // sugerencias, no el filtrado completo del mural.
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Al volver al mural no se corre en el montaje: pisaria el "cargar mas" recuperado.
  useEffectAfterMount(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    searchQuery, selectedCategory, selectedCommune, selectedServiceTag,
    onlyBooking, onlyWhatsapp, only24Hours, onlyHomeService, sortBy, plateVehicle, selectedSpecialistBrand,
    includeMultibrand,
  ]);

  // Campo de la fila movil: sus sugerencias se cierran al tocar fuera.
  const mobileSearchBoxRef = useRef(null);
  useEffect(() => {
    const onClickOutside = (e) => {
      if (!mobileSearchBoxRef.current?.contains(e.target)) setIsSearchFocused(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const suggestionIndex = useMemo(() => buildTallerSuggestionIndex(talleres), [talleres]);
  const searchSuggestions = useMemo(
    () => matchTallerSuggestions(suggestionIndex, searchInput),
    [suggestionIndex, searchInput]
  );
  const showSuggestions = isSearchFocused && searchSuggestions.length > 0;

  // "Cerca de mí" con la ubicación real del navegador, igual que el buscador de la app: ordena
  // del taller más cercano al más lejano y muestra la distancia en cada tarjeta. Si el
  // navegador no entrega la ubicación, cae al filtro por la comuna del perfil (lo de antes).
  const userLocation = useUserLocation();
  const [isNearbySortActive, setIsNearbySortActive] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');
  const isComunaNearbyActive = Boolean(userComuna)
    && selectedCommune.toLocaleLowerCase('es') === userComuna.toLocaleLowerCase('es');
  const isNearbyActive = isNearbySortActive || isComunaNearbyActive;
  const isLocating = userLocation.status === 'loading';

  const toggleNearby = async () => {
    if (isNearbySortActive) {
      setIsNearbySortActive(false);
      setLocationNotice('');
      return;
    }
    if (isComunaNearbyActive) {
      setSelectedCommune(ALL_COMMUNES);
      setLocationNotice('');
      return;
    }
    const coords = userLocation.coords || await userLocation.requestLocation();
    if (coords) {
      setIsNearbySortActive(true);
      setLocationNotice('Ordenados del más cercano al más lejano a tu ubicación.');
      return;
    }
    if (userComuna) {
      setSelectedCommune(userComuna);
      setLocationNotice(`No pudimos usar tu ubicación: mostrando talleres en ${userComuna}.`);
      return;
    }
    setLocationNotice('Activa el permiso de ubicación del navegador para ver los talleres más cercanos.');
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setSelectedCategory('TODAS');
    setSelectedCommune(ALL_COMMUNES);
    setIsNearbySortActive(false);
    setLocationNotice('');
    setSelectedServiceTag(ALL_TAGS);
    setSelectedSpecialistBrand(ALL_BRANDS);
    setOnlyBooking(false);
    setOnlyWhatsapp(false);
    setOnly24Hours(false);
    setOnlyHomeService(false);
    setSortBy('relevancia');
    setPlateQuery('');
    setPlateVehicle(null);
    setPlateError('');
    setIncludeMultibrand(true);
    setSearchMode('service');
  };

  // Badge del filtro movil y del modal (sin cambios respecto de antes).
  const mobileFiltersCount =
    (selectedCommune !== ALL_COMMUNES ? 1 : 0) +
    (selectedCategory !== 'TODAS' ? 1 : 0) +
    (selectedServiceTag !== ALL_TAGS ? 1 : 0) +
    (selectedSpecialistBrand !== ALL_BRANDS ? 1 : 0) +
    (onlyBooking ? 1 : 0) +
    (onlyWhatsapp ? 1 : 0) +
    (only24Hours ? 1 : 0) +
    (onlyHomeService ? 1 : 0);

  // Escritorio: habilita "Limpiar" de la sidebar y las pastillas (el texto buscado
  // va aparte: se ve y se borra en la misma barra).
  const activeFiltersCount =
    (plateVehicle ? 1 : 0) +
    (selectedCategory !== 'TODAS' ? 1 : 0) +
    (selectedServiceTag !== ALL_TAGS ? 1 : 0) +
    (selectedSpecialistBrand !== ALL_BRANDS ? 1 : 0) +
    (selectedCommune !== ALL_COMMUNES ? 1 : 0) +
    (isNearbySortActive ? 1 : 0) +
    (only24Hours ? 1 : 0) +
    (onlyHomeService ? 1 : 0) +
    (onlyBooking ? 1 : 0) +
    (onlyWhatsapp ? 1 : 0);

  const handleMyWorkshopClick = () => {
    if (!isLoggedIn) openAuthModal();
    else nav.goProfile('mi_taller');
  };

  const scrollToResults = () => {
    document.getElementById('talleres-results-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectSuggestion = (label) => {
    setSearchInput(label);
    setSearchQuery(label);
    setIsSearchFocused(false);
  };

  // La lupa aplica el texto sin esperar el retardo de escritura.
  const handleSubmitSearch = () => {
    setSearchQuery(searchInput);
    if (searchInput.trim()) scrollToResults();
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  const handleSearchModeChange = (mode) => {
    setSearchMode(mode);
    setPlateError('');
    if (mode === 'plate' && plateVehicle) setPlateQuery(plateVehicle.patente);
  };

  const handleRemoveVehicle = () => {
    setPlateVehicle(null);
    setPlateQuery('');
    setPlateError('');
    setIncludeMultibrand(true);
  };

  // En escritorio (`asChip`), al identificar el vehiculo la barra vuelve a modo
  // servicio con el vehiculo como chip: el texto que se escriba despues busca dentro
  // de los talleres de su marca. En celular sigue la pestaña de patente de siempre.
  const searchByPlate = async ({ plate: rawPlate = plateQuery, asChip = false } = {}) => {
    const plate = normalizePlate(rawPlate);
    if (asChip) setPlateQuery(plate);
    if (!isValidPlate(plate)) {
      if (!asChip) setPlateVehicle(null);
      setPlateError('Ingresa una patente chilena válida. Ej: ABCD12.');
      return;
    }
    setIsPlateSearching(true);
    setPlateError('');
    try {
      const vehicle = await lookupVehicleByPlate(plate, { searchVehicleByPatenteApi });
      if (!vehicle) {
        if (!asChip) setPlateVehicle(null);
        setPlateError('No encontramos un vehículo asociado a esa patente.');
        return;
      }
      setPlateVehicle(vehicle);
      setRecentPlates(addRecentPlate(plate));
      if (asChip) {
        // La marca la fija la patente; un filtro de marca anterior la contradiria.
        setSelectedSpecialistBrand(ALL_BRANDS);
        setSearchMode('service');
        scrollToResults();
      }
    } catch (error) {
      if (!asChip) setPlateVehicle(null);
      setPlateError(error?.message || 'No se pudo consultar la patente. Intenta nuevamente.');
    } finally {
      setIsPlateSearching(false);
    }
  };

  // --- Filtrado y ordenación ---
  // Lo que el cliente busca (texto o servicio elegido): las cards suben y resaltan esos servicios.
  const highlightTerms = useMemo(
    () => [searchQuery.trim(), selectedServiceTag !== ALL_TAGS ? selectedServiceTag : ''].filter(Boolean),
    [searchQuery, selectedServiceTag]
  );

  const filteredTalleres = useMemo(() => {
    let result = [...talleres];

    if (searchQuery.trim()) {
      result = result.filter((taller) => tallerMatchesSearch(taller, searchQuery));
    }
    if (selectedCategory !== 'TODAS') {
      result = result.filter((taller) => taller.categories.includes(selectedCategory));
    }
    if (selectedCommune !== ALL_COMMUNES) {
      result = result.filter((taller) => taller.commune === selectedCommune);
    }
    if (selectedServiceTag !== ALL_TAGS) {
      const target = normalizeSearchText(selectedServiceTag);
      result = result.filter((taller) => tallerServiceNames(taller).some((name) => normalizeSearchText(name) === target));
    }
    if (selectedSpecialistBrand !== ALL_BRANDS) {
      const target = selectedSpecialistBrand.toLowerCase();
      result = result.filter((taller) => taller.specialistBrands.some((b) => b.toLowerCase() === target));
    }
    if (plateVehicle?.marca) {
      const brand = plateVehicle.marca.toLowerCase();
      result = result.filter((taller) =>
        (includeMultibrand && taller.specialistBrands.length === 0)
        || taller.specialistBrands.some((b) => b.toLowerCase() === brand)
      );
    }
    if (onlyBooking) {
      result = result.filter((taller) => canBookTaller(taller));
    }
    if (onlyWhatsapp) {
      result = result.filter((taller) => Boolean(taller.whatsapp));
    }
    if (only24Hours) {
      result = result.filter((taller) => taller.is24Hours);
    }
    // Servicio a domicilio dentro de la comuna del taller.
    if (onlyHomeService) {
      result = result.filter((taller) => taller.homeService === true);
    }

    // Precio del servicio buscado (o el más bajo del catálogo); sin monto, al final.
    const priceOf = (taller) => sortPrice(taller, matchingServices(taller, highlightTerms)
      .map((service) => service.priceFrom).filter((price) => price != null));
    if (sortBy === 'precio-menor' || sortBy === 'precio-mayor') {
      const sign = sortBy === 'precio-menor' ? 1 : -1;
      result.sort((a, b) => {
        const pa = priceOf(a);
        const pb = priceOf(b);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return sign * (pa - pb);
      });
    } else if (sortBy === 'recientes') {
      result.sort((a, b) => new Date(b.memberSince || 0) - new Date(a.memberSince || 0));
    } else {
      // Relevancia: primero los que ofrecen justo lo buscado, luego los que se pueden agendar
      // en línea y los que tienen su catálogo más completo. Nada de esto se paga.
      const score = (taller) => (matchingServices(taller, highlightTerms).length * 10)
        + (canBookTaller(taller) ? 3 : 0)
        + (taller.whatsapp ? 1 : 0)
        + Math.min(taller.services.length, 5) * 0.2;
      result.sort((a, b) => score(b) - score(a)
        || (b.rating || 0) - (a.rating || 0)
        || (b.reviewsCount || 0) - (a.reviewsCount || 0));
    }

    // "Cerca de mí" manda sobre el orden elegido, igual que en la app: pura cercanía real.
    if (isNearbySortActive && userLocation.coords) {
      result = sortByDistance(result, (taller) => distanceKmTo(userLocation.coords, taller));
    }

    return result;
  }, [
    talleres, searchQuery, selectedCategory, selectedCommune, selectedServiceTag, highlightTerms,
    onlyBooking, onlyWhatsapp, only24Hours, onlyHomeService, sortBy, plateVehicle, isNearbySortActive, userLocation.coords,
    selectedSpecialistBrand, includeMultibrand,
  ]);

  // Cada filtro ofrece solo valores con talleres publicados y cuántos hay de cada uno ("(N)"),
  // contados sobre todo el buscador para que no se elija algo sin resultados.
  // Comunas con talleres (el filtro compara exacto con la del taller), mas la
  // elegida si no esta (p. ej. la del perfil al usar "cerca de mi" sin GPS).
  const communeOptions = useMemo(() => {
    const counts = new Map();
    talleres.forEach((taller) => {
      const commune = taller.commune?.trim();
      if (commune) counts.set(commune, (counts.get(commune) || 0) + 1);
    });
    if (selectedCommune !== ALL_COMMUNES && !counts.has(selectedCommune)) counts.set(selectedCommune, 0);
    return Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, 'es'));
  }, [talleres, selectedCommune]);

  // Marcas que declaran los talleres, para el filtro. El filtro compara sin mayúsculas, así que se
  // cuentan igual y cada taller suma una vez por marca.
  const specialistBrandOptions = useMemo(() => {
    const byKey = new Map();
    talleres.forEach((taller) => {
      new Map(taller.specialistBrands.map((brand) => [brand.toLowerCase(), brand]))
        .forEach((brand, key) => {
          const current = byKey.get(key);
          if (current) current.count += 1;
          else byKey.set(key, { value: brand, count: 1 });
        });
    });
    if (selectedSpecialistBrand !== ALL_BRANDS && !byKey.has(selectedSpecialistBrand.toLowerCase())) {
      byKey.set(selectedSpecialistBrand.toLowerCase(), { value: selectedSpecialistBrand, count: 0 });
    }
    return Array.from(byKey.values()).sort((a, b) => a.value.localeCompare(b.value, 'es'));
  }, [talleres, selectedSpecialistBrand]);

  // Especialidades con talleres; la elegida se mantiene aunque quede en cero.
  const categoryCounts = useMemo(() => {
    const counts = {};
    talleres.forEach((taller) => taller.categories.forEach((id) => { counts[id] = (counts[id] || 0) + 1; }));
    return counts;
  }, [talleres]);
  const availableCategories = SERVICE_CATEGORIES.filter((cat) => cat.id !== 'TODAS'
    && (categoryCounts[cat.id] > 0 || selectedCategory === cat.id));

  const visibleTalleres = useMemo(
    () => filteredTalleres.slice(0, visibleCount),
    [filteredTalleres, visibleCount]
  );
  const hasMoreTalleres = filteredTalleres.length > visibleTalleres.length;

  const hasNoTalleresAtAll = !isLoading && talleres.length === 0;
  const showSkeleton = isLoading && talleres.length === 0;
  // Al volver de un perfil, la posicion se reaplica cuando las cards ya estan pintadas.
  useScrollMemory(!showSkeleton);

  // Servicios que ofrecen los talleres (catálogo + etiquetas). El filtro compara normalizado, asi
  // que "Frenos" y "frenos" cuentan como uno; los mas ofrecidos primero.
  const serviceTagOptions = useMemo(() => {
    const byKey = new Map();
    talleres.forEach((taller) => {
      new Map(tallerServiceNames(taller)
        .filter((tag) => typeof tag === 'string' && tag.trim())
        .map((tag) => [normalizeSearchText(tag), tag.trim()]))
        .forEach((tag, key) => {
          const current = byKey.get(key);
          if (current) current.count += 1;
          else byKey.set(key, { value: tag, count: 1 });
        });
    });
    serviceCatalog
      .filter((category) => selectedCategory === 'TODAS' || category.id === selectedCategory)
      .flatMap((category) => category.subcategorias || category.incluye || [])
      .forEach((tag) => {
        const key = normalizeSearchText(tag);
        if (!byKey.has(key)) byKey.set(key, { value: tag, count: 0 });
      });
    if (selectedServiceTag !== ALL_TAGS && !byKey.has(normalizeSearchText(selectedServiceTag))) {
      byKey.set(normalizeSearchText(selectedServiceTag), { value: selectedServiceTag, count: 0 });
    }
    return Array.from(byKey.values())
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'));
  }, [talleres, selectedCategory, selectedServiceTag, serviceCatalog]);

  // Pastillas de filtros activos sobre la grilla: cada una se quita por separado.
  const activeFilterPills = [
    plateVehicle && { key: 'vehicle', label: formatVehicleLabel(plateVehicle), onRemove: handleRemoveVehicle },
    searchQuery.trim() && { key: 'search', label: `"${searchQuery.trim()}"`, onRemove: handleClearSearch },
    selectedCategory !== 'TODAS' && {
      key: 'category',
      label: SERVICE_CATEGORIES.find((cat) => cat.id === selectedCategory)?.label || selectedCategory,
      onRemove: () => setSelectedCategory('TODAS'),
    },
    selectedServiceTag !== ALL_TAGS && { key: 'service', label: selectedServiceTag, onRemove: () => setSelectedServiceTag(ALL_TAGS) },
    selectedSpecialistBrand !== ALL_BRANDS && { key: 'brand', label: selectedSpecialistBrand, onRemove: () => setSelectedSpecialistBrand(ALL_BRANDS) },
    selectedCommune !== ALL_COMMUNES && { key: 'commune', label: selectedCommune, onRemove: () => setSelectedCommune(ALL_COMMUNES) },
    isNearbySortActive && { key: 'nearby', label: 'Cerca de mí', onRemove: toggleNearby },
    only24Hours && { key: '24h', label: '24 horas', onRemove: () => setOnly24Hours(false) },
    onlyHomeService && { key: 'home', label: 'A domicilio', onRemove: () => setOnlyHomeService(false) },
    onlyBooking && { key: 'booking', label: 'Agenda en línea', onRemove: () => setOnlyBooking(false) },
    onlyWhatsapp && { key: 'whatsapp', label: 'WhatsApp', onRemove: () => setOnlyWhatsapp(false) },
  ].filter(Boolean);

  return (
    <main className="ads-wall-page talleres-page">
      <div className="container ads-wall-shell">
        {/* Celular (rediseño del 4-oct): como en repuestos, tabs de busqueda y una sola
            fila con el campo (pin de "cerca de mi" adentro), el filtro avanzado (panel
            lateral) y el orden. La barra de escritorio de abajo se oculta en celular. */}
        <div className="ads-mobile-search">
          <div className="ads-mobile-tabs" role="tablist" aria-label="Tipo de búsqueda">
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'service'}
              className={searchMode === 'service' ? 'active' : ''}
              onClick={() => { setSearchMode('service'); setPlateVehicle(null); setPlateError(''); }}
            >
              <Search size={15} /> Buscar servicio
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'plate'}
              className={searchMode === 'plate' ? 'active' : ''}
              onClick={() => { setSearchMode('plate'); setSearchInput(''); setSearchQuery(''); setIsSearchFocused(false); }}
            >
              <Car size={15} /> Buscar por patente
            </button>
          </div>

          <div className="catalog-mobile-actions-row ads-mobile-actions-row">
            {searchMode === 'service' ? (
              <div className="ads-search-input-wrap ads-mobile-field" ref={mobileSearchBoxRef}>
                <Search size={17} className="ads-search-input-icon" />
                <input
                  type="text"
                  placeholder="Buscar un servicio o un taller: frenos, scanner, pintura..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  aria-label="Buscar servicio"
                />
                {searchInput && (
                  <button
                    type="button"
                    className="ads-search-clear"
                    onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                    aria-label="Limpiar búsqueda"
                  >
                    <X size={15} />
                  </button>
                )}
                <button
                  type="button"
                  className={`ads-nearby-btn ${isNearbyActive ? 'active' : ''}`}
                  onClick={toggleNearby}
                  disabled={isLocating}
                  aria-pressed={isNearbyActive}
                  aria-label={isNearbyActive ? 'Quitar el orden por cercanía' : 'Ver los talleres más cercanos a mi ubicación'}
                >
                  {isLocating ? <RefreshCw size={15} className="spin-icon" /> : <MapPin size={16} />}
                </button>
                {showSuggestions && (
                  <div className="ads-suggestions">
                    {searchSuggestions.map((s) => {
                      const meta = SUGGESTION_META[s.type] || SUGGESTION_META.servicio;
                      const MetaIcon = meta.Icon;
                      return (
                        <button
                          key={`${s.type}-${s.label}`}
                          type="button"
                          className="ads-suggestion-row"
                          onClick={() => handleSelectSuggestion(s.label)}
                        >
                          <MetaIcon size={15} />
                          <span className="ads-suggestion-text">{s.label}</span>
                          <span className="ads-suggestion-hint">{meta.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="ads-search-input-wrap ads-mobile-field ads-mobile-field--plate">
                <Car size={17} className="ads-search-input-icon" />
                <input
                  type="text"
                  placeholder="Patente. Ej: AB·CD·12"
                  value={plateQuery}
                  maxLength={8}
                  aria-label="Patente"
                  onChange={(e) => {
                    setPlateQuery(e.target.value.toUpperCase());
                    setPlateVehicle(null);
                    setPlateError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && searchByPlate()}
                />
                <button
                  type="button"
                  className={`ads-nearby-btn ${isNearbyActive ? 'active' : ''}`}
                  onClick={toggleNearby}
                  disabled={isLocating}
                  aria-pressed={isNearbyActive}
                  aria-label={isNearbyActive ? 'Quitar el orden por cercanía' : 'Ver los talleres más cercanos a mi ubicación'}
                >
                  {isLocating ? <RefreshCw size={15} className="spin-icon" /> : <MapPin size={16} />}
                </button>
                <button
                  type="button"
                  className="ads-mobile-plate-go"
                  onClick={() => searchByPlate()}
                  disabled={isPlateSearching}
                  aria-label="Buscar patente"
                >
                  {isPlateSearching ? <Loader2 size={15} className="spin-icon" /> : <ArrowRight size={16} />}
                </button>
              </div>
            )}
            <button
              type="button"
              className={`catalog-mobile-filter-trigger ${mobileFiltersCount > 0 ? 'is-active' : ''}`}
              onClick={() => setIsFilterOpen(true)}
              aria-label="Abrir filtros avanzados"
            >
              <SlidersHorizontal size={18} />
              {mobileFiltersCount > 0 && <span className="ads-filter-btn-badge">{mobileFiltersCount}</span>}
            </button>
            <label className={`catalog-mobile-sort-trigger ${sortBy !== 'relevancia' ? 'is-active' : ''}`} title="Ordenar talleres">
              <ArrowUpDown size={20} aria-hidden="true" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Ordenar talleres">
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>

          {searchMode === 'plate' && (
            plateVehicle ? (
              <div className="ads-plate-vehicle">
                <CheckCircle2 size={16} />
                <div>
                  <strong>Vehículo identificado</strong>
                  <span>{formatVehicleLabel(plateVehicle)} · {plateVehicle.patente}</span>
                </div>
              </div>
            ) : (
              <p className={`ads-plate-result ${plateError ? 'is-error' : ''}`}>
                {plateError || 'Mostraremos talleres que atienden la marca de tu vehículo, incluidos los multimarca.'}
              </p>
            )
          )}
        </div>

        {/* 1. Escritorio: solo la barra de busqueda (lupa + patente). Los filtros viven
            en la sidebar izquierda, como en el catalogo de repuestos. */}
        <div className="ads-filterbar">
          <TalleresSearchBar
            mode={searchMode}
            onModeChange={handleSearchModeChange}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            onSubmitSearch={handleSubmitSearch}
            onClearSearch={handleClearSearch}
            suggestions={searchSuggestions}
            onSelectSuggestion={handleSelectSuggestion}
            plateQuery={plateQuery}
            onPlateQueryChange={(value) => { setPlateQuery(value); setPlateError(''); }}
            onSubmitPlate={() => searchByPlate({ asChip: true })}
            isPlateSearching={isPlateSearching}
            plateVehicle={plateVehicle}
            onRemoveVehicle={handleRemoveVehicle}
            recentPlates={recentPlates}
            onPickRecentPlate={(plate) => searchByPlate({ plate, asChip: true })}
            isNearbyActive={isNearbyActive}
            isLocating={isLocating}
            onToggleNearby={toggleNearby}
          />
          {searchMode === 'plate' && (
            <p className={`ads-sb-hint ${plateError ? 'is-error' : ''}`} role={plateError ? 'alert' : undefined}>
              {plateError || 'Identificamos la marca de tu vehículo y te mostramos sus talleres especialistas. Después puedes buscar el servicio que necesitas.'}
            </p>
          )}
        </div>
        {locationNotice && (
          <p className={`ads-location-notice ${isNearbySortActive ? 'is-active' : ''}`} role="status">
            <MapPin size={14} /> {locationNotice}
          </p>
        )}
      </div>

      {/* 3. Layout de 2 columnas: sidebar + grilla */}
      <div className="container ads-layout">
        <TalleresFiltersSidebar
          activeFiltersCount={activeFiltersCount}
          onResetFilters={handleResetFilters}
          plateVehicle={plateVehicle}
          includeMultibrand={includeMultibrand}
          setIncludeMultibrand={setIncludeMultibrand}
          onChangePlate={() => {
            handleSearchModeChange('plate');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onRemoveVehicle={handleRemoveVehicle}
          categoryOptions={availableCategories}
          categoryCounts={categoryCounts}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          serviceTagOptions={serviceTagOptions}
          selectedServiceTag={selectedServiceTag}
          setSelectedServiceTag={setSelectedServiceTag}
          specialistBrandOptions={specialistBrandOptions}
          selectedSpecialistBrand={selectedSpecialistBrand}
          setSelectedSpecialistBrand={setSelectedSpecialistBrand}
          communeOptions={communeOptions}
          selectedCommune={selectedCommune}
          setSelectedCommune={setSelectedCommune}
          isNearbyActive={isNearbyActive}
          isLocating={isLocating}
          onToggleNearby={toggleNearby}
          only24Hours={only24Hours}
          setOnly24Hours={setOnly24Hours}
          onlyHomeService={onlyHomeService}
          setOnlyHomeService={setOnlyHomeService}
          onlyBooking={onlyBooking}
          setOnlyBooking={setOnlyBooking}
          onlyWhatsapp={onlyWhatsapp}
          setOnlyWhatsapp={setOnlyWhatsapp}
        >
          <div className="ads-provider-card">
            <div className="ads-provider-glow" aria-hidden="true" />
            <span className="ads-provider-eyebrow"><Sparkles size={13} /> Para talleres</span>
            <h3>Que te encuentren por lo que haces</h3>
            <p>Acredita tu taller y muestra tus servicios con precio desde, tus marcas y tu horario. Los clientes agendan contigo desde tu perfil.</p>

            <button type="button" className="ads-provider-cta" onClick={handleMyWorkshopClick}>
              <Plus size={16} /> {isLoggedIn ? 'Ir a Mi taller' : 'Registra tu taller'}
            </button>

            <div className="ads-provider-trust">
              <span><ShieldCheck size={13} /> Talleres verificados</span>
              <span><Zap size={13} /> Agenda en línea</span>
            </div>
          </div>
        </TalleresFiltersSidebar>

        <section className="ads-main-col">
          <div className="workshop-directory-banner" aria-label="Encuentra el taller ideal para tu vehículo">
            <img src="/workshop-directory-banner.png" alt="Encuentra el taller ideal para tu vehículo: talleres verificados, variedad de servicios y atención en tu zona" />
          </div>
          <div className="ads-main-head" id="talleres-results-top">
            <div className="ads-main-head-text">
              <h2>Talleres y servicios automotrices</h2>
              <p>Compara servicios, precios y horarios, y agenda directo con el taller</p>
            </div>
            <label className="ads-sort-field">
              <ArrowUpDown size={15} />
              <span>Ordenar por:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Ordenar por">
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="ads-results-bar">
            <span className="ads-results-count">
              {isLoading && talleres.length === 0 ? (
                <><Loader2 size={14} className="spin-icon" /> Cargando talleres…</>
              ) : (
                <>
                  Mostrando <strong>{visibleTalleres.length}</strong>
                  {hasMoreTalleres ? <> de <strong>{filteredTalleres.length}</strong></> : null} {filteredTalleres.length === 1 ? 'taller' : 'talleres'}
                </>
              )}
            </span>
            {/* Celular: el boton de siempre. En escritorio lo reemplazan las pastillas. */}
            {(mobileFiltersCount > 0 || searchQuery.trim()) && (
              <button type="button" className="ads-results-clear ads-results-clear--mobile" onClick={handleResetFilters}>
                <RotateCcw size={13} /> Limpiar filtros
              </button>
            )}
          </div>

          {activeFilterPills.length > 0 && (
            <div className="ads-active-pills" aria-label="Filtros activos">
              {activeFilterPills.map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  className={`ads-active-pill ${pill.key === 'vehicle' ? 'is-vehicle' : ''}`}
                  onClick={pill.onRemove}
                  aria-label={`Quitar filtro ${pill.label}`}
                >
                  {pill.key === 'vehicle' && <Car size={13} />}
                  <span>{pill.label}</span>
                  <X size={13} />
                </button>
              ))}
              <button type="button" className="ads-active-pills-clear" onClick={handleResetFilters}>
                <RotateCcw size={13} /> Limpiar todo
              </button>
            </div>
          )}

          {/* Aviso de datos en cache */}
          {isStale && (
            <div className="ads-state-banner ads-state-warning" role="status">
              <WifiOff size={16} />
              <span>No pudimos contactar al servidor. Estás viendo la última copia guardada del buscador.</span>
              <button type="button" className="ads-state-retry" onClick={() => loadTalleres()}>
                <RefreshCw size={14} /> Reintentar
              </button>
            </div>
          )}

          {/* Grilla de talleres / estados */}
          {showSkeleton ? (
            <div className="taller-grid" aria-busy="true">
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="ad-card-skeleton" />)}
            </div>
          ) : loadError && talleres.length === 0 ? (
            <div className="ads-empty-panel">
              <div className="ads-empty-icon ads-empty-icon-danger"><AlertTriangle size={30} /></div>
              <h3>No pudimos cargar los talleres</h3>
              <p>{loadError.message || 'El servicio de talleres no está respondiendo en este momento.'}</p>
              <button type="button" className="btn-post-ad" onClick={() => loadTalleres()}>
                <RefreshCw size={15} /> Reintentar
              </button>
            </div>
          ) : hasNoTalleresAtAll ? (
            <div className="ads-empty-panel">
              <div className="ads-empty-icon"><Wrench size={30} /></div>
              <h3>Todavía no hay talleres publicados</h3>
              <p>
                Los talleres aparecen aquí una vez que RepuesTop acredita su servicio y completan su
                perfil con sus servicios. Registra el tuyo y serás de los primeros.
              </p>
              <button type="button" className="btn-post-ad" onClick={handleMyWorkshopClick}>
                <Plus size={18} /> {isLoggedIn ? 'Ir a Mi taller' : 'Registrar mi taller'}
              </button>
            </div>
          ) : visibleTalleres.length > 0 ? (
            <>
              <div className="taller-grid">
                {visibleTalleres.map((taller) => (
                  <TallerCard
                    key={taller.id}
                    taller={taller}
                    onOpenProfile={(data) => nav.goTaller(data)}
                    onOpenBooking={(data) => setSelectedTallerForBooking(data)}
                    onSelectCategory={(catId) => setSelectedCategory(catId)}
                    isFavorite={isTallerSaved(taller.id)}
                    distanceKm={isNearbySortActive ? distanceKmTo(userLocation.coords, taller) : null}
                    highlightTerms={highlightTerms}
                    plateBrand={plateVehicle?.marca || null}
                    onToggleFavorite={(data) => {
                      if (!isLoggedIn) { openAuthModal(); return; }
                      toggleTaller(data);
                    }}
                    directoryVariant
                  />
                ))}
              </div>

              {hasMoreTalleres && (
                <button
                  type="button"
                  className="ads-load-more"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Cargar más ({filteredTalleres.length - visibleTalleres.length} restantes)
                </button>
              )}
            </>
          ) : (
            <div className="ads-empty-panel">
              <div className="ads-empty-icon"><Search size={30} /></div>
              <h3>No se encontraron talleres con estos filtros</h3>
              <p>
                Intenta ajustar la búsqueda, seleccionar otra comuna o restablecer los filtros
                para ver todos los servicios.
              </p>
              <button type="button" className="ads-state-retry" onClick={handleResetFilters}>
                <RotateCcw size={15} /> Restablecer todos los filtros
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Modales */}
      {selectedTallerForBooking && (
        <BookingModal
          taller={selectedTallerForBooking}
          onClose={() => setSelectedTallerForBooking(null)}
        />
      )}

      <TalleresFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedCommune={selectedCommune}
        setSelectedCommune={setSelectedCommune}
        onlyBooking={onlyBooking}
        setOnlyBooking={setOnlyBooking}
        onlyWhatsapp={onlyWhatsapp}
        setOnlyWhatsapp={setOnlyWhatsapp}
        only24Hours={only24Hours}
        setOnly24Hours={setOnly24Hours}
        onlyHomeService={onlyHomeService}
        setOnlyHomeService={setOnlyHomeService}
        communeOptions={communeOptions}
        categoryOptions={availableCategories}
        categoryCounts={categoryCounts}
        specialistBrandOptions={searchMode === 'service' ? specialistBrandOptions : []}
        selectedSpecialistBrand={selectedSpecialistBrand}
        setSelectedSpecialistBrand={setSelectedSpecialistBrand}
        onResetFilters={handleResetFilters}
        activeFiltersCount={mobileFiltersCount + (searchQuery.trim() ? 1 : 0)}
        totalResults={filteredTalleres.length}
      />
    </main>
  );
}
