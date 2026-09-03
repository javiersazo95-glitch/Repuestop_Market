import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Megaphone, Plus, Search, RotateCcw, Loader2, WifiOff, AlertTriangle,
  RefreshCw, SlidersHorizontal, X, Car, MapPin, Wrench, Building2, Grid3x3,
  CheckCircle2, ShieldCheck, Sparkles, Handshake, TrendingUp, Settings,
  Zap, CircleDot, Truck, SprayCan, Snowflake, KeyRound, ClipboardCheck,
  Bike, Home, Package, LayoutGrid
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
  servicio: { Icon: Wrench, hint: 'Servicio' },
  taller: { Icon: Building2, hint: 'Taller' },
  categoria: { Icon: Grid3x3, hint: 'Categoría' },
  comuna: { Icon: MapPin, hint: 'Comuna' },
};

// Icono por especialidad para la tira de categorías del hero (equivalente web de
// la franja de iconos del arte del banner).
const CATEGORY_ICON = {
  TODAS: LayoutGrid,
  mecanica: Wrench,
  'electricidad-electronica': Zap,
  neumaticos: CircleDot,
  'asistencia-vehicular': Truck,
  'carroceria-pintura': SprayCan,
  'estetica-automotriz': Sparkles,
  climatizacion: Snowflake,
  'cerrajeria-seguridad': KeyRound,
  'servicios-inspeccion': ClipboardCheck,
  motos: Bike,
  'camiones-maquinaria': Truck,
  'compra-venta-arriendo': Car,
  'servicios-domicilio': Home,
  'otros-servicios': Package,
};

const HERO_PERKS = [
  { Icon: Search, title: 'ENCUENTRA', sub: 'rápido y fácil' },
  { Icon: Megaphone, title: 'PUBLICA', sub: 'tu servicio' },
  { Icon: Handshake, title: 'CONECTA', sub: 'con clientes' },
  { Icon: TrendingUp, title: 'HAZ CRECER', sub: 'tu negocio' },
];

export default function AdsWallView() {
  const { isLoggedIn, user } = useAuth();
  const { openAuthModal } = useMarketplace();
  const nav = useAppNavigation();

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

  // Etiquetas de servicio realmente presentes en el mural: alimenta el 3er
  // selector del banner ("Todos los servicios").
  const serviceTagOptions = useMemo(() => {
    const set = new Set();
    for (const ad of adsList) {
      for (const tag of [...(ad.features || []), ...(ad.servicesOffered || [])]) {
        const clean = (tag || '').trim();
        if (clean) set.add(clean);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [adsList]);

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

  return (
    <main className="ads-wall-page">
      {/* 1. Hero del mural: arte del banner reconstruido en HTML + buscador real */}
      <section className="ads-hero">
        <div className="ads-hero-bg" aria-hidden="true">
          <span className="ads-hero-photo" />
          <span className="ads-hero-dots ads-hero-dots--tl" />
          <span className="ads-hero-dots ads-hero-dots--tr" />
          <span className="ads-hero-dots ads-hero-dots--bl" />
          <span className="ads-hero-band" />
          <span className="ads-hero-shape ads-hero-shape--a" />
          <span className="ads-hero-shape ads-hero-shape--b" />
          <span className="ads-hero-arc ads-hero-arc--right" />
          <span className="ads-hero-arc ads-hero-arc--left" />
        </div>

        <div className="container ads-hero-inner">
          <div className="ads-hero-frame">
            <span className="ads-hero-mark" aria-hidden="true" />

            <p className="ads-hero-eyebrow">
              <b className="tick tick-green">///</b>
              <span>TODO LO QUE TU AUTO NECESITA,</span>
              <b className="hl">EN UN SOLO LUGAR</b>
              <b className="tick tick-blue">///</b>
            </p>

            <h1 className="ads-hero-title">
              MURAL DE ANUNCIOS
              <span>AUTOMOTRICES</span>
            </h1>

            <p className="ads-hero-sub">
              Encuentra servicios y soluciones para tu vehículo.<br />
              Publica, <b>conecta</b> y <b>haz crecer</b> tu negocio.
            </p>

            <div className="ads-hero-perks">
              {HERO_PERKS.map(({ Icon, title, sub }) => (
                <div className="ads-hero-perk" key={title}>
                  <span className="ads-hero-perk-ic"><Icon size={20} /></span>
                  <span className="ads-hero-perk-txt">
                    <strong>{title}</strong>
                    <em>{sub}</em>
                  </span>
                </div>
              ))}
            </div>

            {/* Barra de búsqueda: misma composición que el arte del banner */}
            <div className="ads-searchbar">
              <div className="ads-searchbar-row">
                <label className="ads-sb-field">
                  <MapPin size={18} />
                  <select
                    value={selectedCommune}
                    onChange={(e) => setSelectedCommune(e.target.value)}
                    aria-label="Región o comuna"
                  >
                    {CHILE_COMMUNES.map((c) => (
                      <option key={c} value={c}>{c === 'Todas las comunas' ? 'Todas las regiones' : c}</option>
                    ))}
                  </select>
                </label>

                <label className="ads-sb-field">
                  <Settings size={18} />
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
                </label>

                <label className="ads-sb-field">
                  <Car size={18} />
                  <select
                    value={selectedServiceTag}
                    onChange={(e) => setSelectedServiceTag(e.target.value)}
                    aria-label="Servicio"
                  >
                    <option value={ALL_TAGS}>{ALL_TAGS}</option>
                    {serviceTagOptions.map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </label>

                <button type="button" className="ads-sb-submit" onClick={scrollToResults}>
                  <Search size={18} /> <span>Buscar servicios</span>
                </button>
              </div>

              <p className="ads-trust-line">
                <ShieldCheck size={15} />
                <span>Servicios verificados</span>
                <i aria-hidden="true">•</i>
                <span>Contacto directo</span>
                <i aria-hidden="true">•</i>
                <span>Publicaciones destacadas</span>
              </p>
            </div>

            {/* Utilidades: texto libre, filtros avanzados y búsqueda por patente */}
            <div className="ads-hero-utility" ref={searchBoxRef}>
                  <div className="ads-search-input-wrap">
                    <Search size={17} className="ads-search-input-icon" />
                    <input
                      type="text"
                      placeholder="Busca por nombre de taller, servicio o palabra clave…"
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

              <button
                type="button"
                className={`ads-util-btn ${advancedFiltersCount > 0 ? 'active' : ''}`}
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
                className={`ads-util-btn ${searchMode === 'plate' ? 'active' : ''}`}
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

            {searchMode === 'plate' && (
              <div className="ads-plate-area">
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

          <div className="ads-hero-cta">
            <button type="button" className="btn-post-ad" onClick={handlePublishAdClick}>
              <Plus size={18} /> <span>Publicar Anuncio</span>
            </button>
            {isLoggedIn && (
              <button
                type="button"
                className="btn-manage-ads"
                onClick={() => nav.goProfile('anuncios')}
              >
                <Megaphone size={15} /> <span>Gestión de Anuncios</span>
              </button>
            )}
          </div>
        </div>

        {/* Tira de categorías con icono (equivalente a la franja del arte) */}
        <div className="ads-hero-catstrip">
          <div className="container ads-catstrip-track">
            {SERVICE_CATEGORIES.map((cat) => {
              const CatIcon = CATEGORY_ICON[cat.id] || Wrench;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`ads-catstrip-item ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => { setSelectedCategory(cat.id); scrollToResults(); }}
                >
                  <CatIcon size={20} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Carrusel de historias */}
      <AdsStoriesCarousel ads={adsList} onSelectAd={(ad) => setSelectedAdForStories(ad)} />

      <div className="container ads-wall-main">
        {/* 3. Barra de resultados */}
        <div className="ads-results-bar" id="ads-results-top">
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

        {/* 5. Grilla de anuncios / estados */}
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
                  onOpenBooking={(adData) => setSelectedAdForBooking(adData)}
                  onSelectCategory={(catId) => setSelectedCategory(catId)}
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
