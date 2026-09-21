const env = (import.meta as any).env ?? {};

export const siteConfig = {
  androidStatus: 'coming-soon' as const,
  supportEmail: 'contacto@repuestop.cl',
  whatsappUrl: 'https://wa.me/56900000000',
  instagramUrl: 'https://instagram.com/repuestop.cl',
  flowUrls: {
    webpay: 'https://web.flow.cl/es-cl/preguntas-frecuentes/webpay/',
    tariffs: 'https://web.flow.cl/es-cl/tarifas/',
    paymentMethods: 'https://developers.flow.cl/en/docs/payment-methods',
    refunds: 'https://web.flow.cl/es-cl/link-de-pago',
  },
};

// La URL base la resuelve `services/apiBaseUrl`, que es el origen unico para toda la app.
// Antes esta funcion tenia su propio fallback a https://api.repuestop.cl, y un deploy sin
// VITE_API_URL dejaba `/vender` escribiendo en PRODUCCION mientras el resto de la web
// hablaba con localhost.
export { API_BASE_URL as API_URL } from '../services/apiBaseUrl';

/**
 * Client ID de Google OAuth para web. Sin esto, el botón de Google queda deshabilitado.
 *
 * No es un secreto -- por diseño viaja al navegador --, pero sí es configuración por
 * ambiente: quien despliegue debe definir `VITE_GOOGLE_CLIENT_ID`. El literal de abajo
 * queda solo como red para el desarrollo local; en un despliegue real se avisa, porque
 * compartir un client id entre dev y producción impide restringir los orígenes
 * autorizados de cada uno por separado en la consola de Google.
 */
const GOOGLE_CLIENT_ID_DEV = '117201265366-ao32ed2314d1ncce1qt47biide1ij62r.apps.googleusercontent.com';

function resolveGoogleClientId(): string {
  const configurado = env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (configurado) return configurado;

  const esLocal = typeof window === 'undefined'
    || ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if (!esLocal) {
    console.error('[config] Falta VITE_GOOGLE_CLIENT_ID en este despliegue; se usa el client id de desarrollo.');
  }
  return GOOGLE_CLIENT_ID_DEV;
}

export const GOOGLE_CLIENT_ID: string = resolveGoogleClientId();

export function trackEvent(event: string, detail?: string) {
  window.dispatchEvent(new CustomEvent('repuestop:analytics', { detail: { event, detail } }));
}
