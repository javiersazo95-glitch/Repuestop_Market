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
