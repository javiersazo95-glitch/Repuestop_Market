import { fetchApi } from './api';

/**
 * Fallas automotrices (`/api/v1/fallas-automotrices`): el mural, detalle y comentarios publicos son
 * de lectura publica; registrar, editar y participar en los hilos requiere sesion.
 */

/** Fallas abiertas del mural público; el backend mantiene la propiedad cuando hay sesión. */
export async function getOpenFaults() {
  return fetchApi('/fallas-automotrices');
}

export async function getFaultCategories() {
  return fetchApi('/fallas-automotrices/categorias', { anonymous: true });
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

/** Lo unico publico de los diagnosticos: que talleres respondieron y cuando, sin texto ni precio. */
export async function getPublicDiagnoses(id) {
  return fetchApi(`/fallas-automotrices/${encodeURIComponent(String(id))}/diagnosticos-publicos`);
}

export async function getFaultComments(id) {
  return fetchApi(`/fallas-automotrices/${encodeURIComponent(String(id))}/comentarios`);
}

export async function createFault(payload) {
  return fetchApi('/fallas-automotrices', { method: 'POST', body: JSON.stringify(payload) });
}

/** Actualiza una falla del usuario en sesión. El backend valida que sea su propietario. */
export async function updateFault(id, payload) {
  return fetchApi(`/fallas-automotrices/${encodeURIComponent(String(id))}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function closeFault(id) {
  return fetchApi(`/fallas-automotrices/${encodeURIComponent(String(id))}/cerrar`, { method: 'POST', body: '{}' });
}

/** Diagnostico privado del taller (con precio estimado opcional), comentario publico (`tipo: 'COMENTARIO'`) o respuesta (`respondeAId`). */
export async function commentFault(id, { texto, precioDesde, precioHasta, respondeAId, tipo }) {
  return fetchApi(`/fallas-automotrices/${encodeURIComponent(String(id))}/comentarios`, {
    method: 'POST',
    body: JSON.stringify({
      texto,
      precioDesde: precioDesde ?? null,
      precioHasta: precioHasta ?? null,
      respondeAId: respondeAId ?? null,
      tipo: tipo ?? null,
    }),
  });
}

/** Si el taller puede registrar diagnosticos: Diagnostico activo. */
export async function getDiagnosisEligibility() {
  return fetchApi('/fallas-automotrices/habilitacion-diagnostico');
}

/** El cliente acepta el diagnostico privado de un taller: habilita agendar con el. */
export async function acceptFaultDiagnosis(id, commentId) {
  return fetchApi(`/fallas-automotrices/${encodeURIComponent(String(id))}/comentarios/${encodeURIComponent(String(commentId))}/aceptar`, { method: 'POST', body: JSON.stringify({}) });
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
