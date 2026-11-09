import { profilePath } from '../routes/paths';

/**
 * La cita vigente (pendiente o confirmada) de cada falla, la más próxima. Para el comprador son las citas que pidió él
 * (`customerUserId`); para el taller, las que le hicieron a su taller (`ownerUserId`). El backend las entrega mezcladas.
 */
export function citasPorFalla(citas, userId, asWorkshop = false) {
  const porFalla = {};
  (Array.isArray(citas) ? citas : [])
    .filter((cita) => cita.fallaId && ['pending', 'accepted'].includes(cita.status)
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
