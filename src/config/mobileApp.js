// Ficha oficial de la app Android de RepuesTop en Google Play. Solo existe en producción: dev no tiene build publicado
// en Play Store, así que ahí no hay enlace y la web ofrece crear la cuenta directo (así se prueba el QR de punta a punta).
const PRODUCTION_PLAY_URL = 'https://play.google.com/store/apps/details?id=cl.repuestop.app';
const PRODUCTION_HOSTS = new Set(['repuestop.cl', 'www.repuestop.cl']);

function resolvePlayUrl() {
  // `VITE_PLAY_STORE_URL` manda si está definida (vacía = sin Play Store); si no, se decide por el dominio.
  const configured = import.meta.env?.VITE_PLAY_STORE_URL;
  if (typeof configured === 'string') return configured.trim();
  if (typeof window === 'undefined') return PRODUCTION_PLAY_URL;
  return PRODUCTION_HOSTS.has(window.location.hostname) ? PRODUCTION_PLAY_URL : '';
}

/** Enlace a Google Play del ambiente actual; cadena vacía cuando no hay app publicada (dev). */
export const GOOGLE_PLAY_URL = resolvePlayUrl();

/**
 * Enlace a Google Play que además deja el código de referido del taller en el `referrer` de la instalación, para poder
 * autocompletarlo al abrir la app por primera vez. Sin Play Store en este ambiente devuelve cadena vacía.
 */
export function googlePlayUrlWithReferral(code) {
  if (!GOOGLE_PLAY_URL) return '';
  if (!code) return GOOGLE_PLAY_URL;
  const separator = GOOGLE_PLAY_URL.includes('?') ? '&' : '?';
  return `${GOOGLE_PLAY_URL}${separator}referrer=${encodeURIComponent(`ref=${code}`)}`;
}
