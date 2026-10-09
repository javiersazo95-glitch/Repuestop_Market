import {
  toAgendaConfigPayload, validateAgendaConfig, getAgendaWorkingDays, getAgendaDayHours,
  PRINCIPAL_AGENDA_NAME,
} from './agendaConfig';
import { SCHEDULE_DAYS, WEEKEND_DAYS } from './openingHours';

/**
 * Reglas del horario de atencion del taller (24/7 / urgencias + horario normal). Las usa
 * `components/ads/WorkshopHoursSection.jsx` en la acreditacion y en "Horario y urgencias".
 * Mismas reglas que `mobile/components/ads/WorkshopHoursSection.tsx`.
 */

export const URGENCY_SERVICE_OPTIONS = [
  'Grúa',
  'Auxilio mecánico',
  'Cerrajería automotriz',
  'Neumáticos',
  'Electricidad automotriz',
  'Batería',
];

export const EMPTY_WORKSHOP_HOURS = {
  atiende24Horas: null,
  servicios24Horas: [],
  tieneHorarioNormal: null,
  horario: null,
};

/** El taller necesita horario normal salvo que sea "solo 24/7". */
export function needsRegularHours(value) {
  if (value.atiende24Horas === false) return true;
  return value.atiende24Horas === true && value.tieneHorarioNormal === true;
}

/** Qué falta para poder enviar; vacío = completo. */
export function workshopHoursMissing(value) {
  if (value.atiende24Horas === null) return ['si atiendes 24/7 o urgencias'];
  if (value.atiende24Horas && value.tieneHorarioNormal === null) return ['si tienes servicios con horario normal'];
  if (needsRegularHours(value)) {
    if (!value.horario) return ['horario de atención'];
    if (validateAgendaConfig(value.horario).length > 0) return ['un horario de atención válido'];
  }
  return [];
}

/** Campos que espera el backend (`Formulario` / `ActualizarHorario`). */
export function toWorkshopHoursPayload(value) {
  const atiende24Horas = value.atiende24Horas === true;
  const tieneHorarioNormal = !atiende24Horas || value.tieneHorarioNormal !== false;
  return {
    atiende24Horas,
    servicios24Horas: atiende24Horas ? value.servicios24Horas : [],
    tieneHorarioNormal,
    horario: tieneHorarioNormal && value.horario
      ? { name: PRINCIPAL_AGENDA_NAME, ...toAgendaConfigPayload(value.horario) }
      : null,
  };
}



/**
 * Pasa el "Horario principal" del taller (agenda) al selector de horario de atención
 * del anuncio (`OpeningHoursPicker`), para que un anuncio nuevo arranque con el horario
 * normal ya registrado. El selector solo distingue semana y fin de semana: se toma el
 * horario del primer día atendido de cada grupo. Igual que `agendaToScheduleSnapshot`
 * en la app.
 */
export function agendaToOpeningSchedule(config) {
  const working = getAgendaWorkingDays(config);
  const weekdays = working.filter((day) => day <= 4);
  const weekend = working.filter((day) => day >= 5);
  const weekdayHours = weekdays.length ? getAgendaDayHours(config, weekdays[0]) : null;
  const weekendHours = weekend.length ? getAgendaDayHours(config, weekend[0]) : null;
  return {
    weekdays: weekdays.map((day) => SCHEDULE_DAYS[day]),
    weekdayOpen: weekdayHours?.start || config.defaultHours.start,
    weekdayClose: weekdayHours?.end || config.defaultHours.end,
    weekendEnabled: weekend.length > 0,
    weekendDays: weekend.length ? weekend.map((day) => WEEKEND_DAYS[day - 5]) : [...WEEKEND_DAYS],
    weekendOpen: weekendHours?.start || config.defaultHours.start,
    weekendClose: weekendHours?.end || config.defaultHours.end,
  };
}
