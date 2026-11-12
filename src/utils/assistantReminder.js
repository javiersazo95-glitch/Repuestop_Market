import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { loadAssistantVisibility } from '../services/assistantApi';
import { isRegisteredForAssistant } from './assistantVisibility';

/**
 * Recordatorio de "Que Repuestín te recomiende" para la tienda que aún no declara qué repuestos trabaja
 * (copia de `mobile/utils/assistant-reminder.ts`):
 * - Sin registrar y sin haber visto el aviso: popup "Estás perdiendo clientes".
 * - Al cerrarlo, queda un ícono de advertencia junto a la campana hasta que registre (se recuerda por tienda).
 * - Al registrar se quita el ícono y se borra lo recordado.
 * Estado compartido entre la barra, la tarjeta del inicio y la pantalla: un solo store sin contexto.
 */
const DISMISSED_KEY = 'repuestopAsistenteRecordatorio:';

let state = { sellerId: null, registered: null, dismissed: false };
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

/** Toda lectura o guardado del perfil pasa por aquí: el ícono se quita en cuanto registra, sin recargar. */
export function syncAssistantReminder(sellerId, visibility) {
  const id = String(sellerId);
  if (state.sellerId !== null && state.sellerId !== id) return;
  const registered = isRegisteredForAssistant(visibility);
  setState({ sellerId: id, registered, ...(registered ? { dismissed: false } : {}) });
  if (registered) {
    try { localStorage.removeItem(`${DISMISSED_KEY}${id}`); } catch { /* sin almacenamiento */ }
  }
}

async function refreshAssistantReminder(sellerId) {
  let dismissed = false;
  try { dismissed = localStorage.getItem(`${DISMISSED_KEY}${sellerId}`) === '1'; } catch { /* se trata como no visto */ }
  if (state.sellerId !== sellerId) return;
  setState({ dismissed });
  try {
    syncAssistantReminder(sellerId, await loadAssistantVisibility(sellerId));
  } catch {
    // Sin lectura no se avisa: mejor callar que acusar a una tienda que sí registró.
  }
}

export function dismissAssistantReminder() {
  if (!state.sellerId) return;
  setState({ dismissed: true });
  try { localStorage.setItem(`${DISMISSED_KEY}${state.sellerId}`, '1'); } catch { /* sin almacenamiento */ }
}

/**
 * Estado del recordatorio para la tienda en sesión. `enabled` = cuenta vendedora activa y sin bloqueo.
 * `showPopup`: no registró y aún no cerró el aviso. `showHeaderIcon`: no registró y ya lo cerró.
 */
export function useAssistantReminder(sellerId, enabled) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const id = sellerId == null || sellerId === '' ? null : String(sellerId);
  useEffect(() => {
    if (!enabled || !id) return;
    if (state.sellerId !== id) setState({ sellerId: id, registered: null, dismissed: false });
    void refreshAssistantReminder(id);
  }, [enabled, id]);
  const dismiss = useCallback(() => dismissAssistantReminder(), []);
  const active = enabled && Boolean(id) && snapshot.sellerId === id && snapshot.registered === false;
  return { showPopup: active && !snapshot.dismissed, showHeaderIcon: active && snapshot.dismissed, dismiss };
}
