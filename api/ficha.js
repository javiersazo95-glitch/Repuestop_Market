// Funcion de Vercel para /repuestos/{id-slug} y /tiendas/{id-slug} (16-nov).
//
// Sin esto esas rutas llegaban con app.html: el titulo y la descripcion del inicio, sin
// canonical, y lo propio de cada ficha lo escribia el JavaScript despues de cargar. Google lo
// termina viendo, pero en una segunda pasada mas lenta, y mientras tanto todas las fichas le
// parecian la misma pagina. Aqui se escribe lo mismo que pone `usePageSeo` (pageSeoData.js) en
// el HTML antes de responder.
//
// Regla de oro: si algo falla (backend caido, lento, respuesta rara) se entrega app.html tal
// cual. La SPA sigue funcionando igual que antes; solo se pierde la ventaja para Google.
// Solo un 404 explicito del backend responde 404, para que Google suelte las fichas que ya no
// existen sin arriesgar que un error pasajero las saque del indice.

import { titleWithBrand } from '../src/routes/site.js';
import { productFromDto, productSeo, storeFromDto, storeSeo } from '../src/routes/pageSeoData.js';

const TIEMPO_MAX_MS = 4000;

const TIPOS = {
  repuesto: { endpoint: (id) => `/inventario/productos/${id}`, adaptar: productFromDto, seo: productSeo, titulo: (x) => x.titulo },
  tienda: { endpoint: (id) => `/tiendas/${id}`, adaptar: storeFromDto, seo: storeSeo, titulo: (x) => x.nombre },
};

/** Produccion lee de la API de produccion; dev y las vistas previas de Vercel, de la de dev. */
function apiBase(host) {
  if (process.env.SEO_API_URL) return process.env.SEO_API_URL;
  return /^(www\.)?repuestop\.cl$/i.test(host) ? 'https://api.repuestop.cl/api/v1' : 'https://api-dev.repuestop.cl/api/v1';
}

const escaparAtributo = (texto) => String(texto)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Reemplaza una etiqueta del <head>; si no esta, la agrega antes de </head>. */
function fijar(html, patron, etiqueta) {
  return patron.test(html) ? html.replace(patron, etiqueta) : html.replace('</head>', `    ${etiqueta}\n  </head>`);
}

/** Escribe en app.html el titulo, la descripcion, el canonical, la vista previa y el JSON-LD. */
export function escribirFicha(html, titulo, seo) {
  const url = `https://repuestop.cl${seo.path}`;
  const title = escaparAtributo(titleWithBrand(titulo));
  const description = escaparAtributo(seo.description);
  let salida = html;
  salida = fijar(salida, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  salida = fijar(salida, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`);
  salida = fijar(salida, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`);
  salida = fijar(salida, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`);
  if (seo.image) {
    salida = fijar(salida, /<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${escaparAtributo(seo.image)}" />`);
  }
  // data-ficha: usePageSeo los quita al montar y pone los suyos, que limpia al desmontar.
  // Los nombres los escriben las tiendas: en el JSON-LD se escapa "<" para que nunca cierre el <script>.
  const extra = [
    `<link rel="canonical" href="${escaparAtributo(url)}" data-ficha />`,
    `<meta property="og:url" content="${escaparAtributo(url)}" data-ficha />`,
    `<script type="application/ld+json" data-ficha>${JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c')}</script>`,
  ];
  return salida.replace('</head>', `    ${extra.join('\n    ')}\n  </head>`);
}

async function traer(url) {
  return fetch(url, { headers: { Accept: 'application/json, text/html' }, signal: AbortSignal.timeout(TIEMPO_MAX_MS) });
}

export default async function handler(req, res) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'repuestop.cl');
  const tipo = TIPOS[req.query.tipo];
  const id = String(req.query.ref || '').match(/^(\d+)/)?.[1];

  let html;
  try {
    const app = await traer(`https://${host}/app.html`);
    if (!app.ok) throw new Error(`app.html respondio ${app.status}`);
    html = await app.text();
  } catch (error) {
    console.error('[ficha] no se pudo leer app.html', error);
    res.status(502).send('No se pudo cargar la página. Intenta de nuevo en unos segundos.');
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const responder = (cuerpo, status = 200, cacheSeg = 600) => {
    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${cacheSeg}, stale-while-revalidate=3600`);
    res.status(status).send(cuerpo);
  };

  if (!tipo || !id) {
    responder(html, 200, 60);
    return;
  }

  try {
    const respuesta = await traer(`${apiBase(host)}${tipo.endpoint(id)}`);
    if (respuesta.status === 404) {
      // La SPA muestra su "no encontramos" y marca noindex; el 404 se lo confirma a Google.
      responder(html, 404, 300);
      return;
    }
    if (!respuesta.ok) throw new Error(`backend respondio ${respuesta.status}`);
    const datos = tipo.adaptar(await respuesta.json());
    const seo = datos ? tipo.seo(datos) : null;
    responder(seo ? escribirFicha(html, tipo.titulo(datos), seo) : html);
  } catch (error) {
    console.error(`[ficha] ${req.query.tipo} ${id}: se entrega app.html sin SEO`, error);
    responder(html, 200, 60);
  }
}
