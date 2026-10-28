import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, ArrowLeft, Bookmark, CalendarPlus, Car, ChevronDown,
  ChevronLeft, ChevronRight, Clock3, Eye, ExternalLink, FileText,
  Loader2, Lock, MapPin, MapPinned, MessageCircle, Pencil, Settings, Share2, Star, Tag, UserRound,
  Wrench, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  acceptFaultDiagnosis, closeFault, commentFault, getDiagnosisEligibility, getFault,
  getFaultComments, getPublicDiagnoses, priceRange, timeSince,
} from '../services/faultApi';
import { resolveMediaUrl } from '../services/api';
import { fetchPublicAd } from '../services/adsStorage';
import { SERVICE_CATEGORIES } from '../data/automotiveAdsData';
import AdAppointmentModal from '../components/ads/AdAppointmentModal';
import CreateFaultModal from '../components/faults/CreateFaultModal';
import { ROUTES, profilePath, workshopPath } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import '../styles/faults.css';

const formatMonthYear = (value) => {
  if (!value) return 'No informado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('es-CL', { month: 'short', year: 'numeric' }).format(date);
};

function DetailPanel({ icon: Icon, title, tone = '', children }) {
  return <section className={`ft-detail-panel ${tone}`}><h2><Icon size={22} /> {title}</h2>{children}</section>;
}

export default function FaultDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const showPlate = !location.state?.fromMural;
  const { user, role } = useAuth();
  const isWorkshop = role === 'WORKSHOP';
  useDocumentTitle('Falla automotriz');

  const [fault, setFault] = useState(null);
  const [comments, setComments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [publicText, setPublicText] = useState('');
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
  const [activePhoto, setActivePhoto] = useState(0);
  const [saved, setSaved] = useState(false);
  const [commentFormOpen, setCommentFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  // Talleres que ya diagnosticaron (sin el contenido): lo ve cualquiera que no sea el dueño.
  const [publicDiagnoses, setPublicDiagnoses] = useState([]);
  const [publicDiagnosesOpen, setPublicDiagnosesOpen] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [detail, list] = await Promise.all([getFault(id), getFaultComments(id)]);
      setFault(detail);
      setComments(Array.isArray(list) ? list : []);
      if (!detail?.propia) {
        const received = await getPublicDiagnoses(id).catch(() => []);
        setPublicDiagnoses(Array.isArray(received) ? received : []);
      }
    } catch (err) {
      setError(err?.message || 'No pudimos cargar la falla.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (diagModal !== 'new') return undefined;
    let active = true;
    setEligibility(undefined);
    getDiagnosisEligibility().then((value) => { if (active) setEligibility(value); }).catch(() => { if (active) setEligibility(null); });
    return () => { active = false; };
  }, [diagModal]);

  const roots = useMemo(() => comments.filter((comment) => comment.respondeAId == null), [comments]);
  const publicComments = useMemo(() => roots.filter((comment) => comment.tipo === 'COMENTARIO'), [roots]);
  const diagnostics = useMemo(() => roots.filter((comment) => comment.tipo !== 'COMENTARIO'), [roots]);
  const repliesOf = (commentId) => comments.filter((comment) => comment.respondeAId === commentId);
  const myId = String(user?.userId ?? user?.id);
  const myDiagnosis = diagnostics.find((comment) => comment.taller && String(comment.taller.usuarioId) === myId) || null;
  const openDiagnosis = typeof diagModal === 'number' ? comments.find((comment) => comment.id === diagModal) : null;

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
      setText(''); setPublicText(''); setPriceFrom(''); setPriceTo(''); setReplyTo(null);
      setDiagModal(null); setCommentFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err?.message || 'No pudimos publicar tu comentario.');
    } finally {
      setSending(false);
    }
  };

  const accept = async (commentId) => {
    setAccepting(true);
    try { await acceptFaultDiagnosis(fault.id, commentId); await load(); }
    catch (err) { setFormError(err?.message || 'No pudimos aceptar el diagnóstico.'); }
    finally { setAccepting(false); }
  };

  const close = async () => {
    if (!fault || !window.confirm('Los talleres dejarán de poder comentar esta falla. ¿Quieres cerrarla?')) return;
    try { setFault(await closeFault(fault.id)); }
    catch (err) { setFormError(err?.message || 'No pudimos cerrar la falla.'); }
  };

  const openBooking = async (anuncioId) => {
    setLoadingBookingId(anuncioId);
    try { setBooking(await fetchPublicAd(anuncioId)); }
    catch (err) { setFormError(err?.message || 'No pudimos abrir la agenda del taller.'); }
    finally { setLoadingBookingId(null); }
  };

  const share = async () => {
    const data = { title: fault?.titulo || 'Falla automotriz', url: window.location.href };
    if (navigator.share) await navigator.share(data);
    else await navigator.clipboard.writeText(data.url);
  };

  if (loading) return <div className="ft-page"><div className="ft-detail-shell"><div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando falla…</div></div></div>;
  if (error || !fault) return <div className="ft-page"><div className="ft-detail-shell"><div className="ft-empty" role="alert"><AlertCircle size={22} /><strong>No pudimos abrir la falla</strong>{error}<br /><Link className="ft-btn ft-btn-outline" to={ROUTES.faults}>Volver a fallas</Link></div></div></div>;

  const vehicleTitle = [fault.marca, fault.modelo].filter(Boolean).join(' ') || fault.vehiculo || fault.titulo;
  const vehicle = [fault.marca, fault.modelo, fault.anio, fault.version].filter(Boolean).join(' ');
  const place = [fault.comuna, fault.region].filter(Boolean).join(', ');
  const photos = [fault.fotoVehiculo || fault.fotoUrl, ...(fault.fotos || [])].filter(Boolean).filter((photo, index, list) => list.indexOf(photo) === index);
  const selectedCategory = SERVICE_CATEGORIES.find((item) => item.id === fault.categoria && item.id !== 'TODAS');
  const category = selectedCategory?.label || (/fren|abs/i.test(`${fault.titulo} ${fault.sintomas?.join(' ')}`) ? 'Frenos'
    : /el[eé]ctric|bater|luz/i.test(`${fault.titulo} ${fault.sintomas?.join(' ')}`) ? 'Sistema eléctrico'
      : /suspensi|amortigu/i.test(`${fault.titulo} ${fault.sintomas?.join(' ')}`) ? 'Suspensión' : 'Motor');
  const categoryKey = selectedCategory ? 'category' : category === 'Frenos' ? 'brakes' : category === 'Sistema eléctrico' ? 'electric' : category === 'Suspensión' ? 'suspension' : 'motor';
  const mobility = fault.seMueve === true ? 'Sí, se puede mover' : fault.seMueve === false ? 'No se puede mover' : 'No informado';
  const symptomSummary = fault.sintomas?.length ? `${fault.sintomas.slice(0, 3).join(' · ')}${fault.sintomas.length > 3 ? ` +${fault.sintomas.length - 3}` : ''}` : 'Sin síntomas informados';
  const memberSince = fault.autorMiembroDesde || fault.miembroDesde || fault.autorCreadoAt || fault.usuarioCreadoAt;
  const evaluationCount = fault.autorEvaluaciones ?? fault.evaluaciones ?? fault.cantidadEvaluaciones;
  const nextPhoto = (step) => setActivePhoto((current) => (current + step + photos.length) % photos.length);

  return (
    <div className="ft-page ft-detail-page">
      <div className="ft-detail-shell">
        <nav className="ft-detail-breadcrumb" aria-label="Ruta">
          <button type="button" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Volver a resultados</button><i />
          <Link to={ROUTES.home}>Inicio</Link><ChevronRight size={13} /><Link to={ROUTES.faults}>Fallas Automotrices</Link><ChevronRight size={13} />
          <span>{fault.marca}</span><ChevronRight size={13} /><span aria-current="page">Detalle de falla</span>
        </nav>

        <section className="ft-detail-hero-card">
          <div className="ft-detail-gallery">
            <div className="ft-detail-main-photo">
              {photos.length > 0 ? <img src={resolveMediaUrl(photos[activePhoto])} alt={`${vehicleTitle}, foto ${activePhoto + 1}`} /> : <span><Car size={72} /></span>}
              {photos.length > 1 && <><button type="button" className="is-left" onClick={() => nextPhoto(-1)} aria-label="Foto anterior"><ChevronLeft /></button><button type="button" className="is-right" onClick={() => nextPhoto(1)} aria-label="Foto siguiente"><ChevronRight /></button></>}
              {photos.length > 0 && <span className="ft-detail-photo-count"><CameraIcon /> {activePhoto + 1} / {photos.length}</span>}
            </div>
            {photos.length > 1 && <div className="ft-detail-thumbs">{photos.slice(0, 5).map((photo, index) => <button type="button" key={photo} className={index === activePhoto ? 'is-active' : ''} onClick={() => setActivePhoto(index)}><img src={resolveMediaUrl(photo)} alt={`Miniatura ${index + 1}`} /></button>)}</div>}
          </div>

          <div className="ft-detail-hero-copy">
            <div className="ft-detail-title-row"><h1>{vehicleTitle}</h1><span className={`ft-type-pill is-${categoryKey}`}>{selectedCategory ? <span aria-hidden="true">{selectedCategory.emoji}</span> : <Wrench size={16} />} {category}</span></div>
            <p className="ft-detail-vehicle-line">{[fault.anio, fault.combustible || fault.motor, fault.kilometraje != null ? `${fault.kilometraje.toLocaleString('es-CL')} km` : null].filter(Boolean).map((item) => <span key={item}>{item}</span>)}</p>
            <p className="ft-detail-lead">{fault.titulo || 'Falla automotriz sin título'}</p>
            <dl className="ft-detail-case-grid">
              <div><dt>Falla registrada</dt><dd>{fault.titulo || category}</dd></div>
              <div><dt>Estado del vehículo</dt><dd>{mobility}</dd></div>
              <div><dt>Síntomas informados</dt><dd>{symptomSummary}</dd></div>
              <div><dt>Diagnósticos recibidos</dt><dd>{diagnostics.length} {diagnostics.length === 1 ? 'diagnóstico' : 'diagnósticos'}</dd></div>
            </dl>
            <div className="ft-detail-meta"><span><MapPin size={18} /> {place}</span><span><Clock3 size={18} /> Publicado {timeSince(fault.createdAt).toLowerCase()}</span>{fault.visitas != null && <span><Eye size={18} /> {fault.visitas} visitas</span>}</div>
            <div className="ft-detail-hero-actions">{fault.propia && fault.vigente && <button type="button" className="ft-btn ft-btn-primary" onClick={() => setEditing(true)}><Pencil size={17} /> Editar falla</button>}<button type="button" className="ft-detail-icon-action" onClick={share} aria-label="Compartir"><Share2 size={20} /></button>{!fault.propia && <button type="button" className={`ft-btn ft-btn-outline ${saved ? 'is-saved' : ''}`} onClick={() => setSaved((value) => !value)}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Guardado' : 'Guardar'}</button>}</div>
          </div>
        </section>

        <div className="ft-detail-columns">
          <div className="ft-detail-column">
            <div className="ft-detail-case-group">
              <DetailPanel icon={FileText} title="Descripción general"><p>{fault.descripcion || 'Sin descripción general.'}</p></DetailPanel>
              <DetailPanel icon={AlertTriangle} title="¿Qué pasó?" tone="is-alert"><p>{fault.antesDelFallo || fault.descripcion || 'El usuario no agregó más antecedentes.'}</p></DetailPanel>
              <DetailPanel icon={Car} title="Estado actual del vehículo">
                <strong>¿Se puede mover?</strong>
                <div className="ft-mobility-options"><span className={fault.seMueve === false ? 'is-selected' : ''}><Car size={20} /> No se puede mover</span><span className={fault.seMueve === true ? 'is-selected' : ''}><Car size={20} /> Sí se puede mover</span></div>
                <p>{fault.seMueve === false ? 'El vehículo necesita grúa o asistencia para ser trasladado.' : fault.seMueve === true ? 'El vehículo se puede trasladar por sus propios medios.' : 'El usuario no indicó si el vehículo se puede mover.'}</p>
              </DetailPanel>
              <DetailPanel icon={Settings} title="Síntomas"><ul>{fault.sintomas?.length ? fault.sintomas.map((symptom) => <li key={symptom}>{symptom}</li>) : <li>Sin síntomas adicionales registrados.</li>}</ul></DetailPanel>
            </div>
          </div>

          <div className="ft-detail-column is-side">
            <DetailPanel icon={Car} title="Información del vehículo"><dl className="ft-detail-table"><div><dt>Marca</dt><dd>{fault.marca || '—'}</dd></div><div><dt>Modelo</dt><dd>{fault.modelo || '—'}</dd></div><div><dt>Año</dt><dd>{fault.anio || '—'}</dd></div><div><dt>Combustible</dt><dd>{fault.combustible || fault.motor || '—'}</dd></div><div><dt>Kilometraje</dt><dd>{fault.kilometraje != null ? `${fault.kilometraje.toLocaleString('es-CL')} km` : '—'}</dd></div><div><dt>Chasis</dt><dd>{fault.chasis || fault.vin || '—'}</dd></div>{showPlate && fault.propia && <div><dt>Patente</dt><dd>{fault.patente || '—'}</dd></div>}</dl></DetailPanel>
            <DetailPanel icon={MapPinned} title="Ubicación del vehículo">
              <div className="ft-location-card">
                <div className="ft-detail-map" aria-hidden="true">
                  <span className="ft-map-marker"><MapsPinIcon /></span>
                </div>
                <div className="ft-location-content">
                  <small>Ubicación aproximada</small>
                  <strong>{place || 'Ubicación no informada'}</strong>
                  {place && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`} target="_blank" rel="noreferrer">Abrir ubicación en Google Maps <ExternalLink size={14} /></a>}
                </div>
              </div>
            </DetailPanel>
            <DetailPanel icon={UserRound} title="Información del usuario">
              <div className="ft-user-profile"><span>{(fault.autor || 'U').slice(0, 1).toUpperCase()}</span><div><strong>{fault.autor || 'Usuario de RepuesTop'}</strong><small>Persona que registró esta falla</small></div></div>
              <dl className="ft-user-facts">
                <div><dt>Miembro desde</dt><dd>{formatMonthYear(memberSince)}</dd></div>
                <div><dt>Fallas publicadas</dt><dd>{fault.fallasPublicadas ?? '—'}</dd></div>
                <div><dt>Diagnósticos en este caso</dt><dd>{diagnostics.length}</dd></div>
                <div><dt>Ubicación declarada</dt><dd>{place || 'No informada'}</dd></div>
              </dl>
              {fault.autorRating != null && <div className="ft-detail-rating"><span>{[1, 2, 3, 4, 5].map((item) => <Star key={item} size={15} fill="currentColor" />)}</span><strong>{fault.autorRating}</strong>{evaluationCount != null && <small>({evaluationCount} {evaluationCount === 1 ? 'evaluación' : 'evaluaciones'})</small>}</div>}
            </DetailPanel>
          </div>
        </div>

        <section className="ft-detail-thread-section is-private">
          <header><div><h2><Wrench size={23} /> Diagnósticos de talleres (privado)</h2><p>Los siguientes diagnósticos son visibles solo para talleres registrados y el dueño de la falla.</p></div><span className="ft-private-pill"><Lock size={14} /> Solo talleres</span></header>
          {diagnostics.length === 0 ? <div className="ft-detail-thread-empty">Aún no hay diagnósticos registrados.</div> : diagnostics.map((diagnosis) => <article key={diagnosis.id} className="ft-detail-diagnosis-row"><span className="ft-thread-avatar"><Wrench size={15} /></span><strong>{diagnosis.autor}</strong><time>{timeSince(diagnosis.createdAt)}</time><p>Diagnóstico y posible causa registrada.</p><button type="button" onClick={() => setDiagModal(diagnosis.id)}><Settings size={14} /> Ver diagnóstico</button><ChevronDown size={15} /></article>)}
          {isWorkshop && fault.vigente && <button type="button" className="ft-btn ft-btn-primary ft-detail-diagnose" onClick={() => setDiagModal(myDiagnosis ? myDiagnosis.id : 'new')}>{myDiagnosis ? 'Ver mi diagnóstico' : 'Agregar diagnóstico'}</button>}
        </section>

        <section className="ft-detail-thread-section is-public">
          <header><div><h2><MessageCircle size={23} /> Comentarios (público)</h2><p>Los comentarios ayudan a afinar el diagnóstico. Todos los talleres pueden ver y comentar.</p></div>{!fault.propia && publicDiagnoses.length > 0 && <button type="button" className="ft-btn ft-btn-outline" onClick={() => setPublicDiagnosesOpen(true)}><Wrench size={16} /> Ver diagnósticos ({publicDiagnoses.length})</button>}{isWorkshop && fault.vigente && <button type="button" className="ft-btn ft-btn-primary" onClick={() => setCommentFormOpen((value) => !value)}><MessageCircle size={16} /> Agregar comentario</button>}</header>
          {publicComments.length === 0 && !commentFormOpen ? <div className="ft-detail-thread-empty">Aún no hay comentarios públicos.</div> : publicComments.map((comment) => <article key={comment.id} className="ft-detail-comment-row"><span className="ft-thread-avatar"><Wrench size={15} /></span><strong>{comment.autor}</strong><time>{timeSince(comment.createdAt)}</time><p>{comment.texto}</p>{repliesOf(comment.id).map((reply) => <small key={reply.id}>{reply.autor}: {reply.texto}</small>)}</article>)}
          {commentFormOpen && <form className="ft-detail-comment-form" onSubmit={(event) => send(event, 'COMENTARIO')}><textarea rows={3} value={publicText} maxLength={1500} onChange={(event) => setPublicText(event.target.value)} placeholder="Escribe una pregunta o comentario para afinar el diagnóstico" />{formError && <p className="ft-error"><AlertCircle size={15} /> {formError}</p>}<div><button type="button" className="ft-btn ft-btn-outline" onClick={() => setCommentFormOpen(false)}>Cancelar</button><button type="submit" className="ft-btn ft-btn-primary" disabled={sending || !publicText.trim()}>{sending ? 'Publicando…' : 'Publicar comentario'}</button></div></form>}
        </section>

        {fault.propia && fault.vigente && <div className="ft-detail-owner-actions"><button type="button" className="ft-btn ft-btn-danger" onClick={close}>Cerrar falla</button></div>}
      </div>

      {publicDiagnosesOpen && <div className="ft-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setPublicDiagnosesOpen(false)}><div className="ft-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ft-modal-head"><h2><Wrench size={16} /> Diagnósticos recibidos ({publicDiagnoses.length})</h2><button type="button" className="ft-icon-btn" aria-label="Cerrar" onClick={() => setPublicDiagnosesOpen(false)}><X size={20} /></button></div>
        <div className="ft-public-diagnoses">
          <p>Esta falla ya está recibiendo diagnósticos de talleres. El detalle es privado: solo lo ve quien la publicó.</p>
          {publicDiagnoses.map((item) => <Link key={`${item.tallerId}-${item.createdAt}`} className="ft-public-diagnosis" to={workshopPath(item.tallerId)}><span className="ft-thread-avatar"><Wrench size={15} /></span><strong>{item.nombre}</strong><small>{[item.comuna, timeSince(item.createdAt)].filter(Boolean).join(' · ')}</small>{item.aceptado && <em>Aceptado</em>}<ChevronRight size={15} /></Link>)}
        </div>
      </div></div>}
      {diagModal != null && <div className="ft-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setDiagModal(null)}><div className="ft-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ft-modal-head"><h2><Lock size={16} /> {diagModal === 'new' ? 'Registrar diagnóstico' : 'Diagnóstico privado'}</h2><button type="button" className="ft-icon-btn" aria-label="Cerrar" onClick={() => setDiagModal(null)}><X size={20} /></button></div>
        {diagModal === 'new' && eligibility === undefined ? <div className="ft-empty"><Loader2 size={18} className="spin-icon" /> Comprobando…</div>
          : diagModal === 'new' && eligibility?.habilitado !== true ? <div className="ft-form"><p>Para registrar un diagnóstico privado necesitas tener activo el servicio Diagnóstico o un anuncio Empresarial.</p><div className="ft-actions"><Link className="ft-btn ft-btn-primary" to={profilePath('servicios_taller')}>Ir a Mis servicios</Link><Link className="ft-btn ft-btn-outline" to={profilePath('anuncios')}>Ir a Anuncios</Link></div></div>
            : diagModal === 'new' ? <form className="ft-form" onSubmit={(event) => send(event, 'DIAGNOSTICO')}><p className="ft-sub">Solo el cliente y tú podrán verlo.</p><label className="ft-field"><span>Diagnóstico</span><textarea rows={5} value={text} maxLength={1500} onChange={(event) => setText(event.target.value)} placeholder="Posible causa, revisión y solución" /></label><div className="ft-row"><label className="ft-field"><span>Precio desde</span><input inputMode="numeric" value={priceFrom} onChange={(event) => setPriceFrom(event.target.value.replace(/\D/g, ''))} /></label><label className="ft-field"><span>Precio hasta</span><input inputMode="numeric" value={priceTo} onChange={(event) => setPriceTo(event.target.value.replace(/\D/g, ''))} /></label></div>{formError && <p className="ft-error"><AlertCircle size={15} /> {formError}</p>}<button type="submit" className="ft-btn ft-btn-primary" disabled={sending || !text.trim()}>{sending ? 'Registrando…' : 'Registrar diagnóstico'}</button></form>
              : openDiagnosis ? <div className="ft-form"><p><strong>{openDiagnosis.autor}</strong> · {timeSince(openDiagnosis.createdAt)} {openDiagnosis.taller && <><br /><Link className="ft-link-sub" to={workshopPath(openDiagnosis.taller.tallerId)}>Ver perfil del taller ›</Link></>}</p><p>{openDiagnosis.texto}</p>{priceRange(openDiagnosis.precioDesde, openDiagnosis.precioHasta) && <span className="ft-price"><Tag size={14} /> Precio estimado: {priceRange(openDiagnosis.precioDesde, openDiagnosis.precioHasta)}</span>}{repliesOf(openDiagnosis.id).map((reply) => <div key={reply.id} className="ft-reply"><small>{reply.autor}</small>{reply.texto}</div>)}<div className="ft-actions">{fault.propia && fault.vigente && !openDiagnosis.aceptado && <button type="button" className="ft-btn ft-btn-primary" disabled={accepting} onClick={() => accept(openDiagnosis.id)}>{accepting ? 'Aceptando…' : 'Aceptar diagnóstico'}</button>}{fault.propia && openDiagnosis.aceptado && openDiagnosis.taller?.puedeAgendar && openDiagnosis.taller?.agendaAnuncioId && <button type="button" className="ft-btn ft-btn-primary" disabled={loadingBookingId != null} onClick={() => openBooking(openDiagnosis.taller.agendaAnuncioId)}><CalendarPlus size={16} /> Agendar cita</button>}</div></div> : null}
      </div></div>}

      {booking && <AdAppointmentModal adOrCompany={booking} fallaContext={{ id: fault.id, patente: fault.patente, vehiculo: vehicle, titulo: fault.titulo }} onClose={() => setBooking(null)} />}
      {fault.propia && <CreateFaultModal isOpen={editing} fault={fault} onClose={() => setEditing(false)} onUpdated={async () => { setEditing(false); await load(); }} />}
    </div>
  );
}

function CameraIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z" /><circle cx="12" cy="13" r="3" /></svg>;
}

function MapsPinIcon() {
  return <svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true"><path fill="#EA4335" d="M16 1C7.7 1 1 7.7 1 16c0 10.9 15 25 15 25s15-14.1 15-25C31 7.7 24.3 1 16 1Z" /><path fill="#FBBC04" d="M5.4 6.2A14.9 14.9 0 0 0 1 16c0 4.4 2.5 9.5 5.5 13.8L16 16 5.4 6.2Z" /><path fill="#34A853" d="M16 41s15-14.1 15-25c0-3.8-1.4-7.3-3.7-9.9L16 16v25Z" /><circle cx="16" cy="16" r="6.2" fill="#4285F4" stroke="#fff" strokeWidth="3" /></svg>;
}
