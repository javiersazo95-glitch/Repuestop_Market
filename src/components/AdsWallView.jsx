import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Megaphone, Plus, Search, RotateCcw, ChevronRight, ChevronLeft,
  Loader2, WifiOff, AlertTriangle, RefreshCw
} from 'lucide-react';
import { AD_TIERS } from '../data/automotiveAdsData';
import { fetchPublicAds, getCachedWallAds, ADS_WALL_UPDATED_EVENT } from '../services/adsStorage';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import AdsStoriesCarousel from './ads/AdsStoriesCarousel';
import StoriesViewerModal from './ads/StoriesViewerModal';
import AdCard from './ads/AdCard';
import AdsFilterSidebar from './ads/AdsFilterSidebar';
import AdAppointmentModal from './ads/AdAppointmentModal';
import './ads/ads-wall.css';

export default function AdsWallView() {
  const { isLoggedIn } = useAuth();
  const { openAuthModal } = useMarketplace();
  const nav = useAppNavigation();

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

  // Otra vista pudo refrescar la cache del mural (por ejemplo tras publicar).
  useEffect(() => {
    const handleAdsUpdated = (e) => {
      if (Array.isArray(e.detail)) setAdsList(e.detail);
    };
    window.addEventListener(ADS_WALL_UPDATED_EVENT, handleAdsUpdated);
    return () => window.removeEventListener(ADS_WALL_UPDATED_EVENT, handleAdsUpdated);
  }, []);

  // Estados de filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [selectedTier, setSelectedTier] = useState('TODOS');
  const [selectedCommune, setSelectedCommune] = useState('Todas las comunas');
  const [onlyBooking, setOnlyBooking] = useState(false);
  const [onlyWhatsapp, setOnlyWhatsapp] = useState(false);
  const [only24Hours, setOnly24Hours] = useState(false);
  const [sortBy, setSortBy] = useState('relevancia');

  // Estados de Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Estados de Modales
  const [selectedAdForStories, setSelectedAdForStories] = useState(null);
  const [selectedAdForBooking, setSelectedAdForBooking] = useState(null);

  // Reset de página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    selectedCategory,
    selectedTier,
    selectedCommune,
    onlyBooking,
    onlyWhatsapp,
    only24Hours,
    sortBy,
    pageSize
  ]);

  const handlePublishAdClick = () => {
    if (!isLoggedIn) {
      openAuthModal();
    } else {
      nav.goProfile('anuncios');
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('TODAS');
    setSelectedTier('TODOS');
    setSelectedCommune('Todas las comunas');
    setOnlyBooking(false);
    setOnlyWhatsapp(false);
    setOnly24Hours(false);
    setSortBy('relevancia');
    setCurrentPage(1);
  };

  // Filtrado y ordenación
  const filteredAds = useMemo(() => {
    let result = [...adsList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((ad) =>
        (ad.title && ad.title.toLowerCase().includes(q)) ||
        (ad.company && ad.company.toLowerCase().includes(q)) ||
        (ad.description && ad.description.toLowerCase().includes(q)) ||
        (ad.commune && ad.commune.toLowerCase().includes(q)) ||
        (ad.categoryLabel && ad.categoryLabel.toLowerCase().includes(q))
      );
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

    // Agendamiento real: el plan da el derecho, `hasOnlineBooking` confirma que
    // el taller publicó horarios. Filtrar solo por plan mostraba talleres que no
    // aceptan reservas.
    if (onlyBooking) {
      result = result.filter((ad) => AD_TIERS[ad.tier]?.hasBooking && ad.hasOnlineBooking);
    }

    // WhatsApp lo habilita el plan (Destacada en adelante), no una lista aparte.
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
    adsList,
    searchQuery,
    selectedCategory,
    selectedTier,
    selectedCommune,
    onlyBooking,
    onlyWhatsapp,
    only24Hours,
    sortBy
  ]);

  const totalResults = filteredAds.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalResults);

  const paginatedAds = useMemo(
    () => filteredAds.slice(startIndex, startIndex + pageSize),
    [filteredAds, startIndex, pageSize]
  );

  // Los contadores del sidebar salen de los anuncios cargados: SERVICE_CATEGORIES
  // trae un `count` de ejemplo que quedo obsoleto al leer el mural del backend.
  const categoryCounts = useMemo(() => {
    const counts = { TODAS: adsList.length };
    for (const ad of adsList) {
      counts[ad.category] = (counts[ad.category] || 0) + 1;
    }
    return counts;
  }, [adsList]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    document.getElementById('ads-results-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hasNoAdsAtAll = !isLoading && adsList.length === 0;
  const showSkeleton = isLoading && adsList.length === 0;

  return (
    <main className="ads-wall-page">
      {/* 1. Header / Hero del Mural */}
      <section className="ads-wall-hero">
        <div className="container ads-wall-hero-content">
          <div className="ads-wall-hero-titles">
            <h1>
              <Megaphone size={28} className="text-amber-400" />
              Mural de Anuncios y Servicios Automotrices
            </h1>
            <p>
              Encuentra talleres mecánicos certificados, pintura y desabolladura, scanner multimarca,
              detailing, vulcanización y asistencia en ruta clasificados por categoría.
            </p>
          </div>

          <div className="ads-wall-hero-actions">
            {isLoggedIn && (
              <button
                type="button"
                className="btn-token-history"
                onClick={() => nav.goProfile('anuncios')}
              >
                <Megaphone size={16} />
                <span>Gestión de Anuncios</span>
              </button>
            )}

            <button
              type="button"
              className="btn-post-ad"
              onClick={handlePublishAdClick}
            >
              <Plus size={20} />
              <span>Publicar Anuncio</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Carrusel de historias, armado con los anuncios que tienen fotos de historia */}
      <AdsStoriesCarousel
        ads={adsList}
        onSelectAd={(ad) => setSelectedAdForStories(ad)}
      />

      {/* 3. Contenedor Principal: Filtros a la Izquierda + Grid de Anuncios */}
      <div className="container ads-main-layout">

        <AdsFilterSidebar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
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
          onResetFilters={handleResetFilters}
          totalResults={filteredAds.length}
          categoryCounts={categoryCounts}
        />

        <section aria-label="Listado de Anuncios Clasificados">
          {/* Aviso de datos en cache: lo mostrado puede estar desactualizado */}
          {isStale && (
            <div className="ads-state-banner ads-state-warning" role="status">
              <WifiOff size={16} />
              <span>
                No pudimos contactar al servidor. Estás viendo la última copia guardada del mural.
              </span>
              <button type="button" className="ads-state-retry" onClick={() => loadAds()}>
                <RefreshCw size={14} /> Reintentar
              </button>
            </div>
          )}

          <div className="ads-results-bar" id="ads-results-top">
            <div className="ads-results-count">
              {isLoading ? (
                <span className="ads-results-loading"><Loader2 size={14} className="spin-icon" /> Cargando anuncios…</span>
              ) : (
                <>Mostrando <strong>{totalResults === 0 ? 0 : `${startIndex + 1}-${endIndex}`}</strong> de <strong>{totalResults}</strong> anuncios disponibles</>
              )}
            </div>

            <div className="ads-sort-group">
              <label htmlFor="ads-sort-select">Ordenar por:</label>
              <select
                id="ads-sort-select"
                className="ads-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="relevancia">Relevancia (Planes destacados)</option>
                <option value="recientes">Más recientes</option>
                <option value="precio-menor">Menor precio / tarifa</option>
                <option value="precio-mayor">Mayor precio / tarifa</option>
              </select>
            </div>
          </div>

          {showSkeleton ? (
            <div className="ads-grid" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="ad-card-skeleton" />)}
            </div>
          ) : loadError && adsList.length === 0 ? (
            <div className="ads-empty-panel">
              <div className="ads-empty-icon ads-empty-icon-danger"><AlertTriangle size={30} /></div>
              <h3>No pudimos cargar el mural</h3>
              <p>{loadError.message || 'El servicio de anuncios no está respondiendo en este momento.'}</p>
              <button type="button" className="btn-ad-phone" onClick={() => loadAds()}>
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
          ) : paginatedAds.length > 0 ? (
            <>
              <div className="ads-grid">
                {paginatedAds.map((ad) => (
                  <AdCard
                    key={ad.id}
                    ad={ad}
                    onOpenBooking={(adData) => setSelectedAdForBooking(adData)}
                    onSelectCategory={(catId) => setSelectedCategory(catId)}
                  />
                ))}
              </div>

              <div className="directory-pagination-bar" aria-label="Navegación de páginas de anuncios">
                <div className="pagination-info">
                  Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({totalResults} anuncios en total)
                </div>

                <div className="pagination-controls-group">
                  <div className="per-page-selector">
                    <label htmlFor="ads-per-page-select">Por página:</label>
                    <select
                      id="ads-per-page-select"
                      className="select-per-page"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={4}>4 por pág</option>
                      <option value={6}>6 por pág</option>
                      <option value={10}>10 por pág</option>
                      <option value={20}>20 por pág</option>
                    </select>
                  </div>

                  <div className="page-buttons-list">
                    <button
                      type="button"
                      className="btn-page-nav"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft size={16} />
                      <span>Anterior</span>
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                      .map((page, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showEllipsis = prev && page - prev > 1;
                        return (
                          <React.Fragment key={page}>
                            {showEllipsis && <span className="pagination-dots px-1 text-slate-400">…</span>}
                            <button
                              type="button"
                              className={`btn-page-number ${currentPage === page ? 'active' : ''}`}
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    <button
                      type="button"
                      className="btn-page-nav"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      aria-label="Página siguiente"
                    >
                      <span>Siguiente</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="ads-empty-panel">
              <div className="ads-empty-icon"><Search size={30} /></div>
              <h3>No se encontraron anuncios con estos filtros</h3>
              <p>
                Intenta ajustar la búsqueda, seleccionar otra comuna o restablecer los filtros
                para ver todos los servicios.
              </p>
              <button type="button" className="btn-ad-phone" onClick={handleResetFilters}>
                <RotateCcw size={15} /> Restablecer todos los filtros
              </button>
            </div>
          )}
        </section>

      </div>

      {/* MODAL 1: Visor de Historias */}
      {selectedAdForStories && (
        <StoriesViewerModal
          ad={selectedAdForStories}
          onClose={() => setSelectedAdForStories(null)}
          onOpenBooking={(adData) => setSelectedAdForBooking(adData)}
        />
      )}

      {/* MODAL 2: Agendamiento de Citas (Plan Empresarial con agenda publicada) */}
      {selectedAdForBooking && (
        <AdAppointmentModal
          adOrCompany={selectedAdForBooking}
          onClose={() => setSelectedAdForBooking(null)}
        />
      )}
    </main>
  );
}
