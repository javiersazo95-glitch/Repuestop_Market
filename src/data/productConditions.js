import { useLista } from '../remoteConfig/hooks';
import { remoteConfig } from '../remoteConfig/remoteConfig';

/**
 * Condicion del repuesto (23-nov-2026). ORIGINAL y ALTERNATIVO son nuevos; USADO y REACONDICIONADO
 * llevan etiqueta en las tarjetas y aviso antes de comprar. Es la contraparte de
 * `mobile/utils/product-condition.ts` de la app: mismos valores y mismos textos.
 *
 * Desde el Mantenedor comun la lista sale de `CONDICION_PRODUCTO` (lista de sistema: el dueno
 * puede renombrar, reordenar u ocultar, no inventar valores). Esto queda como respaldo.
 */
export const PART_CONDITIONS_FALLBACK = [
  { value: 'ORIGINAL', label: 'Nuevo original', hint: 'Pieza nueva de la marca del vehículo' },
  { value: 'ALTERNATIVO', label: 'Nuevo alternativo', hint: 'Pieza nueva compatible de otra marca' },
  { value: 'USADO', label: 'Usado', hint: 'Pieza con uso previo o de desarme' },
  { value: 'REACONDICIONADO', label: 'Reacondicionado', hint: 'Pieza reparada o remanufacturada' },
];

const HINT_BY_VALUE = Object.fromEntries(PART_CONDITIONS_FALLBACK.map((item) => [item.value, item.hint]));

/** Opcion del bootstrap -> `{value, label, hint}`. Sin descripcion, el texto de siempre. */
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

/** El valor guardado, o null si el texto no es una condicion ("NUEVO" a secas no dice si es original). */
export function toProductCondition(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return HINT_BY_VALUE[normalized] ? normalized : null;
}

/** "Nuevo original", "Usado"...: la etiqueta del Mantenedor comun y, sin ella, la de aqui. */
export function conditionLabel(value) {
  const condition = toProductCondition(value);
  if (!condition) return 'Nuevo';
  const remota = remoteConfig.lista('CONDICION_PRODUCTO', null);
  const etiqueta = Array.isArray(remota)
    ? remota.find((opcion) => String(opcion?.valor).toUpperCase() === condition)?.etiqueta
    : null;
  return etiqueta || PART_CONDITIONS_FALLBACK.find((item) => item.value === condition).label;
}

/** Usado o reacondicionado. */
export function isPreOwned(value) {
  const condition = toProductCondition(value);
  return condition === 'USADO' || condition === 'REACONDICIONADO';
}

/** Aviso al comprador en la ficha de un usado o reacondicionado; null si el repuesto es nuevo. */
export function preOwnedNotice(value, storeName) {
  if (!isPreOwned(value)) return null;
  const store = String(storeName || '').trim() || 'la tienda';
  return {
    title: toProductCondition(value) === 'USADO' ? 'Repuesto usado' : 'Repuesto reacondicionado',
    text: `Lo publica y vende ${store}, que responde por su estado, su procedencia y su garantía, y te atiende ante cualquier situación posterior a la compra. Revisa las fotos y la descripción, y hazle tus preguntas a la tienda antes de comprar.`,
  };
}

/** Aviso a la tienda al publicar un usado o reacondicionado. */
export const SELLER_PRE_OWNED_NOTICE =
  'Describe el estado real de la pieza y guarda el respaldo de su procedencia. Tu tienda responde por el repuesto y por la postventa.';
