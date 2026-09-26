/**
 * Compartir un enlace de la plataforma (repuesto, tienda, anuncio).
 *
 * En el celular usa la hoja nativa de compartir (`navigator.share`: WhatsApp, Instagram,
 * correo, lo que tenga instalado la persona). Donde no existe -escritorio, navegadores
 * embebidos- copia el enlace al portapapeles, con el respaldo de `execCommand` para los
 * webviews que todavia no exponen `navigator.clipboard`.
 *
 * Devuelve que paso, para que el boton pueda avisar: 'shared' | 'copied' | 'cancelled' | 'failed'.
 */

/** `/repuestos/12-bujia` -> `https://repuestop.cl/repuestos/12-bujia`. Un URL absoluto se respeta. */
export function absoluteUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

function legacyCopy(value) {
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export async function shareLink({ url, title, text } = {}) {
  const href = absoluteUrl(url);
  if (!href) return 'failed';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: title || 'RepuesTop', text: text || undefined, url: href });
      return 'shared';
    } catch (error) {
      // La persona cerro la hoja: no es un error ni hay que copiar nada.
      if (error?.name === 'AbortError') return 'cancelled';
      // Otro fallo (permiso, origen no seguro): se cae a copiar el enlace.
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(href);
      return 'copied';
    }
  } catch {
    /* sigue al respaldo */
  }
  return legacyCopy(href) ? 'copied' : 'failed';
}
