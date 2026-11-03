import { appointmentHistoryKind, isAppointmentCurrent } from './appointmentHistory';

/** Clave que une una cita con su cliente: el id de usuario y, para citas viejas, el correo. */
export function appointmentClientKey(appointment) {
  if (appointment.customerUserId) return `u:${appointment.customerUserId}`;
  const email = (appointment.customerEmail || '').trim().toLowerCase();
  return email ? `e:${email}` : `n:${(appointment.customerName || '').trim().toLowerCase()}`;
}

const vehicleLabel = (appointment) => [appointment.vehiclePatent, appointment.vehicleModel].filter(Boolean).join(' · ');
const locationOf = (appointment) => appointment.customerLocation || (appointment.homeService ? appointment.homeAddress : '') || null;

/**
 * Agrupa las citas recibidas por cliente (una fila por persona). Contacto, vehículo y ubicación salen de su cita más
 * reciente; la calificación es su reputación como comprador. `isReturning`: el taller ya lo atendió alguna vez.
 */
export function buildWorkshopClients(received, now = new Date()) {
  const byMoment = (a) => `${a.date} ${a.time}`;
  const sorted = [...received].sort((a, b) => byMoment(b).localeCompare(byMoment(a)));
  const clients = new Map();
  sorted.forEach((appointment) => {
    const key = appointmentClientKey(appointment);
    let client = clients.get(key);
    if (!client) {
      client = {
        key,
        name: appointment.customerName || 'Cliente sin nombre',
        phone: appointment.customerPhone || '',
        email: appointment.customerEmail || '',
        rating: null,
        ratingCount: 0,
        vehicles: [],
        location: null,
        totalAppointments: 0,
        currentAppointments: 0,
        attendedAppointments: 0,
        lastDate: appointment.date,
        isReturning: false,
      };
      clients.set(key, client);
    }
    client.totalAppointments += 1;
    if (isAppointmentCurrent(appointment, now)) client.currentAppointments += 1;
    else if (appointmentHistoryKind(appointment) === 'finished') client.attendedAppointments += 1;
    const vehicle = vehicleLabel(appointment);
    if (vehicle && !client.vehicles.includes(vehicle)) client.vehicles.push(vehicle);
    if (!client.location) client.location = locationOf(appointment);
    if (client.rating === null && appointment.customerRating) {
      client.rating = appointment.customerRating;
      client.ratingCount = appointment.customerRatingCount || 0;
    }
  });
  clients.forEach((client) => { client.isReturning = client.attendedAppointments > 0; });
  return Array.from(clients.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const EMPTY_CLIENT_QUERY = { text: '', status: 'all', rating: 'all', activity: 'all', sort: 'recent' };

export const countActiveClientFilters = (query) => [query.status, query.rating, query.activity].filter((value) => value !== 'all').length;

/** Busca por nombre, contacto, vehículo y ubicación; aplica los filtros y ordena. */
export function applyClientQuery(list, query) {
  const words = normalize(query.text.trim()).split(/\s+/).filter(Boolean);
  const filtered = list.filter((client) => {
    if (query.status !== 'all' && client.isReturning !== (query.status === 'returning')) return false;
    if (query.rating !== 'all' && (client.rating !== null) !== (query.rating === 'rated')) return false;
    if (query.activity === 'current' && client.currentAppointments === 0) return false;
    if (words.length === 0) return true;
    const haystack = normalize([client.name, client.phone, client.email, client.location, ...client.vehicles].filter(Boolean).join(' '));
    return words.every((word) => haystack.includes(word));
  });
  return [...filtered].sort((a, b) => {
    switch (query.sort) {
      case 'oldest': return a.lastDate.localeCompare(b.lastDate);
      case 'name': return a.name.localeCompare(b.name, 'es');
      case 'most': return b.totalAppointments - a.totalAppointments || b.lastDate.localeCompare(a.lastDate);
      case 'rating': return (b.rating ?? -1) - (a.rating ?? -1) || b.lastDate.localeCompare(a.lastDate);
      default: return b.lastDate.localeCompare(a.lastDate);
    }
  });
}

export const EMPTY_HISTORY_QUERY = { text: '', status: 'all', origin: 'all', outcome: 'all', sort: 'recent' };

export const countActiveHistoryFilters = (query) => [query.status, query.origin, query.outcome].filter((value) => value !== 'all').length;

/** Busca por texto, aplica los filtros y ordena las citas del historial. */
export function applyHistoryQuery(list, query) {
  const words = normalize(query.text.trim()).split(/\s+/).filter(Boolean);
  const filtered = list.filter((a) => {
    if (query.status !== 'all' && appointmentHistoryKind(a) !== query.status) return false;
    if (query.origin !== 'all' && Boolean(a.fallaId) !== (query.origin === 'falla')) return false;
    if (query.outcome === 'NONE' ? Boolean(a.result) : query.outcome !== 'all' && a.result?.outcome !== query.outcome) return false;
    if (words.length === 0) return true;
    const haystack = normalize([
      a.customerName, a.tallerName, a.workshopAddress, a.customerPhone, a.customerEmail, a.vehiclePatent, a.vehicleModel,
      a.service, ...(a.services || []), a.fallaTitle, a.notes, a.customerLocation, a.homeAddress, a.cancelReason, a.date, a.result?.detail,
    ].filter(Boolean).join(' '));
    return words.every((word) => haystack.includes(word));
  });
  const moment = (a) => `${a.date} ${a.time}`;
  return [...filtered].sort((a, b) => (
    query.sort === 'oldest' ? moment(a).localeCompare(moment(b))
      : query.sort === 'client' ? (a.customerName || '').localeCompare(b.customerName || '', 'es') || moment(b).localeCompare(moment(a))
        : moment(b).localeCompare(moment(a))
  ));
}
