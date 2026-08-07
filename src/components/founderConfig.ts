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

/**
 * Obtiene la URL base del backend RepuesTop garantizando HTTPS en entornos de producción.
 */
function resolveApiUrl(): string {
  const customUrl = env.VITE_API_URL?.trim();
  if (customUrl) return customUrl;
  
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://api.repuestop.cl/api/v1';
  }
  return 'http://localhost:8080/api/v1';
}

export const API_URL: string = resolveApiUrl();

/** Client ID de Google OAuth para web. Sin esto, el botón de Google queda deshabilitado. */
export const GOOGLE_CLIENT_ID: string = env.VITE_GOOGLE_CLIENT_ID || '117201265366-ao32ed2314d1ncce1qt47biide1ij62r.apps.googleusercontent.com';

export function trackEvent(event: string, detail?: string) {
  window.dispatchEvent(new CustomEvent('repuestop:analytics', { detail: { event, detail } }));
}
