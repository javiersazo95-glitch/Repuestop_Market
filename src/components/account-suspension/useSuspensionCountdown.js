import { useEffect, useState } from 'react';
import { countdownFor } from '../../utils/accountSuspension';

/** Contador de una suspension temporal; corrige el reloj local con la hora del servidor. */
export function useSuspensionCountdown(suspension, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = suspension?.endsAt ?? null;

  useEffect(() => {
    if (!endsAt) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [endsAt, intervalMs]);

  return countdownFor(suspension, now);
}

export default useSuspensionCountdown;
