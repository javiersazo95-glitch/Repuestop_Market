/**
 * Ficha del vehículo del comprador que ve la TIENDA (19-oct, decisión del usuario): la misma en una
 * compra del carro, en una cotización pagada y en la solicitud de cotización. Estas funciones
 * llevan cada DTO del backend a una sola forma para `VehicleSheet`:
 *
 * { patente, descripcion, marca, modelo, anio, version, motor, chasis, origen }
 *
 * La patente llega ya enmascarada para la tienda ("BB••12") y se muestra tal cual.
 */

const text = (value) => String(value ?? '').trim();

/** Vehículo del pedido (PedidoResponseDTO) o de una línea (PedidoItemResponseDTO). */
export function vehicleSheetFromOrder(source) {
  if (!source) return null;
  return {
    patente: text(source.vehiculoPatente),
    descripcion: '',
    marca: text(source.vehiculoMarca),
    modelo: text(source.vehiculoModelo),
    anio: source.vehiculoAnio || '',
    version: text(source.vehiculoVersion),
    motor: text(source.vehiculoMotor),
    chasis: text(source.vehiculoChasis),
    origen: text(source.vehiculoOrigen),
  };
}

/** Producto del checklist "Confirmar pedido" (ChecklistItemCompatibilidadDTO): `vehiculo` ya viene armado. */
export function vehicleSheetFromChecklistItem(item) {
  if (!item) return null;
  return {
    patente: text(item.vehiculoPatente),
    descripcion: text(item.vehiculo),
    marca: '',
    modelo: '',
    anio: '',
    version: text(item.vehiculoVersion),
    motor: text(item.vehiculoMotor),
    chasis: text(item.vehiculoChasis),
    origen: text(item.vehiculoOrigen),
  };
}

/** Solicitud de cotización ya resuelta por `resolveQuoteRequest` (quoteFlow). */
export function vehicleSheetFromQuoteRequest(requested) {
  if (!requested) return null;
  const vehicle = requested.requestedVehicle || {};
  return {
    patente: text(requested.requestedPlate),
    descripcion: '',
    marca: text(vehicle.marca),
    modelo: text(vehicle.modelo),
    anio: vehicle.anio || '',
    version: text(vehicle.version),
    motor: text(vehicle.motor),
    chasis: text(requested.requestedChassis),
    // La solicitud no lleva origen: con patente los datos salen de la consulta, no del comprador.
    origen: '',
  };
}

/** "Toyota Yaris 2020". */
export function vehicleSheetTitle(sheet) {
  if (!sheet) return '';
  return sheet.descripcion || [sheet.marca, sheet.modelo, sheet.anio].filter((value) => text(value)).join(' ');
}

/** ¿Hay algo que mostrar? (sin ningún dato, la ficha no se dibuja). */
export function hasVehicleSheet(sheet) {
  if (!sheet) return false;
  return Boolean(sheet.patente || vehicleSheetTitle(sheet) || sheet.version || sheet.motor || sheet.chasis);
}
