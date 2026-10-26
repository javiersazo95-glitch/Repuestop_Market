import { fetchApi } from './api';

/**
 * Fallas automotrices (`/api/v1/fallas-automotrices`): el comprador registra la falla de su vehiculo y
 * los talleres acreditados la comentan con un diagnostico. Todo requiere sesion.
 */

/** Fallas abiertas de todos los clientes (solo talleres). */
export async function getOpenFaults() {
  return fetchApi('/fallas-automotrices');
}

/** Fallas registradas por el usuario en sesion. */
export async function getMyFaults() {
  return fetchApi('/fallas-automotrices/mias');
}

/** Fallas en las que el taller en sesion ya dejo su diagnostico. */
export async function getCommentedFaults() {
  return fetchApi('/fallas-automotrices/comentadas');
}

export async function getFault(id) {
  return fetchApi(`/fallas-automotrices/${encodeURIComponent(String(id))}`);
}

export async function getFaultComments(id) {
  return fetchApi(`/fallas-automotrices/${encodeURIComponent(String(id))}/comentarios`);
}

export async function createFault(payload) {
  return fetchApi('/fallas-automotrices', { method: 'POST', body: JSON.stringify(payload) });
}

export async function closeFault(id) {
  return fetchApi(`/fallas-automotrices/${encodeURIComponent(String(id))}/cerrar`, { method: 'POST', body: '{}' });
}

/** Diagnostico del taller (con precio estimado opcional) o respuesta del comprador (`respondeAId`). */
export async function commentFault(id, { texto, precioDesde, precioHasta, respondeAId }) {
  return fetchApi(`/fallas-automotrices/${encodeURIComponent(String(id))}/comentarios`, {
    method: 'POST',
    body: JSON.stringify({
      texto,
      precioDesde: precioDesde ?? null,
      precioHasta: precioHasta ?? null,
      respondeAId: respondeAId ?? null,
    }),
  });
}

/** Sube una foto de la falla y devuelve `{ url }` para enviarla al registrar. */
export async function uploadFaultPhoto(file) {
  const formData = new FormData();
  formData.append('foto', file);
  return fetchApi('/fallas-automotrices/fotos', { method: 'POST', body: formData });
}

/** "Hace 3 h", "Hace 2 días": cuanto lleva publicada una falla. */
export function timeSince(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Hace un momento';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

export function formatPesos(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

/** Rango de precio estimado de un diagnostico, o null si el taller no lo indico. */
export function priceRange(from, to) {
  if (from != null && to != null) return from === to ? formatPesos(from) : `${formatPesos(from)} - ${formatPesos(to)}`;
  if (from != null) return `Desde ${formatPesos(from)}`;
  if (to != null) return `Hasta ${formatPesos(to)}`;
  return null;
}
