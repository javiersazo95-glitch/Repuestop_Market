import { useEffect, useState } from 'react';

/**
 * Plazo para pagar una compra (el mismo de cualquier pedido, hoy 30 minutos desde el último intento): al vencer el pedido
 * se cancela y devuelve el stock, y "Continuar con el pago" inicia uno nuevo.
 */
export function paymentDeadlineInfo(venceEn, now = Date.now()) {
  if (!venceEn) return null;
  const limit = new Date(venceEn).getTime();
  if (Number.isNaN(limit)) return null;
  const minutesLeft = Math.ceil((limit - now) / 60000);
  if (minutesLeft <= 0) {
    return { expired: true, text: 'El plazo para pagar venció. Al continuar se inicia un pago nuevo.' };
  }
  const hour = new Date(limit).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return {
    expired: false,
    minutesLeft,
    text: `Tienes hasta las ${hour} para pagar · quedan ${minutesLeft} ${minutesLeft === 1 ? 'minuto' : 'minutos'}`,
  };
}

/** Lo mismo, pero se actualiza solo cada 30 segundos mientras haya un pago pendiente. */
export function usePaymentDeadline(venceEn) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!venceEn) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [venceEn]);
  return paymentDeadlineInfo(venceEn, now);
}
