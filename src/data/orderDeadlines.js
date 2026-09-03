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
 * - la auto-recepcion corre desde `updatedAt` de la subordén (cuando se despacho), con un
 *   plazo que SI distingue por modalidad -local vs. courier nacional, ver `AUTO_RECEPTION_DAYS`
 *   y `AUTO_RECEPTION_LOCAL_DAYS`-;
 * - la auto-finalizacion corre desde `entregadoAt`, que se escribe UNA vez al entrar a
 *   ENTREGADO. Sobre `updatedAt` el contador mentiria, porque cualquier escritura a la fila
 *   -- registrar el tracking, corregir el envio -- lo reinicia. Este plazo SI es unico, no
 *   distingue por modalidad;
 * - la ventana de veto corre desde `entregaDeclaradaAt`, que solo existe cuando el VENDEDOR
 *   reporto la entrega (Uber Flash, Didi, un courier) y esta pendiente de que el comprador la
 *   confirme o la vete. Manda sobre la auto-recepcion mientras este pendiente:
 *   `PedidoAutoCierreJob` confirma esa subordén sola apenas vence, sin esperar el plazo largo.
 *
 * **Ojo con carritos de varias tiendas con modalidades distintas**: `tipoEnvio` es columna del
 * PEDIDO, no de la subordén, y el checkout la deriva colapsando el carrito entero. El plazo de
 * auto-recepcion local podria aplicarsele por error a una tienda que en realidad despacha por
 * courier. Limitacion conocida y aceptada; corregirla de fondo exige mover `tipoEnvio` a la
 * subordén (ver `HANDOFF_PROXIMO_AGENTE.md`).
 */

export const AUTO_RECEPTION_DAYS = 10;
/**
 * Dias en ENVIADO antes de dar por recibida una subordén DENTRO de la comuna (delivery
 * propio, Uber, Didi, PedidosYa). Mucho mas corto que `AUTO_RECEPTION_DAYS`: un despacho
 * local suele ser el mismo dia, y esperar el plazo de un courier nacional dejaba al
 * comprador sin avisos sobre un pedido que ya habia llegado.
 */
export const AUTO_RECEPTION_LOCAL_DAYS = 2;
export const AUTO_FINALIZATION_DAYS = 3;
export const DELIVERY_VETO_WINDOW_HOURS = 48;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

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
 * tienda (queda excluido de la auto-recepcion y de la ventana de veto a proposito, porque ahi
 * el PIN es la unica prueba de entrega) o una fecha ausente.
 *
 * `kind: 'delivery_veto'` es distinto a los otros dos: no es solo informativo, es el momento
 * en que la pantalla tiene que ofrecer los botones "Sí, la recibí" / "No la he recibido" -- el
 * vendedor ya dijo que la entrego y el comprador tiene que responder, no solo mirar un plazo.
 *
 * @returns {{kind: 'reception'|'finalization'|'delivery_veto', label: string, detail: string, urgent: boolean}|null}
 */
export function storeAutoCloseNotice(
  { estado, updatedAt, entregadoAt, entregaDeclaradaAt, isStorePickup, isLocalDelivery } = {},
  now = Date.now(),
) {
  const status = String(estado || '').toUpperCase();

  if (status === 'ENVIADO') {
    if (isStorePickup) return null;

    // El vendedor ya declaro la entrega: el plazo real es la ventana de veto (horas), no la
    // auto-recepcion por defecto (dias). Manda sobre ella mientras siga pendiente.
    const declaredAt = toTime(entregaDeclaradaAt);
    if (declaredAt) {
      const remaining = declaredAt + DELIVERY_VETO_WINDOW_HOURS * HOUR_MS - now;
      const left = remainingLabel(remaining);
      return {
        kind: 'delivery_veto',
        label: left ? `Responde en ${left}` : 'Lo confirmaremos en las próximas horas',
        detail: 'Tu vendedor reportó que este pedido ya fue entregado. Si lo recibiste, confírmalo; si no, avísanos antes de que venza el plazo.',
        urgent: remaining <= 12 * HOUR_MS,
      };
    }

    const shippedAt = toTime(updatedAt);
    if (!shippedAt) return null;
    // El plazo depende de la modalidad: un despacho dentro de la comuna suele ser el mismo
    // dia, asi que anunciarle al comprador "10 días" -el plazo pensado para un courier
    // nacional- es confuso y esta mal.
    const windowDays = isLocalDelivery ? AUTO_RECEPTION_LOCAL_DAYS : AUTO_RECEPTION_DAYS;
    const remaining = shippedAt + windowDays * DAY_MS - now;
    const left = remainingLabel(remaining);
    return {
      kind: 'reception',
      label: left
        ? `Daremos por recibido en ${left}`
        : 'Lo daremos por recibido en las próximas horas',
      detail: '¿Ya llegó? Confírmalo. Si hay algún problema, abre un reclamo antes de que venza el plazo.',
      // El umbral de "urgente" tambien se achica para el plazo corto: con la ventana local de
      // 2 dias, "quedan 2 dias" es el estado inicial entero, no una alerta.
      urgent: remaining <= (isLocalDelivery ? 12 * HOUR_MS : 2 * DAY_MS),
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
