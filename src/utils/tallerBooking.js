/**
 * Regla única de "¿se puede agendar en este taller?": la card del buscador, el perfil y el filtro
 * "Agenda en línea" la comparten (igual que `mobile/utils/taller-booking.ts` en la app).
 *
 * - El taller tiene que haber activado las citas en línea con su horario principal
 *   (`hasOnlineBooking`, que `adaptTaller` solo deja en true si llega la agenda).
 * - Un taller que atiende solo 24/7 se contacta directo: nunca tiene agenda.
 */
export function canBookTaller(taller) {
  if (!taller) return false;
  return Boolean(taller.hasOnlineBooking && taller.agendaConfig && !taller.only24Hours);
}
