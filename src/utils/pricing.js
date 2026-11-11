import { remoteConfig } from '../remoteConfig/remoteConfig';

export const MAX_CATALOG_PRICE = 99999999;
// Valores de respaldo. Desde el Mantenedor comun (2026-10-20) las tasas vigentes llegan en el
// bootstrap (`parametros`, grupo COMISION) y las funciones de abajo las leen con `pricingRates()`.
// Estas constantes se usan cuando no hay bootstrap, y son las mismas de `application.properties`.
export const FLOW_RATE_BASE = 0.0289;
export const FLOW_IVA = 0.19;
export const FLOW_RATE_WITH_IVA = FLOW_RATE_BASE * (1 + FLOW_IVA);
// Marcha blanca de Tienda Fundadora (2026-10-18): tarifa de servicio RepuesTop 0% (gratis)
// durante la marcha blanca desde la aprobacion (1 mes; 2 si postulo hasta el 10-nov), para las primeras 100 tiendas aprobadas.
// En ese periodo el vendedor solo paga la pasarela Flow. Antes era 5% fijo por 3 meses.
export const FOUNDER_APP_RATE = 0;
// Tarifa estandar pareja para tiendas verificadas (7 % + IVA, sin tramos ni tope; 2026-10-18).
// Antes 8%. Es la que rige cuando termina la marcha blanca de Fundador.
export const STANDARD_APP_RATE = 0.07;
// IVA de la tarifa RepuesTop. Antes se reutilizaba FLOW_IVA (mismo 19 %); el mantenedor los
// separa (`comision.iva` y `pasarela.iva`).
export const COMMISSION_IVA = 0.19;
// Constantes de copy: las pantallas que explican el beneficio las usan para no repetir numeros
// escritos a mano (modal/postulacion de fundador, ayuda, perfil del vendedor).
// 2026-11-10: la marcha blanca dura 1 mes para quien postula desde el 11-nov y 2 para quien postulo
// hasta el 10-nov. Las pantallas de una tienda usan founderFreeMonths() con sus fechas; esta
// constante es el plazo que se ofrece a las tiendas nuevas y el respaldo sin fechas.
export const FOUNDER_FREE_MONTHS = 1;

/** "1 mes" / "2 meses". */
export function founderMonthsLabel(months) {
  return months === 1 ? '1 mes' : `${months} meses`;
}

/** Meses de marcha blanca de UNA tienda segun sus fechas; sin ellas, FOUNDER_FREE_MONTHS. */
export function founderFreeMonths(founderSince, founderUntil) {
  const desde = founderSince ? new Date(founderSince).getTime() : NaN;
  const hasta = founderUntil ? new Date(founderUntil).getTime() : NaN;
  if (Number.isNaN(desde) || Number.isNaN(hasta) || hasta <= desde) return FOUNDER_FREE_MONTHS;
  return Math.max(1, Math.round((hasta - desde) / (1000 * 60 * 60 * 24 * 30.44)));
}
export const FOUNDER_STORE_QUOTA = 100;
export const STANDARD_RATE_LABEL = '7%';
// Si es false, el porcentaje es neto y el IVA (19%) se cobra adicional al vendedor (% + IVA)
export const COMMISSION_IVA_INCLUDED = false;

/**
 * Tasas vigentes: parametros del mantenedor con las constantes de arriba como respaldo.
 *
 * El Market usa una tarifa pareja, asi que lee `comision.tasa.alta` (el tramo que aplica a
 * cualquier precio mientras los tres tramos valgan lo mismo, como hoy). Si el dueno llega a
 * diferenciar los tramos, esta simulacion habria que hacerla por tramo; el cobro real siempre lo
 * calcula el backend.
 */
export function pricingRates() {
  const standardRate = remoteConfig.parametro('comision.tasa.alta', STANDARD_APP_RATE);
  const founderRate = remoteConfig.parametro('comision.fundador.porcentaje', FOUNDER_APP_RATE);
  const commissionIva = remoteConfig.parametro('comision.iva', COMMISSION_IVA);
  const commissionIvaIncluded = remoteConfig.parametro('comision.iva.incluido', COMMISSION_IVA_INCLUDED);
  const flowRate = remoteConfig.parametro('pasarela.porcentaje', FLOW_RATE_BASE);
  const flowIva = remoteConfig.parametro('pasarela.iva', FLOW_IVA);
  return {
    standardRate,
    founderRate,
    commissionIva,
    commissionIvaIncluded,
    flowRate,
    flowIva,
    flowRateWithIva: flowRate * (1 + flowIva),
  };
}

/** "7%" / "7,5%": porcentaje para los textos, desde la tasa vigente. */
function percentLabel(rate, decimals) {
  const value = Number(rate) * 100;
  const text = decimals == null
    ? String(Math.round(value * 100) / 100)
    : value.toFixed(decimals);
  return `${text.replace('.', ',')}%`;
}

/** Tarifa estandar vigente como texto ("7%"); reemplaza a `STANDARD_RATE_LABEL` en los copys. */
export function standardRateLabel() {
  return percentLabel(pricingRates().standardRate);
}

/** Tasa de Flow vigente como texto ("2,89%"). */
export function flowRateLabel() {
  return percentLabel(pricingRates().flowRate, 2);
}

export function pricingFeeBreakdown(basePrice, isFounder = false) {
  const rates = pricingRates();
  const rawPrice = Number(basePrice) || 0;
  const price = Math.min(Math.max(0, rawPrice), MAX_CATALOG_PRICE);
  const appRate = isFounder ? rates.founderRate : rates.standardRate;
  if (price <= 0) {
    return {
      rate: appRate,
      repuestopNet: 0,
      repuestopIva: 0,
      repuestopWithIva: 0,
      flowWithIva: 0,
    };
  }

  if (rates.commissionIvaIncluded) {
    const repuestopWithIva = Math.round(price * appRate);
    const repuestopNet = Math.round(repuestopWithIva / (1 + rates.commissionIva));
    const repuestopIva = repuestopWithIva - repuestopNet;
    return {
      rate: appRate,
      repuestopNet,
      repuestopIva,
      repuestopWithIva,
      flowWithIva: Math.round(price * rates.flowRateWithIva),
    };
  } else {
    const repuestopNet = Math.round(price * appRate);
    const repuestopWithIva = Math.round(repuestopNet * (1 + rates.commissionIva));
    return {
      rate: appRate,
      repuestopNet,
      repuestopIva: repuestopWithIva - repuestopNet,
      repuestopWithIva,
      flowWithIva: Math.round(price * rates.flowRateWithIva),
    };
  }
}

export function serviceFeeAmount(basePrice, isFounder = false) {
  const breakdown = pricingFeeBreakdown(basePrice, isFounder);
  return breakdown.repuestopWithIva + breakdown.flowWithIva;
}

export function calculateSellerEarnings(basePrice, isFounder = false) {
  const price = Math.min(Math.max(0, Number(basePrice) || 0), MAX_CATALOG_PRICE);
  if (price <= 0) return 0;
  return Math.max(0, price - serviceFeeAmount(price, isFounder));
}

export function calculateSimplePricingSummary(basePrice, isFounder = false) {
  const price = Math.min(Math.max(0, Number(basePrice) || 0), MAX_CATALOG_PRICE);
  const breakdown = pricingFeeBreakdown(price, isFounder);
  const totalFees = breakdown.repuestopWithIva + breakdown.flowWithIva;
  const netEarnings = Math.max(0, price - totalFees);
  return {
    totalFees,
    netEarnings,
    breakdown,
  };
}

export function calculateSuggestedPrice(desiredAmount, isFounder = false) {
  const target = Math.min(Math.max(0, Number(desiredAmount) || 0), MAX_CATALOG_PRICE);
  if (target <= 0) return 0;
  let low = target;
  let high = Math.min(Math.ceil(target / 0.8), MAX_CATALOG_PRICE);
  while (calculateSellerEarnings(high, isFounder) < target && high < MAX_CATALOG_PRICE) {
    high = Math.min(high * 2, MAX_CATALOG_PRICE);
    if (high >= MAX_CATALOG_PRICE) break;
  }
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (calculateSellerEarnings(middle, isFounder) >= target) high = middle;
    else low = middle + 1;
  }
  return Math.min(low, MAX_CATALOG_PRICE);
}
