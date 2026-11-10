import { useEffect } from 'react';
import { SITE_URL } from './seoPages';
import { productPath, storePath } from './paths';
import { compatibilidadLinea } from '../services/adapters';

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

const DESCRIPCION_MAX = 155;

const absoluta = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null);

function recortar(texto, max = DESCRIPCION_MAX) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max - 1);
  return `${corte.slice(0, corte.lastIndexOf(' ') > 80 ? corte.lastIndexOf(' ') : corte.length)}…`;
}

const formatoCLP = (valor) => `$${Math.round(Number(valor) || 0).toLocaleString('es-CL')}`;

/** Ficha de repuesto -> descripcion, canonical, imagen y JSON-LD (Product + BreadcrumbList). */
export function productSeo(product) {
  if (!product?.id || !product.titulo) return null;
  const path = productPath(product);
  const url = `${SITE_URL}${path}`;
  const vehiculo = compatibilidadLinea(product.compatibilidad);
  const conPrecio = !product.soloCotizacion && Number(product.precio) > 0;
  const tienda = product.vendedor;
  const ubicacion = product.ciudadVendedor ? `, ${product.ciudadVendedor}` : '';

  const encabezado = [
    product.titulo,
    product.marca ? `marca ${product.marca}` : '',
    vehiculo ? `compatible con ${vehiculo}` : '',
  ].filter(Boolean).join(', ');
  const oferta = conPrecio ? `${formatoCLP(product.precio)} en ${tienda}${ubicacion}` : `Cotiza con ${tienda}${ubicacion}`;
  const description = recortar(`${encabezado}. ${oferta}. Pago seguro en RepuesTop.`.replace(/\.\./g, '.'));

  const imagenes = (product.imagenes || []).map(absoluta).filter(Boolean);
  const productoLd = {
    '@type': 'Product',
    '@id': `${url}#producto`,
    name: product.titulo,
    url,
    description: recortar(product.descripcion || description, 500),
    ...(imagenes.length ? { image: imagenes } : {}),
    ...(product.skuProveedor ? { sku: product.skuProveedor } : {}),
    ...(product.referenciaOem ? { mpn: product.referenciaOem } : {}),
    ...(product.marca ? { brand: { '@type': 'Brand', name: product.marca } } : {}),
    ...(product.categoriaNombre ? { category: product.categoriaNombre } : {}),
  };
  if (conPrecio) {
    productoLd.offers = {
      '@type': 'Offer',
      url,
      priceCurrency: 'CLP',
      price: Math.round(Number(product.precio)),
      availability: Number(product.stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      // Original o alternativo es el origen de la pieza, no su estado: en RepuesTop se vende nuevo.
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: tienda },
    };
  }
  // Solo las opiniones del PRODUCTO: el adaptador cae a la nota de la tienda cuando no hay, y
  // presentarla como nota del repuesto contradice las reglas de Google.
  if (Number(product.reviewCount) > 0 && Number(product.rating) > 0) {
    productoLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.rating),
      reviewCount: Number(product.reviewCount),
    };
  }

  return {
    description,
    path,
    image: imagenes[0] || null,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        productoLd,
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Repuestos', item: `${SITE_URL}/repuestos` },
            { '@type': 'ListItem', position: 3, name: product.titulo },
          ],
        },
      ],
    },
  };
}

/** Ficha de tienda -> descripcion, canonical, logo y JSON-LD (AutoPartsStore + BreadcrumbList). */
export function storeSeo(store) {
  if (!store?.id || !store.nombre) return null;
  const path = storePath(store);
  const url = `${SITE_URL}${path}`;
  const lugar = [store.comuna, store.region].filter(Boolean).join(', ') || store.ciudad || 'Chile';
  const publicaciones = Number(store.totalPublicaciones) > 0
    ? `${store.totalPublicaciones} ${Number(store.totalPublicaciones) === 1 ? 'repuesto publicado' : 'repuestos publicados'}`
    : '';
  const description = recortar([
    `${store.nombre}, casa de repuestos en ${lugar}`,
    publicaciones,
    'Compra con pago seguro en RepuesTop.',
  ].filter(Boolean).join('. '));
  const logo = absoluta(store.logoUrl);
  const redes = [store.instagramUrl, store.facebookUrl, store.tiktokUrl].map(absoluta).filter(Boolean);

  const tiendaLd = {
    '@type': 'AutoPartsStore',
    '@id': `${url}#tienda`,
    name: store.nombre,
    url,
    description,
    ...(logo ? { logo, image: logo } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(store.comuna ? { addressLocality: store.comuna } : {}),
      ...(store.region ? { addressRegion: store.region } : {}),
      addressCountry: 'CL',
    },
    ...(redes.length ? { sameAs: redes } : {}),
  };
  if (Number(store.reviewCount) > 0 && Number(store.rating) > 0) {
    tiendaLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(store.rating),
      reviewCount: Number(store.reviewCount),
    };
  }

  return {
    description,
    path,
    image: logo,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        tiendaLd,
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Casas de repuestos', item: `${SITE_URL}/tiendas` },
            { '@type': 'ListItem', position: 3, name: store.nombre },
          ],
        },
      ],
    },
  };
}

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
