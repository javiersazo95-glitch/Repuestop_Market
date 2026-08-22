import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, MessageCircle, Calendar, MapPin } from 'lucide-react';
import { AD_TIERS, SERVICE_CATEGORIES } from '../../data/automotiveAdsData';
import { useAdOwnership } from './useAdOwnership';

const SLIDE_DURATION = 5000;

/**
 * Visor de historias de un anuncio. El backend solo guarda `storyImages`
 * (una lista de URLs), no diapositivas con titulo y oferta propios, asi que
 * cada foto se muestra con los datos del anuncio — igual que en el movil
 * (`mobile/components/ads/StoriesViewerModal.tsx`).
 */
export default function StoriesViewerModal({
  ad,
  onClose,
  onOpenBooking
}) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [blockNotice, setBlockNotice] = useState(null);
  const progressIntervalRef = useRef(null);
  const { isOwn, blockIfOwnAd } = useAdOwnership();

  const slides = ((ad?.storyImages?.length ? ad.storyImages : ad?.images) || []).filter(Boolean);
  const activeSlide = slides[currentSlideIndex] || slides[0];

  const tierConfig = AD_TIERS[ad?.tier] || AD_TIERS.basica;
  const categoryObj = SERVICE_CATEGORIES.find((c) => c.id === ad?.category);
  const canWhatsapp = Boolean(tierConfig.hasWhatsapp && ad?.whatsapp);
  const canBook = Boolean(tierConfig.hasBooking && ad?.hasOnlineBooking);

  const goToNextSlide = useCallback(() => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose?.();
    }
  }, [currentSlideIndex, slides.length, onClose]);

  const goToPrevSlide = useCallback(() => {
    if (currentSlideIndex > 0) setCurrentSlideIndex((prev) => prev - 1);
    setProgress(0);
  }, [currentSlideIndex]);

  useEffect(() => {
    setCurrentSlideIndex(0);
    setProgress(0);
  }, [ad?.id]);

  // Avance automatico de la historia activa
  useEffect(() => {
    if (!ad || isPaused || slides.length === 0) return;

    const stepMs = 50;
    const increment = (stepMs / SLIDE_DURATION) * 100;

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
  }, [ad, isPaused, slides.length, goToNextSlide]);

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

  if (!ad || !activeSlide) return null;

  const guard = (action, run) => {
    const blocked = blockIfOwnAd(ad, action);
    if (blocked) {
      setBlockNotice(blocked.message);
      return;
    }
    setBlockNotice(null);
    run();
  };

  const handleWhatsAppClick = () => guard('whatsapp', () => {
    const msg = encodeURIComponent(
      `Hola ${ad.company}, vi su anuncio "${ad.title}" en el Mural de Anuncios de RepuesTop. ¿Podrían darme más información?`
    );
    window.open(`https://wa.me/${String(ad.whatsapp).replace(/[^0-9]/g, '')}?text=${msg}`, '_blank', 'noopener,noreferrer');
  });

  const handleBookingClick = () => guard('booking', () => {
    onClose?.();
    onOpenBooking?.(ad);
  });

  return createPortal(
    <div
      className="stories-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Historias de ${ad.company}`}
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
          {slides.map((slide, idx) => {
            let width = '0%';
            if (idx < currentSlideIndex) width = '100%';
            else if (idx === currentSlideIndex) width = `${progress}%`;
            return (
              <div key={`${slide}-${idx}`} className="story-progress-segment">
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
              src={slides[0]}
              alt={ad.company}
              className="story-author-avatar"
            />
            <div className="story-author-details">
              <span className="story-author-name">
                {ad.company}
                {ad.tier === 'empresarial' && (
                  <CheckCircle2 size={14} className="text-blue-400" />
                )}
              </span>
              <span className="story-author-time">
                {ad.categoryLabel || categoryObj?.label || 'Servicio automotriz'} • Historia {currentSlideIndex + 1} de {slides.length}
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
        <img src={activeSlide} alt={ad.title} className="story-image-bg" />
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
          <span className="story-tag-pill">{tierConfig.badge}</span>

          <h3 className="story-slide-title">{ad.title}</h3>
          <p className="story-slide-description">{ad.description}</p>

          <div className="story-offer-banner">
            <MapPin size={15} />
            <span>{ad.commune}{ad.address ? ` • ${ad.address}` : ''}</span>
          </div>

          {isOwn(ad) && (
            <p className="story-own-notice">Este anuncio es tuyo. Adminístralo desde Gestión de Anuncios.</p>
          )}

          {blockNotice && <p className="story-own-notice">{blockNotice}</p>}

          <div className="story-actions-row">
            {canWhatsapp && (
              <button type="button" className="story-btn-wsp" onClick={handleWhatsAppClick}>
                <MessageCircle size={17} />
                WhatsApp
              </button>
            )}

            {canBook && (
              <button type="button" className="story-btn-book" onClick={handleBookingClick}>
                <Calendar size={17} />
                Agendar cita
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
