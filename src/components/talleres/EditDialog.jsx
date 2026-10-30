import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import './taller-editor.css';

/** Ventana de edicion de Mi taller: la misma caja de la agenda, para que todas se vean igual. */
export default function EditDialog({ icon: Icon, title, subtitle, busy, error, saveLabel, onClose, onSave, children }) {
  return createPortal(
    <div className="booking-modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="booking-modal-card agenda-config-modal-card">
        <div className="booking-modal-header">
          <div>
            <h3><Icon size={22} /> {title}</h3>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="story-close-btn" style={{ background: '#f1f5f9', color: '#0f172a' }} aria-label="Cerrar" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="agenda-config-modal-body taller-editor__dialog">
          {children}
          {error && <div className="ad-form-error" role="alert"><AlertTriangle size={15} /><span>{error}</span></div>}
        </div>
        <div className="agenda-config-modal-footer">
          <button type="button" className="btn-auth-primary" style={{ width: 'auto' }} disabled={busy} onClick={onSave}>
            {busy ? <Loader2 size={16} className="spin-icon" /> : <Check size={16} />} {busy ? 'Guardando…' : saveLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
