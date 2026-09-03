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
    return appointments.filter((appointment) => owned.has(String(appointment.adId)));
  }

  const identity = context.identity;
  if (!identity) return [];
  return appointments.filter(
    (appointment) =>
      (Boolean(identity.userId) && String(appointment.customerUserId) === String(identity.userId)) ||
      sameEmail(appointment.customerEmail, identity.email)
  );
}

/** Separa lo que viene de lo que ya pasó, cada grupo en el orden en que se lee. */
export function groupAppointmentsByTime(appointments, now = new Date()) {
  const todayIso = toIsoDate(now);
  const upcoming = [];
  const past = [];

  appointments.forEach((appointment) => {
    if (isClosedAppointment(appointment.status)) {
      past.push(appointment);
      return;
    }
    // Una cita de hoy sigue siendo "próxima" hasta que termina su bloque.
    const start = getAppointmentStartDate(appointment.date, appointment.time);
    const isFuture = appointment.date > todayIso || (start ? start.getTime() > now.getTime() : false);
    (isFuture ? upcoming : past).push(appointment);
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
  const { upcoming } = groupAppointmentsByTime(appointments, now);
  return {
    total: appointments.length,
    pending: appointments.filter((appointment) => appointment.status === 'pending').length,
    accepted: appointments.filter((appointment) => appointment.status === 'accepted').length,
    rejected: appointments.filter((appointment) => isClosedAppointment(appointment.status)).length,
    upcoming: upcoming.length
  };
}
