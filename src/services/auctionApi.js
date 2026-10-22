import { fetchApi } from './api';

/**
 * Consulta el listado público de subastas de repuestos / necesidades de compra.
 */
export async function getAuctions({ estado = 'ACTIVA', marca, region, page = 0, size = 12 } = {}) {
  const params = new URLSearchParams();
  if (estado && estado !== 'TODAS') params.set('estado', estado);
  if (marca) params.set('marca', marca);
  if (region) params.set('region', region);
  params.set('page', String(page));
  params.set('size', String(size));

  return fetchApi(`/necesidades-compra?${params.toString()}`, { anonymous: true });
}

/**
 * Consulta el detalle de una subasta específica.
 * Si el usuario está autenticado, el backend aplica las reglas de privacidad:
 * - El comprador creador ve todas las ofertas completas.
 * - La tienda ve su propia oferta completa y el resto con candado 🔒.
 * - Visitantes y competencia ven las ofertas con candado 🔒.
 */
export async function getAuctionDetail(id) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(id))}`);
}

/**
 * Publica una nueva necesidad de compra.
 */
export async function createAuction(payload) {
  return fetchApi('/necesidades-compra', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Sube una imagen individual a Cloudflare R2 para la subasta.
 */
export async function uploadAuctionPhoto(file) {
  const formData = new FormData();
  formData.append('foto', file);
  return fetchApi('/necesidades-compra/fotos', {
    method: 'POST',
    body: formData,
  });
}

/**
 * La casa de repuestos emite o actualiza su cotización para la subasta.
 */
export async function submitAuctionQuote(auctionId, payload) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/cotizaciones`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * El comprador selecciona la cotización ganadora.
 */
export async function selectWinningQuote(auctionId, quoteId) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/seleccionar-ganadora/${encodeURIComponent(String(quoteId))}`, {
    method: 'POST',
  });
}

/**
 * Lista las subastas publicadas por el comprador en sesión.
 */
export async function getMyAuctionRequests() {
  return fetchApi('/necesidades-compra/mis-solicitudes');
}

/**
 * Perfil público del comprador de la subasta: nombre abreviado, antigüedad, calificación que le dejan
 * las tiendas y sus últimas subastas cerradas. Si quien consulta es la tienda ganadora, indica si
 * puede calificarlo.
 */
export async function getAuctionBuyerProfile(auctionId) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/comprador`);
}

/** Todas las subastas cerradas del comprador con su calificación y comentario. */
export async function getAuctionBuyerHistory(auctionId) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/comprador/historial`, { anonymous: true });
}

/** La tienda ganadora califica al comprador (1 a 5 estrellas, comentario opcional). */
export async function rateAuctionBuyer(auctionId, { estrellas, comentario }) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/comprador/calificacion`, {
    method: 'POST',
    body: JSON.stringify({ estrellas, comentario }),
  });
}

/** Comentarios públicos de la necesidad (preguntas de tiendas y respuestas del comprador). */
export async function getAuctionComments(auctionId) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/comentarios`, { anonymous: true });
}

export async function postAuctionComment(auctionId, texto) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/comentarios`, {
    method: 'POST',
    body: JSON.stringify({ texto }),
  });
}

/**
 * Repuestos del inventario de la tienda que sirven para el vehículo de la subasta (patente registrada por el
 * comprador). Con `soloCompatibles: false` busca en todo el inventario y marca cuáles son compatibles.
 */
export async function getAuctionSuggestedParts(auctionId, { texto, soloCompatibles = true, size = 24, itemId } = {}) {
  const params = new URLSearchParams();
  if (itemId) params.set('itemId', String(itemId));
  if (texto) params.set('texto', texto);
  params.set('soloCompatibles', String(soloCompatibles));
  params.set('size', String(size));
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/repuestos-sugeridos?${params.toString()}`);
}

/** El comprador acepta una oferta (completa o parcial): sus repuestos aún pendientes quedan adjudicados. */
export async function acceptAuctionOffer(auctionId, offerId) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/cotizaciones/${encodeURIComponent(String(offerId))}/aceptar`, {
    method: 'POST',
  });
}

/** Composición de la compra: las ofertas aceptadas de distintas tiendas, con envío, totales y lo que falta por adjudicar. */
export async function getAuctionPurchase(auctionId, addressId) {
  const query = addressId ? `?direccionId=${encodeURIComponent(String(addressId))}` : '';
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/compra${query}`);
}

/** Paga juntas las ofertas aceptadas: un pedido de varias tiendas y un solo pago. */
export async function payAuctionPurchase(auctionId, payload) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/pagar`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Seguimiento de las ofertas que la tienda en sesión envió a pedidos de subasta (estado, si el comprador las
 * revisó, si tomó otra oferta, competencia y pedido generado).
 */
export async function getMyAuctionOffers() {
  return fetchApi('/necesidades-compra/mis-ofertas');
}

/**
 * El comprador abrió una oferta: la tienda lo ve como "Revisada por el comprador".
 */
export async function markAuctionOfferSeen(auctionId, offerId) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/cotizaciones/${encodeURIComponent(String(offerId))}/visto`, {
    method: 'POST',
  });
}

/**
 * Metricas generales de las necesidades de compra (activas, registradas hoy y ofertas de hoy), sin filtros.
 */
export async function getAuctionMetrics() {
  return fetchApi('/necesidades-compra/metricas', { anonymous: true });
}

/**
 * El comprador edita su necesidad de compra mientras no haya aceptado ninguna oferta.
 */
export async function updateAuction(id, payload) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Guarda (o quita de guardadas) una solicitud de compra para hacerle seguimiento.
 */
export async function setAuctionSaved(auctionId, saved) {
  return fetchApi(`/necesidades-compra/${encodeURIComponent(String(auctionId))}/guardar`, {
    method: saved ? 'POST' : 'DELETE',
  });
}

/**
 * Solicitudes de compra que el usuario en sesión guardó.
 */
export async function getSavedAuctions() {
  return fetchApi('/necesidades-compra/guardadas');
}
