// Catalogos y helpers del buscador de talleres y de las citas.
//
// Es la contraparte web de `mobile/constants/talleres-data.ts` del monorepo: los nombres de
// campo del taller son los que arma `adaptTaller()` desde `ServicioAutomotrizDTOs.Perfil`.
//
// Aqui solo viven datos puros y funciones sin estado. La lectura de talleres pasa por
// `src/services/talleresStorage.js`.

// Los contadores por categoria ya no viven aqui: se calculan sobre los talleres
// que devuelve el mural (ver `categoryCounts` en AdsWallView).
export const SERVICE_CATEGORIES = [
  { id: 'TODAS', label: 'Todas las categorías', emoji: '🌟' },
  { id: 'mecanica', label: 'Mecánica', emoji: '🔧' },
  { id: 'electricidad-electronica', label: 'Electricidad y Electrónica', emoji: '🔌' },
  { id: 'neumaticos', label: 'Neumáticos', emoji: '🛞' },
  { id: 'asistencia-vehicular', label: 'Asistencia Vehicular', emoji: '🚨' },
  { id: 'carroceria-pintura', label: 'Carrocería y Pintura', emoji: '🎨' },
  { id: 'estetica-automotriz', label: 'Estética Automotriz', emoji: '✨' },
  { id: 'climatizacion', label: 'Climatización', emoji: '❄️' },
  { id: 'cerrajeria-seguridad', label: 'Cerrajería y Seguridad', emoji: '🔑' },
  { id: 'servicios-inspeccion', label: 'Servicios de Inspección', emoji: '📋' },
  { id: 'motos', label: 'Motos', emoji: '🏍️' },
  { id: 'camiones-maquinaria', label: 'Camiones y Maquinaria', emoji: '🚚' },
  { id: 'compra-venta-arriendo', label: 'Compra, Venta y Arriendo', emoji: '🚗' },
  { id: 'servicios-domicilio', label: 'Servicios a Domicilio', emoji: '🏠' },
  { id: 'otros-servicios', label: 'Otros Servicios Automotrices', emoji: '📦' }
];


export const TALLER_FEATURE_TAGS = [
  // Generales del negocio
  'Atención directa',
  'Servicio garantizado',
  'Atención 24 horas',
  'Repuestos originales',
  'Garantía escrita',
  'Servicio a domicilio',
  'Retiro y entrega del vehículo',
  'Presupuesto sin costo',
  'Personal certificado',
  'Financiamiento disponible',
  'Pago con tarjeta',
  'Boleta o factura',
  'Servicio express',
  'Más de 10 años de experiencia',
  'Mecánico de confianza',
  'Taller techado',
  'Sala de espera',
  'Wifi gratis',
  'Estacionamiento disponible',
  'Atiende fines de semana',
  // Mecánica
  'Cambio de aceite y filtros',
  'Afinamiento de motor',
  'Reparación de motor',
  'Mantención preventiva',
  'Cambio de embrague',
  'Alineación y balanceo',
  'Revisión de frenos',
  'Cambio de correa de distribución',
  // Electricidad y Electrónica
  'Diagnóstico computarizado',
  'Diagnóstico de fallas eléctricas',
  'Reparación de alternador',
  'Cambio de batería',
  'Instalación de alarmas',
  'Reparación de central electrónica',
  // Neumáticos
  'Venta de neumáticos',
  'Vulcanización',
  'Balanceo de ruedas',
  'Cambio de neumáticos a domicilio',
  // Asistencia Vehicular
  'Auxilio en carretera',
  'Grúa 24 horas',
  'Carga de batería a domicilio',
  'Cambio de neumático en ruta',
  // Carrocería y Pintura
  'Pintura automotriz',
  'Desabolladura sin pintura (PDR)',
  'Reparación de choques',
  'Pulido y encerado',
  // Estética Automotriz
  'Lavado a domicilio',
  'Detailing completo',
  'Pulido cerámico',
  'Limpieza de tapiz e interior',
  // Climatización
  'Carga de gas aire acondicionado',
  'Reparación de aire acondicionado',
  // Cerrajería y Seguridad
  'Duplicado de llaves',
  'Apertura de vehículos',
  'Programación de llaves con chip',
  // Servicios de Inspección
  'Revisión técnica',
  'Certificación de gases',
  'Inspección pre-compra',
  // Motos
  'Mantención de motos',
  'Repuestos para motos',
  // Camiones y Maquinaria
  'Mantención de camiones',
  'Reparación de maquinaria pesada',
  // Compra, Venta y Arriendo
  'Compra de vehículos',
  'Venta de vehículos',
  'Arriendo de vehículos',
  // Servicios a Domicilio
  'Mecánico a domicilio',
  // Otros
  'Traslados y fletes',
  'Asesoría mecánica',
];

export const CHILE_COMMUNES = [
  'Todas las comunas',
  'Santiago Centro',
  'Providencia',
  'Las Condes',
  'Ñuñoa',
  'Maipú',
  'San Miguel',
  'La Florida',
  'Puente Alto',
  'Quilicura',
  'Macul',
  'Huechuraba',
  'Viña del Mar',
  'Valparaíso',
  'Concepción',
  'Antofagasta',
  'Temuco',
  'Rancagua',
  'La Serena'
];


// -------------------------------------------------------------
// PROPIEDAD DEL TALLER
// -------------------------------------------------------------

const idKey = (value) => String(value ?? '').trim();

/** ¿El taller es de la persona que esta usando la web? El perfil publico trae `ownerUserId`. */
export function isOwnTaller(taller, identity) {
  if (!taller || !identity) return false;
  const left = idKey(taller.ownerUserId);
  return left !== '' && left === idKey(identity.userId);
}

/** Texto que se muestra cuando alguien intenta contactar o agendarse en su propio taller. */
export const OWN_TALLER_BLOCK_MESSAGES = {
  call: {
    title: 'Es tu propio taller',
    message: 'No puedes llamar a este número porque el taller es tuyo. Para revisar o modificar tu perfil, entra a Mi taller.'
  },
  whatsapp: {
    title: 'Es tu propio taller',
    message: 'No puedes escribirte por WhatsApp a ti mismo: este taller es tuyo. Para revisar o modificar tu perfil, entra a Mi taller.'
  },
  booking: {
    title: 'Es tu propio taller',
    message: 'No puedes agendar una cita en tu propio taller. Para ver las reservas que te han hecho, abre la agenda desde Mi taller.'
  }
};

// -------------------------------------------------------------
// AGENDAMIENTOS
// -------------------------------------------------------------

/**
 * Estados de una reserva. Son los mismos strings que valida el `@Pattern` de
 * `AgendamientoEstadoDTO` y que guarda `Agendamiento.estado`:
 * inventar uno hace que el PATCH responda 400.
 */
export const APPOINTMENT_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'];

/** 'cancelled' la marca el cliente; 'rejected' la marca el taller. */
export const CLOSED_APPOINTMENT_STATUSES = ['rejected', 'cancelled'];

export function isClosedAppointment(status) {
  return CLOSED_APPOINTMENT_STATUSES.includes(status);
}

/**
 * Estilo y textos de cada estado, en un solo lugar para toda la agenda.
 * Port de `mobile/constants/appointment-status.ts`.
 */
export const APPOINTMENT_STATUS_META = {
  pending: {
    label: 'Pendiente',
    longLabel: 'Pendiente de confirmación',
    tone: 'warning'
  },
  accepted: {
    label: 'Aceptada',
    longLabel: 'Confirmada por el taller',
    tone: 'success'
  },
  rejected: {
    label: 'Rechazada',
    longLabel: 'Rechazada por el taller',
    tone: 'danger'
  },
  cancelled: {
    label: 'Cancelada',
    longLabel: 'Cancelada',
    tone: 'danger'
  }
};

/**
 * Los bloques que una reserva deja ocupados: `AgendamientoService.crear()`
 * choca contra `pending` y `accepted` (su constante `OCUPADOS`), asi que una
 * reserva rechazada o cancelada libera el horario.
 */
export const BLOCKING_APPOINTMENT_STATUSES = ['pending', 'accepted'];

export function blocksAppointmentSlot(status) {
  return BLOCKING_APPOINTMENT_STATUSES.includes(status);
}
