// H-P2 (prueba en prod, 14-oct): el rango de años que declaró la tienda manda sobre el de la
// versión del catálogo. Un "Yaris 2010–2016" queda ligado a versiones del catálogo que pueden
// llegar hasta 2019; a un Yaris 2018 no le sirve. Mismo criterio que el backend
// (RepuestoCompatibilidad.cubreAnio) y que la app (utils/compatibility-match.ts).

const toYear = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** El año cae dentro del rango (sin año o sin límites, no restringe). */
export function yearInRange(anio, desde, hasta) {
  const year = toYear(anio);
  if (!year) return true;
  const from = toYear(desde);
  const to = toYear(hasta);
  if (from && year < from) return false;
  return !to || year <= to;
}

/**
 * Años que se muestran para una versión del catálogo dentro de un grupo declarado: la
 * intersección entre el rango de la versión (2001–2014) y lo que declaró la tienda (2010–2016),
 * o sea 2010–2014. Sin intersección (no debería pasar) se muestra lo declarado.
 */
export function declaredYears(versionDesde, versionHasta, declaradoDesde, declaradoHasta) {
  const vFrom = toYear(versionDesde);
  const vTo = toYear(versionHasta);
  const dFrom = toYear(declaradoDesde);
  const dTo = toYear(declaradoHasta) || dFrom;
  if (!dFrom) return { desde: vFrom, hasta: vTo };
  const desde = vFrom ? Math.max(vFrom, dFrom) : dFrom;
  const hasta = vTo ? Math.min(vTo, dTo) : dTo;
  if (desde > hasta) return { desde: dFrom, hasta: dTo };
  return { desde, hasta };
}

/**
 * La fila (una versión del catálogo con sus años ya acotados) es el auto de la patente: misma
 * versión (o una equivalente de su familia, que manda el backend) y su año dentro del rango.
 */
export function rowMatchesPlate(row, vehicleIds, anio) {
  if (!row?.catalogoId || !Array.isArray(vehicleIds) || vehicleIds.length === 0) return false;
  return vehicleIds.includes(String(row.catalogoId)) && yearInRange(anio, row.anioInicio, row.anioFin);
}

/**
 * Las filas que son el auto de la patente. Si la versión exacta de la patente está en la lista,
 * solo esa; las equivalentes de su familia (otras filas del catálogo con la misma versión) se
 * usan solo cuando la exacta no está. Prueba 3 de H-P2: un Yaris 1.5 GLI 2018 marcaba también
 * "SEDAN GLI" y "GLI 1.5 AT" como "Es tu vehículo".
 */
export function plateMatchRows(rows, exactId, vehicleIds, anio) {
  const list = Array.isArray(rows) ? rows : [];
  if (exactId !== undefined && exactId !== null && exactId !== '') {
    const exact = list.filter((row) => rowMatchesPlate(row, [String(exactId)], anio));
    if (exact.length > 0) return exact;
  }
  return list.filter((row) => rowMatchesPlate(row, vehicleIds, anio));
}

/** "Toyota Yaris 1.5 GLI · 1.5L (2018)": marca, modelo, versión, motor y año del auto de la patente. */
export function plateVehicleLabel(vehicle) {
  if (!vehicle) return '';
  const nombre = [vehicle.marca, vehicle.modelo, vehicle.version].filter(Boolean).join(' ');
  const conMotor = [nombre, vehicle.motor].filter(Boolean).join(' · ');
  return vehicle.anio ? `${conMotor} (${vehicle.anio})` : conMotor;
}
