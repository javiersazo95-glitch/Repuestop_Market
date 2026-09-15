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

/** "Toyota Yaris 2020", listo para mostrar el vehículo identificado. */
export function formatVehicleLabel(vehicle) {
  if (!vehicle) return '';
  return [vehicle.marca, vehicle.modelo, vehicle.anio > 0 ? String(vehicle.anio) : '']
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * Consulta el vehículo asociado a una patente usando el mismo endpoint que la
 * búsqueda por patente del home (`GET /vehiculos/patente/{patente}`, contraparte
 * de `mobile/utils/vehicle-lookup.ts`). Devuelve `null` cuando la patente no
 * existe y relanza el error 401 para que la UI pida iniciar sesión.
 */
export async function lookupVehicleByPlate(plate, { searchVehicleByPatenteApi } = {}) {
  const normalized = normalizePlate(plate);
  if (!isValidPlate(normalized)) return null;
  if (typeof searchVehicleByPatenteApi !== 'function') {
    throw new Error('lookupVehicleByPlate necesita searchVehicleByPatenteApi');
  }

  const data = await searchVehicleByPatenteApi(normalized);
  if (!data || !data.marca) return null;

  return {
    patente: data.patente || normalized,
    marca: data.marca,
    modelo: data.modelo || '',
    anio: Number(data.anio) || 0,
    version: data.version || '',
    combustible: data.tipoCombustible || data.combustible || undefined,
    transmision: data.transmision || data.transmission || undefined,
  };
}

const RECENT_PLATES_KEY = 'repuestop_recent_plates';
const RECENT_PLATES_MAX = 5;

/**
 * Últimas patentes consultadas desde este navegador, más reciente primero.
 * Reemplaza el listado fijo de "patentes de prueba" del hero de búsqueda.
 */
export function getRecentPlates() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_PLATES_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((plate) => isValidPlate(plate)) : [];
  } catch {
    return [];
  }
}

/** Registra una patente consultada con éxito, sin duplicados, tope de 5. */
export function addRecentPlate(plate) {
  const normalized = normalizePlate(plate);
  if (!isValidPlate(normalized)) return getRecentPlates();

  const next = [normalized, ...getRecentPlates().filter((item) => item !== normalized)].slice(0, RECENT_PLATES_MAX);
  try {
    localStorage.setItem(RECENT_PLATES_KEY, JSON.stringify(next));
  } catch {
    // localStorage puede fallar en modo privado; el historial simplemente no persiste.
  }
  return next;
}
