// Búsqueda y sugerencias del buscador de talleres.
//
// Contraparte web de `mobile/utils/taller-search.ts` del monorepo: mismo índice de
// textos sugeribles (servicios, talleres, categorías, comunas) y mismo criterio
// de coincidencia, para que escribir en el buscador se sienta igual que en la app.

export const TALLER_SUGGESTION_MIN_LENGTH = 2;
export const TALLER_SUGGESTION_LIMIT = 8;

/** Minúsculas, sin tildes y sin espacios sobrantes, para comparar sin ruido. */
export function normalizeSearchText(value) {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Nombres de servicio del catalogo del taller, mas sus etiquetas generales. */
export function tallerServiceNames(taller) {
  return [...(taller?.services || []).map((service) => service.name), ...(taller?.features || [])];
}

/**
 * Índice de textos sugeribles del buscador. Se arma una sola vez por cambio de
 * talleres (no en cada tecla) para que la búsqueda siga siendo barata aunque
 * haya muchos talleres publicados.
 */
export function buildTallerSuggestionIndex(talleres = []) {
  const entries = [];
  const seen = new Set();

  const push = (label, type) => {
    const clean = (label ?? '').toString().trim();
    if (!clean) return;
    const key = normalizeSearchText(clean);
    const dedupeKey = `${type}:${key}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    entries.push({ label: clean, key, type });
  };

  talleres.forEach((taller) => {
    tallerServiceNames(taller).forEach((name) => push(name, 'servicio'));
    push(taller.name, 'taller');
    push(taller.commune, 'comuna');
  });

  return entries;
}

/**
 * Recomendaciones para el texto escrito: primero lo que empieza con el término
 * y después lo que solo lo contiene, que es el orden que espera quien escribe.
 */
export function matchTallerSuggestions(index = [], input = '', limit = TALLER_SUGGESTION_LIMIT) {
  const term = normalizeSearchText(input);
  if (term.length < TALLER_SUGGESTION_MIN_LENGTH) return [];

  const starts = [];
  const contains = [];

  for (const entry of index) {
    if (entry.key.startsWith(term)) {
      starts.push({ label: entry.label, type: entry.type });
      if (starts.length >= limit) return starts;
    } else if (contains.length < limit && entry.key.includes(term)) {
      contains.push({ label: entry.label, type: entry.type });
    }
  }

  return [...starts, ...contains].slice(0, limit);
}

/** ¿El taller calza con el texto buscado? Cubre también sus servicios, categorías y marcas. */
export function tallerMatchesSearch(taller, query) {
  const term = normalizeSearchText(query);
  if (!term) return true;

  const haystack = [
    taller.name,
    taller.description,
    taller.commune,
    ...tallerServiceNames(taller),
    ...(taller.specialistBrands || []),
  ];

  return haystack.some((value) => normalizeSearchText(value).includes(term));
}

/** "frenos" -> "freno": el plural no debe esconder el servicio ("Cambio de pastillas de freno"). */
function singular(word) {
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * Los servicios del taller que calzan con lo que busca el cliente (texto o servicio elegido en el
 * filtro), para que la card muestre primero y resaltado justo lo que esta buscando. Cada termino
 * calza si todas sus palabras aparecen en el nombre del servicio (sin tildes y en singular).
 */
export function matchingServices(taller, terms = []) {
  const wanted = terms
    .map((term) => normalizeSearchText(term).split(/\s+/).filter((word) => word.length >= 3).map(singular))
    .filter((words) => words.length > 0);
  if (wanted.length === 0) return [];
  return (taller?.services || []).filter((service) => {
    const name = normalizeSearchText(service.name);
    return wanted.some((words) => words.every((word) => name.includes(word)));
  });
}
