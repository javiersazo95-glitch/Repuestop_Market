import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CalendarClock, CalendarDays, Check, XCircle, Loader2, AlertTriangle,
  Phone, Mail, Car, StickyNote, RotateCcw, Megaphone, Clock, Settings, Home
} from 'lucide-react';
import {
  formatAgendaDateLong, getTimeUntilLabel, parseIsoDate, toIsoDate
} from '../../data/agendaConfig';
import {
  filterAppointmentsFor, groupAppointmentsByTime, summarizeAppointments,
  describeAppointment, appointmentVisualState, isAppointmentCurrent, defaultAppointmentsSegment
} from '../../utils/appointmentHistory';
import AppointmentReasonDialog from './AppointmentReasonDialog';
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
  onRebook,
  /** 'pedidas' | 'recibidas': bandeja con la que abre (p. ej. desde una notificación). */
  initialSegment,
  /** Cita a resaltar al abrir (desde una notificación). */
  focusAppointmentId = null,
  /** Si ya se cargaron los anuncios propios: hasta entonces no se sabe con qué bandeja abrir. */
  adsLoaded = true
}) {
  // La bandeja inicial se decide recién cuando se sabe si la cuenta tiene un anuncio publicado:
  // antes partía en "Recibidas" y un cliente la veía un instante antes de saltar a sus reservas.
  const [segment, setSegment] = useState(initialSegment || null); // 'pedidas' | 'recibidas' | 'agenda'
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'cancelled' | 'past'
  const [reasonTarget, setReasonTarget] = useState(null); // { kind, appointment }
  // Cada minuto se reevalúa qué citas siguen vigentes: contadores y secciones se mueven solos.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
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
    () => filterAppointmentsFor(appointments, 'provider', { ownedAdIds, identity }),
    [appointments, ownedAdIds, identity]
  );
  const booked = useMemo(
    () => filterAppointmentsFor(appointments, 'customer', { identity }),
    [appointments, identity]
  );

  const receivedGroups = useMemo(() => groupAppointmentsByTime(received, now), [received, now]);
  const bookedGroups = useMemo(() => groupAppointmentsByTime(booked, now), [booked, now]);
  // Contadores: solo citas vigentes (ni pasadas ni canceladas), por separado para cada bandeja.
  const receivedSummary = useMemo(() => summarizeAppointments(received, now), [received, now]);
  const bookedSummary = useMemo(() => summarizeAppointments(booked, now), [booked, now]);

  // Taller con anuncio publicado → "Recibidas"; cliente sin taller → "Mis reservas". Solo un
  // enlace explícito (notificación) abre otra bandeja.
  const isProviderAccount = ads.length > 0 || received.length > 0;
  useEffect(() => {
    if (!adsLoaded) return;
    setSegment((current) => current || initialSegment || defaultAppointmentsSegment(ads));
  }, [adsLoaded, initialSegment, ads]);
  const isResolving = segment === null;

  // Llegada desde una notificación: se abre la bandeja y la cita que corresponde.
  useEffect(() => {
    if (!focusAppointmentId) return;
    const target = appointments.find((item) => String(item.id) === String(focusAppointmentId));
    if (!target) return;
    setSegment(received.some((item) => item.id === target.id) ? 'recibidas' : 'pedidas');
    setShowHistory(!isAppointmentCurrent(target));
    setHistoryFilter('all');
    requestAnimationFrame(() => {
      document.getElementById(`appt-${target.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    // Solo al abrir o cuando cambia la cita pedida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAppointmentId, appointments.length]);

  const counters = segment === 'pedidas'
    ? [
        { key: 'pend', value: bookedSummary.pending, label: 'Por confirmar', hint: 'Esperan al taller', tone: 'warning' },
        { key: 'acc', value: bookedSummary.accepted, label: 'Confirmadas', hint: 'Citas que tienes', tone: 'success' },
        { key: 'hoy', value: bookedSummary.today, label: 'Hoy', hint: 'Confirmadas para hoy', tone: 'info' }
      ]
    : [
        { key: 'pend', value: receivedSummary.pending, label: 'Por responder', hint: 'Esperan tu respuesta', tone: 'warning' },
        { key: 'acc', value: receivedSummary.accepted, label: 'Confirmadas', hint: 'Citas que atenderás', tone: 'success' },
        { key: 'hoy', value: receivedSummary.today, label: 'Hoy', hint: 'Confirmadas para hoy', tone: 'info' }
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

  // Cancelar y rechazar pasan por el diálogo con motivo: confirma siempre (antes el cliente
  // cancelaba de un clic) y le cuenta el porqué a la contraparte.
  const confirmReason = async (reason) => {
    const { kind: reasonKind, appointment } = reasonTarget;
    try {
      onAppointmentUpdated?.(
        await updateAppointmentStatus(appointment.id, reasonKind === 'reject' ? 'rejected' : 'cancelled', reason)
      );
    } catch (error) {
      throw new Error(adErrorMessage(error, 'No se pudo actualizar la cita.'));
    }
  };
  const reasonMessage = (() => {
    if (!reasonTarget) return '';
    const { kind: reasonKind, appointment } = reasonTarget;
    const when = `${formatAgendaDateLong(appointment.date)} a las ${String(appointment.time).split('-')[0].trim()}`;
    if (reasonKind === 'customer-cancel') return `Le avisaremos al taller que ya no asistirás el ${when}. El bloque quedará libre.`;
    return `Le avisaremos a ${appointment.customerName || 'el cliente'} que no podrás atenderlo el ${when}.`;
  })();

  const kind = segment === 'recibidas' ? 'recibidas' : 'mias';
  const groups = segment === 'recibidas' ? receivedGroups : bookedGroups;
  const pastList = groups.past.filter(
    (appointment) => historyFilter === 'all' || appointmentVisualState(appointment, now) === historyFilter
  );
  const list = showHistory ? pastList : groups.upcoming;
  const todayIso = toIsoDate(now);

  // Lo vigente, en el orden en que hay que mirarlo: primero lo que espera respuesta del taller,
  // después lo de hoy y luego lo que viene.
  const toAnswer = segment === 'recibidas' ? groups.upcoming.filter((a) => a.status === 'pending') : [];
  const rest = groups.upcoming.filter((a) => !toAnswer.includes(a));
  const upcomingSections = [
    { key: 'responder', title: 'Por responder', items: toAnswer },
    { key: 'hoy', title: 'Hoy', items: rest.filter((a) => a.date === todayIso) },
    { key: 'proximas', title: 'Próximas', items: rest.filter((a) => a.date !== todayIso) }
  ].filter((section) => section.items.length > 0);

  const renderCard = (appointment) => {
    const isReceived = kind === 'recibidas';
    const meta = describeAppointment(appointment, isReceived ? 'provider' : 'customer', now);
    const isCurrent = meta.state === 'pending' || meta.state === 'accepted';
    const isBusy = busyId === appointment.id;
    const canRespond = isReceived && meta.state === 'pending';
    const canCancel = !isReceived && isCurrent;
    // El taller tambien puede cancelar una cita que ya confirmo (el backend lo permite y la app
    // lo ofrece): si no podra atenderla, libera el bloque y se le avisa al cliente.
    const canProviderCancel = isReceived && meta.state === 'accepted';
    const canBookAgain = !isReceived && !isCurrent && !appointment.rescheduledToId && Boolean(onRebook);
    const isFocused = String(appointment.id) === String(focusAppointmentId);
    const ad = adById(appointment.adId);
    const services = appointment.services?.length ? appointment.services.join(', ') : appointment.service;

    return (
      <div
        key={appointment.id}
        id={`appt-${appointment.id}`}
        className={`agenda-appointment tone-${meta.tone} ${isFocused ? 'is-focused' : ''}`}
      >
        <div className="agenda-appointment-when">
          <strong>{parseIsoDate(appointment.date)?.getDate() ?? '--'}</strong>
          <span>{formatAgendaDateLong(appointment.date).split(' de ')[1] || ''}</span>
          <em>{appointment.time}</em>
        </div>

        <div className="agenda-appointment-body">
          <div className="agenda-appointment-top">
            <span className={`mgmt-status-pill tone-${meta.tone}`}><i className={`appt-dot tone-${meta.tone}`} /> {meta.label}</span>
            {isCurrent && (
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

          {appointment.homeService && (
            <p className="agenda-appointment-notes is-home"><Home size={12} /> A domicilio{appointment.homeAddress ? ` · ${appointment.homeAddress}` : ''}</p>
          )}
          {appointment.notes && (
            <p className="agenda-appointment-notes"><StickyNote size={12} /> {appointment.notes}</p>
          )}

          {(!isCurrent || appointment.rescheduledFromId) && (
            <p className={`agenda-appointment-state tone-${meta.tone}`}>
              {!isCurrent ? `${meta.longLabel}.` : (isReceived ? 'El cliente cambió la hora de esta cita.' : 'Cambiaste la hora de esta cita.')}
              {appointment.cancelReason && !appointment.rescheduledToId ? ` Motivo: ${appointment.cancelReason}.` : ''}
            </p>
          )}
        </div>

        {(canRespond || canCancel || canProviderCancel || canBookAgain) && (
          <div className="agenda-appointment-actions">
            {canProviderCancel && (
              <button
                type="button"
                className="btn-mgmt-delete"
                disabled={isBusy}
                onClick={() => setReasonTarget({ kind: 'provider-cancel', appointment })}
                title="Cancelar esta cita confirmada"
              >
                {isBusy ? <Loader2 size={14} className="spin-icon" /> : <XCircle size={14} />}
                <span>Cancelar cita</span>
              </button>
            )}
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
                  onClick={() => setReasonTarget({ kind: 'reject', appointment })}
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
                onClick={() => setReasonTarget({ kind: 'customer-cancel', appointment })}
                title="Cancelar esta reserva"
              >
                {isBusy ? <Loader2 size={14} className="spin-icon" /> : <XCircle size={14} />}
                <span>Cancelar</span>
              </button>
            )}
            {canBookAgain && (
              <button type="button" className="btn-mgmt-edit" onClick={() => onRebook(appointment)} title="Reservar otra hora en este anuncio">
                <RotateCcw size={14} />
                <span>Otra hora</span>
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
              <h3><CalendarClock size={22} className="text-emerald-600" /> Gestión de citas</h3>
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

          {isResolving ? (
            <div className="ads-mgmt-state">
              <Loader2 size={20} className="spin-icon" />
              <p>Cargando tus citas…</p>
            </div>
          ) : (
          <>
          {segment !== 'agenda' && (
            <div className="appt-counters">
              {counters.map((counter) => (
                <div key={counter.key} className={`appt-counter tone-${counter.tone}`}>
                  <strong>{counter.value}</strong>
                  <span>{counter.label}</span>
                  <small>{counter.hint}</small>
                </div>
              ))}
            </div>
          )}

          <div className="appt-history-toolbar">
            <div className="appt-seg">
              <button
                type="button"
                className={segment === 'recibidas' ? 'active' : ''}
                onClick={() => setSegment('recibidas')}
              >
                Recibidas ({receivedSummary.current})
              </button>
              <button
                type="button"
                className={segment === 'pedidas' ? 'active' : ''}
                onClick={() => setSegment('pedidas')}
              >
                Mis reservas ({bookedSummary.current})
              </button>
              {isProviderAccount && (
                <button
                  type="button"
                  className={segment === 'agenda' ? 'active' : ''}
                  onClick={() => setSegment('agenda')}
                >
                  <Settings size={13} /> Configuración de agenda
                </button>
              )}
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

          {segment !== 'agenda' && showHistory && (
            <div className="appt-filter-row">
              {[
                { key: 'all', label: `Todas (${groups.past.length})` },
                { key: 'cancelled', label: 'Canceladas', tone: 'danger' },
                { key: 'past', label: 'Ya pasaron', tone: 'muted' }
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={historyFilter === option.key ? 'active' : ''}
                  onClick={() => setHistoryFilter(option.key)}
                >
                  {option.tone && <i className={`appt-dot tone-${option.tone}`} />} {option.label}
                </button>
              ))}
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
                    ? 'No tienes solicitudes ni citas por atender.'
                    : 'No tienes citas reservadas. Reserva desde el Mural de anuncios.'}
              </p>
            </div>
          ) : showHistory ? (
            <div className="agenda-appointments-list">
              {list.map(renderCard)}
            </div>
          ) : (
            <div className="agenda-appointments-list">
              {upcomingSections.map((section) => (
                <React.Fragment key={section.key}>
                  <h4 className="appt-subsection">{section.title} <span>{section.items.length}</span></h4>
                  {section.items.map(renderCard)}
                </React.Fragment>
              ))}
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {isCalendarOpen && (
        <AppointmentsCalendarModal
          bookedAppointments={booked}
          receivedAppointments={received}
          onClose={() => setIsCalendarOpen(false)}
          initialSegment={segment === 'pedidas' ? 'mias' : 'recibidas'}
          onUpdateStatus={async (id, status) => {
            const target = received.find((item) => item.id === id);
            if (!target) return;
            if (status === 'rejected') setReasonTarget({ kind: 'reject', appointment: target });
            else await respond(target, status);
          }}
          onRequestCancel={(appointment, isReceived) =>
            setReasonTarget({ kind: isReceived ? 'provider-cancel' : 'customer-cancel', appointment })}
        />
      )}

      {reasonTarget && (
        <AppointmentReasonDialog
          kind={reasonTarget.kind}
          message={reasonMessage}
          onConfirm={confirmReason}
          onClose={() => setReasonTarget(null)}
        />
      )}
    </>,
    document.body
  );
}
