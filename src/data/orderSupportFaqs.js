/**
 * 12-oct: preguntas y respuestas de Soporte segun el ESTADO del pedido desde el que se abre.
 * Paridad con `utils/order-support-faqs.ts` de la app.
 *
 * Antes el detalle cargaba avisos de plazo ("Se cierra en 3 dias", "Puedes retractarte por 10
 * dias", "Daremos por recibido en...") en el bloque de cada tienda. Ahora son respuestas aqui,
 * calculadas con los mismos relojes (`orderDeadlines`), y cada estado trae sus dudas tipicas.
 *
 * Devuelve `{ statusLabel, storeName, faqs: [{ q, a }] }` (el formato de `HelpFaqAccordion`).
 */
import { cancellationReasonHint, cancellationReasonLabel } from './cancellationReason';
import {
  fundsReleaseNotice,
  orderDeadlineParams,
  retractionNotice,
  storeAutoCloseNotice,
} from './orderDeadlines';
import { isStorePickupOrder, orderPaymentWindow } from './orderStatusFlow';
import { activeBuyerRefunds, FLOW_REFUND_NOTICE } from './refundStatus';

const STATUS_LABELS = {
  PENDIENTE: 'Pendiente de pago',
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparación',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Recibido',
  FINALIZADO: 'Finalizado',
  EN_MEDIACION: 'En mediación',
  CANCELADO: 'Cancelado',
};

const faq = (q, a) => ({ q, a });

/** La tienda de la que se habla: la elegida, o la unica del pedido. */
function pickStore(order, proveedorId) {
  const subs = Array.isArray(order?.subordenes) ? order.subordenes : [];
  if (proveedorId != null) return subs.find((sub) => String(sub?.proveedorId) === String(proveedorId)) || null;
  return subs.length === 1 ? subs[0] : null;
}

function withinWarranty(entregadoAt, now) {
  const t = entregadoAt ? new Date(entregadoAt).getTime() : NaN;
  if (!Number.isFinite(t)) return true;
  const limite = new Date(t);
  limite.setMonth(limite.getMonth() + 6);
  return now <= limite.getTime();
}

function warrantyUntil(entregadoAt) {
  if (!entregadoAt) return '';
  const date = new Date(entregadoAt);
  if (!Number.isFinite(date.getTime())) return '';
  date.setMonth(date.getMonth() + 6);
  return ` (hasta el ${date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })})`;
}

export function orderSupportFaqs(order, { role = 'buyer', proveedorId = null, now = Date.now() } = {}) {
  const store = role === 'buyer' ? pickStore(order, proveedorId) : null;
  const status = String(store?.estado || order?.estado || order?.status || 'PENDIENTE').toUpperCase();
  const tipoEnvio = String(store?.tipoEnvio || order?.tipoEnvio || '').toLowerCase();
  const isStorePickup = tipoEnvio ? tipoEnvio === 'store_pickup' : isStorePickupOrder(order);
  const isLocalDelivery = tipoEnvio === 'local_delivery';
  const statusLabel = status === 'ENVIADO' && isStorePickup ? 'Listo para retirar' : STATUS_LABELS[status] || 'En curso';

  const faqs = role === 'seller'
    ? sellerFaqs(order, status, isStorePickup, now)
    : buyerFaqs(order, store, status, { isStorePickup, isLocalDelivery, now });
  return { statusLabel, storeName: store?.nombreTienda || null, faqs };
}

function retractionFaq(status, entregadoAt, now) {
  const notice = retractionNotice({ status, entregadoAt }, now);
  const a = notice
    ? `${notice.label}. ${notice.detail}`
    : entregadoAt
      ? `El retracto dura ${orderDeadlineParams().retractionDays} días desde que recibiste y ese plazo ya venció. Si el repuesto tiene fallas, sigue vigente la garantía legal de 6 meses.`
      : `Tienes ${orderDeadlineParams().retractionDays} días desde que recibes para retractarte si el repuesto está sin usar y en su empaque original sellado.`;
  return faq('¿Puedo retractarme de la compra?', a);
}

function buyerFaqs(order, store, status, { isStorePickup, isLocalDelivery, now }) {
  const entregadoAt = store?.entregadoAt || order?.entregadoAt;
  const out = [];

  // Una devolucion en curso es lo primero que el comprador quiere saber, sea cual sea el estado.
  const active = activeBuyerRefunds(order);
  if (active.length > 0) {
    out.push(
      faq('¿En qué va mi devolución?', `Tienes ${active.length === 1 ? 'una devolución en curso' : `${active.length} devoluciones en curso`}. Ábrela desde el ícono de alerta arriba en el detalle del pedido para ver cada paso con Flow. ${FLOW_REFUND_NOTICE}`),
      faq('No me llegó el correo de Flow', 'Revisa spam y promociones buscando info@flow.cl. El correo llega al email con el que pagaste. Si pasaron más de 24 horas o venció el plazo para aceptarlo, escríbenos a soporte y la coordinamos contigo.'),
    );
  }

  switch (status) {
    case 'PENDIENTE': {
      const window = orderPaymentWindow(order, now);
      out.push(
        faq('¿Cuánto tiempo tengo para pagar?', `${window ? `${window.label}. ` : ''}Tienes ${orderDeadlineParams().paymentWindowMinutes} minutos desde que inicias el pago. Mientras tanto reservamos los productos para ti.`),
        faq('¿Qué pasa si no alcanzo a pagar?', 'El pedido se cancela solo y los productos vuelven al stock de la tienda. No se te cobra nada; puedes volver a comprarlos desde el carrito.'),
        faq('Ya pagué y sigue pendiente', 'Flow puede tardar unos minutos en confirmar el pago. No pagues de nuevo: recarga el detalle en unos minutos. Si te cobraron y el pedido igual se cancela, el dinero se devuelve por Flow.'),
        faq('¿Cómo reintento el pago?', 'Con "Retomar pago" en este detalle: vuelves a Flow con el mismo pedido y puedes elegir otro medio de pago.'),
      );
      break;
    }
    case 'PAGADO':
      out.push(
        faq('¿Qué significa que esté pagado?', 'Tu pago está aprobado y la tienda debe confirmar el pedido adjuntando tu boleta o factura. Te avisamos apenas lo confirme.'),
        faq('¿Puedo cancelar mi compra?', 'Sí. Mientras la tienda no despache, puedes cancelar desde el bloque de la tienda. La devolución se hace por Flow: te llegará un correo de info@flow.cl para aceptarla.'),
        faq('La tienda no confirma mi pedido', 'Escríbele con "Chatear con vendedor". Si no responde, abre un reclamo con el motivo "El vendedor tarda demasiado" y te ayudamos.'),
      );
      break;
    case 'EN_PREPARACION':
      out.push(
        faq('¿Qué está pasando con mi pedido?', isStorePickup
          ? 'La tienda confirmó tu compra y está preparando los repuestos. Cuando estén listos te avisamos y verás tu código de retiro en el detalle.'
          : 'La tienda confirmó tu compra y está preparando el despacho. Cuando lo envíe verás aquí el courier y el número de seguimiento.'),
        faq('¿Todavía puedo cancelar?', 'Sí, mientras no esté despachado. Hazlo desde el bloque de la tienda; la devolución se hace por Flow.'),
        faq('¿Puedo cambiar la dirección o el vehículo?', 'Escríbele a la tienda por el chat antes de que despache. Si ya salió, coordínalo con ella o con el courier.'),
        faq('La tienda tarda demasiado en despachar', 'Pregúntale por el chat. Si no hay respuesta o el plazo no se cumple, abre un reclamo con el motivo "El vendedor tarda demasiado en preparar o enviar".'),
      );
      break;
    case 'ENVIADO':
      if (isStorePickup) {
        out.push(
          faq('¿Cómo retiro mi pedido?', 'Ve a la tienda y dicta tu código de retiro, que está en este detalle. La tienda lo ingresa y la compra queda como recibida.'),
          faq('¿Puede retirar otra persona?', 'Sí, si le das tu código. El código es la prueba de entrega: compártelo solo con quien retire por ti.'),
          faq('Fui a retirar y el local estaba cerrado', 'Revisa el horario de la tienda y escríbele por el chat. Si no se resuelve, abre un reclamo con el motivo "Fui a retirar y el local estaba cerrado".'),
          faq('¿Hasta cuándo puedo retirar?', 'El retiro en tienda no se da por recibido solo: solo tu código confirma la entrega. Coordina el día con la tienda por el chat.'),
        );
      } else {
        const notice = storeAutoCloseNotice({
          estado: status,
          updatedAt: store?.updatedAt || order?.updatedAt,
          entregadoAt,
          entregaDeclaradaAt: store?.entregaDeclaradaAt || order?.entregaDeclaradaAt,
          isStorePickup,
          isLocalDelivery,
        }, now);
        if (notice?.kind === 'delivery_veto') {
          out.push(faq('La tienda dice que lo entregó', `${notice.label}. Tienes ${orderDeadlineParams().deliveryVetoWindowHours} horas desde su aviso: si lo recibiste, confírmalo en el bloque de la tienda; si no, toca "No la he recibido". Vencido el plazo, se da por recibido.`));
        }
        out.push(
          faq('¿Cómo sigo mi envío?', isLocalDelivery
            ? 'Es un despacho dentro de tu comuna (delivery de la tienda o app de reparto). Coordina la entrega con la tienda por el chat.'
            : 'En el bloque de la tienda están el courier y el número de seguimiento. Úsalo en el sitio del courier para ver dónde va tu paquete.'),
          faq('¿Qué pasa si no confirmo que lo recibí?', `${notice?.kind === 'reception' ? `${notice.label}. ` : ''}Si no confirmas ni reclamas, lo damos por recibido ${isLocalDelivery ? orderDeadlineParams().autoReceptionLocalDays : orderDeadlineParams().autoReceptionDays} días después del despacho. Si llegó, confírmalo en el bloque de la tienda.`),
          faq('No me ha llegado', 'Revisa el seguimiento y pregúntale a la tienda por el chat. Si no aparece, abre un reclamo con el motivo "El producto no ha llegado" antes de que se dé por recibido.'),
          faq('Llegó dañado o no es lo que pedí', 'Confirma la recepción y abre un reclamo con el motivo que corresponda, adjuntando fotos del paquete y del repuesto.'),
        );
      }
      break;
    case 'ENTREGADO': {
      const finalization = storeAutoCloseNotice({ estado: status, entregadoAt, isStorePickup, isLocalDelivery }, now);
      out.push(
        faq('¿Cuándo se cierra mi compra?', `${finalization ? `${finalization.label}. ` : ''}La compra se cierra sola ${orderDeadlineParams().autoFinalizationDays} días después de recibirla. El cierre da la entrega por conforme, pero no te quita el retracto ni la garantía legal.`),
        retractionFaq(status, entregadoAt, now),
        faq('El repuesto no calza o viene con fallas', 'Abre un reclamo con el motivo "Pieza incompatible" o "Pieza defectuosa" y adjunta fotos. Primero conversas con la tienda; si no llegan a acuerdo, puedes pedir un mediador de RepuesTop.'),
        faq('¿Cómo califico a la tienda?', 'Con "Calificar" en el bloque de la tienda. Tu opinión ayuda a otros compradores.'),
      );
      break;
    }
    case 'FINALIZADO': {
      if (retractionNotice({ status, entregadoAt }, now)) out.push(retractionFaq(status, entregadoAt, now));
      out.push(
        faq('¿Qué significa "Finalizado"?', `La entrega quedó conforme y la venta se cerró. Tus derechos siguen vigentes: retracto por ${orderDeadlineParams().retractionDays} días y garantía legal por 6 meses desde que recibiste.`),
        faq('El repuesto falló después del cierre', withinWarranty(entregadoAt, now)
          ? `Tienes garantía legal por fallas hasta 6 meses desde que lo recibiste${warrantyUntil(entregadoAt)}. Abre un reclamo desde el bloque de la tienda o escríbenos a soporte.`
          : 'La garantía legal de 6 meses desde la recepción ya venció. Igual puedes escribirle a la tienda por el chat o contarnos tu caso.'),
        faq('¿Dónde está mi boleta o factura?', 'En el bloque de cada tienda: cada una emite su propio documento.'),
      );
      break;
    }
    case 'EN_MEDIACION':
      out.push(
        faq('¿Qué hace el mediador?', 'Un mediador de RepuesTop revisa la conversación, las fotos y lo que digan las dos partes, y decide una solución: devolución total, parcial o cierre del caso.'),
        faq('¿Cómo aporto pruebas?', 'En el chat del caso, pestaña Mediador: escríbele y adjunta fotos o documentos. Mientras más claro, más rápido se resuelve.'),
        faq('¿Qué pasa con mi dinero mientras tanto?', 'El pago queda retenido y la tienda no lo recibe hasta que haya un veredicto. Si te corresponde una devolución, se hace por Flow y la sigues desde el ícono de alerta del detalle.'),
        faq('¿Cuánto tarda la mediación?', 'Depende de que ambas partes respondan. Revisa el chat del caso: ahí te avisamos cada avance y la resolución.'),
      );
      break;
    case 'CANCELADO': {
      const reason = cancellationReasonLabel(order, 'buyer');
      const hint = cancellationReasonHint(order);
      const paid = order?.pagado === true || Number(order?.montoReembolsado || 0) > 0;
      out.push(
        faq('¿Por qué se canceló mi pedido?', reason
          ? `${reason}.${hint ? ` ${hint}` : ''}`
          : 'El pedido se canceló antes de completarse. Si no sabes por qué, escríbenos y lo revisamos.'),
        faq('¿Me devuelven el dinero?', paid
          ? `Sí. ${FLOW_REFUND_NOTICE}`
          : 'Si el pago no alcanzó a completarse, no hubo cargo y no hay nada que devolver.'),
        faq('¿Puedo volver a comprar?', 'Sí. Busca los repuestos de nuevo o pide una cotización a otra tienda.'),
      );
      break;
    }
    default:
      break;
  }

  if (status !== 'CANCELADO' && status !== 'PENDIENTE') {
    out.push(faq('¿Cómo hablo con la tienda?', 'Con "Chatear con vendedor" arriba en este detalle. Todo lo que conversen queda registrado por si después necesitas un mediador.'));
  }
  out.push(faq('Mi duda no está aquí', 'Escríbenos con "Contactar soporte": tu consulta llega al equipo y te respondemos por correo.'));
  return out;
}

function sellerFaqs(order, status, isStorePickup, now) {
  const out = [];
  switch (status) {
    case 'PAGADO':
    case 'PENDIENTE':
      out.push(
        faq('¿Cómo confirmo el pedido?', 'Con "Confirmar pedido": revisa stock y compatibilidad y adjunta la boleta o factura. El comprador recibe el aviso. Sin confirmar no puedes despachar.'),
        faq('No tengo stock, ¿qué hago?', 'Usa "Cancelar pedido" e indica el motivo. Al comprador se le devuelve el pago por Flow. Cancelar seguido afecta tu reputación.'),
      );
      break;
    case 'EN_PREPARACION':
      out.push(
        faq(isStorePickup ? '¿Cómo aviso que está listo para retirar?' : '¿Cómo registro el envío?', isStorePickup
          ? 'Con "Listo para retirar". El comprador recibe su código de retiro y te lo dicta al llegar.'
          : 'Con "Registrar despacho": indica el courier y el número de seguimiento, o el método de reparto local. El comprador lo ve en su pedido.'),
        faq('El comprador pidió un cambio', 'Conversa por el chat del pedido antes de despachar. Si no puedes cumplir, cancela tu parte con el motivo correspondiente.'),
      );
      break;
    case 'ENVIADO':
      out.push(isStorePickup
        ? faq('¿Cómo entrego el pedido?', 'Ingresa el código que te dicta el comprador. Sin el código no hay prueba de entrega.')
        : faq('Ya lo entregué, ¿cómo lo aviso?', `Con "Marcar como recibida". El comprador tiene ${orderDeadlineParams().deliveryVetoWindowHours} horas para confirmar o reclamar; si no responde, queda como recibido. Si no haces nada, se da por recibido ${orderDeadlineParams().autoReceptionDays} días después del despacho (${orderDeadlineParams().autoReceptionLocalDays} en reparto local).`));
      out.push(faq('Problema con el courier', 'Escríbele al comprador por el chat y cuéntanos el caso a soporte, con el número de seguimiento.'));
      break;
    case 'ENTREGADO': {
      const funds = fundsReleaseNotice({ status, entregadoAt: order?.entregadoAt }, now);
      out.push(
        faq('¿Cuándo puedo finalizar la venta?', `${orderDeadlineParams().autoFinalizationDays} días después de la entrega. Si nadie la finaliza, se cierra sola.`),
        faq('¿Cuándo puedo retirar el dinero?', `${funds ? `${funds.label}. ` : ''}Los fondos quedan en custodia mientras el comprador conserva su derecho a retracto (${orderDeadlineParams().retractionDays} días). Después se suman a lo que puedes retirar.`),
      );
      break;
    }
    case 'FINALIZADO': {
      const funds = fundsReleaseNotice({ status, entregadoAt: order?.entregadoAt }, now);
      out.push(
        faq('¿Cuándo puedo retirar el dinero?', funds ? `${funds.label}. ${funds.detail}` : 'El plazo de custodia terminó: el monto ya está en lo que puedes retirar.'),
        faq('¿El comprador todavía puede reclamar?', 'Sí, por garantía legal hasta 6 meses desde la recepción si el repuesto falla. Si pasa, verás el caso en tus chats con compradores.'),
      );
      break;
    }
    case 'EN_MEDIACION':
      out.push(
        faq('¿Qué hago durante la mediación?', 'Responde al mediador en el chat del caso (pestaña Mediador) y adjunta tus pruebas: fotos del despacho, boleta, conversaciones.'),
        faq('¿Qué pasa con el pago?', 'Queda retenido hasta el veredicto. Si hay devolución al comprador, se descuenta de esta venta.'),
      );
      break;
    case 'CANCELADO':
      out.push(
        faq('¿Tengo que emitir una nota de crédito?', 'Si ya habías emitido boleta o factura, sí. Cárgala con el botón "Nota de crédito" de la venta o con el ícono de nota de crédito arriba en su detalle: ahí ves los datos para emitirla en el SII.'),
        faq('¿Quién devuelve el dinero al comprador?', 'RepuesTop lo devuelve por Flow; tú no tienes que transferir nada.'),
      );
      break;
    default:
      break;
  }
  out.push(faq('Mi duda no está aquí', 'Escríbenos con "Contactar soporte": tu consulta llega al equipo con el contexto de tu cuenta.'));
  return out;
}
