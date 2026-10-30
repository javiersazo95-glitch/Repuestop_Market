import { fetchApi } from './api';
import { LEGAL_VERSION_CODE } from '../data/legalTexts';

/**
 * Cuenta y perfil del Taller automotriz: registro propio (rol TALLER), catalogo de servicios, servicio
 * Diagnostico y perfil publico.
 */

/** Registro de un taller como cuenta propia (crea la identidad, su ficha y su cuenta de comprador). */
export async function registerWorkshopApi(data) {
  return fetchApi('/auth/register/workshop', {
    method: 'POST',
    body: JSON.stringify({
      responsibleName: String(data.responsibleName || '').trim(),
      workshopName: String(data.workshopName || '').trim(),
      taxId: String(data.taxId || '').trim(),
      giro: data.giro?.trim() || null,
      email: String(data.email || '').trim(),
      phone: String(data.phone || '').trim(),
      password: data.password || '',
      authProvider: 'EMAIL_PASSWORD',
      acceptsTerms: data.acceptsTerms === true,
      termsVersion: LEGAL_VERSION_CODE,
      referral: data.referral?.trim().toUpperCase() || null,
      referralChannel: data.referral ? 'WEB' : null,
      direccion: {
        comunaId: Number(data.direccion?.comunaId),
        calleYNumero: data.direccion?.calleYNumero || '',
        codigoPostal: data.direccion?.codigoPostal || '',
      },
    }),
  });
}

// --- Catalogo de servicios del taller (`/taller/servicios`) ---

export async function getWorkshopServices() {
  return fetchApi('/taller/servicios');
}

export async function getWorkshopServiceCategories() {
  return fetchApi('/taller/servicios/categorias');
}

export async function createWorkshopService(payload) {
  return fetchApi('/taller/servicios', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateWorkshopService(id, payload) {
  return fetchApi(`/taller/servicios/${encodeURIComponent(String(id))}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteWorkshopService(id) {
  return fetchApi(`/taller/servicios/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

// --- Informacion breve del taller (`/taller/informacion`): descripcion, experiencia, equipamiento y garantia ---

export async function getTallerInfo() {
  return fetchApi('/taller/informacion');
}

export async function saveTallerInfo(payload) {
  return fetchApi('/taller/informacion', { method: 'PUT', body: JSON.stringify(payload) });
}

// --- Servicio Diagnostico (`/taller/diagnostico`) ---

export async function getDiagnosticStatus() {
  return fetchApi('/taller/diagnostico');
}

export async function activateDiagnostic() {
  return fetchApi('/taller/diagnostico/activar', { method: 'POST', body: '{}' });
}

/** Pesos que equivalen a unas monedas (1 moneda = $50). */
export function coinsToPesos(coins) {
  return `$${(Number(coins || 0) * 50).toLocaleString('es-CL')}`;
}

/** Dias que le quedan al servicio; 0 si no esta activo. */
export function daysLeft(status) {
  if (!status?.activo || !status.venceEn) return 0;
  return Math.max(0, Math.ceil((new Date(status.venceEn).getTime() - Date.now()) / 86400000));
}

/** Fraccion 0-1 del camino al proximo Diagnostico gratis. */
export function prizeProgress(status) {
  const per = Number(status?.necesidadesPorGratis || 0);
  if (per <= 0) return 0;
  const done = per - Number(status?.necesidadesParaProximoGratis || 0);
  return Math.min(1, Math.max(0, done / per));
}

// --- Perfil publico (`/talleres`) ---

export async function getWorkshopProfile(id) {
  return fetchApi(`/talleres/${encodeURIComponent(String(id))}`, { anonymous: true });
}

/** "7 meses", "1 año", "2 años y 3 meses": cuanto lleva el taller en RepuesTop. */
export function seniorityLabel(months) {
  const m = Number(months || 0);
  if (m < 1) return 'Nuevo';
  if (m < 12) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  const years = Math.floor(m / 12);
  const rest = m % 12;
  const base = `${years} ${years === 1 ? 'año' : 'años'}`;
  return rest > 0 ? `${base} y ${rest} ${rest === 1 ? 'mes' : 'meses'}` : base;
}
