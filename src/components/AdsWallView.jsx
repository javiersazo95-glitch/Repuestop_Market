import React, { useState, useMemo, useEffect } from 'react';
import {
  Megaphone, Plus, Sparkles, SlidersHorizontal, Search, RotateCcw,
  CheckCircle2, Star, Calendar, MessageCircle, Info, ChevronRight, ChevronLeft, Layers,
  LayoutDashboard, User
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '../data/automotiveAdsData';
import { getStoredAds, createAdInStorage } from '../services/adsStorage';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import AdsStoriesCarousel from './ads/AdsStoriesCarousel';
import StoriesViewerModal from './ads/StoriesViewerModal';
import AdCard from './ads/AdCard';
import AdsFilterSidebar from './ads/AdsFilterSidebar';
import AdAppointmentModal from './ads/AdAppointmentModal';
import CreateAdModal from './ads/CreateAdModal';
import './ads/ads-wall.css';

export default function AdsWallView() {
  const { isLoggedIn, user } = useAuth();
  const { openAuthModal } = useMarketplace();
  const nav = useAppNavigation();

  // State de los anuncios (sincronizado con localStorage)
  const [adsList, setAdsList] = useState(() => getStoredAds());

  // Escuchar actualizaciones de anuncios
  useEffect(() => {
    const handleAdsUpdated = (e) => {
      if (e.detail) setAdsList(e.detail);
    };
    window.addEventListener('repuestop_ads_updated', handleAdsUpdated);
    return () => window.removeEventListener('repuestop_ads_updated', handleAdsUpdated);
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
  const [selectedCompanyStory, setSelectedCompanyStory] = useState(null);
  const [selectedAdForBooking, setSelectedAdForBooking] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  // Manejo de clic en "Publicar Anuncio"
  const handlePublishAdClick = () => {
    if (!isLoggedIn) {
      openAuthModal();
    } else {
      nav.goProfile('anuncios');
    }
  };

  // Reset de Filtros
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

    // Búsqueda por texto
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

    // Filtro de Categoría
    if (selectedCategory !== 'TODAS') {
      result = result.filter((ad) => ad.category === selectedCategory);
    }

    // Filtro de Tier / Plan
    if (selectedTier !== 'TODOS') {
      result = result.filter((ad) => ad.tier === selectedTier);
    }

    // Filtro de Comuna
    if (selectedCommune !== 'Todas las comunas') {
      result = result.filter((ad) => ad.commune === selectedCommune);
    }

    // Filtro: Solo con Agendamiento
    if (onlyBooking) {
      result = result.filter((ad) => ad.hasOnlineBooking || ad.tier === 'empresarial');
    }

    // Filtro: Solo con WhatsApp
    if (onlyWhatsapp) {
      result = result.filter((ad) => (ad.tier === 'premium' || ad.tier === 'empresarial') && Boolean(ad.whatsapp));
    }

    // Filtro: 24 Horas
    if (only24Hours) {
      result = result.filter((ad) => ad.is24Hours);
    }

    // Ordenación
    if (sortBy === 'precio-menor') {
      result.sort((a, b) => (a.priceValue || 0) - (b.priceValue || 0));
    } else if (sortBy === 'precio-mayor') {
      result.sort((a, b) => (b.priceValue || 0) - (a.priceValue || 0));
    } else if (sortBy === 'recientes') {
      result.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    } else {
      // Relevancia: Empresarial primero, luego Premium, luego Destacada, luego Básica
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

  // Paginación calculada
  const totalResults = filteredAds.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalResults);

  const paginatedAds = useMemo(() => {
    return filteredAds.slice(startIndex, startIndex + pageSize);
  }, [filteredAds, startIndex, pageSize]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    document.getElementById('ads-results-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAdCreated = (newAd) => {
    setAdsList([newAd, ...adsList]);
  };

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

      {/* 2. Carrusel Superior de Historias / Logos de Empresas (Estilo Instagram) */}
      <AdsStoriesCarousel
        onSelectCompanyStory={(story) => setSelectedCompanyStory(story)}
      />

      {/* 3. Contenedor Principal: Filtros a la Izquierda + Grid de Anuncios */}
      <div className="container ads-main-layout">
        
        {/* Barra Lateral de Filtros */}
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
        />

        {/* Sección Central de Anuncios */}
        <section aria-label="Listado de Anuncios Clasificados">
          {/* Barra de control de resultados y orden */}
          <div className="ads-results-bar" id="ads-results-top">
            <div className="ads-results-count">
              Mostrando <strong>{totalResults === 0 ? 0 : `${startIndex + 1}-${endIndex}`}</strong> de <strong>{totalResults}</strong> anuncios disponibles
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

          {/* Grid / Lista de Anuncios Paginados */}
          {paginatedAds.length > 0 ? (
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

              {/* Barra de Paginación */}
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
            /* Estado Vacío */
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center my-6">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                No se encontraron anuncios con estos filtros
              </h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                Intenta ajustar la búsqueda, seleccionar otra comuna o restablecer los filtros para ver todos los servicios.
              </p>
              <button
                type="button"
                className="btn-ad-phone mx-auto inline-flex items-center gap-2"
                onClick={handleResetFilters}
              >
                <RotateCcw size={15} />
                Restablecer todos los filtros
              </button>
            </div>
          )}
        </section>

      </div>

      {/* MODAL 1: Visor de Historias Tipo Instagram */}
      {selectedCompanyStory && (
        <StoriesViewerModal
          companyStory={selectedCompanyStory}
          onClose={() => setSelectedCompanyStory(null)}
          onOpenBooking={(companyData) => setSelectedAdForBooking(companyData)}
        />
      )}

      {/* MODAL 2: Agendamiento de Citas (Para Plan Empresarial) */}
      {selectedAdForBooking && (
        <AdAppointmentModal
          adOrCompany={selectedAdForBooking}
          onClose={() => setSelectedAdForBooking(null)}
        />
      )}

      {/* MODAL 3: Publicar Nuevo Anuncio */}
      <CreateAdModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAdCreated={handleAdCreated}
      />
    </main>
  );
}
