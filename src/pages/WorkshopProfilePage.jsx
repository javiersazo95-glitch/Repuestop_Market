import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, Building2, CalendarPlus, Clock, Home, Info, Loader2, MapPin, MessageCircle, Moon,
  ShieldCheck, Wrench, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveMediaUrl } from '../services/api';
import { fetchPublicAd } from '../services/adsStorage';
import { getWorkshopProfile, getWorkshopProfileByAd, seniorityLabel } from '../services/workshopApi';
import AdAppointmentModal from '../components/ads/AdAppointmentModal';
import { ROUTES } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import '../styles/faults.css';

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return <div className="ft-info-row"><Icon size={16} /><div><span>{label}</span>{value}</div></div>;
}

/**
 * Perfil público de un taller acreditado (`/talleres/:workshopId` o `/talleres/anuncio/:adId`). Como la ficha de una
 * casa de repuestos, pero con los servicios del taller en lugar del inventario; la información completa va en un popup.
 */
export default function WorkshopProfilePage() {
  const { workshopId, adId } = useParams();
  const { isLoggedIn, role, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [booking, setBooking] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(false);
  useDocumentTitle(profile?.nombre || 'Taller automotriz');

  const load = useCallback(async () => {
    setError('');
    try {
      setProfile(adId ? await getWorkshopProfileByAd(adId) : await getWorkshopProfile(workshopId));
    } catch (err) {
      setError(err?.status === 404 ? 'Este taller ya no está disponible.' : (err?.message || 'No pudimos cargar el perfil del taller.'));
    }
  }, [adId, workshopId]);

  useEffect(() => { load(); }, [load]);

  const isOwnWorkshop = role === 'WORKSHOP' && profile && String(user?.workshopId) === String(profile.id);
  const canBook = Boolean(profile?.puedeAgendar && profile.agendaAnuncioId) && !isOwnWorkshop;

  const openBooking = async () => {
    if (!isLoggedIn) {
      navigate(ROUTES.home, { state: { requireAuth: true, from: window.location.pathname } });
      return;
    }
    setLoadingBooking(true);
    try {
      setBooking(await fetchPublicAd(profile.agendaAnuncioId));
    } catch (err) {
      setError(err?.message || 'No pudimos abrir la agenda del taller.');
    } finally {
      setLoadingBooking(false);
    }
  };

  const whatsappLink = () => {
    const digits = String(profile.whatsapp || '').replace(/\D/g, '');
    const text = encodeURIComponent(`Hola ${profile.nombre}, vi su perfil en RepuesTop y quiero consultar por sus servicios.`);
    return `https://wa.me/${digits}?text=${text}`;
  };

  if (error && !profile) {
    return (
      <div className="ft-page"><div className="ft-shell">
        <div className="ft-empty" role="alert"><AlertCircle size={22} /><strong>No pudimos abrir el taller</strong>{error}<br />
          <Link className="ft-btn ft-btn-outline" style={{ marginTop: 10 }} to={ROUTES.adsWall}>Ver servicios automotrices</Link></div>
      </div></div>
    );
  }
  if (!profile) return <div className="ft-page"><div className="ft-shell"><div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando taller…</div></div></div>;

  const place = [profile.comuna, profile.region].filter(Boolean).join(', ');
  const m = profile.metricas || {};

  return (
    <div className="ft-page">
      <div className="ft-shell">
        <nav className="ft-sub" aria-label="Ruta"><Link to={ROUTES.home}>Inicio</Link> / <Link to={ROUTES.adsWall}>Servicios automotrices</Link> / <span aria-current="page">{profile.nombre}</span></nav>

        <section className="ft-card">
          <div className="ft-hero">
            {profile.logoUrl ? <img className="ft-logo" src={resolveMediaUrl(profile.logoUrl)} alt={`Logo de ${profile.nombre}`} /> : <span className="ft-logo" aria-hidden="true">{profile.nombre.slice(0, 1)}</span>}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ flex: 1, minWidth: 0 }}>{profile.nombre}</h1>
                <button type="button" className="ft-icon-btn ft-info-btn" onClick={() => setInfoOpen(true)} aria-label="Información del taller" title="Información del taller"><Info size={20} /></button>
              </div>
              <p className="ft-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><MapPin size={14} /> {place || 'Ubicación por confirmar'}</p>
              <div className="ft-chips" style={{ marginTop: 8 }}>
                <span className="ft-badge"><ShieldCheck size={12} /> Taller acreditado</span>
                {profile.atiende24Horas && <span className="ft-badge">24/7</span>}
                {profile.servicioADomicilio && <span className="ft-badge">A domicilio</span>}
              </div>
            </div>
          </div>
          <div className="ft-actions">
            {canBook && (
              <button type="button" className="ft-btn ft-btn-primary" onClick={openBooking} disabled={loadingBooking}>
                {loadingBooking ? <Loader2 size={16} className="spin-icon" /> : <CalendarPlus size={16} />} Agendar visita
              </button>
            )}
            {profile.whatsapp && <a className="ft-btn ft-btn-outline" href={whatsappLink()} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> WhatsApp</a>}
          </div>
          {!canBook && !isOwnWorkshop && <p className="ft-sub">Este taller no agenda desde la web: contáctalo para coordinar la revisión de tu vehículo.</p>}
          {error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
        </section>

        <div className="ft-metrics">
          <div className="ft-metric"><Wrench size={18} /><strong>{Number(m.serviciosRegistrados || 0).toLocaleString('es-CL')}</strong><span>Servicios</span></div>
          <div className="ft-metric"><MessageCircle size={18} /><strong>{Number(m.diagnosticosDados || 0).toLocaleString('es-CL')}</strong><span>Diagnósticos</span></div>
          <div className="ft-metric"><CalendarPlus size={18} /><strong>{Number(m.citasConfirmadas || 0).toLocaleString('es-CL')}</strong><span>Citas confirmadas</span></div>
          <div className="ft-metric"><Clock size={18} /><strong>{seniorityLabel(m.antiguedadMeses)}</strong><span>En RepuesTop</span></div>
        </div>

        {profile.marcasEspecialistas?.length > 0 && (
          <section className="ft-table">
            <div className="ft-table-head"><ShieldCheck size={16} /> Marcas en que es especialista</div>
            <div className="ft-chips ft-table-body">{profile.marcasEspecialistas.map((b) => <span key={b} className="ft-chip">{b}</span>)}</div>
          </section>
        )}

        <section className="ft-table">
          <div className="ft-table-head"><Wrench size={16} /> Servicios y precios</div>
          {profile.servicios?.length ? (
            <>
              <div className="ft-table-cols"><span>SERVICIO</span><span>PRECIO</span></div>
              {profile.servicios.map((service) => (
                <div key={service.id} className="ft-table-row">
                  {service.imagenUrl && <img className="ft-service-img" src={resolveMediaUrl(service.imagenUrl)} alt={service.nombre} loading="lazy" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{service.nombre}</strong>
                    {service.descripcion && <p className="ft-sub">{service.descripcion}</p>}
                    <small>{[service.duracionMinutos ? `${service.duracionMinutos} min` : null, service.marcasEspecialistas?.length ? `Especialista: ${service.marcasEspecialistas.join(', ')}` : null].filter(Boolean).join(' · ')}</small>
                  </div>
                  <span className="ft-price-pill">{service.precioTexto}</span>
                </div>
              ))}
            </>
          ) : <p className="ft-sub ft-table-body">Este taller aún no publica su lista de servicios. Contáctalo para consultar.</p>}
        </section>
      </div>

      {infoOpen && (
        <div className="ft-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setInfoOpen(false); }}>
          <div className="ft-modal" role="dialog" aria-modal="true" aria-label="Información del taller">
            <div className="ft-modal-head"><h2>Información del taller</h2><button type="button" className="ft-icon-btn" onClick={() => setInfoOpen(false)} aria-label="Cerrar"><X size={20} /></button></div>
            <div className="ft-info-list">
              <InfoRow icon={Building2} label="Taller" value={profile.nombre} />
              <InfoRow icon={MessageCircle} label="WhatsApp" value={profile.whatsapp} />
              <InfoRow icon={Clock} label="Horario" value={profile.horario} />
              {profile.atiende24Horas && <InfoRow icon={Moon} label="Atención 24/7" value={profile.servicios24Horas?.length ? profile.servicios24Horas.join(', ') : 'Atiende urgencias a toda hora'} />}
              <InfoRow icon={Home} label="Servicio a domicilio" value={profile.servicioADomicilio ? 'Sí, dentro de su comuna' : 'No'} />
              <InfoRow icon={CalendarPlus} label="Agenda en línea" value={profile.puedeAgendar ? 'Disponible desde la web y la app' : 'No disponible: contáctalo directamente'} />
              <InfoRow icon={ShieldCheck} label="En RepuesTop desde" value={profile.miembroDesde ? new Date(profile.miembroDesde).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }) : ''} />
              <InfoRow icon={Wrench} label="Actividad" value={`${m.serviciosRegistrados || 0} servicios · ${m.diagnosticosDados || 0} diagnósticos · ${m.citasConfirmadas || 0} citas confirmadas`} />
              <InfoRow icon={Wrench} label="Marcas especialistas" value={profile.marcasEspecialistas?.join(', ')} />
            </div>
          </div>
        </div>
      )}

      {booking && <AdAppointmentModal adOrCompany={booking} onClose={() => setBooking(null)} />}
    </div>
  );
}
