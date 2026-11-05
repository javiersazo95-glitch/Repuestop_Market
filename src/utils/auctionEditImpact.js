/**
 * Que pasa con las ofertas ya recibidas cuando el comprador edita su encargo.
 * El servidor descarta las ofertas vigentes si cambian los repuestos o la comuna de entrega; este
 * ayudante lo anticipa para avisar al comprador ANTES de guardar.
 */

const plateOf = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();

/** Ofertas que hoy compiten: enviadas, sin aceptar y sin vencer. */
export function activeOffersCount(auction) {
  return (auction?.cotizaciones || []).filter((quote) => quote.estado === 'ENVIADA' && !quote.aceptada && !quote.vencida).length;
}

/** `items`: los repuestos del formulario ({nombre, cantidad, otroVehiculo, patente}); `comuna`: la comuna elegida. */
export function editDiscardsOffers(auction, { items, patente, comuna }) {
  if (!auction) return false;
  const before = (auction.items || []).map((item) => [String(item.repuesto || '').trim(), Number(item.cantidad) || 1, item.vehiculoPropio ? plateOf(item.patente) : '']);
  const after = (items || []).map((item) => [String(item.nombre || '').trim(), parseInt(item.cantidad, 10) || 1, item.otroVehiculo ? plateOf(item.patente) : '']);
  const itemsChanged = JSON.stringify(before) !== JSON.stringify(after);
  const patenteChanged = Boolean(auction.patente) && Boolean(patente) && plateOf(auction.patente) !== plateOf(patente) && !/\*/.test(String(auction.patente));
  const comunaChanged = Boolean(auction.comuna) && Boolean(comuna) && String(auction.comuna).trim().toLowerCase() !== String(comuna).trim().toLowerCase();
  return itemsChanged || patenteChanged || comunaChanged;
}

export function discardOffersMessage(count) {
  const noun = count === 1 ? 'oferta vigente' : 'ofertas vigentes';
  return `Tu encargo tiene ${count} ${noun}. Al cambiar los repuestos o la comuna de entrega quedarán sin efecto y las tiendas recibirán un aviso para ofertar de nuevo.`;
}
