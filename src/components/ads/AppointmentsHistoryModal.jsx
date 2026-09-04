import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CalendarClock, CalendarDays, Check, XCircle, Loader2, AlertTriangle,
  Phone, Mail, Car, StickyNote, RotateCcw, Megaphone, Clock, Settings
} from 'lucide-react';
import { APPOINTMENT_STATUS_META, isClosedAppointment } from '../../data/automotiveAdsData';
import {
  formatAgendaDateLong, getTimeUntilLabel, parseIsoDate, toIsoDate
} from '../../data/agendaConfig';
import {
  filterAppointmentsFor, groupAppointmentsByTime, countAppointments
} from '../../utils/appointmentHistory';
import { updateAppointmentStatus, adErrorMessage } from '../../services/adsStorage';
import AppointmentsCalendarModal from './AppointmentsCalendarModal';
import AgendaConfigsSection from './AgendaConfigsSection';

/**
 * Gestión de citas en una sola vista: las reservas que la cuenta pidió en otros
 * anuncios ("Pedidas") y las que le reservaron en los suyos ("Recibidas"),
 * separadas en próximas (Gestión) y pasadas/cerradas (Historial).
 *
 * Port de `mobile/app/appointments-history.tsx`. La lista llega ya cargada desde
 * `AdsManagementSection` (`GET /anuncios/agendamientos/mias`), que devuelve las
 * citas de los dos roles en una sola respuesta.
 */
export default function AppointmentsHistoryModal({
  ads = [],
  appointments = [],
  sessionUserId = null,
  userEmail = '',
  onClose,
  onAppointmentUpdated,
  onRebook
}) {
  const [segment, setSegment] = useState('recibidas'); // 'pedidas' | 'recibidas' | 'agenda'
  const [showHistory, setShowHistory] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const businessAds = useMemo(() => ads.filter((ad) => ad.tier === 'empresarial'), [ads]);

  const identity = useMemo(
    () => ({ userId: sessionUserId, email: userEmail }),
    [sessionUserId, userEmail]
  );
  const ownedAdIds = useMemo(() => ads.map((ad) => ad.id), [ads]);

  const received = useMemo(
    () => filterAppointmentsFor(appointments, 'provider', { ownedAdIds }),
    [appointments, ownedAdIds]
  );
  const booked = useMemo(
    () => filterAppointmentsFor(appointments, 'customer', { identity }),
    [appointments, identity]
  );

  const receivedGroups = useMemo(() => groupAppointmentsByTime(received), [received]);
  const bookedGroups = useMemo(() => groupAppointmentsByTime(booked), [booked]);
  const receivedCounters = useMemo(() => countAppointments(received), [received]);

  const counters = [
    { key: 'mias', value: bookedGroups.upcoming.length, label: 'Mis reservas', hint: 'Citas que pedí', tone: 'info' },
    { key: 'recibidas', value: receivedGroups.upcoming.length, label: 'Citas recibidas', hint: 'Agendadas conmigo', tone: 'ok' },
    { key: 'pend', value: receivedCounters.pending, label: 'Pendientes', hint: 'Por responder', tone: 'warn' },
    { key: 'acc', value: receivedCounters.accepted, label: 'Aceptadas', hint: 'Confirmadas', tone: 'ok' }
  ];

  const adById = (adId) => ads.find((ad) => ad.id === adId) || null;

  const respond = async (appointment, status) => {
    setBusyId(appointment.id);
    setActionError('');
    try {
      onAppointmentUpdated?.(await updateAppointmentStatus(appointment.id, status));
    } catch (error) {
      setActionError(adErrorMessage(error, 'No se pudo actualizar la cita.'));
    } finally {
      setBusyId(null);
    }
  };

  const kind = segment === 'recibidas' ? 'recibidas' : 'mias';
  const groups = segment === 'recibidas' ? receivedGroups : bookedGroups;
  const list = showHistory ? groups.past : groups.upcoming;
  const todayIso = toIsoDate(new Date());

  const renderCard = (appointment) => {
    const meta = APPOINTMENT_STATUS_META[appointment.status] || APPOINTMENT_STATUS_META.pending;
    const isReceived = kind === 'recibidas';
    const isPast = appointment.date < todayIso;
    const isClosed = isClosedAppointment(appointment.status);
    const isBusy = busyId === appointment.id;
    const canRespond = isReceived && appointment.status === 'pending' && !isPast;
    const canCancel = !isReceived && !isClosed && !isPast;
    const ad = adById(appointment.adId);
    const services = appointment.services?.length ? appointment.services.join(', ') : appointment.service;

    return (
      <div key={appointment.id} className={`agenda-appointment tone-${meta.tone}`}>
        <div className="agenda-appointment-when">
          <strong>{parseIsoDate(appointment.date)?.getDate() ?? '--'}</strong>
          <span>{formatAgendaDateLong(appointment.date).split(' de ')[1] || ''}</span>
          <em>{appointment.time}</em>
        </div>

        <div className="agenda-appointment-body">
          <div className="agenda-appointment-top">
            <span className={`mgmt-status-pill tone-${meta.tone}`}>{meta.longLabel || meta.label}</span>
            {!isClosed && !isPast && (
              <span className="agenda-appointment-eta">
                {getTimeUntilLabel(appointment.date, appointment.time)}
              </span>
            )}
          </div>

          <h5>{services || 'Servicio no informado'}</h5>

          <div className="agenda-appointment-meta">
            <span><Megaphone size={12} /> {appointment.adTitle || ad?.title || 'Anuncio'}</span>
            {isReceived
              ? <>
                  {appointment.customerName && <span><strong>{appointment.customerName}</strong></span>}
                  {appointment.customerPhone && (
                    <a href={`tel:${appointment.customerPhone}`}><Phone size={12} /> {appointment.customerPhone}</a>
                  )}
                  {appointment.customerEmail && (
                    <a href={`mailto:${appointment.customerEmail}`}><Mail size={12} /> {appointment.customerEmail}</a>
                  )}
                </>
              : <span><Clock size={12} /> {formatAgendaDateLong(appointment.date)}</span>}
            {(appointment.vehiclePatent || appointment.vehicleModel) && (
              <span><Car size={12} /> {[appointment.vehiclePatent, appointment.vehicleModel].filter(Boolean).join(' · ')}</span>
            )}
          </div>

          {appointment.notes && (
            <p className="agenda-appointment-notes"><StickyNote size={12} /> {appointment.notes}</p>
          )}
        </div>

        {(canRespond || canCancel) && (
          <div className="agenda-appointment-actions">
            {canRespond && (
              <>
                <button
                  type="button"
                  className="btn-agenda-accept"
                  disabled={isBusy}
                  onClick={() => respond(appointment, 'accepted')}
                >
                  {isBusy ? <Loader2 size={14} className="spin-icon" /> : <Check size={14} />} Aceptar
                </button>
                <button
                  type="button"
                  className="btn-agenda-reject"
                  disabled={isBusy}
                  onClick={() => respond(appointment, 'rejected')}
                >
                  <XCircle size={14} /> Rechazar
                </button>
              </>
            )}
            {canCancel && onRebook && (
              <button
                type="button"
                className="btn-mgmt-edit"
                disabled={isBusy}
                onClick={() => onRebook(appointment)}
                title="Reservar otra hora y cancelar esta"
              >
                <RotateCcw size={14} />
                <span>Reagendar</span>
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="btn-mgmt-delete"
                disabled={isBusy}
                onClick={() => respond(appointment, 'cancelled')}
                title="Cancelar esta reserva"
              >
                {isBusy ? <Loader2 size={14} className="spin-icon" /> : <XCircle size={14} />}
                <span>Cancelar</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAgendaPanel = () => (
    <div className="appt-agenda-panel">
      <p className="appt-agenda-intro">
        Estas agendas se comparten con la app: crea una y elígela al publicar un
        aviso <strong>Empresarial</strong> para recibir citas.
      </p>
      <AgendaConfigsSection
        configIdsInUse={businessAds.map((ad) => ad.agendaConfigId).filter(Boolean)}
      />
    </div>
  );

  return createPortal(
    <>
      <div
        className="booking-modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        role="dialog"
        aria-modal="true"
      >
        <div className="booking-modal-card agenda-modal-card">
          <div className="booking-modal-header">
            <div>
              <h3><CalendarClock size={22} className="text-emerald-600" /> Historial de citas</h3>
              <p>Las horas que pediste y las que te reservaron, en un solo lugar.</p>
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

          <div className="appt-counters">
            {counters.map((counter) => (
              <div key={counter.key} className={`mgmt-stat tone-${counter.tone}`}>
                <strong>{counter.value}</strong>
                <span className="mgmt-stat-label">{counter.label}</span>
                <small>{counter.hint}</small>
              </div>
            ))}
          </div>

          <div className="appt-history-toolbar">
            <div className="appt-seg">
              <button
                type="button"
                className={segment === 'recibidas' ? 'active' : ''}
                onClick={() => setSegment('recibidas')}
              >
                Recibidas ({receivedGroups.upcoming.length})
              </button>
              <button
                type="button"
                className={segment === 'pedidas' ? 'active' : ''}
                onClick={() => setSegment('pedidas')}
              >
                Pedidas ({bookedGroups.upcoming.length})
              </button>
              <button
                type="button"
                className={segment === 'agenda' ? 'active' : ''}
                onClick={() => setSegment('agenda')}
              >
                <Settings size={13} /> Configuración de agenda
              </button>
            </div>

            {segment !== 'agenda' && (
              <div className="appt-history-toolbar-right">
                <button
                  type="button"
                  className={`appt-toggle ${showHistory ? 'active' : ''}`}
                  onClick={() => setShowHistory((current) => !current)}
                >
                  {showHistory ? 'Ver próximas' : `Ver historial (${groups.past.length})`}
                </button>
                <button type="button" className="btn-ad-phone" onClick={() => setIsCalendarOpen(true)}>
                  <CalendarDays size={15} /> <span>Ver calendario</span>
                </button>
              </div>
            )}
          </div>

          {actionError && segment !== 'agenda' && (
            <div className="ad-form-error">
              <AlertTriangle size={15} />
              <span>{actionError}</span>
            </div>
          )}

          {segment === 'agenda' ? (
            renderAgendaPanel()
          ) : list.length === 0 ? (
            <div className="ads-mgmt-state">
              <CalendarDays size={22} />
              <p>
                {showHistory
                  ? 'Todavía no hay citas en el historial.'
                  : segment === 'recibidas'
                    ? 'No tienes citas recibidas próximas.'
                    : 'No tienes reservas pedidas próximas.'}
              </p>
            </div>
          ) : (
            <div className={`agenda-appointments-list ${showHistory ? 'is-history' : ''}`}>
              {list.map(renderCard)}
            </div>
          )}
        </div>
      </div>

      {isCalendarOpen && (
        <AppointmentsCalendarModal
          bookedAppointments={booked}
          receivedAppointments={received}
          onClose={() => setIsCalendarOpen(false)}
          onUpdateStatus={async (id, status) => {
            const target = received.find((item) => item.id === id);
            if (target) await respond(target, status);
          }}
        />
      )}
    </>,
    document.body
  );
}
