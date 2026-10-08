import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, CalendarDays, Check, XCircle, Loader2,
  Phone, Mail, Car, StickyNote, Home
} from 'lucide-react';
import {
  APPOINTMENT_LEGEND, APPOINTMENT_STATE_ORDER, appointmentVisualState, describeAppointment,
  summarizeAppointments
} from '../../utils/appointmentHistory';
import {
  WEEKDAYS, toIsoDate, weekdayIndexFromDate, formatAgendaMonthLabel,
  formatAgendaDateLong, getTimeUntilLabel
} from '../../data/agendaConfig';

/**
 * Calendario mensual con las citas de los dos roles: las que la cuenta reservó en
 * otros anuncios ("pedidas") y las que le reservaron en los suyos ("recibidas").
 * Port de `mobile/components/ads/AppointmentsCalendarModal.tsx`.
 *
 * El índice de día del repo es 0 = Lunes … 6 = Domingo (no `Date.getDay()`), así
 * que la fila de encabezados y el hueco inicial del mes usan `WEEKDAYS` y
 * `weekdayIndexFromDate`.
 */

const KIND_LABEL = { mias: 'Mis reservas', recibidas: 'Recibidas' };
const TONE_BY_STATE = { pending: 'warning', accepted: 'success', cancelled: 'danger', past: 'muted' };

function buildMonthCells(cursor, itemsByDate) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = weekdayIndexFromDate(new Date(year, month, 1));
  const todayIso = toIsoDate(new Date());

  const cells = Array.from({ length: leading }, () => null);
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const iso = toIsoDate(new Date(year, month, dayNumber));
    const dayItems = itemsByDate.get(iso) || [];
    cells.push({
      iso,
      dayNumber,
      items: dayItems,
      // Un punto por estado presente ese día: el color es el estado de la cita (regla del 4-oct).
      states: APPOINTMENT_STATE_ORDER.filter((state) =>
        dayItems.some((i) => appointmentVisualState(i.appointment) === state)),
      isToday: iso === todayIso,
      isPast: iso < todayIso
    });
  }
  return cells;
}

export default function AppointmentsCalendarModal({
  bookedAppointments = [],
  receivedAppointments = [],
  onClose,
  onUpdateStatus,
  /** (appointment, isReceived) => void: abre la confirmación de cancelar con motivo. */
  onRequestCancel,
  initialSegment = 'all'
}) {
  const [filter, setFilter] = useState(initialSegment);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDayIso, setSelectedDayIso] = useState(() => toIsoDate(new Date()));
  const [updatingId, setUpdatingId] = useState(null);

  const allItems = useMemo(() => {
    const list = [];
    bookedAppointments.forEach((a) => list.push({ appointment: a, kind: 'mias' }));
    receivedAppointments.forEach((a) => list.push({ appointment: a, kind: 'recibidas' }));
    return list;
  }, [bookedAppointments, receivedAppointments]);

  const filteredItems = useMemo(() => {
    if (filter === 'mias') return allItems.filter((i) => i.kind === 'mias');
    if (filter === 'recibidas') return allItems.filter((i) => i.kind === 'recibidas');
    return allItems;
  }, [allItems, filter]);

  const itemsByDate = useMemo(() => {
    const map = new Map();
    filteredItems.forEach((item) => {
      const list = map.get(item.appointment.date) || [];
      list.push(item);
      map.set(item.appointment.date, list);
    });
    return map;
  }, [filteredItems]);

  // Los números de los filtros son el panorama vigente, no todo el historial.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const bookedCurrent = useMemo(() => summarizeAppointments(bookedAppointments, now).current, [bookedAppointments, now]);
  const receivedCurrent = useMemo(() => summarizeAppointments(receivedAppointments, now).current, [receivedAppointments, now]);
  const filterCount = { all: bookedCurrent + receivedCurrent, mias: bookedCurrent, recibidas: receivedCurrent };

  const cells = useMemo(() => buildMonthCells(monthCursor, itemsByDate), [monthCursor, itemsByDate]);
  const selectedItems = itemsByDate.get(selectedDayIso) || [];

  const shiftMonth = (delta) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const handleRespond = async (appointmentId, status) => {
    if (!onUpdateStatus) return;
    setUpdatingId(appointmentId);
    try {
      await onUpdateStatus(appointmentId, status);
    } finally {
      setUpdatingId(null);
    }
  };

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="booking-modal-card appt-cal-card">
        <div className="booking-modal-header">
          <div>
            <h3><CalendarDays size={22} className="text-emerald-600" /> Calendario de citas</h3>
            <p>Tus reservas pedidas y las que recibiste, mes a mes.</p>
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

        <div className="appt-cal-controls">
          <div className="appt-seg">
            {['all', 'mias', 'recibidas'].map((key) => (
              <button
                type="button"
                key={key}
                className={filter === key ? 'active' : ''}
                onClick={() => setFilter(key)}
              >
                {key === 'all' ? 'Todas' : KIND_LABEL[key]} ({filterCount[key]})
              </button>
            ))}
          </div>

          <div className="appt-cal-month">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <strong>{formatAgendaMonthLabel(monthCursor)}</strong>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="appt-cal-grid appt-cal-weekdays">
          {WEEKDAYS.map((day) => <span key={day.id}>{day.short}</span>)}
        </div>

        <div className="appt-cal-grid appt-cal-days">
          {cells.map((cell, index) => {
            if (!cell) return <span key={`empty-${index}`} className="appt-cal-cell is-empty" />;
            const isSelected = cell.iso === selectedDayIso;
            const hasItems = cell.items.length > 0;
            return (
              <button
                type="button"
                key={cell.iso}
                className={[
                  'appt-cal-cell',
                  cell.isToday ? 'is-today' : '',
                  cell.isPast ? 'is-past' : '',
                  isSelected ? 'is-selected' : '',
                  hasItems ? 'has-items' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => setSelectedDayIso(cell.iso)}
              >
                <span className="appt-cal-num">{cell.dayNumber}</span>
                {hasItems && (
                  <span className="appt-cal-dots">
                    {cell.states.map((state) => (
                      <i key={state} className={`appt-dot tone-${TONE_BY_STATE[state]}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="appt-legend">
          {APPOINTMENT_LEGEND.map((item) => (
            <span key={item.state}><i className={`appt-dot tone-${TONE_BY_STATE[item.state]}`} /> {item.label}</span>
          ))}
        </div>

        <div className="appt-cal-day-panel">
          <h4>{formatAgendaDateLong(selectedDayIso)}</h4>
          {selectedItems.length === 0 ? (
            <p className="appt-cal-empty">Sin citas este día.</p>
          ) : (
            <div className="agenda-appointments-list">
              {selectedItems
                .slice()
                .sort((a, b) => a.appointment.time.localeCompare(b.appointment.time))
                .map(({ appointment, kind }) => {
                  const isReceived = kind === 'recibidas';
                  const meta = describeAppointment(appointment, isReceived ? 'provider' : 'customer');
                  const isCurrent = meta.state === 'pending' || meta.state === 'accepted';
                  // Una solicitud cuya hora ya pasó no se responde (el backend también la rechaza).
                  const canRespond = isReceived && meta.state === 'pending';
                  const canCancel = Boolean(onRequestCancel) && (isReceived ? meta.state === 'accepted' : isCurrent);
                  const isBusy = updatingId === appointment.id;
                  return (
                    <div key={`${kind}-${appointment.id}`} className={`agenda-appointment tone-${meta.tone}`}>
                      <div className="agenda-appointment-when">
                        <em>{appointment.time}</em>
                      </div>
                      <div className="agenda-appointment-body">
                        <div className="agenda-appointment-top">
                          <span className={`mgmt-status-pill tone-${meta.tone}`}><i className={`appt-dot tone-${meta.tone}`} /> {meta.label}</span>
                          <span className="appt-kind-tag">{isReceived ? 'Recibida' : 'Reservada por mí'}</span>
                          {isCurrent && (
                            <span className="agenda-appointment-eta">
                              {getTimeUntilLabel(appointment.date, appointment.time)}
                            </span>
                          )}
                        </div>
                        <h5>{(appointment.services?.length ? appointment.services.join(', ') : appointment.service) || 'Servicio no informado'}</h5>
                        <div className="agenda-appointment-meta">
                          <span><strong>{isReceived ? appointment.customerName : appointment.adTitle}</strong></span>
                          {isReceived && appointment.customerPhone && (
                            <a href={`tel:${appointment.customerPhone}`}><Phone size={12} /> {appointment.customerPhone}</a>
                          )}
                          {isReceived && appointment.customerEmail && (
                            <a href={`mailto:${appointment.customerEmail}`}><Mail size={12} /> {appointment.customerEmail}</a>
                          )}
                          {(appointment.vehiclePatent || appointment.vehicleModel) && (
                            <span><Car size={12} /> {[appointment.vehiclePatent, appointment.vehicleModel].filter(Boolean).join(' · ')}</span>
                          )}
                        </div>
                        {appointment.homeService && (
                          <p className="agenda-appointment-notes is-home"><Home size={12} /> A domicilio{appointment.homeAddress ? ` · ${appointment.homeAddress}` : ''}</p>
                        )}
                        {appointment.notes && (
                          <p className="agenda-appointment-notes"><StickyNote size={12} /> {appointment.notes}</p>
                        )}
                        {!isCurrent && (
                          <p className={`agenda-appointment-state tone-${meta.tone}`}>
                            {meta.longLabel}.
                            {appointment.cancelReason && !appointment.rescheduledToId ? ` Motivo: ${appointment.cancelReason}.` : ''}
                          </p>
                        )}
                      </div>
                      {!canRespond && canCancel && (
                        <div className="agenda-appointment-actions">
                          <button type="button" className="btn-mgmt-delete" onClick={() => onRequestCancel(appointment, isReceived)}>
                            <XCircle size={14} /> <span>Cancelar cita</span>
                          </button>
                        </div>
                      )}
                      {canRespond && (
                        <div className="agenda-appointment-actions">
                          <button
                            type="button"
                            className="btn-agenda-accept"
                            disabled={isBusy}
                            onClick={() => handleRespond(appointment.id, 'accepted')}
                          >
                            {isBusy ? <Loader2 size={14} className="spin-icon" /> : <Check size={14} />} Aceptar
                          </button>
                          <button
                            type="button"
                            className="btn-agenda-reject"
                            disabled={isBusy}
                            onClick={() => handleRespond(appointment.id, 'rejected')}
                          >
                            <XCircle size={14} /> Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
