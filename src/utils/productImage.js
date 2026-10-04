import { CATEGORY_IMAGE_BY_ID, getPartImage } from '../data/categories';

/**
 * Foto referencial de un repuesto sin foto propia (o con una que no carga): la de LA PIEZA
 * que nombra el título y, si no se parece a nada, la de su categoría. Es el mismo respaldo
 * que usa la tarjeta del catálogo, para que el producto se vea igual en la ficha y el carrito.
 */
export function productReferenceImage(product) {
  if (!product) return null;
  return getPartImage(product.titulo, product.subcategoria, product.categoriaNombre)
    || CATEGORY_IMAGE_BY_ID[product.categoria]
    || null;
}
