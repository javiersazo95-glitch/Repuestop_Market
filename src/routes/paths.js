// Mapa único de rutas del marketplace. Toda navegación (Header, Footer, tarjetas,
// modales) debe construir sus URLs desde aquí para que no existan strings sueltos
// que se desincronicen del router.

export const ROUTES = {
  home: '/',
  catalog: '/repuestos',
  product: '/repuestos/:productId',
  stores: '/tiendas',
  store: '/tiendas/:storeId',
  profile: '/perfil',
  profileTab: '/perfil/:tab',
  support: '/ayuda',
  helpContact: '/ayuda/contacto',
  helpAllFaqs: '/ayuda/preguntas-frecuentes',
  helpCategory: '/ayuda/:categoria',
  terms: '/terminos',
  privacy: '/privacidad',
  about: '/nosotros',
  adsWall: '/mural-anuncios',
  sellerRegister: '/vender',
  purchaseSuccess: '/compra-exitosa',
  notFound: '/404',
};

// Pestañas válidas del panel de perfil; cada una es una URL (`/perfil/pedidos`).
export const PROFILE_TABS = [
  'resumen', 'pedidos', 'favoritos', 'datos', 'consultas',
  'cotizaciones', 'productos', 'preguntas_productos', 'retiros', 'tienda', 'tienda_datos',
  'anuncios',
];

/** Slug legible para URLs de producto/tienda: "Pastillas de freno" -> "pastillas-de-freno" */
export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * El id siempre va primero para poder recuperarlo del param aunque el slug cambie:
 * `/repuestos/128-pastillas-de-freno` -> id 128.
 */
export function toIdSlug(id, name) {
  const slug = slugify(name);
  return slug ? `${id}-${slug}` : String(id);
}

/** Extrae el id numérico (o el param completo si el backend usa ids no numéricos). */
export function parseIdSlug(param) {
  if (!param) return null;
  const match = String(param).match(/^(\d+)(?:-|$)/);
  return match ? match[1] : String(param);
}

export function productPath(product) {
  if (!product) return ROUTES.catalog;
  const id = product.id ?? product.productoId ?? product;
  return `${ROUTES.catalog}/${toIdSlug(id, product.titulo || product.nombre)}`;
}

export function storePath(store) {
  if (!store) return ROUTES.stores;
  const id = store.id ?? store.proveedorId ?? store;
  return `${ROUTES.stores}/${toIdSlug(id, store.nombre || store.storeName)}`;
}

export function profilePath(tab = 'resumen') {
  return `${ROUTES.profile}/${tab || 'resumen'}`;
}

/** `/ayuda/pedidos`. Sin slug devuelve la portada del centro de ayuda. */
export function helpCategoryPath(slug) {
  return slug ? `${ROUTES.support}/${slug}` : ROUTES.support;
}

/**
 * `/ayuda/contacto?tema=buyer-orders`. El tema viaja en la URL para que el
 * formulario llegue preseleccionado desde una categoría o desde otra pantalla.
 */
export function helpContactPath(topicId) {
  return topicId ? `${ROUTES.helpContact}?tema=${encodeURIComponent(topicId)}` : ROUTES.helpContact;
}

/**
 * Construye `/repuestos?categoria=...&subcategoria=...&q=...`.
 * Acepta el mismo objeto de filtro que ya usaban Header/Hero (`onSelectCategory`).
 */
export function catalogPath(filter = null, extra = {}) {
  const params = new URLSearchParams();
  const normalized = typeof filter === 'string' ? { category: filter } : (filter || {});

  if (normalized.category) params.set('categoria', normalized.category);
  if (normalized.categoryId) params.set('categoriaId', String(normalized.categoryId));
  if (normalized.categoryName) params.set('categoriaNombre', normalized.categoryName);
  if (normalized.subcategory) params.set('subcategoria', normalized.subcategory);
  if (normalized.subcategoryId) params.set('subcategoriaId', String(normalized.subcategoryId));
  if (extra.q) params.set('q', extra.q);
  if (extra.pagina && Number(extra.pagina) > 1) params.set('pagina', String(extra.pagina));

  const query = params.toString();
  return query ? `${ROUTES.catalog}?${query}` : ROUTES.catalog;
}

/** Lee los filtros del catálogo desde los search params de la URL. */
export function catalogFilterFromParams(searchParams) {
  const filter = {
    category: searchParams.get('categoria') || null,
    categoryId: searchParams.get('categoriaId') || null,
    categoryName: searchParams.get('categoriaNombre') || null,
    subcategory: searchParams.get('subcategoria') || null,
    subcategoryId: searchParams.get('subcategoriaId') || null,
  };
  const hasFilter = Object.values(filter).some(Boolean);
  return {
    filter: hasFilter ? filter : null,
    query: searchParams.get('q') || '',
    page: Math.max(1, Number(searchParams.get('pagina') || 1) || 1),
  };
}



