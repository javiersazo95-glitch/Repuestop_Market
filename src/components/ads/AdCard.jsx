import React, { useState } from 'react';
import {
  MapPin, Phone, Clock, MessageCircle, Calendar,
  Lock, CheckCircle2, Star, ShieldCheck, Tag, ExternalLink, Image as ImageIcon
} from 'lucide-react';
import { AD_TIERS, SERVICE_CATEGORIES } from '../../data/automotiveAdsData';

export default function AdCard({
  ad,
  onOpenBooking,
  onSelectCategory
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const categoryObj = SERVICE_CATEGORIES.find((c) => c.id === ad.category);
  const categoryEmoji = categoryObj?.emoji || '🔧';

  const tierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
  const isBasic = ad.tier === 'basica';
  const isDestacada = ad.tier === 'destacada';
  const isPremium = ad.tier === 'premium';
  const isEmpresarial = ad.tier === 'empresarial';

  // Limit images according to tier rules: basic & destacada max 2
  const maxAllowedImages = tierConfig.maxImages || 2;
  const displayImages = (ad.images && ad.images.length > 0)
    ? ad.images.slice(0, maxAllowedImages)
    : ['https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80'];

  const currentImage = displayImages[activeImageIndex] || displayImages[0];

  const handleWhatsAppClick = () => {
    if (!ad.whatsapp || (!isPremium && !isEmpresarial)) return;
    const text = encodeURIComponent(
      `Hola ${ad.company || ''}, vi su anuncio "${ad.title}" en el Mural de Anuncios de RepuesTop y deseo consultar por sus servicios.`
    );
    window.open(`https://wa.me/${ad.whatsapp}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handlePhoneClick = () => {
    if (ad.phone) {
      window.location.href = `tel:${ad.phone.replace(/\s+/g, '')}`;
    }
  };

  return (
    <article className={`ad-card ${tierConfig.cardTheme}`} id={`ad-${ad.id}`}>
      <div className="ad-card-layout">
        
        {/* Columna 1: Galería e Imagen Principal */}
        <div className="ad-card-gallery">
          <div className="ad-main-image-wrap">
            <img
              src={currentImage}
              alt={ad.title}
              className="ad-main-image"
              loading="lazy"
            />
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
          <div className="ad-category-badge">
            <span className="inline-flex items-center gap-1.5">
              <span>{categoryEmoji}</span>
              <span>{ad.categoryLabel || categoryObj?.label || 'Mecánica'}</span>
            </span>
            {isEmpresarial && (
              <span className="text-emerald-700 flex items-center gap-1 font-bold text-xs" title="Taller Certificado y Verificado">
                • <ShieldCheck size={14} /> Taller Verificado
              </span>
            )}
          </div>

          <h3 className="ad-card-title">{ad.title}</h3>

          <div className="ad-company-name">
            <strong>{ad.company}</strong>
            {ad.rating && (
              <span className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                <Star size={13} fill="currentColor" />
                {ad.rating} ({ad.reviewsCount || 10})
              </span>
            )}
          </div>

          <p className="ad-card-description">{ad.description}</p>

          {/* Información con Iconos Básicos */}
          <div className="ad-info-icons-grid">
            <div className="ad-info-item">
              <MapPin size={15} />
              <span><strong>{ad.commune || 'Santiago'}:</strong> {ad.address}</span>
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

          {/* Tags de características */}
          {ad.features && ad.features.length > 0 && (
            <div className="ad-features-tags">
              {ad.features.map((feat, i) => (
                <span key={i} className="ad-feature-tag">
                  ✓ {feat}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Columna 3: Precio y Acciones según Tier */}
        <div className="ad-card-actions-col">
          <div className="ad-price-block">
            <span className="ad-price-label">Tarifa / Presupuesto</span>
            <div className="ad-price-amount">{ad.priceText}</div>
          </div>

          <div className="ad-buttons-stack">
            {/* 1. Botón de Teléfono (disponible en todos los planes) */}
            <button
              type="button"
              className="btn-ad-phone"
              onClick={handlePhoneClick}
              title={`Llamar a ${ad.phone}`}
            >
              <Phone size={15} />
              <span>{ad.phone}</span>
            </button>

            {/* 2. Botón de WhatsApp:
                Habilitado en Premium y Empresarial.
                Bloqueado en Básica y Destacada según requerimiento. */}
            {(isPremium || isEmpresarial) ? (
              <button
                type="button"
                className="btn-ad-whatsapp"
                onClick={handleWhatsAppClick}
              >
                <MessageCircle size={16} />
                <span>WhatsApp Directo</span>
              </button>
            ) : (
              <div
                className="btn-ad-locked"
                title="Acceso directo a WhatsApp disponible en plan Premium y Empresarial"
              >
                <Lock size={13} />
                <span>WhatsApp bloqueado <small>(Plan {ad.tier === 'destacada' ? 'Destacado' : 'Básico'})</small></span>
              </div>
            )}

            {/* 3. Botón de Agendamiento en Plataforma:
                Habilitado exclusivamente en Empresarial.
                Bloqueado en Básica, Destacada y Premium según requerimiento. */}
            {isEmpresarial ? (
              <button
                type="button"
                className="btn-ad-booking"
                onClick={() => onOpenBooking?.(ad)}
              >
                <Calendar size={16} />
                <span>Agendar Cita</span>
              </button>
            ) : (
              <div
                className="btn-ad-locked"
                title="Agendamiento en línea disponible exclusivamente para talleres del Plan Empresarial"
              >
                <Lock size={13} />
                <span>Agendamiento bloqueado <small>(Solo Empresarial)</small></span>
              </div>
            )}
          </div>
        </div>

      </div>
    </article>
  );
}
