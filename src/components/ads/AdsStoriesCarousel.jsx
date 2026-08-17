import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { COMPANY_STORIES } from '../../data/automotiveAdsData';

export default function AdsStoriesCarousel({ onSelectCompanyStory }) {
  const trackRef = useRef(null);

  const handleScroll = (direction) => {
    if (!trackRef.current) return;
    const scrollAmount = direction === 'left' ? -260 : 260;
    trackRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

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
            {COMPANY_STORIES.map((company) => (
              <button
                key={company.id}
                className="story-item-btn"
                onClick={() => onSelectCompanyStory?.(company)}
                type="button"
                title={`Ver historias de ${company.companyName}`}
              >
                <div className="story-ring-container">
                  <img
                    src={company.logo}
                    alt={company.companyName}
                    className="story-avatar-img"
                    loading="lazy"
                  />
                  {company.verified && (
                    <span className="story-verified-badge" title="Empresa Verificada">
                      <CheckCircle2 size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <span className="story-company-name">{company.companyName}</span>
                <span className="story-category-tag">{company.category}</span>
              </button>
            ))}
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
