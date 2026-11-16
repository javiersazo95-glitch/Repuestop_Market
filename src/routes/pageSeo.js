import { useEffect } from 'react';
import { SITE_URL } from './seoPages';

// productSeo y storeSeo viven en pageSeoData.js (16-nov): tambien los usa la funcion de Vercel
// api/ficha.js para escribirlos en el HTML antes de que cargue el JavaScript.
export { productSeo, storeSeo } from './pageSeoData.js';

/**
 * SEO de las paginas dinamicas (ficha de repuesto y de tienda), 10-nov.
 *
 * Estas rutas llegan con app.html, que no trae canonical ni descripcion propios (ver el plugin
 * `paginasIndexables` de vite.config.js). Google ejecuta el JavaScript, asi que lo que se
 * escribe aqui en el <head> es lo que indexa: descripcion, canonical, vista previa y los datos
 * estructurados (schema.org) que le permiten mostrar precio y stock en los resultados.
 *
 * Al desmontar se deja el <head> como estaba, para que la siguiente pagina de la SPA no herede
 * el canonical de un repuesto.
 */

/** Fija (o crea) un elemento del <head> y devuelve como dejarlo como estaba. */
function fijarEnHead(selector, crear, atributo, valor) {
  let elemento = document.head.querySelector(selector);
  if (elemento) {
    const anterior = elemento.getAttribute(atributo);
    elemento.setAttribute(atributo, valor);
    return () => { elemento.setAttribute(atributo, anterior); };
  }
  elemento = crear();
  elemento.setAttribute(atributo, valor);
  document.head.appendChild(elemento);
  return () => { elemento.remove(); };
}

const meta = (clave, valor) => () => {
  const el = document.createElement('meta');
  el.setAttribute(clave, valor);
  return el;
};

/**
 * Aplica el SEO de una pagina dinamica mientras esta montada. `seo` es lo que devuelven
 * productSeo/storeSeo; con null no toca nada (p. ej., mientras carga).
 */
export function usePageSeo(seo) {
  const clave = seo ? JSON.stringify(seo) : '';
  useEffect(() => {
    if (!clave) return undefined;
    // Lo que escribio la funcion de Vercel (api/ficha.js) se reemplaza por lo de aqui, que se
    // limpia al desmontar: si no, el canonical del repuesto seguiria en las paginas siguientes.
    document.head.querySelectorAll('[data-ficha]').forEach((el) => el.remove());
    const { description, path, image, jsonLd } = JSON.parse(clave);
    const url = `${SITE_URL}${path}`;
    const deshacer = [
      fijarEnHead('meta[name="description"]', meta('name', 'description'), 'content', description),
      fijarEnHead('link[rel="canonical"]', () => {
        const el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        return el;
      }, 'href', url),
      fijarEnHead('meta[property="og:url"]', meta('property', 'og:url'), 'content', url),
      fijarEnHead('meta[property="og:title"]', meta('property', 'og:title'), 'content', document.title),
      fijarEnHead('meta[property="og:description"]', meta('property', 'og:description'), 'content', description),
    ];
    if (image) {
      deshacer.push(fijarEnHead('meta[property="og:image"]', meta('property', 'og:image'), 'content', image));
    }
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.seo = 'pagina';
    // Los nombres los escriben las tiendas: se escapa "<" para que nunca cierre el <script>.
    script.textContent = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    document.head.appendChild(script);
    deshacer.push(() => script.remove());
    return () => { deshacer.reverse().forEach((fn) => fn()); };
  }, [clave]);
}
