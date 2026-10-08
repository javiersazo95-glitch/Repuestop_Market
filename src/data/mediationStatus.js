// Etiquetas de EstadoMediacion, el enum real del backend
// (backend/.../model/enums/EstadoMediacion.java). Ya no existe la etapa "En
// disputa": una Mediacion solo se crea cuando alguien solicita un mediador, así
// que todas nacen en EN_MEDIACION. El chat previo comprador-vendedor es solo una
// conversación, sin fila de mediación.
export const MEDIATION_STATUS_LABELS = {
  EN_MEDIACION: 'En mediación',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
};

// Tono del sello de estado del expediente.
//   mediation -> intervino un mediador de RepuesTop (violeta, igual que el badge del pedido)
//   done      -> caso cerrado (verde)
export const MEDIATION_STATUS_TONES = {
  EN_MEDIACION: 'mediation',
  RESUELTA: 'done',
  CERRADA: 'done',
};

const ZONA_CHILE = 'America/Santiago';
const DIAS_PLAZO_MEDIADOR = 10;

// Fecha civil (YYYY-MM-DD) de un instante en hora de Chile.
function fechaCivilChile(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CHILE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Desfase (minutos) de Chile respecto de UTC en un instante dado (UTC-3 en verano, UTC-4 en invierno).
function offsetChileMinutos(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_CHILE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * Fin del plazo para pedir un mediador: fin del dia 10 corrido (O68) en hora de Chile, contando el
 * dia 1 como el siguiente a la recepcion. Misma cuenta que `MediacionChatService.limiteMediadorDesde`
 * y que `fechaLimiteMediador` en la app.
 */
export function fechaLimiteMediador(recibidoAt) {
  const [y, m, d] = fechaCivilChile(recibidoAt).split('-').map(Number);
  const ultimoDiaUtc = Date.UTC(y, m - 1, d + DIAS_PLAZO_MEDIADOR, 23, 59, 59, 999);
  // Primera aproximacion con el desfase del instante recibido; se corrige con el del propio limite
  // (cambio de horario de verano entre medio).
  let limite = new Date(ultimoDiaUtc - offsetChileMinutos(recibidoAt) * 60000);
  limite = new Date(ultimoDiaUtc - offsetChileMinutos(limite) * 60000);
  return limite;
}

/**
 * Respaldo del selector de chats cuando el pedido aun no tiene chat (el backend manda
 * `mediadorDisponible` solo en los chats ya creados): si hoy se puede pedir mediador y hasta cuando.
 */
export function mediatorWindowForOrder(order, now = new Date()) {
  const received = order?.entregadoAt
    ?? (Array.isArray(order?.subordenes) ? order.subordenes.map((s) => s?.entregadoAt).filter(Boolean).sort().pop() : null)
    ?? null;
  if (!received) return { available: false, limit: null };
  const receivedAt = new Date(received);
  if (Number.isNaN(receivedAt.getTime())) return { available: false, limit: null };
  const limit = fechaLimiteMediador(receivedAt);
  return { available: now.getTime() <= limit.getTime(), limit: limit.toISOString() };
}
