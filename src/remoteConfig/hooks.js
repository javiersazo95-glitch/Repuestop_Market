/**
 * Hooks de la configuracion remota (contrato del mantenedor, seccion 6.4).
 *
 * Todos leen el mismo store con `useSyncExternalStore`, asi que funcionan aunque un componente
 * quede fuera de `RemoteConfigProvider` (el provider solo arranca la descarga). Sin bootstrap,
 * cada hook devuelve su `fallback` y el componente se ve exactamente como antes.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { readCatalogo, readFlag, readLista, readParametro, remoteConfig } from './remoteConfig';

/** Snapshot completo `{data, version, source, status}`. */
export function useRemoteConfig() {
  return useSyncExternalStore(remoteConfig.subscribe, remoteConfig.get, remoteConfig.get);
}

/** Datos del bootstrap o `null`. Cambia de identidad solo cuando llega un bootstrap nuevo. */
export function useRemoteData() {
  return useSyncExternalStore(remoteConfig.subscribe, remoteConfig.getData, remoteConfig.getData);
}

/** Flag resuelto para MARKET; ausente -> `fallback` (por convencion `true`). */
export function useFlag(clave, fallback = true) {
  return readFlag(useRemoteData(), clave, fallback);
}

/** Metadata del flag (`flagsMetadata`, p. ej. `{mensaje}` de `global.mantenimiento`) o `null`. */
export function useFlagMetadata(clave) {
  return useRemoteData()?.flagsMetadata?.[clave] ?? null;
}

/** Parametro parseado segun `parametrosTipos`; ilegible o ausente -> `fallback`. */
export function useParametro(clave, fallback) {
  return readParametro(useRemoteData(), clave, fallback);
}

/**
 * Opciones de una lista del mantenedor.
 *
 * `select(opciones)` adapta las opciones remotas a la forma que espera el consumidor (p. ej.
 * `{value, label, hint}` del filtro de condicion). El fallback NO pasa por `select`: ya viene en
 * la forma final, es la constante de siempre. Asi cada pantalla adapta en un solo helper y no en
 * cada componente.
 */
export function useLista(codigo, fallback, select) {
  const data = useRemoteData();
  return useMemo(() => {
    const list = readLista(data, codigo, undefined);
    if (list === undefined) return fallback;
    return select ? select(list) : list;
    // `select` y `fallback` deben ser de modulo (estables): asi solo recalcula al llegar otro bootstrap.
  }, [data, codigo, fallback, select]);
}

/** `categorias` | `marcasVehiculo` | `marcasRepuestoDestacadas`; vacio o ausente -> `fallback`. */
export function useCatalogo(nombre, fallback) {
  return readCatalogo(useRemoteData(), nombre, fallback);
}
