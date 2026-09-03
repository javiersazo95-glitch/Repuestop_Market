import React, { useState } from 'react';
import {
  MapPin, Phone, Clock, MessageCircle, Calendar, Star, ShieldCheck,
  CheckCircle2, CalendarClock, UserCheck, ChevronDown, Tag, Zap
} from 'lucide-react';
import { AD_TIERS, SERVICE_CATEGORIES, getAdExpiryInfo } from '../../data/automotiveAdsData';
import { useAdOwnership } from './useAdOwnership';
import ContextualReportButton from '../ContextualReportButton';

/** Distintivo visual de cada plan en el mural (1:1 con mobile/components/ads/AdCard.tsx). */
const TIER_THEME = {
  basica: {},
  destacada: { badge: { label: 'Destacado', color: '#d97706', Icon: Star } },
  premium: { badge: { label: 'Premium', color: '#7c3aed', Icon: Zap } },
  empresarial: { badge: { label: 'Taller Verificado', color: '#059669', Icon: ShieldCheck } },
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80';

export default function AdCard({ ad, onOpenBooking, onSelectCategory }) {
  const [blockNotice, setBlockNotice] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const { isOwn, blockIfOwnAd } = useAdOwnership();

  const categoryObj = SERVICE_CATEGORIES.find((c) => c.id === ad.category);
  const tierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
  const theme = TIER_THEME[ad.tier] || TIER_THEME.basica;
  const isEmpresarial = ad.tier === 'empresarial';
  const isOwnAdCard = isOwn(ad);

  const canWhatsapp = Boolean(tierConfig.hasWhatsapp && ad.whatsapp);
  const canBook = Boolean(tierConfig.hasBooking && ad.hasOnlineBooking);

  const expiry = getAdExpiryInfo(ad);
  const showExpiryChip = Boolean(expiry) && !expiry.isExpired && expiry.daysLeft <= 7;

  const [coverSrc, setCoverSrc] = useState((ad.images && ad.images[0]) || FALLBACK_IMAGE);
  const features = (ad.features || []).slice(0, tierConfig.maxTags || 8);

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

  const TierIcon = theme.badge?.Icon;

  return (
    <article className={`ad-card ${tierConfig.cardTheme} ${isOwnAdCard ? 'is-own-ad' : ''}`} id={`ad-${ad.id}`}>
      {/* Imagen de portada con distintivos */}
      <div className="ad-card-media">
        <img
          src={coverSrc}
          alt={ad.title}
          className="ad-card-cover"
          decoding="async"
          onError={() => { if (coverSrc !== FALLBACK_IMAGE) setCoverSrc(FALLBACK_IMAGE); }}
        />

        {theme.badge && (
          <span className="ad-tier-badge" style={{ backgroundColor: theme.badge.color }}>
            {TierIcon && <TierIcon size={13} />}
            {theme.badge.label}
          </span>
        )}

        {isOwnAdCard && (
          <span className="ad-own-badge">
            <UserCheck size={12} /> Tu anuncio
          </span>
        )}

        {!isOwnAdCard && (
          <ContextualReportButton
            tipoObjeto="ANUNCIO"
            objetoId={ad.id}
            objetoTitulo={ad.title}
            className="ad-card-report"
          />
        )}

        {ad.commune && (
          <span className="ad-location-pill">
            <MapPin size={11} /> {ad.commune}
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="ad-card-body">
        <div className="ad-card-toprow">
          <button
            type="button"
            className="ad-category-chip"
            onClick={() => onSelectCategory?.(ad.category)}
            title={`Ver solo ${ad.categoryLabel || categoryObj?.label || 'esta categoría'}`}
          >
            {ad.categoryLabel || categoryObj?.label || 'Servicio automotriz'}
          </button>

          {ad.is24Hours && (
            <span className="ad-mini-chip"><Clock size={12} /> 24 horas</span>
          )}
          {showExpiryChip && (
            <span className="ad-mini-chip is-warning"><CalendarClock size={12} /> {expiry.label}</span>
          )}
        </div>

        <h3 className="ad-card-title">{ad.title}</h3>

        <div className="ad-card-company">
          <span>{ad.company}</span>
          {isEmpresarial && (
            <span className="ad-company-check" title="Taller verificado">
              <CheckCircle2 size={12} />
            </span>
          )}
        </div>

        {features.length > 0 && (
          <div className="ad-features-grid">
            {features.map((feat, i) => (
              <span key={i} className="ad-feature-item">
                <CheckCircle2 size={11} /> {feat}
              </span>
            ))}
          </div>
        )}

        {showDetail && (
          <div className="ad-card-detail-panel">
            {ad.description && <p className="ad-card-desc">{ad.description}</p>}
            <div className="ad-detail-lines">
              {ad.address && (
                <span><MapPin size={13} /> {ad.address}</span>
              )}
              <span><Tag size={13} /> {ad.priceText || 'Precio a convenir'}</span>
              {ad.phone && <span><Phone size={13} /> {ad.phone}</span>}
            </div>
          </div>
        )}

        <div className="ad-card-footer">
          <div className="ad-hours">
            <Clock size={14} />
            <span>{ad.openingHours || 'Consultar horario'}</span>
          </div>

          <div className="ad-actions">
            <button type="button" className="ad-pill ad-pill-phone" onClick={handlePhoneClick}>
              <Phone size={13} /> Teléfono
            </button>

            {canWhatsapp && (
              <button type="button" className="ad-pill ad-pill-wsp" onClick={handleWhatsAppClick}>
                <MessageCircle size={13} /> WhatsApp
              </button>
            )}

            {canBook && (
              <button type="button" className="ad-pill ad-pill-agenda" onClick={handleBookingClick}>
                <Calendar size={13} /> Agendar
              </button>
            )}

            <button
              type="button"
              className={`ad-pill-detail ${showDetail ? 'is-open' : ''}`}
              onClick={() => setShowDetail((v) => !v)}
              aria-expanded={showDetail}
              aria-label={showDetail ? 'Ocultar ficha del aviso' : 'Ver ficha del aviso'}
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        {blockNotice && <p className="ad-block-notice" role="status">{blockNotice}</p>}
      </div>
    </article>
  );
}
