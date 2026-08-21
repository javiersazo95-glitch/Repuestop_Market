import React, { useState } from 'react';
import {
  MapPin, Phone, Clock, MessageCircle, Calendar,
  Lock, ShieldCheck, Tag, CalendarClock, ImageOff, Image as ImageIcon, UserCheck
} from 'lucide-react';
import { AD_TIERS, SERVICE_CATEGORIES, getAdExpiryInfo } from '../../data/automotiveAdsData';
import { useAdOwnership } from './useAdOwnership';

export default function AdCard({
  ad,
  onOpenBooking,
  onSelectCategory
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [blockNotice, setBlockNotice] = useState(null);
  const { isOwn, blockIfOwnAd } = useAdOwnership();

  const categoryObj = SERVICE_CATEGORIES.find((c) => c.id === ad.category);
  const categoryEmoji = categoryObj?.emoji || '🔧';

  const tierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
  const isEmpresarial = ad.tier === 'empresarial';
  const isOwnAdCard = isOwn(ad);

  // Las capacidades vienen del plan, no de una lista de tiers escrita a mano:
  // el mismo tarifario que valida `AnuncioService` en el backend.
  const canWhatsapp = Boolean(tierConfig.hasWhatsapp && ad.whatsapp);
  // El plan da el derecho a agendar; la agenda solo queda activa cuando el dueño
  // guardó una configuración horaria válida (`hasOnlineBooking` del backend).
  const canBook = Boolean(tierConfig.hasBooking && ad.hasOnlineBooking);

  const expiry = getAdExpiryInfo(ad);
  const showExpiryChip = Boolean(expiry) && !expiry.isExpired && expiry.daysLeft <= 7;

  const maxAllowedImages = tierConfig.maxImages || 2;
  const displayImages = (ad.images || []).slice(0, maxAllowedImages);
  const currentImage = displayImages[activeImageIndex] || displayImages[0] || null;

  const guard = (action, run) => {
    const blocked = blockIfOwnAd(ad, action);
    if (blocked) {
      setBlockNotice(blocked.message);
      return;
    }
    setBlockNotice(null);
    run();
  };

  const handlePhoneClick = () => guard('call', () => {
    if (ad.phone) window.location.href = `tel:${ad.phone.replace(/\s+/g, '')}`;
  });

  const handleWhatsAppClick = () => guard('whatsapp', () => {
    const text = encodeURIComponent(
      `Hola ${ad.company || ''}, vi su anuncio "${ad.title}" en el Mural de Anuncios de RepuesTop y deseo consultar por sus servicios.`
    );
    window.open(`https://wa.me/${String(ad.whatsapp).replace(/[^0-9]/g, '')}?text=${text}`, '_blank', 'noopener,noreferrer');
  });

  const handleBookingClick = () => guard('booking', () => onOpenBooking?.(ad));

  return (
    <article className={`ad-card ${tierConfig.cardTheme} ${isOwnAdCard ? 'is-own-ad' : ''}`} id={`ad-${ad.id}`}>
      <div className="ad-card-layout">

        {/* Columna 1: Galería e Imagen Principal */}
        <div className="ad-card-gallery">
          <div className="ad-main-image-wrap">
            {currentImage ? (
              <img src={currentImage} alt={ad.title} className="ad-main-image" loading="lazy" />
            ) : (
              <div className="ad-image-empty">
                <ImageOff size={22} />
                <span>Sin fotos</span>
              </div>
            )}
            <span className={`ad-tier-pill pill-${ad.tier}`}>
              {tierConfig.badge}
            </span>

            {displayImages.length > 1 && (
              <span className="ad-image-counter">
                <ImageIcon size={12} />
                {activeImageIndex + 1}/{displayImages.length}
              </span>
            )}
          </div>

          {displayImages.length > 1 && (
            <div className="ad-thumbnails-row">
              {displayImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`ad-thumb-btn ${activeImageIndex === idx ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`Ver foto ${idx + 1}`}
                >
                  <img src={img} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Columna 2: Detalles del Servicio Automotriz */}
        <div className="ad-card-details">
          <div className="ad-card-topline">
            <button
              type="button"
              className="ad-category-badge"
              onClick={() => onSelectCategory?.(ad.category)}
              title={`Ver solo ${ad.categoryLabel || categoryObj?.label || 'esta categoría'}`}
            >
              <span>{categoryEmoji}</span>
              <span>{ad.categoryLabel || categoryObj?.label || 'Servicio automotriz'}</span>
            </button>

            {isEmpresarial && (
              <span className="ad-chip ad-chip-verified" title="Taller certificado y verificado">
                <ShieldCheck size={13} /> Taller verificado
              </span>
            )}

            {ad.is24Hours && (
              <span className="ad-chip ad-chip-neutral">
                <Clock size={13} /> 24 horas
              </span>
            )}

            {isOwnAdCard && (
              <span className="ad-chip ad-chip-own">
                <UserCheck size={13} /> Tu anuncio
              </span>
            )}

            {showExpiryChip && (
              <span className="ad-chip ad-chip-warning" title="El anuncio se retira del mural al vencer">
                <CalendarClock size={13} /> {expiry.label}
              </span>
            )}
          </div>

          <h3 className="ad-card-title">{ad.title}</h3>

          <div className="ad-company-name">
            <strong>{ad.company}</strong>
          </div>

          <p className="ad-card-description">{ad.description}</p>

          <div className="ad-info-icons-grid">
            <div className="ad-info-item">
              <MapPin size={15} />
              <span><strong>{ad.commune}:</strong> {ad.address}</span>
            </div>

            <div className="ad-info-item">
              <Phone size={15} />
              <span><strong>Teléfono:</strong> {ad.phone}</span>
            </div>

            {ad.openingHours && (
              <div className="ad-info-item">
                <Clock size={15} />
                <span><strong>Horario:</strong> {ad.openingHours}</span>
              </div>
            )}

            <div className="ad-info-item">
              <Tag size={15} />
              <span><strong>Precio:</strong> {ad.priceText || 'A convenir'}</span>
            </div>
          </div>

          {ad.features && ad.features.length > 0 && (
            <div className="ad-features-tags">
              {ad.features.slice(0, tierConfig.maxTags || 2).map((feat, i) => (
                <span key={i} className="ad-feature-tag">✓ {feat}</span>
              ))}
            </div>
          )}
        </div>

        {/* Columna 3: Precio y Acciones según Plan */}
        <div className="ad-card-actions-col">
          <div className="ad-price-block">
            <span className="ad-price-label">
              {ad.priceType === 'fixed' ? 'Tarifa' : 'Presupuesto'}
            </span>
            <div className="ad-price-amount">{ad.priceText || 'A convenir'}</div>
          </div>

          <div className="ad-buttons-stack">
            <button
              type="button"
              className="btn-ad-phone"
              onClick={handlePhoneClick}
              title={`Llamar a ${ad.phone}`}
            >
              <Phone size={15} />
              <span>{ad.phone}</span>
            </button>

            {canWhatsapp ? (
              <button type="button" className="btn-ad-whatsapp" onClick={handleWhatsAppClick}>
                <MessageCircle size={16} />
                <span>WhatsApp directo</span>
              </button>
            ) : (
              <div className="btn-ad-locked" title={`El plan ${tierConfig.name} no incluye WhatsApp directo`}>
                <Lock size={13} />
                <span>WhatsApp no disponible <small>(Plan {tierConfig.name})</small></span>
              </div>
            )}

            {canBook ? (
              <button type="button" className="btn-ad-booking" onClick={handleBookingClick}>
                <Calendar size={16} />
                <span>Agendar cita</span>
              </button>
            ) : (
              <div
                className="btn-ad-locked"
                title={isEmpresarial
                  ? 'El taller aún no publicó sus horarios de atención en línea'
                  : 'El agendamiento en línea es exclusivo del plan Empresarial'}
              >
                <Lock size={13} />
                <span>
                  {isEmpresarial ? 'Agenda no habilitada' : 'Agendamiento no disponible'}
                  <small> ({isEmpresarial ? 'sin horarios publicados' : 'Solo Empresarial'})</small>
                </span>
              </div>
            )}
          </div>

          {blockNotice && (
            <p className="ad-block-notice" role="status">{blockNotice}</p>
          )}
        </div>

      </div>
    </article>
  );
}
