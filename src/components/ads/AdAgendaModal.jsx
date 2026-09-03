import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CalendarClock, CalendarDays, Check, XCircle, Phone, Mail, Car, StickyNote,
  Loader2, AlertTriangle, ChevronLeft, ChevronRight, ArrowLeft, Hash, Wrench,
  Clock, MessageSquare
} from 'lucide-react';
import { APPOINTMENT_STATUS_META, isClosedAppointment } from '../../data/automotiveAdsData';
import {
  WEEKDAYS, formatAgendaDateLong, getTimeUntilLabel, parseIsoDate, toIsoDate,
  weekdayIndexFromDate, formatAgendaMonthLabel
} from '../../data/agendaConfig';
import { updateAppointmentStatus, adErrorMessage } from '../../services/adsStorage';

/**
 * Agenda de un anuncio, vista por su dueño: las reservas que le hicieron y la
 * respuesta a cada una. Dos pestañas —Solicitudes y Calendario— más una vista de
 * detalle por cita, como en `mobile/components/ads/AdAgendaModal.tsx`.
 *
 * Recibe las citas ya cargadas por `AdsManagementSection` en vez de pedirlas por
 * su cuenta: `GET /anuncios/agendamientos/mias` ya devuelve TODAS las reservas
 * que tocan a la sesión en una sola respuesta.
 *
 * Solo se puede responder una reserva `pending`: el backend rechaza con 400
 * cualquier intento sobre una ya resuelta, y `cancelled` está reservado al
 * cliente.
 */
export default function AdAgendaModal({ ad, appointments, onClose, onAppointmentUpdated }) {
  const [tab, setTab] = useState('solicitudes'); // 'solicitudes' | 'calendario'
  const [detailId, setDetailId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => new Date());

  const todayIso = toIsoDate(new Date());

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
  const nextAppointment = upcoming[0] || null;
  const detailAppointment = detailId
    ? appointments.find((item) => item.id === detailId) || null
    : null;

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

  const renderAppointment = (appointment, { compact = false } = {}) => {
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

          <h5>
            {(appointment.services?.length ? appointment.services.join(', ') : appointment.service)
              || 'Servicio no informado'}
          </h5>

          {!compact && (
            <div className="agenda-appointment-meta">
              <span><strong>{appointment.customerName || 'Cliente'}</strong></span>
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
          )}

          {!compact && appointment.notes && (
            <p className="agenda-appointment-notes">
              <StickyNote size={12} /> {appointment.notes}
            </p>
          )}

          <button type="button" className="agenda-appointment-detail-link" onClick={() => setDetailId(appointment.id)}>
            Ver detalle
          </button>
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

  const renderDetail = (appointment) => {
    const meta = APPOINTMENT_STATUS_META[appointment.status] || APPOINTMENT_STATUS_META.pending;
    const canRespond = appointment.status === 'pending' && appointment.date >= todayIso;
    const isBusy = updatingId === appointment.id;
    const services = appointment.services?.length ? appointment.services.join(', ') : appointment.service;

    return (
      <div className="agenda-detail">
        <button type="button" className="btn-ad-phone" onClick={() => setDetailId(null)}>
          <ArrowLeft size={14} /> Volver
        </button>

        <span className={`mgmt-status-pill tone-${meta.tone}`} style={{ marginTop: 12 }}>{meta.longLabel || meta.label}</span>

        <div className="agenda-detail-rows">
          <DetailRow Icon={Hash} label="Código" value={appointment.id} />
          <DetailRow Icon={Wrench} label="Servicio(s)" value={services} />
          <DetailRow Icon={CalendarDays} label="Día" value={formatAgendaDateLong(appointment.date)} />
          <DetailRow Icon={Clock} label="Bloque" value={appointment.time} />
          <DetailRow Icon={Phone} label="Teléfono" value={appointment.customerPhone} href={appointment.customerPhone ? `tel:${appointment.customerPhone}` : null} />
          <DetailRow Icon={Mail} label="Correo" value={appointment.customerEmail} href={appointment.customerEmail ? `mailto:${appointment.customerEmail}` : null} />
          <DetailRow Icon={Car} label="Vehículo" value={appointment.vehicleModel} />
          <DetailRow Icon={Hash} label="Patente" value={appointment.vehiclePatent} />
          <DetailRow Icon={MessageSquare} label="Comentarios" value={appointment.notes} />
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

  const renderCalendar = () => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = weekdayIndexFromDate(new Date(year, month, 1));

    const countByIso = new Map();
    appointments.forEach((item) => {
      if (isClosedAppointment(item.status)) return;
      countByIso.set(item.date, (countByIso.get(item.date) || 0) + 1);
    });

    const cells = [];
    for (let i = 0; i < leading; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = toIsoDate(new Date(year, month, day));
      cells.push({ iso, day, count: countByIso.get(iso) || 0, isPast: iso < todayIso, isToday: iso === todayIso });
    }

    return (
      <div>
        <div className="appt-cal-controls">
          <div className="appt-cal-month">
            <button type="button" onClick={() => setMonthCursor(new Date(year, month - 1, 1))} aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <strong>{formatAgendaMonthLabel(monthCursor)}</strong>
            <button type="button" onClick={() => setMonthCursor(new Date(year, month + 1, 1))} aria-label="Mes siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="appt-cal-grid appt-cal-weekdays">
          {WEEKDAYS.map((weekday) => <span key={weekday.id}>{weekday.short}</span>)}
        </div>
        <div className="appt-cal-grid appt-cal-days">
          {cells.map((cell, index) => {
            if (!cell) return <span key={`e-${index}`} className="appt-cal-cell is-empty" />;
            return (
              <div
                key={cell.iso}
                className={[
                  'appt-cal-cell',
                  cell.isPast ? 'is-past' : '',
                  cell.isToday ? 'is-today' : '',
                  cell.count > 0 ? 'has-items' : ''
                ].filter(Boolean).join(' ')}
              >
                <span className="appt-cal-num">{cell.day}</span>
                {cell.count > 0 && (
                  <span className="appt-cal-dots">
                    <i className="dot dot-recibidas">{cell.count}</i>
                  </span>
                )}
              </div>
            );
          })}
        </div>
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

        {detailAppointment ? (
          renderDetail(detailAppointment)
        ) : (
          <>
            <div className="appt-seg" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className={tab === 'solicitudes' ? 'active' : ''}
                onClick={() => setTab('solicitudes')}
              >
                Solicitudes{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
              <button
                type="button"
                className={tab === 'calendario' ? 'active' : ''}
                onClick={() => setTab('calendario')}
              >
                Calendario
              </button>
            </div>

            {tab === 'calendario' ? (
              renderCalendar()
            ) : (
              <>
                {nextAppointment && (
                  <div className="agenda-next-card">
                    <span className="agenda-next-tag">Próxima cita</span>
                    <strong>{formatAgendaDateLong(nextAppointment.date)} · {nextAppointment.time}</strong>
                    <span>
                      {(nextAppointment.services?.length ? nextAppointment.services.join(', ') : nextAppointment.service) || 'Servicio no informado'}
                      {nextAppointment.customerName ? ` — ${nextAppointment.customerName}` : ''}
                    </span>
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
                  <div className="agenda-appointments-list">
                    {upcoming.map((appointment) => renderAppointment(appointment))}
                  </div>
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
                      <div className="agenda-appointments-list is-history">
                        {closed.map((appointment) => renderAppointment(appointment))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function DetailRow({ Icon, label, value, href }) {
  const text = (value || '').toString().trim();
  return (
    <div className="agenda-detail-row">
      <Icon size={14} />
      <div>
        <span>{label}</span>
        {href && text
          ? <a href={href}>{text}</a>
          : <strong>{text || '—'}</strong>}
      </div>
    </div>
  );
}
