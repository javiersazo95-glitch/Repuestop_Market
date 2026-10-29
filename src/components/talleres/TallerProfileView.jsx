import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Heart, Share2, MapPin, BadgeCheck,
  ShieldCheck, Phone, MessageCircle, Calendar, CalendarCheck, Clock, ExternalLink, Home,
  ListChecks, FileText, AlarmClock, CheckCircle2, Wrench, Tag
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../data/talleresData';
import { getCategoryIcon } from './categoryIcons';
import { useTallerOwnership } from './useTallerOwnership';
import BookingModal from './BookingModal';
import ContextualReportButton from '../ContextualReportButton';
import { ROUTES } from '../../routes/paths';
import { useAuth } from '../../context/AuthContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useSavedMarketplaceItems } from '../../hooks/useSavedMarketplaceItems';
import VehicleBrandLogo from '../VehicleBrandLogo';
import { confirmWhatsappContact } from '../../utils/whatsappContact';
import { canBookTaller } from '../../utils/tallerBooking';
import MobileStickyBar from '../MobileStickyBar';
import './ad-detail.css';
import './taller-profile.css';

const formatMonthYear = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const label = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatPrice = (service) => (
  service.priceFrom != null ? `$${Number(service.priceFrom).toLocaleString('es-CL')}` : 'A cotizar'
);

const HOW_IT_WORKS = [
  'Elige el servicio que necesitas.',
  'Escoge el día y la hora disponibles.',
  'El taller confirma tu cita y te avisamos.',
];

export default function TallerProfileView({ taller, onBack, backLabel = 'Volver a talleres' }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [coverError, setCoverError] = useState({});
  const [shareMsg, setShareMsg] = useState('');
  const [booking, setBooking] = useState(null); // { service } | null
  const [blockNotice, setBlockNotice] = useState(null);
  const { user, isLoggedIn } = useAuth();
  const { openAuthModal } = useMarketplace();
  const { isTallerSaved, toggleTaller } = useSavedMarketplaceItems(user?.userId ?? user?.id);
  const isSaved = isTallerSaved(taller.id);
  const { isOwn, blockIfOwnTaller } = useTallerOwnership();
  const isOwnTaller = isOwn(taller);

  const canBook = canBookTaller(taller);
  const canWhatsapp = Boolean(taller.whatsapp);

  const photos = taller.photos.filter((src, index) => src && !coverError[index]);
  const mainCategory = taller.categories[0];
  const CategoryIcon = getCategoryIcon(mainCategory);
  const categoryLabels = useMemo(() => taller.categories
    .map((id) => SERVICE_CATEGORIES.find((category) => category.id === id)?.label)
    .filter(Boolean), [taller.categories]);
  const initials = (taller.name || 'T').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

  const locationText = [taller.address, taller.commune, taller.region].filter(Boolean).join(', ')
    || taller.commune || 'Ubicación a confirmar';
  const mapsQuery = encodeURIComponent(
    taller.latitude != null && taller.longitude != null ? `${taller.latitude},${taller.longitude}` : locationText
  );
  const memberSince = formatMonthYear(taller.memberSince);

  const facts = [
    { Icon: Clock, label: 'Horario', value: taller.is24Hours && taller.only24Hours ? 'Atención 24 horas, todos los días' : taller.hours },
    { Icon: AlarmClock, label: 'Urgencias 24/7', value: taller.is24Hours && !taller.only24Hours ? 'Disponible, a toda hora' : null },
    { Icon: Home, label: 'A domicilio', value: taller.homeService ? `Dentro de ${taller.commune || 'su comuna'}` : null },
    { Icon: CalendarCheck, label: 'Agenda en línea', value: canBook ? 'Reserva tu hora aquí' : null },
    { Icon: Phone, label: 'Teléfono', value: taller.phone },
    { Icon: MessageCircle, label: 'WhatsApp', value: canWhatsapp ? 'Contacto directo disponible' : null },
    { Icon: Wrench, label: 'En RepuesTop desde', value: memberSince },
  ].filter((fact) => fact.value);

  const guard = (action, run) => {
    const blocked = blockIfOwnTaller(taller, action);
    if (blocked) { setBlockNotice(blocked.message); return; }
    setBlockNotice(null);
    run();
  };
  const handlePhone = () => guard('call', () => {
    if (taller.phone) window.location.href = `tel:${taller.phone.replace(/\s+/g, '')}`;
  });
  const handleWhatsApp = () => guard('whatsapp', () => {
    if (!confirmWhatsappContact(taller.name, taller.whatsapp)) return;
    const text = encodeURIComponent(`Hola ${taller.name}, vi su perfil en RepuesTop y quiero consultar por sus servicios.`);
    window.open(`https://wa.me/${String(taller.whatsapp).replace(/[^0-9]/g, '')}?text=${text}`, '_blank', 'noopener,noreferrer');
  });
  const handleBooking = (service = null) => guard('booking', () => setBooking({ service }));

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: taller.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg('Enlace copiado');
      setTimeout(() => setShareMsg(''), 2000);
    } catch {
      /* el usuario canceló el diálogo de compartir */
    }
  };

  const priceCaption = taller.priceFrom != null ? 'Servicios desde' : 'Servicios';
  const priceValue = taller.priceFrom != null ? `$${Number(taller.priceFrom).toLocaleString('es-CL')}` : 'A cotizar';

  return (
    <main className="ad-detail-page taller-profile">
      <div className="container">
        <nav className="ad-detail-breadcrumb" aria-label="Ruta de navegación">
          <Link to={ROUTES.home}>Inicio</Link>
          <ChevronRight size={13} />
          <Link to={ROUTES.talleres}>Talleres</Link>
          <ChevronRight size={13} />
          <span>{taller.name}</span>
        </nav>

        <div className="ad-detail-layout">
          {/* ---- Columna principal ---- */}
          <div className="ad-detail-main">
            <div className="ad-detail-headrow">
              <div className="taller-profile__head">
                <span className={`taller-profile__logo ${taller.logo ? 'has-logo' : ''}`}>
                  {taller.logo ? <img src={taller.logo} alt={`Logo de ${taller.name}`} /> : initials}
                </span>
                <div>
                  <h1 className="ad-detail-title">{taller.name} <BadgeCheck size={20} className="taller-profile__badge" aria-label="Taller verificado por RepuesTop" /></h1>
                  <div className="ad-detail-submeta">
                    <span className="ad-detail-loc"><MapPin size={14} /> {[taller.commune, taller.region].filter(Boolean).join(', ') || 'Chile'}</span>
                    {categoryLabels.slice(0, 3).map((label) => (
                      <React.Fragment key={label}>
                        <span className="ad-detail-dot">•</span>
                        <span className="ad-detail-cat"><CategoryIcon size={14} /> {label}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="taller-profile__chips">
                    <span className="is-verified"><ShieldCheck size={13} /> Taller verificado</span>
                    {taller.is24Hours && <span className="is-24h"><AlarmClock size={13} /> {taller.only24Hours ? '24 horas' : 'Urgencias 24/7'}</span>}
                    {taller.homeService && <span><Home size={13} /> A domicilio</span>}
                    {canBook && <span className="is-book"><Calendar size={13} /> Agenda en línea</span>}
                  </div>
                </div>
              </div>

              <div className="ad-detail-actions">
                <button
                  type="button"
                  className={`ad-detail-iconbtn ${isSaved ? 'is-on' : ''}`}
                  onClick={() => {
                    if (!isLoggedIn) { openAuthModal(); return; }
                    toggleTaller(taller);
                  }}
                  aria-pressed={isSaved}
                  title="Guardar en favoritos"
                >
                  <Heart size={18} />
                </button>
                <button type="button" className="ad-detail-iconbtn" onClick={handleShare} title="Compartir">
                  <Share2 size={18} />
                </button>
                {shareMsg && <span className="ad-detail-sharemsg">{shareMsg}</span>}
              </div>
            </div>

            {/* Galería */}
            {photos.length > 0 ? (
              <div className="ad-detail-gallery">
                <div className="ad-detail-stage">
                  <span className="ad-detail-stage-bg" style={{ backgroundImage: `url("${photos[imgIndex % photos.length]}")` }} aria-hidden="true" />
                  <img
                    src={photos[imgIndex % photos.length]}
                    alt={`${taller.name} — foto ${(imgIndex % photos.length) + 1}`}
                    onError={() => setCoverError((prev) => ({ ...prev, [taller.photos.indexOf(photos[imgIndex % photos.length])]: true }))}
                  />
                  {photos.length > 1 && (
                    <>
                      <button type="button" className="ad-detail-nav prev" onClick={() => setImgIndex((i) => (i - 1 + photos.length) % photos.length)} aria-label="Foto anterior">
                        <ChevronLeft size={20} />
                      </button>
                      <button type="button" className="ad-detail-nav next" onClick={() => setImgIndex((i) => (i + 1) % photos.length)} aria-label="Foto siguiente">
                        <ChevronRight size={20} />
                      </button>
                      <span className="ad-detail-counter">{(imgIndex % photos.length) + 1} / {photos.length}</span>
                    </>
                  )}
                  {!isOwnTaller && (
                    <ContextualReportButton tipoObjeto="TALLER" objetoId={taller.id} objetoTitulo={taller.name} className="ad-detail-report" />
                  )}
                </div>

                {photos.length > 1 && (
                  <div className="ad-detail-thumbs">
                    {photos.map((src, i) => (
                      <button
                        type="button"
                        key={`${src}-${i}`}
                        className={`ad-detail-thumb ${i === imgIndex % photos.length ? 'active' : ''}`}
                        onClick={() => setImgIndex(i)}
                        aria-label={`Ver foto ${i + 1}`}
                      >
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Servicios y precios: el corazon del perfil */}
            <section className="ad-detail-card taller-services" aria-labelledby="taller-services-title">
              <h2 id="taller-services-title"><ListChecks size={17} /> Servicios y precios</h2>
              {taller.services.length > 0 ? (
                <ul className="taller-services__list">
                  {taller.services.map((service) => {
                    const category = SERVICE_CATEGORIES.find((item) => item.id === service.category);
                    return (
                      <li key={service.name}>
                        <div className="taller-services__name">
                          <strong>{service.name}</strong>
                          {category && <small>{category.label}</small>}
                        </div>
                        <div className="taller-services__price">
                          {service.priceFrom != null && <em>desde</em>}
                          <strong>{formatPrice(service)}</strong>
                        </div>
                        {canBook && !isOwnTaller && (
                          <button type="button" className="taller-services__book" onClick={() => handleBooking(service)}>
                            <Calendar size={14} /> Agendar
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="taller-services__empty">Este taller aún no publica su lista de servicios. Contáctalo para consultar.</p>
              )}
              <p className="taller-services__note"><Tag size={13} /> Los precios son referenciales («desde»): el taller confirma el valor final según tu vehículo.</p>
            </section>

            <div className="ad-detail-info-grid">
              {taller.specialistBrands.length > 0 && (
                <section className="ad-detail-card">
                  <h2><BadgeCheck size={17} /> Especialista en</h2>
                  <div className="ad-detail-company-brands">
                    <div>
                      {taller.specialistBrands.map((brand) => (
                        <span className="ad-detail-company-brand" key={brand}>
                          <VehicleBrandLogo brand={brand} />
                          <small>{brand}</small>
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              <section className="ad-detail-card">
                <h2><Clock size={17} /> Atención</h2>
                <dl className="ad-detail-facts">
                  {facts.map(({ Icon, label, value }) => (
                    <div key={label}>
                      <dt><Icon size={14} /> {label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>

            {taller.features.length > 0 && (
              <section className="ad-detail-card">
                <h2><CheckCircle2 size={17} /> Lo que ofrece</h2>
                <ul className="ad-detail-checklist">
                  {taller.features.map((feature) => (
                    <li key={feature}><CheckCircle2 size={15} /> {feature}</li>
                  ))}
                </ul>
              </section>
            )}

            {taller.description && (
              <section className="ad-detail-card ad-detail-desc">
                <h2><FileText size={17} /> Sobre el taller</h2>
                <p>{taller.description}</p>
              </section>
            )}

            <p className="ad-detail-foot">
              <ShieldCheck size={14} />
              Taller acreditado y verificado por RepuesTop
            </p>
          </div>

          {/* Solo móvil: la columna lateral queda al final. */}
          {!isOwnTaller && (canWhatsapp || canBook || taller.phone) && (
            <MobileStickyBar label={priceCaption} value={priceValue} watchSelector=".ad-detail-side .ad-detail-btn" ariaLabel="Contactar al taller">
              {canBook && <button type="button" className="mobile-sticky-bar__btn" onClick={() => handleBooking()}><Calendar size={18} /> Agendar</button>}
              {canWhatsapp && <button type="button" className={`mobile-sticky-bar__btn is-whatsapp ${canBook ? 'is-secondary' : ''}`} onClick={handleWhatsApp} aria-label="WhatsApp"><MessageCircle size={18} />{!canBook && ' WhatsApp'}</button>}
              {taller.phone && (!canBook || !canWhatsapp) && <button type="button" className="mobile-sticky-bar__btn is-secondary" onClick={handlePhone} aria-label="Llamar al taller"><Phone size={18} />{!canBook && !canWhatsapp && ' Llamar'}</button>}
            </MobileStickyBar>
          )}

          {/* ---- Columna lateral ---- */}
          <aside className="ad-detail-side">
            <div className="ad-detail-side-card">
              <div className="ad-detail-price">
                <strong>{priceValue}</strong>
                <span>{priceCaption}</span>
              </div>

              {canBook && (
                <button type="button" className="ad-detail-btn is-book" onClick={() => handleBooking()}>
                  <Calendar size={17} /> Agendar hora
                </button>
              )}
              {canWhatsapp && (
                <button type="button" className="ad-detail-btn is-whatsapp" onClick={handleWhatsApp}>
                  <MessageCircle size={17} /> WhatsApp
                </button>
              )}
              {taller.phone && (
                <button
                  type="button"
                  className={`ad-detail-btn ${canBook || canWhatsapp ? 'is-ghost' : 'is-book'}`}
                  onClick={handlePhone}
                >
                  <Phone size={17} /> {taller.only24Hours ? 'Llamar ahora' : 'Llamar'}
                </button>
              )}
              {blockNotice && <p className="ad-detail-block" role="status">{blockNotice}</p>}

              {canBook && (
                <ol className="taller-profile__steps" aria-label="Cómo agendar">
                  {HOW_IT_WORKS.map((step, index) => (
                    <li key={step}><span>{index + 1}</span>{step}</li>
                  ))}
                </ol>
              )}
            </div>

            <div className="ad-detail-side-card">
              <h2 className="ad-detail-side-title"><MapPin size={16} /> Ubicación</h2>
              <p className="ad-detail-address">{locationText}</p>
              <a
                className="ad-detail-mapslink"
                href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver en Google Maps <ExternalLink size={13} />
              </a>
              <div className="ad-detail-map">
                <iframe
                  title={`Mapa de ${taller.name}`}
                  src={`https://maps.google.com/maps?q=${mapsQuery}&z=15&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>

            <button type="button" className="ad-detail-back" onClick={onBack}>
              <ChevronLeft size={15} /> {backLabel}
            </button>
          </aside>
        </div>
      </div>

      {booking && (
        <BookingModal taller={taller} initialService={booking.service?.name || null} onClose={() => setBooking(null)} />
      )}
    </main>
  );
}
