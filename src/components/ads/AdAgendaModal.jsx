import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CalendarClock, Check, XCircle, Phone, Mail, Car, StickyNote,
  Loader2, AlertTriangle, CalendarDays
} from 'lucide-react';
import { APPOINTMENT_STATUS_META, isClosedAppointment } from '../../data/automotiveAdsData';
import {
  formatAgendaDateLong, getTimeUntilLabel, parseIsoDate, toIsoDate
} from '../../data/agendaConfig';
import { updateAppointmentStatus, adErrorMessage } from '../../services/adsStorage';

/**
 * Agenda de un anuncio, vista por su dueño: las reservas que le hicieron y la
 * respuesta a cada una.
 *
 * Recibe las citas ya cargadas por `AdsManagementSection` en vez de pedirlas por
 * su cuenta: `GET /anuncios/agendamientos/mias` ya devuelve TODAS las reservas
 * que tocan a la sesion —las de todos sus anuncios y las que hizo como cliente—
 * en una sola respuesta (`findRelevantes()`), asi que abrir la agenda de cada
 * anuncio con su propio GET seria pedir de nuevo lo mismo.
 *
 * Solo se puede responder una reserva `pending`: el backend rechaza con 400
 * cualquier intento sobre una ya resuelta, y `cancelled` esta reservado al
 * cliente. Por eso las acciones desaparecen apenas la cita se cierra.
 */
export default function AdAgendaModal({ ad, appointments, onClose, onAppointmentUpdated }) {
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const todayIso = toIsoDate(new Date());

  // Las proximas primero: la agenda se usa para saber que viene, no para
  // revisar el historial. Las cerradas y las pasadas quedan detras del toggle.
  const { upcoming, closed } = useMemo(() => {
    const sorted = [...appointments].sort(
      (a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date))
    );
    return {
      upcoming: sorted.filter((item) => !isClosedAppointment(item.status) && item.date >= todayIso),
      closed: sorted.filter((item) => isClosedAppointment(item.status) || item.date < todayIso).reverse()
    };
  }, [appointments, todayIso]);

  const pendingCount = upcoming.filter((item) => item.status === 'pending').length;

  const handleRespond = async (appointment, status) => {
    setUpdatingId(appointment.id);
    setActionError('');
    try {
      onAppointmentUpdated(await updateAppointmentStatus(appointment.id, status));
    } catch (error) {
      setActionError(adErrorMessage(error, 'No se pudo actualizar la reserva.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const renderAppointment = (appointment) => {
    const meta = APPOINTMENT_STATUS_META[appointment.status] || APPOINTMENT_STATUS_META.pending;
    const canRespond = appointment.status === 'pending' && appointment.date >= todayIso;
    const isBusy = updatingId === appointment.id;

    return (
      <div key={appointment.id} className={`agenda-appointment tone-${meta.tone}`}>
        <div className="agenda-appointment-when">
          <strong>{parseIsoDate(appointment.date)?.getDate() ?? '--'}</strong>
          <span>{formatAgendaDateLong(appointment.date).split(' de ')[1] || ''}</span>
          <em>{appointment.time}</em>
        </div>

        <div className="agenda-appointment-body">
          <div className="agenda-appointment-top">
            <span className={`mgmt-status-pill tone-${meta.tone}`}>{meta.label}</span>
            <span className="agenda-appointment-eta">
              {getTimeUntilLabel(appointment.date, appointment.time)}
            </span>
          </div>

          <h5>{appointment.service || 'Servicio no informado'}</h5>

          <div className="agenda-appointment-meta">
            <span><strong>{appointment.customerName}</strong></span>
            {appointment.customerPhone && (
              <a href={`tel:${appointment.customerPhone}`}><Phone size={12} /> {appointment.customerPhone}</a>
            )}
            {appointment.customerEmail && (
              <a href={`mailto:${appointment.customerEmail}`}><Mail size={12} /> {appointment.customerEmail}</a>
            )}
            {(appointment.vehiclePatent || appointment.vehicleModel) && (
              <span>
                <Car size={12} /> {[appointment.vehiclePatent, appointment.vehicleModel].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          {appointment.notes && (
            <p className="agenda-appointment-notes">
              <StickyNote size={12} /> {appointment.notes}
            </p>
          )}
        </div>

        {canRespond && (
          <div className="agenda-appointment-actions">
            <button
              type="button"
              className="btn-agenda-accept"
              disabled={isBusy}
              onClick={() => handleRespond(appointment, 'accepted')}
            >
              {isBusy ? <Loader2 size={14} className="spin-icon" /> : <Check size={14} />} Aceptar
            </button>
            <button
              type="button"
              className="btn-agenda-reject"
              disabled={isBusy}
              onClick={() => handleRespond(appointment, 'rejected')}
            >
              <XCircle size={14} /> Rechazar
            </button>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="booking-modal-card agenda-modal-card">
        <div className="booking-modal-header">
          <div>
            <h3><CalendarClock className="text-emerald-600" size={22} /> Agenda del anuncio</h3>
            <p>
              <strong>{ad.title}</strong>
              {pendingCount > 0 && <> • {pendingCount} {pendingCount === 1 ? 'reserva espera' : 'reservas esperan'} tu respuesta</>}
            </p>
          </div>
          <button
            type="button"
            className="story-close-btn"
            style={{ background: '#f1f5f9', color: '#0f172a' }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {actionError && (
          <div className="ad-form-error">
            <AlertTriangle size={15} />
            <span>{actionError}</span>
          </div>
        )}

        {upcoming.length === 0 ? (
          <div className="ads-mgmt-state">
            <CalendarDays size={22} />
            <p>
              Todavía no hay reservas próximas en este anuncio. Cuando alguien pida hora
              desde el mural, te aparece acá y te llega una notificación.
            </p>
          </div>
        ) : (
          <div className="agenda-appointments-list">{upcoming.map(renderAppointment)}</div>
        )}

        {closed.length > 0 && (
          <div className="agenda-closed-block">
            <button
              type="button"
              className="btn-ad-phone"
              onClick={() => setShowClosed((current) => !current)}
            >
              {showClosed ? 'Ocultar' : 'Ver'} historial ({closed.length})
            </button>
            {showClosed && (
              <div className="agenda-appointments-list is-history">{closed.map(renderAppointment)}</div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
