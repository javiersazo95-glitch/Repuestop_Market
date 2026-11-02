/** Cuánto demora la tienda en tener el repuesto: 0 = lo tiene en stock; si no, días hábiles para pedirlo. */
export const availabilityLabel = (days) => {
  if (days == null) return '';
  if (days <= 0) return 'En stock';
  return days === 1 ? '1 día hábil' : `${days} días hábiles`;
};

/** Frase para el comprador; vacía si la tienda no informó (ofertas anteriores). */
export const availabilitySentence = (days) => {
  if (days == null) return '';
  if (days <= 0) return 'La tienda lo tiene en stock.';
  return `La tienda debe pedirlo: lo tendrá disponible en ${availabilityLabel(days).toLowerCase()}.`;
};

export const AVAILABILITY_OPTIONS = [0, 1, 2, 3, 5, 7, 10, 15, 20, 30].map((days) => ({
  value: days,
  label: days === 0 ? 'Lo tengo en stock' : availabilityLabel(days),
}));
