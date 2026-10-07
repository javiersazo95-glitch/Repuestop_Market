import { AD_TIERS } from '../data/automotiveAdsData';

/**
 * Regla única de "¿se puede agendar en este anuncio?": la tarjeta del mural, las
 * historias, el detalle y el filtro "Solo con agendamiento" la comparten (igual que
 * `mobile/utils/ad-booking.ts` en la app).
 *
 * - El plan habilita la FUNCIÓN de agenda (solo Empresarial)...
 * - ...pero solo hay "Agendar" si el dueño la activó con un horario (`hasOnlineBooking`).
 * - Un anuncio 24/7 / urgencias se contacta directo: nunca tiene agenda.
 *
 * Antes la tarjeta miraba solo el plan y mostraba "Agendar" en avisos con la agenda
 * apagada, y al tocarlo el backend rechazaba la cita.
 */
export function canBookAd(ad) {
  if (!ad) return false;
  return Boolean(AD_TIERS[ad.tier]?.hasBooking && ad.hasOnlineBooking && !ad.is24Hours);
}
