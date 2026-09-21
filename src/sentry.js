import * as Sentry from '@sentry/react';

/**
 * Solo error tracking (sin Session Replay ni Tracing de performance: no se
 * agregan esas integraciones, asi que Sentry.init no las activa). Se salta
 * por completo en dev (sin VITE_SENTRY_DSN) para no gastar la cuota gratuita
 * de 5k eventos/mes con errores locales mientras se programa.
 *
 * sendDefaultPii queda explicito en false: este es un marketplace con datos
 * bancarios y de contacto real, y no hace falta que la IP/headers del
 * reportante viajen a Sentry para poder agrupar y depurar un error de JS.
 */

/**
 * Parametros de consulta cuyo VALOR no debe salir del navegador.
 * El nombre del parametro si se conserva: saber que la peticion llevaba `email`
 * ayuda a entender el error, el correo concreto no aporta nada.
 */
const PARAMS_SENSIBLES = /^(email|correo|patente|taxid|rut|token|code|codigo|password|clave)$/i;

/**
 * Quita de una URL los datos que identifican a una persona.
 *
 * Hace falta aunque `sendDefaultPii` este en false. Esa opcion evita que Sentry adjunte
 * IP, cookies y cabeceras, pero NO toca los breadcrumbs, que el SDK genera solos para
 * cada fetch, cada XHR y cada cambio de ruta. Sin esto viajan al servidor de Sentry
 * -- que ademas esta en region US -- rutas como `/usuarios/6/direcciones`,
 * `/perfil/pedidos/25` o `/auth/check-email?email=alguien@dominio.cl`.
 *
 * Los segmentos numericos se reemplazan por `{id}`: para depurar interesa QUE endpoint
 * fallo, no de quien era el registro. Si la URL no se puede parsear se devuelve tal cual
 * -- perder el breadcrumb por un formato raro seria peor que dejarlo --, salvo que
 * contenga un `@`, que es senal de un correo suelto y ahi se prefiere descartarla.
 */
export function scrubUrl(url) {
  if (typeof url !== 'string' || !url) return url;

  try {
    // La base solo se usa para poder parsear rutas relativas; no se conserva.
    const parsed = new URL(url, 'http://local');

    // El resultado se arma a mano en vez de asignar a `parsed.pathname` y leer `href`:
    // al asignarla, la URL percent-codifica las llaves y `{id}` sale como `%7Bid%7D`,
    // que es justo lo que hace ilegible la agrupacion de errores en Sentry.
    const ruta = parsed.pathname.replace(/\/\d+(?=\/|$)/g, '/{id}');

    const pares = [];
    parsed.searchParams.forEach((valor, clave) => {
      pares.push(`${clave}=${PARAMS_SENSIBLES.test(clave) ? 'REDACTADO' : valor}`);
    });
    const consulta = pares.length ? `?${pares.join('&')}` : '';

    return url.startsWith('http') ? `${parsed.origin}${ruta}${consulta}` : `${ruta}${consulta}`;
  } catch {
    return url.includes('@') ? '[url redactada]' : url;
  }
}

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // __DEPLOY_BRANCH__ (definido en vite.config.js) distingue el deploy de
    // dev del de main; import.meta.env.MODE no sirve para esto porque
    // Vercel corre `vite build` para los dos y ese modo siempre da
    // 'production'.
    environment: __DEPLOY_BRANCH__,
    sendDefaultPii: false,

    /**
     * Limpia las URL de los breadcrumbs automaticos antes de que salgan del navegador.
     * `fetch` y `xhr` las traen en `data.url`; los de navegacion, en `data.from` y
     * `data.to`.
     */
    beforeBreadcrumb(breadcrumb) {
      const data = breadcrumb?.data;
      if (!data) return breadcrumb;
      if (typeof data.url === 'string') data.url = scrubUrl(data.url);
      if (typeof data.from === 'string') data.from = scrubUrl(data.from);
      if (typeof data.to === 'string') data.to = scrubUrl(data.to);
      return breadcrumb;
    },

    /** Misma limpieza sobre la URL de la pagina donde ocurrio el error. */
    beforeSend(event) {
      if (event?.request?.url) event.request.url = scrubUrl(event.request.url);
      return event;
    },

    // Pestaña abierta desde antes de un deploy: pide un chunk con el hash viejo, que ya
    // no existe. No es un defecto del código -- pasa en CADA despliegue y ya se maneja
    // recargando (ver utils/staleDeploy.js), así que reportarlo solo gasta la cuota del
    // plan gratis, compartida entre los tres proyectos.
    // Solo los mensajes inequívocos de "chunk que ya no existe". El TypeError de
    // `.default` que produce el mismo caso NO se filtra aquí: suelto es demasiado
    // genérico y taparía bugs reales -- ese lo descarta RouteErrorBoundary, que puede
    // mirar el componentStack para confirmar que reventó dentro de un lazy.
    ignoreErrors: [
      /failed to fetch dynamically imported module/i,
      /error loading dynamically imported module/i,
      /importing a module script failed/i,
      /failed to load module script/i,
    ],
  });
}

export { Sentry };
