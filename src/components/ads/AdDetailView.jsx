import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Heart, Share2, MapPin, BadgeCheck,
  ShieldCheck, Zap, Phone, MessageCircle, Calendar, CalendarCheck,
  Building2, Tag, ListChecks, FileText, CheckCircle2, ThumbsUp, Clock, ExternalLink
} from 'lucide-react';
import { AD_TIERS, SERVICE_CATEGORIES } from '../../data/automotiveAdsData';
import { getCategoryIcon } from './categoryIcons';
import { useAdOwnership } from './useAdOwnership';
import AdAppointmentModal from './AdAppointmentModal';
import ContextualReportButton from '../ContextualReportButton';
import { ROUTES } from '../../routes/paths';
import { useAuth } from '../../context/AuthContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useSavedMarketplaceItems } from '../../hooks/useSavedMarketplaceItems';
import VehicleBrandLogo from '../VehicleBrandLogo';
import './ad-detail.css';

const TIER_META = {
  basica: { label: 'Básico', color: '#64748b' },
  destacada: { label: 'Destacado', color: '#d97706' },
  premium: { label: 'Premium', color: '#7c3aed' },
  empresarial: { label: 'Empresarial', color: '#7c3aed' },
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=1200&auto=format&fit=crop&q=80';

const TRUST_ITEMS = [
  { Icon: ShieldCheck, title: 'Pago seguro', sub: 'en el taller' },
  { Icon: ThumbsUp, title: 'Garantía', sub: 'de servicio' },
  { Icon: Clock, title: 'Atención', sub: 'profesional' },
];

function formatMonthYear(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const label = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function AdDetailView({ ad, onBack }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [coverError, setCoverError] = useState({});
  const [shareMsg, setShareMsg] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [blockNotice, setBlockNotice] = useState(null);
  const { user, isLoggedIn } = useAuth();
  const { openAuthModal } = useMarketplace();
  const { isAdSaved, toggleAd } = useSavedMarketplaceItems(user?.userId ?? user?.id);
  const isSaved = isAdSaved(ad.id);

  const { isOwn, blockIfOwnAd } = useAdOwnership();
  const isOwnAd = isOwn(ad);

  const tierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
  const tierMeta = TIER_META[ad.tier] || TIER_META.basica;
  const isEmpresarial = ad.tier === 'empresarial';
  const categoryObj = SERVICE_CATEGORIES.find((c) => c.id === ad.category);
  const categoryLabel = ad.categoryLabel || categoryObj?.label || 'Servicio automotriz';
  const CategoryIcon = getCategoryIcon(ad.category);

  const canWhatsapp = Boolean(tierConfig.hasWhatsapp && ad.whatsapp);
  const canBook = Boolean(tierConfig.hasBooking && ad.hasOnlineBooking);

  const images = (ad.images || []).filter(Boolean);
  const gallery = images.length > 0 ? images : [FALLBACK_IMAGE];
  const currentImg = coverError[imgIndex] ? FALLBACK_IMAGE : gallery[imgIndex];

  const description = (ad.description || '').trim();

  // "Servicios que ofrece": une las etiquetas del anuncio y los servicios
  // declarados, sin repetir.
  const offeredServices = [...new Set([
    ...(ad.features || []),
    ...(ad.servicesOffered || []),
  ].map((s) => (s || '').trim()).filter(Boolean))];

  const specialistBrands = (ad.specialistBrands || [])
    .map((brand) => typeof brand === 'string' ? brand.trim() : String(brand?.nombre || brand?.name || '').trim())
    .filter(Boolean);

  const priceLabel = (ad.priceText || '').replace(/^desde\s*/i, '').trim();
  const locationText = [ad.address, ad.commune, ad.region].filter(Boolean).join(', ')
    || ad.commune || 'Ubicación a confirmar';
  const mapsQuery = encodeURIComponent(locationText);

  // Ficha de la empresa que publica: solo se listan los datos disponibles.
  const memberSince = formatMonthYear(ad.publishedAt);
  const companyFacts = [
    { Icon: BadgeCheck, label: 'Plan', value: isEmpresarial ? `${tierMeta.label} · Verificado` : tierMeta.label },
    { Icon: Tag, label: 'Rubro', value: categoryLabel },
    { Icon: MapPin, label: 'Dirección', value: locationText },
    { Icon: Phone, label: 'Teléfono', value: ad.phone },
    { Icon: MessageCircle, label: 'WhatsApp', value: canWhatsapp ? 'Contacto directo disponible' : null },
    { Icon: Clock, label: 'Horario', value: ad.openingHours },
    { Icon: Zap, label: 'Atención 24 h', value: ad.is24Hours ? 'Sí' : null },
    { Icon: CalendarCheck, label: 'Agenda en línea', value: canBook ? 'Disponible' : null },
    { Icon: Building2, label: 'En RepuesTop desde', value: memberSince },
  ].filter((f) => f.value);

  const guard = (action, run) => {
    const blocked = blockIfOwnAd(ad, action);
    if (blocked) { setBlockNotice(blocked.message); return; }
    setBlockNotice(null);
    run();
  };

  const handlePhone = () => guard('call', () => {
    if (ad.phone) window.location.href = `tel:${ad.phone.replace(/\s+/g, '')}`;
  });

  const handleWhatsApp = () => guard('whatsapp', () => {
    const text = encodeURIComponent(
      `Hola ${ad.company || ''}, vi su anuncio "${ad.title}" en el Mural de Anuncios de RepuesTop y deseo consultar por sus servicios.`
    );
    window.open(
      `https://wa.me/${String(ad.whatsapp).replace(/[^0-9]/g, '')}?text=${text}`,
      '_blank', 'noopener,noreferrer'
    );
  });

  const handleBooking = () => guard('booking', () => setBookingOpen(true));

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: ad.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg('Enlace copiado');
      setTimeout(() => setShareMsg(''), 2000);
    } catch {
      /* el usuario canceló el diálogo de compartir */
    }
  };

  const companyInitials = (ad.company || ad.title || 'R')
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  // Avatar de la empresa: logo real si lo tiene el expediente de servicio
  // automotriz, iniciales como respaldo.
  const CompanyAvatar = ({ size }) => (
    <span className={`ad-detail-avatar ${size === 'sm' ? 'sm' : ''} ${ad.companyLogo ? 'has-logo' : ''}`}>
      {ad.companyLogo
        ? <img src={ad.companyLogo} alt={ad.company || 'Logo de la empresa'} />
        : companyInitials}
    </span>
  );

  return (
    <main className="ad-detail-page">
      <div className="container">
        <nav className="ad-detail-breadcrumb" aria-label="Ruta de navegación">
          <Link to={ROUTES.home}>Inicio</Link>
          <ChevronRight size={13} />
          <Link to={ROUTES.adsWall}>Buscar servicios</Link>
          <ChevronRight size={13} />
          <span>{ad.title}</span>
        </nav>

        <div className="ad-detail-layout">
          {/* ---- Columna principal ---- */}
          <div className="ad-detail-main">
            <div className="ad-detail-headrow">
              <div>
                <span className="ad-detail-tier" style={{ background: tierMeta.color }}>
                  <CategoryIcon size={13} /> {tierMeta.label}
                </span>
                <h1 className="ad-detail-title">{ad.title}</h1>
                <div className="ad-detail-submeta">
                  <span className="ad-detail-cat">
                    <CategoryIcon size={14} /> {categoryLabel}
                  </span>
                  <span className="ad-detail-dot">•</span>
                  <span className="ad-detail-loc">
                    <MapPin size={14} /> {ad.commune || ad.region || 'Chile'}
                  </span>
                  {ad.company && (
                    <>
                      <span className="ad-detail-dot">•</span>
                      <span className="ad-detail-company">
                        {isEmpresarial && <BadgeCheck size={14} />} {ad.company}
                      </span>
                    </>
                  )}
                  {ad.is24Hours && (
                    <>
                      <span className="ad-detail-dot">•</span>
                      <span className="ad-detail-loc"><Clock size={14} /> Atención 24 h</span>
                    </>
                  )}
                </div>
              </div>

              <div className="ad-detail-actions">
                <button
                  type="button"
                  className={`ad-detail-iconbtn ${isSaved ? 'is-on' : ''}`}
                  onClick={() => {
                    if (!isLoggedIn) { openAuthModal(); return; }
                    toggleAd(ad);
                  }}
                  aria-pressed={isSaved}
                  title="Guardar en favoritos"
                >
                  <Heart size={18} />
                </button>
                <button
                  type="button"
                  className="ad-detail-iconbtn"
                  onClick={handleShare}
                  title="Compartir"
                >
                  <Share2 size={18} />
                </button>
                {shareMsg && <span className="ad-detail-sharemsg">{shareMsg}</span>}
              </div>
            </div>

            {/* Galería */}
            <div className="ad-detail-gallery">
              <div className="ad-detail-stage">
                <span
                  className="ad-detail-stage-bg"
                  style={{ backgroundImage: `url("${currentImg}")` }}
                  aria-hidden="true"
                />
                <img
                  src={currentImg}
                  alt={`${ad.title} — imagen ${imgIndex + 1}`}
                  onError={() => setCoverError((prev) => ({ ...prev, [imgIndex]: true }))}
                />
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="ad-detail-nav prev"
                      onClick={() => setImgIndex((i) => (i - 1 + gallery.length) % gallery.length)}
                      aria-label="Imagen anterior"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      type="button"
                      className="ad-detail-nav next"
                      onClick={() => setImgIndex((i) => (i + 1) % gallery.length)}
                      aria-label="Imagen siguiente"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <span className="ad-detail-counter">{imgIndex + 1} / {gallery.length}</span>
                  </>
                )}
                {!isOwnAd && (
                  <ContextualReportButton
                    tipoObjeto="ANUNCIO"
                    objetoId={ad.id}
                    objetoTitulo={ad.title}
                    className="ad-detail-report"
                  />
                )}
              </div>

              {gallery.length > 1 && (
                <div className="ad-detail-thumbs">
                  {gallery.map((src, i) => (
                    <button
                      type="button"
                      key={`${src}-${i}`}
                      className={`ad-detail-thumb ${i === imgIndex ? 'active' : ''}`}
                      onClick={() => setImgIndex(i)}
                      aria-label={`Ver imagen ${i + 1}`}
                    >
                      <img src={coverError[i] ? FALLBACK_IMAGE : src} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* La empresa + Servicios que ofrece */}
            <div className="ad-detail-info-grid">
              <section className="ad-detail-card">
                <h2><Building2 size={17} /> La empresa</h2>
                <div className="ad-detail-company-head">
                  <CompanyAvatar size="sm" />
                  <div>
                    <strong>
                      {ad.company || 'Proveedor RepuesTop'}
                      {isEmpresarial && <BadgeCheck size={15} />}
                    </strong>
                    <span>{isEmpresarial ? 'Taller verificado por RepuesTop' : `Anuncio ${tierMeta.label}`}</span>
                  </div>
                </div>
                {specialistBrands.length > 0 && (
                  <div className="ad-detail-company-brands">
                    <span>Marcas especialistas registradas</span>
                    <div>
                      {specialistBrands.map((brand) => (
                        <span className="ad-detail-company-brand" key={brand}>
                          <VehicleBrandLogo brand={brand} />
                          <small>{brand}</small>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <dl className="ad-detail-facts">
                  {companyFacts.map(({ Icon, label, value }) => (
                    <div key={label}>
                      <dt><Icon size={14} /> {label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {offeredServices.length > 0 && (
                <section className="ad-detail-card">
                  <h2><ListChecks size={17} /> Servicios que ofrece</h2>
                  <ul className="ad-detail-checklist">
                    {offeredServices.map((feat, i) => (
                      <li key={i}><CheckCircle2 size={15} /> {feat}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {description && (
              <section className="ad-detail-card ad-detail-desc">
                <h2><FileText size={17} /> Descripción</h2>
                <p>{description}</p>
              </section>
            )}

            <p className="ad-detail-foot">
              <ShieldCheck size={14} />
              Servicio profesional y garantizado
              <span className="ad-detail-dot">•</span>
              {isEmpresarial ? 'Taller verificado por RepuesTop' : 'Publicado en RepuesTop'}
            </p>
          </div>

          {/* ---- Columna lateral ---- */}
          <aside className="ad-detail-side">
            <div className="ad-detail-side-card">
              <div className="ad-detail-provider">
                <CompanyAvatar />
                <div>
                  <strong>
                    {ad.company || 'Proveedor RepuesTop'}
                    {isEmpresarial && <BadgeCheck size={15} />}
                  </strong>
                  <span>{isEmpresarial ? 'Taller verificado' : tierMeta.label}</span>
                </div>
              </div>

              <div className="ad-detail-price">
                <strong>{priceLabel || 'A convenir'}</strong>
                {priceLabel && !/clp/i.test(priceLabel) && <em>CLP</em>}
                <span>Precio desde</span>
              </div>

              <div className="ad-detail-respond">
                <Zap size={16} />
                <div>
                  <strong>Responde rápido</strong>
                  <span>Suele responder en minutos</span>
                </div>
              </div>

              {canWhatsapp && (
                <button type="button" className="ad-detail-btn is-whatsapp" onClick={handleWhatsApp}>
                  <MessageCircle size={17} /> WhatsApp
                </button>
              )}
              {canBook && (
                <button type="button" className="ad-detail-btn is-book" onClick={handleBooking}>
                  <Calendar size={17} /> Agendar cita
                </button>
              )}
              {ad.phone && (
                <button
                  type="button"
                  className={`ad-detail-btn ${canWhatsapp || canBook ? 'is-ghost' : 'is-book'}`}
                  onClick={handlePhone}
                >
                  <Phone size={17} /> Llamar
                </button>
              )}

              {blockNotice && <p className="ad-detail-block" role="status">{blockNotice}</p>}

              <div className="ad-detail-trust">
                {TRUST_ITEMS.map(({ Icon, title, sub }) => (
                  <div key={title}>
                    <Icon size={17} />
                    <strong>{title}</strong>
                    <span>{sub}</span>
                  </div>
                ))}
              </div>
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
                  title={`Mapa de ${ad.company || ad.title}`}
                  src={`https://maps.google.com/maps?q=${mapsQuery}&z=15&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>

            <button type="button" className="ad-detail-back" onClick={onBack}>
              <ChevronLeft size={15} /> Volver al mural
            </button>
          </aside>
        </div>
      </div>

      {bookingOpen && (
        <AdAppointmentModal adOrCompany={ad} onClose={() => setBookingOpen(false)} />
      )}
    </main>
  );
}
