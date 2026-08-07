// Identidad visual de las marcas de vehículo.
//
// Cubre las 266 marcas que devuelve GET /catalogos/inventario/marcas-vehiculo:
// 52 tienen emblema vectorial propio en public/brand-logos (Simple Icons, CC0) y el
// resto —marcas chinas, de motos y desaparecidas, que no tienen logo libre
// disponible— se resuelve con un monograma legible en vez del ícono de auto
// genérico que antes se repetía en todas.
//
// La resolución es por nombre normalizado, así que una marca nueva en el catálogo
// se muestra igual de bien sin tocar este archivo: si algún día se agrega su SVG a
// public/brand-logos con el mismo slug, pasa a mostrar el emblema automáticamente.

/** Emblemas disponibles en public/brand-logos/<slug>.svg */
export const VEHICLE_BRAND_LOGO_SLUGS = new Set([
  'acura', 'astonmartin', 'audi', 'bentley', 'bmw', 'cadillac', 'chevrolet', 'chrysler',
  'citroen', 'dacia', 'dsautomobiles', 'ducati', 'ferrari', 'fiat', 'ford', 'honda',
  'husqvarna', 'hyundai', 'infiniti', 'iveco', 'jeep', 'kia', 'koenigsegg', 'ktm', 'lada',
  'lamborghini', 'mahindra', 'maserati', 'mazda', 'mclaren', 'mg', 'mini', 'mitsubishi',
  'nissan', 'opel', 'peugeot', 'porsche', 'ram', 'renault', 'rollsroyce', 'samsung',
  'seat', 'skoda', 'smart', 'subaru', 'suzuki', 'tata', 'tesla', 'toyota', 'vespa',
  'volkswagen', 'volvo',
]);

// Nombres del catálogo que no coinciden con el slug del emblema: variantes de razón
// social y erratas que el backend ya tiene cargadas.
const BRAND_SLUG_ALIASES = {
  kiamotors: 'kia',
  susuki: 'suzuki', // errata existente en el catálogo
  vw: 'volkswagen',
  skodaauto: 'skoda',
};

// Palabras que no aportan identidad al monograma: "KIA MOTORS" debe leerse KIA,
// no KM, y "ZNEN GROUP" debe leerse ZN.
const MONOGRAM_STOPWORDS = new Set([
  'motor', 'motors', 'moto', 'motorcycles', 'motorcycle', 'group', 'auto', 'autos',
  'automobiles', 'automotive', 'cars', 'car', 'de', 'del', 'la', 'el', 'and', 'the',
  'sa', 'srl', 'ltda',
]);

/** Minúsculas sin acentos ni signos: "Mercedes-Benz" -> "mercedes benz". */
export function normalizeBrandName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Slug del emblema para una marca, o null si hay que usar el monograma. */
export function vehicleBrandLogoSlug(name) {
  const normalized = normalizeBrandName(name);
  if (!normalized) return null;
  const compact = normalized.replace(/ /g, '');
  const alias = BRAND_SLUG_ALIASES[compact];
  if (alias) return alias;
  return VEHICLE_BRAND_LOGO_SLUGS.has(compact) ? compact : null;
}

/** Ruta del emblema servido localmente (sin CDN externo). */
export function vehicleBrandLogoUrl(name) {
  const slug = vehicleBrandLogoSlug(name);
  return slug ? `/brand-logos/${slug}.svg` : null;
}

/**
 * Monograma de respaldo, pensado para que dos marcas distintas no queden iguales
 * en la card: iniciales si el nombre tiene varias palabras y tres letras si es una
 * sola. "GREAT WALL" -> GW, "TOYOTA" -> TOY, "BYD" -> BYD, "MOTOMEL" -> MOT.
 *
 * Con el catálogo actual (266 marcas) esto da 238 monogramas distintos; con dos
 * letras eran 150. Las coincidencias que quedan se despejan con el tooltip, que
 * siempre muestra el nombre completo.
 */
export function vehicleBrandMonogram(name) {
  const normalized = normalizeBrandName(name);
  if (!normalized) return '?';

  const allWords = normalized.split(' ').filter(Boolean);
  const words = allWords.filter((word) => !MONOGRAM_STOPWORDS.has(word));
  const meaningful = words.length ? words : allWords;

  if (meaningful.length > 1) {
    return (meaningful[0][0] + meaningful[1][0]).toUpperCase();
  }
  const word = meaningful[0];
  return (word.length <= 3 ? word : word.slice(0, 3)).toUpperCase();
}
