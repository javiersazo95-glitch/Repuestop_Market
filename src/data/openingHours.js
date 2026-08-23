// Horario de atencion de una tienda o de un anuncio del mural.
//
// Port de `mobile/hooks/auth/useScheduleField.ts`, el selector que la app usa en
// el registro de vendedor. Los presets, los tramos de media hora y —sobre todo—
// el FORMATO del texto se replican tal cual: `Proveedor.hours` guarda una cadena
// suelta ("Lun a Vie 09:00 a 18:00") y la comparten las tres plataformas, asi
// que si la web escribiera "Lun a Vie 09:00 - 18:00" el mismo taller se veria
// distinto segun donde se mire.
//
// Va en `src/data/` y no dentro de `components/ads/` a proposito: el registro de
// vendedor de la web todavia pide el horario a mano (o directamente no lo pide),
// y esta es la pieza que le falta.

export const SCHEDULE_DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
export const WEEKEND_DAYS = ['Sab', 'Dom'];

/** Los tres atajos de la app. Cubren la mayoria de los casos sin tocar nada mas. */
export const SCHEDULE_PRESETS = [
  { label: 'Oficina', weekdayOpen: '09:00', weekdayClose: '18:00', weekendEnabled: false, weekendOpen: '10:00', weekendClose: '14:00' },
  { label: 'Comercio', weekdayOpen: '10:00', weekdayClose: '19:00', weekendEnabled: true, weekendOpen: '10:00', weekendClose: '14:00' },
  { label: 'Extendido', weekdayOpen: '09:00', weekdayClose: '20:00', weekendEnabled: true, weekendOpen: '10:00', weekendClose: '18:00' }
];

/** De 08:00 a 22:00 en tramos de media hora, igual que el movil. */
export const TIME_OPTIONS = Array.from({ length: 29 }, (_, index) => {
  const hour = Math.floor(index / 2) + 8;
  const minute = index % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

export function createDefaultSchedule() {
  const [oficina] = SCHEDULE_PRESETS;
  return {
    weekdays: [...SCHEDULE_DAYS],
    weekdayOpen: oficina.weekdayOpen,
    weekdayClose: oficina.weekdayClose,
    weekendEnabled: false,
    weekendDays: [...WEEKEND_DAYS],
    weekendOpen: oficina.weekendOpen,
    weekendClose: oficina.weekendClose
  };
}

export function applyPreset(preset) {
  return {
    weekdays: [...SCHEDULE_DAYS],
    weekdayOpen: preset.weekdayOpen,
    weekdayClose: preset.weekdayClose,
    weekendEnabled: preset.weekendEnabled,
    weekendDays: [...WEEKEND_DAYS],
    weekendOpen: preset.weekendOpen,
    weekendClose: preset.weekendClose
  };
}

export function isPresetActive(schedule, preset) {
  return schedule.weekdays.length === SCHEDULE_DAYS.length
    && schedule.weekdayOpen === preset.weekdayOpen
    && schedule.weekdayClose === preset.weekdayClose
    && schedule.weekendEnabled === preset.weekendEnabled
    && schedule.weekendOpen === preset.weekendOpen
    && schedule.weekendClose === preset.weekendClose;
}

/** Ordena los dias como estan en la semana, no como se fueron tocando. */
function ordenar(dias, orden) {
  return [...dias].sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
}

export function toggleDay(schedule, day) {
  const esFinDeSemana = WEEKEND_DAYS.includes(day);
  const clave = esFinDeSemana ? 'weekendDays' : 'weekdays';
  const orden = esFinDeSemana ? WEEKEND_DAYS : SCHEDULE_DAYS;
  const actuales = schedule[clave];
  return {
    ...schedule,
    [clave]: actuales.includes(day)
      ? actuales.filter((item) => item !== day)
      : ordenar([...actuales, day], orden)
  };
}

/**
 * El texto que se guarda y se muestra: "Lun a Vie 09:00 a 18:00" o, con fin de
 * semana, "Lun a Vie 09:00 a 18:00; Sab y Dom 10:00 a 14:00".
 *
 * El separador es " a " y no un guion, y los tramos se unen con "; ". Es
 * exactamente lo que produce `formattedHours` en el movil.
 */
export function formatOpeningHours(schedule) {
  const partes = [];

  if (schedule.weekdays.length > 0) {
    const dias = schedule.weekdays.length === SCHEDULE_DAYS.length
      ? 'Lun a Vie'
      : schedule.weekdays.join(', ');
    partes.push(`${dias} ${schedule.weekdayOpen} a ${schedule.weekdayClose}`);
  }

  if (schedule.weekendEnabled && schedule.weekendDays.length > 0) {
    const dias = schedule.weekendDays.length === WEEKEND_DAYS.length
      ? 'Sab y Dom'
      : schedule.weekendDays.join(', ');
    partes.push(`${dias} ${schedule.weekendOpen} a ${schedule.weekendClose}`);
  }

  return partes.join('; ');
}

/**
 * Lee de vuelta un horario ya guardado.
 *
 * Hace falta para dos cosas que el movil no necesita: editar un anuncio que ya
 * tiene horario, y prellenar con el `hours` de la tienda. Si la cadena no calza
 * con el formato —viene de antes, o alguien la escribio a mano— se devuelve null
 * y quien llame decide: el formulario cae al horario por defecto en vez de
 * mostrar un selector diciendo algo distinto de lo que hay guardado.
 */
export function parseOpeningHours(texto) {
  const limpio = String(texto || '').trim();
  if (!limpio) return null;

  const schedule = { ...createDefaultSchedule(), weekdays: [], weekendEnabled: false };
  let reconocioAlgo = false;

  limpio.split(';').forEach((tramo) => {
    const match = /^\s*(.+?)\s+(\d{1,2}:\d{2})\s+a\s+(\d{1,2}:\d{2})\s*$/.exec(tramo);
    if (!match) return;
    const [, diasTexto, abre, cierra] = match;

    if (/^Lun a Vie$/i.test(diasTexto)) {
      schedule.weekdays = [...SCHEDULE_DAYS];
      schedule.weekdayOpen = abre; schedule.weekdayClose = cierra;
      reconocioAlgo = true;
      return;
    }
    if (/^Sab y Dom$/i.test(diasTexto)) {
      schedule.weekendEnabled = true; schedule.weekendDays = [...WEEKEND_DAYS];
      schedule.weekendOpen = abre; schedule.weekendClose = cierra;
      reconocioAlgo = true;
      return;
    }

    const dias = diasTexto.split(',').map((d) => d.trim());
    const habiles = dias.filter((d) => SCHEDULE_DAYS.includes(d));
    const finde = dias.filter((d) => WEEKEND_DAYS.includes(d));
    if (habiles.length > 0) {
      schedule.weekdays = ordenar(habiles, SCHEDULE_DAYS);
      schedule.weekdayOpen = abre; schedule.weekdayClose = cierra;
      reconocioAlgo = true;
    }
    if (finde.length > 0) {
      schedule.weekendEnabled = true;
      schedule.weekendDays = ordenar(finde, WEEKEND_DAYS);
      schedule.weekendOpen = abre; schedule.weekendClose = cierra;
      reconocioAlgo = true;
    }
  });

  return reconocioAlgo ? schedule : null;
}

/** Indices de dia (0 = Lunes) del horario, los mismos que usa `agendaConfig`. */
const INDICE_POR_DIA = { Lun: 0, Mar: 1, Mie: 2, Jue: 3, Vie: 4, Sab: 5, Dom: 6 };

export function scheduleWorkingDayIndexes(schedule) {
  const dias = [...schedule.weekdays];
  if (schedule.weekendEnabled) dias.push(...schedule.weekendDays);
  return dias.map((d) => INDICE_POR_DIA[d]).filter((n) => n !== undefined).sort((a, b) => a - b);
}

/**
 * Siembra la agenda de reservas con el horario de atencion publicado.
 *
 * El aviso pide dos horarios: el que se MUESTRA (`openingHours`) y el que se
 * puede RESERVAR (`agendaConfig`). Nada obliga a que coincidan, asi que se podia
 * publicar "Lun a Sab 09:00 a 20:00" con una agenda que solo ofreciera Mar a Vie
 * hasta las 18:00, y el cliente leia una cosa y reservaba contra otra. Partir de
 * lo ya declarado evita esa contradiccion sin impedir ajustarla despues: los
 * bloques y la colacion siguen siendo decision del socio.
 *
 * Devuelve null si el horario no deja ningun dia util.
 */
export function scheduleToAgendaConfig(schedule, base) {
  const dias = scheduleWorkingDayIndexes(schedule);
  if (dias.length === 0) return null;

  const startDay = dias[0];
  const endDay = dias[dias.length - 1];
  // Los dias del rango que no se atienden: un martes cerrado entre lunes y viernes.
  const closedDays = [];
  for (let d = startDay; d <= endDay; d += 1) if (!dias.includes(d)) closedDays.push(d);

  const finDeSemanaDistinto = schedule.weekendEnabled
    && (schedule.weekendOpen !== schedule.weekdayOpen || schedule.weekendClose !== schedule.weekdayClose);

  const customHours = {};
  if (finDeSemanaDistinto) {
    scheduleWorkingDayIndexes({ ...schedule, weekdays: [] }).forEach((d) => {
      customHours[d] = { start: schedule.weekendOpen, end: schedule.weekendClose };
    });
  }

  return {
    ...base,
    startDay,
    endDay,
    closedDays,
    sameHoursEveryDay: !finDeSemanaDistinto,
    defaultHours: { start: schedule.weekdayOpen, end: schedule.weekdayClose },
    customHours
  };
}
