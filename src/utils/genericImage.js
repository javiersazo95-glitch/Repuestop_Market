// Sin dependencias a proposito: lo usan la SPA (adapters.js) y el SEO que tambien corre en Node
// (routes/pageSeoData.js, desde la funcion de Vercel api/ficha.js).
const GENERIC_IMAGE_FILE = 'imagen-generica';

/** La lamina "SIN FOTO" del backend. Se compara por nombre de archivo: el bucket cambia por ambiente. */
export function isGenericProductImage(url) {
  return typeof url === 'string' && url.toLowerCase().includes(GENERIC_IMAGE_FILE);
}
