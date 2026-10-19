import { useCallback, useEffect, useState } from 'react';
import { searchVehicleByPatenteApi } from '../services/api';
import { isValidPlate, lookupVehicleByPlate, normalizePlate } from '../utils/vehicleLookup';

/**
 * Regla del 19-oct (decisión del usuario): una cotización necesita el CHASIS del vehículo, porque la
 * tienda valida la pieza con él. Con patente se consulta el vehículo (GET /vehiculos/patente/{p}) y,
 * si la consulta no trae chasis ni VIN, se le pide al comprador. Sin patente, lo escrito es el chasis.
 * El backend tiene la misma regla (apagada hasta publicar la app) y con estos mismos mensajes.
 *
 * Lo usan la solicitud (QuotationRequestModal) y la modificación de una solicitud (QuoteDetailModal).
 */
export const QUOTE_CHASSIS_MISSING_MESSAGE = 'No encontramos el chasis de esa patente. Escribe el número de chasis (VIN) para que la tienda valide el repuesto.';
export const QUOTE_VEHICLE_REQUIRED_MESSAGE = 'Indica la patente o el número de chasis (VIN): la tienda lo necesita para validar el repuesto.';

// Una consulta por patente en toda la sesión de la página (cada patente nueva tiene costo).
const lookups = new Map();
const pending = new Map();

function resultFor(plate, vehicle) {
  return { plate, status: vehicle?.chasis ? 'found' : 'nochassis', vehicle: vehicle || null, error: '' };
}

/**
 * `value` es lo escrito en "Patente o chasis". `known` son vehículos cuyo chasis ya se sabe (el
 * vehículo activo de la búsqueda, la solicitud anterior): con esas patentes no se consulta.
 * `enabled` en false no consulta (sin sesión el backend no entrega el chasis).
 *
 * Devuelve el estado de la patente escrita y `resolve()`, que espera la consulta pendiente antes
 * de enviar el formulario.
 */
export function useQuoteVehicleCheck(value, { known = [], enabled = true } = {}) {
  const [result, setResult] = useState({ plate: '', status: 'idle', vehicle: null, error: '' });

  const typed = String(value || '').trim();
  const plate = isValidPlate(typed) ? normalizePlate(typed) : '';
  const knownMatch = plate
    ? known.find((entry) => entry && normalizePlate(entry.patente) === plate && String(entry.chasis || '').trim())
    : null;
  // Texto y no el objeto: `known` se arma en cada render y el efecto no debe reiniciarse por eso.
  const knownChassis = knownMatch ? String(knownMatch.chasis).trim() : '';

  const check = useCallback(async (raw) => {
    const target = normalizePlate(raw);
    if (!isValidPlate(target)) return null;
    if (lookups.has(target)) {
      const cached = lookups.get(target);
      setResult(cached);
      return cached;
    }
    setResult({ plate: target, status: 'loading', vehicle: null, error: '' });
    let request = pending.get(target);
    if (!request) {
      request = lookupVehicleByPlate(target, { searchVehicleByPatenteApi })
        .then((vehicle) => {
          const found = resultFor(target, vehicle);
          lookups.set(target, found);
          return found;
        })
        // 429 (tope de patentes nuevas) o red: no se guarda y el mensaje del backend se muestra tal cual.
        .catch((error) => ({ plate: target, status: 'error', vehicle: null, error: error?.message || '' }))
        .finally(() => pending.delete(target));
      pending.set(target, request);
    }
    const final = await request;
    // Si mientras tanto se escribió otra patente, esta respuesta ya no aplica.
    setResult((current) => (current.plate === target ? final : current));
    return final;
  }, []);

  // Con la patente completa (6 caracteres) se consulta sola; las de 5 (motos), al salir del campo.
  useEffect(() => {
    if (!enabled || !plate || plate.length !== 6 || knownChassis) return undefined;
    const timer = window.setTimeout(() => { check(plate); }, 450);
    return () => window.clearTimeout(timer);
  }, [enabled, plate, knownChassis, check]);

  const stateFor = (current) => {
    if (!plate) return { plate: '', status: typed ? 'chassis' : 'empty', chassis: '', vehicle: null, error: '', needsVin: false };
    if (knownChassis) return { plate, status: 'found', chassis: knownChassis, vehicle: null, error: '', needsVin: false };
    const own = current.plate === plate ? current : { plate, status: 'idle', vehicle: null, error: '' };
    return {
      ...own,
      chassis: own.vehicle?.chasis || '',
      needsVin: own.status === 'nochassis' || own.status === 'error',
    };
  };

  /** Estado final para enviar: espera (o lanza) la consulta de la patente si falta. */
  const resolve = async () => {
    if (!plate || knownChassis || !enabled) return stateFor(result);
    const current = result.plate === plate && result.status !== 'loading' && result.status !== 'idle'
      ? result
      : await check(plate);
    return stateFor(current || result);
  };

  return { ...stateFor(result), check, resolve };
}
