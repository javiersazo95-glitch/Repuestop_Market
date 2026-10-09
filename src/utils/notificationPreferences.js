/**
 * Moderacion de notificaciones por perfil (7-oct), compartida con la app. Vive en la cuenta
 * (backend: `notif_pref_vendedor` / `notif_pref_comprador`) y el backend ya la aplica a los push y
 * al contador `unread-count`; aqui solo se replica para la lista de la campana.
 *
 * Niveles: TODAS (todo) · IMPORTANTES (solo lo importante) · NINGUNA (silenciadas: sin push ni
 * contador, la bandeja conserva el historial atenuado). Los correos transaccionales no se tocan.
 */
export const NOTIFICATION_LEVELS = ['TODAS', 'IMPORTANTES', 'NINGUNA'];

export const LEVEL_LABEL = { TODAS: 'Todas', IMPORTANTES: 'Solo importantes', NINGUNA: 'Silenciadas' };

export const LEVEL_OPTIONS = {
  VENDEDOR: [
    { value: 'TODAS', title: 'Todas', description: 'Ventas, pedidos, cotizaciones, mensajes, preguntas, stock, citas, finanzas, soporte y cuenta.' },
    { value: 'IMPORTANTES', title: 'Solo importantes', description: 'Ventas nuevas, despachos y cancelaciones, solicitudes de cotización, disputas, citas, retiros, soporte y estado de tu tienda. Sin mensajes de chat, preguntas ni stock bajo.' },
    { value: 'NINGUNA', title: 'Silenciadas', description: 'Sin push en el teléfono ni contador en la campana. La bandeja conserva el historial.' },
  ],
  COMPRADOR: [
    { value: 'TODAS', title: 'Todas', description: 'Cambios de tus pedidos, cotizaciones, mensajes, respuestas a tus preguntas, citas, soporte y cuenta.' },
    { value: 'IMPORTANTES', title: 'Solo importantes', description: 'Cambios y cancelaciones de tus pedidos, cotizaciones listas, disputas, citas, soporte y estado de tu cuenta. Sin mensajes de chat ni respuestas a preguntas.' },
    { value: 'NINGUNA', title: 'Silenciadas', description: 'Sin push en el teléfono ni contador en la campana. La bandeja conserva el historial.' },
  ],
};

export function normalizeLevel(value) {
  const upper = String(value || '').toUpperCase();
  return NOTIFICATION_LEVELS.includes(upper) ? upper : 'TODAS';
}

/** Preferencias desde el usuario de la sesion (`usuario` del login o `/users/perfil`). */
export function preferencesFromUser(user) {
  return {
    VENDEDOR: normalizeLevel(user?.notificacionesVendedor),
    COMPRADOR: normalizeLevel(user?.notificacionesComprador),
  };
}

const RANK = { TODAS: 0, IMPORTANTES: 1, NINGUNA: 2 };

/**
 * Nivel que gobierna un aviso: el de su perfil; para AMBOS, el mas permisivo de los dos en una
 * tienda (misma regla que NotificacionCatalogo en el backend).
 */
export function levelForNotification(item, preferences, isSeller) {
  const perfil = item?.perfil || 'AMBOS';
  if (!isSeller) return preferences.COMPRADOR;
  if (perfil === 'VENDEDOR') return preferences.VENDEDOR;
  if (perfil === 'COMPRADOR') return preferences.COMPRADOR;
  return RANK[preferences.VENDEDOR] <= RANK[preferences.COMPRADOR] ? preferences.VENDEDOR : preferences.COMPRADOR;
}

export function isVisibleAtLevel(level, importante) {
  if (level === 'TODAS') return true;
  if (level === 'IMPORTANTES') return Boolean(importante);
  return false;
}

/**
 * Lo que la campana lista: con IMPORTANTES se ocultan los de rutina; con NINGUNA se conserva el
 * historial pero atenuado (`muted`).
 */
export function classifyForInbox(items, preferences, isSeller) {
  return (items || []).flatMap((item) => {
    const level = levelForNotification(item, preferences, isSeller);
    if (level === 'NINGUNA') return [{ ...item, muted: true }];
    if (!isVisibleAtLevel(level, item.importante)) return [];
    return [{ ...item, muted: false }];
  });
}
