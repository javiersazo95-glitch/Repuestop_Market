import React from 'react';
import { AlarmClock, Clock, Zap } from 'lucide-react';
import { createDefaultAgendaConfig } from '../../data/agendaConfig';
import { URGENCY_SERVICE_OPTIONS, needsRegularHours } from '../../data/workshopHours';
import AgendaScheduleEditor from './AgendaScheduleEditor';

/**
 * Horario de atención del taller: si atiende 24/7 / urgencias y su horario normal.
 * Se usa en la acreditación (viaja con el expediente) y en "Horario y urgencias" ya
 * enviado (`PATCH /automotive-services/me/horario`). Mismo flujo que
 * `mobile/components/ads/WorkshopHoursSection.tsx`.
 *
 * - No atiende 24/7 -> el horario normal es obligatorio.
 * - Atiende 24/7 -> se pregunta si además tiene servicios con horario normal; si no,
 *   el taller es "solo 24/7" y todos sus anuncios se publican 24/7, sin agenda.
 */

function YesNo({ name, value, onChange, yesLabel = 'Sí', noLabel = 'No', disabled }) {
  return (
    <div className="workshop-hours-yesno" role="radiogroup">
      {[true, false].map((option) => (
        <label key={String(option)} className={`workshop-hours-option ${value === option ? 'is-active' : ''}`}>
          <input
            type="radio"
            name={name}
            checked={value === option}
            onChange={() => onChange(option)}
            disabled={disabled}
          />
          {option ? yesLabel : noLabel}
        </label>
      ))}
    </div>
  );
}

export default function WorkshopHoursSection({ value, onChange, disabled = false, idPrefix = 'workshop-hours' }) {
  const patch = (fields) => onChange({ ...value, ...fields });
  const showRegularHours = needsRegularHours(value);
  const withSchedule = (fields) => {
    const next = { ...value, ...fields };
    // Al pasar a necesitar horario, arranca con Lun a Vie 09:00-18:00 para ajustarlo.
    if (needsRegularHours(next) && !next.horario) next.horario = createDefaultAgendaConfig();
    onChange(next);
  };

  const toggleService = (service) => {
    patch({
      servicios24Horas: value.servicios24Horas.includes(service)
        ? value.servicios24Horas.filter((item) => item !== service)
        : [...value.servicios24Horas, service],
    });
  };

  return (
    <div className="workshop-hours">
      <div className="workshop-hours-question">
        <strong><AlarmClock size={15} /> ¿Tu taller ofrece atención 24/7 o urgencias?</strong>
        <small>Los anuncios 24/7 se contactan directo (llamada o WhatsApp), sin agenda de citas.</small>
        <YesNo
          name={`${idPrefix}-24`}
          value={value.atiende24Horas}
          disabled={disabled}
          onChange={(atiende24Horas) => withSchedule({ atiende24Horas, tieneHorarioNormal: atiende24Horas ? value.tieneHorarioNormal : null })}
        />
      </div>

      {value.atiende24Horas && (
        <>
          <div className="workshop-hours-question">
            <strong>¿Qué atiendes 24/7?</strong>
            <small>Opcional. Ayuda a los clientes a saber a qué llamarte de urgencia.</small>
            <div className="workshop-hours-chips">
              {URGENCY_SERVICE_OPTIONS.map((service) => (
                <button
                  key={service}
                  type="button"
                  className={`ad-tag-chip ${value.servicios24Horas.includes(service) ? 'active' : ''}`}
                  onClick={() => toggleService(service)}
                  disabled={disabled}
                  aria-pressed={value.servicios24Horas.includes(service)}
                >
                  {service}
                </button>
              ))}
            </div>
          </div>

          <div className="workshop-hours-question">
            <strong>¿Tienes además servicios con horario normal?</strong>
            <small>Por ejemplo, mantenciones con hora agendada de lunes a viernes.</small>
            <YesNo
              name={`${idPrefix}-normal`}
              value={value.tieneHorarioNormal}
              disabled={disabled}
              onChange={(tieneHorarioNormal) => withSchedule({ tieneHorarioNormal })}
              yesLabel="Sí, también"
              noLabel="No, solo 24/7"
            />
          </div>
        </>
      )}

      {showRegularHours && value.horario && (
        <div className="workshop-hours-question">
          <strong><Clock size={15} /> Horario de atención</strong>
          <small>Días y horas en que atiendes. Se muestra en tus anuncios y es la base de tu agenda de citas.</small>
          <AgendaScheduleEditor config={value.horario} onChange={(horario) => patch({ horario })} disabled={disabled} />
        </div>
      )}

      {value.atiende24Horas && value.tieneHorarioNormal === false && (
        <p className="workshop-hours-notice">
          <Zap size={15} />
          Todos tus anuncios se publicarán como atención 24/7. Si más adelante ofreces servicios con horario normal, agrégalo para recibir citas.
        </p>
      )}
    </div>
  );
}
