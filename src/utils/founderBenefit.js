import { FOUNDER_FREE_MONTHS, STANDARD_RATE_LABEL } from './pricing';

/**
 * Marcha blanca de Tienda Fundadora: tarifa de servicio RepuesTop 0% durante los primeros
 * 2 meses desde la aprobacion. El backend manda `founderUntil` (ISO-8601 OffsetDateTime,
 * puede venir null) en login, registro y `GET /proveedores/{id}/tienda`; aca se traduce a
 * dias restantes y a los textos que ven el vendedor y el perfil.
 *
 * Mismo criterio de "dias" que `getAdExpiryInfo` (automotiveAdsData.js): ceil de los
 * milisegundos que faltan, asi el ultimo dia completo cuenta como 1 y no como 0.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Fecha de termino como Date, o null si `founderUntil` no trae nada utilizable. */
export function founderEndsAt(founderUntil) {
  if (!founderUntil) return null;
  const endsAt = founderUntil instanceof Date ? founderUntil : new Date(founderUntil);
  return Number.isNaN(endsAt.getTime()) ? null : endsAt;
}

/**
 * `{ daysLeft, isExpired, endsAt }`. Sin fecha util devuelve `endsAt: null`, `daysLeft: null`
 * e `isExpired: false`: no se puede afirmar que vencio si no se sabe cuando termina.
 */
export function founderDaysLeft(founderUntil, now = new Date()) {
  const endsAt = founderEndsAt(founderUntil);
  if (!endsAt) return { daysLeft: null, isExpired: false, endsAt: null };
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const daysLeft = Math.ceil((endsAt.getTime() - nowMs) / MS_PER_DAY);
  if (daysLeft <= 0) return { daysLeft: 0, isExpired: true, endsAt };
  return { daysLeft, isExpired: false, endsAt };
}

/** "18/12/2026" (para el tooltip y textos formales). */
export function founderEndsAtDateLabel(founderUntil) {
  const endsAt = founderEndsAt(founderUntil);
  if (!endsAt) return '';
  const dd = String(endsAt.getDate()).padStart(2, '0');
  const mm = String(endsAt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${endsAt.getFullYear()}`;
}

/**
 * Etiqueta corta del chip: "Servicio gratis · quedan N días" / "Servicio gratis · último día".
 * Sin fecha util (o ya vencido, que no deberia pasar porque el backend quita `founder`)
 * se queda en "Servicio gratis" a secas.
 */
export function founderBenefitLabel(founderUntil, now = new Date()) {
  const { daysLeft, isExpired, endsAt } = founderDaysLeft(founderUntil, now);
  if (!endsAt || isExpired) return 'Servicio gratis';
  if (daysLeft === 1) return 'Servicio gratis · último día';
  return `Servicio gratis · quedan ${daysLeft} días`;
}

/** Lo que viene despues de la marcha blanca; va en tooltips, ayuda y pantallas de fundador. */
export function founderAfterLabel() {
  return `Después: ${STANDARD_RATE_LABEL} + IVA por venta. El costo de Flow se mantiene.`;
}

/**
 * Texto completo del tooltip del chip del perfil. Con fecha: "... (hasta DD/MM/AAAA) ...";
 * sin fecha se omite el parentesis en vez de inventar una.
 */
export function founderBenefitTooltip(founderUntil) {
  const until = founderEndsAtDateLabel(founderUntil);
  const span = `tu marcha blanca de ${FOUNDER_FREE_MONTHS} meses${until ? ` (hasta ${until})` : ''}`;
  return `0% de tarifa de servicio RepuesTop durante ${span}. Solo pagas Flow 2,89% + IVA. ${founderAfterLabel()}`;
}
