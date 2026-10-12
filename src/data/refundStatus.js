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
  // H59: la devolucion ya se decidio y se pide a Flow en unos minutos.
  REEMBOLSO_POR_SOLICITAR: 'EN_PROCESO',
  REEMBOLSO_SOLICITANDO: 'EN_PROCESO',
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
    case 'EN_PROCESO':
      return {
        tone: 'pending',
        title: 'Devolución en proceso',
        detail: 'Estamos solicitando tu devolución a Flow. En unos minutos te llegará un correo de Flow para aceptarla.',
      };
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

// ---- 12-oct: devoluciones del pedido una a una, con su linea de tiempo ----
// Misma regla que `utils/refund-status.ts` de la app.

/**
 * Las devoluciones que sigue el comprador (`reembolsos` del backend). Un backend anterior no
 * manda la lista: se arma una sola con el estado simple del pedido.
 */
export function buyerRefunds(order) {
  const list = Array.isArray(order?.reembolsos) ? order.reembolsos : [];
  if (list.length > 0) {
    return list.map((r) => ({
      id: String(r.id ?? ''),
      origin: String(r.origen || 'OTRO').toUpperCase(),
      sellerId: r.proveedorId != null ? String(r.proveedorId) : null,
      amount: Number(r.monto || 0),
      state: String(r.estado || '').toUpperCase(),
      requestedAt: r.solicitadoAt || null,
      manual: r.manual === true,
      manualAt: r.manualAt || null,
    }));
  }
  const state = refundState(order);
  if (!state) return [];
  return [{ id: 'pedido', origin: 'OTRO', sellerId: null, amount: Number(order?.montoReembolsado || 0), state, requestedAt: null, manual: false, manualAt: null }];
}

/** Solo las que siguen en curso: las devueltas ya no alertan. */
export function activeBuyerRefunds(order) {
  return buyerRefunds(order).filter((refund) => refundStateChip(refund).tone !== 'ok');
}

export function refundOriginLabel(origin) {
  switch (origin) {
    case 'CANCELACION_COMPRADOR': return 'Cancelaste la compra';
    case 'CANCELACION_VENDEDOR': return 'La tienda canceló la venta';
    case 'BLOQUEO_TIENDA': return 'La tienda fue suspendida';
    case 'PAGO_TARDIO': return 'Pago recibido sin stock disponible';
    case 'MEDIACION': return 'Resolución de la mediación';
    default: return 'Devolución del pedido';
  }
}

export function refundStateChip(refund) {
  switch (refund.state) {
    case 'REEMBOLSADO': return { label: refund.manual ? 'Devuelta por soporte' : 'Devuelta', tone: 'ok' };
    case 'ACEPTADO': return { label: 'Aceptada en Flow', tone: 'pending' };
    case 'SOLICITADO': return { label: 'Acepta el correo de Flow', tone: 'pending' };
    case 'RECHAZADO': return { label: 'Rechazada o vencida', tone: 'error' };
    case 'ERROR': return { label: 'En revisión', tone: 'error' };
    default: return { label: 'En proceso', tone: 'pending' };
  }
}

/**
 * Los pasos de una devolucion por Flow: aprobada, solicitada, correo aceptado, procesada,
 * devuelta. `status`: done | current | upcoming | error.
 */
export function refundTimeline(refund, supportCode) {
  const support = supportCode ? ` indicando el pedido ${supportCode}` : '';
  const decided = { key: 'decided', title: 'Devolución aprobada', detail: refundOriginLabel(refund.origin), date: refund.requestedAt, status: 'done' };

  if (refund.manual && refund.state === 'REEMBOLSADO') {
    return [
      decided,
      { key: 'support', title: 'Gestionada por soporte', detail: 'Flow no pudo completarla y soporte de RepuesTop la realizó directamente.', status: 'done' },
      { key: 'refunded', title: 'Dinero devuelto', detail: 'Revisa tu cuenta o medio de pago; el reflejo depende de tu banco.', date: refund.manualAt, status: 'done' },
    ];
  }

  const order = ['EN_PROCESO', 'SOLICITADO', 'ACEPTADO', 'REEMBOLSADO'];
  const reached = order.indexOf(refund.state);
  const at = (index) => (reached > index ? 'done' : reached === index ? 'current' : 'upcoming');

  const requested = refund.state === 'ERROR'
    ? { key: 'requested', title: 'Solicitud a Flow', detail: `No pudimos solicitarla automáticamente y soporte la está gestionando. Si tienes dudas, escríbenos desde Ayuda${support}.`, status: 'error' }
    : { key: 'requested', title: 'Solicitada a Flow', detail: at(0) === 'current' ? 'Estamos pidiendo la devolución a Flow. En unos minutos te llegará su correo.' : 'RepuesTop pidió la devolución a Flow.', status: at(0) === 'current' ? 'current' : reached > 0 || refund.state === 'RECHAZADO' ? 'done' : 'upcoming' };

  const email = refund.state === 'RECHAZADO'
    ? { key: 'email', title: 'Correo de Flow', detail: `El correo se rechazó o venció su plazo, así que la devolución no se hizo. Escríbenos desde Ayuda${support} y la coordinamos contigo.`, status: 'error' }
    : {
      key: 'email',
      title: 'Acepta el correo de Flow',
      detail: at(1) === 'done'
        ? 'Aceptaste la devolución en el correo de Flow.'
        : 'Te llega un correo de info@flow.cl con una clave y una fecha límite: ábrelo y acepta la devolución. Si no lo ves, revisa spam o promociones.',
      status: refund.state === 'ERROR' ? 'upcoming' : at(1),
    };

  const processing = {
    key: 'processing',
    title: 'Flow procesa la devolución',
    detail: 'Se devuelve en el mismo medio de pago que usaste. Con tarjeta se refleja en hasta 10 días hábiles.',
    status: refund.state === 'RECHAZADO' || refund.state === 'ERROR' ? 'upcoming' : at(2),
  };

  const done = {
    key: 'refunded',
    title: 'Dinero devuelto',
    detail: refund.state === 'REEMBOLSADO' ? 'Flow completó la devolución; su reflejo depende de tu banco.' : undefined,
    status: refund.state === 'REEMBOLSADO' ? 'done' : 'upcoming',
  };

  return [decided, requested, email, processing, done];
}

/**
 * Si la venta pudo generar un reembolso que pida nota de credito. Solo decide si se ofrece el
 * boton sin pedir las notas de cada tarjeta: el popup carga las reales y, si no hay, lo dice.
 */
export function saleMayNeedCreditNote(order) {
  return Number(order?.montoReembolsado || order?.refundedAmount || 0) > 0
    || Boolean(order?.refundStatus) || Boolean(order?.estadoReembolso);
}
