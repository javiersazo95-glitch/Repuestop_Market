/**
 * Topes de los campos de fallas y necesidades de compra, los mismos que validan los DTO del backend
 * (FallaAutomotrizDTOs, NecesidadCompraCrearRequestDTO, CotizacionNecesidadCrearRequestDTO). Si cambian alla,
 * cambian aqui.
 */
export const MAX_PRICE = 999_999_999;
export const MAX_QUANTITY = 999;
export const MAX_MILEAGE = 2_000_000;
export const MIN_VEHICLE_YEAR = 1950;
export const MAX_SEARCH_LENGTH = 100;

/** Solo digitos, hasta `maxDigits` (para precios, cantidades y kilometraje escritos a mano). */
export function onlyDigits(value, maxDigits) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxDigits);
}

/** Año maximo aceptado para un vehiculo: el siguiente al actual (modelos del año que viene). */
export function maxVehicleYear(now = new Date()) {
  return now.getFullYear() + 1;
}
