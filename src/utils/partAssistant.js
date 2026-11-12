/**
 * Lógica pura de Repuestín, el asistente "¿No encuentras tu repuesto?". Copia de la app:
 * `mobile/utils/part-assistant.ts`, `mobile/utils/assistant-order.ts` y `mobile/utils/assistant-news.ts`.
 * Sin red ni vistas: decide qué pregunta falta, qué camino ofrecer según lo que hay AHORA en el sistema,
 * arma el mensaje a las casas de repuestos, el encargo conversado y agrupa las novedades.
 */

// ─────────────────────────────────────────────────────────────── Búsqueda

export const EMPTY_ASSISTANT_CONTEXT = {
  repuesto: '',
  subcategoriaId: '',
  categoriaId: '',
  descripcion: '',
  patente: '',
  marca: '',
  modelo: '',
  anio: '',
  version: '',
  chasis: '',
  catalogoId: '',
};

/** Normaliza lo que llega de afuera (catálogo, burbuja guardada): todo string, nada undefined. */
export function toAssistantContext(partial = {}) {
  const out = { ...EMPTY_ASSISTANT_CONTEXT };
  for (const key of Object.keys(EMPTY_ASSISTANT_CONTEXT)) {
    const value = partial?.[key];
    out[key] = value == null ? '' : String(value);
  }
  return out;
}

export const AFFINITY_LABEL = { ALTA: 'Muy probable', MEDIA: 'Probable', POSIBLE: 'Posible' };

/** Iniciales para el avatar de una tienda sin imagen de perfil. */
export function storeInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join('') || 'CR').toUpperCase();
}

export function hasVehicle(ctx) {
  return Boolean(ctx.marca.trim() && ctx.modelo.trim());
}

/** Primera pregunta que falta por responder: 'part' | 'vehicle' | 'results'. */
export function nextQuestion(ctx) {
  if (!ctx.repuesto.trim()) return 'part';
  if (!hasVehicle(ctx)) return 'vehicle';
  return 'results';
}

/** Repuestos que ya existen > casas de repuestos a quienes escribirles > encargar el repuesto. */
export function pickOutcome(availability) {
  if (availability.productCount > 0) return 'products';
  if (availability.stores.length > 0) return 'stores';
  return 'order';
}

/** Casas de repuestos que existen además de las sugeridas. */
export function otherStoresCount(availability) {
  return Math.max((availability?.totalStores || 0) - (availability?.stores?.length || 0), 0);
}

export function vehicleLabel(ctx) {
  return [ctx.marca, ctx.modelo, ctx.anio, ctx.version].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
}

/** Mensaje que ve la casa de repuestos (sin teléfonos ni enlaces: el chat los rechaza). */
export function buildBroadcastText(ctx) {
  // Solo marca, modelo y año: la patente es privada y el chasis viaja aparte, en la ficha de la pregunta.
  const vehicle = [ctx.marca, ctx.modelo, ctx.anio].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
  const detail = ctx.descripcion.trim();
  return [
    `Hola, ¿tienen o pueden conseguir ${ctx.repuesto.trim()}${vehicle ? ` para ${vehicle}` : ''}?`,
    detail ? `Detalle: ${detail}` : '',
  ].filter(Boolean).join(' ');
}

export function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Filtra el desplegable por lo que escribe el usuario (en el nombre de la subcategoría o de su categoría). */
export function filterSubcategories(options, query) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((option) => {
    const haystack = normalizeText(`${option.nombre} ${option.categoriaNombre}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** Sugerencias mientras escribe: primero las que EMPIEZAN con lo escrito, luego las que lo contienen. */
export function suggestSubcategories(options, query, limit = 5) {
  const text = normalizeText(query);
  if (text.length < 2) return [];
  const matches = filterSubcategories(options, query);
  const startsWith = (option) => (normalizeText(option.nombre).startsWith(text) ? 0 : 1);
  return [...matches].sort((a, b) => startsWith(a) - startsWith(b)).slice(0, limit);
}

/** Agrupa por categoría conservando el orden que entrega el servidor. */
export function groupSubcategories(options) {
  const sections = [];
  const byCategory = new Map();
  for (const option of options) {
    let section = byCategory.get(option.categoriaId);
    if (!section) {
      section = { title: option.categoriaNombre, data: [] };
      byCategory.set(option.categoriaId, section);
      sections.push(section);
    }
    section.data.push(option);
  }
  return sections;
}

/** Busca la subcategoría por id, o por nombre exacto cuando solo se conoce el texto buscado. */
export function findSubcategory(options, { id, name } = {}) {
  if (id) {
    const byId = options.find((option) => String(option.id) === String(id));
    if (byId) return byId;
  }
  const clean = name ? normalizeText(name) : '';
  return clean ? options.find((option) => normalizeText(option.nombre) === clean) : undefined;
}

/** Cuánto espera Repuestín antes de ofrecer ayuda por su cuenta si el usuario no responde. */
export const NUDGE_AFTER_MS = 16000;

/** Repuestín es proactivo: si el usuario se queda quieto en un paso, propone el siguiente movimiento. */
export function nudgeFor(step, ctx, otherStores = 0) {
  switch (step) {
    case 'part':
      return '¿Te ayudo a elegir? Abre la lista y toca el tipo de repuesto (puedes buscarlo arriba), o escríbeme lo que necesitas 😊';
    case 'vehicle':
      return 'Con la patente es lo más rápido: la reviso y saco la marca, el modelo, el año y el chasis por ti. ¿La tienes a mano? 🚗';
    case 'products':
      return '¡Mira esas opciones! Si ninguna calza con lo que necesitas, no pasa nada: probamos con las casas de repuestos 😉';
    case 'stores':
      return otherStores > 0
        ? `Marca las casas a las que quieras escribirles, empezando por las primeras: suelen responder rápido. Y si prefieres que las ${otherStores} restantes también lo vean, toca la tarjeta de encargo 🚀`
        : 'Marca las casas a las que quieras escribirles y les dejo el mensaje: suelen responder rápido 🚀';
    case 'order':
      return `¿Publicamos el encargo${ctx.repuesto.trim() ? ` de ${ctx.repuesto.trim()}` : ''}? Así todas las casas de repuestos te ofertan sin que busques una por una 🙌`;
    case 'sent':
      return '¿Buscamos otro repuesto para el mismo vehículo? Ya tengo sus datos, así es mucho más rápido 😉';
    default:
      return '';
  }
}

// ─────────────────────────────────────────────────────────────── Encargo conversado

/** Mismos topes que el formulario y `NecesidadCompraCrearRequestDTO`. */
export const MAX_ORDER_PHOTOS = 5;
export const MAX_ORDER_ITEMS = 20;
export const MAX_ORDER_QUANTITY = 999;

/** "¿Para cuándo lo necesitas?": vigencia de las ofertas y plazo de envío, con los valores del formulario. */
export const URGENCY_OPTIONS = [
  { key: 'URGENTE', label: 'Lo antes posible', hint: 'Las tiendas ofertan durante 24 h', vigenciaHoras: 24, plazoEnvio: 'Mismo día / Inmediato' },
  { key: 'SEMANA', label: 'Esta semana', hint: 'Ofertas durante 48 h · recomendado', vigenciaHoras: 48, plazoEnvio: '48 horas' },
  { key: 'SIN_APURO', label: 'Sin apuro', hint: 'Más tiempo para comparar: 5 días', vigenciaHoras: 120, plazoEnvio: 'A convenir' },
];

/** El encargo parte con lo que el usuario ya le contó a Repuestín: el repuesto y su detalle. */
export function emptyOrderDraft(ctx) {
  const nombre = String(ctx?.repuesto || '').trim();
  return {
    items: nombre ? [{ nombre, cantidad: 1, descripcion: String(ctx?.descripcion || '').trim() }] : [],
    fotos: [],
    tipoEnvio: null,
    address: null,
    urgency: null,
    presupuesto: null,
    addressLocked: false,
  };
}

/** "Quiero publicar un encargo", "encargar"...: el usuario pide publicar en vez de buscar. */
export function detectOrderIntent(text) {
  const clean = normalizeText(text);
  if (!clean) return false;
  return /\b(publicar|publica|hacer|crear|armar|dejar|subir|generar)\b.*\bencargo/.test(clean)
    || /^(un |mi )?encargo\b/.test(clean)
    || /\bencargar\b/.test(clean)
    || /^quiero (un )?encargo/.test(clean);
}

/** Cantidad escrita o tocada: entero entre 1 y 999, o null si no sirve. */
export function parseQuantity(value) {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value).replace(/\D/g, ''), 10);
  return Number.isInteger(n) && n >= 1 && n <= MAX_ORDER_QUANTITY ? n : null;
}

/** Presupuesto en pesos ("$ 45.000" -> 45000); null si no escribió un monto válido. */
export function parseBudget(value) {
  const n = Number.parseInt(String(value || '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatCLP(value) {
  return `$${Math.round(value).toLocaleString('es-CL')}`;
}

export function urgencyOption(key) {
  return URGENCY_OPTIONS.find((option) => option.key === key) ?? URGENCY_OPTIONS[1];
}

/** "Av. Italia 1234, Ñuñoa". */
export function addressLabel(address) {
  return [address?.calleYNumero, address?.comunaNombre].filter(Boolean).join(', ');
}

/** Lo que aún impide publicar (en palabras para el usuario), o null si está listo. */
export function orderMissing(ctx, draft) {
  if (!ctx.marca.trim() || !ctx.modelo.trim()) return 'el vehículo';
  if (draft.items.length === 0 || draft.items.some((item) => !item.nombre.trim())) return 'qué repuesto necesitas';
  if (draft.items.some((item) => parseQuantity(item.cantidad) === null)) return 'la cantidad';
  if (!draft.tipoEnvio) return 'cómo lo quieres recibir';
  if (!draft.address?.comunaNombre) return 'tu dirección';
  return null;
}

/** El mismo cuerpo que envía el formulario "Publicar encargo" (`POST /necesidades-compra`). */
export function buildAuctionPayload(ctx, draft) {
  const urgency = urgencyOption(draft.urgency);
  const items = draft.items.map((item) => ({
    repuestoSolicitado: item.nombre.trim(),
    descripcion: item.descripcion.trim() || undefined,
    cantidad: parseQuantity(item.cantidad) ?? 1,
  }));
  const esRetiro = draft.tipoEnvio === 'Retiro en tienda';
  const anio = Number.parseInt(ctx.anio, 10);
  const direccionId = !esRetiro && draft.address ? Number(draft.address.id) : NaN;
  return {
    patente: ctx.patente.trim() ? ctx.patente.trim().toUpperCase() : undefined,
    marca: ctx.marca.trim() || undefined,
    modelo: ctx.modelo.trim() || undefined,
    anio: Number.isFinite(anio) ? anio : undefined,
    version: ctx.version.trim() || undefined,
    chasis: ctx.chasis.trim() || undefined,
    repuestoSolicitado: items[0]?.repuestoSolicitado,
    cantidad: items.reduce((total, item) => total + item.cantidad, 0) || 1,
    items,
    tiempoVigenciaHoras: urgency.vigenciaHoras,
    tiempoMaximoEnvio: urgency.plazoEnvio,
    tipoEnvio: draft.tipoEnvio ?? 'Despacho a domicilio',
    presupuestoMaximo: draft.presupuesto ?? undefined,
    region: draft.address?.regionNombre || undefined,
    comuna: draft.address?.comunaNombre || undefined,
    // Igual que el formulario: con retiro en tienda no hay dirección de entrega, solo la comuna para ubicarlo.
    direccionId: Number.isFinite(direccionId) ? direccionId : undefined,
    fotos: draft.fotos.map((photo) => photo.url),
  };
}

/** Filas del resumen antes de publicar (`icon` es una clave de AssistantIcons). */
export function orderSummary(ctx, draft) {
  const urgency = urgencyOption(draft.urgency);
  return [
    { icon: 'car', label: 'Vehículo', value: vehicleLabel(ctx) || '—' },
    {
      icon: 'wrench',
      label: draft.items.length === 1 ? 'Repuesto' : `Repuestos (${draft.items.length})`,
      value: draft.items.map((item) => `${item.cantidad} × ${item.nombre}${item.descripcion ? ` (${item.descripcion})` : ''}`).join('\n'),
    },
    { icon: 'images', label: 'Fotos', value: draft.fotos.length === 0 ? 'Sin fotos' : `${draft.fotos.length} ${draft.fotos.length === 1 ? 'foto' : 'fotos'}` },
    {
      icon: draft.tipoEnvio === 'Retiro en tienda' ? 'store' : 'bike',
      label: 'Entrega',
      value: draft.tipoEnvio === 'Retiro en tienda'
        ? `Retiro en tienda${draft.address ? ` · cerca de ${draft.address.comunaNombre}` : ''}`
        : draft.address ? `Despacho a ${addressLabel(draft.address)}` : 'Despacho a domicilio',
    },
    ...(draft.addressLocked && draft.address ? [{ icon: 'building', label: 'Dirección de tu taller (fija)', value: addressLabel(draft.address) }] : []),
    { icon: 'clock', label: 'Para cuándo', value: `${urgency.label} · ${urgency.hint.toLowerCase()}` },
    { icon: 'cash', label: 'Presupuesto', value: draft.presupuesto ? `Hasta ${formatCLP(draft.presupuesto)}` : 'Sin tope: que oferten' },
  ];
}

/** Lo que ya se le contó a Repuestín, como encargo precargado del formulario completo. */
export function orderPrefill(ctx, draft = null) {
  const items = draft?.items?.length
    ? draft.items.map((item) => ({ repuesto: item.nombre, cantidad: item.cantidad, descripcion: item.descripcion }))
    : ctx.repuesto.trim() ? [{ repuesto: ctx.repuesto.trim(), cantidad: 1, descripcion: ctx.descripcion.trim() }] : [];
  const anio = Number.parseInt(ctx.anio, 10);
  return {
    patente: ctx.patente.trim() ? ctx.patente.trim().toUpperCase() : '',
    marca: ctx.marca.trim(),
    modelo: ctx.modelo.trim(),
    anio: Number.isFinite(anio) ? anio : undefined,
    version: ctx.version.trim() || undefined,
    chasis: ctx.chasis.trim() || undefined,
    items,
    fotos: draft?.fotos?.map((photo) => photo.url) || [],
    tipoEnvio: draft?.tipoEnvio || undefined,
    presupuestoMaximo: draft?.presupuesto || undefined,
    tiempoVigenciaHoras: draft?.urgency ? urgencyOption(draft.urgency).vigenciaHoras : undefined,
    tiempoMaximoEnvio: draft?.urgency ? urgencyOption(draft.urgency).plazoEnvio : undefined,
  };
}

/** "NC-000123": el código de seguimiento del encargo (como `auctionTrackingCode` de la app). */
export function auctionTrackingCode(id) {
  return `NC-${String(id).padStart(6, '0')}`;
}

// ─────────────────────────────────────────────────────────────── Novedades

/**
 * Avisos del flujo consulta → oferta del repuesto → compra. Son los que Repuestín cuenta en la burbuja,
 * tanto al comprador como a la casa de repuestos, aunque no haya una búsqueda pendiente.
 */
export const ASSISTANT_NEWS_TYPES = new Set([
  'CONSULTA_REPUESTO',
  'CONSULTA_REPUESTO_OFRECIDO',
  'CONSULTA_SIN_REPUESTO',
  'CONSULTA_REPUESTO_COMPRADO',
  'CONSULTA_REPUESTO_RESPUESTA',
]);

/** Claves solo de presentación: nunca viajan como parámetros de navegación. */
export const ASSISTANT_DISPLAY_PARAMS = ['astRol', 'astNombre', 'astFoto', 'astBusca', 'astVehiculo', 'astOfrece'];

export function stripAssistantParams(params) {
  if (!params) return {};
  const clean = {};
  for (const [key, value] of Object.entries(params)) {
    if (!ASSISTANT_DISPLAY_PARAMS.includes(key)) clean[key] = value;
  }
  return clean;
}

const textOrUndefined = (value) => (value && String(value).trim() ? String(value).trim() : undefined);

export function toAssistantNewsItem(notification) {
  const params = notification.targetParams ?? {};
  const role = String(params.astRol || '').toUpperCase();
  return {
    id: notification.id,
    type: notification.tipo,
    title: notification.titulo,
    message: notification.mensaje,
    createdAt: notification.createdAt || notification.fechaCreacion,
    quoteId: textOrUndefined(params.quoteId),
    counterpartName: textOrUndefined(params.astNombre),
    counterpartPhoto: textOrUndefined(params.astFoto),
    counterpartRole: role === 'TIENDA' || role === 'COMPRADOR' ? role : undefined,
    searchedPart: textOrUndefined(params.astBusca),
    vehicle: textOrUndefined(params.astVehiculo),
    offeredPart: textOrUndefined(params.astOfrece),
  };
}

const itemTime = (item) => {
  const value = item.createdAt ? new Date(item.createdAt).getTime() : NaN;
  return Number.isFinite(value) ? value : 0;
};
const newestFirst = (a, b) => itemTime(b) - itemTime(a) || b.id - a.id;

/** Agrupa los avisos: primero por chat (misma persona, mismo tema) y los chats por búsqueda. */
export function groupAssistantNews(items) {
  const threads = new Map();
  for (const item of [...items].sort(newestFirst)) {
    const key = item.quoteId ? `chat:${item.quoteId}` : `aviso:${item.id}`;
    threads.set(key, [...(threads.get(key) ?? []), item]);
  }
  const topics = new Map();
  for (const [key, threadItems] of threads) {
    const withTopic = threadItems.find((item) => item.searchedPart) ?? threadItems[0];
    const latest = { ...threadItems[0] };
    for (const field of ['counterpartName', 'counterpartPhoto', 'counterpartRole', 'searchedPart', 'vehicle', 'offeredPart']) {
      if (!latest[field]) {
        const source = threadItems.find((item) => item[field]);
        if (source) latest[field] = source[field];
      }
    }
    const topicKey = withTopic.searchedPart
      ? `busca:${withTopic.searchedPart.toLowerCase()}|${(withTopic.vehicle ?? '').toLowerCase()}`
      : 'sin-tema';
    const topic = topics.get(topicKey) ?? {
      key: topicKey,
      searchedPart: withTopic.searchedPart,
      vehicle: withTopic.searchedPart ? withTopic.vehicle : undefined,
      threads: [],
    };
    topic.threads.push({ key, latest, items: threadItems });
    topics.set(topicKey, topic);
  }
  return [...topics.values()].sort((a, b) => {
    if (a.key === 'sin-tema') return 1;
    if (b.key === 'sin-tema') return -1;
    return newestFirst(a.threads[0].latest, b.threads[0].latest);
  });
}

/** "hace 5 min", "hace 2 h", "ayer"… */
export function timeAgo(value, now = Date.now()) {
  if (!value) return '';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((now - time) / 60_000));
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}
