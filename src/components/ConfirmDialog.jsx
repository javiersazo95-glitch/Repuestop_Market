import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Confirmación para una acción que conviene pensar dos veces.
 *
 * Va por portal y con un z-index por sobre `.order-modal-backdrop` (1000) porque
 * se abre DESDE el detalle del pedido: montado dentro, el modal lo recortaría con
 * su propio scroll y quedaría a medio ver.
 *
 * Reutiliza las clases del modal de comisión, que ya son un diálogo centrado con
 * su animación de entrada, en vez de estrenar una tercera caja modal.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Sí, continuar',
  cancelLabel = 'No, volver',
  isBusy = false,
  error = '',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  // El rojo dice "esto destruye algo". Avanzar el estado de un pedido no destruye
  // nada, asi que confirmar la recepcion en rojo leia como si fuera a cancelar.
  const isDanger = tone === 'danger';
  const Icon = isDanger ? AlertTriangle : CheckCircle2;

  return createPortal(
    <div
      className="commission-modal-backdrop confirm-dialog-backdrop"
      onClick={() => { if (!isBusy) onCancel?.(); }}
    >
      <div className="commission-modal-card" onClick={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="commission-modal-header">
          <div className={`commission-icon-badge ${isDanger ? 'confirm-dialog-badge' : 'confirm-dialog-badge--go'}`}>
            <Icon size={22} />
          </div>
          <h3>{title}</h3>
        </div>

        <p className="confirm-dialog-message">{message}</p>

        {error && <p className="confirm-dialog-error">{error}</p>}

        <div className="confirm-dialog-actions">
          <button type="button" className="btn-auth-secondary" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </button>
          <button type="button" className={isDanger ? 'btn-auth-danger' : 'btn-auth-primary'} onClick={onConfirm} disabled={isBusy}>
            {isBusy && <Loader2 size={16} className="spin-icon" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
