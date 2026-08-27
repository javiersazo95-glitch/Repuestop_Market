import { Bike, Building2, Package, Truck } from 'lucide-react';

// Los métodos de envío llegan como texto libre publicado por la tienda
// ("Retiro en tienda, Envío dentro de la comuna ($4500), Envío fuera de la comuna").
//
// Este módulo es la única fuente del ícono de cada método. Antes había cuatro tablas
// repartidas por los componentes y no coincidían entre sí: el envío dentro de la
// comuna se dibujaba en bicicleta en la card del vendedor y en camión en la ficha del
// producto, y el retiro en tienda cambiaba de ícono según la vista.

/** Separa la cadena del backend en métodos individuales. */
export function parseShippingMethods(methods) {
  if (Array.isArray(methods)) return methods.filter(Boolean);
  return String(methods || '').split(',').map((method) => method.trim()).filter(Boolean);
}

/**
 * Ícono, etiqueta canónica y color de un método de envío.
 * `color`/`bg` los usan las vistas que pintan el método como pastilla de color.
 */
export function resolveShippingService(method) {
  const normalized = String(method || '').toLowerCase().trim();

  if (normalized.includes('retiro') || normalized.includes('tienda')) {
    return { name: 'Retiro en tienda', label: 'Retiro en tienda', icon: Building2, color: '#7c3aed', bg: '#f3f0ff' };
  }
  if (normalized.includes('dentro') || (normalized.includes('comuna') && !normalized.includes('fuera'))) {
    return { name: 'Envío dentro de la comuna', label: 'Envío dentro de la comuna', icon: Bike, color: '#059669', bg: '#eafbf1' };
  }
  if (normalized.includes('fuera') || normalized.includes('region') || normalized.includes('región')
    || normalized.includes('nacional') || normalized.includes('starken') || normalized.includes('chilexpress')) {
    return { name: 'Envío fuera de la comuna', label: 'Envío fuera de la comuna', icon: Truck, color: '#0284c7', bg: '#e0f2fe' };
  }
  return { name: method, label: method || 'Método de envío', icon: Package, color: '#475569', bg: '#f1f5f9' };
}

/** Precio entre paréntesis que a veces incluye la tienda: "... ($4500)" -> "$4500". */
export function shippingMethodPrice(method) {
  return String(method || '').match(/\(([^)]+)\)/)?.[1] || null;
}

/**
 * El checkout del backend recibe UN `metodoEnvio` para todo el pedido, pero cada línea
 * del carrito lleva el suyo. En `PedidoCheckoutCarritoSupport` el método de la línea
 * tiene prioridad y este valor es solo el respaldo para las líneas que llegaron sin
 * método, así que se manda cuando todas coinciden y vacío cuando hay mezcla.
 *
 * Concatenarlos ("A | B") era peligroso, no solo feo: para una línea sin costo de envío
 * el backend hace `metodoEnvio.replaceAll("[^0-9]", "")` sobre este string, y con dos
 * métodos con precio pegaba los dígitos de ambos ($4.500 + $3.990 -> 45003990).
 */
export function checkoutFallbackShippingMethod(items) {
  const methods = [...new Set((items || []).map((item) => item.shippingMethod).filter(Boolean))];
  return methods.length === 1 ? methods[0] : '';
}

/** Convierte el precio publicado en el método ("$4.500") a un número para el checkout. */
export function shippingMethodCost(method) {
  const price = shippingMethodPrice(method);
  if (!price) return 0;
  const numeric = Number(String(price).replace(/[^0-9]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Metodos que una tienda puede ofrecer, con el nombre EXACTO que espera el backend.
 *
 * `Tienda.shippingMethods` es una cadena CSV compartida por las tres plataformas, igual
 * que `hours`: si un cliente escribe otra etiqueta, la misma tienda se ve distinta segun
 * donde se mire y `resolveShippingService()` deja de reconocer el metodo. Es la
 * contraparte de `SHIPPING_METHOD_OPTIONS` de `mobile/hooks/auth/useShippingField.ts`.
 *
 * "Fuera de la comuna" va por courier externo y lo paga el comprador al recibir, asi que
 * la tienda no le fija precio: por eso no lleva input.
 */
export const SHIPPING_METHOD_DEFS = [
  { id: 'retiro', label: 'Retiro en tienda', canonicalName: 'Retiro en tienda', hasPrice: false },
  { id: 'dentro', label: 'Envío dentro de la comuna', canonicalName: 'Envío dentro de la comuna', hasPrice: true },
  { id: 'fuera', label: 'Envío fuera de la comuna', canonicalName: 'Envío fuera de la comuna', hasPrice: false, note: 'Por pagar en destino' },
];

/** Estado vacio del selector, con `retiro` marcado como en la app. */
export function defaultShippingSelections() {
  const selections = Object.fromEntries(
    SHIPPING_METHOD_DEFS.map((def) => [def.id, { enabled: false, price: '' }]),
  );
  selections.retiro.enabled = true;
  return selections;
}

/** CSV del backend -> estado del selector. */
export function parseShippingSelections(rawMethods) {
  const selections = Object.fromEntries(
    SHIPPING_METHOD_DEFS.map((def) => [def.id, { enabled: false, price: '' }]),
  );
  parseShippingMethods(rawMethods).forEach((method) => {
    const canonicalName = resolveShippingService(method).name;
    const def = SHIPPING_METHOD_DEFS.find((candidate) => candidate.canonicalName === canonicalName);
    if (!def) return;
    const price = shippingMethodPrice(method);
    selections[def.id] = { enabled: true, price: price ? price.replace(/\D/g, '') : '' };
  });
  return selections;
}

/** Estado del selector -> CSV del backend. */
export function buildShippingMethodsString(selections) {
  return SHIPPING_METHOD_DEFS
    .filter((def) => selections[def.id]?.enabled)
    .map((def) => {
      if (!def.hasPrice) return def.label;
      const digits = String(selections[def.id]?.price || '').replace(/\D/g, '');
      return digits ? `${def.label} ($${Number(digits).toLocaleString('es-CL')})` : def.label;
    })
    .join(', ');
}
