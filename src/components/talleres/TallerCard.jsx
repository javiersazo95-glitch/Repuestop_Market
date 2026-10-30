import React, { useMemo, useState } from 'react';
import {
  MapPin, MessageCircle, Phone, Calendar, ShieldCheck, ArrowRight, Heart, Navigation,
  AlarmClock, Home, Clock, UserCheck, CheckCircle2, ChevronDown, ChevronUp, Wrench
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../data/talleresData';
import { getCategoryIcon } from './categoryIcons';
import { useTallerOwnership } from './useTallerOwnership';
import { matchingServices, normalizeSearchText } from '../../utils/tallerSearch';
import { canBookTaller } from '../../utils/tallerBooking';
import ContextualReportButton from '../ContextualReportButton';
import VehicleBrandLogo from '../VehicleBrandLogo';
import { confirmWhatsappContact } from '../../utils/whatsappContact';
import { formatDistanceKm } from '../../utils/geoDistance';
import './ads-wall-redesign.css';
import './taller-card.css';

const MAX_SERVICE_ROWS = 3;
const MAX_BRAND_LOGOS = 5;

const formatPrice = (service) => (
  service.priceFrom != null ? `$${Number(service.priceFrom).toLocaleString('es-CL')}` : 'A cotizar'
);

/**
 * Card del taller en el buscador. Pensada para quien ya sabe que servicio necesita y compara
 * entre cientos de talleres: compacta, con lo justo para comparar (servicio, precio, 24 h, domicilio y
 * agenda) y, si filtro, el bloque «Tiene lo que buscas». El resto se despliega con «Ver detalle», como en
 * `mobile/components/talleres/TallerCard.tsx`; la descripcion y la galeria viven en el perfil.
 *
 * - `filterMatch`: lo pedido en los filtros (servicio, marca, categoria, comuna, 24 h, domicilio).
 * - `highlightTerms`: lo que el cliente busca (texto o servicio elegido en el filtro). Los
 *   servicios que calzan suben primero y se marcan.
 * - `plateBrand`: marca del vehiculo identificado por patente; la card dice si el taller la atiende.
 */
export default function TallerCard({
  taller,
  onOpenProfile,
  onOpenBooking,
  onSelectCategory,
  isFavorite = false,
  onToggleFavorite,
  distanceKm = null,
  highlightTerms = [],
  plateBrand = null,
  filterMatch = null,
}) {
  const [blockNotice, setBlockNotice] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const { isOwn, blockIfOwnTaller } = useTallerOwnership();
  const isOwnCard = isOwn(taller);
  const canBook = canBookTaller(taller);
  const canWhatsapp = Boolean(taller.whatsapp);

  const matched = useMemo(() => matchingServices(taller, highlightTerms), [taller, highlightTerms]);
  const matchedNames = useMemo(() => new Set(matched.map((service) => service.name)), [matched]);

  // Los servicios que calzan con la busqueda primero; el resto en el orden del taller.
  const orderedServices = useMemo(() => [
    ...matched,
    ...taller.services.filter((service) => !matchedNames.has(service.name)),
  ], [taller.services, matched, matchedNames]);
  const visibleServices = orderedServices.slice(0, MAX_SERVICE_ROWS);
  const hiddenServices = Math.max(0, orderedServices.length - visibleServices.length);

  const categoryLabels = useMemo(() => taller.categories
    .map((id) => SERVICE_CATEGORIES.find((category) => category.id === id)?.label)
    .filter(Boolean), [taller.categories]);
  const mainCategory = taller.categories[0];
  const CategoryIcon = getCategoryIcon(mainCategory);
  const initials = (taller.name || 'T').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

  const brands = taller.specialistBrands;
  const previewBrands = brands.slice(0, MAX_BRAND_LOGOS);
  const brandNote = (() => {
    if (!plateBrand) return null;
    if (brands.some((brand) => brand.toLowerCase() === plateBrand.toLowerCase())) return { text: `Especialista en ${plateBrand}`, good: true };
    if (brands.length === 0) return { text: 'Multimarca: atiende tu vehículo', good: false };
    return null;
  })();

  // Lo que el cliente filtro y este taller tiene.
  const wantedService = normalizeSearchText(filterMatch?.service);
  const filterService = wantedService ? taller.services.find((service) => normalizeSearchText(service.name) === wantedService) : null;
  const filterBrand = filterMatch?.brand ? brands.find((brand) => brand.toLowerCase() === filterMatch.brand.toLowerCase()) : null;
  const filterChips = filterMatch ? [
    filterMatch.categoryLabel,
    filterMatch.commune,
    filterMatch.only24Hours ? 'Urgencias 24 h' : null,
    filterMatch.homeService ? 'Va a domicilio' : null,
  ].filter(Boolean) : [];
  const hasFilterMatch = Boolean(filterService || filterBrand || filterChips.length > 0);
  const firstService = orderedServices[0];

  const [coverFailed, setCoverFailed] = useState(false);
  const cover = !coverFailed ? taller.photos[0] : null;

  const guard = (action, run) => {
    const blocked = blockIfOwnTaller(taller, action);
    if (blocked) { setBlockNotice(blocked.message); return; }
    setBlockNotice(null);
    run();
  };

  const handleWhatsApp = () => guard('whatsapp', () => {
    if (!confirmWhatsappContact(taller.name, taller.whatsapp)) return;
    const text = encodeURIComponent(`Hola ${taller.name}, vi su perfil en RepuesTop y quiero consultar por sus servicios.`);
    window.open(`https://wa.me/${String(taller.whatsapp).replace(/[^0-9]/g, '')}?text=${text}`, '_blank', 'noopener,noreferrer');
  });
  const handlePhone = () => guard('call', () => {
    if (taller.phone) window.location.href = `tel:${taller.phone.replace(/\s+/g, '')}`;
  });
  const handleBooking = () => guard('booking', () => onOpenBooking?.(taller));

  return (
    <article className={`taller-card ${isOwnCard ? 'is-own' : ''}`} id={`taller-${taller.id}`}>
      <button
        type="button"
        className={`taller-card__media ${cover ? '' : 'is-empty'}`}
        onClick={() => onOpenProfile?.(taller)}
        aria-label={`Ver el perfil de ${taller.name}`}
      >
        {cover
          ? <img src={cover} alt="" className="taller-card__cover" decoding="async" loading="lazy" onError={() => setCoverFailed(true)} />
          : <CategoryIcon size={42} aria-hidden="true" />}

        <span className="taller-card__verified"><ShieldCheck size={12} /> Taller verificado</span>
        {isOwnCard && <span className="taller-card__own"><UserCheck size={12} /> Tu taller</span>}
        {distanceKm != null && (
          <span className="taller-card__distance" aria-label={`A ${formatDistanceKm(distanceKm)} de tu ubicación`}>
            <Navigation size={11} /> {formatDistanceKm(distanceKm)}
          </span>
        )}
      </button>

      <span className={`taller-card__logo ${taller.logo ? 'has-logo' : ''}`} aria-hidden="true">
        {taller.logo
          ? <img src={taller.logo} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
          : initials}
      </span>

      {onToggleFavorite && !isOwnCard && (
        <button
          type="button"
          className={`taller-card__fav ${isFavorite ? 'is-active' : ''}`}
          onClick={() => onToggleFavorite(taller)}
          aria-label={isFavorite ? 'Quitar taller de favoritos' : 'Guardar taller en favoritos'}
          aria-pressed={isFavorite}
        >
          <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      )}

      {!isOwnCard && (
        <ContextualReportButton
          tipoObjeto="TALLER"
          objetoId={taller.id}
          objetoTitulo={taller.name}
          className="taller-card__report"
        />
      )}

      <div className="taller-card__body">
        <button type="button" className="taller-card__title" onClick={() => onOpenProfile?.(taller)}>
          <h3>{taller.name}</h3>
        </button>

        <p className="taller-card__where">
          <MapPin size={13} aria-hidden="true" />
          <span>{[taller.commune, taller.region && taller.region !== taller.commune ? taller.region : null].filter(Boolean).join(', ') || 'Chile'}</span>
        </p>

        {!expanded && (
          <ul className="taller-card__facts">
            {firstService && (
              <li className="taller-card__summary-service">
                <Wrench size={13} />
                <span>{firstService.name} · {formatPrice(firstService)}{orderedServices.length > 1 ? ` · +${orderedServices.length - 1}` : ''}</span>
              </li>
            )}
            {taller.is24Hours && <li className="is-accent"><AlarmClock size={13} /><span>24 h</span></li>}
            {taller.homeService && <li><Home size={13} /><span>Domicilio</span></li>}
            {canBook && <li className="is-good"><Calendar size={13} /><span>Agenda en línea</span></li>}
          </ul>
        )}

        {hasFilterMatch && (
          <div className="taller-card__match">
            <strong><CheckCircle2 size={14} /> Tiene lo que buscas</strong>
            {filterService && (
              <p><span>{filterService.name}</span><b>{filterService.priceFrom != null ? `desde ${formatPrice(filterService)}` : 'A cotizar'}</b></p>
            )}
            {filterBrand && <p><span>Especialista en {filterBrand}</span></p>}
            {filterChips.length > 0 && <div>{filterChips.map((chip) => <span key={chip}>{chip}</span>)}</div>}
          </div>
        )}

        {expanded && categoryLabels.length > 0 && (
          <div className="taller-card__cats">
            {categoryLabels.slice(0, 2).map((label, index) => (
              <button
                type="button"
                key={label}
                className="taller-card__cat"
                onClick={() => onSelectCategory?.(taller.categories[index])}
                title={`Ver solo ${label}`}
              >
                {label}
              </button>
            ))}
            {categoryLabels.length > 2 && <span className="taller-card__cat is-more">+{categoryLabels.length - 2}</span>}
          </div>
        )}

        {expanded && visibleServices.length > 0 && (
          <div className="taller-card__services" aria-label="Servicios y precios">
            <p className="taller-card__services-title">
              {matched.length > 0 ? <><CheckCircle2 size={12} /> Lo que buscas</> : 'Servicios y precios'}
            </p>
            <ul>
              {visibleServices.map((service) => (
                <li key={service.name} className={matchedNames.has(service.name) ? 'is-match' : ''}>
                  <span className="taller-card__service-name">{service.name}</span>
                  <span className="taller-card__service-price">
                    {service.priceFrom != null && <em>desde</em>}
                    <strong>{formatPrice(service)}</strong>
                  </span>
                </li>
              ))}
            </ul>
            {hiddenServices > 0 && (
              <button type="button" className="taller-card__more" onClick={() => onOpenProfile?.(taller)}>
                +{hiddenServices} {hiddenServices === 1 ? 'servicio más' : 'servicios más'} en el perfil
              </button>
            )}
          </div>
        )}

        {expanded && (previewBrands.length > 0 || brandNote) && (
          <div className="taller-card__brands" aria-label={brands.length ? `Marcas especialistas: ${brands.join(', ')}` : undefined}>
            {brandNote
              ? <span className={`taller-card__brand-note ${brandNote.good ? 'is-good' : ''}`}><CheckCircle2 size={12} /> {brandNote.text}</span>
              : <span className="taller-card__brands-label">Especialista en</span>}
            <div className="taller-card__brand-logos">
              {previewBrands.map((brand) => (
                <span className="taller-card__brand" key={brand} title={brand} aria-label={brand}>
                  <VehicleBrandLogo brand={brand} />
                </span>
              ))}
              {brands.length > MAX_BRAND_LOGOS && <span className="taller-card__brand is-more">+{brands.length - MAX_BRAND_LOGOS}</span>}
            </div>
          </div>
        )}

        {expanded && <ul className="taller-card__facts">
          {taller.hours && (
            <li className={taller.is24Hours ? 'is-accent' : ''}>
              {taller.is24Hours ? <AlarmClock size={13} /> : <Clock size={13} />}
              <span>{taller.hours}</span>
            </li>
          )}
          {taller.is24Hours && !taller.only24Hours && <li className="is-accent"><AlarmClock size={13} /><span>Urgencias 24 h</span></li>}
          {taller.homeService && <li><Home size={13} /><span>Va a domicilio</span></li>}
          {canBook && <li className="is-good"><Calendar size={13} /><span>Agenda en línea</span></li>}
        </ul>}

        {expanded && (
          <button type="button" className="taller-card__more" onClick={() => onOpenProfile?.(taller)}>
            Ver perfil del taller <ArrowRight size={13} />
          </button>
        )}

        <div className="taller-card__footer">
          <div className="taller-card__quick">
            {canBook && (
              <button type="button" className="taller-card__pill is-book" onClick={handleBooking}>
                <Calendar size={13} /> Agendar
              </button>
            )}
            {canWhatsapp && (
              <button type="button" className="taller-card__pill is-wsp" onClick={handleWhatsApp}>
                <MessageCircle size={13} /> WhatsApp
              </button>
            )}
            {taller.phone && (
              <button type="button" className="taller-card__pill is-phone" onClick={handlePhone}>
                <Phone size={13} /> Llamar
              </button>
            )}
          </div>
          <button type="button" className="taller-card__profile-btn" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Ocultar detalle' : 'Ver detalle'} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {blockNotice && <p className="taller-card__notice" role="status">{blockNotice}</p>}
      </div>
    </article>
  );
}
