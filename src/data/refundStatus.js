// O56/O57 (pruebas de lanzamiento, 25-sep): estado de la devolucion por Flow que ve el
// comprador. Vive en su propio archivo, como cancellationReason.js, porque lo leen el
// detalle del pedido y el dialogo de cancelacion.
//
// Flow no devuelve la plata solo: le manda al comprador un correo (info@flow.cl) para
// ACEPTAR la devolucion, con una clave y una fecha limite. Si no lo acepta, la plata no
// vuelve. Por eso el aviso se repite en todos los lugares donde el comprador cancela o ve
// una devolucion en curso.

export const FLOW_REFUND_NOTICE =
  'Te llegará un correo de Flow (info@flow.cl) para recibir tu devolución: ábrelo y acéptalo antes de la fecha límite. '
  + 'Si pagaste con tarjeta, la devolución se refleja en hasta 10 días hábiles.';

// `estadoReembolso` (backend, O56) viene simplificado: SOLICITADO / REEMBOLSADO / RECHAZADO /
// ERROR. Un backend anterior solo manda `refundStatus` con el vocabulario interno del pago.
const LEGACY_REFUND_STATUS = {
  REEMBOLSO_SOLICITADO: 'SOLICITADO',
  REEMBOLSO_ACEPTADO: 'ACEPTADO',
  REEMBOLSADO: 'REEMBOLSADO',
  REEMBOLSO_RECHAZADO: 'RECHAZADO',
  REEMBOLSO_ERROR: 'ERROR',
};

export function refundState(order) {
  const simple = String(order?.estadoReembolso || '').toUpperCase();
  if (simple) return simple;
  return LEGACY_REFUND_STATUS[String(order?.refundStatus || '').toUpperCase()] || null;
}

/**
 * Lo que el comprador tiene que saber de su devolucion, o null si no hay ninguna.
 * `tone` elige el color: pending (ambar), ok (verde), error (rojo).
 */
export function buyerRefundInfo(order) {
  const supportCode = order?.codigoSoporte ? ` indicando el pedido ${order.codigoSoporte}` : '';
  switch (refundState(order)) {
    case 'SOLICITADO':
      return {
        tone: 'pending',
        title: 'Devolución solicitada — acepta el correo de Flow',
        detail: FLOW_REFUND_NOTICE,
      };
    // O57: tras aceptar el correo, Flow informa "accepted" hasta ejecutar la devolucion.
    case 'ACEPTADO':
      return {
        tone: 'ok',
        title: 'Devolución aceptada — se refleja en tu tarjeta en hasta 10 días hábiles',
        detail: 'Aceptaste la devolución en Flow; se hace en el mismo medio de pago que usaste al comprar.',
      };
    case 'REEMBOLSADO':
      return {
        tone: 'ok',
        title: 'Devolución realizada',
        detail: 'Flow ya procesó tu devolución en el mismo medio de pago que usaste al comprar; su reflejo depende de tu banco.',
      };
    case 'RECHAZADO':
      return {
        tone: 'error',
        title: 'Devolución rechazada o vencida — contáctanos',
        detail: `El correo de Flow se rechazó o venció su plazo, así que la devolución no se hizo. Escríbenos desde Ayuda${supportCode} y la coordinamos contigo.`,
      };
    case 'ERROR':
      return {
        tone: 'pending',
        title: 'Devolución en revisión con nuestro equipo',
        detail: `No pudimos solicitarla automáticamente; la estamos gestionando. Si tienes dudas, escríbenos desde Ayuda${supportCode}.`,
      };
    default:
      return null;
  }
}
