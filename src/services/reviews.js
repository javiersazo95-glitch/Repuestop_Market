import { fetchApi } from './api';
import { compressImageFile } from '../utils/imageCompression';

/**
 * Opiniones de compradores (2026-10-18). Las del producto traen nota, comentario y hasta 4 fotos
 * (desde el 19-oct; antes un video); las de la tienda, nota y comentario (una por compra).
 * Contrato: `OpinionDTOs` del backend. Mismo contrato que la app (mobile/utils/reviews.ts).
 */
export const REVIEW_COMMENT_MAX = 500;
/** Fotos por opinion de producto (el backend rechaza mas). */
export const REVIEW_PHOTOS_MAX = 4;

export const EMPTY_REVIEWS = {
  average: 0,
  total: 0,
  withComment: 0,
  withPhotos: 0,
  distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  page: 0,
  size: 0,
  hasMore: false,
  items: [],
};

function reviewsPath(kind, id) {
  if (kind === 'workshop') return `/talleres/${id}/opiniones`;
  return kind === 'product' ? `/inventario/productos/${id}/opiniones` : `/tiendas/${id}/opiniones`;
}

export async function getReviewsApi(kind, id, { page = 0, size = 10, signal } = {}) {
  const data = await fetchApi(`${reviewsPath(kind, id)}?page=${page}&size=${size}`, { method: 'GET', signal });
  return {
    ...EMPTY_REVIEWS,
    ...(data || {}),
    average: Number(data?.average ?? 0),
    distribution: { ...EMPTY_REVIEWS.distribution, ...(data?.distribution || {}) },
    items: Array.isArray(data?.items) ? data.items : [],
  };
}

/**
 * Sube UNA foto de la opinion de un producto ANTES de calificar, comprimida en el navegador
 * (`compressImageFile`: lado largo 1600 px, JPEG). Devuelve `{ imageKey, imageUrl }` y la clave
 * viaja luego en la calificacion (`productImageKeys`). El backend la guarda en Review_producto/.
 */
export async function uploadReviewPhotoApi(userId, orderId, file) {
  const formData = new FormData();
  formData.append('foto', await compressImageFile(file));
  return fetchApi(`/usuarios/${userId}/pedidos/${orderId}/opiniones/fotos`, {
    method: 'POST',
    body: formData,
    signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(60000) : undefined,
  });
}

export function formatReviewDate(value, now = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'Hace 1 semana' : `Hace ${weeks} semanas`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
  }
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ratingWord(average) {
  if (average >= 4.5) return 'Excelente';
  if (average >= 4) return 'Muy bueno';
  if (average >= 3) return 'Bueno';
  if (average >= 2) return 'Regular';
  if (average > 0) return 'Malo';
  return '';
}

export function reviewCountLabel(total) {
  return total === 1 ? '1 opinión' : `${total} opiniones`;
}

export function formatRating(value) {
  return Number(value || 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
