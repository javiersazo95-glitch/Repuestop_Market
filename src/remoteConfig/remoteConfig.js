/**
 * Configuracion remota del Mantenedor comun (contrato:
 * `RespuesTop-mono-repo/docs/arquitectura/contrato-mantenedor-bootstrap.md`, secciones 2 y 6).
 *
 * El backend publica en `GET /config/bootstrap?cliente=MARKET` las marcas, categorias, listas de
 * desplegables, parametros (comisiones, plazos) y feature flags que el dueno edita sin desplegar.
 * Este modulo es el unico que habla con ese endpoint: guarda el ultimo bootstrap en
 * `localStorage`, lo entrega a React (hooks.js) y a codigo fuera de React (`remoteConfig.get()`,
 * que usan pricing, adapters y los helpers de `src/data`).
 *
 * Regla central: NUNCA bloquea el render ni rompe el sitio. Sin cache y sin backend, `get()`
 * devuelve `data: null` y cada consumidor usa su constante `*Fallback`, que es exactamente el
 * comportamiento de antes del mantenedor. Por eso cualquier error de red se traga aca: el
 * `ErrorBoundary` de App.jsx escucha `unhandledrejection` y una promesa suelta tumbaria la web.
 */
import { ApiError, fetchApi } from '../services/api';

const CLIENTE = 'MARKET';
export const REMOTE_CONFIG_STORAGE_KEY = `repuestop.remote-config.${CLIENTE}.v1`;

// Backoff pedido por el contrato (seccion 6.2). Despues del tercer intento se espera al
// siguiente foco de la pestana o al sondeo de 5 minutos: insistir mas no arregla un backend caido.
const RETRY_DELAYS_MS = [1000, 5000, 30000];
const VERSION_POLL_MS = 5 * 60 * 1000;
// Cambiar de pestana varias veces seguidas no debe disparar una consulta por cada cambio.
const FOCUS_CHECK_MIN_INTERVAL_MS = 30 * 1000;

// `VITE_REMOTE_CONFIG_FIXTURE=true` usa `fixtures/bootstrap.market.json` en vez del backend, para
// probar flags y listas mientras el endpoint no exista en api-dev. Sin red ni sondeo: el fixture
// manda, asi un flag en `false` se ve igual en cada recarga.
const USE_FIXTURE = import.meta.env.VITE_REMOTE_CONFIG_FIXTURE === 'true';

/** Un bootstrap valido trae al menos `version` numerica; lo demas se lee con `?.` y fallback. */
function isBootstrap(value) {
  return Boolean(value) && typeof value === 'object' && Number.isFinite(Number(value.version));
}

function readCache() {
  try {
    const raw = localStorage.getItem(REMOTE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isBootstrap(parsed?.data) ? parsed : null;
  } catch {
    // Modo privado, cuota llena o JSON corrupto: se sigue con fallbacks.
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(REMOTE_CONFIG_STORAGE_KEY, JSON.stringify({
      version: Number(data.version),
      data,
      guardadoEn: new Date().toISOString(),
    }));
  } catch {
    // Sin almacenamiento la config igual queda en memoria para esta pestana.
  }
}

const cached = USE_FIXTURE ? null : readCache();

/**
 * Snapshot inmutable: cada cambio crea un objeto nuevo para que `useSyncExternalStore` y los
 * `useMemo` que dependen de `data` vean la diferencia.
 * - `source`: 'fallback' (nada remoto), 'cache', 'remote' o 'fixture'.
 * - `status`: 'idle' | 'loading' | 'ready' | 'error'. Solo informativo (depuracion).
 */
let snapshot = Object.freeze({
  data: cached?.data ?? null,
  version: cached ? Number(cached.version) : null,
  source: cached ? 'cache' : 'fallback',
  status: 'idle',
});

const listeners = new Set();

function setSnapshot(patch) {
  snapshot = Object.freeze({ ...snapshot, ...patch });
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('[remoteConfig] listener fallo:', error);
    }
  });
}

/** El backend arma el ETag como `W/"<version>-<cliente>"` (contrato, seccion 1). */
function etagFor(version) {
  return `W/"${version}-${CLIENTE}"`;
}

// Solo vale la pena reintentar lo transitorio. Un 404 (endpoint aun no desplegado) o un 400 no se
// arreglan en 30 s, y reintentarlos ensucia la consola de cada visita sin ganar nada.
function isTransient(error) {
  const status = error instanceof ApiError ? error.status : 0;
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

let started = false;
let inFlight = null;
let retryTimer = null;
let pollTimer = null;
let lastFocusCheck = 0;

async function fetchBootstrap(attempt = 0) {
  if (inFlight) return inFlight;
  clearTimeout(retryTimer);
  setSnapshot({ status: 'loading' });

  inFlight = (async () => {
    try {
      const headers = {};
      if (snapshot.version != null && snapshot.data) headers['If-None-Match'] = etagFor(snapshot.version);
      const data = await fetchApi(`/config/bootstrap?cliente=${CLIENTE}`, {
        method: 'GET',
        headers,
        // Endpoint publico: sin token no se dispara el refresh de sesion ni el aviso de
        // "sesion expirada" por una consulta que el usuario no pidio.
        anonymous: true,
      });
      if (!isBootstrap(data)) throw new ApiError('Bootstrap invalido', 0, data);
      writeCache(data);
      setSnapshot({ data, version: Number(data.version), source: 'remote', status: 'ready' });
    } catch (error) {
      // `fetchApi` trata todo lo que no es 2xx como error; el 304 significa "tu cache sigue vigente".
      if (error instanceof ApiError && error.status === 304) {
        setSnapshot({ status: 'ready' });
        return;
      }
      setSnapshot({ status: 'error' });
      if (isTransient(error) && attempt < RETRY_DELAYS_MS.length) {
        retryTimer = setTimeout(() => {
          fetchBootstrap(attempt + 1).catch(() => {});
        }, RETRY_DELAYS_MS[attempt]);
      }
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Consulta barata (`{version}`): solo si cambio se vuelve a pedir el bootstrap completo. */
async function checkVersion() {
  if (inFlight) return;
  try {
    const response = await fetchApi('/config/version', {
      method: 'GET',
      anonymous: true,
    });
    const remoteVersion = Number(response?.version);
    if (!Number.isFinite(remoteVersion)) return;
    if (!snapshot.data || remoteVersion !== snapshot.version) await fetchBootstrap();
  } catch {
    // Sin backend nuevo esto falla siempre; el sitio sigue con lo que tiene.
  }
}

function handleVisibility() {
  if (document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (now - lastFocusCheck < FOCUS_CHECK_MIN_INTERVAL_MS) return;
  lastFocusCheck = now;
  checkVersion();
}

// Otra pestana guardo un bootstrap nuevo: se adopta sin pedirlo de nuevo al backend.
function handleStorage(event) {
  if (event.key !== REMOTE_CONFIG_STORAGE_KEY) return;
  const next = readCache();
  if (next && Number(next.version) !== snapshot.version) {
    setSnapshot({ data: next.data, version: Number(next.version), source: 'cache' });
  }
}

/**
 * Arranca el ciclo de vida (idempotente; lo llama RemoteConfigProvider). Devuelve la funcion que
 * lo detiene, para el cleanup del efecto.
 */
function start() {
  if (started) return stop;
  started = true;

  if (USE_FIXTURE) {
    import('./fixtures/bootstrap.market.json')
      .then((module) => {
        const data = module.default ?? module;
        if (isBootstrap(data)) setSnapshot({ data, version: Number(data.version), source: 'fixture', status: 'ready' });
      })
      .catch((error) => console.warn('[remoteConfig] no se pudo cargar el fixture:', error));
    return stop;
  }

  fetchBootstrap().catch(() => {});
  lastFocusCheck = Date.now();
  pollTimer = setInterval(() => { checkVersion(); }, VERSION_POLL_MS);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('storage', handleStorage);
  return stop;
}

function stop() {
  if (!started) return;
  started = false;
  clearTimeout(retryTimer);
  clearInterval(pollTimer);
  document.removeEventListener('visibilitychange', handleVisibility);
  window.removeEventListener('storage', handleStorage);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ------------------------------------------------------------------------------------------ */
/* Lectores sin hook (codigo fuera de React). Mismas reglas de fallback que hooks.js.          */
/* ------------------------------------------------------------------------------------------ */

const toNumber = (value) => {
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(number) ? number : undefined;
};

/**
 * Interpreta el valor (siempre string en el bootstrap) segun `parametrosTipos`. Si el tipo no
 * viene, se infiere del fallback: un parametro nuevo sin tipo no debe convertir un numero en texto.
 * Devuelve `undefined` cuando el valor no se puede leer, para que el llamador use su fallback.
 */
export function parseParametro(raw, tipo, fallback) {
  if (raw === undefined || raw === null) return undefined;
  const type = String(tipo || '').toUpperCase()
    || (typeof fallback === 'number' ? 'NUMBER' : typeof fallback === 'boolean' ? 'BOOLEAN' : 'STRING');
  switch (type) {
    case 'NUMBER':
    case 'PERCENT':
      return toNumber(raw);
    case 'MONEY': {
      const number = toNumber(raw);
      return number === undefined ? undefined : Math.round(number);
    }
    case 'BOOLEAN': {
      const text = String(raw).trim().toLowerCase();
      if (text === 'true') return true;
      if (text === 'false') return false;
      return undefined;
    }
    case 'JSON':
      try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        return undefined;
      }
    default:
      return String(raw);
  }
}

export function readFlag(data, clave, fallback = true) {
  const value = data?.flags?.[clave];
  return typeof value === 'boolean' ? value : fallback;
}

export function readParametro(data, clave, fallback) {
  const parsed = parseParametro(data?.parametros?.[clave], data?.parametrosTipos?.[clave], fallback);
  return parsed === undefined ? fallback : parsed;
}

/**
 * Lista ausente -> fallback. Lista presente (aunque sea `[]`) -> manda el mantenedor: el contrato
 * dice que una lista sin opciones activas llega vacia a proposito.
 */
export function readLista(data, codigo, fallback) {
  const list = data?.listas?.[codigo];
  return Array.isArray(list) ? list : fallback;
}

/** Catalogo ausente o vacio -> fallback: un bootstrap sin categorias no puede vaciar el menu. */
export function readCatalogo(data, nombre, fallback) {
  const list = data?.[nombre];
  return Array.isArray(list) && list.length > 0 ? list : fallback;
}

export const remoteConfig = {
  /** Snapshot actual `{data, version, source, status}`; `data` es null sin config remota. */
  get: () => snapshot,
  /** Solo `data`: no cambia de identidad con los cambios de `status`, asi los hooks no re-renderizan de mas. */
  getData: () => snapshot.data,
  subscribe,
  start,
  stop,
  /** Vuelve a pedir el bootstrap (con `If-None-Match`), p. ej. al probar un cambio del mantenedor. */
  refresh: () => fetchBootstrap().catch(() => {}),
  flag: (clave, fallback = true) => readFlag(snapshot.data, clave, fallback),
  parametro: (clave, fallback) => readParametro(snapshot.data, clave, fallback),
  lista: (codigo, fallback) => readLista(snapshot.data, codigo, fallback),
  catalogo: (nombre, fallback) => readCatalogo(snapshot.data, nombre, fallback),
};

export default remoteConfig;
