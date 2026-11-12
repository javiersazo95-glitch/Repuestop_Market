/**
 * Repuestín entiende lo que escribe la persona como si le hablara a un vendedor por mensaje: «ando buscando un
 * filtro de aire», «me pidieron pastillas de freno pa la hilux porfa», «hola, tienen amortiguadores?». Separa el
 * relleno (saludos, «necesito», «me pidieron», «por favor»...) del repuesto, lo cruza con las subcategorías del
 * catálogo y reconoce la charla que no es un repuesto (un saludo, un «gracias», un «no sé cómo se llama»).
 * Sin red ni vistas: todo se decide con el texto y la lista de subcategorías.
 */
import { normalizeText } from './partAssistant';

// ─────────────────────────────────────────────────────────────── Relleno

const GREETING = /^(hola+|holi+s?|ola|wena+s?|weena+s?|buena+s?( tardes| noches| d[ií]as)?|buen d[ií]a|qu[eé] tal|al[oó]|hey|saludos|estimad[oa]s?|amig[oa]|compadre|jefe|vecin[oa])\b[\s,!.¡¿]*/;

/** Lo que se dice antes del repuesto cuando se le escribe a un vendedor. Se quita en bucle, desde el inicio. */
const LEADING = [
  /^(yo\s+)?(ando|andaba|estoy|estaba|estamos|andamos)\s+(buscando|necesitando|viendo|cotizando|averiguando)\b/,
  /^(busco|buscaba|buscamos|necesito|necesitaba|necesitar[ií]a|necesitamos|quiero|quisiera|quer[ií]a|queremos|requiero|preciso|ocupo)\b/,
  /^me\s+(pidieron|piden|encargaron|encargan|recomendaron|dijeron que (cambie|compre)|falta|faltan|hace falta|hacen falta|urge|sirve)\b/,
  /^(me\s+)?gustar[ií]a\b/,
  /^(tienen|tendr[aá]n|tienes|tendr[aá]s|tiene|hay|habr[aá]|venden|vendes|manejan|trabajan)\b/,
  /^(d[oó]nde|donde)\s+(consigo|encuentro|compro|venden|hay|puedo (conseguir|comprar|encontrar))\b/,
  /^(c[oó]mo|como)\s+(consigo|encuentro|compro)\b/,
  /^(cu[aá]nto|cuanto)\s+(cuesta|vale|sale|est[aá])\b/,
  /^(el\s+)?(precio|valor)\s+(de|del)\b/,
  /^(comprar|cotizar|conseguir|encontrar|cambiar|reemplazar)\b/,
  /^(urgente|ayuda|consulta|una consulta|pregunta|una pregunta)\b[\s,:!]*/,
  /^(por favor|porfa|porfis)\b/,
  /^(que|q)\b/,
  /^(un par de|par de|un juego de|juego de|el|la|los|las|un|una|unos|unas|uno|algun|alg[uú]n|alguna|algunos|algunas|de|del)\b/,
];

/** Lo que se dice después del repuesto. Se quita en bucle, desde el final. */
const TRAILING = [
  /[\s,]*(por favor|porfa|porfis|plis|pls|please|gracias|muchas gracias|urgente|de urgencia|lo antes posible|ojal[aá])[\s!.?]*$/,
  /[\s,]*(para|pa|pal|pa'l)\s+(mi|el|la|un|una|nuestro|nuestra)?\s*(auto|autito|carro|coche|camioneta|camionetita|veh[ií]culo|moto|cami[oó]n|furg[oó]n|jeep|van|nave|m[aá]quina)\b.*$/,
  /[\s,]*(de|del)\s+(mi|el)\s+(auto|carro|coche|camioneta|veh[ií]culo|moto|cami[oó]n|furg[oó]n)\b.*$/,
  /[\s,]*(que|q)\s+(tengan|tengas|tenga|vendan|haya)\b.*$/,
  /[\s,]*(si|cuando)\s+(tienen|tienes|hay|pueden)\b.*$/,
  /[\s,]*(en stock|disponible|disponibles|nuevo|nuevos|nueva|nuevas|original|originales)[\s!.?]*$/,
  /[\s!.?¿¡,;:]+$/,
];

const SPACES = /\s+/g;

function stripLoop(text, patterns) {
  let out = text;
  for (let round = 0; round < 8; round += 1) {
    const before = out;
    for (const pattern of patterns) out = out.replace(pattern, '').trim();
    out = out.replace(/^[\s,;:¿¡!.-]+/, '').trim();
    if (out === before) break;
  }
  return out;
}

/** «Ando buscando un filtro de aire porfa» → «filtro de aire». Respeta tildes y eñes del texto original. */
export function stripFiller(raw) {
  let text = String(raw || '').toLowerCase().replace(SPACES, ' ').trim();
  text = text.replace(GREETING, '').trim();
  text = stripLoop(text, LEADING);
  text = stripLoop(text, TRAILING);
  // Un segundo saludo o relleno que quedó al medio («hola buenas, necesito…»).
  text = text.replace(GREETING, '').trim();
  text = stripLoop(text, LEADING);
  return text;
}

export function capitalize(text) {
  const clean = String(text || '').trim();
  return clean ? clean[0].toUpperCase() + clean.slice(1) : '';
}

// ─────────────────────────────────────────────────────────────── Charla

const THANKS = /^(gracias|muchas gracias|mil gracias|gracias+|grax|ok+|oka|okey|vale|dale|listo|perfecto|bac[aá]n|genial|buen[ií]simo|de nada|👍)[\s!.]*$/;
const UNKNOWN_NAME = /\b(no s[eé]|nose|ni idea|no recuerdo|no me acuerdo|no conozco)\b.*\b(nombre|llama|dice)\b|^(no s[eé]|nose|ni idea)[\s!.?]*$/;
const HUMAN = /\b(hablar|conversar|chatear)\s+con\s+(una\s+)?(persona|humano|alguien|vendedor|ejecutivo|tienda)\b|\b(eres|es)\s+(un\s+)?(bot|robot|humano|persona)\b/;
const NO_PART = /^(nada|ninguno|ninguna|no|no gracias|ya no|ya lo encontr[eé]|ya lo tengo)[\s!.]*$/;

/**
 * ¿Es charla en vez de un repuesto? Devuelve el tipo para que Repuestín responda como una persona:
 * 'greeting' | 'thanks' | 'unknownName' | 'human' | 'nothing' | null.
 */
export function smallTalkKind(raw) {
  const text = normalizeText(raw);
  if (!text) return null;
  if (UNKNOWN_NAME.test(text)) return 'unknownName';
  if (HUMAN.test(text)) return 'human';
  if (THANKS.test(text)) return 'thanks';
  if (NO_PART.test(text)) return 'nothing';
  if (!stripFiller(raw)) return 'greeting';
  return null;
}

// ─────────────────────────────────────────────────────────────── Cruce con el catálogo

const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'para', 'con', 'en', 'a', 'al', 'mi', 'por', 'sin']);

/** Cómo le dicen en la calle → cómo se llama en el catálogo. */
const SYNONYMS = [
  [/\bbalatas?\b/, 'pastillas de freno'],
  [/\bpastillas?\b(?! de freno)/, 'pastillas de freno'],
  [/\bruleman(es)?\b/, 'rodamiento'],
  [/\bmata ?burros?\b/, 'parachoques'],
  [/\bparachoque\b/, 'parachoques'],
  [/\bchicotes?\b/, 'piola'],
  [/\b(plumillas?|escobillas?|limpiaparabrisas)\b/, 'limpia parabrisas'],
  [/\bclutch\b/, 'kit de embragues'],
  [/\bkit de embrague\b/, 'kit de embragues'],
  [/\bfiltro de (cabina|habitaculo|aire acondicionado)\b/, 'filtro de polen'],
  [/\bfiltro de (petroleo|bencina|diesel|gasolina)\b/, 'filtro de combustible'],
  [/\bfaros?\b/, 'focos'],
  [/\bbateria\b/, 'baterias'],
];

function applySynonyms(normalized) {
  let out = normalized;
  for (const [pattern, replacement] of SYNONYMS) {
    if (pattern.test(out)) out = out.replace(pattern, replacement);
  }
  return out;
}

function tokens(normalized) {
  return normalized.split(/[^a-z0-9ñ]+/).filter((word) => word && !STOP_WORDS.has(word));
}

/** Mismas palabras salvo plural y abreviaturas («amortiguadores» ↔ «amortiguador», «distri» ↔ «distribución»). */
function sameWord(a, b) {
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  return short.length >= 4 && long.startsWith(short);
}

/** Lado o posición de la pieza: no cambian qué repuesto es («disco de freno delantero» sigue siendo «Discos»). */
const QUALIFIERS = /^(delanter[oa]s?|traser[oa]s?|izquierd[oa]s?|derech[oa]s?|piloto|copiloto|superior(es)?|inferior(es)?|original(es)?|alternativ[oa]s?|generic[oa]s?|nuev[oa]s?|usad[oa]s?|lado|chofer|conductor|acompanante)$/;

function scoreOption(queryTokens, option) {
  const nameTokens = tokens(normalizeText(option.nombre));
  if (nameTokens.length === 0 || queryTokens.length === 0) return null;
  const inName = (query) => nameTokens.some((word) => sameWord(query, word));
  const hitsInName = nameTokens.filter((word) => queryTokens.some((query) => sameWord(query, word))).length;
  const hitsInQuery = queryTokens.filter(inName).length;
  // Los calificativos que el nombre no trae no cuentan en contra: son detalle, no otro repuesto.
  const relevant = queryTokens.filter((query) => inName(query) || !QUALIFIERS.test(query)).length || 1;
  const categoryTokens = tokens(normalizeText(option.categoriaNombre));
  const categoryHits = queryTokens.filter((query) => categoryTokens.some((word) => sameWord(query, word))).length;
  return {
    option,
    nameCoverage: hitsInName / nameTokens.length,
    queryCoverage: hitsInQuery / relevant,
    hits: hitsInQuery,
    categoryHits,
  };
}

/**
 * Cruza lo que se busca con las subcategorías. `match`: la subcategoría que es (todas sus palabras están en lo
 * escrito y lo escrito es casi solo eso). `similar`: las más parecidas (comparten alguna palabra o la categoría),
 * para sugerir casas de repuestos que trabajan cosas parecidas cuando el repuesto no existe en el catálogo.
 */
export function matchSubcategory(options, query) {
  const normalized = applySynonyms(normalizeText(query));
  const queryTokens = tokens(normalized);
  if (queryTokens.length === 0 || !Array.isArray(options) || options.length === 0) return { match: null, similar: [] };
  const exact = options.find((option) => normalizeText(option.nombre) === normalized);
  if (exact) return { match: exact, similar: [] };
  const scored = options.map((option) => scoreOption(queryTokens, option)).filter(Boolean);
  const strong = scored
    .filter((entry) => entry.nameCoverage === 1 && entry.queryCoverage >= 0.5)
    .sort((a, b) => b.queryCoverage - a.queryCoverage || a.option.nombre.length - b.option.nombre.length);
  if (strong.length > 0) return { match: strong[0].option, similar: [] };
  const similar = scored
    .filter((entry) => entry.hits > 0 || entry.categoryHits > 0)
    .sort((a, b) => (b.hits * 2 + b.nameCoverage + b.categoryHits) - (a.hits * 2 + a.nameCoverage + a.categoryHits))
    .slice(0, 3)
    .map((entry) => entry.option);
  return { match: null, similar };
}

/**
 * Todo junto: qué repuesto pidió la persona. `part` es el texto limpio para mostrar («Filtro de aire»), `match` la
 * subcategoría si existe, `similar` las parecidas si no, `vehicleHint` lo que dijo del vehículo («toyota yaris 2015»)
 * cuando lo escribió en la misma frase, y `smallTalk` si en realidad no pidió un repuesto.
 */
/** Calificativos escritos que el nombre de la subcategoría no trae («delantero», «izquierdo»): viajan como detalle. */
function leftoverDetail(text, option) {
  const nameTokens = tokens(normalizeText(option.nombre));
  const words = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
  return words
    .filter((word) => QUALIFIERS.test(normalizeText(word)) && !nameTokens.some((name) => sameWord(normalizeText(word), name)))
    .join(' ');
}

const found = (option, text, vehicleHint = '') => ({
  smallTalk: null, part: option.nombre, match: option, similar: [], vehicleHint, detail: leftoverDetail(text, option),
});

export function understandPart(raw, options) {
  const smallTalk = smallTalkKind(raw);
  if (smallTalk) return { smallTalk, part: '', match: null, similar: [], vehicleHint: '', detail: '' };
  const cleaned = stripFiller(raw);
  // «filtro de aire para toyota yaris 2015», «balatas pa la hilux»: si lo de antes del «para» ya es un repuesto,
  // lo de después es el vehículo (no se pierde: Repuestín lo comenta al preguntar el vehículo).
  const split = cleaned.match(/^(.+?)\s+(?:para|pa|pal|de un|de una)\s+(?:el|la|los|las|un|una|mi)?\s*(.+)$/);
  if (split) {
    const head = matchSubcategory(options, split[1]);
    const whole = matchSubcategory(options, cleaned);
    if (head.match && (!whole.match || whole.match.id === head.match.id)) return found(head.match, split[1], split[2].trim());
  }
  const whole = matchSubcategory(options, cleaned);
  if (whole.match) return found(whole.match, cleaned);
  return { smallTalk: null, part: capitalize(cleaned || String(raw || '').trim()), match: null, similar: whole.similar, vehicleHint: '', detail: '' };
}

/** Texto para sugerir mientras escribe: sin el relleno, así «ando buscando filtro» ya sugiere filtros. */
export function suggestionQuery(raw) {
  const cleaned = stripFiller(raw);
  return cleaned || String(raw || '');
}

// ─────────────────────────────────────────────────────────────── Personalidad

/** Una de varias formas de decir lo mismo: Repuestín no repite siempre la misma frase. */
export function pick(options, seed) {
  const list = options.filter(Boolean);
  if (list.length === 0) return '';
  const index = seed == null ? Math.floor(Math.random() * list.length) : Math.abs(seed) % list.length;
  return list[index];
}
