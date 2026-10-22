import { useLista } from '../remoteConfig/hooks';

/**
 * Condicion tecnica ofrecida en el filtro. RepuesTop opera solo con tiendas verificadas que
 * venden repuesto NUEVO, asi que la unica distincion util para el comprador es si la pieza es
 * la del fabricante o un equivalente homologado.
 *
 * `InventarioValidationSupport.condicionValida` del backend todavia acepta ademas NUEVO, USADO
 * y REACONDICIONADO. Hoy no hay ninguna publicacion con esos valores, pero si alguna se carga
 * (por Excel o por el formulario del vendedor) quedaria fuera de las dos opciones de aqui: se
 * seguiria viendo en el catalogo sin filtrar, pero no bajo ninguna condicion. Cerrar esa puerta
 * es acotar la validacion alla, no ampliar esta lista.
 *
 * Desde el Mantenedor comun la lista sale de `CONDICION_PRODUCTO` (lista de sistema: el dueno
 * puede renombrar, reordenar u ocultar, no inventar valores). Esto queda como respaldo.
 */
export const PART_CONDITIONS_FALLBACK = [
  { value: 'ORIGINAL', label: 'Original', hint: 'Pieza nueva del fabricante del vehículo' },
  { value: 'ALTERNATIVO', label: 'Alternativo', hint: 'Pieza nueva equivalente y homologada' },
];

const HINT_BY_VALUE = Object.fromEntries(PART_CONDITIONS_FALLBACK.map((item) => [item.value, item.hint]));

/** Opcion del bootstrap -> `{value, label, hint}` del filtro. Sin descripcion, el texto de siempre. */
function toPartConditions(opciones) {
  return opciones.map((opcion) => ({
    value: String(opcion.valor).toUpperCase(),
    label: opcion.etiqueta || opcion.valor,
    hint: opcion.descripcion || HINT_BY_VALUE[String(opcion.valor).toUpperCase()] || '',
  }));
}

export function usePartConditions() {
  return useLista('CONDICION_PRODUCTO', PART_CONDITIONS_FALLBACK, toPartConditions);
}
