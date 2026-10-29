import { useLista } from '../remoteConfig/hooks';

/**
 * Combustibles del buscador manual de vehiculo (hero del home). Respaldo local; desde el Mantenedor
 * comun salen de la lista `COMBUSTIBLE`, que el backend siembra con estos mismos textos mas los
 * `tipo_combustible` distintos de `rt_vehiculo_catalogo`.
 *
 * El `valor` de la lista es el texto que se guarda en el vehiculo (no un codigo), igual que antes:
 * por eso el desplegable sigue recibiendo strings.
 */
export const COMBUSTIBLES_FALLBACK = [
  'Bencina',
  'Diésel',
  'Eléctrico',
  'Híbrido Sin Recarga Exterior',
  'Híbrido Recarga Exterior',
  'Gas (GLP / GNC)'
];

const toCombustibles = (opciones) => opciones.map((opcion) => opcion.valor).filter(Boolean);

export function useCombustibles() {
  return useLista('COMBUSTIBLE', COMBUSTIBLES_FALLBACK, toCombustibles);
}
