import { useCallback, useState } from 'react';

/**
 * Lo último que la persona vio de cada registro de seguimiento ("need:12" → "3" ofertas), guardado en el navegador y
 * separado por usuario (`mobile/utils/tracking-seen.ts`). El detalle se marca con un punto solo si hay algo nuevo.
 */
const PREFIX = 'tracking-seen:v1:';

function read(scope) {
  try { return JSON.parse(localStorage.getItem(PREFIX + scope) || '{}') || {}; } catch { return {}; }
}

export function useTrackingSeen(userId) {
  const scope = userId == null ? 'anon' : String(userId);
  const [seen, setSeen] = useState(() => read(scope));
  const markSeen = useCallback((key, signature) => {
    setSeen((current) => {
      const next = { ...current, [key]: signature };
      try { localStorage.setItem(PREFIX + scope, JSON.stringify(next)); } catch { /* sin almacenamiento la novedad vuelve a salir */ }
      return next;
    });
  }, [scope]);
  return { seen, markSeen };
}
