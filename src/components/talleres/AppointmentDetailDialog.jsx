import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Building2, Calendar, Car, ClipboardList, FileText, Lock, Star, CarFront, User, X } from 'lucide-react';
import { formatAgendaDateLong } from '../../data/agendaConfig';
import { describeAppointment } from '../../utils/appointmentHistory';
import AuctionAvatar from '../AuctionAvatar';
import { AppointmentResultDetail, AppointmentResultForm } from './AppointmentResult';
import '../../styles/appointment-detail.css';

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

function Section({ icon: Icon, title, children }) {
  return (
    <section className="apd-section">
      <h4><Icon size={14} aria-hidden="true" /> {title}</h4>
      {children}
    </section>
  );
}

function Row({ label, children }) {
  if (!children) return null;
  return <div className="apd-row"><span>{label}</span><b>{children}</b></div>;
}

/**
 * Ficha completa de una cita del historial, para el taller (`viewer` 'provider') o el cliente ('customer'): estado,
 * quién y cuándo, vehículo y falla, cómo se cerró y el resultado del diagnóstico.
 */
export default function AppointmentDetailDialog({ appointment, viewer, onClose, onEvaluate, onRegistered }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!appointment) return null;
  const asProvider = viewer === 'provider';
  const meta = describeAppointment(appointment, viewer);
  const closed = appointment.status === 'cancelled' || appointment.status === 'rejected';
  const services = appointment.services?.length ? appointment.services.join(', ') : appointment.service;
  const providerClosed = asProvider && !['pending', 'accepted'].includes(meta.state);
  const vehicle = (providerClosed ? [appointment.vehicleModel] : [appointment.vehiclePatent, appointment.vehicleModel]).filter(Boolean).join(' · ');
  const { result } = appointment;
  const canRegister = asProvider && !result && (appointment.resultPending || appointment.canFinish);
  const locked = !asProvider && appointment.resultAvailable && !result;

  return createPortal(
    <div className="apd-backdrop" role="dialog" aria-modal="true" aria-label="Detalle de la cita" onClick={onClose}>
      <div className={`apd tone-${meta.tone}`} onClick={(event) => event.stopPropagation()}>
        <header className="apd-head">
          {asProvider
            ? <AuctionAvatar className="apd-head-icon apd-head-avatar" src={appointment.customerPhotoUrl} name={appointment.customerName || 'Cliente'} />
            : <span className="apd-head-icon"><CarFront size={24} /></span>}
          <div>
            <small>Detalle de la cita</small>
            <h3>{asProvider ? appointment.customerName || 'Cliente' : appointment.tallerName || 'Taller'}</h3>
            <span className="apd-status"><i className={`appt-dot tone-${meta.tone}`} /> {meta.label} · {meta.longLabel}</span>
          </div>
          <button type="button" className="apd-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="apd-body">
          <div className="apd-grid">
            <Section icon={Calendar} title="La cita">
              <Row label="Fecha">{capitalize(formatAgendaDateLong(appointment.date))}</Row>
              <Row label="Horario">{appointment.time}</Row>
              <Row label="Servicio">{services}</Row>
              <Row label="Origen">{appointment.fallaId ? 'Diagnóstico en fallas automotrices' : 'Perfil del taller'}</Row>
              <Row label="Modalidad">{appointment.homeService ? `A domicilio${appointment.homeAddress ? ` · ${appointment.homeAddress}` : ''}` : 'En el taller'}</Row>
              {appointment.rescheduledFromId && <Row label="Reagendada">Viene de una cita anterior</Row>}
            </Section>

            <Section icon={asProvider ? User : Building2} title={asProvider ? 'Cliente' : 'Taller'}>
              {asProvider ? (
                <>
                  <Row label="Nombre">{appointment.customerName}</Row>
                  <Row label="Teléfono">{appointment.customerPhone && <a href={`tel:${appointment.customerPhone}`}>{appointment.customerPhone}</a>}</Row>
                  <Row label="Correo">{appointment.customerEmail && <a href={`mailto:${appointment.customerEmail}`}>{appointment.customerEmail}</a>}</Row>
                </>
              ) : (
                <>
                  <Row label="Nombre">{appointment.tallerName}</Row>
                  <Row label="Dirección">{appointment.workshopAddress}</Row>
                  <Row label="Teléfono">{appointment.workshopPhone && <a href={`tel:${appointment.workshopPhone.replace(/\s+/g, '')}`}>{appointment.workshopPhone}</a>}</Row>
                </>
              )}
            </Section>
          </div>

          {(vehicle || appointment.fallaTitle) && (
            <Section icon={Car} title="Vehículo y falla">
              <Row label="Vehículo">{vehicle}</Row>
              <Row label="Falla">{appointment.fallaTitle}</Row>
              {appointment.fallaDescription && <p className="apd-text">{appointment.fallaDescription}</p>}
            </Section>
          )}

          {appointment.notes && !(appointment.fallaTitle && appointment.notes.trim() === `Falla: ${appointment.fallaTitle}`.trim()) && (
            <Section icon={FileText} title="Nota del cliente"><p className="apd-text">{appointment.notes}</p></Section>
          )}

          {closed ? (
            <Section icon={Ban} title="Cierre de la cita">
              <Row label="Estado">{meta.longLabel}</Row>
              <Row label="Motivo">{appointment.cancelReason && !appointment.rescheduledToId ? appointment.cancelReason : null}</Row>
            </Section>
          ) : (
            <Section icon={ClipboardList} title="Resultado del diagnóstico">
              {result ? (
                <AppointmentResultDetail result={result} />
              ) : canRegister ? (
                <div className="apd-pending">
                  <p><b>{appointment.canFinish ? 'La cita está en curso: finalízala y registra el resultado.' : 'Falta registrar el resultado de esta cita.'}</b></p>
                  <AppointmentResultForm appointment={appointment} onDone={() => { onRegistered?.(); onClose(); }} />
                </div>
              ) : locked ? (
                <div className="apd-locked">
                  <Lock size={20} />
                  <p>{`${appointment.tallerName || 'El taller'} ya registró el resultado. Para verlo, cuéntanos cómo fue tu experiencia y califica al taller.`}</p>
                  <button type="button" className="apd-cta" onClick={() => { onClose(); onEvaluate?.(appointment); }}><Star size={15} /> Evaluar y ver resultado</button>
                </div>
              ) : (
                <p className="apd-muted">{meta.state === 'past' ? 'El taller aún no registra el resultado de esta cita.' : 'El resultado se registra cuando la cita termina.'}</p>
              )}
            </Section>
          )}

          {!closed && (
            <Section icon={Star} title="Evaluación del cliente">
              {appointment.tallerRating ? (
                <div className="apd-stars" aria-label={`${appointment.tallerRating} de 5 estrellas`}>
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={18} fill={n <= appointment.tallerRating ? 'currentColor' : 'none'} />)}
                  <b>{appointment.tallerRating}/5</b>
                </div>
              ) : (
                <p className="apd-muted">Aún sin evaluar. La evaluación del cliente es pública en el perfil del taller.</p>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
