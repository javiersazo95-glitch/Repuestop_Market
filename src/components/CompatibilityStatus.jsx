import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { COMPAT, compatibilityMessage } from '../utils/compatibilityCheck';

const TONE_ICON = { ok: CheckCircle2, neutral: CheckCircle2, info: Info, warn: AlertTriangle, loading: Loader2 };

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
          {actions.map((action) => (action.to ? (
            <Link
              key={action.label}
              to={action.to}
              {...(action.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {action.label}
            </Link>
          ) : (
            <button key={action.label} type="button" onClick={action.onClick}>{action.label}</button>
          )))}
        </div>
      )}
    </div>
  );
}
