/**
 * Origen ÚNICO de la URL base del backend.
 *
 * Existe porque había dos. `services/api.js` caía a `http://localhost:8080/api/v1` cuando
 * faltaba `VITE_API_URL`, y `components/founderConfig.ts`, ante esa misma falta, devolvía
 * `https://api.repuestop.cl/api/v1` en cuanto el hostname no fuera localhost. Las dos
 * cadenas viajaban en el bundle, así que un deploy sin la variable dejaba la MISMA página
 * hablando con dos backends: `/vender` contra PRODUCCIÓN y el resto contra localhost. El
 * riesgo concreto era registrar tiendas de prueba en la base real.
 *
 * Ahora el fallback es uno solo y apunta a local. Si un ambiente desplegado se queda sin
 * la variable, todas las peticiones fallan juntas y se nota enseguida, en vez de que la
 * mitad escriba en producción sin que nadie lo vea.
 *
 * Se consideró lanzar una excepción al arrancar, que es más ruidoso todavía, pero eso deja
 * la web en blanco ante un despiste de configuración; el aviso por consola más el fallo
 * uniforme de la red da la misma señal sin tirar el sitio.
 */

const FALLBACK_LOCAL = 'http://localhost:8080/api/v1';

function esHostLocal() {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function resolver() {
  const configurada = import.meta.env.VITE_API_URL?.trim();
  if (configurada) return configurada;

  if (!esHostLocal()) {
    // Un deploy real sin VITE_API_URL está mal configurado. No se adivina el backend:
    // adivinar fue justamente lo que hacía que `/vender` escribiera en producción.
    console.error(
      '[config] Falta VITE_API_URL en este despliegue. Todas las llamadas al backend van a fallar. '
      + 'Definir la variable en el ambiente de Vercel y volver a desplegar.',
    );
  }
  return FALLBACK_LOCAL;
}

export const API_BASE_URL = resolver();

/** Origen del backend sin el sufijo `/api/v1`, para construir URLs de archivos servidos por el proxy. */
export const apiOrigin = () => API_BASE_URL.replace(/\/api\/v1\/?$/, '');
