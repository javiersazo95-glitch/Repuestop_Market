// Constantes del sitio que se usan en el navegador, en vite.config.js y en la funcion de Vercel
// `api/ficha.js` (16-nov). Sin imports a proposito: Node ejecuta este archivo tal cual, sin Vite.

export const SITE_URL = 'https://repuestop.cl';
// 16-nov: con "patente" (ver el comentario del <title> en index.html).
export const BASE_TITLE = 'Marketplace de repuestos por patente en Chile | RepuesTop';

export const titleWithBrand = (title) => (title ? `${title} | RepuesTop` : BASE_TITLE);
