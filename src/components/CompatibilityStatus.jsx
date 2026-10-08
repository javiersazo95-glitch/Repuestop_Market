import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Car, CheckCircle2, Info, ListChecks, Loader2, MessageCircle, Trash2 } from 'lucide-react';
import { COMPAT, compatibilityMessage } from '../utils/compatibilityCheck';

const TONE_ICON = { ok: CheckCircle2, neutral: CheckCircle2, info: Info, warn: AlertTriangle, loading: Loader2 };

// Las acciones van en UNA fila, compactas (ícono + palabra), igual que la app: el aviso no debe
// tapar el carrito. El texto completo queda en aria-label y title.
const ACTION_UI = {
  'Ver compatibilidad': { short: 'Ver', Icon: ListChecks },
  'Cambiar vehículo': { short: 'Cambiar', Icon: Car },
  'Preguntar a la tienda': { short: 'Preguntar', Icon: MessageCircle },
  'Quitar del carrito': { short: 'Quitar', Icon: Trash2, danger: true },
};

/**
 * Indicador de compatibilidad de un repuesto con el vehículo elegido (carrito y checkout).
 * Siempre ícono + texto (nunca solo color). En NO_COINCIDE ofrece acciones cortas en línea:
 * `actions` = [{ label, onClick } | { label, to, newTab }] (`to`: ruta de la app).
 */
export default function CompatibilityStatus({ status, vehicle, actions = [], id, className = '' }) {
  const message = compatibilityMessage(status, vehicle);
  if (!message) return null;
  const Icon = TONE_ICON[message.tone];
  const showActions = status === COMPAT.NO_COINCIDE && actions.length > 0;

  return (
    <div id={id} className={`compat-status is-${message.tone} ${className}`.trim()} role="status" aria-live="polite">
      <p className="compat-status-text">
        <Icon size={14} className={message.tone === 'loading' ? 'spin-icon' : undefined} aria-hidden="true" />
        <span>{message.text}</span>
      </p>
      {showActions && (
        <div className="compat-status-actions">
          {actions.map((action) => {
            const ui = ACTION_UI[action.label] || { short: action.label, Icon: null };
            const content = <>{ui.Icon && <ui.Icon size={14} aria-hidden="true" />}<span>{ui.short}</span></>;
            const common = { key: action.label, 'aria-label': action.label, title: action.label, className: ui.danger ? 'is-danger' : undefined };
            return action.to ? (
              <Link {...common} to={action.to} {...(action.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {content}
              </Link>
            ) : (
              <button {...common} type="button" onClick={action.onClick}>{content}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
