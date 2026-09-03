/**
 * Los plazos con los que el backend cierra un pedido SOLO.
 *
 * Desde `PedidoAutoCierreJob` un pedido ya no depende de que el comprador pulse nada: si no
 * confirma la recepcion, a los 10 dias se da por recibido; y 72 horas despues de quedar
 * entregado la venta se cierra y el saldo del vendedor queda disponible. Sin esto la plata se
 * quedaba congelada para siempre, porque no habia ningun camino a FINALIZADO que no fuera un
 * clic manual.
 *
 * **Estos numeros son un ESPEJO** de `repuestop.pedido.autorecepcion.dias` y
 * `repuestop.pedido.autofinalizacion.dias` del `application.properties` del backend, que es
 * quien manda: el job compara contra sus propios valores y no los expone por API. Igual que
 * `PAYMENT_WINDOW_MINUTES` en [orderStatusFlow.js](./orderStatusFlow.js). Si alla se cambian,
 * aca se miente; lo correcto de fondo es que el backend los publique en el DTO del pedido.
 *
 * El reloj de cada regla es distinto y NO son intercambiables:
 * - la auto-recepcion corre desde `updatedAt` de la subordén (cuando se despacho);
 * - la auto-finalizacion corre desde `entregadoAt`, que se escribe UNA vez al entrar a
 *   ENTREGADO. Sobre `updatedAt` el contador mentiria, porque cualquier escritura a la fila
 *   -- registrar el tracking, corregir el envio -- lo reinicia.
 */

export const AUTO_RECEPTION_DAYS = 10;
export const AUTO_FINALIZATION_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function remainingLabel(ms) {
  if (ms <= 0) return null;
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours <= 48) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.ceil(hours / 24);
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}

function toTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) && time > 0 ? time : null;
}

/**
 * Que le va a pasar solo a esta tienda del pedido, y cuando.
 *
 * Recibe el estado y los dos relojes de UNA subordén -- nunca los del pedido, que en un
 * carrito de dos tiendas son los de la que va mas atrasada.
 *
 * Devuelve `null` cuando no hay nada que anunciar: un estado que el job no mira, un retiro en
 * tienda (queda excluido de la auto-recepcion a proposito, porque ahi el PIN es la unica
 * prueba de entrega) o una fecha ausente.
 *
 * @returns {{kind: 'reception'|'finalization', label: string, detail: string, urgent: boolean}|null}
 */
export function storeAutoCloseNotice({ estado, updatedAt, entregadoAt, isStorePickup } = {}, now = Date.now()) {
  const status = String(estado || '').toUpperCase();

  if (status === 'ENVIADO') {
    if (isStorePickup) return null;
    const shippedAt = toTime(updatedAt);
    if (!shippedAt) return null;
    const remaining = shippedAt + AUTO_RECEPTION_DAYS * DAY_MS - now;
    const left = remainingLabel(remaining);
    return {
      kind: 'reception',
      label: left
        ? `Daremos por recibido en ${left}`
        : 'Lo daremos por recibido en las próximas horas',
      detail: '¿Ya llegó? Confírmalo. Si hay algún problema, abre un reclamo antes de que venza el plazo.',
      urgent: remaining <= 2 * DAY_MS,
    };
  }

  if (status === 'ENTREGADO') {
    // Sin `entregadoAt` no se anuncia nada: son las subordenes historicas que la migracion
    // V2026090201 no alcanzo a sellar. Inventar el plazo sobre `updatedAt` daria una fecha
    // que el servidor no va a respetar.
    const deliveredAt = toTime(entregadoAt);
    if (!deliveredAt) return null;
    const remaining = deliveredAt + AUTO_FINALIZATION_DAYS * DAY_MS - now;
    const left = remainingLabel(remaining);
    return {
      kind: 'finalization',
      label: left
        ? `Se cierra en ${left}`
        : 'Se cierra en las próximas horas',
      detail: 'Revisa que los repuestos calcen. Después del cierre ya no podrás abrir un reclamo.',
      urgent: remaining <= DAY_MS,
    };
  }

  return null;
}
