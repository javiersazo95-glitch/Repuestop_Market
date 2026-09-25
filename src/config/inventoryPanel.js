/**
 * URL del panel de vendedores según el deploy: `main` usa el panel de producción y
 * cualquier otra rama el de dev. `__DEPLOY_BRANCH__` lo inyecta vite.config.js.
 *
 * F2-14 (pruebas de lanzamiento, 2026-09-25): el registro de tienda fundadora tenía fija
 * la URL de producción, así que "Ir al panel de vendedores" desde el Market de dev
 * llevaba al panel de prod.
 */
export const INVENTORY_PANEL_URL = __DEPLOY_BRANCH__ === 'main'
  ? 'https://inventario.repuestop.cl'
  : 'https://dev-inventario.repuestop.cl';
