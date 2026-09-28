import React from 'react';
import { ArrowRight, CarFront, Clock, Heart, MapPin, Navigation, Package, ShieldCheck } from 'lucide-react';
import VehicleBrandLogo from './VehicleBrandLogo';
import { parseShippingMethods, resolveShippingService } from '../data/shippingMethods';
import { formatDistanceKm } from '../utils/geoDistance';

function initials(name) {
  return String(name || 'RT').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export default function MarketplaceSellerCard({ store, avatarPhoto, onView, isFavorite = false, onToggleFavorite, vehicleBrand = null, vehicleResolved = false, distanceKm = null }) {
  const rating = Number(store.rating ?? 0);
  const publications = Number(store.totalPublicaciones ?? 0);
  const averageResponseTime = store.averageResponseTime || store.tiempoPromedioRespuesta || '15 min';
  const reviewCount = Number(store.reviewCount ?? 0);
  const shippingMethods = parseShippingMethods(store.metodosEnvio);
  const specialistBrands = Array.isArray(store.marcasEspecialistas) ? store.marcasEspecialistas : [];
  const averageDispatchTime = store.averageDispatchTime || store.tiempoPromedioDespacho || '24 h';
  const normalizedVehicleBrand = String(vehicleBrand || '').trim().toLowerCase();
  // `totalPublicaciones` ya viene acotado al vehiculo cuando el directorio consulta con
  // `marcaVehiculo`: es un COUNT del servidor sobre TODO el inventario de la tienda, con la
  // misma regla que su ficha (universales incluidos). Antes la card pedia los primeros 100
  // productos de cada tienda y los contaba aca comparando `compatibilidad[].marca`, asi que
  // se perdia todo lo universal y todo lo que pasara del producto 100: una tienda con tres
  // repuestos compatibles mostraba "1".
  const visiblePublications = publications;
  // Con el vehiculo resuelto en catalogo el numero es exacto para ESE auto, no para toda la
  // marca, asi que la etiqueta no puede decir "Para Toyota": prometeria de mas.
  const publicationsLabel = !normalizedVehicleBrand
    ? 'Repuestos'
    : (vehicleResolved ? 'Para tu vehículo' : `Para ${vehicleBrand}`);

  // "Providencia, Region Metropolitana de Santiago": en celular solo cabe la comuna, así
  // que la región va en su propio span y public-mobile.css la oculta bajo 768px.
  const [city, ...regionParts] = String(store.ciudad || 'Santiago, RM').split(',');
  const region = regionParts.join(',').trim();
  // Sin reseñas no hay nota: "0,0 ☆☆☆☆☆" se lee como una mala evaluación.
  const hasReviews = reviewCount > 0;

  return (
    <article className="market-seller-card">
      {onToggleFavorite && (
        <button
          className={`market-seller-favorite ${isFavorite ? 'is-active' : ''}`}
          type="button"
          aria-label={isFavorite ? 'Quitar tienda de favoritos' : 'Guardar tienda en favoritos'}
          aria-pressed={isFavorite}
          onClick={() => onToggleFavorite(store)}
        >
          <Heart size={19} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      )}
      {/* Distancia a la tienda cuando se conoce la ubicación ("cerca de mí"), como la app. */}
      {distanceKm != null && (
        <span className="market-seller-distance" aria-label={`A ${formatDistanceKm(distanceKm)} de tu ubicación`}>
          <Navigation size={11} /> {formatDistanceKm(distanceKm)}
        </span>
      )}
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
          <p>
            <MapPin size={12} />
            <span className="market-seller-city">
              {city.trim()}
              {region && <span className="market-seller-region">, {region}</span>}
            </span>
          </p>
        </div>
      </div>

      <div className={`market-seller-rating ${hasReviews ? '' : 'is-new'}`}>
        {hasReviews && <strong>{rating.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</strong>}
        <span aria-label={hasReviews ? `${rating} de 5 estrellas` : 'Sin calificaciones'}>{`${'★'.repeat(hasReviews ? Math.round(rating) : 0)}${'☆'.repeat(Math.max(0, 5 - (hasReviews ? Math.round(rating) : 0)))}`}</span>
        <small>{hasReviews ? `(${reviewCount})` : 'Sin reseñas'}</small>
      </div>

      <div className="market-seller-divider" />

      <div className="market-seller-metrics">
        <div><Package size={15} /><p><strong>{visiblePublications.toLocaleString('es-CL')}</strong><small>{publicationsLabel}</small></p></div>
        <div><Clock size={15} /><p><strong>{averageResponseTime}</strong><small>Tiempo de respuesta</small></p></div>
        <div><Clock size={15} /><p><strong>{averageDispatchTime}</strong><small>Tiempo promedio de despacho</small></p></div>
        <div className="market-seller-specialist-brands">
          <div aria-label="Marcas especialistas">
            {/* Sin marcas declaradas la tienda atiende a todas: se dice, no se deja el hueco. */}
            {specialistBrands.length === 0 && (
              <strong className="market-seller-all-brands"><CarFront size={13} /> Multimarca</strong>
            )}
            {/* Escritorio: 3 logos + "+N". Celular (public-mobile.css): 2 logos + su propio
                "+N", porque el tercero no cabe en la card de media columna de 360px. */}
            {specialistBrands.slice(0, 3).map((brand, index) => (
              <VehicleBrandLogo key={brand.id || brand.nombre} brand={brand.nombre} className={index === 2 ? 'is-third-brand' : ''} />
            ))}
            {specialistBrands.length > 3 && (
              <span
                className="vehicle-brand-icon vehicle-brand-more vehicle-brand-more-wide"
                data-tooltip={specialistBrands.slice(3).map((brand) => brand.nombre).join(', ')}
                tabIndex={0}
                aria-label={`${specialistBrands.length - 3} marcas especialistas más`}
              >+{specialistBrands.length - 3}</span>
            )}
            {specialistBrands.length > 2 && (
              <span
                className="vehicle-brand-icon vehicle-brand-more vehicle-brand-more-narrow"
                data-tooltip={specialistBrands.slice(2).map((brand) => brand.nombre).join(', ')}
                tabIndex={0}
                aria-label={`${specialistBrands.length - 2} marcas especialistas más`}
              >+{specialistBrands.length - 2}</span>
            )}
          </div>
          <p>
            <small>
              <span className="market-seller-label-long">Marcas especialistas</span>
              <span className="market-seller-label-short">Especialidad</span>
            </small>
          </p>
        </div>
      </div>

      <div className="market-seller-shipping">
        <span>Envíos</span>
        <div>
          {shippingMethods.length === 0 && <small className="market-seller-shipping-empty">Por coordinar</small>}
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
