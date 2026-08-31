import { activeOrderItems } from './orderIdentity';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Minutos que el comprador tiene para pagar un pedido antes de que el backend lo
 * cancele y devuelva la unidad al stock.
 *
 * ESPEJO de `repuestop.pedido.expiracion.minutos` en el `application.properties`
 * del backend, que es quien manda: `PedidoPagoSupport` compara contra
 * `updatedAt + minutosExpiracion` y un job barre los vencidos cada 5 minutos. Ese
 * valor NO se expone por API, asi que aca solo se puede espejar. Si alla se
 * cambia, este numero miente y hay que actualizarlo; lo correcto de fondo es que
 * el backend lo publique en el DTO del pedido.
 */
export const PAYMENT_WINDOW_MINUTES = 30;

/**
 * Cuanto le queda al comprador para pagar un pedido PENDIENTE.
 *
 * La cuenta va desde `updatedAt` y no desde `createdAt` porque cada reintento
 * pide una intencion de pago nueva y reinicia la ventana (`reintentarPago()` hace
 * `pedido.setUpdatedAt(now)`), igual que `vigenteDesde` en las cotizaciones.
 *
 * Devuelve `null` cuando no hay fecha utilizable, para no inventar un plazo.
 */
export function orderPaymentWindow(order, now = Date.now()) {
  const updatedAt = new Date(order?.updatedAt || order?.fechaActualizacion || 0).getTime();
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;

  const remaining = updatedAt + PAYMENT_WINDOW_MINUTES * 60 * 1000 - now;
  if (remaining <= 0) {
    return { expired: true, minutes: 0, label: 'El plazo para pagar venció' };
  }
  const minutes = Math.max(1, Math.ceil(remaining / 60000));
  return {
    expired: false,
    minutes,
    label: `Te queda${minutes === 1 ? '' : 'n'} ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'} para pagar`,
  };
}

export function normalizeOrderStatus(order) {
  const status = String(order?.estado || order?.status || 'PENDIENTE').toUpperCase();
  const aliases = {
    PENDING: 'PENDIENTE',
    PREPARING: 'EN_PREPARACION',
    SENT: 'ENVIADO',
    RECEIVED: 'ENTREGADO',
    FINISHED: 'FINALIZADO',
  };
  return aliases[status] || status;
}

export function isStorePickupOrder(order) {
  const shipping = String(order?.courier || order?.deliveryTerms || order?.tipoEnvio || '').toLowerCase();
  return shipping.includes('retiro') || shipping.includes('tienda') || shipping.includes('store_pickup');
}

export function sellerFinalizationAvailability(order, now = Date.now()) {
  const updatedAt = new Date(order?.updatedAt || order?.fechaActualizacion || 0).getTime();
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    return { enabled: false, label: 'Disponible 3 días después de la recepción' };
  }
  const remainingMs = updatedAt + THREE_DAYS_MS - now;
  if (remainingMs <= 0) return { enabled: true, label: 'Finalizar pedido' };
  const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
  const remaining = hours > 24
    ? `${Math.ceil(hours / 24)} ${Math.ceil(hours / 24) === 1 ? 'día' : 'días'}`
    : `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  return { enabled: false, label: `Finalizar pedido (disponible en ${remaining})` };
}

export function getControlledOrderAction(order, mode) {
  const status = normalizeOrderStatus(order);
  const pickup = isStorePickupOrder(order);

  // Un vendedor que ya no tiene lineas vivas en el pedido no tiene nada que preparar ni que
  // despachar. Antes la accion se decidia SOLO por el estado del pedido, asi que el vendedor
  // que cancelo su unica linea seguia viendo "Confirmar pedido" -y al pulsarlo movia el
  // pedido entero a EN_PREPARACION, cambiandole el estado al OTRO vendedor, que si tenia algo
  // que despachar-.
  //
  // El arreglo de fondo es el estado por vendedor (subordenes, seccion 8 de
  // PLAN_CARRITO_CHECKOUT): mientras el estado sea uno solo y compartido, cualquiera de los
  // dos lo mueve. Esto al menos impide que lo mueva quien ya no participa.
  if (mode !== 'buyer' && Array.isArray(order?.items) && order.items.length > 0
      && activeOrderItems(order).length === 0) {
    return null;
  }

  if (mode === 'buyer') {
    if (status === 'ENVIADO') {
      return {
        nextStatus: 'ENTREGADO',
        label: pickup ? 'Confirmar retiro' : 'Marcar recibido',
        title: pickup ? '¿Confirmar retiro?' : '¿Confirmar recepción del pedido?',
        message: pickup
          ? 'Confirma únicamente si ya tienes los repuestos en tus manos. Esta acción no se puede deshacer.'
          : 'Confirma que recibiste el pedido. El estado cambiará a Recibido.',
      };
    }
    if (status === 'ENTREGADO') {
      return {
        nextStatus: 'FINALIZADO',
        label: 'Finalizar pedido',
        title: '¿Confirmar finalización?',
        message: 'Esta acción cerrará definitivamente el pedido.',
      };
    }
    return null;
  }

  if (status === 'PENDIENTE' || status === 'PAGADO') {
    return {
      nextStatus: 'EN_PREPARACION',
      label: 'Confirmar pedido',
      title: '¿Confirmar pedido?',
      message: 'El pedido será aceptado y cambiará a En preparación.',
    };
  }
  if (status === 'EN_PREPARACION') {
    return {
      nextStatus: 'ENVIADO',
      label: pickup ? 'Listo para retirar' : 'Registrar envío',
      title: pickup ? '¿Marcar listo para retirar?' : '¿Registrar envío?',
      message: pickup
        ? 'El comprador será notificado de que puede retirar su pedido.'
        : 'El pedido cambiará a Enviado y quedará esperando la confirmación del comprador.',
    };
  }
  if (status === 'ENVIADO') {
    if (pickup) {
      return {
        nextStatus: 'ENTREGADO',
        label: 'Entregar pedido',
        title: 'Validar entrega con PIN',
        message: 'Solicita al comprador su código de retiro de 6 dígitos.',
        requiresPin: true,
      };
    }
    return { waiting: true, label: 'Esperando recepción del comprador' };
  }
  if (status === 'ENTREGADO') {
    const availability = sellerFinalizationAvailability(order);
    return {
      nextStatus: 'FINALIZADO',
      label: availability.label,
      title: '¿Finalizar pedido?',
      message: 'Esta acción dará por cerrado el proceso.',
      disabled: !availability.enabled,
    };
  }
  return null;
}
