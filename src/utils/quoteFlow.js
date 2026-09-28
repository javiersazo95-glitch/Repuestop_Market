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

/**
 * Solicitud de cotización: unidades, método de envío, chasis y nota.
 *
 * El backend la guarda como datos en la conversación (`solicitud`, monorepo V2026092802) y
 * publica en el chat un mensaje en lista. Antes sólo existía como texto del primer mensaje y
 * este parser caía en "Retiro en tienda" cuando no lo podía leer: un comprador que pedía
 * "Envío dentro de la comuna" terminaba cotizado y cobrado como retiro. Ahora un método que no
 * se puede determinar queda vacío.
 *
 * Contraparte de la app: `mobile/utils/quote-request.ts`.
 */
export const QUOTE_SHIPPING_LABELS = {
  RETIRO: 'Retiro en tienda',
  DENTRO_DE_LA_COMUNA: 'Envío dentro de la comuna',
  FUERA_DE_LA_COMUNA: 'Envío fuera de la comuna',
};

/** Misma clasificación que `EnvioComunaRegla` del backend, sin caer en retiro por descarte. */
export function shippingCodeFromText(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (QUOTE_SHIPPING_LABELS[raw]) return raw;
  const text = raw.toLowerCase();
  if (text.includes('delivery') || text.includes('dentro') || (text.includes('comuna') && !text.includes('fuera'))) {
    return 'DENTRO_DE_LA_COMUNA';
  }
  if (text.includes('regiones') || text.includes('courier') || text.includes('fuera')
    || text.includes('envio') || text.includes('envío')) {
    return 'FUERA_DE_LA_COMUNA';
  }
  if (text.includes('retiro') || text.includes('tienda')) return 'RETIRO';
  return '';
}

function quantityLabel(amount) {
  return `${amount} ${amount === 1 ? 'unidad' : 'unidades'}`;
}

/** El mismo mensaje en lista que publica el backend (se usa sólo como respaldo local). */
export function buildQuoteRequestMessage({ quantity, shippingMethod, chassis, notes }, productName = '') {
  const amount = Math.max(1, Number(quantity) || 1);
  const code = shippingCodeFromText(shippingMethod);
  const lines = ['Solicitud de cotización'];
  if (productName?.trim()) lines.push(`• Producto: ${productName.trim()}`);
  lines.push(`• Unidades: ${quantityLabel(amount)}`);
  lines.push(`• Método de envío: ${QUOTE_SHIPPING_LABELS[code] || shippingMethod}`);
  lines.push(`• Chasis: ${chassis?.trim() || 'No informado'}`);
  if (notes?.trim()) lines.push(`• Nota: ${notes.trim()}`);
  return lines.join('\n');
}

function untilFieldEnd(value = '') {
  const end = value.search(/\.\s*(?:chasis|nota):|\.\s*$/i);
  return (end >= 0 ? value.slice(0, end) : value).trim();
}

export function isQuoteRequestMessage(text) {
  return /^\s*solicitud de cotizaci[oó]n/i.test(text || '');
}

/**
 * Lee el mensaje en lista o el antiguo de una línea ("Solicitud de cotización por 2 unidades.
 * Metodo de envio: X. Chasis: Y. Nota: Z"). Sólo como respaldo de `quote.solicitud`.
 */
export function parseQuoteRequestMessage(message = '') {
  const messageText = String(message || '').trim();
  if (!isQuoteRequestMessage(messageText)) {
    return {
      requestedQty: '1 unidad', requestedDeliveryTerms: '', requestedShippingCode: '',
      hasRequestedDeliveryTerms: false, requestedChassis: '', requestedNotes: messageText,
    };
  }
  const qty = Number(messageText.match(/(?:solicitud de cotizaci[oó]n por|unidades:)\s*(\d{1,4})/i)?.[1]);
  const methodRaw = messageText.match(/m[eé]todo de env[ií]o:\s*([^\n]*)/i)?.[1];
  const code = methodRaw ? shippingCodeFromText(untilFieldEnd(methodRaw)) : '';
  const chassisRaw = messageText.match(/chasis:\s*([^\n]*)/i)?.[1];
  let chassis = chassisRaw ? untilFieldEnd(chassisRaw) : '';
  if (/^no (especificado|informado)/i.test(chassis)) chassis = '';
  return {
    requestedQty: Number.isFinite(qty) && qty > 0 ? quantityLabel(qty) : '1 unidad',
    requestedDeliveryTerms: QUOTE_SHIPPING_LABELS[code] || '',
    requestedShippingCode: code,
    hasRequestedDeliveryTerms: Boolean(code),
    requestedChassis: chassis,
    requestedNotes: messageText.match(/nota:\s*([\s\S]*)/i)?.[1]?.trim() || '',
  };
}

/**
 * Lo que pidió el comprador: la `solicitud` del backend y, sin ella, la ÚLTIMA solicitud en
 * texto (una modificación manda otra a la misma conversación).
 */
export function resolveQuoteRequest(solicitud, messages = [], fallbackText = '') {
  if (solicitud && (solicitud.metodoEnvio || solicitud.cantidad)) {
    const code = shippingCodeFromText(solicitud.metodoEnvio);
    return {
      requestedQty: solicitud.cantidadEtiqueta || (solicitud.cantidad ? quantityLabel(solicitud.cantidad) : '1 unidad'),
      requestedDeliveryTerms: solicitud.metodoEnvioEtiqueta || QUOTE_SHIPPING_LABELS[code] || '',
      requestedShippingCode: code,
      hasRequestedDeliveryTerms: Boolean(code),
      requestedChassis: solicitud.chasis || '',
      requestedNotes: solicitud.nota || '',
    };
  }
  const latest = [...(messages || [])].reverse().find((message) => isQuoteRequestMessage(message?.texto));
  return parseQuoteRequestMessage(latest?.texto || (isQuoteRequestMessage(fallbackText) ? fallbackText : ''));
}

/** Despacho que cobrará el checkout: el que informa el backend o el "(costo: $X)" guardado. */
export function quoteShippingCost(quote) {
  if (!quote) return 0;
  if (typeof quote.costoDespacho === 'number') return quote.costoDespacho;
  if (shippingCodeFromText(quote.condicionesEntrega) !== 'DENTRO_DE_LA_COMUNA') return 0;
  const saved = quote.condicionesEntrega?.match(/costo:\s*\$?([\d.,]+)/i)?.[1]?.replace(/[.,]/g, '');
  return Number(saved || 0);
}

/** Productos menos descuento: lo cotizado sin despacho. */
export function quoteProductsTotal(quote) {
  if (!quote) return 0;
  const quantity = quantityFromLabel(quote.cantidad);
  if (quote.precioUnitario) return Math.max(0, Number(quote.precioUnitario) * quantity - (Number(quote.descuento) || 0));
  return Number(quote.precioFinal ?? quote.precio ?? 0);
}

/**
 * Lo que paga el comprador y la base de TODAS las comisiones: productos menos descuento más
 * el envío dentro de la comuna (backend `PedidoCheckoutCotizacionSupport`, O86).
 */
export function quoteChargeBase(quote) {
  if (!quote) return 0;
  if (typeof quote.totalConDespacho === 'number' && quote.totalConDespacho > 0) return quote.totalConDespacho;
  return quoteProductsTotal(quote) + quoteShippingCost(quote);
}

/** Condición de entrega sin el "(costo: $X)" que agrega el backend. */
export function deliveryTermsLabel(value = '') {
  return String(value || '').replace(/\s*\(costo:.*\)$/i, '').trim();
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

/**
 * Momento desde el que se cuenta la vigencia.
 *
 * La fila de la cotizacion es UNICA por conversacion y se REUTILIZA cada vez que
 * el vendedor edita o vuelve a emitir su oferta, pero `createdAt` es inmutable:
 * contar desde ahi hacia que una cotizacion reemitida dias despues llegara ya
 * vencida al comprador, sin poder pagarla. Por eso el backend expone
 * `vigenteDesde` (`CotizacionConversacionResponseDTO`, monorepo `fae41ed`), que
 * es el `updatedAt` de la fila. El respaldo a `createdAt` cubre a los ambientes
 * que todavia no tengan ese backend.
 */
function quoteIssuedAt(quote) {
  return quote?.vigenteDesde || quote?.createdAt || '';
}

export function getQuoteExpiration(quote) {
  const duration = validityMilliseconds(quote?.vigencia);
  const issuedAt = new Date(quoteIssuedAt(quote)).getTime();
  if (!duration || Number.isNaN(issuedAt)) return null;
  return issuedAt + duration;
}

export function quoteExpirationLabel(quote, now = Date.now()) {
  const expiresAt = getQuoteExpiration(quote);
  if (!expiresAt) return quote?.vigencia || 'Vigencia no informada';
  const remaining = expiresAt - now;
  if (remaining <= 0) return 'Cotización vencida';
  // Se redondea UNA vez sobre el total y despues se reparte. Truncando las horas
  // y redondeando aparte los minutos del resto, a falta de 23 h 59 min y medio el
  // `ceil` subia los minutos a 60 sin tocar la hora: "Vence en 23 h 60 min". Pasaba
  // en los segundos siguientes a cada emision, que es cuando el comprador mira.
  const totalMinutes = Math.max(1, Math.ceil(remaining / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `Vence en ${minutes} min`;
  return minutes > 0 ? `Vence en ${hours} h ${minutes} min` : `Vence en ${hours} h`;
}

export function isQuoteExpired(quote) {
  const expiresAt = getQuoteExpiration(quote);
  return expiresAt != null && Date.now() >= expiresAt;
}
