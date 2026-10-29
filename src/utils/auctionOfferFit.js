/*
 * Evaluación de una oferta de subasta frente a lo que el comprador fijó al publicar la necesidad:
 * presupuesto tope, plazo máximo de envío, método de envío y cantidad. Cada criterio sale en verde
 * (cumple), ámbar (revisar) o rojo (no cumple); sin dato exigido queda neutro.
 */

const HOURS_BY_KEYWORD = [
  [/mismo\s*d[ií]a|inmediat/i, 8],
];

/** Horas máximas que cubre un plazo ("48 horas", "3 a 5 días hábiles", "Mismo día"); null si es "a convenir". */
export function deadlineHours(text) {
  if (!text) return null;
  const value = String(text);
  if (/convenir|coordinar/i.test(value)) return null;
  for (const [pattern, hours] of HOURS_BY_KEYWORD) {
    if (pattern.test(value)) return hours;
  }
  const range = value.match(/(\d+)\s*(?:a|-)\s*(\d+)\s*d[ií]as/i);
  if (range) return Number(range[2]) * 24;
  const days = value.match(/(\d+)\s*d[ií]as?/i);
  if (days) return Number(days[1]) * 24;
  const hours = value.match(/(\d+)\s*horas?/i);
  if (hours) return Number(hours[1]);
  return null;
}

/** Clase del método de envío: any | pickup | home | courier | null (a coordinar / desconocido). */
export function shippingClass(text) {
  if (!text) return null;
  const value = String(text).toLowerCase();
  if (/cualquiera/.test(value) && /retiro/.test(value)) return 'any';
  if (/retiro/.test(value)) return 'pickup';
  if (/regiones|courier|starken|chilexpress|fuera de la comuna/.test(value)) return 'courier';
  if (/despacho|domicilio|dentro de la comuna/.test(value)) return 'home';
  if (/cualquiera/.test(value)) return 'any';
  return null;
}

const money = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

function budgetCheck(auction, total, ratio = 1) {
  const cap = Number(auction.presupuestoMaximo);
  if (!cap || !total) return { key: 'budget', label: 'Presupuesto', status: 'neutral', detail: cap ? 'Sin precio para comparar' : 'No fijaste un tope' };
  // El tope es del pedido completo: una oferta parcial se compara con él entero y se informa cuánto del tope usa.
  const partial = ratio < 1;
  const used = Math.round((total / cap) * 100);
  if (total <= cap) {
    return {
      key: 'budget',
      label: 'Presupuesto',
      status: 'ok',
      detail: partial
        ? `Cubre una parte del pedido y usa el ${used}% de tu tope de ${money(cap)}`
        : `Dentro de tu tope de ${money(cap)} (${money(cap - total)} bajo el límite)`,
    };
  }
  const over = total - cap;
  const status = over / cap <= 0.1 ? 'warn' : 'bad';
  return { key: 'budget', label: 'Presupuesto', status, detail: `Supera tu tope de ${money(cap)} por ${money(over)}` };
}

function deadlineCheck(auction, quote) {
  const wanted = deadlineHours(auction.tiempoMaximoEnvio);
  const offered = deadlineHours(quote.tiempoEntrega);
  if (wanted == null) return { key: 'deadline', label: 'Plazo de entrega', status: 'neutral', detail: `Pediste: ${auction.tiempoMaximoEnvio || 'a convenir'}` };
  if (offered == null) return { key: 'deadline', label: 'Plazo de entrega', status: 'warn', detail: `Plazo a coordinar (pediste máximo ${auction.tiempoMaximoEnvio})` };
  if (offered <= wanted) return { key: 'deadline', label: 'Plazo de entrega', status: 'ok', detail: `${quote.tiempoEntrega}: cumple tu plazo de ${auction.tiempoMaximoEnvio}` };
  const status = offered <= wanted * 2 ? 'warn' : 'bad';
  return { key: 'deadline', label: 'Plazo de entrega', status, detail: `${quote.tiempoEntrega}: excede tu plazo de ${auction.tiempoMaximoEnvio}` };
}

function shippingCheck(auction, quote) {
  const wanted = shippingClass(auction.tipoEnvio);
  const offered = shippingClass(quote.tipoEntrega);
  const label = 'Método de envío';
  if (wanted === 'any' || wanted == null) return { key: 'shipping', label, status: 'neutral', detail: `Aceptabas: ${auction.tipoEnvio || 'cualquiera'}` };
  if (offered == null || offered === 'any') return { key: 'shipping', label, status: 'warn', detail: `${quote.tipoEntrega || 'A coordinar'} (pediste ${auction.tipoEnvio})` };
  if (offered === wanted) return { key: 'shipping', label, status: 'ok', detail: `${quote.tipoEntrega}: coincide con lo que pediste` };
  // Despacho a domicilio es una sola opción para el comprador: dentro de la comuna o por pagar (courier) es lo mismo para él.
  const isDelivery = (kind) => kind === 'home' || kind === 'courier';
  if (isDelivery(wanted) && isDelivery(offered)) return { key: 'shipping', label, status: 'ok', detail: `${quote.tipoEntrega}: es despacho a domicilio, como pediste` };
  const closeEnough = false;
  return {
    key: 'shipping',
    label,
    status: closeEnough ? 'warn' : 'bad',
    detail: `${quote.tipoEntrega}: pediste ${auction.tipoEnvio}`,
  };
}

function quantityCheck(auction, quote, coverage) {
  if (coverage && coverage.totalItems > 1) {
    if (coverage.coveredItems === coverage.totalItems) {
      return { key: 'quantity', label: 'Repuestos', status: 'ok', detail: `Cubre los ${coverage.totalItems} repuestos del pedido` };
    }
    return {
      key: 'quantity',
      label: 'Repuestos',
      status: 'warn',
      detail: `Cubre ${coverage.coveredItems} de ${coverage.totalItems} repuestos${coverage.missing.length ? `; faltan: ${coverage.missing.join(', ')}` : ''}`,
    };
  }
  const wanted = Number(auction.cantidad) || 1;
  const offered = Number(quote.cantidad) || wanted;
  if (offered === wanted) return { key: 'quantity', label: 'Cantidad', status: 'ok', detail: `${offered} ${offered === 1 ? 'unidad' : 'unidades'}, como pediste` };
  if (offered < wanted) return { key: 'quantity', label: 'Cantidad', status: 'bad', detail: `Cotiza ${offered} de las ${wanted} unidades que pediste` };
  return { key: 'quantity', label: 'Cantidad', status: 'warn', detail: `Cotiza ${offered} unidades y pediste ${wanted}` };
}

/**
 * Cobertura de una oferta sobre el pedido: cuántos repuestos y unidades cubre con líneas vigentes, y cuáles
 * faltan. Sin desglose de ítems (subastas antiguas o ofertas previas) se asume que cubre todo.
 */
export function offerCoverage(auction, quote) {
  const items = auction.items || [];
  if (items.length === 0 || !Array.isArray(quote.lineas) || quote.lineas.length === 0) return null;
  const valid = quote.lineas.filter((line) => line.vigente);
  const coveredIds = new Set(valid.map((line) => line.itemId));
  const totalUnits = items.reduce((sum, item) => sum + item.cantidad, 0) || 1;
  const coveredUnits = valid.reduce((sum, line) => sum + line.cantidad, 0);
  return {
    totalItems: items.length,
    coveredItems: coveredIds.size,
    missing: items.filter((item) => !coveredIds.has(item.id)).map((item) => item.repuesto),
    ratio: Math.min(1, coveredUnits / totalUnits),
    total: valid.reduce((sum, line) => sum + Number(line.precioTotal || 0), 0),
  };
}

/** Evalúa una oferta: criterios por separado y un resultado global (ok / warn / bad). */
export function evaluateOffer(auction, quote) {
  const coverage = offerCoverage(auction, quote);
  const total = coverage ? coverage.total : (Number(quote.precioFinal ?? quote.precio) || 0);
  const checks = [
    budgetCheck(auction, total, coverage ? coverage.ratio : 1),
    deadlineCheck(auction, quote),
    shippingCheck(auction, quote),
    quantityCheck(auction, quote, coverage),
  ];
  const level = checks.some((c) => c.status === 'bad') ? 'bad' : checks.some((c) => c.status === 'warn') ? 'warn' : 'ok';
  const cap = Number(auction.presupuestoMaximo) || 0;
  return { level, checks, total, coverage, budgetUsage: cap && total ? total / cap : null };
}

const LEVEL_RANK = { ok: 0, warn: 1, bad: 2 };

/**
 * Sugerencia para el comprador: la oferta más barata del mejor nivel de cumplimiento disponible.
 * Devuelve { quoteId, level, reason } o null si no hay ofertas.
 */
export function suggestOffer(auction, quotes) {
  if (!quotes?.length) return null;
  const scored = quotes.map((quote) => ({ quote, fit: evaluateOffer(auction, quote) }));
  scored.sort((a, b) => LEVEL_RANK[a.fit.level] - LEVEL_RANK[b.fit.level] || a.fit.total - b.fit.total);
  const best = scored[0];
  const name = best.quote.nombreTienda;
  const reasons = {
    ok: `${name} cumple tu presupuesto y todas las condiciones que fijaste, y es la más económica entre las que las cumplen.`,
    warn: `Ninguna oferta cumple todo exactamente. ${name} es la que más se acerca a lo que pediste: revisa los puntos en ámbar antes de elegir.`,
    bad: `Ninguna oferta cumple tus condiciones. ${name} es la que menos se aleja, pero conviene revisar cada criterio o esperar más ofertas.`,
  };
  return { quoteId: best.quote.id, level: best.fit.level, reason: reasons[best.fit.level] };
}
