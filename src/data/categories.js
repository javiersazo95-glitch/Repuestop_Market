/**
 * Categorias del marketplace armadas desde el Mantenedor comun, con respaldo local.
 *
 * El bootstrap (`categorias`) trae las categorias tecnicas activas, ordenadas, con `slug`,
 * `familia`, `iconoUrl`, `iconoNombre`, `color`, `imagenUrl` y sus subcategorias. Aca se
 * traducen a las mismas estructuras que el sitio ya consumia:
 * - `SIDEBAR_CATEGORIES`: las familias (frenos, motor, ...), agrupando por `familia`.
 * - `HEADER_CATEGORIES`: las categorias tecnicas del mega menu y los filtros.
 * - `CATEGORY_VISUALS`: icono/color/foto por categoria.
 * - `NAVIGATION_CATEGORIES`, `CAROUSEL_CATEGORIES` y los `*_BY_ID` derivados.
 *
 * Sin bootstrap todo sale de `categoriesFallback.js` y queda identico a antes.
 *
 * El `id` de cada categoria sigue siendo el id local de siempre ('aceite', 'admision-aire') cuando
 * la categoria remota calza con una conocida, aunque el slug del backend se escriba distinto
 * ('admision-de-aire'): ese id viaja en las URLs (`?categoria=`), en `data-category` del CSS y en
 * los productos ya adaptados en cache, y cambiarlo romperia enlaces guardados. El slug remoto queda
 * en `slug`, que es lo que se usa para cruzar con el backend. Una categoria nueva, sin equivalente
 * local, usa su slug como id.
 */
import { useMemo } from 'react';
import { useCatalogo } from '../remoteConfig/hooks';
import { remoteConfig } from '../remoteConfig/remoteConfig';
import {
  CATEGORY_VISUALS_FALLBACK,
  HEADER_CATEGORIES_FALLBACK,
  SIDEBAR_CATEGORIES_FALLBACK,
  getPartImage as getFallbackPartImage,
  normalizePartKey,
} from './categoriesFallback';

export {
  CATEGORY_GRID_ITEMS,
  CATEGORIES,
  POPULAR_CATEGORIES,
  getCategoryVisuals,
} from './categoriesFallback';

const DEFAULT_VISUAL = { iconName: 'Cog', color: '#f97316', image: '/cat_motor.jpg' };

// Palabras que el backend deja en el slug y el id local no ("admision-de-aire" vs "admision-aire",
// "ejes-delantero-y-trasero" vs "ejes-delantero-trasero").
const SLUG_STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e']);

/** Clave de cruce tolerante a acentos, mayusculas y conectores. */
export function categoryMatchKey(value) {
  return normalizePartKey(String(value || '').replace(/[-_]/g, ' '))
    .split(' ')
    .filter((word) => word && !SLUG_STOPWORDS.has(word))
    .join('');
}

const FALLBACK_BY_KEY = new Map();
HEADER_CATEGORIES_FALLBACK.forEach((category) => {
  FALLBACK_BY_KEY.set(categoryMatchKey(category.id), category);
  FALLBACK_BY_KEY.set(categoryMatchKey(category.nombre), category);
});

const FAMILY_BY_ID = new Map(SIDEBAR_CATEGORIES_FALLBACK.map((family) => [family.id, family]));
const FAMILY_ORDER = SIDEBAR_CATEGORIES_FALLBACK.map((family) => family.id);

function findFallbackCategory(remote) {
  return FALLBACK_BY_KEY.get(categoryMatchKey(remote.slug))
    || FALLBACK_BY_KEY.get(categoryMatchKey(remote.nombre))
    || null;
}

/** Foto local de una subcategoria por nombre (las claves de `subcategoryImages` llevan acentos). */
function fallbackSubcategoryImage(fallback, nombre) {
  if (!fallback?.subcategoryImages) return null;
  if (fallback.subcategoryImages[nombre]) return fallback.subcategoryImages[nombre];
  const key = normalizePartKey(nombre);
  const entry = Object.entries(fallback.subcategoryImages).find(([name]) => normalizePartKey(name) === key);
  return entry ? entry[1] : null;
}

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/** Estructuras derivadas, iguales para el respaldo y para lo remoto. */
function withDerived({ sidebar, header, visuals }) {
  const navigation = header.map((category) => ({ ...category, ...visuals[category.id] }));
  const carousel = header.map((category) => ({ ...category, ...visuals[category.id], count: '', badge: '' }));
  return {
    SIDEBAR_CATEGORIES: sidebar,
    HEADER_CATEGORIES: header,
    CATEGORY_VISUALS: visuals,
    // Fuente única para los listados de navegación y filtros. Cada categoría técnica conserva el
    // `filterId` del inventario para que los controles sigan filtrando por los IDs reales.
    NAVIGATION_CATEGORIES: navigation,
    CAROUSEL_CATEGORIES: carousel,
    // Quick lookups used by product/part cards to resolve the right icon, color and reference
    // image from a product's `categoria` id without duplicating the mapping everywhere.
    CATEGORY_ICON_BY_ID: Object.fromEntries(navigation.map((cat) => [cat.id, cat.iconName])),
    CATEGORY_ICON_URL_BY_ID: Object.fromEntries(navigation.map((cat) => [cat.id, cat.iconUrl || null])),
    CATEGORY_COLOR_BY_ID: Object.fromEntries(navigation.map((cat) => [cat.id, cat.color])),
    CATEGORY_IMAGE_BY_ID: Object.fromEntries(navigation.map((cat) => [cat.id, cat.image])),
    // Foto subida en el mantenedor por nombre de subcategoria normalizado (ver `getPartImage`).
    remoteSubcategoryImages: [],
  };
}

const FALLBACK_CATEGORIES = withDerived({
  sidebar: SIDEBAR_CATEGORIES_FALLBACK,
  header: HEADER_CATEGORIES_FALLBACK,
  visuals: CATEGORY_VISUALS_FALLBACK,
});

function buildFromRemote(remoteCategorias) {
  const usedIds = new Set();
  const header = [];
  const visuals = {};
  const remoteSubcategoryImages = [];

  remoteCategorias.forEach((remote) => {
    if (!remote?.nombre) return;
    const fallback = findFallbackCategory(remote);
    const id = fallback?.id && !usedIds.has(fallback.id) ? fallback.id : (remote.slug || categoryMatchKey(remote.nombre));
    if (usedIds.has(id)) return;
    usedIds.add(id);

    const fallbackVisual = CATEGORY_VISUALS_FALLBACK[fallback?.id] || null;
    const familyId = remote.familia || fallback?.filterId || id;
    const family = FAMILY_BY_ID.get(familyId);
    const remoteSubs = Array.isArray(remote.subcategorias) ? remote.subcategorias.filter((sub) => sub?.nombre) : [];
    // Si el backend aun no tiene subcategorias para esta categoria se conservan las locales: el
    // mega menu no puede quedar vacio por un dato que todavia no se cargo.
    const subcategoryNames = remoteSubs.length ? remoteSubs.map((sub) => sub.nombre) : (fallback?.subcategories || []);
    const subcategoryImages = {};
    const subcategorySlugs = {};
    subcategoryNames.forEach((nombre) => {
      const sub = remoteSubs.find((item) => item.nombre === nombre);
      const image = sub?.imagenUrl || fallbackSubcategoryImage(fallback, nombre) || getFallbackPartImage(nombre);
      if (image) subcategoryImages[nombre] = image;
      if (sub?.slug) subcategorySlugs[nombre] = sub.slug;
      if (sub?.imagenUrl) remoteSubcategoryImages.push([normalizePartKey(nombre), sub.imagenUrl]);
    });

    const headerImage = remote.imagenUrl
      || fallback?.image
      || getFallbackPartImage(remote.slug, remote.nombre)
      || family?.image
      || DEFAULT_VISUAL.image;

    header.push({
      id,
      slug: remote.slug || id,
      backendId: remote.id ?? null,
      nombre: remote.nombre,
      filterId: familyId,
      image: headerImage,
      subcategories: subcategoryNames,
      subcategoryImages,
      subcategorySlugs,
    });

    visuals[id] = {
      iconName: remote.iconoNombre || fallbackVisual?.iconName || family?.iconName || DEFAULT_VISUAL.iconName,
      iconUrl: remote.iconoUrl || null,
      color: remote.color || fallbackVisual?.color || family?.color || DEFAULT_VISUAL.color,
      image: remote.imagenUrl || fallbackVisual?.image || headerImage,
    };
  });

  if (!header.length) return FALLBACK_CATEGORIES;

  // Familias = valores de `familia` presentes, en el orden de siempre y las nuevas al final. Una
  // familia que el Market no conoce toma nombre e identidad de su primera categoria.
  const familyIds = [...new Set(header.map((category) => category.filterId))]
    .sort((left, right) => {
      const leftIndex = FAMILY_ORDER.indexOf(left);
      const rightIndex = FAMILY_ORDER.indexOf(right);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    });
  const sidebar = familyIds.map((familyId) => {
    const known = FAMILY_BY_ID.get(familyId);
    if (known) return known;
    const first = header.find((category) => category.filterId === familyId);
    const visual = visuals[first.id];
    return { id: familyId, nombre: capitalize(familyId.replace(/[-_]/g, ' ')), count: '', iconName: visual.iconName, color: visual.color, image: first.image };
  });

  const result = withDerived({ sidebar, header, visuals });
  result.remoteSubcategoryImages = remoteSubcategoryImages.sort((a, b) => b[0].length - a[0].length);
  return result;
}

// Memo por identidad del arreglo remoto: el store solo cambia de arreglo al llegar otro bootstrap.
let lastRemote = null;
let lastBuilt = FALLBACK_CATEGORIES;

/** Arma las estructuras de categorias para un arreglo `categorias` del bootstrap (o null). */
export function buildCategories(remoteCategorias) {
  if (!Array.isArray(remoteCategorias) || remoteCategorias.length === 0) return FALLBACK_CATEGORIES;
  if (remoteCategorias === lastRemote) return lastBuilt;
  lastRemote = remoteCategorias;
  lastBuilt = buildFromRemote(remoteCategorias);
  return lastBuilt;
}

/** Version sin hook, para adapters y utils que corren fuera de React. */
export function getCategories() {
  return buildCategories(remoteConfig.catalogo('categorias', null));
}

/** Categorias vigentes; se recalculan solas cuando el mantenedor publica cambios. */
export function useCategories() {
  const remote = useCatalogo('categorias', null);
  return useMemo(() => buildCategories(remote), [remote]);
}

/**
 * Foto de LA PIEZA que nombra el titulo (ver `getPartImage` en categoriesFallback.js). Primero
 * busca entre las fotos de subcategoria subidas al mantenedor y despues en la libreria local.
 */
export function getPartImage(...candidates) {
  const remoteImages = getCategories().remoteSubcategoryImages;
  if (!remoteImages.length) return getFallbackPartImage(...candidates);
  // Candidato por candidato, como el original: el TITULO manda sobre la subcategoria declarada.
  for (const candidate of candidates) {
    const text = normalizePartKey(candidate);
    if (!text) continue;
    const match = remoteImages.find(([key]) => key && text.includes(key));
    if (match) return match[1];
    const local = getFallbackPartImage(candidate);
    if (local) return local;
  }
  return null;
}

/**
 * ¿`backendItem` (un `CatalogoOpcionDTO` de `/catalogos/inventario/categorias-repuesto`, o una
 * categoria de los filtros publicados) es esta categoria del sitio? Cruza por id del bootstrap,
 * despues por `slug` (inmutable en el mantenedor) y recien al final por nombre, que era el unico
 * cruce antes y se rompe si el dueno renombra la categoria.
 */
export function matchesBackendCategory(category, backendItem) {
  if (!category || !backendItem) return false;
  if (category.backendId != null && backendItem.id != null && String(category.backendId) === String(backendItem.id)) return true;
  if (backendItem.slug) {
    if (backendItem.slug === category.slug || backendItem.slug === category.id) return true;
    if (categoryMatchKey(backendItem.slug) === categoryMatchKey(category.slug || category.id)) return true;
  }
  const backendName = backendItem.nombre ?? backendItem.categoriaNombre;
  return Boolean(backendName) && categoryMatchKey(backendName) === categoryMatchKey(category.nombre);
}

/** Categoria vigente que corresponde a un `slug` o nombre del backend (cruce por slug primero). */
export function findCategoryBySlugOrName(categories, { slug, nombre } = {}) {
  const header = categories.HEADER_CATEGORIES;
  if (slug) {
    const bySlug = header.find((category) => category.slug === slug || category.id === slug);
    if (bySlug) return bySlug;
  }
  const key = categoryMatchKey(nombre);
  if (!key) return null;
  return header.find((category) => categoryMatchKey(category.nombre) === key || categoryMatchKey(category.id) === key)
    || null;
}
