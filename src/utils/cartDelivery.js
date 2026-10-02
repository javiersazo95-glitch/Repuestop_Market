/**
 * Entrega por producto en el checkout (2026-10-02), igual que la app
 * (mobile/utils/cart-delivery.ts): cada repuesto tiene su método de envío, su dirección de
 * destino y el vehículo para el que se compra (el auto propio y el de un familiar). Mismas
 * reglas que el backend (PedidoCheckoutCarritoSupport / EnvioComunaRegla):
 *
 * - "Envío dentro de la comuna" solo llega a la comuna de la tienda; "fuera de la comuna", al resto.
 * - Un despacho por cada destino de una tienda: dos productos a la misma dirección lo comparten.
 * - En una misma tienda no se mezcla retiro con despacho (la entrega de la tienda es una sola).
 *
 * delivery = { method, addressId, vehicleKey }; vehicle = { key, patente, marca, modelo, anio, catalogoId }.
 */

const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/^(comuna|municipalidad) de\s+/, '').replace(/\s+/g, ' ').trim();

export function deliveryKind(method) {
  const m = String(method || '').toLowerCase();
  if (!m) return 'other';
  if (m.includes('retiro') || m.includes('tienda')) return 'pickup';
  if (m.includes('fuera') || m.includes('regiones') || m.includes('courier')) return 'courier';
  if (m.includes('delivery') || m.includes('dentro') || m.includes('comuna')) return 'local';
  if (m.includes('envio') || m.includes('envío')) return 'courier';
  return 'other';
}

export const isDispatch = (method) => ['local', 'courier'].includes(deliveryKind(method));

/** Separa por comas que no estén dentro de paréntesis: el precio puede llevar coma de miles. */
export function parseStoreMethods(text) {
  const methods = [];
  let depth = 0;
  let current = '';
  for (const char of String(text || '')) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      if (current.trim()) methods.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) methods.push(current.trim());
  return methods;
}

export function localDeliveryCost(method) {
  if (deliveryKind(method) !== 'local') return 0;
  const match = String(method).match(/\$\s*([\d.,]+)/) || String(method).match(/(\d[\d.,]*)/);
  return match ? Number(match[1].replace(/[.,]/g, '')) || 0 : 0;
}

export function isStoreComuna(item, address) {
  if (!address) return null;
  if (item.storeComunaId && address.comunaId != null) return String(item.storeComunaId) === String(address.comunaId);
  if (!item.storeComuna || !address.comunaNombre) return null;
  return normalize(item.storeComuna) === normalize(address.comunaNombre);
}

/** Métodos que sirven para ese producto según el destino elegido. */
export function methodsForItem(item, address) {
  const published = parseStoreMethods(item.storeShippingMethods);
  const base = published.length > 0 ? published : (item.shippingMethod ? [item.shippingMethod] : []);
  const sameComuna = isStoreComuna(item, address);
  if (sameComuna === null) return base;
  return base.filter((method) => {
    const kind = deliveryKind(method);
    if (kind === 'local') return sameComuna;
    if (kind === 'courier') return !sameComuna;
    return true;
  });
}

export function vehicleLabel(vehicle) {
  if (!vehicle) return '';
  const model = [vehicle.marca, vehicle.modelo, vehicle.anio].filter((value) => String(value || '').trim()).join(' ');
  const plate = String(vehicle.patente || '').trim().toUpperCase();
  return plate && model ? `${plate} · ${model}` : plate || model || 'Vehículo sin datos';
}

export function vehicleIsComplete(vehicle, plateIdentified = false) {
  if (!vehicle) return false;
  if (plateIdentified) return true;
  return Boolean(String(vehicle.marca || '').trim() && String(vehicle.modelo || '').trim() && Number(vehicle.anio));
}

const storeKey = (item) => String(item.proveedorId || item.vendedor || `producto-${item.id}`);

/** Despachos cobrados: uno por destino de cada tienda con envío dentro de la comuna. */
export function shippingFees(items, deliveries) {
  const charged = new Set();
  const perItem = {};
  let total = 0;
  items.forEach((item) => {
    const delivery = deliveries[item.id];
    const cost = localDeliveryCost(delivery?.method ?? item.shippingMethod);
    perItem[item.id] = 0;
    if (cost <= 0) return;
    const key = `${storeKey(item)}|${delivery?.addressId ?? 'principal'}`;
    if (charged.has(key)) return;
    charged.add(key);
    perItem[item.id] = cost;
    total += cost;
  });
  return { total, perItem, shipments: charged.size };
}

/** Lo que falta para pagar, producto por producto, o '' si está todo. */
export function pendingDeliveryReason(items, deliveries, vehicles, identifiedPlates) {
  const kindByStore = new Map();
  for (const item of items) {
    const delivery = deliveries[item.id];
    const method = delivery?.method;
    const name = item.titulo || 'el repuesto';
    if (!method) return `Elige cómo recibir "${name}".`;
    if (isDispatch(method) && !delivery?.addressId) return `Elige a qué dirección enviar "${name}".`;
    if (!item.esUniversal) {
      const vehicle = vehicles.find((entry) => entry.key === delivery?.vehicleKey);
      if (!vehicle) return `Indica para qué vehículo es "${name}".`;
      const plate = String(vehicle.patente || '').trim().toUpperCase();
      if (!vehicleIsComplete(vehicle, Boolean(plate) && identifiedPlates.has(plate))) {
        return `Completa el vehículo de "${name}": patente identificada o marca, modelo y año.`;
      }
    }
    const pickup = deliveryKind(method) === 'pickup';
    const key = storeKey(item);
    if (kindByStore.has(key) && kindByStore.get(key) !== pickup) {
      return `En ${item.storeName || item.vendedor || 'una tienda'} no puedes combinar retiro con despacho: elige lo mismo para sus productos.`;
    }
    kindByStore.set(key, pickup);
  }
  return '';
}
