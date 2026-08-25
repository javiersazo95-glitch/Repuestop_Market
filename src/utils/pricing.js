export const FLOW_RATE_BASE = 0.0289;
export const FLOW_IVA = 0.19;
export const FLOW_RATE_WITH_IVA = FLOW_RATE_BASE * (1 + FLOW_IVA);
export const FOUNDER_APP_RATE = 0.05;
export const COMMISSION_IVA_INCLUDED = true;

export function pricingFeeBreakdown(basePrice, isFounder = false) {
  const price = Number(basePrice) || 0;
  if (price <= 0) {
    return {
      rate: isFounder ? FOUNDER_APP_RATE : 0.10,
      repuestopNet: 0,
      repuestopIva: 0,
      repuestopWithIva: 0,
      flowWithIva: 0,
    };
  }

  let appRate = 0.10;
  if (isFounder) {
    appRate = FOUNDER_APP_RATE;
  } else if (price > 100000 && price <= 250000) {
    appRate = 0.07;
  } else if (price > 250000) {
    appRate = 0.05;
  }

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
  const price = Number(basePrice) || 0;
  if (price <= 0) return 0;
  return Math.max(0, price - serviceFeeAmount(price, isFounder));
}

export function calculateSimplePricingSummary(basePrice, isFounder = false) {
  const price = Number(basePrice) || 0;
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
  const target = Number(desiredAmount) || 0;
  if (target <= 0) return 0;
  let low = target;
  let high = Math.ceil(target / 0.8);
  while (calculateSellerEarnings(high, isFounder) < target) high *= 2;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (calculateSellerEarnings(middle, isFounder) >= target) high = middle;
    else low = middle + 1;
  }
  return low;
}
