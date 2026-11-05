/**
 * Vigencia de una oferta de tienda para el comprador: "Vencida" o cuanto le queda ("Vence en 1 día 04 h 23 min").
 * El servidor calcula `venceAt` y `vencida` desde que la tienda envia la oferta.
 */
export function offerRemainingText(quote, now = Date.now()) {
  if (!quote) return '';
  if (quote.vencida) return 'Vencida';
  if (!quote.venceAt) return '';
  const totalMinutes = Math.max(0, Math.floor((new Date(quote.venceAt).getTime() - now) / 60000));
  if (totalMinutes <= 0) return 'Vencida';
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) return `Vence en ${days} ${days === 1 ? 'día' : 'días'} ${pad(hours)} h`;
  if (hours > 0) return `Vence en ${pad(hours)} h ${pad(minutes)} min`;
  return `Vence en ${minutes} min`;
}

/** "48 horas · Vence en 1 día 04 h" para mostrar junto a la vigencia elegida por la tienda. */
export function offerValidityLabel(quote, now = Date.now()) {
  const left = offerRemainingText(quote, now);
  if (!left) return quote?.vigencia || '—';
  if (left === 'Vencida') return `${quote?.vigencia || 'Oferta'} · Vencida`;
  return `${quote?.vigencia || '—'} · ${left}`;
}
