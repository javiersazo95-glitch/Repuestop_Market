import { normalizePlate } from './vehicleLookup';

/**
 * Formulario del vehículo del checkout con dos modos, igual que la app (utils/cart-vehicle-form):
 * 'plate' (por patente) o 'manual' (marca, modelo, año y versión del catálogo). 8-oct.
 */
const FIRST_YEAR = 1980;

/** Años del desplegable: del siguiente al actual hacia atrás, hasta 1980 (sin años imposibles). */
export function vehicleYearOptions(now = new Date()) {
  const last = now.getFullYear() + 1;
  return Array.from({ length: last - FIRST_YEAR + 1 }, (_, index) => {
    const year = String(last - index);
    return { label: year, value: year };
  });
}

/** Pestaña con que se abre el diálogo: la del vehículo que se edita, o patente si es nuevo. */
export function initialVehicleMode(vehicle) {
  if (!vehicle) return 'plate';
  if (vehicle.origen) return vehicle.origen === 'MANUAL' ? 'manual' : 'plate';
  return String(vehicle.patente || '').trim() ? 'plate' : 'manual';
}

/**
 * El vehículo que se guarda, solo con los datos de la pestaña activa. En la manual se conserva una
 * patente que no se pudo identificar (le sirve a la tienda), pero no una identificada de otro auto.
 */
export function buildCartVehicle({ key, mode, patente, plateState, identified, manual }) {
  const plate = normalizePlate(patente || '');
  if (mode === 'plate') {
    return {
      key,
      patente: plate,
      marca: identified?.marca || '',
      modelo: identified?.modelo || '',
      anio: identified?.anio || '',
      catalogoId: identified?.catalogoId ?? null,
      origen: 'PATENTE',
    };
  }
  return {
    key,
    patente: plateState === 'notfound' ? plate : '',
    marca: String(manual.marca || '').trim(),
    modelo: String(manual.modelo || '').trim(),
    anio: String(manual.anio || '').trim(),
    catalogoId: null,
    version: String(manual.version || '').trim() || undefined,
    origen: 'MANUAL',
  };
}

/** Lo que falta para usar el vehículo, o '' si está completo. */
export function vehicleFormMissing({ mode, plateState, manual }) {
  if (mode === 'plate') return plateState === 'found' ? '' : 'Escribe una patente que podamos identificar.';
  if (!String(manual.marca || '').trim()) return 'Elige la marca.';
  if (!String(manual.modelo || '').trim()) return 'Elige el modelo.';
  if (!String(manual.anio || '').trim()) return 'Elige el año.';
  return '';
}
