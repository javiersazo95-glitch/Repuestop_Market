/**
 * Qué compatibilidad mostrar en una compra. Un repuesto puede declarar varios vehículos; antes la
 * compra mostraba siempre el PRIMERO y el comprador podía creer que se equivocó de repuesto.
 * Ahora manda el vehículo con el que compró (el del ítem del pedido): la compatibilidad que lo
 * incluye (por versión del catálogo y, si no, por marca/modelo/año), o su propio vehículo.
 *
 * `compatibilidad`: lista de `adaptProduct` ({ marca, modelo, anioInicio, anioFin, vehiculoCatalogoIds }).
 * `vehicle`: { catalogoId, marca, modelo, anio } del ítem del pedido.
 */

const norm = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function years(entry) {
  const from = entry.anioInicio;
  const to = entry.anioFin;
  if (!from && !to) return '';
  if (!to || to === from) return String(from || to);
  return `${from || '—'}–${to}`;
}

function entryLabel(entry) {
  return [[entry.marca, entry.modelo].filter(Boolean).join(' '), years(entry)].filter(Boolean).join(' ');
}

export function vehicleLabelOf(vehicle) {
  if (!vehicle) return '';
  return [vehicle.marca, vehicle.modelo, vehicle.anio].filter(Boolean).join(' ');
}

export function matchBuyerCompatibility(compatibilidad = [], vehicle) {
  if (!vehicle || !compatibilidad.length) return null;
  if (vehicle.catalogoId) {
    const id = String(vehicle.catalogoId);
    const byCatalog = compatibilidad.find((entry) => (entry.vehiculoCatalogoIds || []).map(String).includes(id));
    if (byCatalog) return byCatalog;
  }
  const brand = norm(vehicle.marca);
  const model = norm(vehicle.modelo);
  if (!brand && !model) return null;
  const year = Number(vehicle.anio) || 0;
  return compatibilidad.find((entry) => {
    const entryBrand = norm(entry.marca);
    const entryModel = norm(entry.modelo);
    if (brand && entryBrand && entryBrand !== brand) return false;
    if (model && entryModel && !(entryModel.includes(model) || model.includes(entryModel))) return false;
    if (!entryBrand && !entryModel) return false;
    if (year && entry.anioInicio && year < entry.anioInicio) return false;
    if (year && entry.anioFin && year > entry.anioFin) return false;
    return true;
  }) || null;
}

/** Texto de la fila "Compatibilidad" de una compra. '' si no hay nada que decir. */
export function buyerCompatibilityText({ compatibilidad = [], vehicle, esUniversal }) {
  if (esUniversal) return 'Universal: sirve para cualquier vehículo';
  const match = matchBuyerCompatibility(compatibilidad, vehicle);
  if (match) return entryLabel(match);
  const own = vehicleLabelOf(vehicle);
  if (own) return own;
  if (!compatibilidad.length) return '';
  // Sin vehículo declarado (compras antiguas): todas, no solo la primera.
  const labels = compatibilidad.map(entryLabel).filter(Boolean);
  return labels.length > 3 ? `${labels.slice(0, 3).join(' · ')} y ${labels.length - 3} más` : labels.join(' · ');
}
