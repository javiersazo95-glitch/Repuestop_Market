// Etiquetas de MotivoCancelacionPedido y OrigenCancelacionPedido, los enums
// reales del backend (backend/.../model/MotivoCancelacionPedido.java). Vive en
// su propio archivo, como mediationStatus.js, porque lo leen la tarjeta del
// pedido y el detalle.
//
// El backend guarda el CODIGO y cada cliente arma su texto: antes persistia la
// etiqueta ya renderizada y eso impedia filtrar por causa en el backoffice y
// cambiar la frase sin reescribir el pasado. Un valor inventado aca no falla,
// simplemente no encuentra etiqueta: por eso el fallback existe.
import { remoteConfig } from '../remoteConfig/remoteConfig';

// Mantenedor comun (2026-10-20): `MOTIVO_CANCELACION_PEDIDO` es lista de sistema; el dueno puede
// cambiar la etiqueta (y la descripcion, que aca se usa como explicacion al comprador). Los textos
// de abajo son el respaldo y cubren tambien los motivos que el dueno oculte: un pedido viejo
// cancelado con ese motivo tiene que seguir leyendose.
export const CANCELLATION_REASON_LABELS_FALLBACK = {
  EXPIRACION_PAGO: 'No se completó el pago a tiempo',
  // SEC-BACKEND-077 (pruebas de lanzamiento, 25-sep): el pago llegó después del plazo y la unidad
  // ya se había vendido; el backend pide el reembolso íntegro automáticamente.
  PAGO_TARDIO_SIN_STOCK: 'El pago llegó después del plazo y ya no había stock',
  SIN_STOCK: 'Sin stock',
  ERROR_PRECIO: 'Error de precio',
  PRODUCTO_NO_DISPONIBLE: 'Producto no disponible',
  IMPOSIBILIDAD_DESPACHO: 'Imposibilidad de despacho',
  INCOMPATIBLE_VEHICULO: 'Incompatible con el vehículo',
  BLOQUEO_VENDEDOR: 'La tienda no está disponible',
  SOLICITUD_DEL_COMPRADOR: 'Cancelado por el comprador',
  OTRO: 'Otro motivo',
};

// El comprador viendo su propio pedido merece la version en primera persona; el
// vendedor necesita saber que fue el comprador quien lo cancelo. Mismo codigo, dos
// lecturas.
const BUYER_FIRST_PERSON_LABELS = {
  SOLICITUD_DEL_COMPRADOR: 'Cancelaste este pedido',
};

// Explicacion para el comprador, que es distinta de la etiqueta: dice que pasa
// ahora, no solo que ocurrio. Solo se escriben las que tienen algo que agregar.
export const CANCELLATION_REASON_HINTS_FALLBACK = {
  EXPIRACION_PAGO: 'Venció el plazo de pago y la unidad volvió al stock. Puedes volver a comprarla.',
  PAGO_TARDIO_SIN_STOCK: 'Tu pago llegó cuando el plazo ya había vencido y la unidad se había vendido. Te devolvemos todo lo que pagaste: te llegará un correo de Flow para aceptar la devolución.',
  SOLICITUD_DEL_COMPRADOR: 'La unidad volvió al stock. Puedes comprarla de nuevo cuando quieras.',
  SIN_STOCK: 'La tienda se quedó sin unidades. Si pagaste, el reembolso ya está en curso.',
  BLOQUEO_VENDEDOR: 'Cancelamos el pedido para protegerte. Si pagaste, el reembolso ya está en curso.',
  // Espejo de `mobile/utils/cancellation-reason.ts`. Sin estas tres, el comprador se quedaba con la
  // etiqueta del formulario del vendedor ("Imposibilidad de despacho") y ninguna explicacion.
  IMPOSIBILIDAD_DESPACHO: 'La tienda no pudo despachar tu pedido. Si pagaste, el reembolso ya está en curso.',
  PRODUCTO_NO_DISPONIBLE: 'La tienda ya no tiene disponible este repuesto. Si pagaste, el reembolso ya está en curso.',
  ERROR_PRECIO: 'La tienda detectó un error en el precio publicado. Si pagaste, el reembolso ya está en curso.',
  INCOMPATIBLE_VEHICULO: 'La tienda revisó que el repuesto no le sirve al vehículo que indicaste. Si pagaste, el reembolso ya está en curso.',
};

/**
 * Texto del motivo. `OTRO` usa el detalle libre que escribio el vendedor, que es
 * el unico caso donde el backend acepta texto suelto.
 *
 * Devuelve null cuando no hay motivo: los pedidos cancelados antes de que el
 * backend registrara la causa quedan asi a proposito, y la UI debe mostrar
 * "Cancelado" a secas en vez de inventar una explicacion.
 */
export function cancellationReasonLabel(order, mode = 'buyer') {
  const code = order?.motivoCancelacion;
  if (!code) return null;
  const remote = remoteReason(code);
  if (code === 'OTRO') return order.detalleCancelacion || remote?.etiqueta || CANCELLATION_REASON_LABELS_FALLBACK.OTRO;
  if (mode === 'buyer' && BUYER_FIRST_PERSON_LABELS[code]) return BUYER_FIRST_PERSON_LABELS[code];
  return remote?.etiqueta || CANCELLATION_REASON_LABELS_FALLBACK[code] || null;
}

export function cancellationReasonHint(order) {
  const code = order?.motivoCancelacion;
  if (!code) return null;
  return remoteReason(code)?.descripcion || CANCELLATION_REASON_HINTS_FALLBACK[code] || null;
}

/** Opcion de la lista del mantenedor para un codigo, o null (sin bootstrap o motivo oculto). */
function remoteReason(code) {
  const opciones = remoteConfig.lista('MOTIVO_CANCELACION_PEDIDO', null);
  return opciones?.find((opcion) => opcion?.valor === code) || null;
}
