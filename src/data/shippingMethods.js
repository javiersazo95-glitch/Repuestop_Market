import { Bike, Store, Truck } from 'lucide-react';
import { useLista } from '../remoteConfig/hooks';
import { remoteConfig } from '../remoteConfig/remoteConfig';

// Los métodos de envío llegan como texto libre publicado por la tienda
// ("Retiro en tienda, Envío dentro de la comuna ($4500), Envío fuera de la comuna").
//
// Este módulo es la única fuente del ícono de cada método. Antes había cuatro tablas
// repartidas por los componentes y no coincidían entre sí: el envío dentro de la
// comuna se dibujaba en bicicleta en la card del vendedor y en camión en la ficha del
// producto, y el retiro en tienda cambiaba de ícono según la vista.
//
// Convención de todo RepuesTop (app y web, 11-oct): retiro en tienda = tienda con toldo
// (Store), envío dentro de la comuna = bicicleta (Bike), envío fuera de la comuna = camión
// (Truck). La caja (Package) es el producto, no un envío: un método que no se reconoce va con
// el camión, el ícono genérico de despacho.

/** Separa la cadena del backend en métodos individuales. */
export function parseShippingMethods(methods) {
  if (Array.isArray(methods)) return methods.filter(Boolean);
  return String(methods || '').split(',').map((method) => method.trim()).filter(Boolean);
}

function normalizeCommune(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}

/**
 * Restringe las alternativas de despacho a la ubicación real de ambas partes.
 * Retiro siempre se puede ofrecer; el envío local sólo dentro de la misma comuna
 * y el envío fuera sólo entre comunas distintas. Sin comuna verificable no se
 * ofrecen despachos, para no cotizar ni cobrar una modalidad imposible.
 */
export function shippingMethodsForLocation(methods, buyerCommune, sellerCommune) {
  const buyer = normalizeCommune(buyerCommune);
  const seller = normalizeCommune(sellerCommune);
  const options = parseShippingMethods(methods);
  if (!buyer || !seller) return options.filter((method) => resolveShippingService(method).name === 'Retiro en tienda');
  const sameCommune = buyer === seller;
  return options.filter((method) => {
    const name = resolveShippingService(method).name;
    if (name === 'Retiro en tienda') return true;
    if (name === 'Envío dentro de la comuna') return sameCommune;
    if (name === 'Envío fuera de la comuna') return !sameCommune;
    return false;
  });
}

/**
 * Ícono, etiqueta canónica y color de un método de envío.
 * `color`/`bg` los usan las vistas que pintan el método como pastilla de color.
 */
export function resolveShippingService(method) {
  const normalized = String(method || '').toLowerCase().trim();

  if (normalized.includes('retiro') || normalized.includes('tienda')) {
    return { name: 'Retiro en tienda', label: 'Retiro en tienda', icon: Store, color: '#7c3aed', bg: '#f3f0ff' };
  }
  if (normalized.includes('dentro') || normalized.includes('delivery')
    || (normalized.includes('comuna') && !normalized.includes('fuera'))) {
    return { name: 'Envío dentro de la comuna', label: 'Envío dentro de la comuna', icon: Bike, color: '#059669', bg: '#eafbf1' };
  }
  if (normalized.includes('fuera') || normalized.includes('region') || normalized.includes('región')
    || normalized.includes('nacional') || normalized.includes('starken') || normalized.includes('chilexpress')) {
    return { name: 'Envío fuera de la comuna', label: 'Envío fuera de la comuna', icon: Truck, color: '#0284c7', bg: '#e0f2fe' };
  }
  return { name: method, label: method || 'Método de envío', icon: Truck, color: '#475569', bg: '#f1f5f9' };
}

/** Ícono de un tipo de paquete (`pickup` / `local` / `courier` / `other`, ver cartDelivery). */
export function shippingKindIcon(kind) {
  if (kind === 'pickup') return Store;
  if (kind === 'local') return Bike;
  return Truck;
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
 *
 * Mantenedor comun (2026-10-20): los metodos visibles salen de la lista `METODO_ENVIO`
 * (`valor` = id, `etiqueta` = texto del selector, metadata `{canonicalName, hasPrice, note}`).
 * Esta constante es el respaldo. El CSV se escribe SIEMPRE con `canonicalName`, no con la
 * etiqueta: si el dueno renombra la opcion, la cadena guardada sigue siendo la que reconocen la
 * app, el backoffice y `resolveShippingService()`.
 */
export const SHIPPING_METHOD_DEFS_FALLBACK = [
  { id: 'retiro', label: 'Retiro en tienda', canonicalName: 'Retiro en tienda', hasPrice: false },
  { id: 'dentro', label: 'Envío dentro de la comuna', canonicalName: 'Envío dentro de la comuna', hasPrice: true },
  { id: 'fuera', label: 'Envío fuera de la comuna', canonicalName: 'Envío fuera de la comuna', hasPrice: false, note: 'Por pagar en destino' },
];

const FALLBACK_DEF_BY_ID = new Map(SHIPPING_METHOD_DEFS_FALLBACK.map((def) => [def.id, def]));

/** Opciones de `METODO_ENVIO` -> la forma `{id, label, canonicalName, hasPrice, note}` de siempre. */
function toShippingDefs(opciones) {
  return opciones.filter((opcion) => opcion?.valor).map((opcion) => {
    const fallback = FALLBACK_DEF_BY_ID.get(opcion.valor);
    const metadata = opcion.metadata || {};
    return {
      id: opcion.valor,
      label: opcion.etiqueta || fallback?.label || opcion.valor,
      canonicalName: metadata.canonicalName || fallback?.canonicalName || opcion.etiqueta || opcion.valor,
      hasPrice: typeof metadata.hasPrice === 'boolean' ? metadata.hasPrice : Boolean(fallback?.hasPrice),
      note: metadata.note ?? fallback?.note,
    };
  });
}

let lastRemoteDefs = null;
let lastBuiltDefs = SHIPPING_METHOD_DEFS_FALLBACK;

/** Metodos activos (mantenedor o respaldo), para codigo fuera de React. */
export function getShippingMethodDefs() {
  const opciones = remoteConfig.lista('METODO_ENVIO', null);
  if (!opciones) return SHIPPING_METHOD_DEFS_FALLBACK;
  if (opciones !== lastRemoteDefs) {
    lastRemoteDefs = opciones;
    lastBuiltDefs = toShippingDefs(opciones);
  }
  return lastBuiltDefs;
}

/** Metodos activos, al dia con el mantenedor. */
export function useShippingMethodDefs() {
  return useLista('METODO_ENVIO', SHIPPING_METHOD_DEFS_FALLBACK, toShippingDefs);
}

/**
 * Todos los metodos conocidos (activos + respaldo). Leer y escribir el CSV usa esta lista y no
 * solo la de activos: si el dueno oculta un metodo, una tienda que ya lo ofrecia no lo pierde en
 * silencio la proxima vez que guarde su perfil.
 */
function allShippingMethodDefs() {
  const active = getShippingMethodDefs();
  const ids = new Set(active.map((def) => def.id));
  return [...active, ...SHIPPING_METHOD_DEFS_FALLBACK.filter((def) => !ids.has(def.id))];
}

/** Estado vacio del selector, con `retiro` marcado como en la app. */
export function defaultShippingSelections() {
  const selections = Object.fromEntries(
    allShippingMethodDefs().map((def) => [def.id, { enabled: false, price: '' }]),
  );
  if (selections.retiro) selections.retiro.enabled = true;
  return selections;
}

/** CSV del backend -> estado del selector. */
export function parseShippingSelections(rawMethods) {
  const defs = allShippingMethodDefs();
  const selections = Object.fromEntries(
    defs.map((def) => [def.id, { enabled: false, price: '' }]),
  );
  parseShippingMethods(rawMethods).forEach((method) => {
    const canonicalName = resolveShippingService(method).name;
    const def = defs.find((candidate) => candidate.canonicalName === canonicalName);
    if (!def) return;
    const price = shippingMethodPrice(method);
    selections[def.id] = { enabled: true, price: price ? price.replace(/\D/g, '') : '' };
  });
  return selections;
}

/** Estado del selector -> CSV del backend. */
export function buildShippingMethodsString(selections) {
  return allShippingMethodDefs()
    .filter((def) => selections[def.id]?.enabled)
    .map((def) => {
      if (!def.hasPrice) return def.canonicalName;
      const digits = String(selections[def.id]?.price || '').replace(/\D/g, '');
      return digits ? `${def.canonicalName} ($${Number(digits).toLocaleString('es-CL')})` : def.canonicalName;
    })
    .join(', ');
}
