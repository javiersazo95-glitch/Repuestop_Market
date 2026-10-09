/**
 * Compatibilidad de cada repuesto con el vehículo elegido, en el carrito y el checkout.
 * El backend evalúa (`POST /compatibilidad/evaluar`) y devuelve uno de cuatro resultados:
 *
 * - COMPATIBLE: la tienda declaró ese vehículo.
 * - UNIVERSAL: el repuesto sirve para cualquiera (acá se resuelve sin preguntar: `esUniversal`).
 * - SIN_DATOS: la tienda no declaró compatibilidades; la confirma antes de despachar.
 * - NO_COINCIDE: declaró otras y este vehículo no está. No bloquea: se pide confirmación.
 *
 * Lenguaje no absoluto: el catálogo de la tienda puede estar incompleto, así que nunca se dice
 * "no sirve", sino "no figura como compatible".
 */

export const COMPAT = {
  COMPATIBLE: 'COMPATIBLE',
  NO_COINCIDE: 'NO_COINCIDE',
  SIN_DATOS: 'SIN_DATOS',
  UNIVERSAL: 'UNIVERSAL',
};

const KNOWN = new Set(Object.values(COMPAT));
export const COMPAT_MAX_ITEMS = 50;

const norm = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Vehículo tal como lo pide el backend, o null si no alcanza para evaluar: hace falta la
 * versión del catálogo o, al menos, marca y modelo (una patente sin identificar no sirve).
 * Acepta los vehículos del checkout (`catalogoId`, `anio` en texto) y el activo del contexto.
 */
export function toCompatVehicle(vehicle) {
  if (!vehicle) return null;
  const vehiculoCatalogoId = Number(vehicle.vehiculoCatalogoId ?? vehicle.catalogoId) || null;
  const marca = String(vehicle.marca || '').trim();
  const modelo = String(vehicle.modelo || '').trim();
  const anio = Number(vehicle.anio) || null;
  if (!vehiculoCatalogoId && !(marca && modelo)) return null;
  return { vehiculoCatalogoId, marca: marca || null, modelo: modelo || null, anio };
}

/** Clave de caché de un vehículo: dos vehículos con los mismos datos dan el mismo resultado. */
export function compatVehicleKey(vehicle) {
  const compat = toCompatVehicle(vehicle);
  if (!compat) return '';
  return [compat.vehiculoCatalogoId || '', norm(compat.marca), norm(compat.modelo), compat.anio || ''].join('|');
}

export const compatCacheKey = (productoId, vehicle) => `${productoId}#${compatVehicleKey(vehicle)}`;

/**
 * Ítems que hay que preguntar al backend: con vehículo evaluable, no universales, sin repetir
 * y que no estén ya en la caché (`isKnown(cacheKey)`). Se parten en lotes de 50 (tope del
 * endpoint); un carrito normal cabe en una sola llamada.
 */
export function pendingCompatBatches(entries, isKnown = () => false) {
  const seen = new Set();
  const items = [];
  entries.forEach((entry) => {
    if (!entry || entry.esUniversal) return;
    const vehiculo = toCompatVehicle(entry.vehicle);
    const productoId = Number(entry.productoId);
    if (!vehiculo || !productoId) return;
    const key = compatCacheKey(productoId, entry.vehicle);
    if (seen.has(key) || isKnown(key)) return;
    seen.add(key);
    items.push({ key, productoId, vehiculo });
  });
  const batches = [];
  for (let i = 0; i < items.length; i += COMPAT_MAX_ITEMS) batches.push(items.slice(i, i + COMPAT_MAX_ITEMS));
  return batches;
}

/**
 * Resultados de una respuesta por clave de caché. El backend responde por `productoId`: dentro
 * de un lote cada producto va una sola vez por vehículo, pero un mismo producto podría ir con
 * dos vehículos, así que se empareja en orden. Lo que no venga o venga raro, no se guarda.
 */
export function mapCompatResponse(batch, response) {
  const list = Array.isArray(response?.resultados) ? response.resultados : [];
  const byProduct = new Map();
  list.forEach((row) => {
    const id = Number(row?.productoId);
    const resultado = String(row?.resultado || '').toUpperCase();
    if (!id || !KNOWN.has(resultado)) return;
    if (!byProduct.has(id)) byProduct.set(id, []);
    byProduct.get(id).push(resultado);
  });
  const out = {};
  batch.forEach((item) => {
    const queue = byProduct.get(item.productoId);
    if (queue && queue.length) out[item.key] = queue.shift();
  });
  return out;
}

/** "Toyota Yaris 2018" (sin patente: es lo que la tienda declara). */
export function compatVehicleLabel(vehicle) {
  if (!vehicle) return '';
  return [vehicle.marca, vehicle.modelo, Number(vehicle.anio) > 0 ? vehicle.anio : '']
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Texto e intención visual de cada estado. Nunca solo color: siempre ícono + texto. */
export function compatibilityMessage(status, vehicle) {
  const label = compatVehicleLabel(vehicle);
  const tu = label ? `tu ${label}` : 'tu vehículo';
  switch (status) {
    case 'loading':
      return { tone: 'loading', text: 'Revisando compatibilidad…' };
    case COMPAT.COMPATIBLE:
      return { tone: 'ok', text: `Compatible con ${tu}` };
    case COMPAT.UNIVERSAL:
      return { tone: 'neutral', text: 'Sirve para cualquier vehículo' };
    case COMPAT.SIN_DATOS:
      return { tone: 'info', text: 'La tienda no indicó compatibilidad. La confirmará antes de despachar.' };
    case COMPAT.NO_COINCIDE:
      return { tone: 'warn', text: `No figura como compatible con ${tu}` };
    default:
      return null;
  }
}

/** "1 repuesto podría no ser compatible" / "2 repuestos podrían no ser compatibles". */
export function mismatchCountText(count) {
  return count === 1
    ? '1 repuesto podría no ser compatible'
    : `${count} repuestos podrían no ser compatibles`;
}

/**
 * Resumen del carrito: "Revisamos tus 3 repuestos con tu Toyota Yaris 2018: 2 compatibles,
 * 1 por revisar". Universal cuenta como compatible; "por revisar" es NO_COINCIDE y lo que la
 * tienda no declaró va aparte. '' si todavía no hay ningún resultado (o falló la consulta).
 */
export function cartCompatSummary(statuses, vehicle) {
  const known = statuses.filter((status) => KNOWN.has(status));
  if (known.length === 0) return '';
  const ok = known.filter((status) => status === COMPAT.COMPATIBLE || status === COMPAT.UNIVERSAL).length;
  const mismatch = known.filter((status) => status === COMPAT.NO_COINCIDE).length;
  const noData = known.filter((status) => status === COMPAT.SIN_DATOS).length;
  const parts = [];
  if (ok) parts.push(`${ok} ${ok === 1 ? 'compatible' : 'compatibles'}`);
  if (mismatch) parts.push(`${mismatch} por revisar`);
  if (noData) parts.push(`${noData} sin datos de la tienda`);
  const total = known.length;
  const label = compatVehicleLabel(vehicle);
  const repuestos = total === 1 ? 'tu repuesto' : `tus ${total} repuestos`;
  return `Revisamos ${repuestos} con ${label ? `tu ${label}` : 'tu vehículo'}: ${parts.join(', ')}`;
}
