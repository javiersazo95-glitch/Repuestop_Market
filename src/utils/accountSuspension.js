// Suspension de cuenta (pruebas en dev, 2026-10-09). El backend manda el mismo payload
// (`SuspensionCuentaDTO`) en el login, el refresh y `estado-cuenta`; aca se normaliza y se derivan
// los textos y el contador del panel de suspension y del aviso compacto. Espejo de
// `utils/account-suspension.ts` de la app.

function texto(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Normaliza el `suspension` del backend; sin payload devuelve null. */
export function normalizeSuspension(raw, receivedAt = Date.now()) {
  if (!raw || typeof raw !== 'object') return null;
  const serverMs = raw.serverTime ? new Date(raw.serverTime).getTime() : NaN;
  const kind = texto(raw.kind);
  const level = texto(raw.level);
  return {
    blocked: Boolean(raw.blocked),
    kind: kind === 'SUSPENSION' || kind === 'BLOQUEO' ? kind : null,
    level: ['TEMPORAL', 'DEFINITIVA', 'FRAUDE'].includes(level) ? level : null,
    reason: texto(raw.reason),
    startsAt: texto(raw.startsAt),
    endsAt: texto(raw.endsAt),
    clockOffsetMs: Number.isFinite(serverMs) ? serverMs - receivedAt : 0,
    canAppeal: Boolean(raw.canAppeal),
    reviewRequested: Boolean(raw.reviewRequested),
    caseReference: texto(raw.caseReference),
    complianceMode: Boolean(raw.complianceMode),
  };
}

/** Sesiones sin el payload nuevo: se arma con los campos sueltos del login. */
export function legacySuspension({ blocked, reason, endsAt, canAppeal, complianceMode }) {
  if (!blocked) return null;
  const fin = texto(endsAt);
  return {
    blocked: true,
    kind: fin ? 'SUSPENSION' : 'BLOQUEO',
    level: fin ? 'TEMPORAL' : null,
    reason: texto(reason),
    startsAt: null,
    endsAt: fin,
    clockOffsetMs: 0,
    canAppeal: canAppeal !== false,
    reviewRequested: false,
    caseReference: null,
    complianceMode: Boolean(complianceMode),
  };
}

export function countdownFor(suspension, nowMs = Date.now()) {
  if (!suspension?.endsAt) return null;
  const end = new Date(suspension.endsAt).getTime();
  if (!Number.isFinite(end)) return null;
  const now = nowMs + (suspension.clockOffsetMs || 0);
  const diff = end - now;
  const start = suspension.startsAt ? new Date(suspension.startsAt).getTime() : NaN;
  const progress = Number.isFinite(start) && end > start
    ? Math.min(1, Math.max(0, (now - start) / (end - start)))
    : null;
  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, progress: 1 };
  const total = Math.floor(diff / 1000);
  return {
    expired: false,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    progress,
  };
}

export function shortRemaining(countdown) {
  if (!countdown || countdown.expired) return null;
  if (countdown.days > 0) return `${countdown.days} d ${countdown.hours} h`;
  if (countdown.hours > 0) return `${countdown.hours} h ${countdown.minutes} min`;
  return `${Math.max(1, countdown.minutes)} min`;
}

export function formatChileDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('es-CL', {
    timeZone: 'America/Santiago', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function suspensionTitle(suspension) {
  return suspension?.kind === 'SUSPENSION' ? 'Cuenta suspendida' : 'Cuenta bloqueada';
}

export function levelLabel(suspension) {
  switch (suspension?.level) {
    case 'TEMPORAL': return 'Temporal';
    case 'DEFINITIVA': return 'Indefinida';
    case 'FRAUDE': return 'En revisión';
    default: return suspension?.kind === 'SUSPENSION' ? 'Temporal' : 'Indefinida';
  }
}

/** Lo que cada perfil sigue pudiendo hacer (mismas reglas que el backend). */
export function allowedActions(role, suspension) {
  if (role === 'BUYER') {
    return ['Ver el estado de tus pedidos pagados', 'Confirmar la recepción de tus compras', 'Conversar con la tienda sobre un pedido'];
  }
  return suspension?.level === 'FRAUDE'
    ? ['Ver tus ventas y su estado', 'Responder a tus compradores', 'Ver tu saldo']
    : ['Despachar o entregar tus ventas pendientes', 'Responder a tus compradores', 'Retirar el saldo liberado'];
}

export function blockedActionsLine(role) {
  return role === 'BUYER'
    ? 'Mientras dure, no puedes comprar, cotizar, calificar ni abrir reclamos o mediaciones.'
    : 'Mientras dure, tu tienda no aparece en RepuesTop y no puedes publicar, cotizar ni editar tu catálogo.';
}
