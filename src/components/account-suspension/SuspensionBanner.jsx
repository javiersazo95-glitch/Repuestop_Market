import React from 'react';
import { Clock, Lock } from 'lucide-react';
import { shortRemaining, suspensionTitle } from '../../utils/accountSuspension';
import { useSuspensionCountdown } from './useSuspensionCountdown';

/**
 * Aviso de una linea para las vistas que la cuenta suspendida conserva (pedidos, ventas, chats,
 * retiros): mantiene el contador a la vista y lleva al panel de suspension.
 */
export default function SuspensionBanner({ suspension, onOpen }) {
  const countdown = useSuspensionCountdown(suspension, 30000);
  if (!suspension) return null;
  const restante = shortRemaining(countdown);
  return (
    <button type="button" className="suspension-banner" onClick={onOpen}>
      {suspension.kind === 'SUSPENSION' ? <Clock size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
      <span className="suspension-banner-text">{suspensionTitle(suspension)}{restante ? ` · ${restante}` : ''}</span>
      <span className="suspension-banner-link">Ver detalle</span>
    </button>
  );
}
