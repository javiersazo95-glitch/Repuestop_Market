import React, { useState } from 'react';
import {
  MapPin, MessageCircle, Star, ShieldCheck, Phone, Calendar,
  CheckCircle2, CalendarClock, UserCheck, ArrowRight, Zap, Heart
} from 'lucide-react';
import { AD_TIERS, SERVICE_CATEGORIES, getAdExpiryInfo } from '../../data/automotiveAdsData';
import { getCategoryIcon } from './categoryIcons';
import { useAdOwnership } from './useAdOwnership';
import ContextualReportButton from '../ContextualReportButton';
import VehicleBrandLogo from '../VehicleBrandLogo';

/** Distintivo visual de cada plan en el mural (1:1 con mobile/components/ads/AdCard.tsx). */
const TIER_THEME = {
  basica: {},
  destacada: { badge: { label: 'Destacado', color: '#d97706', Icon: Star } },
  premium: { badge: { label: 'Premium', color: '#7c3aed', Icon: Zap } },
  empresarial: { badge: { label: 'Taller Verificado', color: '#059669', Icon: ShieldCheck } },
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80';

export default function AdCard({ ad, onOpenDetail, onOpenBooking, onSelectCategory, isFavorite = false, onToggleFavorite }) {
  const [blockNotice, setBlockNotice] = useState(null);
  const { isOwn, blockIfOwnAd } = useAdOwnership();

  const categoryObj = SERVICE_CATEGORIES.find((c) => c.id === ad.category);
  const categoryLabel = ad.categoryLabel || categoryObj?.label || 'Servicio automotriz';
  const tierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
  const theme = TIER_THEME[ad.tier] || TIER_THEME.basica;
  const isEmpresarial = ad.tier === 'empresarial';
  const isOwnAdCard = isOwn(ad);

  const canWhatsapp = Boolean(tierConfig.hasWhatsapp && ad.whatsapp);

  const expiry = getAdExpiryInfo(ad);
  const showExpiryChip = Boolean(expiry) && !expiry.isExpired && expiry.daysLeft <= 7;

  const [coverSrc, setCoverSrc] = useState((ad.images && ad.images[0]) || FALLBACK_IMAGE);

  const CategoryIcon = getCategoryIcon(ad.category);

  // Todas las tarjetas llevan un distintivo arriba-izquierda: el del plan si lo
  // tiene, y si no uno neutro del tipo de publicación.
  const badge = theme.badge
    || { label: 'Servicio', color: '#2563eb', Icon: null };
  const BadgeIcon = badge.Icon;

  // "Desde $30.000 CLP": el prefijo "Desde" se pinta aparte, así que se quita si
  // ya viene incluido en el texto del backend.
  const priceLabel = (ad.priceText || '').replace(/^desde\s*/i, '').trim();

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
    const text = encodeURIComponent(
      `Hola ${ad.company || ''}, vi su anuncio "${ad.title}" en el Mural de Anuncios de RepuesTop y deseo consultar por sus servicios.`
    );
    window.open(`https://wa.me/${String(ad.whatsapp).replace(/[^0-9]/g, '')}?text=${text}`, '_blank', 'noopener,noreferrer');
  });

  const handlePhoneClick = () => guard('call', () => {
    if (ad.phone) window.location.href = `tel:${ad.phone.replace(/\s+/g, '')}`;
  });

  const handleBookingClick = () => guard('booking', () => onOpenBooking?.(ad));

  const specialistBrands = Array.isArray(ad.specialistBrands)
    ? ad.specialistBrands.map((brand) => typeof brand === 'string' ? brand.trim() : String(brand?.nombre || brand?.name || '').trim()).filter(Boolean)
    : [];
  const previewBrands = specialistBrands.slice(0, 4);

  return (
    <article className={`ad-card ${tierConfig.cardTheme} ${isOwnAdCard ? 'is-own-ad' : ''}`} id={`ad-${ad.id}`}>
      {/* Imagen de portada con distintivos */}
      <button
        type="button"
        className="ad-card-media"
        onClick={() => onOpenDetail?.(ad)}
        aria-label={`Ver detalle de ${ad.title}`}
      >
        <img
          src={coverSrc}
          alt={ad.title}
          className="ad-card-cover"
          decoding="async"
          onError={() => { if (coverSrc !== FALLBACK_IMAGE) setCoverSrc(FALLBACK_IMAGE); }}
        />

        <span className="ad-tier-badge" style={{ backgroundColor: badge.color }}>
          {BadgeIcon && <BadgeIcon size={12} />}
          {badge.label}
        </span>

        {isOwnAdCard && (
          <span className="ad-own-badge">
            <UserCheck size={12} /> Tu anuncio
          </span>
        )}

        <span className={`ad-card-icon ${ad.companyLogo ? 'has-logo' : ''}`} aria-hidden="true">
          {ad.companyLogo
            ? <img src={ad.companyLogo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            : <CategoryIcon size={20} />}
        </span>
      </button>

      {onToggleFavorite && !isOwnAdCard && (
        <button
          type="button"
          className={`ad-card-favorite ${isFavorite ? 'is-active' : ''}`}
          onClick={() => onToggleFavorite(ad)}
          aria-label={isFavorite ? 'Quitar anuncio de favoritos' : 'Guardar anuncio en favoritos'}
          aria-pressed={isFavorite}
        >
          <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      )}

      {!isOwnAdCard && (
        <ContextualReportButton
          tipoObjeto="ANUNCIO"
          objetoId={ad.id}
          objetoTitulo={ad.title}
          className="ad-card-report"
        />
      )}

      {/* Contenido */}
      <div className="ad-card-body">
        <button
          type="button"
          className="ad-card-titlebtn"
          onClick={() => onOpenDetail?.(ad)}
        >
          <h3 className="ad-card-title">{ad.title}</h3>
        </button>

        {ad.description && <p className="ad-card-desc">{ad.description}</p>}

        <p className="ad-card-price">
          <span>Desde </span>
          <strong>{priceLabel || 'a convenir'}</strong>
          {priceLabel && !/clp/i.test(priceLabel) && <span> CLP</span>}
        </p>

        <div className="ad-card-metarow">
          <button
            type="button"
            className="ad-meta-item ad-meta-cat"
            onClick={() => onSelectCategory?.(ad.category)}
            title={`Ver solo ${categoryLabel}`}
          >
            <CategoryIcon size={13} /> {categoryLabel}
          </button>
          {isEmpresarial && (
            <span className="ad-meta-verified" title="Taller verificado">
              <CheckCircle2 size={13} /> Verificado
            </span>
          )}
        </div>

        <div className="ad-card-metarow">
          <span className="ad-meta-item">
            <MapPin size={13} /> {ad.commune || 'Región Metropolitana'}
          </span>
        </div>

        {(previewBrands.length > 0 || showExpiryChip) && (
          <div className="ad-card-tags">
            {previewBrands.length > 0 && (
            <div className="ad-card-specialist-row" aria-label={`Marcas especialistas: ${previewBrands.join(', ')}`}>
              <span>Especialista en</span>
              <div>
                {previewBrands.map((brand) => (
                  <span
                    className="ad-card-brand-logo"
                    data-brand={brand}
                    key={brand}
                    tabIndex={0}
                    aria-label={brand}
                  >
                    <VehicleBrandLogo brand={brand} />
                  </span>
                ))}
              </div>
            </div>
            )}
            {showExpiryChip && (
              <span className="ad-meta-chip is-warning">
                <CalendarClock size={12} /> {expiry.label}
              </span>
            )}
          </div>
        )}

        <div className="ad-card-footer">
          <div className="ad-card-actions">
            <button type="button" className="ad-pill ad-pill-phone" onClick={handlePhoneClick}>
              <Phone size={13} /> Teléfono
            </button>
            {canWhatsapp && (
              <button type="button" className="ad-pill ad-pill-wsp" onClick={handleWhatsAppClick}>
                <MessageCircle size={13} /> WhatsApp
              </button>
            )}
            {isEmpresarial && (
              <button type="button" className="ad-pill ad-pill-agenda" onClick={handleBookingClick}>
                <Calendar size={13} /> Agendar
              </button>
            )}
          </div>

          <button
            type="button"
            className="ad-card-detail-btn"
            onClick={() => onOpenDetail?.(ad)}
          >
            Ver detalle del anuncio <ArrowRight size={15} />
          </button>
        </div>

        {blockNotice && <p className="ad-block-notice" role="status">{blockNotice}</p>}
      </div>
    </article>
  );
}
