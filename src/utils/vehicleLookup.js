/**
 * Formatos de patente chilena (1:1 con mobile/utils/vehicle-lookup.ts):
 * - Autos nuevo (post-2007): 4 letras + 2 dígitos (ej: ABCD12, BBCL12) -> 6 caracteres
 * - Autos antiguo (pre-2007): 2 letras + 4 dígitos (ej: AB1234) -> 6 caracteres
 * - Motos nuevo: 3 letras + 2 dígitos (ej: ABC12) -> 5 caracteres
 * - Motos antiguo: 2 letras + 3 dígitos (ej: AB123) -> 5 caracteres
 */
export const PLATE_PATTERN = /^([A-Z]{2}[0-9]{4}|[A-Z]{4}[0-9]{2}|[A-Z]{2}[0-9]{3}|[A-Z]{3}[0-9]{2})$/i;

/**
 * Deja la patente sin guiones ni espacios y en mayúsculas.
 * Máximo 6 caracteres alfanuméricos normalizados.
 */
export function normalizePlate(plate) {
  return (plate || '').trim().toUpperCase().replace(/[-\s]/g, '');
}

/**
 * Limita y formatea la entrada del usuario en inputs de patente.
 * Permite hasta 8 caracteres en crudo (incluyendo guiones como BB-CL-12).
 */
export function sanitizePlateInput(input) {
  return (input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-\s]/g, '')
    .slice(0, 8);
}

/**
 * Valida si la patente cumple con cualquiera de los formatos chilenos oficiales.
 */
export function isValidPlate(plate) {
  const normalized = normalizePlate(plate);
  return PLATE_PATTERN.test(normalized);
}
