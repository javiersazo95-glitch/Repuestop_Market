// Etiquetas de MotivoCancelacionPedido y OrigenCancelacionPedido, los enums
// reales del backend (backend/.../model/MotivoCancelacionPedido.java). Vive en
// su propio archivo, como mediationStatus.js, porque lo leen la tarjeta del
// pedido y el detalle.
//
// El backend guarda el CODIGO y cada cliente arma su texto: antes persistia la
// etiqueta ya renderizada y eso impedia filtrar por causa en el backoffice y
// cambiar la frase sin reescribir el pasado. Un valor inventado aca no falla,
// simplemente no encuentra etiqueta: por eso el fallback existe.
export const CANCELLATION_REASON_LABELS = {
  EXPIRACION_PAGO: 'No se completó el pago a tiempo',
  SIN_STOCK: 'Sin stock',
  ERROR_PRECIO: 'Error de precio',
  PRODUCTO_NO_DISPONIBLE: 'Producto no disponible',
  IMPOSIBILIDAD_DESPACHO: 'Imposibilidad de despacho',
  BLOQUEO_VENDEDOR: 'La tienda no está disponible',
  OTRO: 'Otro motivo',
};

// Explicacion para el comprador, que es distinta de la etiqueta: dice que pasa
// ahora, no solo que ocurrio. Solo se escriben las que tienen algo que agregar.
export const CANCELLATION_REASON_HINTS = {
  EXPIRACION_PAGO: 'Venció el plazo de pago y la unidad volvió al stock. Puedes volver a comprarla.',
  SIN_STOCK: 'La tienda se quedó sin unidades. Si pagaste, el reembolso ya está en curso.',
  BLOQUEO_VENDEDOR: 'Cancelamos el pedido para protegerte. Si pagaste, el reembolso ya está en curso.',
};

/**
 * Texto del motivo. `OTRO` usa el detalle libre que escribio el vendedor, que es
 * el unico caso donde el backend acepta texto suelto.
 *
 * Devuelve null cuando no hay motivo: los pedidos cancelados antes de que el
 * backend registrara la causa quedan asi a proposito, y la UI debe mostrar
 * "Cancelado" a secas en vez de inventar una explicacion.
 */
export function cancellationReasonLabel(order) {
  const code = order?.motivoCancelacion;
  if (!code) return null;
  if (code === 'OTRO') return order.detalleCancelacion || CANCELLATION_REASON_LABELS.OTRO;
  return CANCELLATION_REASON_LABELS[code] || null;
}

export function cancellationReasonHint(order) {
  const code = order?.motivoCancelacion;
  return code ? CANCELLATION_REASON_HINTS[code] || null : null;
}
