import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AlertCircle, CalendarPlus, Car, ClipboardList, FileText, Gauge, Loader2, Lock, MapPin, Tag, Wrench, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  acceptFaultDiagnosis, closeFault, commentFault, getDiagnosisEligibility, getFault, getFaultComments, priceRange, timeSince,
} from '../services/faultApi';
import { resolveMediaUrl } from '../services/api';
import { fetchPublicAd } from '../services/adsStorage';
import AdAppointmentModal from '../components/ads/AdAppointmentModal';
import { ROUTES, profilePath, workshopPath } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import '../styles/faults.css';

function Fact({ icon: Icon, label, value }) {
  if (!value) return null;
  return <div className="ft-fact"><span><Icon size={12} /> {label}</span><strong>{value}</strong></div>;
}

/** `/fallas/:id`: la falla con los diagnosticos de los talleres, donde el comprador agenda o abre el perfil del taller. */
export default function FaultDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  // La patente es privada: se ve en "Mis fallas", no al abrir la falla desde el mural publico.
  const showPlate = !location.state?.fromMural;
  const { user, role } = useAuth();
  useDocumentTitle('Falla automotriz');
  const isWorkshop = role === 'WORKSHOP';
  const [fault, setFault] = useState(null);
  const [comments, setComments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [publicText, setPublicText] = useState('');
  // Popup del diagnostico privado: 'new' (taller) o el id del registro abierto.
  const [diagModal, setDiagModal] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [eligibility, setEligibility] = useState(undefined);
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

  // Comentar es libre; registrar un diagnostico pide Diagnostico activo o un anuncio Empresarial.
  useEffect(() => {
    if (diagModal !== 'new') return;
    let active = true;
    setEligibility(undefined);
    getDiagnosisEligibility().then((e) => { if (active) setEligibility(e); }).catch(() => { if (active) setEligibility(null); });
    return () => { active = false; };
  }, [diagModal]);

  const roots = useMemo(() => comments.filter((c) => c.respondeAId == null), [comments]);
  // Comentarios: hilo publico para afinar el diagnostico. Diagnosticos: privados (dueno de la falla y su taller).
  const publicComments = useMemo(() => roots.filter((c) => c.tipo === 'COMENTARIO'), [roots]);
  const diagnostics = useMemo(() => roots.filter((c) => c.tipo !== 'COMENTARIO'), [roots]);
  const repliesOf = (commentId) => comments.filter((c) => c.respondeAId === commentId);
  const myId = String(user?.userId ?? user?.id);
  const isMine = (c) => Boolean(c.taller && String(c.taller.usuarioId) === myId);
  const myDiagnosis = diagnostics.find(isMine) || null;
  const alreadyDiagnosed = Boolean(myDiagnosis);
  // Los diagnosticos se muestran como registros dentro del hilo de comentarios.
  const records = useMemo(() => [...publicComments, ...diagnostics].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), [publicComments, diagnostics]);
  const openDiagnosis = typeof diagModal === 'number' ? comments.find((c) => c.id === diagModal) : null;

  /** Publica un diagnostico privado (`DIAGNOSTICO`), un comentario publico (`COMENTARIO`) o una respuesta. */
  const send = async (event, kind) => {
    event.preventDefault();
    const isReply = replyTo != null;
    const body = kind === 'COMENTARIO' && !isReply ? publicText.trim() : text.trim();
    if (!body || !fault) return;
    setSending(true);
    setFormError('');
    try {
      const from = parseInt(priceFrom.replace(/\D/g, ''), 10);
      const to = parseInt(priceTo.replace(/\D/g, ''), 10);
      const isDiagnosis = kind === 'DIAGNOSTICO' && !isReply;
      await commentFault(fault.id, {
        texto: body,
        respondeAId: replyTo,
        tipo: isReply ? null : kind,
        precioDesde: isDiagnosis && Number.isFinite(from) ? from : null,
        precioHasta: isDiagnosis && Number.isFinite(to) ? to : null,
      });
      setText(''); setPublicText(''); setPriceFrom(''); setPriceTo(''); setReplyTo(null); setDiagModal(null);
      await load();
    } catch (err) {
      setFormError(err?.message || 'No pudimos publicar tu comentario.');
    } finally {
      setSending(false);
    }
  };

  const accept = async (commentId) => {
    setAccepting(true);
    setFormError('');
    try { await acceptFaultDiagnosis(fault.id, commentId); await load(); } catch (err) { setFormError(err?.message || 'No pudimos aceptar el diagnóstico.'); } finally { setAccepting(false); }
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

  /** Tarjeta de un hilo: el comentario o diagnostico del taller con las respuestas. `isPublic` oculta precio, servicios y agenda. */
  const renderThread = (d, isPublic) => {
    const workshop = d.taller;
    const price = isPublic ? null : priceRange(d.precioDesde, d.precioHasta);
    const canReply = fault.vigente && fault.propia;
    return (
      <article key={d.id} className="ft-card">
        <div className="ft-diag-author">
          {d.autorFotoUrl ? <img className="ft-avatar" src={resolveMediaUrl(d.autorFotoUrl)} alt="" /> : <span className="ft-avatar">{d.autor?.slice(0, 1)}</span>}
          <div><strong>{d.autor}</strong><div className="ft-sub">{[workshop?.comuna, timeSince(d.createdAt)].filter(Boolean).join(' · ')}</div>{workshop && <Link className="ft-link-sub" to={workshopPath(workshop.tallerId)}>Ver perfil del taller ›</Link>}</div>
        </div>
        <p>{d.texto}</p>
        {price && <span className="ft-price"><Tag size={14} /> Precio estimado: {price}</span>}
        {!isPublic && workshop?.servicios?.length > 0 && <div className="ft-chips">{workshop.servicios.slice(0, 6).map((s) => <span key={s} className="ft-chip">{s}</span>)}</div>}
        {workshop && (
          <div className="ft-actions">
            {!isPublic && fault.propia && fault.vigente && workshop.puedeAgendar && workshop.agendaAnuncioId && (
              <button type="button" className="ft-btn ft-btn-primary" disabled={loadingBookingId != null} onClick={() => openBooking(workshop.agendaAnuncioId)}>
                {loadingBookingId === workshop.agendaAnuncioId ? <Loader2 size={16} className="spin-icon" /> : <CalendarPlus size={16} />} Agendar visita
              </button>
            )}
          </div>
        )}
        {!isPublic && fault.propia && fault.vigente && !workshop?.puedeAgendar && (
          <p className="ft-sub">Este taller no agenda desde la web: entra a su perfil para llamar o escribirle.</p>
        )}
        {repliesOf(d.id).map((r) => (
          <div key={r.id} className="ft-reply"><small>{r.esCreador ? `${r.autor} (cliente)` : r.autor}</small>{r.texto}</div>
        ))}
        {canReply && (
          <div className="ft-actions"><button type="button" className="ft-btn ft-btn-outline" onClick={() => setReplyTo(d.id)}>Responder</button></div>
        )}
      </article>
    );
  };

  const canComment = isWorkshop && fault.vigente && !alreadyDiagnosed;
  const replying = replyTo != null;

  return (
    <div className="ft-page">
      <div className="ft-shell">
        <nav className="ft-sub" aria-label="Ruta"><Link to={ROUTES.home}>Inicio</Link> / <Link to={ROUTES.faults}>Fallas automotrices</Link> / <span aria-current="page">{fault.titulo}</span></nav>

        <section className="ft-card">
          <div className="ft-card-top">
            <h1>{fault.titulo}</h1>
            <span className={`ft-badge ${fault.vigente ? '' : 'is-closed'}`}>{fault.vigente ? 'Abierta' : 'Cerrada'}</span>
          </div>
          <p className="ft-sub">{fault.autor} · {timeSince(fault.createdAt)}</p>
          {[fault.fotoVehiculo, ...(fault.fotos || [])].filter(Boolean).length > 0 && (
            <div className="ft-photos">
              {[fault.fotoVehiculo, ...(fault.fotos || [])].filter(Boolean).map((photo, index) => <img key={photo} src={resolveMediaUrl(photo)} alt={index === 0 && fault.fotoVehiculo ? 'Foto del vehículo' : 'Foto de la falla'} />)}
            </div>
          )}
          <div className="ft-facts">
            <Fact icon={Car} label="Vehículo" value={showPlate && fault.propia && fault.patente ? `${vehicle} · ${fault.patente}` : vehicle} />
            <Fact icon={Gauge} label="Motor" value={fault.motor} />
            <Fact icon={Gauge} label="Kilometraje" value={fault.kilometraje != null ? `${fault.kilometraje.toLocaleString('es-CL')} km` : ''} />
            <Fact icon={MapPin} label="Ubicación" value={place} />
            <Fact icon={Gauge} label="Prioridad" value={{ ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' }[fault.prioridad] || ''} />
            <Fact icon={Wrench} label="¿Se puede mover?" value={fault.seMueve == null ? '' : (fault.seMueve ? 'Sí, se puede mover' : 'No, necesita grúa')} />
          </div>
          {fault.sintomas?.length > 0 && <div className="ft-chips">{fault.sintomas.map((s) => <span key={s} className="ft-chip">{s}</span>)}</div>}
          <div className="ft-block"><h4>Qué pasó</h4><p>{fault.descripcion}</p></div>
          {fault.antesDelFallo && <div className="ft-block"><h4>Antes del fallo</h4><p>{fault.antesDelFallo}</p></div>}
          {fault.propia && fault.vigente && <div className="ft-actions"><button type="button" className="ft-btn ft-btn-outline" onClick={close}>Cerrar falla</button></div>}
        </section>

        <div className="ft-section-head">
          <h2 style={{ color: 'var(--ft-strong)' }}>Comentarios ({publicComments.length})</h2>
          {isWorkshop && fault.vigente && (
            <button type="button" className="ft-btn ft-btn-outline ft-btn-sm" onClick={() => setDiagModal(myDiagnosis ? myDiagnosis.id : 'new')}>
              <ClipboardList size={14} /> {myDiagnosis ? 'Mi diagnóstico' : 'Diagnosticar'}
            </button>
          )}
        </div>
        <p className="ft-sub">Los talleres preguntan para afinar su diagnóstico y el cliente responde. Los diagnósticos son privados: solo los ven el cliente y el taller que los emitió.</p>
        {records.length === 0 ? (
          <div className="ft-empty"><strong>Aún no hay comentarios</strong>{fault.propia ? 'Los talleres pueden preguntarte para afinar su diagnóstico.' : 'Haz una pregunta para afinar el diagnóstico.'}</div>
        ) : (
          <div className="ft-list">
            {records.map((r) => (r.tipo === 'COMENTARIO' ? renderThread(r, true) : (
              <article key={r.id} className="ft-card ft-record">
                <span className="ft-record-icon"><FileText size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{r.autor} emitió un diagnóstico</strong>
                  <div className="ft-sub"><Lock size={11} /> Privado · {timeSince(r.createdAt)}</div>
                </div>
                {r.aceptado && <span className="ft-badge">Aceptado</span>}
                <button type="button" className="ft-btn ft-btn-outline ft-btn-sm" onClick={() => setDiagModal(r.id)}>Ver</button>
              </article>
            )))}
          </div>
        )}

        {replying && diagModal == null ? (
          <form className="ft-card ft-form" onSubmit={(e) => send(e, 'COMENTARIO')}>
            <strong>Responder</strong>
            <label className="ft-field"><textarea rows={3} value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} placeholder="Escribe tu respuesta" /></label>
            {formError && <p className="ft-error" role="alert"><AlertCircle size={15} /> {formError}</p>}
            <div className="ft-actions">
              <button type="submit" className="ft-btn ft-btn-primary" disabled={sending || !text.trim()}>{sending ? 'Publicando…' : 'Publicar'}</button>
              <button type="button" className="ft-btn ft-btn-outline" onClick={() => { setReplyTo(null); setText(''); }}>Cancelar</button>
            </div>
          </form>
        ) : isWorkshop && fault.vigente && !replying ? (
          <form className="ft-card ft-form" onSubmit={(e) => send(e, 'COMENTARIO')}>
            <strong>Comentar para afinar el diagnóstico</strong>
            <label className="ft-field">
              <textarea rows={3} value={publicText} maxLength={1500} onChange={(e) => setPublicText(e.target.value)}
                placeholder="Ej: ¿Se enciende la luz de motor? ¿Cuándo empezó el ruido?" />
            </label>
            {formError && <p className="ft-error" role="alert"><AlertCircle size={15} /> {formError}</p>}
            <div className="ft-actions"><button type="submit" className="ft-btn ft-btn-primary" disabled={sending || !publicText.trim()}>{sending ? 'Publicando…' : 'Publicar comentario'}</button></div>
          </form>
        ) : formError ? <p className="ft-error" role="alert"><AlertCircle size={15} /> {formError}</p> : null}
      </div>

      {diagModal != null && (
        <div className="ft-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setDiagModal(null)}>
          <div className="ft-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ft-modal-head">
              <h2><Lock size={16} /> {diagModal === 'new' ? 'Registrar diagnóstico' : 'Diagnóstico privado'}</h2>
              <button type="button" className="ft-btn ft-btn-outline ft-btn-sm" aria-label="Cerrar" onClick={() => setDiagModal(null)}><X size={14} /></button>
            </div>
            {diagModal === 'new' && eligibility === undefined ? (
              <div className="ft-empty"><Loader2 size={18} className="spin-icon" /> Comprobando…</div>
            ) : diagModal === 'new' && eligibility?.habilitado !== true ? (
              <div className="ft-form">
                <p>Comentar es libre, pero para registrar un diagnóstico privado necesitas uno de estos dos caminos. Elige el que más te acomode:</p>
                <section className="ft-card ft-path">
                  <strong><Lock size={14} /> Camino 1: servicio Diagnóstico</strong>
                  <p className="ft-sub">Un servicio mensual que se activa con monedas. Cada 10 necesidades de compra que publicas ganas 1 periodo gratis.</p>
                  <ol>
                    <li>Entra a <b>Mis servicios</b> en tu perfil de taller.</li>
                    <li>Ahí verás el servicio <b>Diagnóstico</b> apagado: es una ranura que debes activar.</li>
                    <li>Actívala pagando las monedas que indica el servicio; si te faltan, recarga en Monedas.</li>
                    <li>Con el servicio encendido, vuelve a esta falla y registra tu diagnóstico.</li>
                  </ol>
                  <Link className="ft-btn ft-btn-primary" to={profilePath('servicios_taller')}>Ir a Mis servicios</Link>
                </section>
                <section className="ft-card ft-path">
                  <strong><Tag size={14} /> Camino 2: anuncio Empresarial</strong>
                  <p className="ft-sub">Un anuncio con el plan Empresarial publicado desde Anuncios y agenda, que además incluye agenda de citas.</p>
                  <ol>
                    <li>Entra a <b>Anuncios y agenda</b> en tu perfil de taller.</li>
                    <li>Desde ese menú registra un anuncio nuevo y elige el plan <b>Empresarial</b>.</li>
                    <li>Completa el anuncio: elige tus servicios, fotos y horario de atención.</li>
                    <li>Págalo con monedas, espera la aprobación y vuelve a esta falla.</li>
                  </ol>
                  <Link className="ft-btn ft-btn-primary" to={profilePath('anuncios')}>Ir a Anuncios y agenda</Link>
                </section>
              </div>
            ) : diagModal === 'new' ? (
              <form className="ft-form" onSubmit={(e) => send(e, 'DIAGNOSTICO')}>
                <p className="ft-sub">Solo el cliente y tú podrán verlo. Si le gusta, lo acepta y podrá agendar una cita contigo.</p>
                <label className="ft-field"><textarea rows={4} value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} placeholder="Qué crees que es, qué revisarías y cómo lo resolverías" /></label>
                <div className="ft-row">
                  <label className="ft-field"><span>Precio desde <small>Opcional</small></span><input inputMode="numeric" value={priceFrom} maxLength={9} onChange={(e) => setPriceFrom(e.target.value.replace(/\D/g, ''))} placeholder="40000" /></label>
                  <label className="ft-field"><span>Hasta <small>Opcional</small></span><input inputMode="numeric" value={priceTo} maxLength={9} onChange={(e) => setPriceTo(e.target.value.replace(/\D/g, ''))} placeholder="80000" /></label>
                </div>
                {formError && <p className="ft-error" role="alert"><AlertCircle size={15} /> {formError}</p>}
                <div className="ft-actions"><button type="submit" className="ft-btn ft-btn-primary" disabled={sending || !text.trim()}>{sending ? 'Registrando…' : 'Registrar diagnóstico'}</button></div>
              </form>
            ) : openDiagnosis ? (
              <div className="ft-form">
                <p><strong>{openDiagnosis.autor}</strong> emitió un diagnóstico · {timeSince(openDiagnosis.createdAt)} {openDiagnosis.aceptado && <span className="ft-badge">Aceptado</span>}{openDiagnosis.taller && <><br /><Link className="ft-link-sub" to={workshopPath(openDiagnosis.taller.tallerId)}>Ver perfil del taller ›</Link></>}</p>
                <p>{openDiagnosis.texto}</p>
                {priceRange(openDiagnosis.precioDesde, openDiagnosis.precioHasta) && <span className="ft-price"><Tag size={14} /> Precio estimado: {priceRange(openDiagnosis.precioDesde, openDiagnosis.precioHasta)}</span>}
                {openDiagnosis.taller?.servicios?.length > 0 && <div className="ft-chips">{openDiagnosis.taller.servicios.slice(0, 6).map((sv) => <span key={sv} className="ft-chip">{sv}</span>)}</div>}
                {repliesOf(openDiagnosis.id).map((r) => (
                  <div key={r.id} className="ft-reply"><small>{r.esCreador ? `${r.autor} (cliente)` : r.autor}</small>{r.texto}</div>
                ))}
                {formError && <p className="ft-error" role="alert"><AlertCircle size={15} /> {formError}</p>}
                <div className="ft-actions">
                  {fault.propia && fault.vigente && !openDiagnosis.aceptado && (
                    <button type="button" className="ft-btn ft-btn-primary" disabled={accepting} onClick={() => accept(openDiagnosis.id)}>{accepting ? 'Aceptando…' : 'Aceptar diagnóstico'}</button>
                  )}
                  {fault.propia && fault.vigente && openDiagnosis.aceptado && openDiagnosis.taller?.puedeAgendar && openDiagnosis.taller?.agendaAnuncioId && (
                    <button type="button" className="ft-btn ft-btn-primary" disabled={loadingBookingId != null} onClick={() => { setDiagModal(null); openBooking(openDiagnosis.taller.agendaAnuncioId); }}>
                      <CalendarPlus size={16} /> Agendar cita
                    </button>
                  )}
                </div>
                {fault.propia && fault.vigente && openDiagnosis.aceptado && !openDiagnosis.taller?.puedeAgendar && (
                  <p className="ft-sub">Este taller no agenda desde la web: entra a su perfil para llamar o escribirle.</p>
                )}
                {fault.vigente && fault.propia && (
                  <form className="ft-form" onSubmit={(e) => { setReplyTo(openDiagnosis.id); send(e, 'COMENTARIO'); }}>
                    <label className="ft-field"><textarea rows={2} value={text} maxLength={1500} onChange={(e) => { setText(e.target.value); setReplyTo(openDiagnosis.id); }} placeholder="Escribe una respuesta" /></label>
                    <div className="ft-actions"><button type="submit" className="ft-btn ft-btn-outline" disabled={sending || !text.trim()}>Enviar respuesta</button></div>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

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
