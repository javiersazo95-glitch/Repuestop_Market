/**
 * Motivos para rechazar una oferta, a elegir de una lista (el texto elegido es el que ve la tienda).
 * "Otro motivo" deja escribirlo, hasta 300 caracteres. Mismos motivos que la app.
 */
export const OFFER_REJECT_OTHER = 'Otro motivo';
export const OFFER_REJECT_MAX = 300;
export const OFFER_REJECT_REASONS = [
  'El precio supera mi presupuesto',
  'El plazo de entrega es muy largo',
  'No es el repuesto que busco',
  'No me sirve el método de entrega',
  'Elegí otra oferta',
  OFFER_REJECT_OTHER,
];

/** El motivo final a enviar: el elegido o, con "Otro motivo", el texto escrito. */
export function resolveRejectReason(choice, other) {
  if (choice === OFFER_REJECT_OTHER) return String(other || '').trim();
  return choice || '';
}
