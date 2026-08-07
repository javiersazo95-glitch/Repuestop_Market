import React from 'react';
import { ArrowRight, Clock, MapPin, Package, ShieldCheck } from 'lucide-react';
import VehicleBrandLogo from './VehicleBrandLogo';
import { parseShippingMethods, resolveShippingService } from '../data/shippingMethods';

function initials(name) {
  return String(name || 'RT').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export default function MarketplaceSellerCard({ store, avatarPhoto, onView }) {
  const rating = Number(store.rating ?? 0);
  const publications = Number(store.totalPublicaciones ?? 0);
  const averageResponseTime = store.averageResponseTime || store.tiempoPromedioRespuesta || '15 min';
  const reviewCount = Number(store.reviewCount ?? 0);
  const shippingMethods = parseShippingMethods(store.metodosEnvio);
  const specialistBrands = Array.isArray(store.marcasEspecialistas) ? store.marcasEspecialistas : [];
  const averageDispatchTime = store.averageDispatchTime || store.tiempoPromedioDespacho || '24 h';

  return (
    <article className="market-seller-card">
      {store.coverUrl && (
        <div
          className="market-seller-cover"
          style={{ backgroundImage: `url("${store.coverUrl}")` }}
          aria-hidden="true"
        />
      )}
      <div className={`market-seller-identity ${store.coverUrl ? 'has-cover' : ''}`}>
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
        <div><Clock size={15} /><p><strong>{averageResponseTime}</strong><small>Tiempo de respuesta</small></p></div>
        <div><Clock size={15} /><p><strong>{averageDispatchTime}</strong><small>Tiempo promedio de despacho</small></p></div>
        <div className="market-seller-specialist-brands">
          <div aria-label="Marcas especialistas">
            {specialistBrands.slice(0, 3).map((brand) => (
              <VehicleBrandLogo key={brand.id || brand.nombre} brand={brand.nombre} />
            ))}
            {specialistBrands.length > 3 && (
              <span
                className="vehicle-brand-icon vehicle-brand-more"
                data-tooltip={specialistBrands.slice(3).map((brand) => brand.nombre).join(', ')}
                tabIndex={0}
                aria-label={`${specialistBrands.length - 3} marcas especialistas más`}
              >+{specialistBrands.length - 3}</span>
            )}
          </div>
          <p><small>Marcas especialistas</small></p>
        </div>
      </div>

      <div className="market-seller-shipping">
        <span>Envíos</span>
        <div>
          {shippingMethods.slice(0, 3).map((method) => {
            const config = resolveShippingService(method);
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
