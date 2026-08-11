export const QUOTE_AVAILABILITY_OPTIONS = [
  'Disponible para retiro hoy',
  'Disponible para despacho hoy',
  'Stock disponible',
  'Stock limitado',
  'Disponible a pedido',
  'Confirmar stock antes de pagar',
];

export const QUOTE_DELIVERY_OPTIONS = [
  'Retiro en tienda',
  'Envío dentro de la comuna',
  'Envío fuera de la comuna',
];

export const QUOTE_WARRANTY_OPTIONS = [
  'Sin garantia informada',
  '7 dias',
  '15 dias',
  '30 dias',
  '3 meses',
  '6 meses',
];

export const QUOTE_VALIDITY_OPTIONS = [
  'Valida por 24 horas',
  'Valida por 48 horas',
  'Valida por 72 horas',
  'Valida por 7 dias',
  'Hasta agotar stock',
];

export function buildQuoteRequestMessage({ quantity, shippingMethod, chassis, notes }) {
  const amount = Math.max(1, Number(quantity) || 1);
  const chassisCopy = chassis?.trim() ? ` Chasis: ${chassis.trim()}.` : '';
  const notesCopy = notes?.trim() ? ` Nota: ${notes.trim()}` : '';
  return `Solicitud de cotización por ${amount} ${amount === 1 ? 'unidad' : 'unidades'}. Metodo de envio: ${shippingMethod}.${chassisCopy}${notesCopy}`;
}

export function parseQuoteRequestMessage(message = '') {
  const messageText = message.trim();
  const qtyMatch = messageText.match(/Solicitud de cotización por\s+([^.]+)/i);
  const shippingMatch = messageText.match(/Metodo de envio:\s*(.*?)(?:\.\s*(?:Chasis|Nota):|\.$|$)/i);
  const chassisMatch = messageText.match(/Chasis:\s*([^.]+)/i);
  const notesMatch = messageText.match(/Nota:\s*(.*)/i);

  return {
    requestedQty: qtyMatch?.[1]?.trim() || '1 unidad',
    requestedDeliveryTerms: shippingMatch?.[1]?.trim() || 'Retiro en tienda',
    hasRequestedDeliveryTerms: Boolean(shippingMatch?.[1]?.trim()),
    requestedChassis: chassisMatch?.[1]?.trim() || '',
    requestedNotes: notesMatch?.[1]?.trim() || (!qtyMatch ? messageText : ''),
  };
}

export function quantityFromLabel(value) {
  const parsed = Number(String(value || '').match(/\d+/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function validityMilliseconds(validity = '') {
  const lower = validity.toLowerCase();
  const amount = Number(lower.match(/\d+/)?.[0]);
  if (!Number.isFinite(amount)) return null;
  if (lower.includes('hora')) return amount * 60 * 60 * 1000;
  if (lower.includes('dia') || lower.includes('día')) return amount * 24 * 60 * 60 * 1000;
  return null;
}

export function getQuoteExpiration(quote) {
  const duration = validityMilliseconds(quote?.vigencia);
  const createdAt = new Date(quote?.createdAt || '').getTime();
  if (!duration || Number.isNaN(createdAt)) return null;
  return createdAt + duration;
}

export function quoteExpirationLabel(quote, now = Date.now()) {
  const expiresAt = getQuoteExpiration(quote);
  if (!expiresAt) return quote?.vigencia || 'Vigencia no informada';
  const remaining = expiresAt - now;
  if (remaining <= 0) return 'Cotización vencida';
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.max(1, Math.ceil((remaining % 3600000) / 60000));
  return hours > 0 ? `Vence en ${hours} h ${minutes} min` : `Vence en ${minutes} min`;
}

export function isQuoteExpired(quote) {
  const expiresAt = getQuoteExpiration(quote);
  return expiresAt != null && Date.now() >= expiresAt;
}
