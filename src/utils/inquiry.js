/**
 * Pregunta de disponibilidad (nace en Repuestín, conversación tipo `consulta_repuesto`). No es una cotización:
 * la tienda responde si lo tiene, ofrece un repuesto cargado y el comprador lo compra desde su ficha como
 * cualquier compra. Copia de `mobile/utils/inquiry-stage.ts` de la app.
 */
export const INQUIRY_CONVERSATION_TYPE = 'consulta_repuesto';
export const INQUIRY_KIND_LABEL = 'Pregunta de disponibilidad';
export const REPUESTIN_IMAGE = '/repuestin.webp';

export const isInquiryConversation = (conversation) => (
  String(conversation?.tipo || '').toLowerCase() === INQUIRY_CONVERSATION_TYPE
);

/** Cotización de siempre (sin tipo o `cotizacion`). */
export const isQuoteConversation = (conversation) => (
  !conversation?.tipo || String(conversation.tipo).toLowerCase() === 'cotizacion'
);

/** Lo que muestra el menú "Cotizaciones": cotizaciones y preguntas de disponibilidad. */
export const isQuotesMenuConversation = (conversation) => isQuoteConversation(conversation) || isInquiryConversation(conversation);

/** Estado: 'waiting' | 'noStock' | 'offered' | 'purchased'. */
export function inquiryStage(conversation) {
  if (conversation?.consultaCompradaPedidoId != null) return 'purchased';
  if (conversation?.productoId) return 'offered';
  if (conversation?.consultaNoLoTiene) return 'noStock';
  return 'waiting';
}

const LABELS = {
  buyer: { waiting: 'Esperando respuesta', noStock: 'No lo tiene', offered: 'Repuesto ofrecido', purchased: 'Comprado' },
  seller: { waiting: 'Sin responder', noStock: 'No lo tienes', offered: 'Ofrecido', purchased: 'Vendido' },
};

export const inquiryStageLabel = (stage, viewer) => LABELS[viewer]?.[stage] || '';

/** Tono del estado, igual que la app: azul esperando, rojo sin stock, ámbar ofrecido, verde comprado. */
export const INQUIRY_STAGE_TONE = { waiting: 'blue', noStock: 'red', offered: 'amber', purchased: 'green' };

/** Mensajes automáticos del flujo (oferta, compra, "no lo tengo"): se muestran como eventos, no como burbujas. */
const OFFER_PREFIX = 'Te ofrezco este repuesto: ';
const PURCHASE_PREFIX = 'Ya compré el repuesto: ';
const NO_STOCK_TEXT = 'Por ahora no tengo este repuesto. ¡Gracias por consultarme!';

const productFrom = (text, prefix) => text.slice(prefix.length).replace(/\. Revisa su detalle.*$/, '').replace(/\.$/, '').trim();

export function inquiryEventLabel(text, viewer) {
  const clean = String(text || '').trim();
  if (clean.startsWith(OFFER_PREFIX)) {
    const product = productFrom(clean, OFFER_PREFIX);
    return viewer === 'seller' ? `Ofreciste ${product}` : `Te ofrecieron ${product}`;
  }
  if (clean.startsWith(PURCHASE_PREFIX)) {
    const product = productFrom(clean, PURCHASE_PREFIX);
    return viewer === 'seller' ? `El comprador compró ${product}` : `Compraste ${product}`;
  }
  if (clean === NO_STOCK_TEXT) {
    return viewer === 'seller' ? 'Respondiste que no lo tienes' : 'La tienda respondió que no lo tiene';
  }
  return null;
}

export function formatInquiryPrice(value) {
  const number = Number(value);
  if (value == null || !Number.isFinite(number) || number <= 0) return null;
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(number);
}

/**
 * Contador del menú "Cotizaciones" de la tienda: preguntas de disponibilidad de Repuestín con novedades
 * sin leer (una pregunta nueva o una respuesta del comprador). Cuenta conversaciones, no mensajes.
 */
export function countInquiryNews(conversations) {
  return (conversations || []).filter((conversation) => (
    isInquiryConversation(conversation) && Number(conversation.mensajesNoLeidos || 0) > 0
  )).length;
}

/**
 * Filtros del panel: en qué grupo cae una pregunta. Vendedor: sin responder (esperando), respondidas
 * (no lo tiene u ofrecido) y cerradas (vendido o conversación cerrada). Comprador: solicitudes (esperando
 * o sin stock), recibidas (ofrecido) y acuerdos (comprado).
 */
export function inquirySellerState(conversation) {
  const stage = inquiryStage(conversation);
  if (stage === 'purchased' || conversation?.estado === 'CERRADA') return 'closed';
  return stage === 'waiting' ? 'pending' : 'sent';
}

export function inquiryBuyerState(conversation) {
  const stage = inquiryStage(conversation);
  if (stage === 'purchased' || conversation?.estado === 'CERRADA') return 'agreements';
  return stage === 'offered' ? 'quotes' : 'requests';
}

/** Chasis y patente que vienen en la solicitud de la pregunta (la patente nunca se muestra). */
export function inquiryVehicleIds(conversation) {
  const solicitud = conversation?.solicitud || {};
  return {
    chassis: String(solicitud.chasis || '').trim(),
    hasPlate: Boolean(String(solicitud.patente || '').trim()),
  };
}
