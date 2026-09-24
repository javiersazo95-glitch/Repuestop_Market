/**
 * Codigo de captador que trae el link que comparte un captador (`?ref=CODIGO`).
 *
 * Se guarda en sessionStorage apenas carga la pagina: el comprador puede navegar un rato
 * antes de abrir el registro y el codigo tiene que seguir ahi. Solo es una precarga del
 * campo -- el comprador lo ve y lo puede borrar -- y el backend lo valida igual.
 */
const STORAGE_KEY = 'repuestop.captador-ref';
/** Mismo largo que RT_captador.codigo_referido (VARCHAR(40)). */
export const CAPTADOR_CODE_MAX_LENGTH = 40;

export function normalizeCaptadorCode(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, CAPTADOR_CODE_MAX_LENGTH);
}

export function captureCaptadorReferralFromUrl() {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    const code = normalizeCaptadorCode(ref);
    // Solo codigos con forma de codigo: nada de URLs ni parametros anidados.
    if (code && /^[A-Z0-9_-]+$/.test(code)) {
      window.sessionStorage.setItem(STORAGE_KEY, code);
    }
  } catch {
    // Sin sessionStorage (modo privado estricto) el campo simplemente parte vacio.
  }
}

export function getStoredCaptadorReferral() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function clearStoredCaptadorReferral() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada que limpiar
  }
}
