/**
 * Motivos para cancelar una necesidad, en el mismo orden y con los mismos codigos que el backend
 * (`NecesidadCompraService.MOTIVOS_CANCELACION`). El motivo elegido lo ven las tiendas que ofertaron; el detalle de
 * "Otro motivo" es obligatorio y queda privado (lo ve soporte).
 */
export const CANCEL_REASONS = [
  ['YA_COMPRADO', 'Ya lo compré en otro lugar'],
  ['NO_NECESITA', 'Ya no lo necesito'],
  ['OFERTAS_NO_CONVENCEN', 'Las ofertas no me convencen (precio o plazo)'],
  ['ERROR_DATOS', 'Me equivoqué en los datos del pedido'],
  ['OTRO', 'Otro motivo'],
];

/** Mismo tope que `NecesidadCompraService.MAX_DETALLE_CANCELACION`. */
export const CANCEL_DETAIL_MAX = 300;
