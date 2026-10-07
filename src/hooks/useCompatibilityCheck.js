import { useCallback, useEffect, useMemo, useState } from 'react';
import { evaluateCompatibilityApi } from '../services/api';
import { COMPAT, compatCacheKey, compatVehicleKey, mapCompatResponse, pendingCompatBatches } from '../utils/compatibilityCheck';

// Caché de la sesión del navegador, compartida por el carrito y el checkout: el mismo producto
// con el mismo vehículo no se vuelve a preguntar al pasar de una página a otra.
const resultCache = new Map();
const DEBOUNCE_MS = 350;
// fetchApi no aplica su timeout cuando se le pasa una señal propia; este es el nuestro.
const TIMEOUT_MS = 8000;

/**
 * Compatibilidad de una lista de productos con su vehículo. `entries`:
 * [{ productoId, esUniversal, vehicle }]. Devuelve `statusOf(productoId, vehicle)`:
 * 'loading' mientras se consulta, el resultado del backend, o null cuando no hay nada que
 * mostrar (sin vehículo evaluable o la consulta falló: se degrada en silencio, nunca bloquea).
 *
 * Una sola llamada para todos los pendientes, con un debounce corto para no disparar una por
 * cada clic al cambiar de vehículo.
 */
export function useCompatibilityCheck(entries, { enabled = true } = {}) {
  const [version, setVersion] = useState(0);
  const [loadingKeys, setLoadingKeys] = useState(() => new Set());
  // Claves que fallaron: no se reintentan solas (sería un bucle contra un backend caído).
  const [failedKeys, setFailedKeys] = useState(() => new Set());

  // Firma estable de lo que hay que evaluar: el efecto corre solo si cambió algo real.
  const signature = useMemo(() => (enabled ? entries
    .filter((entry) => entry && !entry.esUniversal)
    .map((entry) => compatCacheKey(entry.productoId, entry.vehicle))
    .filter((key) => !key.endsWith('#'))
    .sort()
    .join(',') : ''), [entries, enabled]);

  useEffect(() => {
    if (!signature) return undefined;
    const batches = pendingCompatBatches(entries, (key) => resultCache.has(key) || failedKeys.has(key));
    if (batches.length === 0) return undefined;
    const keys = batches.flat().map((item) => item.key);
    setLoadingKeys(new Set(keys));

    const controller = new AbortController();
    // Cancelado porque cambió la lista o se desmontó: no es un fallo del backend.
    let cancelled = false;
    let timeout = null;
    const timer = window.setTimeout(() => {
      timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
      Promise.all(batches.map((batch) => evaluateCompatibilityApi(
        batch.map(({ productoId, vehiculo }) => ({ productoId, vehiculo })),
        { signal: controller.signal },
      ).then((response) => mapCompatResponse(batch, response))))
        .then((parts) => {
          if (cancelled) return;
          parts.forEach((part) => Object.entries(part).forEach(([key, value]) => resultCache.set(key, value)));
          // Lo que el backend no devolvió se trata como fallo: no se muestra nada.
          const missing = keys.filter((key) => !resultCache.has(key));
          if (missing.length) setFailedKeys((current) => new Set([...current, ...missing]));
          setVersion((current) => current + 1);
        })
        .catch(() => {
          // Red, 4xx/5xx o pasó el tiempo: no se muestra nada para estos productos.
          if (!cancelled) setFailedKeys((current) => new Set([...current, ...keys]));
        })
        .finally(() => {
          window.clearTimeout(timeout);
          if (cancelled) return;
          setLoadingKeys((current) => {
            const next = new Set(current);
            keys.forEach((key) => next.delete(key));
            return next;
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
      controller.abort();
      setLoadingKeys(new Set());
    };
    // `entries` se lee a través de `signature`, que resume lo que importa de ella.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, failedKeys]);

  const statusOf = useCallback((productoId, vehicle, esUniversal = false) => {
    if (esUniversal) return COMPAT.UNIVERSAL;
    // Sin vehículo evaluable o sin id válido no se pregunta: tampoco se queda "revisando".
    if (!enabled || !Number(productoId) || !compatVehicleKey(vehicle)) return null;
    const key = compatCacheKey(productoId, vehicle);
    if (resultCache.has(key)) return resultCache.get(key);
    if (loadingKeys.has(key)) return 'loading';
    if (failedKeys.has(key)) return null;
    // Todavía no arranca la consulta (dentro del debounce): ya se dice que se está revisando.
    return 'loading';
    // `version` invalida el callback cuando llega una respuesta a la caché del módulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loadingKeys, failedKeys, version]);

  // Para reintentar a pedido (p. ej. si el checkout rechaza por compatibilidad y la consulta
  // había fallado en silencio): se olvidan los fallos y el efecto vuelve a preguntar.
  const retryFailed = useCallback(() => setFailedKeys(new Set()), []);

  return { statusOf, retryFailed };
}
