/**
 * Agendas con nombre reutilizables. La fuente de verdad es el backend
 * (`/api/v1/agenda-configs`), compartido con la app móvil: una agenda creada en
 * un cliente aparece en el otro. `localStorage` es solo caché de respaldo para
 * que la lista no parpadee en vacío mientras responde la red.
 *
 * Contraparte de `mobile/services/agenda-configs-storage.ts`.
 */
import {
  fetchAgendaConfigsApi, upsertAgendaConfigApi, deleteAgendaConfigApi,
} from './api';
import { normalizeAgendaConfig, createDefaultAgendaConfig } from '../data/agendaConfig';

const CACHE_KEY = 'repuestop_agenda_configs';
export const AGENDA_CONFIGS_UPDATED_EVENT = 'repuestop_agenda_configs_updated';

/** Id nuevo para una agenda creada desde la web. Estable entre dispositivos. */
export function newAgendaConfigId() {
  return `web-agc-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
}

/** Item del backend (plano) -> forma que usa la UI (schedule + id/name/fechas). */
function adaptAgendaConfig(item) {
  if (!item) return null;
  const schedule = normalizeAgendaConfig(item) || createDefaultAgendaConfig();
  return {
    id: String(item.id || ''),
    name: String(item.name || 'Agenda sin nombre'),
    ...schedule,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(list) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(AGENDA_CONFIGS_UPDATED_EVENT, { detail: list }));
  } catch {
    /* almacenamiento lleno o no disponible: la próxima lectura vuelve al backend */
  }
}

/** Copia local conocida (síncrona), para el primer render. */
export function getCachedAgendaConfigs() {
  return readCache();
}

/** Lista las agendas del usuario. Si la red falla, devuelve la caché. */
export async function getAgendaConfigs({ signal } = {}) {
  try {
    const response = await fetchAgendaConfigsApi({ signal });
    const list = (Array.isArray(response) ? response : []).map(adaptAgendaConfig).filter(Boolean);
    writeCache(list);
    return list;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return readCache();
  }
}

/** Crea o actualiza una agenda y refresca la caché. Devuelve la lista nueva. */
export async function upsertAgendaConfig(config) {
  const payload = {
    id: config.id || newAgendaConfigId(),
    name: (config.name || '').trim() || 'Mi horario de atención',
    startDay: config.startDay,
    endDay: config.endDay,
    closedDays: config.closedDays || [],
    sameHoursEveryDay: config.sameHoursEveryDay !== false,
    defaultHours: config.defaultHours,
    customHours: config.customHours || {},
    breakEnabled: config.breakEnabled === true,
    breakHours: config.breakHours,
    slotMinutes: config.slotMinutes,
  };
  await upsertAgendaConfigApi(payload);
  return getAgendaConfigs();
}

/** Elimina una agenda y refresca la caché. Devuelve la lista nueva. */
export async function deleteAgendaConfig(id) {
  await deleteAgendaConfigApi(id);
  return getAgendaConfigs();
}

/**
 * Escucha cambios en la lista (otra pestaña / otro componente la refrescó).
 * Devuelve la función para desuscribirse.
 */
export function subscribeToAgendaConfigsUpdates(callback) {
  const handler = (e) => {
    if (Array.isArray(e.detail)) callback(e.detail);
  };
  window.addEventListener(AGENDA_CONFIGS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(AGENDA_CONFIGS_UPDATED_EVENT, handler);
}
