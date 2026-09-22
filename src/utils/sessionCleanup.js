/**
 * Borrado de los datos del usuario al cerrar sesión.
 *
 * Antes el logout quitaba tres claves (`repuestop_token`, `repuestop_user`,
 * `repuestop_role`) y dejaba el resto en el navegador: direcciones de calle
 * (`repuestop_user_addresses_{id}`), patentes consultadas (`repuestop_recent_plates`),
 * el carrito, el vehículo activo, el saldo de Fichas y el último pedido con su dirección
 * de entrega. En un equipo compartido, la persona siguiente veía todo eso.
 *
 * El barrido va por PREFIJO y no por una lista de nombres porque varias claves llevan el
 * id del usuario pegado al final (`repuestop_user_addresses_6`): una lista fija se queda
 * corta en cuanto aparece un usuario nuevo, y además obliga a acordarse de actualizarla
 * cada vez que alguien inventa una clave. Con el prefijo, una clave nueva queda cubierta
 * sola; lo que hay que declarar a mano es la excepción, que es lo raro.
 */

/**
 * Claves que SOBREVIVEN al cierre de sesión porque son del navegador, no de la cuenta.
 *
 * - `repuestop_cookie_consent_v1`: el consentimiento lo da la persona en este dispositivo.
 *   Borrarlo volvería a mostrar el banner en cada logout y perdería una decisión que la
 *   ley pide conservar.
 * - `repuestop_deploy_reload`: marca anti-bucle de `staleDeploy`. Si se borra, una pestaña
 *   vieja podría recargarse de más.
 * - `repuestop_founder_about_seen`: un "no volver a mostrar" de una pantalla informativa.
 *   No es dato personal y borrarlo solo molesta.
 */
const CLAVES_QUE_SOBREVIVEN = new Set([
  'repuestop_cookie_consent_v1',
  'repuestop_deploy_reload',
  'repuestop_founder_about_seen',
]);

const PREFIJO = 'repuestop_';

/** Borra de un almacén las claves del prefijo que no estén exceptuadas. */
function limpiarAlmacen(almacen) {
  if (!almacen) return [];
  const claves = [];
  try {
    // Se recorre con `length` + `key(i)`, que es la API propia de Storage. `Object.keys`
    // también funciona sobre el localStorage real, pero depende de la enumeración de
    // propiedades con nombre, que no es lo que Storage promete.
    //
    // Y se listan TODAS antes de borrar ninguna: quitar mientras se recorre por índice
    // salta elementos, porque el índice de los siguientes se corre.
    for (let i = 0; i < almacen.length; i += 1) {
      const clave = almacen.key(i);
      if (clave) claves.push(clave);
    }
  } catch {
    // Modo privado o cookies bloqueadas: el almacén puede lanzar al tocarlo.
    return [];
  }

  const borradas = [];
  claves.forEach((clave) => {
    if (!clave.startsWith(PREFIJO) || CLAVES_QUE_SOBREVIVEN.has(clave)) return;
    try {
      almacen.removeItem(clave);
      borradas.push(clave);
    } catch {
      // Una clave que no se pueda borrar no debe impedir borrar las demás.
    }
  });
  return borradas;
}

/**
 * Limpia `localStorage` y `sessionStorage` al cerrar sesión.
 * Devuelve las claves borradas, que es lo que permite comprobarlo en una prueba.
 */
export function clearSessionData() {
  const borradas = [];
  if (typeof window === 'undefined') return borradas;
  borradas.push(...limpiarAlmacen(window.localStorage));
  borradas.push(...limpiarAlmacen(window.sessionStorage));
  return borradas;
}

export const SESSION_CLEANUP_KEEP = CLAVES_QUE_SOBREVIVEN;
