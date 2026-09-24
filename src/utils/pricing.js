export const MAX_CATALOG_PRICE = 99999999;
export const FLOW_RATE_BASE = 0.0289;
export const FLOW_IVA = 0.19;
export const FLOW_RATE_WITH_IVA = FLOW_RATE_BASE * (1 + FLOW_IVA);
export const FOUNDER_APP_RATE = 0.05;
// Comision estandar parejo para tiendas verificadas (8 % + IVA, sin tramos ni tope; 2026-09-24).
export const STANDARD_APP_RATE = 0.08;
// Si es false, el porcentaje es neto y el IVA (19%) se cobra adicional al vendedor (% + IVA)
export const COMMISSION_IVA_INCLUDED = false;

export function pricingFeeBreakdown(basePrice, isFounder = false) {
  const rawPrice = Number(basePrice) || 0;
  const price = Math.min(Math.max(0, rawPrice), MAX_CATALOG_PRICE);
  if (price <= 0) {
    return {
      rate: isFounder ? FOUNDER_APP_RATE : STANDARD_APP_RATE,
      repuestopNet: 0,
      repuestopIva: 0,
      repuestopWithIva: 0,
      flowWithIva: 0,
    };
  }

  const appRate = isFounder ? FOUNDER_APP_RATE : STANDARD_APP_RATE;

  if (COMMISSION_IVA_INCLUDED) {
    const repuestopWithIva = Math.round(price * appRate);
    const repuestopNet = Math.round(repuestopWithIva / (1 + FLOW_IVA));
    const repuestopIva = repuestopWithIva - repuestopNet;
    return {
      rate: appRate,
      repuestopNet,
      repuestopIva,
      repuestopWithIva,
      flowWithIva: Math.round(price * FLOW_RATE_WITH_IVA),
    };
  } else {
    const repuestopNet = Math.round(price * appRate);
    const repuestopWithIva = Math.round(repuestopNet * (1 + FLOW_IVA));
    return {
      rate: appRate,
      repuestopNet,
      repuestopIva: repuestopWithIva - repuestopNet,
      repuestopWithIva,
      flowWithIva: Math.round(price * FLOW_RATE_WITH_IVA),
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
