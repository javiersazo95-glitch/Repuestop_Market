import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../data/automotiveAdsData';

/**
 * Carrusel superior de historias. Se arma con los anuncios reales que tienen
 * `storyImages` (Premium hasta 2, Empresarial hasta 4, segun valida el backend),
 * igual que `mobile/components/ads/AdsStoriesCarousel.tsx`. Si ninguno tiene
 * historias no se renderiza nada, en vez de mostrar empresas de ejemplo.
 */
export default function AdsStoriesCarousel({ ads = [], onSelectAd }) {
  const trackRef = useRef(null);

  const storyAds = ads.filter((ad) => (ad.storyImages?.length || 0) > 0);

  const handleScroll = (direction) => {
    if (!trackRef.current) return;
    const scrollAmount = direction === 'left' ? -260 : 260;
    trackRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  if (storyAds.length === 0) return null;

  return (
    <section className="ads-stories-section" aria-label="Historias y Servicios Destacados">
      <div className="container">
        <div className="ads-stories-header">
          <h2>
            <Sparkles size={16} className="text-amber-500" />
            Servicios y Talleres Más Visibles
          </h2>
          <span className="ads-stories-indicator">
            Historias destacadas • Toca para ver
          </span>
        </div>

        <div className="stories-carousel-wrapper">
          <button
            className="stories-nav-arrow arrow-left"
            onClick={() => handleScroll('left')}
            aria-label="Desplazar historias hacia la izquierda"
            type="button"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="stories-track" ref={trackRef}>
            {storyAds.map((ad) => {
              const categoryObj = SERVICE_CATEGORIES.find((c) => c.id === ad.category);
              const avatar = ad.storyImages[0] || ad.images?.[0];
              return (
                <button
                  key={ad.id}
                  className="story-item-btn"
                  onClick={() => onSelectAd?.(ad)}
                  type="button"
                  title={`Ver historias de ${ad.company}`}
                >
                  <div className="story-ring-container">
                    <img
                      src={avatar}
                      alt={ad.company}
                      className="story-avatar-img"
                      loading="lazy"
                    />
                    {ad.tier === 'empresarial' && (
                      <span className="story-verified-badge" title="Empresa verificada">
                        <CheckCircle2 size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <span className="story-company-name">{ad.company}</span>
                  <span className="story-category-tag">{ad.categoryLabel || categoryObj?.label || ''}</span>
                </button>
              );
            })}
          </div>

          <button
            className="stories-nav-arrow arrow-right"
            onClick={() => handleScroll('right')}
            aria-label="Desplazar historias hacia la derecha"
            type="button"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
