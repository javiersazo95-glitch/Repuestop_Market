// Configuracion de agenda del plan Empresarial y generacion de sus bloques.
//
// Port de `mobile/constants/agenda-config.ts` del monorepo. No es una copia por
// comodidad: esta logica tiene que coincidir EXACTO con `validarBloque()` de
// `AnuncioAgendamientoService` (backend, rama `dev`). Si la web ofrece un bloque
// que el backend no reconoce como valido, el POST responde 400 y el cliente ve
// un error despues de llenar todo el formulario.
//
// Los puntos donde el backend manda, y que este archivo replica:
//
// - el indice de dia es 0 = Lunes ... 6 = Domingo, NO el `getDay()` de JS. El
//   backend usa `date.getDayOfWeek().getValue() - 1`, que da exactamente eso.
// - `startDay` puede ser mayor que `endDay`: la jornada envuelve la semana
//   (`inRange()` del backend contempla los dos casos).
// - un bloque es valido si empieza en `start`, cabe entero antes de `end` y
//   `(bloque - start) % slotMinutes == 0`. Por eso los bloques se generan
//   corridos desde la hora de apertura y no en horarios "redondos".
// - la colacion no corre el reloj: el backend rechaza cualquier bloque que se
//   solape con ella, asi que aca se saltan los bloques hasta que termina.
//
// A diferencia del movil, la web NO guarda agendas reutilizables: la unica
// configuracion que existe es la que viaja dentro del anuncio (`agendaConfig`
// de `AnuncioResponseDTO`). El movil las guarda en AsyncStorage del dispositivo
// (`services/agenda-configs-storage.ts`), sin backend detras.

/** 0 = Lunes ... 6 = Domingo. Es el indice que usa el backend, no `Date.getDay()`. */
export const WEEKDAYS = [
  { id: 0, short: 'Lun', label: 'Lunes' },
  { id: 1, short: 'Mar', label: 'Martes' },
  { id: 2, short: 'Mié', label: 'Miércoles' },
  { id: 3, short: 'Jue', label: 'Jueves' },
  { id: 4, short: 'Vie', label: 'Viernes' },
  { id: 5, short: 'Sáb', label: 'Sábado' },
  { id: 6, short: 'Dom', label: 'Domingo' }
];

// `AnuncioService.validarAgenda()` exige 15 <= slotMinutes <= 120.
export const SLOT_MINUTE_OPTIONS = [15, 20, 30, 45, 60, 90, 120];

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Agenda por defecto de un anuncio que recien enciende las reservas.
 *
 * Lun a Vie 09:00-18:00 con colacion apagada es una jornada que el backend
 * acepta sin tocar nada, para que el socio pueda guardar y ajustar despues.
 */
export function createDefaultAgendaConfig() {
  return {
    startDay: 0,
    endDay: 4,
    closedDays: [],
    sameHoursEveryDay: true,
    defaultHours: { start: '09:00', end: '18:00' },
    customHours: {},
    breakEnabled: false,
    breakHours: { start: '13:00', end: '14:00' },
    slotMinutes: 60
  };
}

/**
 * Normaliza lo que venga del backend a la forma que usa el editor.
 *
 * `agendaConfig` es un `Map<String,Object>` en Java: los dias pueden llegar como
 * numeros o como texto, `customHours` con llaves string, y los campos opcionales
 * directamente ausentes. El editor asume la forma completa.
 */
export function normalizeAgendaConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const base = createDefaultAgendaConfig();
  const day = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6 ? parsed : fallback;
  };
  const hours = (value, fallback) => ({
    start: typeof value?.start === 'string' ? value.start : fallback.start,
    end: typeof value?.end === 'string' ? value.end : fallback.end
  });

  const customHours = {};
  if (raw.customHours && typeof raw.customHours === 'object') {
    Object.entries(raw.customHours).forEach(([key, value]) => {
      const index = day(key, null);
      if (index !== null && value) customHours[index] = hours(value, base.defaultHours);
    });
  }

  const slotMinutes = Number(raw.slotMinutes);

  return {
    startDay: day(raw.startDay, base.startDay),
    endDay: day(raw.endDay, base.endDay),
    closedDays: (Array.isArray(raw.closedDays) ? raw.closedDays : [])
      .map((value) => day(value, null))
      .filter((value) => value !== null),
    sameHoursEveryDay: raw.sameHoursEveryDay !== false,
    defaultHours: hours(raw.defaultHours, base.defaultHours),
    customHours,
    breakEnabled: raw.breakEnabled === true,
    breakHours: hours(raw.breakHours, base.breakHours),
    slotMinutes: Number.isFinite(slotMinutes) ? slotMinutes : base.slotMinutes
  };
}

/**
 * Agenda -> el `Map<String,Object>` que espera `AnuncioRequestDTO`.
 *
 * `customHours` solo viaja cuando el horario es por dia: `validarAgenda()` lo
 * recorre entero y un dia con horas invalidas guardado de antes tiraria 400
 * aunque ya no se use. Las llaves van como string porque el backend hace
 * `custom.containsKey(String.valueOf(day))`.
 */
export function toAgendaConfigPayload(config) {
  if (!config) return null;
  const customHours = {};
  if (!config.sameHoursEveryDay) {
    getAgendaWorkingDays(config).forEach((day) => {
      const hours = config.customHours?.[day];
      if (hours) customHours[String(day)] = { start: hours.start, end: hours.end };
    });
  }
  return {
    startDay: config.startDay,
    endDay: config.endDay,
    closedDays: [...config.closedDays].sort((a, b) => a - b),
    sameHoursEveryDay: config.sameHoursEveryDay === true,
    defaultHours: { start: config.defaultHours.start, end: config.defaultHours.end },
    customHours,
    breakEnabled: config.breakEnabled === true,
    breakHours: { start: config.breakHours.start, end: config.breakHours.end },
    slotMinutes: config.slotMinutes
  };
}

// -------------------------------------------------------------
// UTILIDADES DE HORA
// -------------------------------------------------------------

/** 'HH:MM' -> minutos desde medianoche. NaN si el texto no sirve. */
export function timeToMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

export function minutesToTime(minutes) {
  const normalized = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

// -------------------------------------------------------------
// DIAS DE LA JORNADA
// -------------------------------------------------------------

/** Dias entre `startDay` y `endDay` inclusive, envolviendo la semana si hace falta. */
export function getAgendaRangeDays(config) {
  const days = [];
  let current = config.startDay;
  for (let step = 0; step < 7; step += 1) {
    days.push(current);
    if (current === config.endDay) break;
    current = (current + 1) % 7;
  }
  return days;
}

/** El rango menos los dias marcados como cerrados. */
export function getAgendaWorkingDays(config) {
  return getAgendaRangeDays(config).filter((day) => !config.closedDays.includes(day));
}

/** Horario de un dia concreto, o null si ese dia no se atiende. */
export function getAgendaDayHours(config, day) {
  if (!getAgendaWorkingDays(config).includes(day)) return null;
  if (config.sameHoursEveryDay) return config.defaultHours;
  return config.customHours?.[day] || config.defaultHours;
}

/** Indice interno (0 = Lunes) desde el `getDay()` de JS (0 = Domingo). */
export function weekdayIndexFromDate(date) {
  return (date.getDay() + 6) % 7;
}

// -------------------------------------------------------------
// BLOQUES
// -------------------------------------------------------------

/**
 * Bloques reservables de un dia, ya descontada la colacion.
 *
 * Se generan corridos desde la hora de apertura porque asi los valida el
 * backend: `(bloque - start) % slotMinutes` tiene que dar cero.
 */
export function buildAgendaDaySlots(config, day) {
  const hours = getAgendaDayHours(config, day);
  if (!hours) return [];

  const openAt = timeToMinutes(hours.start);
  const closeAt = timeToMinutes(hours.end);
  const size = Math.round(config.slotMinutes);
  if (Number.isNaN(openAt) || Number.isNaN(closeAt) || size <= 0 || closeAt <= openAt) return [];

  const breakStart = config.breakEnabled ? timeToMinutes(config.breakHours.start) : NaN;
  const breakEnd = config.breakEnabled ? timeToMinutes(config.breakHours.end) : NaN;
  const hasBreak = !Number.isNaN(breakStart) && !Number.isNaN(breakEnd) && breakEnd > breakStart;

  const slots = [];
  // Tope defensivo: con bloques de 15' un rango de 24h da a lo mas 96 bloques.
  for (let cursor = openAt; cursor + size <= closeAt && slots.length < 200; cursor += size) {
    const slotEnd = cursor + size;
    if (hasBreak && cursor < breakEnd && slotEnd > breakStart) {
      // El bloque cae en la colacion: se salta hasta que esta termina.
      cursor = breakEnd - size;
      continue;
    }
    slots.push({
      label: `${minutesToTime(cursor)} - ${minutesToTime(slotEnd)}`,
      start: minutesToTime(cursor),
      end: minutesToTime(slotEnd)
    });
  }
  return slots;
}

/** La semana completa, para pintar la vista previa del horario. */
export function buildAgendaPreview(config) {
  const workingDays = getAgendaWorkingDays(config);
  return WEEKDAYS.map((weekday) => {
    const isWorking = workingDays.includes(weekday.id);
    return {
      day: weekday.id,
      label: weekday.label,
      short: weekday.short,
      isWorking,
      hours: isWorking ? getAgendaDayHours(config, weekday.id) : null,
      slots: isWorking ? buildAgendaDaySlots(config, weekday.id) : []
    };
  });
}

/** Bloques de una fecha 'YYYY-MM-DD'. */
export function getAgendaSlotsForDate(config, isoDate) {
  const date = parseIsoDate(isoDate);
  if (!date) return [];
  return buildAgendaDaySlots(config, weekdayIndexFromDate(date));
}

/** Total de bloques que la configuracion ofrece en una semana. */
export function getAgendaWeeklySlotsCount(config) {
  return getAgendaWorkingDays(config).reduce(
    (total, day) => total + buildAgendaDaySlots(config, day).length,
    0
  );
}

/** Resumen de una linea: "Lun a Vie · 09:00-18:00 · bloques de 60 min". */
export function getAgendaSummaryText(config) {
  if (!config) return '';
  const workingDays = getAgendaWorkingDays(config);
  if (workingDays.length === 0) return 'Sin días laborales configurados';

  const rangeDays = getAgendaRangeDays(config);
  const isFullRange = workingDays.length === rangeDays.length;
  const daysText = isFullRange && rangeDays.length > 1
    ? `${WEEKDAYS[config.startDay].short} a ${WEEKDAYS[config.endDay].short}`
    : workingDays.map((day) => WEEKDAYS[day].short).join(', ');

  const hoursText = config.sameHoursEveryDay
    ? `${config.defaultHours.start}-${config.defaultHours.end}`
    : 'horario por día';

  return `${daysText} · ${hoursText} · bloques de ${config.slotMinutes} min`;
}

/**
 * Errores que impiden guardar la configuracion. Vacio = valida.
 *
 * Es mas estricta que `validarAgenda()` del backend a proposito: el backend solo
 * revisa que los datos sean coherentes, no que la agenda sirva para algo. Una
 * jornada mas corta que un bloque pasa su validacion y despues no ofrece ni una
 * hora reservable, que es peor que no tener agenda.
 */
export function validateAgendaConfig(config) {
  const errors = [];
  if (!config) return ['Configura el horario de atención para poder recibir reservas.'];

  const workingDays = getAgendaWorkingDays(config);
  if (workingDays.length === 0) {
    errors.push('Deja al menos un día laboral: marcaste como cerrados todos los días del rango.');
  }

  if (!Number.isFinite(config.slotMinutes) || config.slotMinutes < 15 || config.slotMinutes > 120) {
    errors.push('La duración del bloque debe estar entre 15 y 120 minutos.');
  }

  workingDays.forEach((day) => {
    const hours = getAgendaDayHours(config, day);
    if (!hours) return;
    const start = timeToMinutes(hours.start);
    const end = timeToMinutes(hours.end);
    const dayLabel = WEEKDAYS[day].label;
    if (Number.isNaN(start) || Number.isNaN(end)) {
      errors.push(`El horario de ${dayLabel} no tiene un formato válido (usa HH:MM).`);
      return;
    }
    if (end <= start) {
      errors.push(`En ${dayLabel} la hora de cierre debe ser posterior a la de apertura.`);
      return;
    }
    if (end - start < config.slotMinutes) {
      errors.push(`En ${dayLabel} la jornada es más corta que un bloque de ${config.slotMinutes} min.`);
    }
  });

  if (config.breakEnabled) {
    const breakStart = timeToMinutes(config.breakHours.start);
    const breakEnd = timeToMinutes(config.breakHours.end);
    if (Number.isNaN(breakStart) || Number.isNaN(breakEnd)) {
      errors.push('El horario de colación no tiene un formato válido (usa HH:MM).');
    } else if (breakEnd <= breakStart) {
      errors.push('La colación debe terminar después de empezar.');
    }
  }

  if (errors.length === 0 && getAgendaWeeklySlotsCount(config) === 0) {
    errors.push('Con estos horarios no se genera ningún bloque reservable. Revisa la jornada, la colación y el tamaño del bloque.');
  }

  return errors;
}

// -------------------------------------------------------------
// FECHAS
// -------------------------------------------------------------

export function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' a Date local. `new Date(iso)` lo lee como UTC y corre el dia. */
export function parseIsoDate(isoDate) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim());
  if (!parts) return null;
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "jueves 20 de agosto de 2026", para el resumen y el correo. */
export function formatAgendaDateLong(isoDate) {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;
  const weekday = WEEKDAYS[weekdayIndexFromDate(date)].label.toLowerCase();
  return `${weekday} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatAgendaMonthLabel(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Proximos dias en que el taller atiende, del mas cercano al mas lejano.
 *
 * Arranca en mañana: el backend rechaza cualquier bloque que ya paso
 * (`validarBloque()` compara contra el ahora de America/Santiago), y ofrecer hoy
 * significa ofrecer bloques que pueden haber vencido hace horas.
 */
export function getUpcomingAgendaDates(config, { daysAhead = 60, from = new Date() } = {}) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const dates = [];
  for (let offset = 1; offset <= daysAhead; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const day = weekdayIndexFromDate(date);
    const slots = config ? buildAgendaDaySlots(config, day) : [];
    if (config && slots.length === 0) continue;

    const iso = toIsoDate(date);
    dates.push({
      iso,
      day,
      shortLabel: offset === 1 ? 'Mañana' : `${WEEKDAYS[day].short} ${date.getDate()}`,
      longLabel: formatAgendaDateLong(iso),
      dayNumber: date.getDate(),
      monthShort: MONTH_NAMES[date.getMonth()].slice(0, 3),
      slotsCount: slots.length
    });
  }
  return dates;
}

/** Momento en que parte la cita, a partir de la fecha y del bloque ('09:00 - 10:00'). */
export function getAppointmentStartDate(isoDate, timeLabel) {
  const date = parseIsoDate(isoDate);
  if (!date) return null;
  const start = timeToMinutes(String(timeLabel || '').split('-')[0]?.trim() ?? '');
  if (Number.isNaN(start)) return date;
  date.setHours(Math.floor(start / 60), start % 60, 0, 0);
  return date;
}

/** "En 2 días", "En 3 horas", "En curso" o "Ya pasó". */
export function getTimeUntilLabel(isoDate, timeLabel, from = new Date()) {
  const start = getAppointmentStartDate(isoDate, timeLabel);
  if (!start) return '';

  const diffMinutes = Math.round((start.getTime() - from.getTime()) / 60000);
  // El bloque sigue vigente un rato despues de la hora de inicio.
  if (diffMinutes <= -60) return 'Ya pasó';
  if (diffMinutes <= 0) return 'En curso';
  if (diffMinutes < 60) return `En ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `En ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;

  // A mas de un dia se cuenta por fecha de calendario, no por horas: una cita de
  // mañana a las 09:00 vista hoy a las 08:00 son 25 horas y sigue siendo mañana.
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diffDays = Math.round((startDay.getTime() - fromDay.getTime()) / 86400000);
  if (diffDays <= 1) return 'Mañana';
  return `En ${diffDays} días`;
}
