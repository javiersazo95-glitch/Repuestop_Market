import React from 'react';
import { Briefcase, CalendarDays, Clock } from 'lucide-react';
import {
  SCHEDULE_DAYS, WEEKEND_DAYS, SCHEDULE_PRESETS, TIME_OPTIONS,
  applyPreset, isPresetActive, toggleDay, formatOpeningHours
} from '../../data/openingHours';

/**
 * Horario de atencion: dias y horas elegidos, nunca escritos.
 *
 * Es el mismo selector que el registro de vendedor de la app
 * (`mobile/hooks/auth/useScheduleField.ts`): tres presets, los dias habiles con
 * su apertura y cierre, y el fin de semana aparte porque casi siempre tiene otro
 * horario. El texto que produce es identico al del movil, que es lo que permite
 * que `Proveedor.hours` signifique lo mismo en las tres plataformas.
 *
 * Antes esto era un `<input type="text">` de 300 caracteres: cada taller escribia
 * su horario a su manera y no habia forma de compararlos ni de derivar nada.
 */
export default function OpeningHoursPicker({ schedule, onChange, disabled = false }) {
  const resumen = formatOpeningHours(schedule);

  const setHora = (campo, valor) => onChange({ ...schedule, [campo]: valor });

  const renderHoras = (campoAbre, campoCierra) => (
    <div className="hours-range">
      <label>
        <span>Abre</span>
        <select
          value={schedule[campoAbre]}
          disabled={disabled}
          onChange={(e) => setHora(campoAbre, e.target.value)}
        >
          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label>
        <span>Cierra</span>
        <select
          value={schedule[campoCierra]}
          disabled={disabled}
          onChange={(e) => setHora(campoCierra, e.target.value)}
        >
          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
    </div>
  );

  return (
    <div className="hours-picker">
      <div className="hours-presets">
        {SCHEDULE_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.label}
            className={`hours-preset ${isPresetActive(schedule, preset) ? 'active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(applyPreset(preset))}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="hours-block">
        <div className="hours-block-head">
          <Briefcase size={14} />
          <strong>Días hábiles</strong>
        </div>
        <div className="hours-days">
          {SCHEDULE_DAYS.map((day) => (
            <button
              type="button"
              key={day}
              className={`hours-day ${schedule.weekdays.includes(day) ? 'active' : ''}`}
              disabled={disabled}
              onClick={() => onChange(toggleDay(schedule, day))}
            >
              {day}
            </button>
          ))}
        </div>
        {schedule.weekdays.length > 0 && renderHoras('weekdayOpen', 'weekdayClose')}
      </div>

      <div className="hours-block">
        <label className="hours-weekend-toggle">
          <span className="hours-block-head">
            <CalendarDays size={14} />
            <strong>Fin de semana</strong>
            <small>Agregar horario distinto</small>
          </span>
          <input
            type="checkbox"
            checked={schedule.weekendEnabled}
            disabled={disabled}
            onChange={(e) => onChange({ ...schedule, weekendEnabled: e.target.checked })}
          />
        </label>

        {schedule.weekendEnabled && (
          <>
            <div className="hours-days">
              {WEEKEND_DAYS.map((day) => (
                <button
                  type="button"
                  key={day}
                  className={`hours-day ${schedule.weekendDays.includes(day) ? 'active' : ''}`}
                  disabled={disabled}
                  onClick={() => onChange(toggleDay(schedule, day))}
                >
                  {day}
                </button>
              ))}
            </div>
            {schedule.weekendDays.length > 0 && renderHoras('weekendOpen', 'weekendClose')}
          </>
        )}
      </div>

      {/* El texto exacto que se va a guardar. Sin esto el socio no sabe con que
          frase va a quedar publicado su aviso. */}
      <p className={`hours-summary ${resumen ? '' : 'is-empty'}`}>
        <Clock size={13} />
        {resumen || 'Selecciona al menos un día de atención.'}
      </p>
    </div>
  );
}
