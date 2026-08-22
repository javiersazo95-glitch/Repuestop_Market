// Catalogos y helpers del Mural de Anuncios de Servicios Automotrices.
//
// Es la contraparte web de `mobile/constants/automotive-ads-data.ts` del monorepo
// (`C:/ProyectoRepuestop/repuestop`): los nombres de campo del anuncio son los
// mismos que devuelve `AnuncioResponseDTO` del backend, asi que ambos clientes
// leen la misma forma. Si cambia alla, hay que actualizarlo aqui.
//
// Aqui solo viven datos puros y funciones sin estado. La lectura del mural pasa
// por `src/services/adsStorage.js`.

// Los contadores por categoria ya no viven aqui: se calculan sobre los anuncios
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


// Planes de publicacion. `maxImages` y `maxTags` replican las validaciones de
// `AnuncioService.validar()` en el backend: si aqui se relajan, el POST falla con 400.
export const AD_TIERS = {
  basica: {
    id: 'basica',
    name: 'Básica',
    badge: 'Gratuito',
    badgeColor: '#64748b',
    maxImages: 2,
    maxTags: 2,
    maxStories: 0,
    hasWhatsapp: false,
    hasBooking: false,
    cardTheme: 'tier-basic',
    description: 'Publicación estándar con hasta 2 fotos, datos de contacto telefónico y dirección.'
  },
  destacada: {
    id: 'destacada',
    name: 'Destacada',
    badge: '⭐ Destacado',
    badgeColor: '#d97706',
    maxImages: 2,
    maxTags: 4,
    maxStories: 0,
    hasWhatsapp: true,
    hasBooking: false,
    cardTheme: 'tier-destacada',
    description: 'Mayor visibilidad con tarjeta en amarillo suave, etiqueta destacada y WhatsApp directo.'
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    badge: '⚡ Premium',
    badgeColor: '#7c3aed',
    maxImages: 4,
    maxTags: 6,
    maxStories: 2,
    hasWhatsapp: true,
    hasBooking: false,
    cardTheme: 'tier-premium',
    description: 'Tarjeta en tono morado con botón de acceso rápido y directo a WhatsApp.'
  },
  empresarial: {
    id: 'empresarial',
    name: 'Empresarial',
    badge: '👑 Empresarial Verificado',
    badgeColor: '#059669',
    maxImages: 6,
    maxTags: 8,
    maxStories: 4,
    hasWhatsapp: true,
    hasBooking: true,
    cardTheme: 'tier-empresarial',
    description: 'Máxima categoría corporativa con agendamiento de citas en línea directo desde la plataforma.'
  }
};

// Orden de los planes, de menor a mayor. Se usa para saber a que rangos puede
// escalar un anuncio (solo los que estan por encima del suyo).
export const AD_TIER_ORDER = ['basica', 'destacada', 'premium', 'empresarial'];

/** Rangos a los que un anuncio puede mejorar. Vacio si ya esta en el maximo. */
export function getUpgradableTiers(currentTier) {
  const index = AD_TIER_ORDER.indexOf(currentTier);
  return index < 0 ? [] : AD_TIER_ORDER.slice(index + 1);
}

/**
 * Funciones que el usuario debe activar a mano en su anuncio al llegar a un plan.
 * Mejorar el rango solo da el derecho: WhatsApp, el Carrusel de Historias y la
 * Agenda siguen apagados hasta que el usuario los active en el formulario.
 */
export function getTierActivatableFeatures(tier) {
  const features = [];
  if (tier !== 'basica') features.push('WhatsApp directo');
  if (tier === 'premium' || tier === 'empresarial') features.push('Carrusel de Historias');
  if (tier === 'empresarial') features.push('Agenda de citas en línea');
  return features;
}

export const AD_FEATURE_TAGS = [
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
// PROPIEDAD DEL ANUNCIO
// -------------------------------------------------------------

// `AnuncioResponseDTO` devuelve el proveedor como "ML-123" (`AnuncioService.toResponse()`),
// mientras que la sesion guarda `sellerId` como numero. Sin quitar el prefijo, ningun
// anuncio propio se reconoceria y el dueño podria llamarse a si mismo.
const idKey = (value) => String(value ?? '').trim().replace(/^ML-/i, '');

const sameId = (a, b) => {
  const left = idKey(a);
  const right = idKey(b);
  return left !== '' && left === right;
};

/**
 * ¿El anuncio lo publico la persona que esta usando la web? Se compara por
 * proveedor, usuario y correo porque un anuncio puede haberse creado antes de
 * que la sesion tuviera todos esos datos.
 */
export function isOwnAd(ad, identity) {
  if (!ad || !identity) return false;
  if (sameId(ad.ownerSellerId, identity.sellerId)) return true;
  if (sameId(ad.ownerUserId, identity.userId)) return true;
  return Boolean(
    ad.ownerEmail && identity.email &&
    ad.ownerEmail.trim().toLowerCase() === identity.email.trim().toLowerCase()
  );
}

/**
 * ¿El anuncio quedo con dueño registrado? Los publicados antes de que existiera
 * el campo no lo tienen, y hasta que alguien los reclame no los administra nadie.
 */
export function hasAdOwner(ad) {
  return Boolean(ad?.ownerUserId || ad?.ownerSellerId || ad?.ownerEmail);
}

/** Solo los anuncios de esta cuenta: la gestion de un anuncio es privada de quien lo publico. */
export function filterAdsOwnedBy(ads, identity) {
  return (ads || []).filter((ad) => isOwnAd(ad, identity));
}

/** Texto que se muestra cuando alguien intenta contactarse con su propio anuncio. */
export const OWN_AD_BLOCK_MESSAGES = {
  call: {
    title: 'Es tu propio anuncio',
    message: 'No puedes llamar a este número porque el anuncio lo publicaste tú. Si quieres revisarlo o modificarlo, entra a Gestión de Anuncios.'
  },
  whatsapp: {
    title: 'Es tu propio anuncio',
    message: 'No puedes escribirte por WhatsApp a ti mismo: este anuncio lo publicaste tú. Si quieres revisarlo o modificarlo, entra a Gestión de Anuncios.'
  },
  booking: {
    title: 'Es tu propio anuncio',
    message: 'No puedes agendar una cita en tu propio anuncio. Para ver las reservas que te han hecho, abre la agenda desde Gestión de Anuncios.'
  }
};

// -------------------------------------------------------------
// MODERACION Y VIGENCIA
// -------------------------------------------------------------

// Estados de `moderationStatus`. Son strings del backend, no un enum Java, pero
// aplica la misma regla: tienen que calzar exactos o el mural filtra mal sin fallar.
export const AD_MODERATION_STATUS = {
  PENDIENTE: 'PENDIENTE',
  APROBADO: 'APROBADO',
  RECHAZADO: 'RECHAZADO'
};

export const AD_MODERATION_LABELS = {
  PENDIENTE: { label: 'En revisión', tone: 'warning' },
  APROBADO: { label: 'Publicado', tone: 'success' },
  RECHAZADO: { label: 'Rechazado', tone: 'danger' }
};

/** Un anuncio publicado permanece visible en el mural por 30 dias. */
export const AD_DURATION_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Dias restantes antes de que el anuncio venza. Los anuncios antiguos no guardan
 * `expiresAt`, asi que se calcula desde `publishedAt` + AD_DURATION_DAYS.
 * Devuelve null si no hay ninguna fecha utilizable.
 */
export function getAdExpiryInfo(ad) {
  const expiryMs = ad?.expiresAt
    ? new Date(ad.expiresAt).getTime()
    : ad?.publishedAt
      ? new Date(ad.publishedAt).getTime() + AD_DURATION_DAYS * MS_PER_DAY
      : NaN;

  if (Number.isNaN(expiryMs)) return null;

  const daysLeft = Math.ceil((expiryMs - Date.now()) / MS_PER_DAY);
  if (daysLeft <= 0) return { daysLeft: 0, isExpired: true, label: 'Vencido' };
  return {
    daysLeft,
    isExpired: false,
    label: daysLeft === 1 ? 'Vence mañana' : `Vence en ${daysLeft} días`
  };
}

/** ¿El anuncio esta visible en el mural publico? Misma condicion que `AnuncioService.listarPublicos()`. */
export function isAdVisibleOnWall(ad) {
  if (!ad) return false;
  if (ad.moderationStatus !== AD_MODERATION_STATUS.APROBADO) return false;
  if (ad.activo !== true) return false;
  const expiry = getAdExpiryInfo(ad);
  return !expiry || !expiry.isExpired;
}

// -------------------------------------------------------------
// AGENDAMIENTOS (se consumen en la fase C)
// -------------------------------------------------------------

/** 'cancelled' la marca el cliente; 'rejected' la marca el taller. */
export const CLOSED_APPOINTMENT_STATUSES = ['rejected', 'cancelled'];

export function isClosedAppointment(status) {
  return CLOSED_APPOINTMENT_STATUSES.includes(status);
}

// -------------------------------------------------------------
// SEMILLA
// -------------------------------------------------------------

/**
 * Vacio a proposito. El mural se lee del backend (`GET /anuncios`); los 14
 * anuncios de demostracion que vivian aqui se retiraron junto con la
 * integracion, igual que en el movil, para no mezclar datos falsos con reales
 * en la misma grilla.
 */
export const INITIAL_CLASSIFIED_ADS = [];
