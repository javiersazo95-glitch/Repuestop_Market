import { isClosedAppointment } from '../data/automotiveAdsData';
import { getAppointmentStartDate, toIsoDate } from '../data/agendaConfig';

/**
 * Utilidades para separar y contar los agendamientos de la sesión según el rol.
 * Port de `mobile/utils/appointment-history.ts`. `GET /anuncios/agendamientos/mias`
 * devuelve en UNA lista las citas de los dos roles (las que pedí como cliente y
 * las que me reservaron en mis anuncios); estas funciones las clasifican.
 */

function sameEmail(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/**
 * Citas que le corresponden a quien mira:
 * - `mode: 'provider'` → las recibidas en sus anuncios (`ownedAdIds`).
 * - `mode: 'customer'` → las que reservó él mismo (`identity`).
 */
export function filterAppointmentsFor(appointments, mode, context = {}) {
  if (mode === 'provider') {
    const owned = new Set((context.ownedAdIds || []).map(String));
    const me = context.identity?.userId ? String(context.identity.userId) : '';
    return appointments.filter(
      (appointment) => owned.has(String(appointment.adId)) || (Boolean(me) && String(appointment.ownerUserId ?? '') === me)
    );
  }

  const identity = context.identity;
  if (!identity) return [];
  return appointments.filter(
    (appointment) =>
      (Boolean(identity.userId) && String(appointment.customerUserId) === String(identity.userId)) ||
      sameEmail(appointment.customerEmail, identity.email)
  );
}

/** Momento en que termina el bloque ('09:00 - 10:00'); sin hora de término, una hora después del inicio. */
export function getAppointmentEndDate(appointment) {
  const start = getAppointmentStartDate(appointment.date, appointment.time);
  if (!start) return null;
  const endLabel = String(appointment.time || '').split('-')[1]?.trim();
  const end = endLabel ? getAppointmentStartDate(appointment.date, endLabel) : null;
  return end && end.getTime() > start.getTime() ? end : new Date(start.getTime() + 60 * 60 * 1000);
}

/**
 * La cita sigue vigente: es lo único que cuentan los contadores (regla del 4-oct).
 * Una solicitud pendiente vale hasta su hora de inicio (después ya no se puede responder) y
 * una aceptada hasta que termina su bloque. Canceladas, rechazadas y pasadas no son vigentes.
 * Mismo criterio que la app (`mobile/utils/appointment-history.ts`) y que
 * `AnuncioAgendamientoService.vigente` del backend.
 */
export function isAppointmentCurrent(appointment, now = new Date()) {
  if (isClosedAppointment(appointment.status)) return false;
  const limit = appointment.status === 'pending'
    ? getAppointmentStartDate(appointment.date, appointment.time)
    : getAppointmentEndDate(appointment);
  return limit ? limit.getTime() > now.getTime() : appointment.date >= toIsoDate(now);
}

/** Lo que se ve de una cita: 'pending' | 'accepted' | 'cancelled' (o rechazada) | 'past'. */
export function appointmentVisualState(appointment, now = new Date()) {
  if (isClosedAppointment(appointment.status)) return 'cancelled';
  if (!isAppointmentCurrent(appointment, now)) return 'past';
  return appointment.status === 'accepted' ? 'accepted' : 'pending';
}

/** Panorama actual y futuro de una lista de citas: nada pasado ni cancelado. */
export function summarizeAppointments(appointments, now = new Date()) {
  const todayIso = toIsoDate(now);
  const summary = { pending: 0, accepted: 0, today: 0, current: 0 };
  appointments.forEach((appointment) => {
    if (!isAppointmentCurrent(appointment, now)) return;
    summary.current += 1;
    if (appointment.status === 'pending') {
      summary.pending += 1;
    } else {
      summary.accepted += 1;
      if (appointment.date === todayIso) summary.today += 1;
    }
  });
  return summary;
}

/**
 * Separa las citas de la cuenta por rol. Recibidas = el anuncio es mío (`ownerUserId`, que
 * manda el backend); reservadas = las pedí yo. Un solo criterio para todo el panel: antes el
 * badge usaba `customerUserId` y el historial `ownedAdIds`, y los números no cuadraban.
 */
export function splitAppointmentsByRole(appointments, userId) {
  const me = userId ? String(userId) : '';
  const received = appointments.filter((a) => me && String(a.ownerUserId ?? '') === me);
  const booked = appointments.filter((a) => me && String(a.customerUserId ?? '') === me && String(a.ownerUserId ?? '') !== me);
  return { received, booked };
}

export function summarizeAppointmentsByRole(appointments, userId, now = new Date()) {
  const { received, booked } = splitAppointmentsByRole(appointments, userId);
  return { customer: summarizeAppointments(booked, now), provider: summarizeAppointments(received, now) };
}

/** Separa lo que viene de lo que ya pasó, cada grupo en el orden en que se lee. */
export function groupAppointmentsByTime(appointments, now = new Date()) {
  const upcoming = [];
  const past = [];

  appointments.forEach((appointment) => {
    (isAppointmentCurrent(appointment, now) ? upcoming : past).push(appointment);
  });

  const byMoment = (appointment) => `${appointment.date} ${appointment.time}`;
  upcoming.sort((a, b) => byMoment(a).localeCompare(byMoment(b)));
  past.sort((a, b) => byMoment(b).localeCompare(byMoment(a)));

  return { upcoming, past };
}

/**
 * Une listas de citas sin repetir. Una misma cita puede caer a la vez en "las que
 * reservé" y en "las que me reservaron" cuando el dueño del anuncio y quien
 * reservó son la misma cuenta; sin esto aparecería duplicada.
 */
export function mergeAppointmentsById(...lists) {
  const byId = new Map();
  lists.forEach((list) => list.forEach((appointment) => byId.set(appointment.id, appointment)));
  return Array.from(byId.values());
}

export function countAppointments(appointments, now = new Date()) {
  // Pendientes y aceptadas son solo las vigentes: antes contaban también las de fechas pasadas.
  const summary = summarizeAppointments(appointments, now);
  return {
    total: appointments.length,
    pending: summary.pending,
    accepted: summary.accepted,
    rejected: appointments.filter((appointment) => isClosedAppointment(appointment.status)).length,
    upcoming: summary.current
  };
}

const TONE_BY_STATE = { pending: 'warning', accepted: 'success', cancelled: 'danger', past: 'muted' };

/** Orden y nombre de los estados en la leyenda del calendario (igual que la app). */
export const APPOINTMENT_LEGEND = [
  { state: 'pending', label: 'Pendiente' },
  { state: 'accepted', label: 'Aceptada' },
  { state: 'cancelled', label: 'Cancelada' },
  { state: 'past', label: 'Ya pasó' }
];

export const APPOINTMENT_STATE_ORDER = APPOINTMENT_LEGEND.map((item) => item.state);

/**
 * Cómo se muestra una cita a quien la mira (`viewer`: 'customer' | 'provider'): estado visual,
 * tono (warning amarillo, success verde, danger rojo, muted gris), etiqueta corta y frase
 * completa. Port de `describeAppointment` de la app: distingue quién canceló, si fue
 * reagendada y si venció sin respuesta.
 */
export function describeAppointment(appointment, viewer, now = new Date()) {
  const state = appointmentVisualState(appointment, now);
  const base = { state, tone: TONE_BY_STATE[state] };
  const isProvider = viewer === 'provider';

  if (appointment.status === 'rejected') {
    return { ...base, label: 'Rechazada', longLabel: isProvider ? 'Rechazaste esta solicitud' : 'El taller no pudo atenderte en ese horario' };
  }
  if (appointment.status === 'cancelled') {
    if (appointment.rescheduledToId) {
      return { ...base, label: 'Reagendada', longLabel: isProvider ? 'El cliente la cambió a otra hora' : 'La cambiaste a otra hora' };
    }
    const longLabel = appointment.cancelledBy === 'provider'
      ? (isProvider ? 'Cancelada por ti' : 'Cancelada por el taller')
      : appointment.cancelledBy === 'customer'
        ? (isProvider ? 'Cancelada por el cliente' : 'Cancelada por ti')
        : 'Cancelada';
    return { ...base, label: 'Cancelada', longLabel };
  }
  if (state === 'past') {
    return appointment.status === 'pending'
      ? { ...base, label: 'Sin respuesta', longLabel: isProvider ? 'Venció sin que la respondieras' : 'El taller no respondió a tiempo' }
      : { ...base, label: 'Realizada', longLabel: 'La fecha de esta cita ya pasó' };
  }
  if (state === 'pending') {
    return { ...base, label: isProvider ? 'Por responder' : 'Pendiente', longLabel: isProvider ? 'Espera tu respuesta' : 'Esperando la respuesta del taller' };
  }
  return { ...base, label: 'Aceptada', longLabel: isProvider ? 'Cita confirmada' : 'Confirmada por el taller' };
}

/**
 * Bandeja con la que abre Gestión de citas (regla del 4-oct, igual en la app): quien tiene un
 * anuncio de servicio automotriz PUBLICADO (aprobado y activo) es taller y ve primero las citas
 * recibidas; cualquier otra cuenta ve primero sus reservas. Un anuncio en revisión, rechazado o
 * pausado no cuenta: todavía no recibe reservas.
 */
export function hasPublishedServiceAd(ads = []) {
  return ads.some((ad) => ad?.moderationStatus === 'APROBADO' && ad?.activo !== false);
}

export function defaultAppointmentsSegment(ads = []) {
  return hasPublishedServiceAd(ads) ? 'recibidas' : 'pedidas';
}
