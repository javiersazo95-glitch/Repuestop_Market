import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Loader2 } from 'lucide-react';

const COPY = {
  reject: {
    title: '¿Rechazar esta solicitud?',
    confirm: 'Sí, rechazar',
    reasons: ['Sin disponibilidad a esa hora', 'No realizo ese servicio', 'Falta un repuesto']
  },
  'provider-cancel': {
    title: '¿Cancelar esta cita confirmada?',
    confirm: 'Sí, cancelar',
    reasons: ['Imprevisto en el taller', 'Falta un repuesto', 'Sin personal disponible']
  },
  'customer-cancel': {
    title: '¿Cancelar esta cita?',
    confirm: 'Sí, cancelar',
    reasons: ['Ya no la necesito', 'No podré asistir', 'Lo resolví en otro lugar']
  }
};

/**
 * Confirmación de cancelar o rechazar una cita, con motivo opcional que se le muestra a la
 * contraparte. Contraparte de `AppointmentReasonModal` de la app: reemplaza los
 * `window.confirm` sueltos y la cancelación del cliente sin confirmar.
 *
 * `kind`: 'reject' | 'provider-cancel' | 'customer-cancel'. `onConfirm(reason)` puede lanzar;
 * el error se muestra aquí mismo y el diálogo sigue abierto.
 */
export default function AppointmentReasonDialog({ kind, message, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const copy = COPY[kind];
  if (!copy) return null;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(err?.message || 'No se pudo completar la acción. Inténtalo nuevamente.');
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="appt-reason-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="appt-reason-card">
        <span className="appt-reason-icon"><AlertCircle size={24} /></span>
        <h4>{copy.title}</h4>
        <p>{message}</p>

        <span className="appt-reason-label">Motivo (opcional, se lo mostraremos)</span>
        <div className="appt-reason-chips">
          {copy.reasons.map((option) => (
            <button
              key={option}
              type="button"
              className={reason === option ? 'active' : ''}
              onClick={() => setReason(reason === option ? '' : option)}
            >
              {option}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={reason}
          maxLength={300}
          placeholder="Otro motivo"
          aria-label="Motivo"
          onChange={(e) => setReason(e.target.value)}
        />

        {error && <p className="appt-reason-error">{error}</p>}

        <div className="appt-reason-actions">
          <button type="button" className="appt-reason-back" onClick={onClose} disabled={busy}>Volver</button>
          <button type="button" className="appt-reason-confirm" onClick={confirm} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin-icon" /> : copy.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
