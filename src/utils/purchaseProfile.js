/**
 * Guardas del perfil antes de comprar.
 *
 * Contraparte web de `mobile/utils/purchase-profile.ts` (monorepo `fae41ed`).
 *
 * Desde ese commit el backend permite registrarse con Google SIN direccion ni
 * telefono: Google no los entrega y pedirlos en el registro obligaba a llenar un
 * formulario para algo que recien hace falta al comprar. El registro con correo y
 * contrasena los sigue exigiendo igual que antes.
 *
 * Consecuencia para la web: hay cuentas —creadas hoy desde la app, y desde la web
 * en cuanto exista el registro con Google— que llegan al checkout sin esos datos.
 */

/**
 * EL TELEFONO NO SE PUEDE EXIGIR TODAVIA, Y NO ES UN OLVIDO.
 *
 * La app corta al cotizar, agregar al carro y pagar cuando falta el telefono. La
 * web no puede hacer lo mismo porque **no sabe si el usuario tiene uno**:
 * `PerfilUsuarioDTO` no expone `phone` (tiene address, comuna, region y las de
 * entrega, pero no el telefono) y `/auth/login` tampoco lo devuelve. La web lo
 * ESCRIBE en el registro y en la edicion de perfil, y despues nunca lo vuelve a
 * leer: `user.phone` solo queda poblado si la persona edito su perfil en ESTE
 * navegador, por el merge optimista de `updateProfile`.
 *
 * O sea que una guarda por `user.phone` bloquearia el checkout a TODOS —tengan o
 * no telefono registrado—, que es mucho peor que el hueco que cierra. Para
 * cerrarlo de verdad hay que exponer `phone` en `PerfilUsuarioDTO`, y eso es un
 * cambio de backend.
 *
 * Ojo: por la misma razon, la lista de "perfil completo" de `ProfileDashboard`
 * (que mira `user?.phone`) da un falso incompleto a quien no edito su perfil aca.
 *
 * La DIRECCION si esta cubierta sin tocar nada: el paso de entrega del checkout
 * obliga a elegir una de la libreta y no deja avanzar sin ella, asi que una
 * cuenta creada con Google se topa igual con el muro y la agrega ahi mismo.
 */

/**
 * El repuesto lo publica la tienda del propio usuario.
 *
 * SEC-BACKEND-022 rechaza la auto-compra en el checkout (wash trading: inflarse
 * las ventas y la reputacion comprandose a uno mismo), pero recien al pagar: hasta
 * ahi el vendedor puede agregar su propio producto al carro y hasta cotizarse a si
 * mismo, y se entera al final. Se corta antes.
 *
 * A diferencia de "puedo editar este producto", la regla NO depende del modo de la
 * pantalla: un vendedor llega a su propia ficha desde el catalogo como comprador.
 *
 * Es la misma idea que `useAdOwnership` aplica a los anuncios del mural.
 */
export function isOwnStoreProduct(sessionSellerId, productSellerId) {
  if (sessionSellerId == null || productSellerId == null) return false;
  if (String(sessionSellerId) === '' || String(productSellerId) === '') return false;
  return String(sessionSellerId) === String(productSellerId);
}
