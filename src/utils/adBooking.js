/**
 * Regla única de "¿se puede agendar en este anuncio?": la tarjeta del mural, las
 * historias, el detalle y el filtro "Solo con agendamiento" la comparten (igual que
 * `mobile/utils/ad-booking.ts` en la app).
 *
 * - Solo hay "Agendar" si el dueño activó la función con un horario (`hasOnlineBooking`).
 * - Un anuncio 24/7 / urgencias se contacta directo: nunca tiene agenda.
 *
 * Si la agenda está apagada, el backend rechazaría la cita.
 */
export function canBookAd(ad) {
  if (!ad) return false;
  return Boolean(ad.hasOnlineBooking && !ad.is24Hours);
}
