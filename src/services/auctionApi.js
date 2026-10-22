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
