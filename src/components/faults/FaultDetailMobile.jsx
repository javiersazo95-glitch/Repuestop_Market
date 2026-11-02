import React, { useMemo, useState } from 'react';
import TallerRating from '../talleres/TallerRating';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, Bookmark, Calendar, Car, Check, ChevronDown, ChevronRight, ChevronUp, Copy, ExternalLink,
  Lock, MapPin, Megaphone, MessageCircle, Navigation, Pencil, Share2, Signal, Tag, Truck, UserRound, Wrench, X,
} from 'lucide-react';
import ContextualReportButton from '../ContextualReportButton';
import VehicleBrandLogo from '../VehicleBrandLogo';
import CharCount from './CharCount';
import { resolveMediaUrl } from '../../services/api';
import { priceRange, scopeText, timeSince } from '../../services/faultApi';
import { formatDistanceKm } from '../../utils/geoDistance';
import { workshopPath } from '../../routes/paths';
import '../../styles/app-kit.css';
import '../../styles/fault-detail-mobile.css';

/** Prioridad que registró el comprador; en fallas antiguas se deduce: un vehículo inmovilizado es lo más urgente. */
function priorityOf(fault) {
  if (fault.prioridad === 'ALTA') return { label: 'Alta', tone: 'is-high' };
  if (fault.prioridad === 'MEDIA') return { label: 'Media', tone: 'is-mid' };
  if (fault.prioridad === 'BAJA') return { label: 'Baja', tone: 'is-low' };
  if (fault.seMueve === false) return { label: 'Alta', tone: 'is-high' };
  if ((fault.sintomas?.length || 0) > 1) return { label: 'Media', tone: 'is-mid' };
  return { label: 'Baja', tone: 'is-low' };
}

const publishedOn = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'No informada';
};

function InfoItem({ icon: Icon, label, children }) {
  return (
    <div className="ftd-info-item">
      <Icon size={14} aria-hidden="true" />
      <div><small>{label}</small><span>{children}</span></div>
    </div>
  );
}

function Avatar({ name, src }) {
  return (
    <span className="ftd-avatar">
      {src ? <img src={resolveMediaUrl(src)} alt="" /> : (name || 'T').slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * Detalle de la falla en el celular: el de la app (`mobile/app/fallas/[id].tsx`). Foto y datos del vehículo a la izquierda,
 * la ficha del cliente a la derecha, luego la descripción, los síntomas, la recogida y los comentarios agrupados por taller.
 * Los diagnósticos privados se abren desde "Ver diagnósticos". Las ventanas (diagnóstico, agenda, cierre) son las de la página.
 */
export default function FaultDetailMobile({
  fault, vehicleTitle, place, photos, diagnostics, publicComments, repliesOf, diagnosisCount, publicDiagnoses,
  isWorkshop, isLoggedIn, saved, onToggleSaved, myDiagnosis, canReply, onReply, replyForm, isMine,
  onBack, onEdit, onCloseFault, onOpenDiagnosis, onOpenPublicList, onShare,
  comment, distanceKm, userLocation, mapHref,
}) {
  const [activePhoto, setActivePhoto] = useState(0);
  const [copied, setCopied] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [listOpen, setListOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const priority = priorityOf(fault);
  const hasPoint = fault.latitud != null && fault.longitud != null;
  const status = !fault.vigente ? { label: 'Cerrada', tone: 'is-closed' } : diagnosisCount > 0 ? { label: 'En diagnóstico', tone: 'is-mid' } : { label: 'Pendiente', tone: 'is-high' };
  const vehicleData = [
    ['Motor', fault.motor],
    ['Chasis', fault.chasis || fault.vin],
    ['Kilometraje', fault.kilometraje != null ? `${fault.kilometraje.toLocaleString('es-CL')} km` : null],
  ].filter(([, value]) => Boolean(value));

  // Los comentarios se agrupan por taller para dar contexto de lo que pasa con cada uno.
  const groups = useMemo(() => {
    const map = new Map();
    [...publicComments]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((item) => {
        const key = item.taller ? `t${item.taller.tallerId}` : `a${item.autor}`;
        const group = map.get(key) || { key, author: item.autor, photo: item.autorFotoUrl || null, taller: item.taller, items: [] };
        group.items.push(item);
        map.set(key, group);
      });
    return [...map.values()];
  }, [publicComments]);

  const sortedDiagnostics = useMemo(
    () => [...diagnostics].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [diagnostics],
  );
  const diagnosisButtonCount = fault.propia ? sortedDiagnostics.length : publicDiagnoses.length;

  const copyChassis = async (value) => {
    try { await navigator.clipboard.writeText(String(value)); } catch { /* sin portapapeles: no pasa nada */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const mainPhoto = photos[activePhoto];

  return (
    <div className="ftd">
      <div className="ftd-bar">
        <button type="button" className="ftd-back" onClick={onBack} aria-label="Volver"><ArrowLeft size={22} /></button>
        <h1>Detalle de falla</h1>
        <div className="ftd-bar-actions">
          <button type="button" className="ftd-iconbtn" onClick={onShare} aria-label="Compartir"><Share2 size={20} /></button>
          {!fault.propia && isLoggedIn && (
            <button type="button" className={`ftd-iconbtn ${saved ? 'is-saved' : ''}`} aria-pressed={saved} aria-label={saved ? 'Quitar de favoritos' : 'Guardar en favoritos'} onClick={onToggleSaved}>
              <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />
            </button>
          )}
          {!fault.propia && (
            <ContextualReportButton tipoObjeto="FALLA" objetoId={fault.id} objetoTitulo={fault.titulo} className="ftd-iconbtn ftd-flag" />
          )}
          <span className={`ftd-pill ${status.tone}`}>{status.label}</span>
        </div>
      </div>

      <div className="ftd-body">
        {fault.propia && fault.vigente && (
          <div className="ftd-owner">
            <button type="button" onClick={onEdit} aria-label="Editar el registro de la falla"><Pencil size={14} /> Editar</button>
            <button type="button" className="is-muted" onClick={onCloseFault} aria-label="Cerrar la falla"><Lock size={14} /> Cerrar</button>
          </div>
        )}

        <div className="ftd-hero">
          <div className="ftd-gallery">
            <button type="button" className="ftd-photo" disabled={photos.length === 0} onClick={() => setViewerOpen(true)} aria-label={photos.length ? 'Ampliar la foto' : 'Sin fotos'}>
              {mainPhoto ? <img src={resolveMediaUrl(mainPhoto)} alt={`${vehicleTitle}, foto ${activePhoto + 1} de ${photos.length}`} /> : <Car size={40} aria-hidden="true" />}
              {photos.length > 0 && <span className="ftd-photo-count">{activePhoto + 1}/{photos.length}</span>}
            </button>
            {photos.length > 1 && (
              <div className="ftd-thumbs">
                {photos.slice(0, 4).map((photo, index) => (
                  <button type="button" key={photo} className={index === activePhoto ? 'is-active' : ''} onClick={() => setActivePhoto(index)} aria-label={`Ver foto ${index + 1}`}>
                    <img src={resolveMediaUrl(photo)} alt="" />
                    {index === 3 && photos.length > 4 && <span>+{photos.length - 4}</span>}
                  </button>
                ))}
              </div>
            )}
            {vehicleData.length > 0 && (
              <div className="ftd-vehicle-box">
                <small>Datos del vehículo</small>
                {vehicleData.map(([label, value]) => (
                  <div key={label} className="ftd-vehicle-row">
                    <span>{label}</span>
                    <strong>{value}</strong>
                    {label === 'Chasis' && (
                      <button type="button" aria-label="Copiar el chasis" onClick={() => copyChassis(value)}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ftd-info">
            <div className="ftd-title-row">
              <div>
                <h2>{vehicleTitle}</h2>
                <small>{[fault.anio, fault.version].filter(Boolean).join(' • ')}</small>
              </div>
              {fault.marca && <VehicleBrandLogo brand={fault.marca} />}
            </div>
            <InfoItem icon={UserRound} label="Cliente">{fault.autor || 'Usuario de RepuesTop'}</InfoItem>
            {place && <InfoItem icon={MapPin} label="Ubicación">{place}</InfoItem>}
            {fault.requiereRecogida && <InfoItem icon={Truck} label="Recogida">Necesita que vengan por el vehículo</InfoItem>}
            {fault.alcance && <InfoItem icon={Megaphone} label="Aviso a">{scopeText(fault)}</InfoItem>}
            <InfoItem icon={Calendar} label="Publicación">{publishedOn(fault.createdAt)}</InfoItem>
            <div className="ftd-info-item">
              <Signal size={14} aria-hidden="true" />
              <small className="ftd-grow">Prioridad</small>
              <span className={`ftd-pill ${priority.tone}`}>{priority.label}</span>
            </div>
          </div>
        </div>

        <section className="ftd-section">
          <h3><MessageCircle size={16} /> Descripción de la falla</h3>
          <div className="ftd-desc">
            <p>{fault.descripcion || 'El usuario no describió lo que pasó.'}</p>
            {fault.antesDelFallo && <small>Antes del fallo: {fault.antesDelFallo}</small>}
            {fault.seMueve != null && <small>{fault.seMueve ? 'El vehículo se puede mover.' : 'El vehículo no se mueve: necesita grúa.'}</small>}
          </div>
        </section>

        {fault.sintomas?.length > 0 && (
          <section className="ftd-section">
            <h3><Wrench size={16} /> Síntomas reportados</h3>
            <div className="ftd-symptoms">
              {fault.sintomas.map((symptom) => (
                <span key={symptom}><i><Check size={12} /></i>{symptom}</span>
              ))}
            </div>
          </section>
        )}

        {fault.requiereRecogida && (
          <section className="ftd-section">
            <h3><Navigation size={16} /> Recogida del vehículo</h3>
            <div className="ftd-pickup">
              <span className="ftd-pickup-badge"><Truck size={14} /> {fault.propia ? 'Pediste que el taller recoja tu vehículo.' : 'El cliente necesita que vengan por el vehículo.'}</span>
              {fault.direccionRecogida && <p><MapPin size={16} /> {fault.direccionRecogida}</p>}
              {isWorkshop && hasPoint && (
                distanceKm != null
                  ? <strong className="ftd-distance">A {formatDistanceKm(distanceKm)} de ti, en línea recta</strong>
                  : (
                    <button type="button" className="ftd-outline" onClick={userLocation.requestLocation} disabled={userLocation.status === 'loading'}>
                      <Navigation size={14} /> {userLocation.status === 'denied' ? 'Permite tu ubicación para ver la distancia' : 'Ver a qué distancia está'}
                    </button>
                  )
              )}
              {mapHref && <a className="ftd-outline" href={mapHref} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir en mapas</a>}
            </div>
          </section>
        )}

        <div className="ftd-comments-head">
          <h3><MessageCircle size={18} /> Comentarios ({publicComments.length})</h3>
          {diagnosisButtonCount > 0 && (
            <button type="button" className="ftd-diag-btn" onClick={() => (fault.propia ? setListOpen(true) : onOpenPublicList())}>
              <Wrench size={14} /> Ver diagnósticos ({diagnosisButtonCount})
            </button>
          )}
        </div>
        <p className="ftd-note">Los talleres preguntan para afinar su diagnóstico y el cliente responde. Los diagnósticos son privados: solo los ve el creador de la falla (con «Ver diagnósticos») y el taller que los emitió.</p>

        {isWorkshop && fault.vigente && (
          <button type="button" className="ftd-primary" onClick={() => onOpenDiagnosis(myDiagnosis ? myDiagnosis.id : 'new')}>
            <Wrench size={18} /> {myDiagnosis ? 'Ver mi diagnóstico' : 'Diagnosticar'}
          </button>
        )}

        {groups.length === 0 ? (
          <div className="ftd-empty">
            <MessageCircle size={28} aria-hidden="true" />
            <strong>Aún no hay comentarios</strong>
            <span>{fault.propia ? 'Los talleres pueden preguntarte para afinar su diagnóstico.' : 'Haz una pregunta para afinar el diagnóstico.'}</span>
          </div>
        ) : groups.map((group) => {
          const open = Boolean(openGroups[group.key]);
          const count = group.items.length;
          return (
            <div key={group.key} className="ftd-card">
              <div className="ftd-group-head">
                <button type="button" className="ftd-group-toggle" aria-expanded={open} onClick={() => setOpenGroups((current) => ({ ...current, [group.key]: !current[group.key] }))}>
                  <Avatar name={group.author} src={group.photo} />
                  <span className="ftd-group-copy">
                    <strong>{group.author}</strong>
                    <small>{[group.taller ? 'Taller' : null, group.taller?.comuna, `${count} ${count === 1 ? 'comentario' : 'comentarios'}`].filter(Boolean).join(' · ')}</small>
                    {group.taller && <TallerRating rating={group.taller.calificacion} count={group.taller.opiniones} />}
                  </span>
                </button>
                {group.taller && <Link className="ftd-profile" to={workshopPath(group.taller.tallerId)}>Ver perfil ›</Link>}
                <button type="button" className="ftd-chevron" aria-label={open ? 'Ocultar comentarios' : 'Ver comentarios'} onClick={() => setOpenGroups((current) => ({ ...current, [group.key]: !current[group.key] }))}>
                  {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>
              {open && group.items.map((item) => (
                <div key={item.id} className="ftd-nested">
                  <small>{timeSince(item.createdAt)}</small>
                  <p>{item.texto}</p>
                  {repliesOf(item.id).map((reply) => (
                    <div key={reply.id} className="ftd-reply">
                      <small>{reply.esCreador ? `${reply.autor} (cliente)` : reply.autor}</small>
                      <p>{reply.texto}</p>
                    </div>
                  ))}
                  <div className="ftd-card-foot">
                    {canReply ? <button type="button" className="ftd-link" onClick={() => onReply(item.id)}>Responder</button> : <span />}
                    {!isMine(item) && <ContextualReportButton tipoObjeto="FALLA_COMENTARIO" objetoId={item.id} objetoTitulo={`Comentario de ${item.autor}`} className="ftd-link is-muted" />}
                  </div>
                  {replyForm(item.id, 'Responde al taller')}
                </div>
              ))}
            </div>
          );
        })}

        {isWorkshop && fault.vigente && (
          <form className="ftd-composer" onSubmit={comment.submit}>
            <strong>Comentar para afinar el diagnóstico</strong>
            <textarea rows={3} value={comment.text} maxLength={1500} onChange={(event) => comment.setText(event.target.value)} placeholder="Ej: ¿Se enciende la luz de motor? ¿Cuándo empezó el ruido?" />
            <CharCount value={comment.text} max={1500} />
            {comment.error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {comment.error}</p>}
            <button type="submit" className="ftd-primary" disabled={comment.sending || !comment.text.trim()}>{comment.sending ? 'Publicando…' : 'Publicar comentario'}</button>
          </form>
        )}
      </div>

      {listOpen && (
        <div className="ft-modal-backdrop ftd-sheet-backdrop" role="dialog" aria-modal="true" onClick={() => setListOpen(false)}>
          <div className="ft-modal ftd-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="ft-modal-head"><h2><Lock size={16} /> Diagnósticos ({sortedDiagnostics.length})</h2><button type="button" className="ft-icon-btn" aria-label="Cerrar" onClick={() => setListOpen(false)}><X size={20} /></button></div>
            <div className="ftd-list">
              {sortedDiagnostics.map((diagnosis) => {
                const price = priceRange(diagnosis.precioDesde, diagnosis.precioHasta);
                const replies = repliesOf(diagnosis.id).length;
                return (
                  <button type="button" key={diagnosis.id} className={`ftd-diag-row ${diagnosis.aceptado ? 'is-accepted' : ''}`} onClick={() => { setListOpen(false); onOpenDiagnosis(diagnosis.id); }}>
                    <Avatar name={diagnosis.autor} src={diagnosis.autorFotoUrl} />
                    <span className="ftd-group-copy">
                      <strong>{diagnosis.autor}{diagnosis.aceptado && <em>Aceptado</em>}</strong>
                      <small>{[diagnosis.taller?.comuna, timeSince(diagnosis.createdAt)].filter(Boolean).join(' · ')}</small>
                      {diagnosis.taller && <TallerRating rating={diagnosis.taller.calificacion} count={diagnosis.taller.opiniones} />}
                      <span className="ftd-diag-text">{diagnosis.texto}</span>
                      <span className="ftd-diag-facts"><span><Tag size={12} /> {price || 'Sin precio estimado'}</span>{replies > 0 && <span><MessageCircle size={12} /> {replies}</span>}</span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {viewerOpen && photos.length > 0 && (
        <div className="ftd-viewer" role="dialog" aria-modal="true" aria-label="Fotos de la falla" onClick={() => setViewerOpen(false)}>
          <button type="button" className="ftd-viewer-close" aria-label="Cerrar" onClick={() => setViewerOpen(false)}><X size={24} /></button>
          <img src={resolveMediaUrl(photos[activePhoto])} alt={vehicleTitle} onClick={(event) => event.stopPropagation()} />
          {photos.length > 1 && (
            <div className="ftd-viewer-nav" onClick={(event) => event.stopPropagation()}>
              <button type="button" aria-label="Foto anterior" onClick={() => setActivePhoto((activePhoto - 1 + photos.length) % photos.length)}><ArrowLeft size={20} /></button>
              <span>{activePhoto + 1} / {photos.length}</span>
              <button type="button" aria-label="Foto siguiente" onClick={() => setActivePhoto((activePhoto + 1) % photos.length)}><ChevronRight size={20} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
