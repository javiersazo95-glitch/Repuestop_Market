import React, { useEffect, useState } from 'react';
import { Phone, UserRoundCheck } from 'lucide-react';
import { resolveMediaUrl } from '../services/api';

function initials(name) {
  const parts = String(name || 'RepuesTop').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function phoneHref(phone) {
  return `tel:${String(phone || '').replace(/(?!^)\+|[^\d+]/g, '')}`;
}

export default function CapturerContactCard({ capturer, context = 'store', variant = 'sidebar' }) {
  const isAds = context === 'ads';
  const avatarUrl = resolveMediaUrl(capturer?.fotoPerfil || capturer?.profileImageUrl || '');
  const name = capturer?.nombre || capturer?.name || 'Equipo RepuesTop';
  const phone = capturer?.telefono || capturer?.phone || '';
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  if (!capturer) return null;

  return (
    <section
      className={`capturer-contact-card capturer-contact-${variant}`}
      aria-label={isAds ? 'Contacto de apoyo para publicidad' : 'Contacto de apoyo para la tienda'}
    >
      <div className="capturer-contact-heading">
        <UserRoundCheck size={15} aria-hidden="true" />
        <span>Datos de tu captador</span>
      </div>

      <div className="capturer-contact-body">
        <span className="capturer-contact-avatar" aria-hidden="true">
          {avatarUrl && !avatarFailed
            ? <img src={avatarUrl} alt="" onError={() => setAvatarFailed(true)} />
            : initials(name)}
        </span>
        <div className="capturer-contact-copy">
          <small>{isAds ? '¿Dudas sobre publicidad?' : '¿Dudas sobre tu tienda?'}</small>
          <strong>{name}</strong>
        </div>
        {phone && (
          <a className="capturer-contact-phone" href={phoneHref(phone)} aria-label={`Llamar a ${name} al ${phone}`}>
            <Phone size={14} aria-hidden="true" />
            <span>{phone}</span>
          </a>
        )}
      </div>
    </section>
  );
}
