import React, { useEffect, useState } from 'react';
import TallerRating from '../talleres/TallerRating';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronRight, Flag, Loader2, Lock, MessagesSquare, Send, Stethoscope, X, Zap } from 'lucide-react';
import { acceptFaultDiagnosis, commentFault, getFault, priceRange, timeSince } from '../../services/faultApi';
import { fetchMyAppointments, fetchTaller } from '../../services/talleresStorage';
import { profilePath, workshopPath } from '../../routes/paths';
import { resolveMediaUrl } from '../../services/api';
import BookingModal from '../talleres/BookingModal';
import ContextualReportButton from '../ContextualReportButton';

/** "Posible diagnóstico: X" + recomendación: lo que escribe el taller al registrarlo (`partesDiagnostico` de la app). */
export function diagnosisParts(text) {
  const match = /^Posible diagn[oó]stico:\s*([^\n]+)\s*([\s\S]*)$/i.exec(String(text || '').trim());
  if (!match) return { posible: null, detalle: String(text || '').trim() };
  return { posible: match[1].trim(), detalle: match[2].trim() };
}

const publishedOn = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—');
const dayOf = (iso) => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(d); };

function Cell({ label, value, tone }) {
  return <div><small>{label}</small><strong className={tone ? `is-${tone}` : ''}>{value}</strong></div>;
}

function Block({ icon: Icon, title, highlight, children }) {
  return <section className={`dsg-block ${highlight ? 'is-highlight' : ''}`}><h4><Icon size={15} /> {title}</h4>{children}</section>;
}

/**
 * El desglose completo de un diagnóstico (`DiagnosticoDesglose` de la app), en un popup: quién lo emitió, datos clave, el
 * diagnóstico, lo que hace el taller, la conversación y el siguiente paso (aceptar o agendar). Lo abre "Ver diagnóstico".
 */
export default function DiagnosticoDesglose({ faultId, diagnosis, replies, canAct, onClose, onChanged }) {
  const navigate = useNavigate();
  const taller = diagnosis.taller;
  const parts = diagnosisParts(diagnosis.texto);
  const price = priceRange(diagnosis.precioDesde, diagnosis.precioHasta);
  const [accepted, setAccepted] = useState(Boolean(diagnosis.aceptado));
  const [accepting, setAccepting] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [thread, setThread] = useState(replies);
  const [booking, setBooking] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState('');

  // Cita ya agendada con este taller por esta falla: en vez de agendar de nuevo se ofrece verla.
  useEffect(() => {
    if (!accepted || !canAct || !taller) return undefined;
    let active = true;
    fetchMyAppointments()
      .then((list) => {
        if (!active) return;
        setAppointment(list.find((item) => String(item.fallaId) === String(faultId) && String(item.ownerUserId) === String(taller.usuarioId) && !['cancelled', 'rejected'].includes(item.status)) || null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [accepted, canAct, taller, faultId]);

  const accept = async () => {
    setAccepting(true);
    setError('');
    try {
      await acceptFaultDiagnosis(faultId, diagnosis.id);
      setAccepted(true);
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'No pudimos aceptar el diagnóstico.');
    } finally {
      setAccepting(false);
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError('');
    try {
      const created = await commentFault(faultId, { texto: body, respondeAId: diagnosis.id });
      setThread((current) => [...current, created]);
      setText('');
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'No pudimos enviar tu pregunta.');
    } finally {
      setSending(false);
    }
  };

  const openBooking = async () => {
    setLoadingBooking(true);
    setError('');
    try {
      const [workshop, fault] = await Promise.all([fetchTaller(taller.tallerId), getFault(faultId).catch(() => null)]);
      setBooking({ workshop, fault });
    } catch (err) {
      setError(err?.message || 'No pudimos abrir la agenda del taller.');
    } finally {
      setLoadingBooking(false);
    }
  };

  const vehicle = booking?.fault ? [booking.fault.marca, booking.fault.modelo, booking.fault.anio, booking.fault.version].filter(Boolean).join(' ') : '';

  return createPortal(
    <div className="ft-modal-backdrop ftd-sheet-backdrop dsg-backdrop" role="dialog" aria-modal="true" aria-label="Diagnóstico privado" onClick={onClose}>
      <div className="ft-modal ftd-sheet dsg" onClick={(event) => event.stopPropagation()}>
        <div className="ft-modal-head"><h2><Lock size={16} /> Diagnóstico privado</h2><button type="button" className="ft-icon-btn" aria-label="Cerrar" onClick={onClose}><X size={20} /></button></div>

        <div className="dsg-who">
          <span className="dsg-avatar">{(diagnosis.autorFotoUrl || taller?.logoUrl) ? <img src={resolveMediaUrl(diagnosis.autorFotoUrl || taller?.logoUrl)} alt="" /> : (diagnosis.autor || 'T').slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{diagnosis.autor}</strong>
            <small>{['Taller', taller?.comuna].filter(Boolean).join(' · ')}</small>
            {taller && <TallerRating rating={taller.calificacion} count={taller.opiniones} />}
            {taller && <Link className="dsg-link" to={workshopPath(taller.tallerId)} onClick={onClose}>Ver perfil del taller <ChevronRight size={13} /></Link>}
          </div>
          <span className={`trk-tag ${accepted ? 'is-ok' : 'is-warn'}`}>{accepted ? 'Aceptado' : 'Sin aceptar'}</span>
        </div>

        <div className="trk-cells">
          <Cell label="Registrado" value={`${publishedOn(diagnosis.createdAt)} · ${timeSince(diagnosis.createdAt)}`} />
          <Cell label="Precio estimado" value={price || 'Sin precio'} tone={price ? undefined : 'muted'} />
          <Cell label="Agenda" value={taller?.puedeAgendar ? 'Agenda en la app' : 'Por contacto'} tone={taller?.puedeAgendar ? 'ok' : 'muted'} />
        </div>

        <Block icon={Stethoscope} title="Diagnóstico">
          {parts.posible && <div className="dsg-data"><small>POSIBLE DIAGNÓSTICO</small><strong>{parts.posible}</strong></div>}
          {parts.detalle && <div className="dsg-data"><small>{parts.posible ? 'RECOMENDACIÓN DEL TALLER' : 'DETALLE'}</small><p>{parts.detalle}</p></div>}
        </Block>

        {taller && (taller.servicios?.length > 0 || taller.marcasEspecialistas?.length > 0) && (
          <div className="dsg-taller">
            {taller.servicios?.length > 0 && <div className="dsg-chips">{taller.servicios.slice(0, 6).map((service) => <span key={service}>{service}</span>)}</div>}
            {taller.marcasEspecialistas?.length > 0 && <small>{`Especialista en ${taller.marcasEspecialistas.slice(0, 4).join(', ')}`}</small>}
          </div>
        )}

        {(thread.length > 0 || canAct) && (
          <Block icon={MessagesSquare} title={thread.length > 0 ? `Conversación (${thread.length})` : 'Pregunta al taller'}>
            {thread.map((item) => (
              <div key={item.id} className="dsg-reply"><small>{`${item.esCreador ? `${item.autor} (cliente)` : item.autor} · ${timeSince(item.createdAt)}`}</small><p>{item.texto}</p></div>
            ))}
            {canAct && (
              <div className="dsg-ask">
                <textarea rows={2} value={text} maxLength={1500} placeholder="Escribe una pregunta al taller" onChange={(event) => setText(event.target.value)} />
                <button type="button" aria-label="Enviar pregunta al taller" disabled={!text.trim() || sending} onClick={send}>{sending ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}</button>
              </div>
            )}
          </Block>
        )}

        {canAct && (
          <Block icon={Zap} title="Siguiente paso" highlight>
            {accepted && appointment ? (
              <>
                <div className="dsg-cita"><CalendarDays size={18} /><div><strong>Cita agendada</strong><small>{`${dayOf(appointment.date)} · ${appointment.time}${appointment.status === 'pending' ? ' · esperando confirmación del taller' : ''}`}</small></div></div>
                <button type="button" className="ofd-btn is-primary" onClick={() => { onClose(); navigate(profilePath('mi_taller')); }}><CalendarDays size={18} /> Ver cita</button>
                <small className="ofd-muted">Reagenda o cancela desde «Mis citas».</small>
              </>
            ) : accepted ? (
              taller?.puedeAgendar
                ? <button type="button" className="ofd-btn is-primary" disabled={loadingBooking} onClick={openBooking}>{loadingBooking ? <Loader2 size={18} className="spin-icon" /> : <CalendarDays size={18} />} Agendar cita</button>
                : <small className="ofd-muted">Este taller no agenda desde la app: entra a su perfil para llamar o escribirle.</small>
            ) : (
              <>
                <small className="ofd-muted">Al aceptarlo podrás agendar con el taller. Puedes preguntarle antes lo que necesites.</small>
                <button type="button" className="ofd-btn is-primary" disabled={accepting} onClick={accept}>{accepting ? <Loader2 size={18} className="spin-icon" /> : <CheckCircle2 size={18} />} Aceptar diagnóstico</button>
              </>
            )}
          </Block>
        )}
        {error && <p className="trk-error" role="alert">{error}</p>}
        {canAct && <div className="dsg-report"><Flag size={13} /><ContextualReportButton tipoObjeto="FALLA_COMENTARIO" objetoId={diagnosis.id} objetoTitulo={`Diagnóstico de ${diagnosis.autor}`} className="trk-link is-muted" label="Reportar este diagnóstico" /></div>}
      </div>
      {booking && (
        <BookingModal
          taller={booking.workshop}
          fallaContext={{ id: Number(faultId), patente: booking.fault?.patente ?? '', vehiculo: vehicle, titulo: booking.fault?.titulo || '' }}
          onClose={() => setBooking(null)}
        />
      )}
    </div>,
    document.body,
  );
}
