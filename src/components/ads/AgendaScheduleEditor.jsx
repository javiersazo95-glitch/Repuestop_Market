import React, { useMemo } from 'react';
import { AlertCircle, CalendarDays, Coffee, Timer } from 'lucide-react';
import {
  WEEKDAYS, SLOT_MINUTE_OPTIONS,
  buildAgendaPreview, getAgendaRangeDays, getAgendaSummaryText,
  getAgendaWeeklySlotsCount, validateAgendaConfig
} from '../../data/agendaConfig';

/**
 * Editor del horario de atencion del plan Empresarial.
 *
 * Es la contraparte web de `mobile/components/ads/AgendaConfigModal.tsx`, con una
 * diferencia deliberada: el movil guarda agendas con nombre reutilizables entre
 * avisos (`services/agenda-configs-storage.ts`, AsyncStorage del dispositivo) y
 * aca la agenda vive UNICAMENTE dentro del anuncio, que es lo unico que el
 * backend persiste (`agendaConfig` de `AnuncioRequestDTO`). Una libreria aparte
 * en la web significaria volver a `localStorage`, que es de lo que la fase B se
 * deshizo.
 *
 * La vista previa no es decorativa: `AnuncioAgendamientoService.validarBloque()`
 * acepta un bloque solo si empieza en la hora de apertura y avanza de a
 * `slotMinutes` exactos, asi que los horarios reservables casi nunca son las
 * horas redondas que uno esperaria. Mostrarlos evita la sorpresa.
 */
export default function AgendaScheduleEditor({ config, onChange, disabled = false }) {
  const preview = useMemo(() => buildAgendaPreview(config), [config]);
  const rangeDays = useMemo(() => getAgendaRangeDays(config), [config]);
  const errors = useMemo(() => validateAgendaConfig(config), [config]);
  const weeklySlots = useMemo(() => getAgendaWeeklySlotsCount(config), [config]);

  const patch = (changes) => onChange({ ...config, ...changes });

  const toggleClosedDay = (day) => {
    const closedDays = config.closedDays.includes(day)
      ? config.closedDays.filter((item) => item !== day)
      : [...config.closedDays, day];
    patch({ closedDays });
  };

  const setDayHours = (day, field, value) => {
    const current = config.customHours?.[day] || config.defaultHours;
    patch({ customHours: { ...config.customHours, [day]: { ...current, [field]: value } } });
  };

  return (
    <div className="agenda-editor">
      <div className="agenda-editor-row">
        <div className="booking-field">
          <label>Primer día de atención</label>
          <select
            value={config.startDay}
            disabled={disabled}
            onChange={(e) => patch({ startDay: Number(e.target.value) })}
          >
            {WEEKDAYS.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}
          </select>
        </div>

        <div className="booking-field">
          <label>Último día de atención</label>
          <select
            value={config.endDay}
            disabled={disabled}
            onChange={(e) => patch({ endDay: Number(e.target.value) })}
          >
            {WEEKDAYS.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}
          </select>
        </div>

        <div className="booking-field">
          <label><Timer size={12} /> Duración de cada hora</label>
          <select
            value={config.slotMinutes}
            disabled={disabled}
            onChange={(e) => patch({ slotMinutes: Number(e.target.value) })}
          >
            {SLOT_MINUTE_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>{minutes} minutos</option>
            ))}
          </select>
        </div>
      </div>

      {/* El rango puede envolver la semana (ej. Vie a Mar): `getAgendaRangeDays()`
          replica el `inRange()` del backend, que contempla los dos sentidos. */}
      <div className="booking-field">
        <label>Días cerrados dentro del rango (opcional)</label>
        <div className="ad-tag-picker">
          {rangeDays.map((day) => {
            const closed = config.closedDays.includes(day);
            return (
              <button
                type="button"
                key={day}
                className={`ad-tag-chip ${closed ? 'is-closed-day' : ''}`}
                disabled={disabled}
                onClick={() => toggleClosedDay(day)}
              >
                {WEEKDAYS[day].label}{closed ? ' · cerrado' : ''}
              </button>
            );
          })}
        </div>
        <small className="ad-upload-hint">
          Marca los días que caen dentro del rango pero en los que no atiendes.
        </small>
      </div>

      <div className="agenda-editor-row">
        <div className="booking-field">
          <label>Abre a las</label>
          <input
            type="time"
            value={config.defaultHours.start}
            disabled={disabled}
            onChange={(e) => patch({ defaultHours: { ...config.defaultHours, start: e.target.value } })}
          />
        </div>
        <div className="booking-field">
          <label>Cierra a las</label>
          <input
            type="time"
            value={config.defaultHours.end}
            disabled={disabled}
            onChange={(e) => patch({ defaultHours: { ...config.defaultHours, end: e.target.value } })}
          />
        </div>
      </div>

      <label className="ad-check-row">
        <input
          type="checkbox"
          checked={config.sameHoursEveryDay !== false}
          disabled={disabled}
          onChange={(e) => patch({ sameHoursEveryDay: e.target.checked })}
        />
        <CalendarDays size={13} /> Mismo horario todos los días
      </label>

      {config.sameHoursEveryDay === false && (
        <div className="agenda-day-hours">
          {preview.filter((day) => day.isWorking).map((day) => {
            const hours = config.customHours?.[day.day] || config.defaultHours;
            return (
              <div key={day.day} className="agenda-day-hours-row">
                <span className="agenda-day-name">{day.label}</span>
                <input
                  type="time"
                  value={hours.start}
                  disabled={disabled}
                  onChange={(e) => setDayHours(day.day, 'start', e.target.value)}
                />
                <span className="agenda-day-sep">a</span>
                <input
                  type="time"
                  value={hours.end}
                  disabled={disabled}
                  onChange={(e) => setDayHours(day.day, 'end', e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}

      <label className="ad-check-row">
        <input
          type="checkbox"
          checked={config.breakEnabled === true}
          disabled={disabled}
          onChange={(e) => patch({ breakEnabled: e.target.checked })}
        />
        <Coffee size={13} /> Cierro por colación
      </label>

      {config.breakEnabled && (
        <div className="agenda-editor-row">
          <div className="booking-field">
            <label>Colación desde</label>
            <input
              type="time"
              value={config.breakHours.start}
              disabled={disabled}
              onChange={(e) => patch({ breakHours: { ...config.breakHours, start: e.target.value } })}
            />
          </div>
          <div className="booking-field">
            <label>Colación hasta</label>
            <input
              type="time"
              value={config.breakHours.end}
              disabled={disabled}
              onChange={(e) => patch({ breakHours: { ...config.breakHours, end: e.target.value } })}
            />
          </div>
        </div>
      )}

      <div className="agenda-preview">
        <div className="agenda-preview-head">
          <strong>Así queda tu semana</strong>
          <span>{getAgendaSummaryText(config)} · {weeklySlots} horas reservables</span>
        </div>
        <div className="agenda-preview-grid">
          {preview.map((day) => (
            <div key={day.day} className={`agenda-preview-day ${day.isWorking ? '' : 'is-off'}`}>
              <span className="agenda-preview-day-name">{day.short}</span>
              {day.isWorking && day.hours
                ? (
                  <>
                    <span className="agenda-preview-hours">{day.hours.start}–{day.hours.end}</span>
                    <span className="agenda-preview-slots">{day.slots.length} horas</span>
                  </>
                )
                : <span className="agenda-preview-hours is-off">Cerrado</span>}
            </div>
          ))}
        </div>

        {/* Los bloques del primer dia habil, tal como los va a ver el cliente. */}
        {(() => {
          const firstOpen = preview.find((day) => day.isWorking && day.slots.length > 0);
          if (!firstOpen) return null;
          return (
            <div className="agenda-preview-slots-row">
              <span className="agenda-preview-slots-label">Horas del {firstOpen.label.toLowerCase()}:</span>
              {firstOpen.slots.slice(0, 8).map((slot) => (
                <span key={slot.label} className="agenda-slot-chip is-preview">{slot.label}</span>
              ))}
              {firstOpen.slots.length > 8 && (
                <span className="agenda-preview-slots-more">+{firstOpen.slots.length - 8} más</span>
              )}
            </div>
          );
        })()}
      </div>

      {errors.length > 0 && (
        <div className="ad-form-error">
          <AlertCircle size={16} />
          <span>{errors.join('\n')}</span>
        </div>
      )}
    </div>
  );
}
