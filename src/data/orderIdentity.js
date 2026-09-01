/**
 * Cómo se nombra y se cuenta un pedido en pantalla.
 *
 * Vive aparte de `orderStatusFlow.js` porque son dos cosas distintas: allá está QUÉ puede
 * hacer cada rol con el pedido, acá CÓMO se le muestra. Las dos las usan `OrderCard` y
 * `OrderDetailModal`, que son las que estaban duplicando la lógica.
 */

/**
 * Estados de ítem que significan "esta línea ya no va".
 *
 * ESPEJO de `PedidoService.ITEM_ESTADO_*` del backend y de `CANCELLED_ITEM_STATUSES` del
 * móvil. Estaba copiado literal en `OrderCard` y en `OrderDetailModal`; si las copias se
 * separan, una vista tacha el ítem y la otra lo cuenta como vivo.
 *
 * Se incluyen `CANCELADO` y `CANCELLED` a secas porque hay filas históricas con esos
 * valores, anteriores a que el backend distinguiera quién canceló.
 */
export const CANCELLED_ITEM_STATUSES = [
  'CANCELADO_BLOQUEO_VENDEDOR',
  'CANCELADO_VENDEDOR',
  'CANCELADO_EXPIRACION_PAGO',
  'CANCELADO_COMPRADOR',
  'CANCELADO',
  'CANCELLED',
];

export function isCancelledItem(item) {
  return CANCELLED_ITEM_STATUSES.includes(String(item?.estado || item?.status || '').toUpperCase());
}

export function orderItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

/** Las líneas que siguen en pie. Es lo que el vendedor tiene que preparar. */
export function activeOrderItems(order) {
  return orderItems(order).filter((item) => !isCancelledItem(item));
}

/**
 * El número que ve cada rol. NO es el id de la tabla.
 *
 * Mostrar `pedido.id` tenía dos problemas: al comprador no le dice nada ("Pedido #21" no es
 * su vigésimo primer pedido, es la fila 21 de la tabla), y es enumerable — un vendedor que
 * ve "#21" sabe cuántos pedidos lleva el marketplace entero.
 *
 * El backend ya trae los dos números correctos y nadie los usaba:
 *
 *  - `numeroPedidoComprador`: secuencia POR COMPRADOR (1, 2, 3...). Es la que el comprador
 *    entiende como "mi tercer pedido". La app ya la usa (`getOrderDisplayCode`).
 *  - `items[].codigoVendedor`: secuencia POR VENDEDOR (`RTP-1-PED-000017`). Del número del
 *    comprador no sirve para el vendedor, porque dos clientes distintos tienen ambos su
 *    "pedido #1".
 *
 * Del código del vendedor se muestra solo la cola: el prefijo lleva el id del proveedor y
 * existe para garantizar unicidad en la base, no para leerse.
 */
export function orderDisplayCode(order, mode = 'buyer') {
  if (mode === 'buyer') {
    const numero = Number(order?.numeroPedidoComprador ?? order?.buyerOrderNumber ?? 0);
    if (Number.isFinite(numero) && numero > 0) return `#${numero}`;
  } else {
    const codigo = orderItems(order)
      .map((item) => String(item?.codigoVendedor || '').trim())
      .find(Boolean);
    const cola = sellerCodeShort(codigo);
    if (cola) return cola;
  }
  return `#${String(order?.id ?? '').slice(-6).toUpperCase()}`;
}

/**
 * La cola de un `codigoVendedor` (`RTP-1-PED-000020` -> `#000020`), lista para pintar.
 *
 * Vive aparte porque el codigo del vendedor no llega siempre dentro de un pedido: el panel
 * de retiros lo recibe suelto, en `codigoExterno`. Ahi mostraba el id crudo del pedido
 * ("Pedido #24"), que no es ninguno de los numeros que el vendedor conoce. Y la regla del
 * prefijo -que lleva el id del proveedor y existe para la unicidad en la base, no para
 * leerse- debe estar escrita UNA vez: en el backend estuvo repetida en siete sitios.
 */
export function sellerCodeShort(codigoVendedor) {
  const codigo = String(codigoVendedor || '').trim();
  if (!codigo) return '';
  const cola = codigo.split('-').pop();
  return cola ? `#${cola}` : '';
}

const DELIVERY_LABELS = {
  local_delivery: 'Despacho a domicilio',
  store_pickup: 'Retiro en tienda',
  shipping: 'Envío por courier',
};

/**
 * Etiqueta legible del método de envío.
 *
 * `tipoEnvio` es un valor del backend (`local_delivery`) y se estaba pintando crudo en la
 * ficha del pedido. Si aparece un valor nuevo sin traducción se prefiere una frase genérica
 * antes que mostrar el identificador: el comprador no tiene por qué leer nombres de campo.
 */
export function deliveryMethodLabel(order) {
  const tipo = String(order?.tipoEnvio || '').trim().toLowerCase();
  return DELIVERY_LABELS[tipo] || 'Despacho a coordinar';
}

/**
 * El courier concreto, cuando el vendedor ya lo registró. Es informacion ADICIONAL al
 * metodo: van en campos distintos justamente porque "Despacho a domicilio" y "Chilexpress"
 * responden preguntas distintas.
 */
export function deliveryCourierLabel(order) {
  return String(order?.courier || order?.deliveryTerms || '').trim() || null;
}
