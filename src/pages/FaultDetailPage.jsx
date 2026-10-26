import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, CalendarPlus, Car, Gauge, Loader2, MapPin, Tag, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  closeFault, commentFault, getFault, getFaultComments, priceRange, timeSince,
} from '../services/faultApi';
import { resolveMediaUrl } from '../services/api';
import { fetchPublicAd } from '../services/adsStorage';
import AdAppointmentModal from '../components/ads/AdAppointmentModal';
import { ROUTES, workshopPath } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import '../styles/faults.css';

function Fact({ icon: Icon, label, value }) {
  if (!value) return null;
  return <div className="ft-fact"><span><Icon size={12} /> {label}</span><strong>{value}</strong></div>;
}

/** `/fallas/:id`: la falla con los diagnosticos de los talleres, donde el comprador agenda o abre el perfil del taller. */
export default function FaultDetailPage() {
  const { id } = useParams();
  const { user, role } = useAuth();
  useDocumentTitle('Falla automotriz');
  const isWorkshop = role === 'WORKSHOP';
  const [fault, setFault] = useState(null);
  const [comments, setComments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [booking, setBooking] = useState(null);
  const [loadingBookingId, setLoadingBookingId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [detail, list] = await Promise.all([getFault(id), getFaultComments(id)]);
      setFault(detail);
      setComments(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || 'No pudimos cargar la falla.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const diagnostics = useMemo(() => comments.filter((c) => c.respondeAId == null), [comments]);
  const repliesOf = (commentId) => comments.filter((c) => c.respondeAId === commentId);
  const alreadyDiagnosed = diagnostics.some((c) => c.taller && String(c.taller.usuarioId) === String(user?.userId ?? user?.id));

  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || !fault) return;
    setSending(true);
    setFormError('');
    try {
      const from = parseInt(priceFrom.replace(/\D/g, ''), 10);
      const to = parseInt(priceTo.replace(/\D/g, ''), 10);
      await commentFault(fault.id, {
        texto: text.trim(),
        respondeAId: replyTo,
        precioDesde: !replyTo && Number.isFinite(from) ? from : null,
        precioHasta: !replyTo && Number.isFinite(to) ? to : null,
      });
      setText(''); setPriceFrom(''); setPriceTo(''); setReplyTo(null);
      await load();
    } catch (err) {
      setFormError(err?.message || 'No pudimos publicar tu comentario.');
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!fault || !window.confirm('Los talleres dejarán de poder comentar esta falla. ¿Quieres cerrarla?')) return;
    try { setFault(await closeFault(fault.id)); } catch (err) { setFormError(err?.message || 'No pudimos cerrar la falla.'); }
  };

  const openBooking = async (anuncioId) => {
    setLoadingBookingId(anuncioId);
    setFormError('');
    try {
      const ad = await fetchPublicAd(anuncioId);
      setBooking(ad);
    } catch (err) {
      setFormError(err?.message || 'No pudimos abrir la agenda del taller.');
    } finally {
      setLoadingBookingId(null);
    }
  };

  if (loading) return <div className="ft-page"><div className="ft-shell"><div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando falla…</div></div></div>;
  if (error || !fault) {
    return (
      <div className="ft-page"><div className="ft-shell">
        <div className="ft-empty" role="alert"><AlertCircle size={22} /><strong>No pudimos abrir la falla</strong>{error}<br />
          <Link className="ft-btn ft-btn-outline" style={{ marginTop: 10 }} to={ROUTES.faults}>Volver a fallas</Link></div>
      </div></div>
    );
  }

  const vehicle = [fault.marca, fault.modelo, fault.anio, fault.version].filter(Boolean).join(' ');
  const place = [fault.comuna, fault.region].filter(Boolean).join(', ');
  const canComment = isWorkshop && fault.vigente && !alreadyDiagnosed;
  const buyerReplying = fault.propia && replyTo != null;

  return (
    <div className="ft-page">
      <div className="ft-shell">
        <nav className="ft-sub" aria-label="Ruta"><Link to={ROUTES.home}>Inicio</Link> / <Link to={ROUTES.faults}>Fallas automotrices</Link> / <span aria-current="page">{fault.titulo}</span></nav>

        <section className="ft-card">
          <div className="ft-card-top">
            <h1 style={{ fontSize: 22 }}>{fault.titulo}</h1>
            <span className={`ft-badge ${fault.vigente ? '' : 'is-closed'}`}>{fault.vigente ? 'Abierta' : 'Cerrada'}</span>
          </div>
          <p className="ft-sub">{fault.autor} · {timeSince(fault.createdAt)}</p>
          <div className="ft-facts">
            <Fact icon={Car} label="Vehículo" value={`${vehicle} · ${fault.patente}`} />
            <Fact icon={Gauge} label="Motor" value={fault.motor} />
            <Fact icon={Gauge} label="Kilometraje" value={fault.kilometraje != null ? `${fault.kilometraje.toLocaleString('es-CL')} km` : ''} />
            <Fact icon={MapPin} label="Ubicación" value={place} />
            <Fact icon={Wrench} label="¿Se puede mover?" value={fault.seMueve == null ? '' : (fault.seMueve ? 'Sí, se puede mover' : 'No, necesita grúa')} />
          </div>
          {fault.sintomas?.length > 0 && <div className="ft-chips">{fault.sintomas.map((s) => <span key={s} className="ft-chip">{s}</span>)}</div>}
          <div className="ft-block"><h4>Qué pasó</h4><p>{fault.descripcion}</p></div>
          {fault.antesDelFallo && <div className="ft-block"><h4>Antes del fallo</h4><p>{fault.antesDelFallo}</p></div>}
          {fault.fotos?.length > 0 && <div className="ft-photos">{fault.fotos.map((photo) => <img key={photo} src={resolveMediaUrl(photo)} alt="Foto de la falla" />)}</div>}
          {fault.propia && fault.vigente && <div className="ft-actions"><button type="button" className="ft-btn ft-btn-outline" onClick={close}>Cerrar falla</button></div>}
        </section>

        <h2 style={{ fontSize: 18, color: 'var(--ft-strong)' }}>Diagnósticos de talleres ({diagnostics.length})</h2>
        {diagnostics.length === 0 ? (
          <div className="ft-empty"><strong>Aún no hay diagnósticos</strong>{fault.propia ? 'Avisamos a los talleres acreditados. Te notificaremos cuando respondan.' : 'Sé el primero en dejar tu diagnóstico.'}</div>
        ) : (
          <div className="ft-list">
            {diagnostics.map((d) => {
              const workshop = d.taller;
              const price = priceRange(d.precioDesde, d.precioHasta);
              return (
                <article key={d.id} className="ft-card">
                  <div className="ft-diag-author">
                    {d.autorFotoUrl ? <img className="ft-avatar" src={resolveMediaUrl(d.autorFotoUrl)} alt="" /> : <span className="ft-avatar">{d.autor?.slice(0, 1)}</span>}
                    <div><strong>{d.autor}</strong><div className="ft-sub">{[workshop?.comuna, timeSince(d.createdAt)].filter(Boolean).join(' · ')}</div></div>
                  </div>
                  <p>{d.texto}</p>
                  {price && <span className="ft-price"><Tag size={14} /> Precio estimado: {price}</span>}
                  {workshop?.servicios?.length > 0 && <div className="ft-chips">{workshop.servicios.slice(0, 6).map((s) => <span key={s} className="ft-chip">{s}</span>)}</div>}
                  {workshop && (
                    <div className="ft-actions">
                      {fault.propia && fault.vigente && workshop.puedeAgendar && workshop.agendaAnuncioId && (
                        <button type="button" className="ft-btn ft-btn-primary" disabled={loadingBookingId != null} onClick={() => openBooking(workshop.agendaAnuncioId)}>
                          {loadingBookingId === workshop.agendaAnuncioId ? <Loader2 size={16} className="spin-icon" /> : <CalendarPlus size={16} />} Agendar visita
                        </button>
                      )}
                      <Link className="ft-btn ft-btn-outline" to={workshopPath(workshop.tallerId)}>Ver perfil del taller</Link>
                    </div>
                  )}
                  {fault.propia && fault.vigente && !workshop?.puedeAgendar && (
                    <p className="ft-sub">Este taller no agenda desde la web: entra a su perfil para llamar o escribirle.</p>
                  )}
                  {repliesOf(d.id).map((r) => (
                    <div key={r.id} className="ft-reply"><small>{r.esCreador ? `${r.autor} (cliente)` : r.autor}</small>{r.texto}</div>
                  ))}
                  {fault.propia && fault.vigente && (
                    <div className="ft-actions"><button type="button" className="ft-btn ft-btn-outline" onClick={() => setReplyTo(d.id)}>Responder</button></div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {(canComment || buyerReplying) && (
          <form className="ft-card ft-form" onSubmit={send}>
            <strong>{buyerReplying ? 'Responder al taller' : 'Deja tu diagnóstico'}</strong>
            <label className="ft-field">
              <textarea rows={4} value={text} maxLength={1500} onChange={(e) => setText(e.target.value)}
                placeholder={buyerReplying ? 'Escribe tu respuesta' : 'Qué crees que es, qué revisarías y cómo lo resolverías'} />
            </label>
            {!buyerReplying && (
              <div className="ft-row">
                <label className="ft-field"><span>Precio desde <small>Opcional</small></span><input inputMode="numeric" value={priceFrom} maxLength={9} onChange={(e) => setPriceFrom(e.target.value.replace(/\D/g, ''))} placeholder="40000" /></label>
                <label className="ft-field"><span>Hasta <small>Opcional</small></span><input inputMode="numeric" value={priceTo} maxLength={9} onChange={(e) => setPriceTo(e.target.value.replace(/\D/g, ''))} placeholder="80000" /></label>
              </div>
            )}
            {formError && <p className="ft-error" role="alert"><AlertCircle size={15} /> {formError}</p>}
            <div className="ft-actions">
              <button type="submit" className="ft-btn ft-btn-primary" disabled={sending || !text.trim()}>{sending ? 'Publicando…' : 'Publicar'}</button>
              {buyerReplying && <button type="button" className="ft-btn ft-btn-outline" onClick={() => { setReplyTo(null); setText(''); }}>Cancelar</button>}
            </div>
          </form>
        )}
        {!canComment && !buyerReplying && formError && <p className="ft-error" role="alert"><AlertCircle size={15} /> {formError}</p>}
        {isWorkshop && fault.vigente && alreadyDiagnosed && <p className="ft-sub">Ya dejaste tu diagnóstico en esta falla.</p>}
      </div>

      {booking && (
        <AdAppointmentModal
          adOrCompany={booking}
          fallaContext={{ id: fault.id, patente: fault.patente, vehiculo: vehicle, titulo: fault.titulo }}
          onClose={() => setBooking(null)}
        />
      )}
    </div>
  );
}
