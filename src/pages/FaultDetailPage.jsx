import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, ArrowLeft, Bookmark, CalendarPlus, Car, ChevronDown,
  ChevronLeft, ChevronRight, Clock3, Eye, ExternalLink, FileText,
  Loader2, Lock, MapPin, MapPinned, MessageCircle, Navigation, Pencil, Settings, Share2, Star, Tag, Truck, UserRound,
  Wrench, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  acceptFaultDiagnosis, closeFault, commentFault, getDiagnosisEligibility, getFault,
  getFaultComments, getPublicDiagnoses, priceRange, timeSince,
} from '../services/faultApi';
import { resolveMediaUrl } from '../services/api';
import { fetchTaller } from '../services/talleresStorage';
import { SERVICE_CATEGORIES } from '../data/talleresData';
import BookingModal from '../components/talleres/BookingModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ContextualReportButton from '../components/ContextualReportButton';
import CreateFaultModal from '../components/faults/CreateFaultModal';
import { ROUTES, profilePath, workshopPath } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { useUserLocation } from '../hooks/useUserLocation';
import { useSavedMarketplaceItems } from '../hooks/useSavedMarketplaceItems';
import { formatDistanceKm, haversineDistanceKm } from '../utils/geoDistance';
import { MAX_PRICE, onlyDigits } from '../utils/inputLimits';
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
  const { user, role, isLoggedIn } = useAuth();
  const { isFaultSaved, toggleFault } = useSavedMarketplaceItems(user?.userId ?? user?.id ?? null);
  const isWorkshop = role === 'WORKSHOP';
  useDocumentTitle('Falla automotriz');
  // Posición del taller para medir la distancia al cliente: se lee sola si el permiso ya estaba concedido.
  const userLocation = useUserLocation();

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
  // Respuesta del cliente a un diagnostico o comentario: `replyTo` es el id del comentario que responde.
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [booking, setBooking] = useState(null);
  const [loadingBookingId, setLoadingBookingId] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [commentFormOpen, setCommentFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');
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

  /** Diagnostico privado nuevo (`DIAGNOSTICO`, con precio estimado) o comentario publico (`COMENTARIO`) de un taller. */
  const send = async (event, kind) => {
    event.preventDefault();
    const body = kind === 'COMENTARIO' ? publicText.trim() : text.trim();
    if (!body || !fault) return;
    setSending(true);
    setFormError('');
    try {
      const from = parseInt(priceFrom.replace(/\D/g, ''), 10);
      const to = parseInt(priceTo.replace(/\D/g, ''), 10);
      const isDiagnosis = kind === 'DIAGNOSTICO';
      if (isDiagnosis && Number.isFinite(from) && Number.isFinite(to) && to < from) {
        setFormError('El precio "hasta" no puede ser menor que el precio "desde".');
        return;
      }
      await commentFault(fault.id, {
        texto: body,
        tipo: kind,
        precioDesde: isDiagnosis && Number.isFinite(from) ? from : null,
        precioHasta: isDiagnosis && Number.isFinite(to) ? to : null,
      });
      setText(''); setPublicText(''); setPriceFrom(''); setPriceTo('');
      setDiagModal(null); setCommentFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err?.message || 'No pudimos publicar tu comentario.');
    } finally {
      setSending(false);
    }
  };

  // Solo el cliente que registro la falla responde (al diagnostico o al comentario de un taller); el backend lo exige
  // y avisa al taller. Sin datos de contacto: el telefono se acepta solo en el diagnostico con una cita confirmada.
  const startReply = (commentId) => { setReplyTo(commentId); setReplyText(''); setReplyError(''); };
  const sendReply = async (event) => {
    event.preventDefault();
    const body = replyText.trim();
    if (!body || !fault || replyTo == null) return;
    setSending(true);
    setReplyError('');
    try {
      await commentFault(fault.id, { texto: body, respondeAId: replyTo });
      setReplyText(''); setReplyTo(null);
      await load();
    } catch (err) {
      setReplyError(err?.message || 'No pudimos enviar tu respuesta.');
    } finally {
      setSending(false);
    }
  };
  const canReply = fault?.propia && fault?.vigente;
  const replyForm = (commentId, placeholder) => replyTo === commentId && (
    <form className="ft-detail-comment-form ft-reply-form" onSubmit={sendReply}>
      <textarea rows={2} value={replyText} maxLength={1500} onChange={(event) => setReplyText(event.target.value)} placeholder={placeholder} autoFocus />
      {replyError && <p className="ft-error" role="alert"><AlertCircle size={15} /> {replyError}</p>}
      <div><button type="button" className="ft-btn ft-btn-outline" onClick={() => setReplyTo(null)} disabled={sending}>Cancelar</button><button type="submit" className="ft-btn ft-btn-primary" disabled={sending || !replyText.trim()}>{sending ? 'Enviando…' : 'Responder'}</button></div>
    </form>
  );
  // Reportar es para contenido ajeno: el backend rechaza reportar lo propio.
  const isMine = (comment) => comment.esCreador ? Boolean(fault?.propia) : Boolean(comment.taller && String(comment.taller.usuarioId) === myId);

  const accept = async (commentId) => {
    setAccepting(true);
    try { await acceptFaultDiagnosis(fault.id, commentId); await load(); }
    catch (err) { setFormError(err?.message || 'No pudimos aceptar el diagnóstico.'); }
    finally { setAccepting(false); }
  };

  const close = async () => {
    if (!fault) return;
    setClosing(true);
    setCloseError('');
    try { setFault(await closeFault(fault.id)); setCloseConfirm(false); }
    catch (err) { setCloseError(err?.message || 'No pudimos cerrar la falla.'); }
    finally { setClosing(false); }
  };

  // La cita se pide al taller del diagnostico aceptado: sus bloques salen de su "Horario principal".
  const openBooking = async (tallerId) => {
    setLoadingBookingId(tallerId);
    setFormError('');
    try { setBooking(await fetchTaller(tallerId)); }
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
  // Mapa: el punto exacto del cliente si lo dio; si no, su dirección de recogida o la comuna (aproximado).
  const hasPoint = fault.latitud != null && fault.longitud != null;
  const mapText = [fault.direccionRecogida, place].filter(Boolean).join(', ');
  const mapQuery = hasPoint ? `${fault.latitud},${fault.longitud}` : mapText ? encodeURIComponent(mapText) : '';
  const distanceKm = isWorkshop && hasPoint && userLocation.coords
    ? haversineDistanceKm(userLocation.coords, { latitude: Number(fault.latitud), longitude: Number(fault.longitud) })
    : null;
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
  // El dueño ve todos los diagnósticos; los demás reciben solo el propio (taller) o ninguno: el total sale del resumen público.
  const diagnosisCount = fault.propia ? diagnostics.length : Math.max(diagnostics.length, publicDiagnoses.length);
  const saved = isFaultSaved(fault.id);
  // Copia para Favoritos (en el navegador, como la app): lo que pinta la tarjeta del mural, sin patente ni ubicacion exacta.
  const toggleSaved = () => toggleFault({
    id: fault.id, titulo: fault.titulo, descripcion: fault.descripcion, antesDelFallo: fault.antesDelFallo,
    marca: fault.marca, modelo: fault.modelo, anio: fault.anio, motor: fault.motor, combustible: fault.combustible,
    comuna: fault.comuna, region: fault.region, categoria: fault.categoria, subcategoria: fault.subcategoria,
    sintomas: fault.sintomas, seMueve: fault.seMueve, requiereRecogida: fault.requiereRecogida,
    fotoVehiculo: fault.fotoVehiculo || fault.fotoUrl, fotos: fault.fotos, cantidadDiagnosticos: diagnosisCount,
    createdAt: fault.createdAt, vigente: fault.vigente,
  });
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
              <div><dt>Servicio relacionado</dt><dd>{fault.subcategoria || fault.titulo || category}</dd></div>
              <div><dt>Estado del vehículo</dt><dd>{mobility}</dd></div>
              <div><dt>Síntomas informados</dt><dd>{symptomSummary}</dd></div>
              <div><dt>Diagnósticos recibidos</dt><dd>{diagnosisCount} {diagnosisCount === 1 ? 'diagnóstico' : 'diagnósticos'}</dd></div>
            </dl>
            <div className="ft-detail-meta"><span><MapPin size={18} /> {place}</span>{fault.requiereRecogida && <span className="ft-pickup-meta"><Truck size={18} /> Requiere recogida del vehículo</span>}<span><Clock3 size={18} /> Publicado {timeSince(fault.createdAt).toLowerCase()}</span>{fault.visitas != null && <span><Eye size={18} /> {fault.visitas} visitas</span>}</div>
            {fault.requiereRecogida && (
              <p className="ft-pickup-alert" role="note"><Truck size={20} aria-hidden="true" /> {fault.propia ? 'Pediste que el taller vaya a buscar tu vehículo.' : 'Este cliente necesita que vayan a buscar el vehículo.'}</p>
            )}
            <div className="ft-detail-hero-actions">{fault.propia && fault.vigente && <button type="button" className="ft-btn ft-btn-primary" onClick={() => setEditing(true)}><Pencil size={17} /> Editar falla</button>}<button type="button" className="ft-detail-icon-action" onClick={share} aria-label="Compartir"><Share2 size={20} /></button>{!fault.propia && isLoggedIn && <button type="button" className={`ft-btn ft-btn-outline ${saved ? 'is-saved' : ''}`} aria-pressed={saved} onClick={toggleSaved}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Guardado' : 'Guardar'}</button>}{!fault.propia && <ContextualReportButton tipoObjeto="FALLA" objetoId={fault.id} objetoTitulo={fault.titulo} className="ft-btn ft-btn-outline" />}</div>
          </div>
        </section>

        <div className="ft-detail-columns">
          <div className="ft-detail-column">
            <div className="ft-detail-case-group">
              <DetailPanel icon={AlertTriangle} title="¿Qué pasó?" tone="is-alert"><p>{fault.descripcion || 'El usuario no describió lo que pasó.'}</p></DetailPanel>
              <DetailPanel icon={FileText} title="Qué pasaba antes del fallo"><p>{fault.antesDelFallo || 'El usuario no agregó antecedentes previos.'}</p></DetailPanel>
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
            {/* El mapa solo aparece si el cliente pidió que vayan por el vehículo: es hasta donde debe llegar el taller. */}
            {fault.requiereRecogida && (
            <DetailPanel icon={MapPinned} title="Ubicación del cliente">
              <div className={`ft-location-card ${mapQuery ? 'is-live' : ''}`}>
                {mapQuery ? (
                  <div className="ft-live-map">
                    <iframe
                      title="Mapa de la ubicación del cliente"
                      src={`https://maps.google.com/maps?q=${mapQuery}&z=${hasPoint ? 16 : 13}&output=embed`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                ) : (
                  <div className="ft-detail-map" aria-hidden="true">
                    <span className="ft-map-marker"><MapsPinIcon /></span>
                  </div>
                )}
                <div className="ft-location-content">
                  {fault.requiereRecogida && (
                    <span className="ft-pickup-badge"><Truck size={14} aria-hidden="true" /> El cliente necesita que vengan por el vehículo</span>
                  )}
                  <small>{hasPoint ? 'Ubicación exacta' : 'Ubicación aproximada'}</small>
                  <strong>{fault.direccionRecogida || place || 'Ubicación no informada'}</strong>
                  {fault.direccionRecogida && place && <span className="ft-location-place">{place}</span>}
                  {isWorkshop && hasPoint && (
                    distanceKm != null ? (
                      <p className="ft-distance"><Navigation size={14} aria-hidden="true" /> A <strong>{formatDistanceKm(distanceKm)}</strong> de ti, en línea recta</p>
                    ) : (
                      <button type="button" className="ft-distance-btn" onClick={userLocation.requestLocation} disabled={userLocation.status === 'loading'}>
                        {userLocation.status === 'loading' ? <Loader2 size={14} className="spin-icon" /> : <Navigation size={14} aria-hidden="true" />}
                        {userLocation.status === 'denied' ? 'Permite tu ubicación para ver la distancia' : 'Ver a qué distancia está'}
                      </button>
                    )
                  )}
                  {(hasPoint || place || fault.direccionRecogida) && (
                    <a href={hasPoint ? `https://www.google.com/maps/search/?api=1&query=${fault.latitud},${fault.longitud}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([fault.direccionRecogida, place].filter(Boolean).join(', '))}`} target="_blank" rel="noreferrer">Abrir ubicación en Google Maps <ExternalLink size={14} /></a>
                  )}
                </div>
              </div>
            </DetailPanel>
            )}
            <DetailPanel icon={UserRound} title="Información del usuario">
              <div className="ft-user-profile"><span>{(fault.autor || 'U').slice(0, 1).toUpperCase()}</span><div><strong>{fault.autor || 'Usuario de RepuesTop'}</strong><small>Persona que registró esta falla</small></div></div>
              <dl className="ft-user-facts">
                <div><dt>Miembro desde</dt><dd>{formatMonthYear(memberSince)}</dd></div>
                <div><dt>Fallas publicadas</dt><dd>{fault.fallasPublicadas ?? '—'}</dd></div>
                <div><dt>Diagnósticos en este caso</dt><dd>{diagnosisCount}</dd></div>
                <div><dt>Ubicación declarada</dt><dd>{place || 'No informada'}</dd></div>
              </dl>
              {fault.autorRating != null && <div className="ft-detail-rating"><span>{[1, 2, 3, 4, 5].map((item) => <Star key={item} size={15} fill="currentColor" />)}</span><strong>{fault.autorRating}</strong>{evaluationCount != null && <small>({evaluationCount} {evaluationCount === 1 ? 'evaluación' : 'evaluaciones'})</small>}</div>}
            </DetailPanel>
          </div>
        </div>

        <section className="ft-detail-thread-section is-private">
          <header><div><h2><Wrench size={23} /> Diagnósticos de talleres (privado)</h2><p>{fault.propia ? 'Cada diagnóstico lo ven solo tú y el taller que lo escribió. Compáralos y acepta el que te convenza para agendar.' : isWorkshop ? 'Tu diagnóstico lo ven solo tú y el cliente. Los de otros talleres no se muestran.' : 'Los diagnósticos son privados entre el cliente y cada taller.'}</p></div><span className="ft-private-pill"><Lock size={14} /> Privado</span></header>
          {diagnostics.length === 0 ? <div className="ft-detail-thread-empty">{!fault.propia && !isWorkshop && publicDiagnoses.length > 0 ? `${publicDiagnoses.length} ${publicDiagnoses.length === 1 ? 'taller ya diagnosticó' : 'talleres ya diagnosticaron'} esta falla. El detalle solo lo ve quien la publicó.` : 'Aún no hay diagnósticos registrados.'}</div> : diagnostics.map((diagnosis) => {
            const price = priceRange(diagnosis.precioDesde, diagnosis.precioHasta);
            const replies = repliesOf(diagnosis.id).length;
            return <article key={diagnosis.id} className={`ft-detail-diagnosis-row ${diagnosis.aceptado ? 'is-accepted' : ''}`}><span className="ft-thread-avatar"><Wrench size={15} /></span><strong>{diagnosis.autor}{diagnosis.aceptado && <em className="ft-accepted-pill">Aceptado</em>}</strong><time>{timeSince(diagnosis.createdAt)}</time><p>{diagnosis.texto}</p><span className="ft-diagnosis-facts"><span className="ft-price"><Tag size={13} /> {price || 'Sin precio estimado'}</span>{replies > 0 && <span><MessageCircle size={13} /> {replies} {replies === 1 ? 'respuesta' : 'respuestas'}</span>}</span><button type="button" onClick={() => setDiagModal(diagnosis.id)}><Settings size={14} /> Ver diagnóstico</button><ChevronDown size={15} /></article>;
          })}
          {isWorkshop && fault.vigente && <button type="button" className="ft-btn ft-btn-primary ft-detail-diagnose" onClick={() => setDiagModal(myDiagnosis ? myDiagnosis.id : 'new')}>{myDiagnosis ? 'Ver mi diagnóstico' : 'Agregar diagnóstico'}</button>}
        </section>

        <section className="ft-detail-thread-section is-public">
          <header><div><h2><MessageCircle size={23} /> Comentarios (público)</h2><p>Los comentarios ayudan a afinar el diagnóstico. Todos los talleres pueden ver y comentar.</p></div>{!fault.propia && publicDiagnoses.length > 0 && <button type="button" className="ft-btn ft-btn-outline" onClick={() => setPublicDiagnosesOpen(true)}><Wrench size={16} /> Ver diagnósticos ({publicDiagnoses.length})</button>}{isWorkshop && fault.vigente && <button type="button" className="ft-btn ft-btn-primary" onClick={() => setCommentFormOpen((value) => !value)}><MessageCircle size={16} /> Agregar comentario</button>}</header>
          {publicComments.length === 0 && !commentFormOpen ? <div className="ft-detail-thread-empty">Aún no hay comentarios públicos.</div> : publicComments.map((comment) => <article key={comment.id} className="ft-detail-comment-row"><span className="ft-thread-avatar"><Wrench size={15} /></span><strong>{comment.autor}</strong><time>{timeSince(comment.createdAt)}</time><p>{comment.texto}</p>{repliesOf(comment.id).map((reply) => <small key={reply.id} className="ft-comment-reply"><b>{reply.esCreador ? 'Cliente' : reply.autor}:</b> {reply.texto}</small>)}<span className="ft-comment-actions">{canReply && replyTo !== comment.id && <button type="button" className="ft-link-btn" onClick={() => startReply(comment.id)}>Responder</button>}{!isMine(comment) && <ContextualReportButton tipoObjeto="FALLA_COMENTARIO" objetoId={comment.id} objetoTitulo={`Comentario de ${comment.autor}`} className="ft-link-btn" />}</span>{replyForm(comment.id, 'Responde al taller')}</article>)}
          {commentFormOpen && <form className="ft-detail-comment-form" onSubmit={(event) => send(event, 'COMENTARIO')}><textarea rows={3} value={publicText} maxLength={1500} onChange={(event) => setPublicText(event.target.value)} placeholder="Escribe una pregunta o comentario para afinar el diagnóstico" />{formError && <p className="ft-error"><AlertCircle size={15} /> {formError}</p>}<div><button type="button" className="ft-btn ft-btn-outline" onClick={() => setCommentFormOpen(false)}>Cancelar</button><button type="submit" className="ft-btn ft-btn-primary" disabled={sending || !publicText.trim()}>{sending ? 'Publicando…' : 'Publicar comentario'}</button></div></form>}
        </section>

        {fault.propia && fault.vigente && <div className="ft-detail-owner-actions"><button type="button" className="ft-btn ft-btn-danger" onClick={() => { setCloseError(''); setCloseConfirm(true); }}>Cerrar falla</button></div>}
      </div>

      {publicDiagnosesOpen && <div className="ft-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setPublicDiagnosesOpen(false)}><div className="ft-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ft-modal-head"><h2><Wrench size={16} /> Diagnósticos recibidos ({publicDiagnoses.length})</h2><button type="button" className="ft-icon-btn" aria-label="Cerrar" onClick={() => setPublicDiagnosesOpen(false)}><X size={20} /></button></div>
        <div className="ft-public-diagnoses">
          <p>Esta falla ya está recibiendo diagnósticos de talleres. El detalle es privado: solo lo ve quien la publicó.</p>
          {publicDiagnoses.map((item) => <Link key={`${item.tallerId}-${item.createdAt}`} className="ft-public-diagnosis" to={workshopPath(item.tallerId)}><span className="ft-thread-avatar"><Wrench size={15} /></span><strong>{item.nombre}</strong><small>{[item.comuna, timeSince(item.createdAt)].filter(Boolean).join(' · ')}</small>{item.aceptado && <em>Aceptado</em>}<ChevronRight size={15} /></Link>)}
        </div>
      </div></div>}
      {diagModal != null && <div className="ft-modal-backdrop" role="dialog" aria-modal="true" onClick={() => { setDiagModal(null); setReplyTo(null); }}><div className="ft-modal" onClick={(event) => event.stopPropagation()}>
        <div className="ft-modal-head"><h2><Lock size={16} /> {diagModal === 'new' ? 'Registrar diagnóstico' : 'Diagnóstico privado'}</h2><button type="button" className="ft-icon-btn" aria-label="Cerrar" onClick={() => { setDiagModal(null); setReplyTo(null); }}><X size={20} /></button></div>
        {diagModal === 'new' && eligibility === undefined ? <div className="ft-empty"><Loader2 size={18} className="spin-icon" /> Comprobando…</div>
          : diagModal === 'new' && eligibility?.habilitado !== true ? <div className="ft-form"><p>Para registrar un diagnóstico privado necesitas tener activo el servicio Diagnóstico.</p><div className="ft-actions"><Link className="ft-btn ft-btn-primary" to={profilePath('diagnostico')}>Activar Diagnóstico</Link></div></div>
            : diagModal === 'new' ? <form className="ft-form" onSubmit={(event) => send(event, 'DIAGNOSTICO')}><p className="ft-sub">Solo el cliente y tú podrán verlo.</p><label className="ft-field"><span>Diagnóstico</span><textarea rows={5} value={text} maxLength={1500} onChange={(event) => setText(event.target.value)} placeholder="Posible causa, revisión y solución" /></label><div className="ft-row"><label className="ft-field"><span>Precio desde</span><input inputMode="numeric" maxLength={9} value={priceFrom} onChange={(event) => setPriceFrom(onlyDigits(event.target.value, 9))} placeholder={`Hasta $${MAX_PRICE.toLocaleString('es-CL')}`} /></label><label className="ft-field"><span>Precio hasta</span><input inputMode="numeric" maxLength={9} value={priceTo} onChange={(event) => setPriceTo(onlyDigits(event.target.value, 9))} /></label></div>{formError && <p className="ft-error"><AlertCircle size={15} /> {formError}</p>}<button type="submit" className="ft-btn ft-btn-primary" disabled={sending || !text.trim()}>{sending ? 'Registrando…' : 'Registrar diagnóstico'}</button></form>
              : openDiagnosis ? <div className="ft-form"><p><strong>{openDiagnosis.autor}</strong> · {timeSince(openDiagnosis.createdAt)} {openDiagnosis.taller && <><br /><Link className="ft-link-sub" to={workshopPath(openDiagnosis.taller.tallerId)}>Ver perfil del taller ›</Link></>}</p><p>{openDiagnosis.texto}</p>{priceRange(openDiagnosis.precioDesde, openDiagnosis.precioHasta) && <span className="ft-price"><Tag size={14} /> Precio estimado: {priceRange(openDiagnosis.precioDesde, openDiagnosis.precioHasta)}</span>}{repliesOf(openDiagnosis.id).map((reply) => <div key={reply.id} className="ft-reply"><small>{reply.esCreador ? (fault.propia ? 'Tú' : 'Cliente') : reply.autor}</small>{reply.texto}</div>)}{canReply && replyTo !== openDiagnosis.id && <button type="button" className="ft-link-btn" onClick={() => startReply(openDiagnosis.id)}><MessageCircle size={14} /> Responder al taller</button>}{replyForm(openDiagnosis.id, 'Pregúntale al taller o confirma detalles del diagnóstico')}<div className="ft-actions">{fault.propia && fault.vigente && !openDiagnosis.aceptado && <button type="button" className="ft-btn ft-btn-primary" disabled={accepting} onClick={() => accept(openDiagnosis.id)}>{accepting ? 'Aceptando…' : 'Aceptar diagnóstico'}</button>}{fault.propia && openDiagnosis.aceptado && openDiagnosis.taller?.puedeAgendar && <button type="button" className="ft-btn ft-btn-primary" disabled={loadingBookingId != null} onClick={() => openBooking(openDiagnosis.taller.tallerId)}>{loadingBookingId != null ? <Loader2 size={16} className="spin-icon" /> : <CalendarPlus size={16} />} Agendar cita</button>}{fault.propia && <ContextualReportButton tipoObjeto="FALLA_COMENTARIO" objetoId={openDiagnosis.id} objetoTitulo={`Diagnóstico de ${openDiagnosis.autor}`} className="ft-btn ft-btn-outline" />}</div>{formError && <p className="ft-error" role="alert"><AlertCircle size={15} /> {formError}</p>}</div> : null}
      </div></div>}

      {booking && <BookingModal taller={booking} fallaContext={{ id: fault.id, patente: fault.patente, vehiculo: vehicle, titulo: fault.titulo }} onClose={() => setBooking(null)} />}
      <ConfirmDialog
        isOpen={closeConfirm}
        title="Cerrar falla"
        message="Al cerrarla dejará de verse en el mural público y los talleres no podrán comentarla ni enviarte más diagnósticos. Si más adelante necesitas más diagnósticos, tendrás que volver a publicarla."
        confirmLabel="Sí, cerrar falla"
        isBusy={closing}
        error={closeError}
        onConfirm={close}
        onCancel={() => setCloseConfirm(false)}
      />
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
