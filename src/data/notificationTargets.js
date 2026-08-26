import { ROUTES, productPath } from '../routes/paths';

/**
 * Traduce el destino de una notificación a una ruta de la WEB.
 *
 * El backend guarda `targetRoute` con las rutas de la APP MÓVIL (`/order-detail`,
 * `/quote-chat`...) porque las notificaciones nacieron para el push. La web no tiene
 * esas rutas, así que al hacer clic no pasaba nada: la campana marcaba como leída y
 * ahí quedaba.
 *
 * No se cambia el backend a propósito: `targetRoute` lo consumen las dos plataformas y
 * la app depende de esos valores. La traducción vive acá, que es la punta que sabe cómo
 * se llaman sus propias rutas.
 *
 * Cada entrada recibe los `targetParams` que emite el backend. Las claves son las que
 * se verificaron en el código Java, no inventadas:
 *
 * - `/order-detail`               -> `{ orderId }`
 * - `/product-detail`             -> `{ productId, questionId? }`
 * - `/quote-chat`                 -> `{ quoteId }`
 * - `/mediation-chat`             -> `{ orderId }`
 * - `/ad-detail`, `/ads-management` -> `{ id }`
 * - `/support-ticket-detail`      -> `{ ticketId }`
 * - `/provider-verification-status` -> `{ sellerId }`
 */
const PROFILE = (tab) => `${ROUTES.profile}/${tab}`;

const TARGETS = {
  '/order-detail': (params) => (params?.orderId
    ? `${PROFILE('pedidos')}?pedido=${encodeURIComponent(params.orderId)}`
    : PROFILE('pedidos')),

  '/product-detail': (params) => (params?.productId
    ? productPath({ id: params.productId })
    : ROUTES.catalog),

  '/quote-chat': (params) => (params?.quoteId
    ? `${PROFILE('cotizaciones')}?cotizacion=${encodeURIComponent(params.quoteId)}`
    : PROFILE('cotizaciones')),

  // La mediación se abre desde el expediente del caso, que en la web vive en
  // Reportes/Disputa y no en una pantalla de chat aparte como en la app.
  '/mediation-chat': (params) => (params?.orderId
    ? `${PROFILE('consultas')}?pedido=${encodeURIComponent(params.orderId)}`
    : PROFILE('consultas')),

  '/support-ticket-detail': (params) => (params?.ticketId
    ? `${PROFILE('consultas')}?ticket=${encodeURIComponent(params.ticketId)}`
    : PROFILE('consultas')),
  '/tickets': () => PROFILE('consultas'),

  '/ad-detail': (params) => (params?.id
    ? `${ROUTES.adsWall}?anuncio=${encodeURIComponent(params.id)}`
    : ROUTES.adsWall),
  '/ads-management': () => PROFILE('anuncios'),

  '/provider-verification-status': () => PROFILE('tienda_datos'),

  '/withdrawals': () => PROFILE('retiros'),
  '/withdrawal-payments': () => PROFILE('retiros'),

  '/perfil': () => ROUTES.profile,
};

/**
 * Devuelve la ruta web a la que debe llevar la notificación, o `null` si no hay ninguna
 * razonable. Con `null` la campana solo marca como leída, que es mejor que mandar al
 * usuario a una pantalla que no tiene que ver.
 */
export function notificationTargetPath(notification) {
  const route = notification?.targetRoute;
  if (!route) return null;
  const resolver = TARGETS[route];
  if (!resolver) return null;
  try {
    return resolver(notification.targetParams || {});
  } catch {
    return null;
  }
}

export default notificationTargetPath;
