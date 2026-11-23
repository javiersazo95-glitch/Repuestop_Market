// SEO de las fichas de repuesto y de tienda, sin nada del navegador (16-nov). Lo usan
// `pageSeo.js` (en la SPA) y la funcion de Vercel `api/ficha.js`, que escribe lo mismo en el HTML
// antes de responder para que Google no dependa del JavaScript. Node ejecuta este archivo sin
// Vite: los imports llevan extension y apuntan solo a modulos sin dependencias.
import { SITE_URL } from './site.js';
import { productPath, storePath } from './paths.js';
import { compatibilidadLinea } from '../data/compatibilityLine.js';

const SCHEMA_CONDITION = { USADO: 'UsedCondition', REACONDICIONADO: 'RefurbishedCondition' };

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
      // Original o alternativo es el origen de la pieza: ambas son nuevas.
      itemCondition: `https://schema.org/${SCHEMA_CONDITION[String(product.condicion || '').toUpperCase()] || 'NewCondition'}`,
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

const numero = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

/**
 * Respuesta cruda de GET /inventario/productos/{id} -> los campos que usa productSeo. Replica lo
 * justo de adaptProduct (adapters.js); si alla cambia un nombre de campo, hay que cambiarlo aqui.
 */
export function productFromDto(dto) {
  if (!dto) return null;
  let grupos = [];
  try {
    grupos = dto.compatibilityGroupsJson ? JSON.parse(dto.compatibilityGroupsJson) : [];
  } catch {
    grupos = [];
  }
  const compatibilidad = (Array.isArray(grupos) && grupos.length ? grupos : [dto]).map((g) => ({
    marca: g.marca || dto.compatibilidadMarca || '',
    modelo: g.modelo || dto.compatibilidadModelo || '',
    anioInicio: numero(g.anioDesde ?? dto.anioDesde),
    anioFin: numero(g.anioHasta ?? dto.anioHasta),
    version: g.version || '',
    versionLabels: Array.isArray(g.versionLabels) ? g.versionLabels : [],
  })).filter((g) => g.marca || g.modelo);
  const precio = numero(dto.precio) ?? 0;
  return {
    id: dto.id,
    titulo: dto.nombrePublicado || dto.repuestoNombre || '',
    descripcion: dto.descripcion || '',
    marca: dto.marcaRepuesto || dto.marca || '',
    categoriaNombre: dto.categoria || '',
    compatibilidad,
    precio,
    soloCotizacion: dto.pricingMode === 'COTIZACION' || dto.pricingMode === 'QUOTE_ONLY' || precio <= 0,
    stock: numero(dto.stock) ?? 0,
    vendedor: dto.storeName || dto.tiendaNombre || 'Tienda RepuesTop',
    ciudadVendedor: dto.sellerCity || dto.city || '',
    imagenes: Array.isArray(dto.imageUrls) ? dto.imageUrls : [],
    skuProveedor: dto.skuProveedor || '',
    referenciaOem: dto.referenciaOem || '',
    rating: numero(dto.productRating) ?? 0,
    reviewCount: numero(dto.productReviewCount) ?? 0,
  };
}

/** Respuesta cruda de GET /tiendas/{id} -> los campos que usa storeSeo (ver adaptStore). */
export function storeFromDto(dto) {
  if (!dto) return null;
  return {
    id: dto.proveedorId || dto.sellerId || dto.storeId || dto.tiendaId,
    nombre: dto.storeName || dto.nombreTienda || '',
    comuna: dto.comuna || '',
    region: dto.region || '',
    ciudad: [dto.comuna, dto.region].filter(Boolean).join(', '),
    totalPublicaciones: numero(dto.productCount ?? dto.totalPublicaciones ?? dto.totalProductos) ?? 0,
    logoUrl: dto.logoUrl || dto.userProfileUrl || null,
    instagramUrl: dto.instagramUrl || null,
    facebookUrl: dto.facebookUrl || null,
    tiktokUrl: dto.tiktokUrl || null,
    rating: numero(dto.rating) ?? 0,
    reviewCount: numero(dto.reviewCount) ?? 0,
  };
}
