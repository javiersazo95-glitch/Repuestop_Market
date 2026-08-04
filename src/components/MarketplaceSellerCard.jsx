import React from 'react';
import { ArrowRight, Bike, Building2, Clock, MapPin, Package, ShieldCheck, Truck } from 'lucide-react';

function initials(name) {
  return String(name || 'RT').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function shippingConfig(method) {
  const normalized = String(method || '').toLowerCase();
  if (normalized.includes('retiro') || normalized.includes('tienda')) return { label: 'Retiro en tienda', icon: Building2 };
  if (normalized.includes('dentro') || (normalized.includes('comuna') && !normalized.includes('fuera'))) return { label: 'Envío dentro de la comuna', icon: Bike };
  if (normalized.includes('fuera') || normalized.includes('región') || normalized.includes('region') || normalized.includes('nacional')) return { label: 'Envío fuera de la comuna', icon: Truck };
  return { label: method || 'Método de envío', icon: Package };
}

export default function MarketplaceSellerCard({ store, avatarPhoto, onView }) {
  const rating = Number(store.rating ?? 0);
  const publications = Number(store.totalPublicaciones ?? 0);
  const responseRate = store.responseRate ?? (rating ? Math.min(99, 94 + Math.round(rating)) : 0);
  const reviewCount = Number(store.reviewCount ?? 0);
  const parsedShippingMethods = Array.isArray(store.metodosEnvio)
    ? store.metodosEnvio
    : String(store.metodosEnvio || '').split(',').map((method) => method.trim()).filter(Boolean);
  const shippingMethods = parsedShippingMethods;

  return (
    <article className="market-seller-card">
      <div className="market-seller-identity">
        <div className="market-seller-avatar" style={!avatarPhoto ? { background: `linear-gradient(145deg, ${store.bgColor || '#1268f3'}, #071934)` } : undefined}>
          {avatarPhoto ? <img src={avatarPhoto} alt={store.nombre} /> : <span>{store.initials || initials(store.nombre)}</span>}
        </div>
        <div className="market-seller-heading">
          <div><h3>{store.nombre}</h3>{rating >= 4.9 && <ShieldCheck size={17} />}</div>
          <p><MapPin size={12} /> {store.ciudad || 'Santiago, RM'}</p>
        </div>
      </div>

      <div className="market-seller-rating">
        <strong>{rating.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</strong>
        <span aria-label={`${rating} de 5 estrellas`}>{`${'★'.repeat(Math.round(rating))}${'☆'.repeat(Math.max(0, 5 - Math.round(rating)))}`}</span>
        <small>({reviewCount})</small>
      </div>

      <div className="market-seller-divider" />

      <div className="market-seller-metrics">
        <div><Package size={15} /><p><strong>{publications.toLocaleString('es-CL')}</strong><small>Repuestos</small></p></div>
        <div><ShieldCheck size={15} /><p><strong>{responseRate}%</strong><small>Tasa de respuesta</small></p></div>
        <div><Clock size={15} /><p><strong>&lt; 15 min</strong><small>Tiempo de respuesta</small></p></div>
      </div>

      <div className="market-seller-shipping">
        <span>Envíos</span>
        <div>
          {shippingMethods.slice(0, 3).map((method) => {
            const config = shippingConfig(method);
            const ShippingIcon = config.icon;
            return (
              <span className="market-shipping-icon" key={method} title={config.label} tabIndex={0} aria-label={config.label}>
                <ShippingIcon size={14} />
                <small role="tooltip">{config.label}</small>
              </span>
            );
          })}
        </div>
      </div>

      <button className="market-seller-profile" type="button" onClick={() => onView?.(store)}>
        <span>Ver perfil</span><ArrowRight size={15} />
      </button>
    </article>
  );
}
