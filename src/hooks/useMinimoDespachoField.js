import { useCallback, useMemo, useState } from 'react';
import {
  MINIMO_DESPACHO_MAXIMO, formatMinimo, formatMinimoInput, minimoVigente, parseMinimoInput, storeDispatches,
} from '../utils/minimoDespacho';

/**
 * Estado de la ranura «Mínimo de despacho» (22-nov), igual que la app (`hooks/auth/useMinimoDespachoField.ts`).
 * La usan Configuración → Envíos y la postulación de tienda (manual o con Google), para que el mínimo se pida igual
 * que los métodos de envío desde que se crea la cuenta.
 *
 * @param {string} shippingMethods CSV de los métodos elegidos (sin despacho la ranura queda deshabilitada).
 * @param {number|null} [inicial] mínimo ya guardado.
 */
export function useMinimoDespachoField(shippingMethods, inicial = null) {
  const vigenteInicial = minimoVigente(inicial);
  const [enabled, setEnabled] = useState(vigenteInicial != null);
  const [texto, setTextoState] = useState(vigenteInicial != null ? formatMinimoInput(String(vigenteInicial)) : '');

  const setTexto = useCallback((value) => setTextoState(formatMinimoInput(value)), []);
  const reset = useCallback((minimo) => {
    const vigente = minimoVigente(minimo);
    setEnabled(vigente != null);
    setTextoState(vigente != null ? formatMinimoInput(String(vigente)) : '');
  }, []);

  const despacha = storeDispatches(shippingMethods);
  const activo = enabled && despacha;
  const monto = parseMinimoInput(texto);
  const error = activo && monto != null && monto > MINIMO_DESPACHO_MAXIMO
    ? `El mínimo no puede superar ${formatMinimo(MINIMO_DESPACHO_MAXIMO)}.`
    : null;
  const incompleto = activo && monto == null ? 'Escribe el monto del mínimo de despacho o apaga la opción.' : error;

  return useMemo(
    () => ({ activo, despacha, enabled, setEnabled, texto, setTexto, error, incompleto, valor: activo ? monto : null, reset }),
    [activo, despacha, enabled, texto, setTexto, error, incompleto, monto, reset],
  );
}

export default useMinimoDespachoField;
