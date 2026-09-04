import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Megaphone, Plus, Search, RotateCcw, Loader2, WifiOff, AlertTriangle,
  RefreshCw, SlidersHorizontal, X, Car, MapPin, Settings, ChevronDown,
  ArrowUpDown, ShieldCheck, Zap, Star, CheckCircle2
} from 'lucide-react';
import { AD_TIERS, SERVICE_CATEGORIES, CHILE_COMMUNES } from '../data/automotiveAdsData';
import { fetchPublicAds, getCachedWallAds, ADS_WALL_UPDATED_EVENT } from '../services/adsStorage';
import { searchVehicleByPatenteApi } from '../services/api';
import {
  isValidPlate, normalizePlate, lookupVehicleByPlate, formatVehicleLabel
} from '../utils/vehicleLookup';
import {
  buildAdSuggestionIndex, matchAdSuggestions, adMatchesSearch, normalizeSearchText
} from '../utils/adSearch';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useSavedMarketplaceItems } from '../hooks/useSavedMarketplaceItems';
import { getCategoryIcon } from './ads/categoryIcons';
import AdsStoriesCarousel from './ads/AdsStoriesCarousel';
import StoriesViewerModal from './ads/StoriesViewerModal';
import AdCard from './ads/AdCard';
import AdsFilterModal from './ads/AdsFilterModal';
import AdAppointmentModal from './ads/AdAppointmentModal';
import './ads/ads-wall.css';
import './ads/ads-wall-redesign.css';

const PAGE_SIZE = 12;
const ALL_TAGS = 'Todos los servicios';

const SUGGESTION_META = {
  servicio: { Icon: Search, hint: 'Servicio' },
  taller: { Icon: Search, hint: 'Taller' },
  categoria: { Icon: Settings, hint: 'Categoría' },
  comuna: { Icon: MapPin, hint: 'Comuna' },
};

const SORT_OPTIONS = [
  { value: 'relevancia', label: 'Más relevantes' },
  { value: 'recientes', label: 'Más recientes' },
  { value: 'precio-menor', label: 'Precio: menor a mayor' },
  { value: 'precio-mayor', label: 'Precio: mayor a menor' },
];

// Motivos para elegir RepuesTop (bloque estático del sidebar).
const WHY_REPUESTOP = [
  { Icon: Megaphone, title: 'Publica gratis', sub: 'Sin comisiones ni costos ocultos.' },
  { Icon: ShieldCheck, title: 'Servicios verificados', sub: 'Los proveedores pasan por un proceso de verificación.' },
  { Icon: Zap, title: 'Atención rápida', sub: 'Responde y agenda en minutos.' },
];

export default function AdsWallView() {
  const { isLoggedIn, user } = useAuth();
  const { openAuthModal } = useMarketplace();
  const nav = useAppNavigation();
  const { isAdSaved, toggleAd } = useSavedMarketplaceItems(user?.userId ?? user?.id);

  const userComuna = (user?.comuna || '').trim();

  // El mural vive en el backend; localStorage solo guarda la ultima copia para
  // que la grilla no parpadee en vacio mientras responde la red.
  const [adsList, setAdsList] = useState(() => getCachedWallAds());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isStale, setIsStale] = useState(false);

  const loadAds = useCallback(async ({ signal } = {}) => {
    setIsLoading(true);
    try {
      const { ads, fromCache, error } = await fetchPublicAds({ signal });
      setAdsList(ads);
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
    loadAds({ signal: controller.signal });
    return () => controller.abort();
  }, [loadAds]);

  useEffect(() => {
    const handleAdsUpdated = (e) => {
      if (Array.isArray(e.detail)) setAdsList(e.detail);
    };
    window.addEventListener(ADS_WALL_UPDATED_EVENT, handleAdsUpdated);
    return () => window.removeEventListener(ADS_WALL_UPDATED_EVENT, handleAdsUpdated);
  }, []);

  // --- Filtros ---
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [selectedTier, setSelectedTier] = useState('TODOS');
  const [selectedCommune, setSelectedCommune] = useState('Todas las comunas');
  const [selectedServiceTag, setSelectedServiceTag] = useState(ALL_TAGS);
  const [onlyBooking, setOnlyBooking] = useState(false);
  const [onlyWhatsapp, setOnlyWhatsapp] = useState(false);
  const [only24Hours, setOnly24Hours] = useState(false);
  const [sortBy, setSortBy] = useState('relevancia');

  const [searchMode, setSearchMode] = useState('service'); // 'service' | 'plate'
  const [plateQuery, setPlateQuery] = useState('');
  const [plateVehicle, setPlateVehicle] = useState(null);
  const [plateError, setPlateError] = useState('');
  const [isPlateSearching, setIsPlateSearching] = useState(false);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedAdForStories, setSelectedAdForStories] = useState(null);
  const [selectedAdForBooking, setSelectedAdForBooking] = useState(null);

  const searchBoxRef = useRef(null);

  // El texto se aplica con retardo: mientras se escribe solo se recalculan las
  // sugerencias, no el filtrado completo del mural.
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    searchQuery, selectedCategory, selectedTier, selectedCommune, selectedServiceTag,
    onlyBooking, onlyWhatsapp, only24Hours, sortBy, plateVehicle
  ]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const suggestionIndex = useMemo(() => buildAdSuggestionIndex(adsList), [adsList]);
  const searchSuggestions = useMemo(
    () => matchAdSuggestions(suggestionIndex, searchInput),
    [suggestionIndex, searchInput]
  );
  const showSuggestions = isSearchFocused && searchSuggestions.length > 0;

  const isNearbyActive = Boolean(userComuna)
    && selectedCommune.toLocaleLowerCase('es') === userComuna.toLocaleLowerCase('es');

  const toggleNearby = () => {
    if (!userComuna) return;
    setSelectedCommune((current) =>
      current.toLocaleLowerCase('es') === userComuna.toLocaleLowerCase('es')
        ? 'Todas las comunas'
        : userComuna
    );
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setSelectedCategory('TODAS');
    setSelectedTier('TODOS');
    setSelectedCommune('Todas las comunas');
    setSelectedServiceTag(ALL_TAGS);
    setOnlyBooking(false);
    setOnlyWhatsapp(false);
    setOnly24Hours(false);
    setSortBy('relevancia');
    setPlateQuery('');
    setPlateVehicle(null);
    setPlateError('');
  };

  const quickFiltersCount =
    (selectedCommune !== 'Todas las comunas' ? 1 : 0) +
    (selectedCategory !== 'TODAS' ? 1 : 0) +
    (selectedServiceTag !== ALL_TAGS ? 1 : 0);

  const advancedFiltersCount =
    (selectedTier !== 'TODOS' ? 1 : 0) +
    (onlyBooking ? 1 : 0) +
    (onlyWhatsapp ? 1 : 0) +
    (only24Hours ? 1 : 0);

  const activeFiltersCount = quickFiltersCount + advancedFiltersCount;

  const handlePublishAdClick = () => {
    if (!isLoggedIn) openAuthModal();
    else nav.goProfile('anuncios');
  };

  const scrollToResults = () => {
    document.getElementById('ads-results-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectSuggestion = (label) => {
    setSearchInput(label);
    setSearchQuery(label);
    setIsSearchFocused(false);
  };

  const handleSelectCategory = (catId) => {
    setSelectedCategory(catId);
    scrollToResults();
  };

  const searchByPlate = async () => {
    const plate = normalizePlate(plateQuery);
    if (!isValidPlate(plate)) {
      setPlateVehicle(null);
      setPlateError('Ingresa una patente chilena válida. Ej: ABCD12.');
      return;
    }
    setIsPlateSearching(true);
    setPlateError('');
    try {
      const vehicle = await lookupVehicleByPlate(plate, { searchVehicleByPatenteApi });
      if (!vehicle) {
        setPlateVehicle(null);
        setPlateError('No encontramos un vehículo asociado a esa patente.');
        return;
      }
      setPlateVehicle(vehicle);
    } catch (error) {
      setPlateVehicle(null);
      setPlateError(error?.message || 'No se pudo consultar la patente. Intenta nuevamente.');
    } finally {
      setIsPlateSearching(false);
    }
  };

  // --- Filtrado y ordenación ---
  const filteredAds = useMemo(() => {
    let result = [...adsList];

    if (searchQuery.trim()) {
      result = result.filter((ad) => adMatchesSearch(ad, searchQuery));
    }
    if (selectedCategory !== 'TODAS') {
      result = result.filter((ad) => ad.category === selectedCategory);
    }
    if (selectedTier !== 'TODOS') {
      result = result.filter((ad) => ad.tier === selectedTier);
    }
    if (selectedCommune !== 'Todas las comunas') {
      result = result.filter((ad) => ad.commune === selectedCommune);
    }
    if (selectedServiceTag !== ALL_TAGS) {
      const target = normalizeSearchText(selectedServiceTag);
      result = result.filter((ad) =>
        [...(ad.features || []), ...(ad.servicesOffered || [])]
          .some((tag) => normalizeSearchText(tag) === target)
      );
    }
    if (plateVehicle?.marca) {
      const brand = plateVehicle.marca.toLowerCase();
      result = result.filter((ad) =>
        !ad.specialistBrands?.length
        || ad.specialistBrands.some((b) => b.toLowerCase() === brand)
      );
    }
    if (onlyBooking) {
      result = result.filter((ad) => AD_TIERS[ad.tier]?.hasBooking && ad.hasOnlineBooking);
    }
    if (onlyWhatsapp) {
      result = result.filter((ad) => AD_TIERS[ad.tier]?.hasWhatsapp && Boolean(ad.whatsapp));
    }
    if (only24Hours) {
      result = result.filter((ad) => ad.is24Hours);
    }

    if (sortBy === 'precio-menor') {
      result.sort((a, b) => (a.priceValue || 0) - (b.priceValue || 0));
    } else if (sortBy === 'precio-mayor') {
      result.sort((a, b) => (b.priceValue || 0) - (a.priceValue || 0));
    } else if (sortBy === 'recientes') {
      result.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    } else {
      const tierWeight = { empresarial: 4, premium: 3, destacada: 2, basica: 1 };
      result.sort((a, b) => (tierWeight[b.tier] || 0) - (tierWeight[a.tier] || 0));
    }

    return result;
  }, [
    adsList, searchQuery, selectedCategory, selectedTier, selectedCommune, selectedServiceTag,
    onlyBooking, onlyWhatsapp, only24Hours, sortBy, plateVehicle
  ]);

  const visibleAds = useMemo(
    () => filteredAds.slice(0, visibleCount),
    [filteredAds, visibleCount]
  );
  const hasMoreAds = filteredAds.length > visibleAds.length;

  const hasNoAdsAtAll = !isLoading && adsList.length === 0;
  const showSkeleton = isLoading && adsList.length === 0;

  const sidebarCategories = [
    { id: 'TODAS', label: 'Todas las categorías' },
    ...SERVICE_CATEGORIES.filter((cat) => cat.id !== 'TODAS'),
  ];

  return (
    <main className="ads-wall-page">
      <div className="container ads-wall-shell">
        {/* 1. Barra de filtros (equivalente a la fila de filtros del marketplace) */}
        <div className="ads-filterbar">
          <div className="ads-search-input-wrap ads-fb-search" ref={searchBoxRef}>
            <Search size={17} className="ads-search-input-icon" />
            <input
              type="text"
              placeholder="¿Qué servicio o repuesto necesitas?"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
            />
            {userComuna && (
              <button
                type="button"
                className={`ads-nearby-btn ${isNearbyActive ? 'active' : ''}`}
                onClick={toggleNearby}
                title={isNearbyActive ? `Quitar filtro de ${userComuna}` : `Filtrar por mi comuna: ${userComuna}`}
              >
                <MapPin size={16} />
              </button>
            )}
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

          <div className="ads-fb-chips">
            <label className="ads-fb-chip">
              <MapPin size={17} />
              <span className="ads-fb-chip-body">
                <em>Ubicación</em>
                <select
                  value={selectedCommune}
                  onChange={(e) => setSelectedCommune(e.target.value)}
                  aria-label="Ubicación"
                >
                  {CHILE_COMMUNES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </span>
              <ChevronDown size={15} className="ads-fb-chip-caret" />
            </label>

            <label className="ads-fb-chip">
              <Settings size={17} />
              <span className="ads-fb-chip-body">
                <em>Categoría</em>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Categoría"
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.id === 'TODAS' ? 'Todas las categorías' : cat.label}
                    </option>
                  ))}
                </select>
              </span>
              <ChevronDown size={15} className="ads-fb-chip-caret" />
            </label>

            <button
              type="button"
              className={`ads-fb-toggle ${only24Hours ? 'active' : ''}`}
              aria-pressed={only24Hours}
              onClick={() => setOnly24Hours((v) => !v)}
            >
              <Zap size={15} /> <span>Urgente</span>
            </button>

            <button
              type="button"
              className={`ads-fb-toggle ${sortBy === 'relevancia' ? 'active' : ''}`}
              aria-pressed={sortBy === 'relevancia'}
              onClick={() => setSortBy((s) => (s === 'relevancia' ? 'recientes' : 'relevancia'))}
            >
              <Star size={15} /> <span>Mejor valorados</span>
            </button>

            <button
              type="button"
              className={`ads-fb-toggle ${advancedFiltersCount > 0 ? 'active' : ''}`}
              onClick={() => setIsFilterOpen(true)}
            >
              <SlidersHorizontal size={15} />
              <span>Más filtros</span>
              {advancedFiltersCount > 0 && (
                <span className="ads-filter-btn-badge">{advancedFiltersCount}</span>
              )}
            </button>

            <button
              type="button"
              className={`ads-fb-toggle ${searchMode === 'plate' ? 'active' : ''}`}
              aria-pressed={searchMode === 'plate'}
              onClick={() => {
                setSearchMode((mode) => (mode === 'plate' ? 'service' : 'plate'));
                setPlateVehicle(null);
                setPlateError('');
              }}
            >
              <Car size={15} /> <span>Buscar por patente</span>
            </button>
          </div>
        </div>

        {searchMode === 'plate' && (
          <div className="ads-plate-area ads-plate-area--bar">
            <p className="ads-plate-hint">
              Ingresa tu patente y mostraremos talleres que atienden tu marca, incluidos los multimarca.
            </p>
            <div className="ads-plate-row">
              <div className="ads-search-input-wrap">
                <Car size={17} className="ads-search-input-icon" />
                <input
                  type="text"
                  placeholder="Ej: AB·CD·12"
                  value={plateQuery}
                  maxLength={8}
                  onChange={(e) => {
                    setPlateQuery(e.target.value.toUpperCase());
                    setPlateVehicle(null);
                    setPlateError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && searchByPlate()}
                />
              </div>
              <button
                type="button"
                className="ads-plate-btn"
                onClick={searchByPlate}
                disabled={isPlateSearching}
              >
                {isPlateSearching ? <Loader2 size={16} className="spin-icon" /> : 'Buscar'}
              </button>
            </div>
            {plateVehicle && (
              <div className="ads-plate-vehicle">
                <CheckCircle2 size={16} />
                <div>
                  <strong>Vehículo identificado</strong>
                  <span>{formatVehicleLabel(plateVehicle)} · {plateVehicle.patente}</span>
                </div>
              </div>
            )}
            <p className={`ads-plate-result ${plateError ? 'is-error' : ''}`}>
              {plateError
                || (plateVehicle
                  ? 'Mostrando talleres especialistas y servicios multimarca compatibles.'
                  : 'La patente se usa solo para identificar la marca de tu vehículo.')}
            </p>
          </div>
        )}
      </div>

      {/* 2. Carrusel de historias */}
      <AdsStoriesCarousel ads={adsList} onSelectAd={(ad) => setSelectedAdForStories(ad)} />

      {/* 3. Layout de 2 columnas: sidebar + grilla */}
      <div className="container ads-layout">
        <aside className="ads-sidebar">
          <div className="ads-sidebar-block">
            <h3 className="ads-sidebar-title">Categorías</h3>
            <ul className="ads-sidebar-cats">
              {sidebarCategories.map((cat) => {
                const CatIcon = getCategoryIcon(cat.id);
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      className={`ads-sidebar-cat ${selectedCategory === cat.id ? 'active' : ''}`}
                      onClick={() => handleSelectCategory(cat.id)}
                    >
                      <CatIcon size={17} />
                      <span>{cat.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="ads-provider-card">
            <h3>¿Eres Proveedor de Servicios?</h3>
            <p>Únete a RepuesTop y llega a miles de clientes todos los días.</p>
            <button type="button" className="ads-provider-cta" onClick={handlePublishAdClick}>
              <Plus size={16} /> Publica gratis
            </button>
            {isLoggedIn && (
              <button
                type="button"
                className="ads-provider-link"
                onClick={() => nav.goProfile('anuncios')}
              >
                <Megaphone size={14} /> Gestión de Anuncios
              </button>
            )}
          </div>

          <div className="ads-why-block">
            <h3 className="ads-sidebar-title">¿Por qué elegir RepuesTop?</h3>
            <ul className="ads-why-list">
              {WHY_REPUESTOP.map(({ Icon, title, sub }) => (
                <li key={title}>
                  <span className="ads-why-ic"><Icon size={16} /></span>
                  <span className="ads-why-txt">
                    <strong>{title}</strong>
                    <em>{sub}</em>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="ads-main-col">
          <div className="ads-main-head" id="ads-results-top">
            <div className="ads-main-head-text">
              <h2>Servicios automotrices destacados</h2>
              <p>Encuentra expertos cerca de ti</p>
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
              {isLoading && adsList.length === 0 ? (
                <><Loader2 size={14} className="spin-icon" /> Cargando anuncios…</>
              ) : (
                <>
                  Mostrando <strong>{visibleAds.length}</strong>
                  {hasMoreAds ? <> de <strong>{filteredAds.length}</strong></> : null} anuncios disponibles
                </>
              )}
            </span>
            {(activeFiltersCount > 0 || searchQuery.trim()) && (
              <button type="button" className="ads-results-clear" onClick={handleResetFilters}>
                <RotateCcw size={13} /> Limpiar filtros
              </button>
            )}
          </div>

          {/* Aviso de datos en cache */}
          {isStale && (
            <div className="ads-state-banner ads-state-warning" role="status">
              <WifiOff size={16} />
              <span>No pudimos contactar al servidor. Estás viendo la última copia guardada del mural.</span>
              <button type="button" className="ads-state-retry" onClick={() => loadAds()}>
                <RefreshCw size={14} /> Reintentar
              </button>
            </div>
          )}

          {/* Grilla de anuncios / estados */}
          {showSkeleton ? (
            <div className="ads-grid" aria-busy="true">
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="ad-card-skeleton" />)}
            </div>
          ) : loadError && adsList.length === 0 ? (
            <div className="ads-empty-panel">
              <div className="ads-empty-icon ads-empty-icon-danger"><AlertTriangle size={30} /></div>
              <h3>No pudimos cargar el mural</h3>
              <p>{loadError.message || 'El servicio de anuncios no está respondiendo en este momento.'}</p>
              <button type="button" className="btn-post-ad" onClick={() => loadAds()}>
                <RefreshCw size={15} /> Reintentar
              </button>
            </div>
          ) : hasNoAdsAtAll ? (
            <div className="ads-empty-panel">
              <div className="ads-empty-icon"><Megaphone size={30} /></div>
              <h3>Todavía no hay anuncios publicados</h3>
              <p>
                Los anuncios aparecen en el mural una vez que el equipo de moderación los aprueba.
                Publica el tuyo y serás de los primeros en aparecer.
              </p>
              <button type="button" className="btn-post-ad" onClick={handlePublishAdClick}>
                <Plus size={18} /> Publicar Anuncio
              </button>
            </div>
          ) : visibleAds.length > 0 ? (
            <>
              <div className="ads-grid">
                {visibleAds.map((ad) => (
                  <AdCard
                    key={ad.id}
                    ad={ad}
                    onOpenDetail={(adData) => nav.goAdDetail(adData)}
                    onOpenBooking={(adData) => setSelectedAdForBooking(adData)}
                    onSelectCategory={(catId) => setSelectedCategory(catId)}
                    isFavorite={isAdSaved(ad.id)}
                    onToggleFavorite={(adData) => {
                      if (!isLoggedIn) { openAuthModal(); return; }
                      toggleAd(adData);
                    }}
                  />
                ))}
              </div>

              {hasMoreAds && (
                <button
                  type="button"
                  className="ads-load-more"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Cargar más ({filteredAds.length - visibleAds.length} restantes)
                </button>
              )}
            </>
          ) : (
            <div className="ads-empty-panel">
              <div className="ads-empty-icon"><Search size={30} /></div>
              <h3>No se encontraron anuncios con estos filtros</h3>
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
      {selectedAdForStories && (
        <StoriesViewerModal
          ad={selectedAdForStories}
          onClose={() => setSelectedAdForStories(null)}
          onOpenBooking={(adData) => setSelectedAdForBooking(adData)}
        />
      )}

      {selectedAdForBooking && (
        <AdAppointmentModal
          adOrCompany={selectedAdForBooking}
          onClose={() => setSelectedAdForBooking(null)}
        />
      )}

      <AdsFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedTier={selectedTier}
        setSelectedTier={setSelectedTier}
        selectedCommune={selectedCommune}
        setSelectedCommune={setSelectedCommune}
        onlyBooking={onlyBooking}
        setOnlyBooking={setOnlyBooking}
        onlyWhatsapp={onlyWhatsapp}
        setOnlyWhatsapp={setOnlyWhatsapp}
        only24Hours={only24Hours}
        setOnly24Hours={setOnly24Hours}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onResetFilters={handleResetFilters}
        activeFiltersCount={activeFiltersCount + (searchQuery.trim() ? 1 : 0)}
        totalResults={filteredAds.length}
      />
    </main>
  );
}
