/**
 * Enlace al seguimiento oficial del courier.
 *
 * El comprador ya tenia el numero de seguimiento en pantalla, pero para usarlo tenia que
 * copiarlo a mano, adivinar el sitio del courier y pegarlo ahi. Es el dato que mas se mira
 * de un pedido despachado y era el mas incomodo de usar.
 *
 * **El nombre del courier es TEXTO LIBRE**: lo escribe el vendedor al registrar el despacho
 * (`PedidoEnvioSupport.registrarEnvio` lo guarda tal cual, sin catalogo ni enum). Por eso el
 * match es por subcadena en minusculas y no por igualdad: llegan "Starken", "STARKEN Ya",
 * "chilexpress" y "Blue Express" indistintamente. Y por eso esta funcion devuelve `null` con
 * frecuencia -- un courier que nadie reconoce, o un despacho propio del vendedor --, asi que
 * la UI SIEMPRE tiene que seguir mostrando el numero aunque no haya enlace.
 *
 * Las URLs son de los portales publicos de cada courier y pueden cambiar sin aviso: viven
 * juntas aca para que actualizarlas sea editar un archivo y no cazarlas por los componentes.
 * Es el equivalente web de `mobile/utils/carrier-tracking.ts`.
 */

const CARRIERS = [
  { match: ['starken'], name: 'Starken', url: (t) => `https://www.starken.cl/seguimiento?codigo=${t}` },
  { match: ['chilexpress', 'chile express'], name: 'Chilexpress', url: (t) => `https://www.chilexpress.cl/Views/ChilexpressCL/Resultado-busqueda.aspx?DATA=${t}` },
  { match: ['bluexpress', 'blue express', 'bluex', 'blue'], name: 'Blue Express', url: (t) => `https://www.bluex.cl/seguimiento/?n_seguimiento=${t}` },
  { match: ['correos'], name: 'CorreosChile', url: (t) => `https://www.correos.cl/web/guest/seguimiento-en-linea?envio=${t}` },
];

/**
 * `{ name, url }` del courier reconocido, o `null`.
 *
 * Devuelve el nombre canonico ademas de la URL para que el boton diga "Ver en Starken" y no
 * repita lo que el vendedor haya tecleado ("STARKEN ya", "starken.cl").
 */
export function carrierTracking(courier, trackingNumber) {
  const code = String(trackingNumber ?? '').trim();
  if (!code) return null;

  const raw = String(courier ?? '').trim().toLowerCase();
  if (!raw) return null;

  const carrier = CARRIERS.find((c) => c.match.some((needle) => raw.includes(needle)));
  if (!carrier) return null;

  return { name: carrier.name, url: carrier.url(encodeURIComponent(code)) };
}
