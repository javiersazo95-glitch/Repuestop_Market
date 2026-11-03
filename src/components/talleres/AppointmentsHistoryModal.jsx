import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CalendarClock, CalendarDays, Check, XCircle, Loader2, AlertTriangle,
  Phone, Car, StickyNote, CarFront, ChevronRight, ClipboardList, RotateCcw, Wrench, Clock, Settings, Home, Lock, MessageCircle, Star, Flag, MapPin,
  ChevronDown, ChevronUp, UserRound, History } from 'lucide-react';
import { confirmWhatsappContact } from '../../utils/whatsappContact';
import {
  formatAgendaDateLong, getTimeUntilLabel, parseIsoDate, toIsoDate
} from '../../data/agendaConfig';
import {
  appointmentHistoryKind, filterAppointmentsFor, groupAppointmentsByTime, summarizeAppointments,
  describeAppointment, isAppointmentCurrent, defaultAppointmentsSegment,
  getAppointmentChangeDeadline, isAppointmentChangeLocked
} from '../../utils/appointmentHistory';
import AppointmentReasonDialog from './AppointmentReasonDialog';
import { updateAppointmentStatus, rateAppointmentWorkshop } from '../../services/talleresStorage';
import WorkshopRatingDialog from './WorkshopRatingDialog';
import AppointmentDetailDialog from './AppointmentDetailDialog';
import '../../styles/appointment-detail.css';
import { apiErrorMessage } from '../../services/walletStorage';
import AppointmentsCalendarModal from './AppointmentsCalendarModal';
import PrincipalAgendaCard from './PrincipalAgendaCard';
import AppointmentChatDialog from './AppointmentChatDialog';
import ListPager from '../ListPager';
import usePagedList from '../../hooks/usePagedList';
import SearchToolbar from '../SearchToolbar';
import { appointmentClientKey, applyHistoryQuery, countActiveHistoryFilters, EMPTY_HISTORY_QUERY } from '../../utils/workshopClients';
import '../../styles/appointments-redesign.css';

const RESULT_LABELS = { REALIZADA: 'Realizada', NO_ASISTIO: 'El cliente no asistió', NO_REALIZADA: 'No se realizó' };
const HISTORY_SORT = [
  { key: 'recent', label: 'Más recientes primero' },
  { key: 'oldest', label: 'Más antiguas primero' },
  { key: 'client', label: 'Cliente (A-Z)' }
];
const HISTORY_STATUS = [
  { key: 'all', label: 'Todas' }, { key: 'finished', label: 'Finalizadas' },
  { key: 'cancelled', label: 'Canceladas / rechazadas' }, { key: 'unanswered', label: 'Sin respuesta' }
];
const HISTORY_ORIGIN = [{ key: 'all', label: 'Todos' }, { key: 'falla', label: 'Fallas automotrices' }, { key: 'perfil', label: 'Perfil del taller' }];
const HISTORY_OUTCOME = [
  { key: 'all', label: 'Todos' }, { key: 'REALIZADA', label: 'Realizada' }, { key: 'NO_ASISTIO', label: 'No asistió' },
  { key: 'NO_REALIZADA', label: 'No se realizó' }, { key: 'NONE', label: 'Sin resultado' }
];

/**
 * Gestión de citas en una sola vista: las reservas que la cuenta pidió en otros
 * talleres ("Pedidas") y las que le reservaron en el suyo ("Recibidas"),
 * separadas en próximas (Gestión) y pasadas/cerradas (Historial).
 *
 * Port de `mobile/app/appointments-history.tsx`. La lista llega ya cargada desde
 * `MiTallerSection` o `MyAppointmentsHub` (`GET /agendamientos/mias`), que devuelve las
 * citas de los dos roles en una sola respuesta.
 */
export default function AppointmentsHistoryModal({
  /** Taller de la cuenta (o null): decide cuales citas son "recibidas" y con que bandeja abre. */
  myTaller = null,
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
  /** Si ya se cargo el taller propio: hasta entonces no se sabe con qué bandeja abrir. */
  tallerLoaded = true,
  /** Dentro de una pagina (la pestaña Citas de Mi taller) en vez de ventana flotante. */
  inline = false,
  /** Comprador: solo las horas que pidio, sin bandeja de recibidas ni agenda. */
  customerOnly = false,
  /** Citas | Historial como pestañas (en vez de «Ver historial»), con buscador, filtro y orden en el historial. */
  tabbed = false,
  /** Vista con la que abre una lista con pestañas: 'history' abre el Historial. */
  initialView = 'current',
  /** Taller: solo las citas de este cliente (clave de `appointmentClientKey`) y el aviso con el que se quita el filtro. */
  clientKey = null,
  onClearClient,
  /** Taller: abre el perfil del cliente de la cita (pestaña Clientes de Mi taller). */
  onOpenClient
}) {
  // La bandeja inicial se decide recién cuando se sabe si la cuenta tiene un taller acreditado:
  // antes partía en "Recibidas" y un cliente la veía un instante antes de saltar a sus reservas.
  const [segment, setSegment] = useState(initialSegment || null); // 'pedidas' | 'recibidas' | 'agenda'
  const [showHistory, setShowHistory] = useState(initialView === 'history');
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'cancelled' | 'unanswered' | 'finished'
  const [reasonTarget, setReasonTarget] = useState(null); // { kind, appointment }
  const [detailId, setDetailId] = useState(null); // cita cuyo detalle y diagnóstico se ve
  const [rateTarget, setRateTarget] = useState(null); // cita a calificar
  // "Finalizar cita": despliega el resultado de esa cita para registrarlo sin esperar a que termine el bloque.
  const [chatTarget, setChatTarget] = useState(null);
  const [givenRatings, setGivenRatings] = useState({}); // { [citaId]: estrellas } recien dadas
  // Cada minuto se reevalúa qué citas siguen vigentes: contadores y secciones se mueven solos.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [historyQuery, setHistoryQuery] = useState(EMPTY_HISTORY_QUERY);
  const [expandedIds, setExpandedIds] = useState([]);
  const toggleExpanded = (id) => setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const identity = useMemo(
    () => ({ userId: sessionUserId, email: userEmail }),
    [sessionUserId, userEmail]
  );
  const ownedTallerIds = useMemo(() => (myTaller ? [myTaller.id] : []), [myTaller]);

  const receivedAll = useMemo(
    () => filterAppointmentsFor(appointments, 'provider', { ownedTallerIds, identity }),
    [appointments, ownedTallerIds, identity]
  );
  const received = useMemo(
    () => (clientKey ? receivedAll.filter((item) => appointmentClientKey(item) === clientKey) : receivedAll),
    [receivedAll, clientKey]
  );
  const clientLabel = useMemo(
    () => (clientKey ? receivedAll.find((item) => appointmentClientKey(item) === clientKey)?.customerName || null : null),
    [receivedAll, clientKey]
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

  // Taller acreditado → "Recibidas"; cliente sin taller → "Mis reservas". Solo un
  // enlace explícito (notificación) abre otra bandeja.
  const isProviderAccount = Boolean(myTaller) || receivedAll.length > 0;
  // La bandeja se elige sola y se corrige si la cuenta resulta ser de taller (las citas o el taller llegan despues):
  // antes podia quedar en «Mis reservas (0)» con una solicitud esperando en «Recibidas». Si la persona ya eligio una
  // pestaña, o llego con un enlace explicito, no se toca.
  const segmentChosenByUser = useRef(false);
  useEffect(() => {
    if (!tallerLoaded) return;
    setSegment((current) => {
      if (initialSegment) return current || initialSegment;
      if (segmentChosenByUser.current) return current;
      return isProviderAccount ? 'recibidas' : defaultAppointmentsSegment(myTaller);
    });
  }, [tallerLoaded, initialSegment, myTaller, isProviderAccount]);
  const chooseSegment = (next) => { segmentChosenByUser.current = true; setSegment(next); };
  const isResolving = segment === null;

  // Llegada desde una notificación: se abre la bandeja y la cita que corresponde.
  useEffect(() => {
    if (!focusAppointmentId) return;
    const target = appointments.find((item) => String(item.id) === String(focusAppointmentId));
    if (!target) return;
    segmentChosenByUser.current = true;
    setSegment(receivedAll.some((item) => item.id === target.id) ? 'recibidas' : 'pedidas');
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

  const respond = async (appointment, status) => {
    setBusyId(appointment.id);
    setActionError('');
    try {
      onAppointmentUpdated?.(await updateAppointmentStatus(appointment.id, status));
    } catch (error) {
      setActionError(apiErrorMessage(error, 'No se pudo actualizar la cita.'));
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
      throw new Error(apiErrorMessage(error, 'No se pudo actualizar la cita.'));
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
  // Con pestañas el historial es un buscador (texto, filtro avanzado y orden); sin ellas, los chips de estado de siempre.
  const pastList = tabbed
    ? applyHistoryQuery(groups.past, historyQuery)
    : groups.past.filter(
      (appointment) => historyFilter === 'all' || appointmentHistoryKind(appointment) === historyFilter
    );
  const list = showHistory ? pastList : groups.upcoming;
  // Lo vigente se muestra completo (es lo que hay que atender); el historial crece sin fin, así que va de a 20.
  const { pageItems: pastPage, pagerProps: pastPager } = usePagedList(pastList, JSON.stringify([segment, historyFilter, historyQuery]), 20);
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
    // Cita en curso: el taller puede terminarla antes de la hora y registrar el resultado de una vez.
    const canFinish = isReceived && Boolean(appointment.canFinish);
    // El taller ya dejó el diagnóstico (el cliente lo ve tras evaluar): solo entonces la tarjeta se abre y muestra el ícono.
    const hasDiagnosis = Boolean(appointment.result || appointment.resultAvailable);
    const canRegisterResult = isReceived && Boolean(appointment.resultPending) && !canFinish && !hasDiagnosis;
    // Dentro de las 24 horas previas una cita confirmada queda fija para ambos (13-oct).
    const changeLocked = isAppointmentChangeLocked(appointment, now);
    const changeNote = isCurrent ? appointmentChangeNote(appointment, isReceived, changeLocked) : null;
    // Fuera de plazo los botones siguen a la vista, en gris y deshabilitados.
    const canCancel = !isReceived && isCurrent;
    // El taller tambien puede cancelar una cita que ya confirmo (el backend lo permite y la app
    // lo ofrece): si no podra atenderla, libera el bloque y se le avisa al cliente.
    const canProviderCancel = isReceived && meta.state === 'accepted';
    const lockedTitle = 'Falta menos de 24 horas para la cita: ya no se puede cancelar ni reagendar';
    const canBookAgain = !isReceived && !isCurrent && !appointment.rescheduledToId && Boolean(onRebook);
    // Una cita confirmada que ya paso se califica una sola vez; despues se ve la nota dada.
    const canRate = !isReceived && appointment.status === 'accepted' && meta.state === 'past';
    const canChat = isCurrent && appointment.chatAvailable !== false;
    const givenRating = givenRatings[appointment.id] ?? appointment.tallerRating ?? null;
    const isFocused = String(appointment.id) === String(focusAppointmentId);
    const isGeneralAppointment = !appointment.services?.length
      && ['Perfil del taller', 'Anuncio de falla automotriz', 'Diagnóstico en fallas automotrices'].includes(appointment.service);
    const services = isGeneralAppointment ? 'Cita general' : (appointment.services?.length ? appointment.services.join(', ') : appointment.service);
    const origin = appointment.fallaId ? 'Diagnóstico en fallas automotrices' : 'Perfil del taller';
    // Vista resumida: el detalle completo se abre con «Ver detalle».
    const isOpen = expandedIds.includes(appointment.id);
    const vehicle = [appointment.vehiclePatent, appointment.vehicleModel].filter(Boolean).join(' · ');
    const person = isReceived ? appointment.customerName : appointment.tallerName;
    const hasContact = isReceived
      ? Boolean(appointment.customerPhone || appointment.customerEmail)
      : Boolean(appointment.workshopPhone || appointment.workshopWhatsapp);
    const showNotes = Boolean(appointment.notes)
      && !(appointment.fallaTitle && appointment.notes.trim() === `Falla: ${appointment.fallaTitle}`.trim());
    const canExpand = hasContact || Boolean(vehicle) || isReceived || Boolean(appointment.fallaTitle) || Boolean(appointment.homeService)
      || Boolean(appointment.result) || showNotes || Boolean(changeNote);
    const canOpenClient = isReceived && Boolean(onOpenClient);

    return (
      <div
        key={appointment.id}
        id={`appt-${appointment.id}`}
        className={`agenda-appointment tone-${meta.tone} ${isFocused ? 'is-focused' : ''} ${hasDiagnosis ? 'is-selectable' : ''}`}
        {...(!hasDiagnosis ? {} : {
          role: 'button',
          tabIndex: 0,
          'aria-label': `Ver el detalle y el diagnóstico de la cita del ${formatAgendaDateLong(appointment.date)}`,
          onClick: (event) => { if (!event.target.closest('a, button')) setDetailId(appointment.id); },
          onKeyDown: (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); setDetailId(appointment.id); } },
        })}
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
            {!isCurrent && hasDiagnosis && (
              <button type="button" className="agenda-appointment-diag" onClick={() => setDetailId(appointment.id)} aria-label="Ver diagnóstico y detalle de la cita">
                <CarFront size={16} /> Ver diagnóstico <ChevronRight size={14} />
              </button>
            )}
            {canOpenClient && (
              <button type="button" className="appt-client-link" onClick={() => onOpenClient(appointment)} aria-label={`Ver perfil de ${appointment.customerName || 'el cliente'}`}>
                <UserRound size={15} /> Ver perfil
              </button>
            )}
          </div>

          <h5>{services || 'Servicio no informado'}</h5>
          {/* Resumen: quién y con qué vehículo. El resto (contacto, origen, resultado…) se abre con «Ver detalle». */}
          {(person || vehicle) && (
            <p className="appt-line">{isReceived ? <UserRound size={13} /> : <Wrench size={13} />} <span>{[person, vehicle].filter(Boolean).join('  ·  ')}</span></p>
          )}
          {/* Al cliente le sirve la dirección exacta a la vista: es a donde tiene que llegar. */}
          {!isReceived && appointment.workshopAddress && (
            <a className="appt-line is-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointment.workshopAddress)}`} target="_blank" rel="noopener noreferrer"><MapPin size={13} /> <span>{appointment.workshopAddress}</span></a>
          )}
          {(!isCurrent || appointment.rescheduledFromId) && (
            <p className={`agenda-appointment-state tone-${meta.tone}`}>
              {!isCurrent ? `${meta.longLabel}.` : (isReceived ? 'El cliente cambió la hora de esta cita.' : 'Cambiaste la hora de esta cita.')}
              {appointment.cancelReason && !appointment.rescheduledToId ? ` Motivo: ${appointment.cancelReason}.` : ''}
            </p>
          )}
        </div>

        {canExpand && (
          <button type="button" className="appt-expand" onClick={() => toggleExpanded(appointment.id)} aria-expanded={isOpen}>
            {isOpen ? 'Ocultar detalle' : 'Ver detalle'} {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        {isOpen && (
          <div className="appt-details">
            {hasContact && (
              <div className="appt-detail"><span className="appt-detail-ic"><Phone size={14} /></span><div><small>Contacto</small>
                {isReceived ? (
                  <>
                    {appointment.customerPhone && <a href={`tel:${appointment.customerPhone}`}>{appointment.customerPhone}</a>}
                    {appointment.customerEmail && <a href={`mailto:${appointment.customerEmail}`}>{appointment.customerEmail}</a>}
                  </>
                ) : (
                  <>
                    {appointment.workshopPhone && <a href={`tel:${appointment.workshopPhone.replace(/\s+/g, '')}`}>{appointment.workshopPhone}</a>}
                    {appointment.workshopWhatsapp && (
                      <a href={`https://wa.me/${appointment.workshopWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (!confirmWhatsappContact(appointment.tallerName, appointment.workshopWhatsapp)) event.preventDefault(); }}>WhatsApp</a>
                    )}
                  </>
                )}
              </div></div>
            )}
            {vehicle && (
              <div className="appt-detail"><span className="appt-detail-ic"><Car size={14} /></span><div><small>Vehículo</small><strong>{vehicle}</strong></div></div>
            )}
            {(isReceived || appointment.fallaTitle) && (
              <div className="appt-detail"><span className="appt-detail-ic"><MessageCircle size={14} /></span><div><small>Origen</small><strong>{origin}</strong>
                {appointment.fallaTitle && <span>Falla: {appointment.fallaTitle}</span>}
              </div></div>
            )}
            {isReceived && appointment.customerLocation && (
              <div className="appt-detail"><span className="appt-detail-ic"><MapPin size={14} /></span><div><small>Ubicación del cliente</small><strong>{appointment.customerLocation}</strong></div></div>
            )}
            {appointment.homeService && (
              <div className="appt-detail"><span className="appt-detail-ic is-home"><Home size={14} /></span><div><small>A domicilio</small><strong>{appointment.homeAddress || 'Dirección por confirmar'}</strong></div></div>
            )}
            {isReceived && appointment.result && (
              <div className="appt-detail"><span className="appt-detail-ic"><ClipboardList size={14} /></span><div><small>Resultado</small>
                <strong>{RESULT_LABELS[appointment.result.outcome] || appointment.result.outcome}{appointment.result.finalCost ? ` · $${Number(appointment.result.finalCost).toLocaleString('es-CL')}` : ''}</strong>
                {appointment.result.detail && <span>{appointment.result.detail}</span>}
              </div></div>
            )}
            {isReceived && appointment.tallerRating && (
              <div className="appt-detail"><span className="appt-detail-ic is-star"><Star size={14} /></span><div><small>Calificación del cliente</small><strong>{appointment.tallerRating} de 5</strong></div></div>
            )}
            {/* Desde una falla la nota nace como "Falla: <titulo>", que ya se ve arriba como la falla de la cita. */}
            {showNotes && (
              <div className="appt-detail is-notes"><span className="appt-detail-ic"><StickyNote size={14} /></span><div><small>Notas</small><span>{appointment.notes}</span></div></div>
            )}
            {changeNote && (
              <div className="appt-detail"><span className="appt-detail-ic">{changeLocked ? <Lock size={14} /> : <Clock size={14} />}</span><div><small>Plazo de cambios</small><span>{changeNote}</span></div></div>
            )}
          </div>
        )}

        {(canChat || canFinish || canRegisterResult || canRespond || canCancel || canProviderCancel || canBookAgain || canRate) && (
          <div className="agenda-appointment-actions">
            {canChat && (
              <button
                type="button"
                className={`btn-mgmt-edit ${appointment.unreadMessages > 0 ? 'has-unread' : ''}`}
                aria-label={appointment.unreadMessages > 0 ? `Enviar mensaje, ${appointment.unreadMessages} sin leer` : 'Enviar mensaje'}
                onClick={() => setChatTarget(appointment)}
              >
                <MessageCircle size={14} /> <span>Mensaje</span>
                {appointment.unreadMessages > 0 && <b className="appt-unread-count">{appointment.unreadMessages > 9 ? '9+' : appointment.unreadMessages}</b>}
              </button>
            )}
            {canRate && (givenRating ? (
              <span className="appt-rated" aria-label={`Calificaste este taller con ${givenRating} de 5`}>
                <Star size={14} /> Calificaste {givenRating}/5
              </span>
            ) : (
              <button type="button" className="btn-mgmt-rate" onClick={() => setRateTarget(appointment)}>
                <Star size={14} /> <span>Calificar taller</span>
              </button>
            ))}
            {canFinish && (
              <button type="button" className="btn-agenda-accept" onClick={() => setDetailId(appointment.id)}>
                <Flag size={14} /> Finalizar cita
              </button>
            )}
            {canRegisterResult && (
              <button type="button" className="btn-agenda-accept" onClick={() => setDetailId(appointment.id)}>
                <ClipboardList size={14} /> Registrar resultado
              </button>
            )}
            {canProviderCancel && (
              <button
                type="button"
                className={`btn-mgmt-delete ${changeLocked ? 'is-locked' : ''}`}
                disabled={isBusy || changeLocked}
                onClick={() => setReasonTarget({ kind: 'provider-cancel', appointment })}
                title={changeLocked ? lockedTitle : 'Cancelar esta cita confirmada'}
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
                className={`btn-mgmt-edit ${changeLocked ? 'is-locked' : ''}`}
                disabled={isBusy || changeLocked}
                onClick={() => onRebook(appointment)}
                title={changeLocked ? lockedTitle : 'Reservar otra hora y cancelar esta'}
              >
                <RotateCcw size={14} />
                <span>Reagendar</span>
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className={`btn-mgmt-delete ${changeLocked ? 'is-locked' : ''}`}
                disabled={isBusy || changeLocked}
                onClick={() => setReasonTarget({ kind: 'customer-cancel', appointment })}
                title={changeLocked ? lockedTitle : 'Cancelar esta reserva'}
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
        {/* Resultado de la cita: el taller lo registra aquí (o en el aviso al entrar); el cliente lo ve tras evaluar. */}
      </div>
    );
  };

  const renderAgendaPanel = () => (
    <div className="appt-agenda-panel">
      <p className="appt-agenda-intro">
        Este horario se comparte con la app y define cuándo los clientes pueden pedirte una hora
        desde tu perfil.
      </p>
      <PrincipalAgendaCard />
    </div>
  );

  // Con pestañas el título dice en cuál vista estás: «Historial de citas» no se confunde con las citas vigentes.
  const pageTitle = tabbed && showHistory ? 'Historial de citas' : (customerOnly ? 'Mis citas' : 'Citas del taller');
  const scheduleOpen = segment === 'agenda';
  const currentCount = segment === 'pedidas' ? bookedSummary.current : receivedSummary.current;
  const homeSegment = customerOnly ? 'pedidas' : 'recibidas';

  const card = (
        <div className={`booking-modal-card agenda-modal-card ${inline ? 'is-inline' : ''} ${tabbed ? 'is-tabbed' : ''}`}>
          <div className="booking-modal-header">
            <div>
              <h3>{showHistory && tabbed ? <History size={22} className="text-emerald-600" /> : <CalendarClock size={22} className="text-emerald-600" />} {pageTitle}</h3>
              {!tabbed && <p>{customerOnly ? 'Las visitas que agendaste en talleres automotrices.' : 'Las solicitudes y citas confirmadas de tus clientes, y el horario en que las recibes.'}</p>}
            </div>
            {tabbed && !isResolving && !showHistory && (
              <div className="appt-head-tools">
                {!customerOnly && isProviderAccount && (
                  <button
                    type="button"
                    className={`appt-tool ${scheduleOpen ? 'is-active' : ''}`}
                    onClick={() => chooseSegment(scheduleOpen ? homeSegment : 'agenda')}
                    aria-pressed={scheduleOpen}
                    aria-label={scheduleOpen ? 'Volver a las citas' : 'Configurar mi horario de atención'}
                    title={scheduleOpen ? 'Volver a las citas' : 'Mi horario de atención'}
                  >
                    <Clock size={19} />
                  </button>
                )}
                <button type="button" className="appt-tool" onClick={() => setIsCalendarOpen(true)} aria-label="Ver calendario" title="Ver calendario">
                  <CalendarDays size={19} />
                </button>
              </div>
            )}
            {!inline && (
              <button
                type="button"
                className="story-close-btn"
                style={{ background: '#f1f5f9', color: '#0f172a' }}
                onClick={onClose}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {isResolving ? (
            <div className="ads-mgmt-state">
              <Loader2 size={20} className="spin-icon" />
              <p>Cargando tus citas…</p>
            </div>
          ) : (
          <>
          {tabbed && (
            <div className="appt-tabs" role="tablist" aria-label="Citas">
              <button type="button" role="tab" aria-selected={!showHistory} className={!showHistory ? 'is-active' : ''} onClick={() => { setShowHistory(false); }}>
                <CalendarClock size={15} /> Citas {currentCount > 0 && <i>{currentCount}</i>}
              </button>
              <button type="button" role="tab" aria-selected={showHistory} className={showHistory ? 'is-active' : ''} onClick={() => { setShowHistory(true); if (segment === 'agenda') setSegment(homeSegment); }}>
                <History size={15} /> Historial
              </button>
            </div>
          )}

          {segment !== 'agenda' && !(tabbed && showHistory) && (
            <div className={`appt-counters ${tabbed ? 'is-compact' : ''}`}>
              {counters.map((counter) => (
                <div key={counter.key} className={`appt-counter tone-${counter.tone}`}>
                  <strong>{counter.value}</strong>
                  <span>{counter.label}</span>
                  <small>{counter.hint}</small>
                </div>
              ))}
            </div>
          )}

          {!tabbed && (
          <div className="appt-history-toolbar">
            {/* Un comprador solo tiene reservas (sin pestañas); un taller recibe citas y no las pide: «Mis reservas»
                solo aparece si ya tuviera alguna de antes. */}
            {!customerOnly && isProviderAccount && (
            <div className="appt-seg">
              <button
                type="button"
                className={segment === 'recibidas' ? 'active' : ''}
                onClick={() => chooseSegment('recibidas')}
              >
                Recibidas ({receivedSummary.current})
              </button>
              {booked.length > 0 && (
                <button
                  type="button"
                  className={segment === 'pedidas' ? 'active' : ''}
                  onClick={() => chooseSegment('pedidas')}
                >
                  Mis reservas ({bookedSummary.current})
                </button>
              )}
              {isProviderAccount && (
                <button
                  type="button"
                  className={segment === 'agenda' ? 'active' : ''}
                  onClick={() => chooseSegment('agenda')}
                >
                  <Settings size={13} /> Configuración de agenda
                </button>
              )}
            </div>
            )}

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
          )}

          {tabbed && showHistory && segment !== 'agenda' && (
            <>
              {clientKey && (
                <div className="appt-client-banner">
                  <UserRound size={16} />
                  <span>{`Citas de ${clientLabel || 'este cliente'}`}</span>
                  {onClearClient && <button type="button" onClick={onClearClient} aria-label="Ver las citas de todos los clientes"><X size={15} /></button>}
                </div>
              )}
              <SearchToolbar
                text={historyQuery.text}
                onTextChange={(text) => setHistoryQuery((current) => ({ ...current, text }))}
                placeholder={customerOnly ? 'Taller, patente, servicio…' : 'Cliente, patente, servicio…'}
                ariaLabel="Buscar en el historial de citas"
                activeFilters={countActiveHistoryFilters(historyQuery)}
                onClearFilters={() => setHistoryQuery((current) => ({ ...current, status: 'all', origin: 'all', outcome: 'all' }))}
                filterSections={[
                  { key: 'status', label: 'Estado', options: HISTORY_STATUS, value: historyQuery.status, onPick: (status) => setHistoryQuery((current) => ({ ...current, status })) },
                  { key: 'origin', label: 'Origen', options: HISTORY_ORIGIN, value: historyQuery.origin, onPick: (origin) => setHistoryQuery((current) => ({ ...current, origin })) },
                  { key: 'outcome', label: 'Resultado registrado', options: HISTORY_OUTCOME, value: historyQuery.outcome, onPick: (outcome) => setHistoryQuery((current) => ({ ...current, outcome })) }
                ]}
                sortOptions={HISTORY_SORT}
                sortValue={historyQuery.sort}
                defaultSort="recent"
                onSort={(sort) => setHistoryQuery((current) => ({ ...current, sort }))}
                resultLabel={pastList.length === 1 ? '1 cita' : `${pastList.length} citas`}
              />
            </>
          )}

          {actionError && segment !== 'agenda' && (
            <div className="ad-form-error">
              <AlertTriangle size={15} />
              <span>{actionError}</span>
            </div>
          )}

          {segment !== 'agenda' && showHistory && !tabbed && (
            <div className="appt-filter-row">
              {[
                { key: 'all', label: `Todas (${groups.past.length})` },
                { key: 'cancelled', label: 'Canceladas', tone: 'danger' },
                { key: 'unanswered', label: 'Sin respuesta', tone: 'warning' },
                { key: 'finished', label: 'Finalizadas', tone: 'success' }
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
                  ? (groups.past.length > 0 ? 'Ninguna cita coincide con la búsqueda o los filtros.' : 'Todavía no hay citas en el historial.')
                  : segment === 'recibidas'
                    ? 'No tienes solicitudes ni citas por atender.'
                    : 'No tienes citas reservadas. Reserva desde el perfil de un taller.'}
              </p>
            </div>
          ) : showHistory ? (
            <div className="agenda-appointments-list">
              {pastPage.map(renderCard)}
              <ListPager pagerProps={pastPager} itemLabel="citas" />
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
  );

  const secondary = (
    <>
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

      {detailId && (
        <AppointmentDetailDialog
          appointment={appointments.find((item) => item.id === detailId) || null}
          viewer={kind === 'recibidas' ? 'provider' : 'customer'}
          onClose={() => setDetailId(null)}
          onEvaluate={(item) => setRateTarget(item)}
        />
      )}

      {rateTarget && (
        <WorkshopRatingDialog
          workshopName={rateTarget.tallerName || 'Taller'}
          requireComment={Boolean(rateTarget.resultAvailable)}
          onSubmit={async (stars, comment) => {
            try {
              await rateAppointmentWorkshop(rateTarget.id, stars, comment);
            } catch (error) {
              throw new Error(apiErrorMessage(error, 'No pudimos guardar tu opinión.'));
            }
            setGivenRatings((current) => ({ ...current, [rateTarget.id]: stars }));
          }}
          onClose={() => setRateTarget(null)}
        />
      )}

      {chatTarget && (
        <AppointmentChatDialog
          appointment={chatTarget}
          sessionUserId={sessionUserId}
          onClose={() => setChatTarget(null)}
        />
      )}
    </>
  );

  if (inline) return <>{card}{secondary}</>;
  return createPortal(
    <>
      <div
        className="booking-modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        role="dialog"
        aria-modal="true"
      >
        {card}
      </div>
      {secondary}
    </>,
    document.body
  );
}

/**
 * Aviso del plazo para cancelar o reagendar: hasta cuándo se puede, o que la cita ya quedó fija.
 * Al taller, una solicitud pendiente a menos de 24 horas le avisa que, si la acepta, quedará fija.
 * Mismo texto que la app (`AppointmentsHubModal`).
 */
function appointmentChangeNote(appointment, isProvider, locked) {
  if (locked) {
    return isProvider && appointment.status === 'pending'
      ? 'Falta menos de 24 horas: si la aceptas, ya no se podrá cancelar ni reagendar.'
      : 'Falta menos de 24 horas: ya no se puede cancelar ni reagendar.';
  }
  const deadline = getAppointmentChangeDeadline(appointment);
  if (!deadline) return null;
  // Una solicitud que el taller aún no responde no lleva el plazo: lo muestra al confirmarse.
  if (appointment.status === 'pending' && isProvider) return null;
  const hh = String(deadline.getHours()).padStart(2, '0');
  const mm = String(deadline.getMinutes()).padStart(2, '0');
  return `Se puede cancelar o reagendar hasta el ${formatAgendaDateLong(toIsoDate(deadline))} a las ${hh}:${mm}.`;
}
