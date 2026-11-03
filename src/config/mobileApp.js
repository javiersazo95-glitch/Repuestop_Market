// Ficha oficial de la app Android de RepuesTop en Google Play. Dev no tiene build propio publicado, pero igual apunta a la
// ficha de producción para poder probar el flujo del QR de punta a punta (web o Play Store).
const PLAY_URL = 'https://play.google.com/store/apps/details?id=cl.repuestop.app';

function resolvePlayUrl() {
  // `VITE_PLAY_STORE_URL` manda si está definida (vacía = sin Play Store); si no, siempre la ficha oficial.
  const configured = import.meta.env?.VITE_PLAY_STORE_URL;
  if (typeof configured === 'string') return configured.trim();
  return PLAY_URL;
}

/** Enlace a Google Play del ambiente actual; cadena vacía solo si `VITE_PLAY_STORE_URL` está definida vacía. */
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
