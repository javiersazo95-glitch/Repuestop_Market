const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

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
