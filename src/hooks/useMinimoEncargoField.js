import { useCallback, useMemo, useState } from 'react';
import {
  MINIMO_DESPACHO_MAXIMO, formatMinimo, formatMinimoInput, minimoVigente, parseMinimoInput,
} from '../utils/minimoDespacho';

/**
 * Estado de la ranura «Mínimo para encargo» (28-nov). Igual que `useMinimoDespachoField`, pero no depende de los
 * métodos de envío: el encargo vale también para retiro en tienda. Con el mínimo fijado, un repuesto sin stock cuyo
 * precio llega a ese monto sigue visible con «Consultar por stock» (el backend decide con EncargoRegla).
 *
 * @param {number|null} [inicial] mínimo ya guardado.
 */
export function useMinimoEncargoField(inicial = null) {
  const vigenteInicial = minimoVigente(inicial);
  const [enabled, setEnabled] = useState(vigenteInicial != null);
  const [texto, setTextoState] = useState(vigenteInicial != null ? formatMinimoInput(String(vigenteInicial)) : '');

  const setTexto = useCallback((value) => setTextoState(formatMinimoInput(value)), []);
  const reset = useCallback((minimo) => {
    const vigente = minimoVigente(minimo);
    setEnabled(vigente != null);
    setTextoState(vigente != null ? formatMinimoInput(String(vigente)) : '');
  }, []);

  const activo = enabled;
  const monto = parseMinimoInput(texto);
  const error = activo && monto != null && monto > MINIMO_DESPACHO_MAXIMO
    ? `El mínimo no puede superar ${formatMinimo(MINIMO_DESPACHO_MAXIMO)}.`
    : null;
  const incompleto = activo && monto == null ? 'Escribe el monto del mínimo para encargo o apaga la opción.' : error;

  return useMemo(
    () => ({ activo, enabled, setEnabled, texto, setTexto, error, incompleto, valor: activo ? monto : null, reset }),
    [activo, enabled, texto, setTexto, error, incompleto, monto, reset],
  );
}

export default useMinimoEncargoField;
