import React, { useMemo, useState } from 'react';
import {
  AlarmClock, ArrowLeft, BadgeCheck, Calendar, CalendarCheck, ChevronDown, ChevronUp, Clock, Cpu, Heart, Home, MapPin, MessageCircle,
  Moon, Navigation, Phone, Share2, ShieldCheck, Star, Store, Wrench, Award,
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../data/talleresData';
import ProductReviewsSection from '../reviews/ProductReviewsSection';
import VehicleBrandLogo from '../VehicleBrandLogo';
import '../../styles/taller-profile-mobile.css';

const formatPrice = (service) => (service.priceFrom != null ? `$${Number(service.priceFrom).toLocaleString('es-CL')}` : 'A cotizar');
const shortPrice = (service) => (service.priceFrom != null ? `Desde ${formatPrice(service)}` : 'A cotizar');

function Group({ title, trailing, note, plain = false, children }) {
  return (
    <section className="tpm-group">
      <div className="tpm-group-head"><h3>{title}</h3>{trailing}</div>
      {note}
      <div className={`tpm-card ${plain ? 'is-plain' : ''}`}>{children}</div>
    </section>
  );
}

function Row({ icon: Icon, title, summary, onClick, trailing }) {
  const body = (
    <>
      <span className="tpm-row-icon"><Icon size={17} /></span>
      <span className="tpm-row-copy"><strong>{title}</strong><small>{summary}</small></span>
      {trailing}
    </>
  );
  return onClick
    ? <button type="button" className="tpm-row" onClick={onClick}>{body}</button>
    : <div className="tpm-row">{body}</div>;
}

/** «Servicios y precios» como desplegable (`ServiciosDesplegable.tsx` de la app): cuántos hay y desde cuánto; abierto, cada servicio con lo que incluye. */
function ServicesDropdown({ taller, canBook, onBook }) {
  const [open, setOpen] = useState(false);
  const [openIds, setOpenIds] = useState([]);
  const services = useMemo(() => [...taller.services].sort((a, b) => String(a.category).localeCompare(String(b.category), 'es') || a.name.localeCompare(b.name, 'es')), [taller.services]);
  const prices = taller.services.map((service) => service.priceFrom).filter((price) => price != null);
  const summary = taller.services.length === 0
    ? 'Aún no publica su lista de servicios'
    : `${taller.services.length} ${taller.services.length === 1 ? 'servicio' : 'servicios'}${prices.length > 0 ? ` · desde $${Math.min(...prices).toLocaleString('es-CL')}` : ''}`;
  const toggle = (name) => setOpenIds((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));

  return (
    <section className="tpm-group">
      <div className="tpm-group-head"><h3>Servicios y precios</h3></div>
      <div className="tpm-card">
        <button type="button" className="tpm-row" disabled={taller.services.length === 0} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span className="tpm-row-icon"><Wrench size={17} /></span>
          <span className="tpm-row-copy"><strong>Servicios y precios</strong><small>{summary}</small></span>
          {taller.services.length > 0 && (open ? <ChevronUp size={18} /> : <ChevronDown size={18} />)}
        </button>
        {open && services.map((service) => {
          const category = SERVICE_CATEGORIES.find((item) => item.id === service.category);
          const isOpen = openIds.includes(service.name);
          const includes = Array.isArray(service.includes) ? service.includes : [];
          return (
            <div key={service.name} className="tpm-service">
              <button type="button" className="tpm-service-head" aria-expanded={isOpen} onClick={() => toggle(service.name)}>
                <span className="tpm-service-copy"><strong>{service.name}</strong>{category && <small>{category.label}</small>}</span>
                <span className="tpm-service-price">{shortPrice(service)}</span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {isOpen && (
                <div className="tpm-service-body">
                  {includes.length > 0 ? (
                    <ul>{includes.map((item) => <li key={item}>{item}</li>)}</ul>
                  ) : <p>El taller confirma el detalle al revisar tu vehículo.</p>}
                  {canBook && <button type="button" className="tpm-btn is-small" onClick={() => onBook(service)}><Calendar size={15} /> Agendar este servicio</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Perfil público del taller en el celular: igual que `TallerPerfilScreen.tsx` de la app. Portada con la foto de perfil montada,
 * nombre acreditado con calificación y ubicación, «Agendar una cita gratis» y los grupos Presentación, Galería, Servicios y precios,
 * Marcas especialistas, Atención y citas y Opiniones.
 */
export default function TallerProfileMobile({
  taller, photos, isSaved, onToggleSaved, onShare, shareMsg, onBack, canBook, canWhatsapp, isOwnTaller,
  onBook, onPhone, onWhatsApp, onMap, blockNotice, memberSince,
}) {
  const [help, setHelp] = useState(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const cover = photos[0] || null;
  const gallery = photos.slice(1);
  const location = [taller.commune, taller.region].filter(Boolean).join(', ');
  const initials = (taller.name || 'T').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const years = taller.info?.yearsExperience;
  const warranty = taller.info?.warranty;
  const facts = [
    years != null && { key: 'exp', Icon: Award, title: 'Experiencia', value: `${years} ${years === 1 ? 'año' : 'años'} de experiencia`, text: 'Tiempo que lleva el taller trabajando en el rubro automotriz, según lo declara su dueño.' },
    warranty && { key: 'gar', Icon: ShieldCheck, title: 'Garantía', value: `Garantía: ${warranty}`, text: 'Plazo en que el taller responde por sus trabajos si aparece un problema ligado al servicio realizado.' },
  ].filter(Boolean);
  const openFact = facts.find((fact) => fact.key === help) || null;
  const equipment = taller.info?.equipment || [];
  const hasPresentation = Boolean(taller.info?.description || taller.description || equipment.length > 0 || facts.length > 0);

  return (
    <main className="tpm">
      <div className="tpm-top">
        <button type="button" onClick={onBack} aria-label="Volver"><ArrowLeft size={22} /></button>
        <strong>Perfil del taller</strong>
        <span>
          <button type="button" onClick={onShare} aria-label="Compartir taller"><Share2 size={21} /></button>
          <button type="button" onClick={onToggleSaved} aria-pressed={isSaved} aria-label={isSaved ? 'Quitar de favoritos' : 'Guardar en favoritos'} className={isSaved ? 'is-on' : ''}><Heart size={21} fill={isSaved ? 'currentColor' : 'none'} /></button>
        </span>
      </div>
      {shareMsg && <p className="tpm-toast" role="status">{shareMsg}</p>}

      <div className="tpm-hero">
        <div className="tpm-cover">{cover ? <img src={cover} alt="Portada del taller" /> : <span><Wrench size={28} /></span>}</div>
        <span className="tpm-logo">{taller.logo && !logoFailed ? <img src={taller.logo} alt="Foto de perfil del taller" onError={() => setLogoFailed(true)} /> : (initials || <Store size={28} />)}</span>
      </div>

      <div className="tpm-identity">
        <h1>{taller.name} <BadgeCheck size={18} aria-label="Taller acreditado" /></h1>
        <div className="tpm-meta">
          {taller.reviewsCount > 0
            ? <span><Star size={14} fill="currentColor" className="is-star" /> <b>{Number(taller.rating).toFixed(1).replace('.', ',')}</b> <small>({taller.reviewsCount} {taller.reviewsCount === 1 ? 'opinión' : 'opiniones'})</small></span>
            : <small>Aún sin opiniones</small>}
          <span><MapPin size={14} /> <small>{location || 'Ubicación por confirmar'}</small></span>
          {memberSince && <span><Clock size={14} /> <small>En RepuesTop desde {memberSince}</small></span>}
        </div>
      </div>

      {canBook && !isOwnTaller ? (
        <button type="button" className="tpm-btn" onClick={() => onBook(null)}><Calendar size={18} /> Agendar una cita gratis</button>
      ) : !isOwnTaller ? (
        <p className="tpm-note">Este taller aún no recibe citas en línea desde la app.</p>
      ) : null}
      {blockNotice && <p className="tpm-note" role="status">{blockNotice}</p>}

      {hasPresentation && (
        <Group
          title="Presentación"
          trailing={facts.length > 0 && (
            <span className="tpm-facts">
              {facts.map(({ key, Icon, title }) => (
                <button key={key} type="button" aria-label={title} aria-pressed={help === key} onClick={() => setHelp((current) => (current === key ? null : key))}><Icon size={20} /></button>
              ))}
            </span>
          )}
          note={openFact && (
            <button type="button" className="tpm-tooltip" onClick={() => setHelp(null)}><strong>{openFact.value}</strong><small>{openFact.text}</small></button>
          )}
        >
          <div className="tpm-body">
            {(taller.info?.description || taller.description) && <p>{taller.info?.description || taller.description}</p>}
            {equipment.length > 0 && (
              <div className="tpm-equipment">
                <small>Equipamiento de diagnóstico</small>
                <ul>{equipment.map((item) => <li key={item}><Cpu size={14} /> {item}</li>)}</ul>
              </div>
            )}
          </div>
        </Group>
      )}

      {gallery.length > 0 && (
        <Group title="Galería">
          <div className="tpm-gallery">{gallery.map((src, index) => <img key={`${src}-${index}`} src={src} alt={`Foto ${index + 1} del taller`} loading="lazy" />)}</div>
        </Group>
      )}

      <ServicesDropdown taller={taller} canBook={canBook && !isOwnTaller} onBook={onBook} />

      {taller.specialistBrands.length > 0 && (
        <Group title="Marcas especialistas">
          <div className="tpm-brands">
            {taller.specialistBrands.map((brand) => (
              <span key={brand} className="tpm-brand" aria-label={brand}><VehicleBrandLogo brand={brand} /><small>{brand}</small></span>
            ))}
          </div>
        </Group>
      )}

      <Group title="Atención y citas">
        {taller.hours || taller.only24Hours ? <Row icon={Clock} title="Horario de atención" summary={taller.is24Hours && taller.only24Hours ? 'Atención 24 horas, todos los días' : taller.hours} /> : null}
        {taller.is24Hours && (
          <Row icon={Moon} title="Urgencias 24/7" summary={taller.services24h?.length > 0 ? taller.services24h.join(', ') : 'Atiende urgencias a toda hora'} />
        )}
        {taller.address && (
          <Row icon={MapPin} title="Cómo llegar" summary={[taller.address, taller.commune].filter(Boolean).join(', ')} onClick={onMap} trailing={<Navigation size={18} className="tpm-accent" />} />
        )}
        {taller.phone && <Row icon={Phone} title="Llamar al taller" summary={taller.phone} onClick={onPhone} />}
        {canWhatsapp && <Row icon={MessageCircle} title="WhatsApp" summary="Escríbele directo" onClick={onWhatsApp} />}
        <Row icon={Home} title="Servicio a domicilio" summary={taller.homeService ? 'Va a tu dirección, dentro de su comuna' : 'Atiende en el taller'} />
        <Row icon={CalendarCheck} title="Citas en línea" summary={canBook ? 'Reserva tu hora desde la web o la app' : 'Aún no disponible'} />
      </Group>

      <Group title="Opiniones" plain>
        <div>
          <ProductReviewsSection kind="workshop" productId={taller.id} productName={taller.name} title="Opiniones del taller" emptyText="Las dejan los clientes después de su cita." />
        </div>
      </Group>

      <p className="tpm-foot"><AlarmClock size={13} /> Taller acreditado y verificado por RepuesTop</p>
    </main>
  );
}
