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
 * El número público del pedido: el MISMO para comprador, tienda y soporte. NO es el id de la
 * tabla.
 *
 * O72 (pruebas de lanzamiento, 25-sep): un pedido llegaba a tener cuatro nombres ("#5" del
 * comprador, "Venta #000004" y "RTP-6-PED-000004" de la tienda, "PED-0000025" de soporte).
 * Desde ahora el backend manda un número de 10 dígitos (9 aleatorios + verificador Luhn):
 * `numeroPedido` sin espacios ("4827193605", para URL y búsquedas) y `numeroPedidoFormato`
 * agrupado 4-4-2 ("4827 1936 05"). Comprador y tienda lo ven igual, sin sufijo: el "-1"/"-2" de
 * un pedido de varias tiendas es solo del backoffice.
 *
 * `mode` se conserva por compatibilidad con quienes llaman: el número es el mismo para ambos.
 * Si un pedido viejo en caché no trae el número, se cae a los códigos antiguos para no
 * pintar la PK.
 */
export function orderDisplayCode(order, mode = 'buyer') {
  const formato = String(order?.numeroPedidoFormato || '').trim();
  if (formato) return formato;
  const compacto = String(order?.numeroPedido || '').trim();
  if (compacto) return formatOrderNumber(compacto);
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

export const ORDER_NUMBER_LENGTH = 10;

/** Dígito verificador Luhn de los 9 primeros dígitos (espejo de `NumeroPedido.java`). */
function luhnDigit(nineDigits) {
  let sum = 0;
  let double = true;
  for (let i = nineDigits.length - 1; i >= 0; i -= 1) {
    let d = Number(nineDigits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

/** `true` si el texto limpio es un número público válido: 10 dígitos, primero ≠ 0, Luhn ok. */
export function isPublicOrderNumber(value) {
  const numero = String(value ?? '').trim();
  if (!/^[1-9]\d{9}$/.test(numero)) return false;
  return luhnDigit(numero.slice(0, ORDER_NUMBER_LENGTH - 1)) === Number(numero[ORDER_NUMBER_LENGTH - 1]);
}

/**
 * Lo que escribió una persona ("4827 1936 05", "4827-1936-05-2", con espacios de más) llevado al
 * número limpio de 10 dígitos, o `''` si no es un número público válido. El sufijo de tienda
 * se descarta: identifica al pedido, no a la subórden.
 */
export function normalizeOrderNumber(value) {
  const limpio = String(value ?? '').trim().replace(/[\s.]/g, '');
  if (!limpio) return '';
  const match = limpio.match(/^([\d-]+?)(?:-(\d{1,2}))?$/);
  if (!match) return '';
  const digitos = match[1].replace(/-/g, '');
  if (isPublicOrderNumber(digitos)) return digitos;
  const todo = limpio.replace(/-/g, '');
  return isPublicOrderNumber(todo) ? todo : '';
}

/** "4827193605" -> "4827 1936 05"; "4827193605-2" -> "4827 1936 05-2". Otro texto se devuelve igual. */
export function formatOrderNumber(value) {
  const texto = String(value ?? '').trim();
  const match = texto.match(/^(\d{10})(-\d{1,2})?$/);
  if (!match) return texto;
  const n = match[1];
  return `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8)}${match[2] || ''}`;
}

/**
 * La referencia del pedido para una URL (`/perfil/pedidos/4827193605`): el número público sin
 * espacios ni sufijo. Si el pedido no lo trae (caché vieja), el id como último recurso para no
 * romper la navegación.
 */
export function orderNumberRef(order) {
  const compacto = String(order?.numeroPedido || '').trim();
  if (compacto) return compacto.split('-')[0];
  const formato = normalizeOrderNumber(order?.numeroPedidoFormato);
  if (formato) return formato;
  return order?.id != null ? String(order.id) : '';
}

/**
 * ¿Este pedido es el que nombra la referencia? Acepta el número público (con o sin espacios,
 * guiones o sufijo) y, para enlaces antiguos, el id de la tabla. Se usa contra la lista YA
 * cargada del propio usuario, así que un id no revela nada que no fuera suyo.
 */
export function orderMatchesRef(order, ref) {
  if (!order || ref == null || ref === '') return false;
  const numero = normalizeOrderNumber(ref);
  if (numero) return orderNumberRef(order) === numero;
  return String(order.id) === String(ref).trim();
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

// La clave real que manda el backend es "courier_por_pagar" (ver
// PedidoCheckoutCarritoSupport.java), no "shipping" -- esa clave nunca existio en la base de
// datos, asi que TODO pedido fuera de la comuna caia al generico "Despacho a coordinar" en vez
// de mostrar su metodo real.
const DELIVERY_LABELS = {
  // Mismo texto que el checkout: "Despacho a domicilio" no dice si es dentro o fuera de la
  // comuna, y el comprador lo confundia con el envio por pagar.
  local_delivery: 'Envío dentro de la comuna',
  store_pickup: 'Retiro en tienda',
  courier_por_pagar: 'Envío fuera de la comuna',
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
 * El metodo de ESTA tienda. Desde H8 cada subordén trae el suyo (`subordenes[].tipoEnvio`): en un
 * carrito de varias tiendas una puede despachar dentro de la comuna y otra fuera. Los pedidos
 * anteriores no lo traen y caen al del pedido.
 */
export function subOrderDeliveryMethod(subOrder, order) {
  return String(subOrder?.tipoEnvio || order?.tipoEnvio || '').trim().toLowerCase();
}

export function subOrderDeliveryLabel(subOrder, order) {
  return deliveryMethodLabel({ tipoEnvio: subOrderDeliveryMethod(subOrder, order) });
}

/**
 * Lo que el comprador eligio, tal cual lo eligio en el checkout. Con varias tiendas lista los
 * metodos distintos ("Envío dentro de la comuna · Envío fuera de la comuna") en vez de pintar
 * uno solo para todas. Nunca el courier: "Starken" dice quien lleva el paquete, no como se
 * compro.
 */
export function orderDeliverySummary(order) {
  const subOrders = Array.isArray(order?.subordenes) ? order.subordenes : [];
  if (subOrders.length > 1) {
    const labels = [...new Set(subOrders.map((sub) => subOrderDeliveryLabel(sub, order)))];
    return labels.join(' · ');
  }
  return deliveryMethodLabel(subOrders.length === 1 ? { tipoEnvio: subOrderDeliveryMethod(subOrders[0], order) } : order);
}

/**
 * El courier concreto, cuando el vendedor ya lo registró. Es informacion ADICIONAL al
 * metodo: van en campos distintos justamente porque "Despacho a domicilio" y "Chilexpress"
 * responden preguntas distintas.
 */
export function deliveryCourierLabel(order) {
  return String(order?.courier || order?.deliveryTerms || '').trim() || null;
}
