/**
 * Los "paquetes" de un pedido para la sección Entrega del detalle (2026-10-02), igual que la app
 * (mobile/utils/order-packages.ts): uno por cada tienda, método y destino -- la misma regla con la
 * que se cobran los despachos --. Cada uno dice cómo llega, a dónde (o dónde se retira) y para qué
 * vehículo, con sus repuestos. Nada se junta entre paquetes.
 *
 * Pedidos anteriores al checkout por producto (sin entrega por línea): un paquete por tienda con
 * el método de su subordén y la dirección y el vehículo del pedido.
 */

const LABELS = {
  pickup: 'Retiro en tienda',
  local: 'Envío dentro de la comuna',
  courier: 'Envío fuera de la comuna',
  other: 'A coordinar con la tienda',
};
const SHIPPING_TYPE_KIND = { store_pickup: 'pickup', local_delivery: 'local', courier_por_pagar: 'courier' };

function kindOf(method) {
  const m = String(method || '').toLowerCase();
  if (!m) return 'other';
  if (m.includes('retiro') || m.includes('tienda') || m === 'store_pickup') return 'pickup';
  if (m.includes('fuera') || m.includes('courier') || m.includes('regiones')) return 'courier';
  if (m.includes('dentro') || m.includes('delivery') || m.includes('comuna')) return 'local';
  return 'other';
}

const cleanMethod = (method) => String(method).replace(/\s*\(.*\)\s*$/, '').trim() || method;

export function buildOrderPackages(order, { fallbackAddress = null, fallbackMethod = null } = {}) {
  const subBySeller = new Map((order?.subordenes || []).map((sub) => [String(sub.proveedorId), sub]));
  const pedidoVehicleLabel = [order?.vehiculoMarca, order?.vehiculoModelo, order?.vehiculoVersion, order?.vehiculoAnio]
    .filter(Boolean).join(' ');
  const packages = new Map();
  // Con entrega por línea, el vehículo del pedido no se reparte: un repuesto sin vehículo propio
  // es universal. Solo los pedidos anteriores (sin datos por línea) usan el del pedido.
  const entregaPorLinea = (order?.items || []).some((item) => item.metodoEnvio || item.vehiculoPatente || item.vehiculoMarca);

  (order?.items || []).forEach((item) => {
    const sellerId = item.proveedorId != null ? String(item.proveedorId) : '';
    const sub = subBySeller.get(sellerId);
    const rawMethod = item.metodoEnvio
      || (sub?.tipoEnvio ? LABELS[SHIPPING_TYPE_KIND[sub.tipoEnvio] || 'other'] : '')
      || fallbackMethod
      || '';
    const kind = kindOf(rawMethod);
    const method = rawMethod ? cleanMethod(rawMethod) : LABELS[kind];
    const itemAddress = item.entregaDireccion ? [item.entregaDireccion, item.entregaComuna].filter(Boolean).join(', ') : null;
    const address = kind === 'pickup' ? null : (itemAddress || fallbackAddress || null);
    const storeName = item.proveedorNombre || sub?.nombreTienda || 'Tienda';
    const key = `${sellerId || storeName}|${kind}|${address || ''}`;
    const pkg = packages.get(key) || {
      key, sellerId, storeName, kind, method, address,
      pickupAddress: [item.proveedorDireccion, item.proveedorComuna].filter(Boolean).join(', '),
      pickupHours: item.proveedorHorario || '',
      products: [], vehicles: [],
    };
    const productName = item.nombre || item.productName || 'Repuesto';
    pkg.products.push(productName);

    const itemLabel = [item.vehiculoMarca, item.vehiculoModelo, item.vehiculoAnio].filter(Boolean).join(' ');
    const tieneVehiculoPropio = Boolean(item.vehiculoPatente || itemLabel);
    const usaVehiculoDelPedido = !tieneVehiculoPropio && !entregaPorLinea && !item.esUniversal;
    const plate = tieneVehiculoPropio ? (item.vehiculoPatente || '') : usaVehiculoDelPedido ? (order?.vehiculoPatente || '') : '';
    const label = tieneVehiculoPropio ? itemLabel : usaVehiculoDelPedido ? pedidoVehicleLabel : '';
    const chassis = tieneVehiculoPropio ? (item.vehiculoChasis || '') : usaVehiculoDelPedido ? (order?.vehiculoChasis || '') : '';
    if (plate || label) {
      const vehicle = pkg.vehicles.find((entry) => entry.plate === plate && entry.label === label);
      if (vehicle) vehicle.products.push(productName);
      else pkg.vehicles.push({ plate, label, chassis, products: [productName] });
    }
    packages.set(key, pkg);
  });

  return [...packages.values()];
}
