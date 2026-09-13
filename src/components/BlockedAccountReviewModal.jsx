import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Scale, X } from 'lucide-react';
import { requestBlockedAccountReviewApi, requestBuyerBlockedAccountReviewApi } from '../services/api';

/**
 * Modal para que una cuenta (comprador o vendedor) bloqueada/suspendida pida
 * revision. Extraido de ProfileDashboard: dueño de todo su propio estado de
 * formulario (texto, contacto, envio, exito, error) para que abrirlo/cerrarlo
 * no dependa de nada mas del panel de perfil. El padre solo decide cuando esta
 * abierto y le pasa el motivo del bloqueo y los ids necesarios para el POST.
 */
export default function BlockedAccountReviewModal({
  isOpen,
  onClose,
  isBuyerBlocked,
  isSellerBlocked,
  blockReason,
  blockReasonIsClaim,
  effectiveSellerId,
  effectiveBuyerId,
}) {
  const [text, setText] = useState('');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Cada apertura arranca en blanco, igual que hacia el boton "Solicitar Revision"
  // en ProfileDashboard antes de setear showBlockedReviewModal en true.
  useEffect(() => {
    if (isOpen) {
      setText('');
      setContact('');
      setIsSubmitting(false);
      setSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Por favor describe el motivo o justificación de tu solicitud.');
      return;
    }
    if (isBuyerBlocked) {
      if (!effectiveBuyerId) {
        setError('No se encontró el identificador de tu cuenta.');
        return;
      }
      setIsSubmitting(true);
      setError(null);
      try {
        await requestBuyerBlockedAccountReviewApi(effectiveBuyerId, {
          mensaje: text.trim(),
          contactoAlternativo: contact.trim(),
        });
        setSuccess(true);
      } catch (err) {
        setError(err?.message || 'No se pudo enviar la solicitud de revisión.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (!effectiveSellerId) {
      setError('No se encontró el identificador de la tienda.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await requestBlockedAccountReviewApi(effectiveSellerId, {
        mensaje: text.trim(),
        contactoAlternativo: contact.trim(),
      });
      setSuccess(true);
    } catch (err) {
      setError(err?.message || 'No se pudo enviar la solicitud de revisión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="order-modal-backdrop" onClick={onClose}>
      <div className="order-modal-container blocked-review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="order-modal-header">
          <div className="order-modal-title-group">
            <div className="order-modal-icon-badge badge-moderation">
              <Scale size={20} />
            </div>
            <div className="order-subdialog-heading">
              <h2>Solicitar revisión de cuenta</h2>
              <span className="order-modal-subtitle">
                Envía tus descargos o justificación al equipo de moderación
              </span>
            </div>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="order-modal-body" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <CheckCircle2 size={32} />
            </div>
            <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
              ¡Solicitud Enviada con Éxito!
            </h4>
            <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px' }}>
              Tu solicitud ha sido registrada y está siendo revisada por el equipo de moderación de RepuesTop. Te contactaremos a la brevedad.
            </p>
            <button
              type="button"
              className="btn-auth-primary"
              onClick={onClose}
            >
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="order-modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div className="auth-alert alert-error">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="blocked-review-reason">
              <strong>{blockReasonIsClaim ? 'Reclamo que originó la mediación:' : 'Motivo actual:'}</strong>
              <span>{blockReason}</span>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                Motivo / Explicación de la solicitud *
              </label>
              <textarea
                required
                rows={4}
                maxLength={1000}
                placeholder="Explica detalladamente por qué consideras que tu cuenta debe ser desbloqueada..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <small style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'right' }}>
                {text.length} / 1000 caracteres
              </small>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                Teléfono o correo de contacto alternativo (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: +56 9 1234 5678 o contacto@tienda.cl"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                className="btn-auth-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-auth-primary"
                disabled={isSubmitting || !text.trim()}
                style={{ width: 'auto' }}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
