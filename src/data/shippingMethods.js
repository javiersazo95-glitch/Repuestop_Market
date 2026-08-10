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

/** Convierte el precio publicado en el método ("$4.500") a un número para el checkout. */
export function shippingMethodCost(method) {
  const price = shippingMethodPrice(method);
  if (!price) return 0;
  const numeric = Number(String(price).replace(/[^0-9]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}
