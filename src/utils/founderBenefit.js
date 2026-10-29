// Las tasas de los textos se leen al momento (`standardRateLabel()`, `flowRateLabel()`): vienen
// del Mantenedor comun y una constante de modulo dejaria el copy con la tasa vieja.
import { FOUNDER_FREE_MONTHS, calculateSellerEarnings, flowRateLabel, standardRateLabel } from './pricing';

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
  return `Después: ${standardRateLabel()} + IVA por venta. El costo de Flow se mantiene.`;
}

/**
 * Texto completo del tooltip del chip del perfil. Con fecha: "... (hasta DD/MM/AAAA) ...";
 * sin fecha se omite el parentesis en vez de inventar una.
 */
export function founderBenefitTooltip(founderUntil) {
  const until = founderEndsAtDateLabel(founderUntil);
  const span = `tu marcha blanca de ${FOUNDER_FREE_MONTHS} meses${until ? ` (hasta ${until})` : ''}`;
  return `0% de tarifa de servicio RepuesTop durante ${span}. Solo pagas Flow ${flowRateLabel()} + IVA. ${founderAfterLabel()}`;
}

const EXAMPLE_PRICE = 100000;
const clp = (value) => `$${Math.round(value).toLocaleString('es-CL')}`;

/**
 * Detalle del beneficio para el boton "i" junto al chip Fundador (perfil del vendedor, 19-oct):
 * en que consiste el servicio gratis, que es la comision por venta, de cuanto es, cuando empezo y
 * cuando termina, con un ejemplo de cuanto recibe. Mismos textos que la app
 * (mobile/utils/founder-benefit.ts, `founderBenefitDetails`).
 */
export function founderBenefitDetails(founderSince, founderUntil, now = new Date()) {
  const { daysLeft, isExpired, endsAt } = founderDaysLeft(founderUntil, now);
  const since = founderEndsAtDateLabel(founderSince);
  const until = founderEndsAtDateLabel(founderUntil);
  const status = !endsAt
    ? 'Servicio gratis activo'
    : isExpired
      ? `Tu servicio gratis terminó el ${until}`
      : daysLeft === 1 ? 'Servicio gratis · último día' : `Servicio gratis · quedan ${daysLeft} días`;
  return {
    status,
    isExpired,
    sections: [
      {
        title: '¿En qué consiste el servicio gratis?',
        text: `Por ser de las primeras tiendas de RepuesTop, durante tu marcha blanca de ${FOUNDER_FREE_MONTHS} meses no pagas comisión por venta a RepuesTop (0%). Solo se descuenta el costo de Flow, la pasarela de pago.`,
      },
      {
        title: '¿Qué es la comisión por venta?',
        text: 'Es la tarifa de servicio de RepuesTop: un porcentaje del precio de cada venta pagada que se descuenta en tu liquidación por vender en la plataforma. Es aparte del costo de Flow, que cobra la pasarela por procesar el pago.',
      },
      {
        title: '¿De cuánto es?',
        text: `Durante la marcha blanca: 0%. Al terminar: ${standardRateLabel()} + IVA por venta. Flow (${flowRateLabel()} + IVA) se descuenta siempre.`,
      },
      {
        title: '¿Cuándo empieza?',
        text: since ? `El ${since}, cuando se aprobó tu tienda.` : 'Desde la aprobación de tu tienda.',
      },
      {
        title: '¿Cuándo termina?',
        text: until
          ? `${isExpired ? 'Terminó' : 'Termina'} el ${until}. Desde esa fecha rige la comisión estándar de ${standardRateLabel()} + IVA por venta.`
          : `${FOUNDER_FREE_MONTHS} meses después de la aprobación. Desde ahí rige la comisión estándar de ${standardRateLabel()} + IVA por venta.`,
      },
    ],
    example: {
      price: clp(EXAMPLE_PRICE),
      now: clp(calculateSellerEarnings(EXAMPLE_PRICE, true)),
      after: clp(calculateSellerEarnings(EXAMPLE_PRICE, false)),
    },
  };
}

