import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarClock, Loader2, Trash2, Check, AlertCircle } from 'lucide-react';
import { createDefaultAgendaConfig, validateAgendaConfig } from '../../data/agendaConfig';
import { upsertAgendaConfig, deleteAgendaConfig, newAgendaConfigId } from '../../services/agendaConfigsStorage';
import { adErrorMessage } from '../../services/adsStorage';
import AgendaScheduleEditor from './AgendaScheduleEditor';

/**
 * Crea o edita una agenda con nombre. El editor de horario (`AgendaScheduleEditor`)
 * se reutiliza tal cual; acá solo se le suma el nombre y la persistencia contra
 * el backend compartido con el móvil.
 */
export default function AgendaConfigModal({ isOpen, configToEdit, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [config, setConfig] = useState(() => createDefaultAgendaConfig());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (configToEdit) {
      setName(configToEdit.name || '');
      setConfig({ ...configToEdit });
    } else {
      setName('');
      setConfig(createDefaultAgendaConfig());
    }
  }, [isOpen, configToEdit]);

  if (!isOpen) return null;

  const errors = validateAgendaConfig(config);
  const canSave = name.trim().length > 0 && errors.length === 0 && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      const list = await upsertAgendaConfig({
        ...config,
        id: configToEdit?.id || newAgendaConfigId(),
        name: name.trim(),
      });
      onSaved?.(list);
      onClose?.();
    } catch (err) {
      setError(adErrorMessage(err, 'No se pudo guardar la agenda.'));
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
      setError(adErrorMessage(err, 'No se pudo eliminar la agenda.'));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="booking-modal-card agenda-config-modal-card">
        <div className="booking-modal-header">
          <div>
            <h3><CalendarClock size={22} className="text-emerald-600" /> {configToEdit ? 'Editar agenda' : 'Nueva agenda'}</h3>
            <p>Arma tus horarios una vez y reutilízalos en tus avisos empresariales.</p>
          </div>
          <button
            type="button"
            className="story-close-btn"
            style={{ background: '#f1f5f9', color: '#0f172a' }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="agenda-config-modal-body">
          <div className="booking-field">
            <label htmlFor="agenda-config-name">Nombre de la agenda</label>
            <input
              id="agenda-config-name"
              type="text"
              maxLength={160}
              placeholder="Ej: Horario taller principal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <AgendaScheduleEditor config={config} onChange={setConfig} disabled={busy} />

          {error && (
            <div className="ad-form-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="agenda-config-modal-footer">
          {configToEdit && (
            <button type="button" className="btn-mgmt-delete" onClick={handleDelete} disabled={busy}>
              <Trash2 size={15} /> Eliminar
            </button>
          )}
          <button type="button" className="btn-auth-primary" style={{ width: 'auto' }} onClick={handleSave} disabled={!canSave}>
            {busy ? <Loader2 size={16} className="spin-icon" /> : <Check size={16} />}
            {busy ? 'Guardando…' : 'Guardar agenda'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
