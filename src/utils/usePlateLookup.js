import { useEffect, useState } from 'react';
import { isValidPlate, lookupVehicleByPlate, normalizePlate } from './vehicleLookup';
import { searchVehicleByPatenteApi } from '../services/api';

/** "ABCD12" -> "AB**12": la patente nunca se muestra completa. */
export function maskPlate(plate) {
  const value = normalizePlate(plate);
  return value.length < 5 ? value : `${value.slice(0, 2)}**${value.slice(-2)}`;
}

/**
 * Identifica el vehículo de una patente apenas tiene un formato válido. El chasis es obligatorio: si la
 * consulta no lo trae, el vehículo no se acepta y se explica por qué.
 */
export default function usePlateLookup(plate, { subject = 'la necesidad' } = {}) {
  const [vehicle, setVehicle] = useState(null);
  const [error, setError] = useState('');
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    const normalized = normalizePlate(plate);
    setVehicle(null);
    setError('');
    if (!isValidPlate(normalized)) return undefined;

    let active = true;
    setLooking(true);
    const timer = setTimeout(async () => {
      try {
        const data = await lookupVehicleByPlate(normalized, { searchVehicleByPatenteApi });
        if (!active) return;
        if (!data) setError('No pudimos identificar esta patente. Revísala e inténtalo de nuevo.');
        else if (!data.chasis) setError(`Identificamos el vehículo, pero no pudimos obtener su chasis. Sin el chasis no se puede publicar ${subject}.`);
        else setVehicle(data);
      } catch (err) {
        if (active) setError(err?.message || 'No pudimos consultar la patente. Inténtalo de nuevo.');
      } finally {
        if (active) setLooking(false);
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [plate, subject]);

  return { vehicle, error, looking };
}
