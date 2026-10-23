import { HELP_ROLES, getCategoriesForRole } from '../data/helpContent.js';

// Paginas que Google puede indexar mientras dure la apertura parcial del robots.txt
// (20-oct). El sitio es una SPA: sin esto todas las rutas entregaban el mismo
// index.html con canonical al inicio, y Google trataba /vender, /nosotros, /ayuda y
// los legales como copias de la portada. El plugin `paginasIndexables` de
// vite.config.js genera con esta lista un HTML por ruta con su titulo, descripcion,
// canonical y vista previa propios, y el sitemap.xml. vercel.json las enruta y
// robots.txt las abre: al agregar una ruta aqui, sumarla en esos dos archivos.
// Archivo sin JSX ni alias: lo importa Node al compilar.

export const SITE_URL = 'https://repuestop.cl';
export const BASE_TITLE = 'RepuesTop | Marketplace de repuestos automotrices de Chile';

export const titleWithBrand = (title) => (title ? `${title} | RepuesTop` : BASE_TITLE);

const HELP_FIXED = [
  {
    path: '/ayuda',
    title: 'Centro de ayuda',
    description: 'Centro de ayuda de RepuesTop: respuestas sobre pedidos, envíos, pagos, cotizaciones, tu cuenta y tu tienda, y cómo contactar a soporte.',
  },
  {
    path: '/ayuda/preguntas-frecuentes',
    title: 'Preguntas frecuentes',
    description: 'Preguntas frecuentes de RepuesTop sobre compras, pagos, envíos, cotizaciones y venta de repuestos en el marketplace.',
  },
  {
    path: '/ayuda/contacto',
    title: 'Contacto',
    description: 'Contacta al equipo de soporte de RepuesTop por consultas sobre pedidos, pagos, tu cuenta o tu tienda.',
  },
];

// Solo las categorias con preguntas para visitantes: Google entra sin sesion y las
// demas (pedidos, tienda) lo redirigen a /ayuda.
const HELP_CATEGORY_PAGES = getCategoriesForRole(HELP_ROLES.GUEST).map((category) => ({
  path: `/ayuda/${category.slug}`,
  title: `${category.titulo} · Centro de ayuda`,
  description: `${category.titulo} en RepuesTop: ${category.descripcion.charAt(0).toLowerCase()}${category.descripcion.slice(1)} Respuestas del centro de ayuda.`,
}));

export const SEO_PAGES = [
  {
    path: '/',
    title: null,
    description: 'Busca repuestos para tu auto por patente o por marca, modelo y año, y compara precios de tiendas de todo Chile. Pago seguro con Flow. ¿Tienes una casa de repuestos? Vende en RepuesTop.',
  },
  {
    path: '/vender',
    title: 'Vende tus repuestos',
    description: 'Vende los repuestos de tu tienda en RepuesTop, el marketplace automotriz de Chile. Regístrate como tienda verificada y recibe pedidos y cotizaciones de compradores de todo el país.',
  },
  {
    path: '/nosotros',
    title: 'Sobre RepuesTop',
    description: 'Conoce RepuesTop: el marketplace chileno que conecta a conductores con casas de repuestos verificadas de todo el país, con pago seguro y compra protegida.',
  },
  ...HELP_FIXED,
  ...HELP_CATEGORY_PAGES,
  {
    path: '/terminos',
    title: 'Términos y condiciones',
    description: 'Términos y condiciones de uso de RepuesTop para compradores y tiendas.',
  },
  {
    path: '/privacidad',
    title: 'Política de privacidad',
    description: 'Política de privacidad de RepuesTop: qué datos personales recopilamos, para qué los usamos y cómo ejercer tus derechos.',
  },
];

/** Titulo de pestaña para una ruta de la lista (null si no esta). */
export function seoTitleFor(pathname) {
  const page = SEO_PAGES.find((candidate) => candidate.path === pathname);
  return page ? page.title : null;
}
