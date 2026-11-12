import { fetchApi, getPublicProductsApi, getVehicleCatalogPartsApi } from './api';
import { buildBroadcastText } from '../utils/partAssistant';

/**
 * Red de Repuestín (copia de `mobile/services/repuesto-assistant-api.ts` y
 * `mobile/services/assistant-visibility-api.ts`): subcategorías, disponibilidad en vivo, mensaje a varias
 * casas de repuestos y el perfil "Que Repuestín te recomiende" de la tienda.
 */

/** Las subcategorías casi no cambian: se guardan 10 minutos para no pedirlas en cada apertura. */
const SUBCATEGORIES_TTL_MS = 10 * 60 * 1000;
let subcategoriesCache = null;

/** Todas las subcategorías de repuestos con su categoría, para el desplegable de "lo que anda buscando". */
export async function loadAssistantSubcategories() {
  if (subcategoriesCache && Date.now() - subcategoriesCache.at < SUBCATEGORIES_TTL_MS) return subcategoriesCache.data;
  const rows = await fetchApi('/catalogos/inventario/subcategorias-repuesto', { method: 'GET', anonymous: true });
  const data = Array.isArray(rows) ? rows : [];
  subcategoriesCache = { at: Date.now(), data };
  return data;
}

/** Cuántos repuestos publicados calzan, medido IGUAL que el catálogo (mismo cruce con un vehículo del catálogo). */
async function countMatchingProducts(ctx) {
  const subId = ctx.subcategoriaId.trim();
  const text = ctx.repuesto.trim();
  if (!subId && !text) return 0;
  const anio = Number.parseInt(ctx.anio, 10);
  const year = Number.isFinite(anio) && anio > 0 ? anio : undefined;
  const page = ctx.catalogoId.trim()
    ? await getVehicleCatalogPartsApi(ctx.catalogoId.trim(), { anio: year, subcategoriaId: subId || undefined, texto: subId ? undefined : text, page: 0, size: 1 })
    : await getPublicProductsApi({
      subcategoriaId: subId || undefined,
      texto: subId ? undefined : text,
      patente: ctx.patente || undefined,
      compatibilidadMarca: ctx.marca || undefined,
      compatibilidadModelo: ctx.modelo || undefined,
      compatibilidadAnio: year,
      page: 0,
      size: 1,
    });
  const content = Array.isArray(page?.content) ? page.content : [];
  return content.length > 0 ? Math.max(Number(page.totalElements) || 0, 1) : 0;
}

async function fetchSuggestedStores(ctx, comuna) {
  const query = new URLSearchParams();
  if (ctx.subcategoriaId.trim()) query.set('subcategoriaId', ctx.subcategoriaId.trim());
  else if (ctx.repuesto.trim()) query.set('texto', ctx.repuesto.trim());
  if (ctx.marca.trim()) query.set('marca', ctx.marca.trim());
  // La comuna del comprador: suma a las tiendas cercanas y a las que despachan hasta ahí.
  if (comuna) query.set('comuna', comuna);
  query.set('limite', '3');
  try {
    const data = await fetchApi(`/asistente/tiendas-sugeridas?${query.toString()}`, { method: 'GET' });
    return { totalTiendas: Number(data?.totalTiendas ?? 0), tiendas: Array.isArray(data?.tiendas) ? data.tiendas : [] };
  } catch {
    return { totalTiendas: 0, tiendas: [] };
  }
}

/**
 * Lo que hay AHORA en RepuesTop para lo que busca el usuario. Sin caché a propósito: el catálogo y las casas
 * de repuestos cambian a diario. Las tiendas llegan ya rankeadas por el servidor.
 */
export async function getAssistantAvailability(ctx, { comuna } = {}) {
  const [productsResult, storesResult] = await Promise.allSettled([countMatchingProducts(ctx), fetchSuggestedStores(ctx, comuna)]);
  const productCount = productsResult.status === 'fulfilled' ? productsResult.value : 0;
  const suggested = storesResult.status === 'fulfilled' ? storesResult.value : { totalTiendas: 0, tiendas: [] };
  const stores = suggested.tiendas
    .map((store) => ({
      proveedorId: Number(store.proveedorId),
      nombre: store.nombre ?? 'Casa de repuestos',
      comuna: store.comuna ?? undefined,
      marcasEspecialistas: store.marcasEspecialistas ?? [],
      productCount: store.repuestosPublicados ?? undefined,
      logoUrl: store.logoUrl || undefined,
      rating: store.rating ?? undefined,
      affinity: store.afinidad ?? 'POSIBLE',
      summary: store.resumen ?? '',
      reasons: Array.isArray(store.razones) && store.razones.length > 0 ? store.razones : store.resumen ? [store.resumen] : [],
      ficha: store.ficha ?? undefined,
    }))
    .filter((store) => Number.isFinite(store.proveedorId));
  return { productCount, stores, totalStores: Math.max(suggested.totalTiendas, stores.length) };
}

/** Deja el mensaje a varias casas de repuestos; el backend revalida que sigan activas. */
export async function sendPartBroadcast(ctx, proveedorIds, texto) {
  const anio = Number.parseInt(ctx.anio, 10);
  const data = await fetchApi('/conversaciones/difusion', {
    method: 'POST',
    body: JSON.stringify({
      proveedorIds,
      repuesto: ctx.repuesto.trim(),
      descripcion: ctx.descripcion.trim() || undefined,
      patente: ctx.patente || undefined,
      marca: ctx.marca.trim() || undefined,
      modelo: ctx.modelo.trim() || undefined,
      anio: Number.isFinite(anio) ? anio : undefined,
      version: ctx.version.trim() || undefined,
      chasis: ctx.chasis.trim() || undefined,
      texto: (texto ?? buildBroadcastText(ctx)).trim(),
    }),
  });
  return {
    tiendasContactadas: Number(data?.tiendasContactadas ?? 0),
    tiendasNoDisponibles: Number(data?.tiendasNoDisponibles ?? 0),
    conversacionIds: Array.isArray(data?.conversacionIds) ? data.conversacionIds.map(Number) : [],
  };
}

// ─────────────────────────────────────────────────────────────── Perfil de la tienda

export async function loadAssistantVisibility(sellerId) {
  return fetchApi(`/proveedores/${sellerId}/asistente`, { method: 'GET' });
}

export async function saveStoreSpecialties(sellerId, input) {
  return fetchApi(`/proveedores/${sellerId}/asistente/especialidades`, { method: 'PUT', body: JSON.stringify(input) });
}

/** Ranking de la semana en curso (lunes a domingo, hora de Chile): parte de cero cada lunes. */
export async function loadWeeklyRanking(sellerId) {
  return fetchApi(`/proveedores/${sellerId}/asistente/ranking-semanal`, { method: 'GET' });
}

// ─────────────────────────────────────────────────────────────── Avisos entre vistas

/** Un encargo creado por cualquier vía resuelve la búsqueda de la burbuja (como `part-assistant-events.ts`). */
export const AUCTION_CREATED_EVENT = 'repuestop:auction-created';

export function notifyAuctionCreated() {
  try { window.dispatchEvent(new CustomEvent(AUCTION_CREATED_EVENT)); } catch { /* sin ventana no hay burbuja */ }
}

export function onAuctionCreated(listener) {
  window.addEventListener(AUCTION_CREATED_EVENT, listener);
  return () => window.removeEventListener(AUCTION_CREATED_EVENT, listener);
}
