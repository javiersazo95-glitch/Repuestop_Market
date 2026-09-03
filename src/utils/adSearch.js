// Búsqueda y sugerencias del Mural de Anuncios.
//
// Contraparte web de `mobile/utils/ad-search.ts` del monorepo: mismo índice de
// textos sugeribles (servicios, talleres, categorías, comunas) y mismo criterio
// de coincidencia, para que escribir en el buscador se sienta igual que en la app.

export const AD_SUGGESTION_MIN_LENGTH = 2;
export const AD_SUGGESTION_LIMIT = 8;

/** Minúsculas, sin tildes y sin espacios sobrantes, para comparar sin ruido. */
export function normalizeSearchText(value) {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Índice de textos sugeribles del mural. Se arma una sola vez por cambio de
 * anuncios (no en cada tecla) para que la búsqueda siga siendo barata aunque
 * haya muchos avisos publicados.
 */
export function buildAdSuggestionIndex(ads = []) {
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

  ads.forEach((ad) => {
    (ad.features || []).forEach((feature) => push(feature, 'servicio'));
    (ad.servicesOffered || []).forEach((service) => push(service, 'servicio'));
    push(ad.title, 'servicio');
    push(ad.company, 'taller');
    push(ad.categoryLabel, 'categoria');
    push(ad.commune, 'comuna');
  });

  return entries;
}

/**
 * Recomendaciones para el texto escrito: primero lo que empieza con el término
 * y después lo que solo lo contiene, que es el orden que espera quien escribe.
 */
export function matchAdSuggestions(index = [], input = '', limit = AD_SUGGESTION_LIMIT) {
  const term = normalizeSearchText(input);
  if (term.length < AD_SUGGESTION_MIN_LENGTH) return [];

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

/** ¿El aviso calza con el texto buscado? Cubre también sus servicios. */
export function adMatchesSearch(ad, query) {
  const term = normalizeSearchText(query);
  if (!term) return true;

  const haystack = [
    ad.title,
    ad.company,
    ad.description,
    ad.commune,
    ad.categoryLabel,
    ...(ad.features || []),
    ...(ad.servicesOffered || []),
    ...(ad.specialistBrands || []),
  ];

  return haystack.some((value) => normalizeSearchText(value).includes(term));
}
