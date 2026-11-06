import { useCallback, useEffect, useRef, useState } from 'react';
import { getVehicleSuggestionsApi } from '../services/api';

/**
 * Sugerencias "para vehículo" de los buscadores de repuestos: "Aceite de caja para Toyota Yaris 2013-2025".
 * Mucha gente escribe el repuesto seguido de su vehículo y casi no espera a que cargue la sugerencia, así que:
 *  - lo ya sugerido se filtra al instante con lo recién escrito y el texto ya consultado sale de la caché;
 *  - la consulta sale casi sin espera y una respuesta vieja nunca pisa a la nueva (se cancela);
 *  - `settle()` deja esperar la última consulta por si la persona busca antes de que carguen.
 * Mismo comportamiento que el de la app móvil.
 */
export const SUGGESTION_DEBOUNCE_MS = 70;
const MIN_LENGTH = 2;
const MAX_CACHE = 120;

export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Lo ya sugerido, filtrado con lo recién escrito (para que al agregar una letra no haya que esperar). */
export function narrowSuggestions(previous, text) {
  const words = normalizeSearchText(text).split(' ').filter(Boolean);
  if (!words.length) return [];
  return previous.filter((suggestion) => {
    const haystack = normalizeSearchText(`${suggestion.etiqueta} ${suggestion.marca || ''} ${suggestion.modelo || ''}`);
    return words.every((word) => word === 'para' || haystack.includes(word));
  });
}

/** Año escrito junto al vehículo ("aceite de caja yaris 2015"): se usa al aplicar el filtro. */
export function typedYear(text) {
  const match = String(text || '').match(/\b(19[89]\d|20[0-3]\d)\b/);
  return match ? Number(match[1]) : undefined;
}

const cacheKey = (text, vehicle = {}) => [normalizeSearchText(text), vehicle.marca || '', vehicle.modelo || '', vehicle.anio || ''].join('|');

export function useVehicleSuggestions(text, { vehicle, enabled = true } = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map());
  const previous = useRef([]);
  const inFlight = useRef(Promise.resolve([]));
  const vehicleKey = `${vehicle?.marca || ''}|${vehicle?.modelo || ''}|${vehicle?.anio || ''}`;

  useEffect(() => {
    const clean = String(text || '').trim();
    if (!enabled || normalizeSearchText(clean).length < MIN_LENGTH) {
      previous.current = [];
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    const key = cacheKey(clean, vehicle);
    const cached = cache.current.get(key);
    if (cached) {
      previous.current = cached;
      setSuggestions(cached);
      setLoading(false);
      return undefined;
    }

    setSuggestions(narrowSuggestions(previous.current, clean));
    setLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => {
      inFlight.current = getVehicleSuggestionsApi({ q: clean, ...vehicle, signal: controller.signal })
        .then((result) => {
          const list = Array.isArray(result) ? result : [];
          if (cache.current.size >= MAX_CACHE) cache.current.delete(cache.current.keys().next().value);
          cache.current.set(key, list);
          if (!controller.signal.aborted) {
            previous.current = list;
            setSuggestions(list);
            setLoading(false);
          }
          return list;
        })
        .catch(() => {
          // Las sugerencias son un extra: si falla, se queda lo filtrado y se puede buscar igual.
          if (!controller.signal.aborted) setLoading(false);
          return [];
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // `vehicle` entra por vehicleKey: es un objeto nuevo en cada render.
  }, [text, enabled, vehicleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Espera la consulta en curso (si la hay) y devuelve las sugerencias del texto actual. */
  const settle = useCallback(async () => {
    const cached = cache.current.get(cacheKey(text, vehicle));
    if (cached) return cached;
    return inFlight.current;
  }, [text, vehicleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { suggestions, loading, settle };
}
