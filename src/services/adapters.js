/**
 * Capa de adaptación backend -> UI.
 *
 * Los componentes de este repo fueron construidos contra los mocks de `src/data/*`,
 * mientras que el backend Spring Boot devuelve DTOs con otros nombres de campo
 * (y, en varios casos, el mismo dato duplicado en inglés y español: storeName /
 * tiendaNombre, sellerCity / city). Estas funciones normalizan esa diferencia en un
 * solo lugar para que los componentes no tengan que conocer la forma del backend.
 */

import { HEADER_CATEGORIES, SIDEBAR_CATEGORIES } from '../data/categories';
import { resolveMediaUrl } from './api';

const normalizeNameKey = (value) => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const CATEGORY_IDS = SIDEBAR_CATEGORIES.map((c) => c.id);

/**
 * Deja solo dígitos + dígito verificador (k/K) y aplica puntos de miles + guion.
 * Ejemplo: "12345678k" -> "12.345.678-K"
 */
export function formatRut(value) {
  if (!value) return '';
  const cleaned = String(value).replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (cleaned.length <= 1) return cleaned;
  const body = cleaned.slice(0, -1);
  const verifier = cleaned.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${verifier}`;
}

/** Verifica el dígito verificador (módulo 11) de un RUT chileno, no solo el formato. */
export function isValidRut(value) {
  const clean = String(value || '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 8) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expectedValue = 11 - (sum % 11);
  const expected = expectedValue === 11 ? '0' : expectedValue === 10 ? 'K' : String(expectedValue);
  return dv === expected;
}

/** Celular chileno: 9 dígitos empezando en 9, con o sin el prefijo de país 56. */
export function isValidClPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('56') ? digits.slice(2) : digits;
  return /^9\d{8}$/.test(local);
}

/**
 * El backend devuelve el nombre de la categoría ("Accesorios", "Carrocería", "Sistema de Frenos", etc.).
 * Se resuelve primero por coincidencia exacta/slug con HEADER_CATEGORIES y luego por palabras clave.
 */
const CATEGORY_KEYWORDS = {
  frenos: ['freno', 'brake', 'pastilla', 'disco'],
  motor: ['motor', 'engine', 'distribuc', 'correa', 'bujia', 'bujía'],
  suspension: ['suspens', 'direcc', 'amortigua', 'rotula', 'rótula'],
  iluminacion: ['ilumina', 'ampolleta', 'luz', 'luces', 'foco', 'far'],
  aceites: ['aceite', 'filtro', 'lubric', 'oil'],
  electrico: ['electric', 'eléctric', 'encendido', 'bateria', 'batería', 'alternador'],
  carroceria: ['carroc', 'espejo', 'paragolpe', 'parachoque', 'puerta', 'capot'],
  neumaticos: ['neumat', 'neumát', 'llanta', 'rueda', 'tire'],
};

export function normalizeCategoryId(rawCategoria) {
  if (!rawCategoria) return 'motor';

  const texto = String(rawCategoria).trim();
  const norm = normalizeNameKey(texto);

  // 1. Coincidencia directa con alguna de las 24 categorías canónicas
  const matchedCanonical = HEADER_CATEGORIES.find((c) =>
    c.id === texto.toLowerCase() ||
    normalizeNameKey(c.nombre) === norm ||
    normalizeNameKey(c.id) === norm
  );
  if (matchedCanonical) return matchedCanonical.id;

  // 2. Coincidencia por id corto de SIDEBAR_CATEGORIES
  if (CATEGORY_IDS.includes(texto.toLowerCase())) return texto.toLowerCase();

  // 3. Fallback por palabras clave
  for (const [id, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => texto.toLowerCase().includes(k))) return id;
  }

  return 'motor';
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Descuento porcentual derivado de precio vs precioAnterior. El backend no lo entrega
 * calculado y la UI lo muestra como badge.
 */
function calcularDescuento(precio, precioOriginal) {
  const p = toNumber(precio);
  const po = toNumber(precioOriginal);
  if (!p || !po || po <= p) return 0;
  return Math.round(((po - p) / po) * 100);
}

/**
 * "Hace 4 minutos" a partir de createdAt, para el feed de últimos agregados.
 */
export function formatRelativeTime(isoDate) {
  if (!isoDate) return 'Recién agregado';

  const fecha = new Date(isoDate);
  if (Number.isNaN(fecha.getTime())) return 'Recién agregado';

  const segundos = Math.floor((Date.now() - fecha.getTime()) / 1000);
  if (segundos < 60) return 'Hace instantes';

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;

  const dias = Math.floor(horas / 24);
  if (dias < 30) return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;

  return fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Arma la lista de compatibilidad. El backend entrega o bien un JSON de grupos
 * (compatibilityGroupsJson) o los campos sueltos marca/modelo/años/motor.
 */
function mapCompatibilidad(dto) {
  if (dto.compatibilityGroupsJson) {
    try {
      const grupos = JSON.parse(dto.compatibilityGroupsJson);
      if (Array.isArray(grupos) && grupos.length > 0) {
        return grupos.map((g) => ({
          marca: g.marca || g.brand || '',
          modelo: g.modelo || g.model || '',
          version: g.version || g.versionNombre || g.trim || '',
          anioInicio: toNumber(g.anioDesde ?? g.anioInicio ?? g.yearFrom),
          anioFin: toNumber(g.anioHasta ?? g.anioFin ?? g.yearTo),
          motor: g.motor || g.engine || '',
        }));
      }
    } catch {
      // JSON malformado en BD: se cae a los campos sueltos de abajo.
    }
  }

  if (!dto.compatibilidadMarca && !dto.compatibilidadModelo) return [];

  return [{
    marca: dto.compatibilidadMarca || '',
    modelo: dto.compatibilidadModelo || '',
    version: dto.compatibilidadVersion || dto.version || '',
    anioInicio: toNumber(dto.anioDesde),
    anioFin: toNumber(dto.anioHasta),
    motor: dto.motor || '',
  }];
}

export function compatibilidadSummary(compatibilidad) {
  if (!Array.isArray(compatibilidad) || compatibilidad.length === 0) {
    return 'Consultar compatibilidad';
  }
  const [primera] = compatibilidad;
  const anios = primera.anioInicio && primera.anioFin
    ? ` ${primera.anioInicio}–${primera.anioFin}`
    : '';
  const resto = compatibilidad.length > 1 ? ` +${compatibilidad.length - 1} más` : '';
  return `${primera.marca} ${primera.modelo}${anios}${resto}`.trim();
}

/**
 * ProveedorProductoResponseDTO -> forma de PRODUCTS (src/data/products.js).
 */
export function adaptProduct(dto) {
  if (!dto) return null;

  const precio = toNumber(dto.precio) ?? 0;
  const precioOriginal = toNumber(dto.precioAnterior);
  const compatibilidad = mapCompatibilidad(dto);
  const imagenes = Array.isArray(dto.imageUrls)
    ? dto.imageUrls.filter(Boolean).map(resolveMediaUrl)
    : [];

  return {
    id: dto.id,
    titulo: dto.nombrePublicado || dto.repuestoNombre || 'Repuesto sin nombre',
    // `categoria` es el identificador normalizado que usa la UI para color e
    // icono. Conservamos además el nombre literal del backend para no cambiar
    // etiquetas válidas como "Aceite" por una categoría visual genérica.
    categoria: normalizeCategoryId(dto.categoria),
    categoriaNombre: dto.categoria || '',
    subcategoria: dto.subcategoria || '',
    // Ids reales del catálogo: los necesita la vitrina de productos relacionados
    // para pedir el inventario de la misma subcategoría (o categoría) al backend.
    // `categoriaId` no viene en todos los endpoints y se resuelve por nombre.
    categoriaId: toNumber(dto.categoriaId),
    subcategoriaId: toNumber(dto.subcategoriaId),
    oemCode: dto.referenciaOem || dto.skuProveedor || dto.codigoInterno || '',
    descripcion: dto.descripcion || '',
    marca: dto.marcaRepuesto || dto.marca || dto.productBrand || dto.brand || dto.fabricante || dto.manufacturer || '',
    precio,
    precioOriginal,
    descuento: calcularDescuento(precio, precioOriginal),
    vendidos: toNumber(dto.salesCount) ?? 0,
    // El backend duplica estos campos en inglés/español según el endpoint.
    vendedor: dto.storeName || dto.tiendaNombre || 'Tienda RepuesTop',
    proveedorId: dto.proveedorId,
    ciudadVendedor: dto.sellerCity || dto.city || '',
    vendedorVerificado: Boolean(dto.sellerFounder) || dto.sellerTrustLevel === 'VERIFICADO',
    vendedorFundador: Boolean(dto.sellerFounder),
    localFisico: Boolean(dto.sellerHours),
    metodosEnvio: dto.sellerShippingMethods || '',
    rating: toNumber(dto.productRating) ?? toNumber(dto.sellerRating),
    reviewCount: toNumber(dto.productReviewCount) ?? 0,
    // La reputación de la tienda va aparte: `rating` se queda en 0 cuando el
    // producto todavía no tiene evaluaciones propias, y la ficha necesita mostrar
    // la calificación real del vendedor en vez de un valor inventado.
    vendedorRating: toNumber(dto.sellerRating),
    vendedorReviewCount: toNumber(dto.sellerReviewCount) ?? 0,
    horarioVendedor: dto.sellerHours || '',
    stock: toNumber(dto.stock) ?? 0,
    condicion: dto.condicion || '',
    imagen: imagenes[0] || null,
    imagenes,
    logoTienda: resolveMediaUrl(dto.storeIconUrl),
    requiereChasis: Boolean(dto.requiereChasis),
    isTop: Boolean(dto.destacado),
    pricingMode: dto.pricingMode || (precio > 0 ? 'SHOW_PRICE' : 'QUOTE_ONLY'),
    soloCotizacion: dto.pricingMode === 'COTIZACION' || dto.pricingMode === 'QUOTE_ONLY' || precio <= 0,
    createdAt: dto.createdAt || null,
    compatibilidad,
  };
}

/**
 * ProveedorProductoResponseDTO -> forma de LATEST_ADDED_PARTS.
 */
export function adaptLatestPart(dto) {
  const producto = adaptProduct(dto);
  if (!producto) return null;

  return {
    ...producto,
    ciudad: producto.ciudadVendedor,
    verificado: producto.vendedorVerificado,
    agregadoHace: formatRelativeTime(dto.createdAt),
    stockAvailable: producto.stock,
    compatibilidadSummary: compatibilidadSummary(producto.compatibilidad),
  };
}

const STORE_FALLBACK_COLORS = ['#0066ff', '#059669', '#7c3aed', '#d97706', '#ff5757', '#0891b2'];

export function getStoreInitials(nombre) {
  if (!nombre) return 'RT';
  return String(nombre)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');
}

/**
 * TiendaResponseDTO -> forma de NEW_ONBOARDED_STORES.
 */
export function adaptStore(dto, index = 0) {
  if (!dto) return null;

  const nombre = dto.storeName || dto.nombreTienda || 'Tienda RepuesTop';
  const ciudad = [dto.comuna, dto.region].filter(Boolean).join(', ');
  // El backend entrega shippingMethods como CSV; la UI espera un arreglo.
  const metodosEnvio = typeof dto.shippingMethods === 'string'
    ? dto.shippingMethods.split(',').map((m) => m.trim()).filter(Boolean)
    : Array.isArray(dto.shippingMethods) ? dto.shippingMethods : [];

  return {
    id: dto.proveedorId || dto.sellerId || dto.storeId || dto.tiendaId,
    nombre,
    initials: getStoreInitials(nombre),
    bgColor: STORE_FALLBACK_COLORS[index % STORE_FALLBACK_COLORS.length],
    textColor: '#ffffff',
    rut: dto.taxId || '',
    tipo: dto.giro || 'Casa de Repuestos',
    ciudad: ciudad || 'Chile',
    // Campos separados ademas de `ciudad` (que ya viene unida "Comuna, Region"):
    // el filtro de comuna del directorio necesita el valor exacto que el backend
    // espera en `GET /tiendas/publicas?comuna=`, no el string combinado.
    comuna: dto.comuna || '',
    region: dto.region || '',
    direccion: dto.address || '',
    telefono: dto.phone || '',
    horario: dto.hours || '',
    abierta: Boolean(dto.isOpen ?? dto.open),
    estado: dto.status || null,
    verificadoFecha: dto.createdAt
      ? `Ingresada ${formatRelativeTime(dto.createdAt).toLowerCase()}`
      : 'Verificada recientemente',
    totalPublicaciones: toNumber(dto.productCount ?? dto.totalPublicaciones ?? dto.totalProductos) ?? 0,
    rating: toNumber(dto.rating) ?? 0,
    reviewCount: toNumber(dto.reviewCount) ?? 0,
    responseRate: toNumber(dto.responseRate) ?? null,
    especialidad: dto.giro || '',
    descripcion: dto.description || dto.descripcion || dto.giro || '',
    metodosEnvio,
    marcasEspecialistas: Array.isArray(dto.marcasEspecialistas)
      ? dto.marcasEspecialistas.map((marca) => ({ id: marca.id, nombre: marca.nombre })).filter((marca) => marca.nombre)
      : [],
    fundador: Boolean(dto.founder),
    verificada: Boolean(dto.verified ?? dto.isVerified ?? true),
    logoUrl: resolveMediaUrl(dto.logoUrl || dto.userProfileUrl) || '/tiensoft_logo.jpg',
    coverUrl: resolveMediaUrl(dto.coverUrl) || '/tiensoft_cover.jpg',
  };
}

/**
 * VehiculoIdentificadoDTO -> forma de SAMPLE_PATENTES.
 * `requiereIngresoManual` indica que ni la BD local ni la API externa identificaron
 * el vehículo; la UI debe ofrecer el ingreso manual en ese caso.
 */
export function adaptVehicle(dto) {
  if (!dto) return null;

  return {
    vehiculoConsultadoId: dto.vehiculoConsultadoId || null,
    catalogoId: dto.catalogoId || null,
    patente: dto.patente || '',
    marca: dto.marca || '',
    modelo: [dto.modelo, dto.version].filter(Boolean).join(' '),
    anio: toNumber(dto.anio),
    motor: dto.numeroMotor || '',
    transmision: dto.transmision || '',
    vin: dto.vin || dto.chasis || '',
    combustible: dto.tipoCombustible || '',
    color: dto.color || '',
    imagen: null,
    totalRepuestos: null,
    fuente: dto.fuenteIdentificacion || null,
    requiereIngresoManual: Boolean(dto.requiereIngresoManual),
    mensaje: dto.mensaje || null,
  };
}

/**
 * Normaliza las dos formas de respuesta paginada que devuelve el backend:
 * `Page` de Spring (content/totalElements/totalPages/number) en /tiendas/publicas, y
 * ProductoPageResponseDTO (content/totalElements/totalPages/currentPage) en catálogo.
 */
export function adaptPage(response, itemAdapter) {
  if (!response) {
    return { items: [], total: 0, totalPages: 0, page: 0 };
  }

  const content = Array.isArray(response.content)
    ? response.content
    : Array.isArray(response) ? response : [];

  return {
    items: content.map((item, index) => itemAdapter(item, index)).filter(Boolean),
    total: toNumber(response.totalElements) ?? content.length,
    totalPages: toNumber(response.totalPages) ?? 1,
    page: toNumber(response.currentPage ?? response.number) ?? 0,
  };
}

/**
 * `AnuncioResponseDTO` -> anuncio del Mural.
 *
 * El backend fue modelado desde el cliente, asi que casi todos los campos ya
 * vienen con el nombre que usa la UI. Lo que si hay que normalizar:
 *
 * - `rating` y `reviewsCount` llegan HARDCODEADOS en 5.0 y 0 desde
 *   `AnuncioService.toResponse()`; no hay reseñas de anuncios en el backend.
 *   Se descartan para no mostrar un 5.0 falso en todas las tarjetas.
 * - las imagenes pueden venir como ruta relativa del servidor de archivos.
 * - `agendaConfig` viene como `Map<String,Object>`; puede llegar vacio ({}).
 */
export function adaptAd(dto) {
  if (!dto) return null;
  const images = (Array.isArray(dto.images) ? dto.images : []).map(resolveMediaUrl).filter(Boolean);
  const storyImages = (Array.isArray(dto.storyImages) ? dto.storyImages : []).map(resolveMediaUrl).filter(Boolean);
  const agendaConfig = dto.agendaConfig && Object.keys(dto.agendaConfig).length > 0 ? dto.agendaConfig : null;

  return {
    id: String(dto.id),
    tier: dto.tier || 'basica',
    title: dto.title || '',
    company: dto.company || '',
    category: dto.category || '',
    categoryLabel: dto.categoryLabel || '',
    description: dto.description || '',
    priceType: dto.priceType || 'quote',
    priceText: dto.priceText || '',
    priceValue: toNumber(dto.priceValue) ?? null,
    region: dto.region || '',
    commune: dto.commune || '',
    address: dto.address || '',
    phone: dto.phone || '',
    whatsapp: dto.whatsapp || null,
    openingHours: dto.openingHours || '',
    images,
    storyImages,
    features: Array.isArray(dto.features) ? dto.features : [],
    servicesOffered: Array.isArray(dto.servicesOffered) ? dto.servicesOffered : [],
    is24Hours: dto.is24Hours === true,
    hasOnlineBooking: dto.hasOnlineBooking === true,
    agendaConfig,
    agendaConfigId: dto.agendaConfigId || null,
    agendaConfigName: dto.agendaConfigName || null,
    agendaHours: dto.agendaHours || '',
    ownerUserId: dto.ownerUserId ? String(dto.ownerUserId) : null,
    ownerSellerId: dto.ownerSellerId ? String(dto.ownerSellerId) : null,
    ownerSellerExternalId: dto.ownerSellerExternalId ? String(dto.ownerSellerExternalId) : null,
    ownerEmail: dto.ownerEmail || null,
    publishedAt: dto.publishedAt || null,
    expiresAt: dto.expiresAt || null,
    updatedAt: dto.updatedAt || null,
    moderationStatus: dto.moderationStatus || 'PENDIENTE',
    rejectionReason: dto.rejectionReason || null,
    reviewedAt: dto.reviewedAt || null,
    activo: dto.activo === true,
  };
}

export function adaptAds(list) {
  return (Array.isArray(list) ? list : []).map(adaptAd).filter(Boolean);
}
