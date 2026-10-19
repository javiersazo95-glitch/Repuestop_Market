/**
 * Productos sin derecho a devolucion (decision del usuario, 2026-10-18): todo repuesto de la
 * categoria Electrico -o de una de sus subcategorias- no admite devolucion por arrepentimiento.
 * La garantia legal por falla, no recepcion o producto equivocado se mantiene (Ley 19.496,
 * irrenunciable). Misma regla que el backend (`ProductoSinDevolucion`) y la app
 * (`mobile/utils/no-return-products.ts`).
 */
export const NO_RETURN_TITLE = 'Sin derecho a devolución';
export const NO_RETURN_DETAIL = 'Este repuesto pertenece a la categoría Eléctrico, por lo que no tiene derecho a devolución. Si presenta una falla, mantienes la garantía legal.';
// Aviso antes de que el producto entre al carro: uno para "Añadir al carro" y otro para "Comprar"
// (antes "Comprar" tambien decia "Estas añadiendo al carro"). Mismos textos que la app.
const NO_RETURN_RULE = 'Los productos de la categoría Eléctrico no tienen derecho a devolución. Si presenta una falla, mantienes la garantía legal.';
export const NO_RETURN_CART_MESSAGE = `Estás añadiendo al carro un repuesto eléctrico. ${NO_RETURN_RULE}`;
export const NO_RETURN_BUY_MESSAGE = `Estás por comprar un repuesto eléctrico. ${NO_RETURN_RULE}`;
export const NO_RETURN_CLAIM_MESSAGE = 'Este producto pertenece a la categoría Eléctrico, por lo que no tiene derecho a devolución. Solo puedes reclamar si llegó con falla, no es compatible o es un producto incorrecto.';

/** Motivos de reclamo que son una devolucion (el backend los rechaza para electricos). */
export const NO_RETURN_CLAIM_REASONS = ['buyer_remorse', 'wrong_purchase'];

function normalize(value) {
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Si la categoria (por nombre) es la de electricos; sus subcategorias heredan la regla. */
export function isNoReturnCategory(category) {
  return Boolean(category) && normalize(category).startsWith('electric');
}

/** Un producto o linea de pedido: usa la marca del backend y, si no viene, el nombre de categoria. */
export function isNoReturnProduct(item) {
  if (!item) return false;
  return item.sinDevolucion === true
    || isNoReturnCategory(item.categoriaNombre || item.categoria || item.category);
}
