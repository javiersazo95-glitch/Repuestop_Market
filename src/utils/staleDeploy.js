/**
 * Qué hacer cuando la pestaña quedó con un build viejo y llega un deploy nuevo.
 *
 * Las rutas se cargan con `React.lazy` + `import()`, así que cada vista es un chunk con
 * hash en el nombre (`HomePage-ptNwqkKq.js`). Un deploy cambia esos hashes: una pestaña
 * abierta desde ANTES sigue pidiendo el chunk viejo, que ya no existe, y la navegación
 * revienta con "Failed to fetch dynamically imported module".
 *
 * Y no falla como un 404 limpio: el rewrite catch-all de `vercel.json` (`/(.*)` ->
 * `/index.html`) atrapa también las rutas de `/assets/`, así que el navegador recibe un
 * 200 con el `index.html` entero donde esperaba un módulo JS. Por eso el mensaje habla de
 * "fetch" y no de "not found", y por eso no sirve mirar el status.
 *
 * La salida es recargar: el `index.html` nuevo trae los hashes nuevos.
 */

const RELOAD_KEY = 'repuestop_deploy_reload';
/** Dos fallos dentro de esta ventana ya no son "hay un deploy nuevo", son un bucle. */
const RELOAD_WINDOW_MS = 30000;

const PATRONES = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load module script/i,
];

/**
 * El mismo caso, pero disfrazado. Como el rewrite responde 200 con HTML en vez de 404, el
 * import NO se rechaza: el navegador rechaza el script por MIME, el módulo queda vacío y
 * quien revienta es `React.lazy` al leer `.default` de undefined. Reproducido sirviendo el
 * dist con el rewrite de Vercel y borrando el chunk: el primer fallo dice "Failed to fetch
 * dynamically imported module" y el segundo, este TypeError.
 */
const SIN_DEFAULT = /cannot read propert(?:y|ies) of undefined \(reading '?default'?\)|undefined is not an object \(evaluating '[^']*\.default'\)/i;

export function isStaleChunkError(error, componentStack = '') {
  const mensaje = String(error?.message || error || '');
  if (PATRONES.some((patron) => patron.test(mensaje))) return true;
  // El TypeError de `.default` solo cuenta si quien reventó fue un componente lazy: suelto
  // es un error genérico y llamarle "deploy nuevo" a un bug real lo escondería.
  return SIN_DEFAULT.test(mensaje) && /\bLazy\b/.test(String(componentStack || ''));
}

/**
 * Recarga UNA vez. Devuelve si la recarga se disparó, para que quien llama sepa si todavía
 * tiene que mostrarle algo al usuario.
 */
export function reloadForNewDeploy() {
  let marcado = false;
  try {
    const previo = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (previo && Date.now() - previo < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    marcado = true;
  } catch {
    marcado = false;
  }
  // Sin poder dejar la marca no se recarga: si el chunk sigue faltando después de recargar
  // (o el sessionStorage está bloqueado), reintentar a ciegas deja al usuario en un bucle
  // infinito de recargas, que es peor que mostrarle el error con un botón.
  if (!marcado) return false;
  window.location.reload();
  return true;
}

/**
 * Vite avisa del chunk que no pudo precargar con este evento. Se cancela con
 * `preventDefault()` porque si no vuelve a lanzar el error después del listener.
 */
export function watchStaleChunks() {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForNewDeploy();
  });
}
