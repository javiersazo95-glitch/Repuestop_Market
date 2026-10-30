import { ROUTES, auctionDetailPath, buyerCaseChatPath, faultDetailPath, productPath, profilePurchasePath, sellerCaseChatPath } from '../routes/paths';

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
 * - `/order-detail`               -> `{ orderId, viewMode? }`
 * - `/product-detail`             -> `{ productId, questionId? }`
 * - `/quote-chat`                 -> `{ quoteId, viewMode? }`
 * - `/mediation-chat`             -> `{ orderId, viewMode?, proveedorId?, tab? }` (la tienda del chat en multi-tienda; `tab: 'mediator'` abre la pestaña del mediador)
 * - `/workshop-detail` -> `{ id }`; `/my-workshop` (aprobación del taller) manda `{ seccion: 'agenda' }`
 * - `/automotive-service-accreditation` -> `{}` (corrección o rechazo de la acreditación)
 * - `/support-ticket-detail`      -> `{ ticketId }`
 * - `/provider-verification-status` -> `{ sellerId }`
 */
const PROFILE = (tab) => `${ROUTES.profile}/${tab}`;

// U1 (5-oct): una tienda que compra recibe avisos con `viewMode: 'buyer'`. Sin mirarlo, su compra se
// abria en "Pedidos" (sus ventas) y su cotizacion en la bandeja de la tienda.
const isSellerBuying = (params, context) => Boolean(context?.isSeller) && params?.viewMode === 'buyer';

const TARGETS = {
  '/order-detail': (params, context) => {
    if (isSellerBuying(params, context)) {
      return params?.orderId ? profilePurchasePath(params.orderId) : PROFILE('compras');
    }
    return params?.orderId
      ? `${PROFILE('pedidos')}?pedido=${encodeURIComponent(params.orderId)}`
      : PROFILE('pedidos');
  },
  // `tab: 'mediacion'` es el aviso del caso a la tienda: se abre su chat, no la lista de ventas.
  '/(seller)/pedidos': (params) => {
    if (params?.tab === 'mediacion' && params?.orderId) return sellerCaseChatPath(params.orderId);
    return params?.orderId
      ? `${PROFILE('pedidos')}?pedido=${encodeURIComponent(params.orderId)}`
      : PROFILE('pedidos');
  },
  '/seller/pedidos': (params) => (params?.orderId
    ? `${PROFILE('pedidos')}?pedido=${encodeURIComponent(params.orderId)}`
    : PROFILE('pedidos')),

  '/product-detail': (params) => (params?.productId
    ? productPath({ id: params.productId })
    : ROUTES.catalog),
  '/(seller)/productos': () => PROFILE('productos'),
  '/seller/productos': () => PROFILE('productos'),

  '/quote-chat': (params, context) => {
    const tab = isSellerBuying(params, context) ? 'mis_cotizaciones' : 'cotizaciones';
    return params?.quoteId
      ? `${PROFILE(tab)}?cotizacion=${encodeURIComponent(params.quoteId)}`
      : PROFILE(tab);
  },
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
  // U1: `viewMode` (desde el 5-oct) dice de que lado es el aviso; una tienda que compra abre su
  // caso como compradora.
  '/mediation-chat': (params, context) => {
    const asSeller = params?.viewMode ? params.viewMode === 'seller' : Boolean(context?.isSeller);
    if (!params?.orderId) return asSeller ? PROFILE('chats_compradores') : PROFILE('chats_vendedor');
    // `tab: 'mediator'` (8-oct): un mensaje del mediador abre su pestaña, no el chat directo pausado.
    return asSeller
      ? sellerCaseChatPath(params.orderId, params.proveedorId, params.tab)
      : buyerCaseChatPath(params.orderId, params.proveedorId, params.tab);
  },

  '/support-ticket-detail': (params) => (params?.ticketId
    ? `${PROFILE('consultas')}?ticket=${encodeURIComponent(params.ticketId)}`
    : PROFILE('consultas')),
  '/tickets': () => PROFILE('consultas'),

  // Perfil publico de un taller. Los avisos de anuncio viejos (`/ad-detail`) caen en el buscador.
  '/workshop-detail': (params) => (params?.id ? `${ROUTES.talleres}/${encodeURIComponent(params.id)}` : ROUTES.talleres),
  '/ad-detail': () => ROUTES.talleres,
  // `seccion: 'agenda'` (aprobación del taller): Mi taller abre el horario principal si la
  // agenda sigue pendiente (lo atiende `MiTallerSection`).
  '/my-workshop': (params) => (params?.seccion === 'agenda'
    ? `${PROFILE('mi_taller')}?seccion=agenda`
    : PROFILE('mi_taller')),
  '/ads-management': (params) => (params?.seccion === 'agenda'
    ? `${PROFILE('mi_taller')}?seccion=agenda`
    : PROFILE('mi_taller')),
  // En la web la acreditación vive dentro de Mi taller (`AccreditationModal`).
  '/automotive-service-accreditation': () => PROFILE('mi_taller'),
  // Notificaciones de cita (las crea el backend): abren la página de citas del perfil (`Mis citas` del comprador,
  // `Mi taller > Citas` del taller) en la bandeja que corresponde, con la cita resaltada. Lo atiende `MiTallerSection`.
  '/appointments-history': (params) => {
    const query = new URLSearchParams({ citas: params?.segmento === 'received' ? 'recibidas' : 'pedidas' });
    if (params?.id) query.set('cita', params.id);
    // Con la pestaña explícita: `/perfil` a secas redirige a `/perfil/resumen` y pierde la consulta.
    return `${PROFILE('mi_taller')}?${query.toString()}`;
  },

  '/provider-verification-status': () => PROFILE('tienda_datos'),

  '/withdrawals': () => PROFILE('retiros'),
  '/withdrawal-payments': () => PROFILE('retiros'),
  '/(seller)/retiros': () => PROFILE('retiros'),
  '/seller/retiros': () => PROFILE('retiros'),

  // El monedero de Monedas. En la app es una pantalla propia (`app/wallet.tsx`); en la web es el
  // indicador de la cabecera, asi que el aviso aterriza en el resumen del perfil.
  '/wallet': () => PROFILE('resumen'),

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
  // Búsqueda de repuestos: el aviso trae `/subastas/{id}` con el id ya incluido en la ruta.
  const auctionMatch = /^\/subastas\/(\d+)$/.exec(route);
  if (auctionMatch) return auctionDetailPath(auctionMatch[1]);
  // Fallas automotrices: el aviso trae `/fallas/{id}` (nueva falla, diagnostico de un taller o respuesta del cliente).
  const faultMatch = /^\/fallas\/(\d+)$/.exec(route);
  if (faultMatch) return faultDetailPath(faultMatch[1]);
  // Premio del servicio Diagnostico (app: `/(workshop)/diagnostico`).
  if (route === '/(workshop)/diagnostico') return PROFILE('diagnostico');
  const resolver = TARGETS[route];
  if (!resolver) return null;
  try {
    return resolver(notification.targetParams || {}, context);
  } catch {
    return null;
  }
}

export default notificationTargetPath;
