import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarClock, Loader2, Trash2, Check, AlertCircle, ArrowRight, ArrowLeft, Info, LayoutGrid, CheckCircle2, XCircle } from 'lucide-react';
import {
  WEEKDAYS, SLOT_MINUTE_OPTIONS,
  buildAgendaPreview, createDefaultAgendaConfig, getAgendaDayHours, getAgendaRangeDays, getAgendaSummaryText,
  getAgendaWeeklySlotsCount, getAgendaWorkingDays, validateAgendaConfig,
} from '../../data/agendaConfig';
import { upsertAgendaConfig, deleteAgendaConfig, newAgendaConfigId } from '../../services/agendaConfigsStorage';
import { apiErrorMessage } from '../../services/walletStorage';
import '../../styles/agenda-wizard.css';

// Los mismos 5 pasos de la app (`mobile/components/talleres/AgendaConfigModal.tsx`).
const STEPS = [
  { id: 0, title: 'Jornada laboral', caption: '¿Qué días abres?' },
  { id: 1, title: 'Días sin atención', caption: '¿Algún día no trabajas?' },
  { id: 2, title: 'Horarios', caption: '¿A qué hora atiendes?' },
  { id: 3, title: 'Bloques', caption: '¿Cuánto dura cada cita?' },
  { id: 4, title: 'Resumen', caption: 'Revisa y ponle nombre' },
];

/**
 * Crea o edita una agenda con nombre como asistente de 5 pasos (igual que la app): jornada, días sin atención, horarios,
 * bloques y resumen con nombre. La persistencia es contra el backend compartido con el móvil.
 */
export default function AgendaConfigModal({ isOpen, configToEdit, onClose, onSaved, title, allowDelete = true }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [config, setConfig] = useState(() => createDefaultAgendaConfig());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setShowErrors(false);
    setStep(0);
    if (configToEdit) {
      setName(configToEdit.name || '');
      setConfig({ ...configToEdit });
    } else {
      setName('');
      setConfig(createDefaultAgendaConfig());
    }
  }, [isOpen, configToEdit]);

  const rangeDays = useMemo(() => getAgendaRangeDays(config), [config]);
  const workingDays = useMemo(() => getAgendaWorkingDays(config), [config]);
  const preview = useMemo(() => buildAgendaPreview(config), [config]);
  const weeklySlots = useMemo(() => getAgendaWeeklySlotsCount(config), [config]);
  const errors = useMemo(() => validateAgendaConfig(config), [config]);

  if (!isOpen) return null;

  const patch = (fields) => setConfig((prev) => ({ ...prev, ...fields }));
  const setDayHours = (day, fields) => setConfig((prev) => {
    const current = prev.customHours?.[day] || prev.defaultHours;
    return { ...prev, customHours: { ...prev.customHours, [day]: { ...current, ...fields } } };
  });
  const toggleClosedDay = (day) => setConfig((prev) => ({
    ...prev,
    closedDays: prev.closedDays.includes(day) ? prev.closedDays.filter((item) => item !== day) : [...prev.closedDays, day],
  }));
  // Los días fuera del rango no pueden quedar "cerrados": dejaba basura en closedDays al mover el rango hacia atrás.
  const handleRangeChange = (fields) => setConfig((prev) => {
    const next = { ...prev, ...fields };
    const valid = getAgendaRangeDays(next);
    return { ...next, closedDays: next.closedDays.filter((day) => valid.includes(day)) };
  });

  const isLastStep = step === STEPS.length - 1;
  const canGoNext = step !== 1 || workingDays.length > 0;
  const canSave = name.trim().length > 0 && errors.length === 0 && !busy;

  const handleSave = async () => {
    if (errors.length > 0 || !name.trim()) { setShowErrors(true); return; }
    setBusy(true);
    setError('');
    try {
      const list = await upsertAgendaConfig({ ...config, id: configToEdit?.id || newAgendaConfigId(), name: name.trim() });
      onSaved?.(list);
      onClose?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar la agenda.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!configToEdit?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      const list = await deleteAgendaConfig(configToEdit.id);
      onSaved?.(list);
      onClose?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo eliminar la agenda.'));
    } finally {
      setBusy(false);
    }
  };

  const renderTimePair = ({ labels = ['Abre', 'Cierra'], hours, onChange }) => (
    <div className="aw-time-row">
      <label><span>{labels[0]}</span><input type="time" value={hours.start} disabled={busy} onChange={(e) => onChange({ start: e.target.value })} /></label>
      <label><span>{labels[1]}</span><input type="time" value={hours.end} disabled={busy} onChange={(e) => onChange({ end: e.target.value })} /></label>
    </div>
  );

  const renderDayChips = ({ value, onPick, prefix }) => (
    <div className="aw-chips">
      {WEEKDAYS.map((weekday) => (
        <button key={`${prefix}-${weekday.id}`} type="button" className={`aw-chip ${value === weekday.id ? 'is-active' : ''}`} disabled={busy} onClick={() => onPick(weekday.id)}>{weekday.short}</button>
      ))}
    </div>
  );

  return createPortal(
    <div className="booking-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }} role="dialog" aria-modal="true">
      <div className="booking-modal-card agenda-config-modal-card agw-card">
        <div className="booking-modal-header">
          <div>
            <h3><CalendarClock size={22} className="text-emerald-600" /> {title || (configToEdit ? 'Editar configuración' : 'Nueva configuración de agenda')}</h3>
            <p>Paso {step + 1} de {STEPS.length} · {STEPS[step].caption}</p>
          </div>
          <button type="button" className="story-close-btn" style={{ background: '#f1f5f9', color: '#0f172a' }} onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="aw-progress" aria-hidden="true">{STEPS.map((item) => <i key={item.id} className={item.id <= step ? 'is-active' : ''} />)}</div>

        <div className="agenda-config-modal-body aw-body">
          {step === 0 && (
            <div className="aw-section">
              <strong>¿Desde qué día empieza tu jornada laboral?</strong>
              {renderDayChips({ value: config.startDay, onPick: (day) => handleRangeChange({ startDay: day }), prefix: 'start' })}
              <strong>¿En qué día finaliza?</strong>
              {renderDayChips({ value: config.endDay, onPick: (day) => handleRangeChange({ endDay: day }), prefix: 'end' })}
              <p className="aw-info"><Info size={16} /> Tu jornada va de {WEEKDAYS[config.startDay].label} a {WEEKDAYS[config.endDay].label} ({rangeDays.length} {rangeDays.length === 1 ? 'día' : 'días'}).</p>
            </div>
          )}

          {step === 1 && (
            <div className="aw-section">
              <strong>¿Hay algún día en que no trabajas?</strong>
              <small>Toca los días que quieras dejar cerrados dentro de tu jornada. Si trabajas todos, no marques ninguno.</small>
              <div className="aw-days">
                {rangeDays.map((day) => {
                  const closed = config.closedDays.includes(day);
                  return (
                    <button key={`closed-${day}`} type="button" className={`aw-day ${closed ? 'is-closed' : ''}`} disabled={busy} onClick={() => toggleClosedDay(day)}>
                      {closed ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                      <span>{WEEKDAYS[day].label}</span>
                      <em>{closed ? 'Cerrado' : 'Abierto'}</em>
                    </button>
                  );
                })}
              </div>
              {workingDays.length === 0 && <p className="aw-error"><AlertCircle size={16} /> Debes dejar al menos un día abierto.</p>}
            </div>
          )}

          {step === 2 && (
            <div className="aw-section">
              <label className="aw-switch">
                <span><strong>Mismo horario todos los días</strong><small>Apágalo si algún día trabajas menos horas.</small></span>
                <input type="checkbox" checked={config.sameHoursEveryDay !== false} disabled={busy} onChange={(e) => patch({ sameHoursEveryDay: e.target.checked })} />
              </label>
              {config.sameHoursEveryDay !== false ? (
                <div className="aw-hours">
                  <b>Horario para {workingDays.length} {workingDays.length === 1 ? 'día' : 'días'}</b>
                  {renderTimePair({ hours: config.defaultHours, onChange: (fields) => patch({ defaultHours: { ...config.defaultHours, ...fields } }) })}
                </div>
              ) : workingDays.map((day) => (
                <div className="aw-hours" key={`hours-${day}`}>
                  <b>{WEEKDAYS[day].label}</b>
                  {renderTimePair({ hours: getAgendaDayHours(config, day) || config.defaultHours, onChange: (fields) => setDayHours(day, fields) })}
                </div>
              ))}
              <label className="aw-switch">
                <span><strong>Pausa de colación</strong><small>Los bloques de esa franja no se ofrecen a los clientes.</small></span>
                <input type="checkbox" checked={config.breakEnabled === true} disabled={busy} onChange={(e) => patch({ breakEnabled: e.target.checked })} />
              </label>
              {config.breakEnabled && (
                <div className="aw-hours">
                  {renderTimePair({ labels: ['Desde', 'Hasta'], hours: config.breakHours, onChange: (fields) => patch({ breakHours: { ...config.breakHours, ...fields } }) })}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="aw-section">
              <strong>¿De cuántos minutos es cada bloque?</strong>
              <small>Es el tiempo que reserva cada cliente al tomar una hora.</small>
              <div className="aw-chips">
                {SLOT_MINUTE_OPTIONS.map((minutes) => (
                  <button key={`slot-${minutes}`} type="button" className={`aw-chip ${config.slotMinutes === minutes ? 'is-active' : ''}`} disabled={busy} onClick={() => patch({ slotMinutes: minutes })}>{minutes} min</button>
                ))}
              </div>
              <p className="aw-info"><LayoutGrid size={16} /> Con esta configuración generas {weeklySlots} bloques reservables por semana.</p>
            </div>
          )}

          {step === 4 && (
            <div className="aw-section">
              <div className="booking-field">
                <label htmlFor="agenda-config-name">Nombre de esta configuración</label>
                <input id="agenda-config-name" type="text" maxLength={40} placeholder="Ej: Horario taller Maipú" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="aw-summary">
                <div><strong><CalendarClock size={16} /> Así queda tu agenda</strong><span>{weeklySlots} bloques/semana</span></div>
                <small>{getAgendaSummaryText(config)}</small>
              </div>
              {preview.map((day) => (
                <div key={`preview-${day.day}`} className={`aw-preview-day ${day.isWorking ? '' : 'is-off'}`}>
                  <div><strong>{day.label}</strong>{day.isWorking && day.hours ? <b>{day.hours.start} - {day.hours.end}</b> : <small>No atiende</small>}</div>
                  {day.slots.length > 0 && <div className="aw-slots">{day.slots.map((slot) => <span key={`${day.day}-${slot.start}`}>{slot.label}</span>)}</div>}
                </div>
              ))}
              {showErrors && (errors.length > 0 || !name.trim()) && (
                <div className="aw-error"><AlertCircle size={16} /><span>{[...(name.trim() ? [] : ['Escribe un nombre para esta configuración.']), ...errors].join('\n')}</span></div>
              )}
            </div>
          )}

          {error && <div className="ad-form-error"><AlertCircle size={16} /><span>{error}</span></div>}
        </div>

        <div className="agenda-config-modal-footer aw-footer">
          {configToEdit && allowDelete && isLastStep && (
            <button type="button" className="btn-mgmt-delete" onClick={handleDelete} disabled={busy}><Trash2 size={15} /> Eliminar</button>
          )}
          {step > 0 && <button type="button" className="aw-back" onClick={() => setStep((current) => current - 1)} disabled={busy}><ArrowLeft size={16} /> Atrás</button>}
          <button
            type="button"
            className="btn-auth-primary"
            style={{ width: 'auto' }}
            onClick={() => (isLastStep ? handleSave() : setStep((current) => current + 1))}
            disabled={isLastStep ? busy : !canGoNext}
            aria-disabled={isLastStep ? !canSave : !canGoNext}
          >
            {busy ? <Loader2 size={16} className="spin-icon" /> : isLastStep ? <Check size={16} /> : <ArrowRight size={16} />}
            {busy ? 'Guardando…' : isLastStep ? 'Guardar configuración' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
