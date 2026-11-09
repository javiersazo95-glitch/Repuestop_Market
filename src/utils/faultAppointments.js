import { profilePath } from '../routes/paths';
import { isAppointmentCurrent } from './appointmentHistory';

/**
 * La cita vigente (pendiente o confirmada) de cada falla, la más próxima. Para el comprador son las citas que pidió él
 * (`customerUserId`); para el taller, las que le hicieron a su taller (`ownerUserId`). El backend las entrega mezcladas.
 */
export function citasPorFalla(citas, userId, asWorkshop = false) {
  const porFalla = {};
  (Array.isArray(citas) ? citas : [])
    // Vigente de verdad: una solicitud que el taller no respondió a tiempo ya no es una cita activa (pasa al historial como «sin respuesta»).
    .filter((cita) => cita.fallaId && ['pending', 'accepted'].includes(cita.status) && isAppointmentCurrent(cita)
      && (userId == null || String(asWorkshop ? cita.ownerUserId : cita.customerUserId) === String(userId)))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .forEach((cita) => { if (!porFalla[cita.fallaId]) porFalla[cita.fallaId] = { ...cita, asWorkshop }; });
  return porFalla;
}

/** Textos de la cita para la tarjeta o la franja: estado, cuándo, con quién y a dónde lleva «Ver cita». */
export function citaTexts(cita) {
  const day = new Date(`${cita.date}T12:00:00`);
  const dayLabel = Number.isNaN(day.getTime()) ? cita.date : new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).format(day).replace(/\./g, '');
  const confirmed = cita.status === 'accepted';
  const place = cita.homeService ? 'A domicilio' : 'En el taller';
  return {
    confirmed,
    // El taller tiene que responder la solicitud pendiente; el comprador solo espera.
    status: confirmed ? 'Cita confirmada' : cita.asWorkshop ? 'Por responder' : 'Cita pendiente',
    when: `${dayLabel} · ${String(cita.time || '').split('-')[0].trim()}`,
    who: `${cita.asWorkshop ? (cita.customerName || 'Cliente') : (cita.tallerName || 'Taller')} · ${place}`,
    to: cita.asWorkshop ? profilePath('citas_taller') : profilePath('mi_taller'),
  };
}

/**
 * Por falla, la solicitud más reciente que el taller no respondió a tiempo (ya venció y sigue «pendiente»), solo si la falla no
 * tiene ahora una cita vigente. El comprador ve la nota «El taller no respondió tu solicitud» y puede elegir otra hora.
 */
export function citasSinRespuestaPorFalla(citas, userId) {
  const vigentes = citasPorFalla(citas, userId);
  const porFalla = {};
  (Array.isArray(citas) ? citas : [])
    .filter((cita) => cita.fallaId && cita.status === 'pending' && !isAppointmentCurrent(cita)
      && !vigentes[cita.fallaId] && (userId == null || String(cita.customerUserId) === String(userId)))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    .forEach((cita) => { if (!porFalla[cita.fallaId]) porFalla[cita.fallaId] = cita; });
  return porFalla;
}

/** «lun 9 nov» de una cita, para la nota de la solicitud sin respuesta. */
export function citaDayLabel(cita) {
  const day = new Date(`${cita.date}T12:00:00`);
  return Number.isNaN(day.getTime()) ? cita.date : new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).format(day).replace(/\./g, '');
}
