/**
 * Mínimo de despacho (22-nov): monto mínimo de compra que fija la tienda para despachar, dentro o fuera de la
 * comuna. Se compara con la suma de los productos de ESA tienda en el carrito (sin el envío). El retiro en tienda
 * no tiene mínimo. El backend lo hace cumplir en el checkout (MinimoDespachoRegla); aquí solo se muestra.
 * Misma lógica que la app (`mobile/utils/minimo-despacho.ts`).
 */

export const MINIMO_DESPACHO_MAXIMO = 10_000_000;

/** "$15.000" (formato chileno, sin decimales). */
export function formatMinimo(value) {
  const n = Math.max(0, Math.ceil(Number(value) || 0));
  return `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** El mínimo vigente de un valor del backend: un número positivo, o null si no hay. */
export function minimoVigente(value) {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Lo que escribe el vendedor ("15.000", "$15000") a pesos; null si está vacío o no es un monto. */
export function parseMinimoInput(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Para el input: solo dígitos, con separador de miles ("15000" -> "15.000"). */
export function formatMinimoInput(text) {
  const digits = String(text ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 8);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Cuánto lleva y cuánto le falta al comprador para el mínimo de una tienda; null si no hay mínimo. */
export function progresoMinimo(minimo, subtotal) {
  const vigente = minimoVigente(minimo);
  if (vigente == null) return null;
  const base = Math.max(0, Number.isFinite(Number(subtotal)) ? Number(subtotal) : 0);
  const faltante = Math.max(0, vigente - base);
  return { minimo: vigente, subtotal: base, faltante, cumple: faltante === 0, avance: Math.min(1, base / vigente) };
}

/** Suma (sin envío) de los productos de una tienda en el carrito. */
export function storeCartSubtotal(items, proveedorId) {
  if (proveedorId == null || proveedorId === '') return 0;
  return (items || [])
    .filter((item) => String(item.proveedorId) === String(proveedorId))
    .reduce((total, item) => total + (Number(item.precio) || 0) * (Number(item.quantity) || 0), 0);
}

/** Si el método elegido es retiro en tienda (el retiro no tiene mínimo). */
export function isPickupMethod(method) {
  const text = String(method ?? '').toLowerCase();
  return text.includes('retiro') || (text.includes('tienda') && !/env[ií]o|despacho/.test(text));
}

/** Si entre los métodos publicados hay despacho (dentro o fuera de la comuna). Mismo criterio que el backend. */
export function storeDispatches(shippingMethods) {
  const text = (Array.isArray(shippingMethods) ? shippingMethods.join(', ') : String(shippingMethods ?? '')).toLowerCase();
  return /dentro|fuera|comuna|delivery|courier|regiones|despacho|env[ií]o/.test(text);
}
