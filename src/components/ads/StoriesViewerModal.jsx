import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, MessageCircle, Calendar, Tag, ShieldCheck } from 'lucide-react';

export default function StoriesViewerModal({
  companyStory,
  onClose,
  onOpenBooking
}) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const progressIntervalRef = useRef(null);

  const stories = companyStory?.stories || [];
  const activeSlide = stories[currentSlideIndex] || stories[0];
  const slideDuration = activeSlide?.duration || 5000;

  const goToNextSlide = useCallback(() => {
    if (currentSlideIndex < stories.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose?.();
    }
  }, [currentSlideIndex, stories.length, onClose]);

  const goToPrevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  }, [currentSlideIndex]);

  // Timer loop for active slide
  useEffect(() => {
    if (!companyStory || isPaused) return;

    const stepMs = 50;
    const increment = (stepMs / slideDuration) * 100;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          goToNextSlide();
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [companyStory, isPaused, slideDuration, goToNextSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') goToNextSlide();
      if (e.key === 'ArrowLeft') goToPrevSlide();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToNextSlide, goToPrevSlide]);

  if (!companyStory || !activeSlide) return null;

  const handleWhatsAppClick = () => {
    if (!companyStory.whatsapp) return;
    const msg = encodeURIComponent(
      `Hola ${companyStory.companyName}, vi su anuncio en el Mural de Anuncios de RepuesTop sobre "${activeSlide.title}". ¿Podrían darme más información?`
    );
    window.open(`https://wa.me/${companyStory.whatsapp}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  const handleBookingClick = () => {
    onClose?.();
    onOpenBooking?.({
      company: companyStory.companyName,
      title: activeSlide.title,
      phone: companyStory.phone,
      whatsapp: companyStory.whatsapp,
      address: companyStory.address,
      servicesOffered: [activeSlide.title, 'Mantención preventiva', 'Diagnóstico general']
    });
  };

  return createPortal(
    <div
      className="stories-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Historias de ${companyStory.companyName}`}
    >
      <div
        className="stories-modal-content"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Barras de progreso superiores */}
        <div className="story-progress-bars">
          {stories.map((s, idx) => {
            let width = '0%';
            if (idx < currentSlideIndex) width = '100%';
            else if (idx === currentSlideIndex) width = `${progress}%`;
            return (
              <div key={s.id || idx} className="story-progress-segment">
                <div
                  className={`story-progress-fill ${idx < currentSlideIndex ? 'filled' : ''}`}
                  style={{ width }}
                />
              </div>
            );
          })}
        </div>

        {/* Cabecera de la historia */}
        <div className="story-top-bar">
          <div className="story-author-info">
            <img
              src={companyStory.logo}
              alt={companyStory.companyName}
              className="story-author-avatar"
            />
            <div className="story-author-details">
              <span className="story-author-name">
                {companyStory.companyName}
                {companyStory.verified && (
                  <CheckCircle2 size={14} className="text-blue-400" />
                )}
              </span>
              <span className="story-author-time">
                {companyStory.category} • Historia {currentSlideIndex + 1} de {stories.length}
              </span>
            </div>
          </div>

          <button
            className="story-close-btn"
            onClick={onClose}
            aria-label="Cerrar historias"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Imagen de fondo */}
        <img
          src={activeSlide.image}
          alt={activeSlide.title}
          className="story-image-bg"
        />
        <div className="story-image-overlay-gradient" />

        {/* Zonas táctiles para navegar */}
        <div
          className="story-tap-zone story-tap-left"
          onClick={(e) => {
            e.stopPropagation();
            goToPrevSlide();
          }}
          aria-label="Historia anterior"
        />
        <div
          className="story-tap-zone story-tap-right"
          onClick={(e) => {
            e.stopPropagation();
            goToNextSlide();
          }}
          aria-label="Siguiente historia"
        />

        {/* Contenido inferior de la historia */}
        <div className="story-bottom-content" onClick={(e) => e.stopPropagation()}>
          {activeSlide.tag && (
            <span className="story-tag-pill">{activeSlide.tag}</span>
          )}

          <h3 className="story-slide-title">{activeSlide.title}</h3>
          <p className="story-slide-description">{activeSlide.description}</p>

          {activeSlide.offer && (
            <div className="story-offer-banner">
              <Tag size={15} />
              <span>{activeSlide.offer}</span>
            </div>
          )}

          <div className="story-actions-row">
            {companyStory.whatsapp && (
              <button
                type="button"
                className="story-btn-wsp"
                onClick={handleWhatsAppClick}
              >
                <MessageCircle size={17} />
                WhatsApp
              </button>
            )}

            <button
              type="button"
              className="story-btn-book"
              onClick={handleBookingClick}
            >
              <Calendar size={17} />
              Agendar Cita
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
