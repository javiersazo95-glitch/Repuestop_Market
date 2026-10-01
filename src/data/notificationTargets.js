import { ROUTES, buyerCaseChatPath, productPath, sellerCaseChatPath } from '../routes/paths';

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
  '/(seller)/pedidos': (params) => (params?.orderId
    ? `${PROFILE('pedidos')}?pedido=${encodeURIComponent(params.orderId)}`
    : PROFILE('pedidos')),
  '/seller/pedidos': (params) => (params?.orderId
    ? `${PROFILE('pedidos')}?pedido=${encodeURIComponent(params.orderId)}`
    : PROFILE('pedidos')),

  '/product-detail': (params) => (params?.productId
    ? productPath({ id: params.productId })
    : ROUTES.catalog),
  '/(seller)/productos': () => PROFILE('productos'),
  '/seller/productos': () => PROFILE('productos'),

  '/quote-chat': (params) => (params?.quoteId
    ? `${PROFILE('cotizaciones')}?cotizacion=${encodeURIComponent(params.quoteId)}`
    : PROFILE('cotizaciones')),
  '/(seller)/mensajes': (params) => (params?.quoteId
    ? `${PROFILE('cotizaciones')}?cotizacion=${encodeURIComponent(params.quoteId)}`
    : PROFILE('cotizaciones')),
  '/seller/mensajes': (params) => (params?.quoteId
    ? `${PROFILE('cotizaciones')}?cotizacion=${encodeURIComponent(params.quoteId)}`
    : PROFILE('cotizaciones')),
  '/mensajes': (params) => (params?.quoteId
    ? `${PROFILE('cotizaciones')}?cotizacion=${encodeURIComponent(params.quoteId)}`
    : PROFILE('cotizaciones')),

  // El caso (reclamo o mediacion) vive en la conversacion del pedido: "Chats con vendedor" para
  // el comprador y "Chats con compradores" para la tienda (O62/O71). Antes apuntaba a
  // `consultas?pedido=`, que ese panel no lee: la notificacion no abria el caso. El backend manda
  // la MISMA ruta a las dos partes, asi que el lado lo decide quien la abre.
  '/mediation-chat': (params, context) => {
    if (!params?.orderId) return context?.isSeller ? PROFILE('chats_compradores') : PROFILE('chats_vendedor');
    return context?.isSeller ? sellerCaseChatPath(params.orderId) : buyerCaseChatPath(params.orderId);
  },

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
  '/(seller)/retiros': () => PROFILE('retiros'),
  '/seller/retiros': () => PROFILE('retiros'),

  // El monedero de Monedas. En la app es una pantalla propia (`app/wallet.tsx`); en la web vive
  // dentro del panel de anuncios, que es donde estan el saldo y el historial.
  '/wallet': () => PROFILE('anuncios'),

  '/perfil': () => ROUTES.profile,
  '/(seller)': () => ROUTES.profile,
  '/seller': () => ROUTES.profile,
};

/**
 * Devuelve la ruta web a la que debe llevar la notificación, o `null` si no hay ninguna
 * razonable. Con `null` la campana solo marca como leída, que es mejor que mandar al
 * usuario a una pantalla que no tiene que ver.
 */
export function notificationTargetPath(notification, context = {}) {
  const route = notification?.targetRoute;
  if (!route) return null;
  const resolver = TARGETS[route];
  if (!resolver) return null;
  try {
    return resolver(notification.targetParams || {}, context);
  } catch {
    return null;
  }
}

export default notificationTargetPath;
