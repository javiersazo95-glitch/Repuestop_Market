// Monedero de Monedas RepuesTop.
//
// NOMBRES: de cara al usuario la moneda se llama "Moneda RepuesTop", pero por dentro sigue siendo
// "ficha" en todas partes -- los endpoints (`/fichas/saldo`, `/fichas/movimientos`,
// `/fichas/compras`), los campos del DTO (`cantidadFichas`), la tabla (`RT_movimiento_ficha`) y la
// llave de localStorage. Renombrarlos NO es cosmetico: rompe el contrato con el backend y le
// borra el saldo cacheado a todo el que ya tenga la llave escrita. El renombre es solo texto.
//
// Hoy las Monedas se gastan en destacar un producto (Top Ventas). Antes tambien pagaban los
// anuncios del Mural, que ya no existen: los movimientos viejos siguen en el historial.
import {
  getFichasBalanceApi, getFichasMovimientosApi, getFichasPacksApi, iniciarRecargaFichasApi,
  getDatosDocumentoRecargaApi,
} from './api';

const TOKENS_BALANCE_KEY = 'repuestop_fichas_balance';

/** Valor nominal validado por el backend para cada Moneda RepuesTop. */
export const TOKEN_VALUE_CLP = 50;

/**
 * El catalogo de packs lo sirve el backend (`GET /fichas/packs`): antes vivia fijo aca y en
 * `mobile/constants/automotive-ads-data.ts`, con el precio escrito en dos archivos que nadie
 * garantizaba sincronizados.
 *
 * Se mapea a la forma que ya usaba la pantalla para no tocar el render.
 */
export async function fetchTokenPacks() {
  const packs = await getFichasPacksApi();
  return (Array.isArray(packs) ? packs : []).map((pack) => ({
    id: pack.id,
    name: pack.nombre,
    tokens: Number(pack.monedas) || 0,
    bonus: Number(pack.bonus) || 0,
    totalTokens: Number(pack.totalMonedas) || 0,
    priceClp: Number(pack.precioClp) || 0,
    priceFormatted: `$${Number(pack.precioClp || 0).toLocaleString('es-CL')} CLP`,
    tag: pack.etiqueta || '',
    highlight: Boolean(pack.destacado),
    description: pack.descripcion || '',
    color: pack.color || '#64748b',
  }));
}


export const TOKENS_UPDATED_EVENT = 'repuestop_tokens_updated';

/** Copia del ultimo saldo confirmado por el backend. Nunca es la fuente de verdad. */
function cacheTokensBalance(balance) {
  try {
    localStorage.setItem(TOKENS_BALANCE_KEY, String(balance));
  } catch {
    // Sin cache igual se puede seguir: la fuente es el backend.
  }
  window.dispatchEvent(new CustomEvent(TOKENS_UPDATED_EVENT, { detail: balance }));
  return balance;
}

/**
 * Ultimo saldo conocido, sincrono, para el primer render.
 *
 * Arranca en 0: no se muestra un saldo inventado mientras responde la red. Lo
 * reemplaza `fetchTokensBalance()` apenas contesta.
 */
export function getCachedTokensBalance() {
  try {
    return Number(localStorage.getItem(TOKENS_BALANCE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Saldo real de la cuenta. Si la red falla devuelve la copia local, que puede
 * estar desactualizada: quien necesite certeza —cobrar— no pregunta aca, deja
 * que el backend rechace la operacion.
 */
export async function fetchTokensBalance({ signal } = {}) {
  try {
    const { saldo } = await getFichasBalanceApi({ signal });
    return cacheTokensBalance(Number(saldo) || 0);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return getCachedTokensBalance();
  }
}

const MOTIVO_LABELS = {
  COMPRA: 'Recarga de Monedas',
  BONO_BIENVENIDA: 'Bono de bienvenida Monedero RepuesTop',
  // Motivos historicos de cuando las Monedas pagaban anuncios.
  PUBLICACION: 'Publicación de anuncio',
  UPGRADE: 'Mejora de plan del anuncio',
  RENOVACION: 'Renovación de vigencia del anuncio'
};

/**
 * Historial de movimientos, del mas nuevo al mas viejo.
 *
 * El DTO trae `tipo` en mayusculas y la cantidad SIEMPRE positiva: el signo lo da
 * el tipo. Se traduce a la forma que ya pintaba la UI (`credit` / `debit`) para
 * no tener que tocar las vistas.
 */
export async function fetchTokenTransactions({ signal } = {}) {
  const { saldo, movimientos } = await getFichasMovimientosApi({ signal });
  cacheTokensBalance(Number(saldo) || 0);
  return (Array.isArray(movimientos) ? movimientos : []).map((item) => ({
    id: String(item.id),
    type: item.tipo === 'CREDITO' ? 'credit' : 'debit',
    amount: Number(item.cantidad) || 0,
    description: item.descripcion || MOTIVO_LABELS[item.motivo] || 'Movimiento de Monedas',
    date: item.fecha,
    purchaseId: item.compraId || null,
    // El documento tributario de la recarga, cuando RepuesTop ya lo emitio. Los movimientos
    // que no son recargas -- y las recargas viejas, sin compra asociada -- no lo traen.
    receipt: item.documentoDisponible
      ? {
          type: item.documentoTipo || null,
          folio: item.documentoFolio || null,
          date: item.documentoFecha || null
        }
      : null
  }));
}

/**
 * Arranca el cobro de una recarga y devuelve la URL de la pasarela.
 *
 * Reemplaza a `rechargeTokensWithPack`, que registraba la compra directamente: el backend le
 * creia al cliente que habia pagado. Ahora esta funcion no acredita nada -- crea la intencion
 * y el usuario se va a Flow; las Monedas entran cuando el webhook confirma.
 */
export async function iniciarRecargaApi(packId, origin = 'INVENTARIO', documento = null) {
  return iniciarRecargaFichasApi({
    packId,
    origen: String(origin || 'INVENTARIO').toUpperCase(),
    // El backend valida el RUT con modulo 11 antes de cobrar y corta si no sirve: una factura
    // que no se puede emitir despues del cobro obliga a devolver la plata.
    ...(documento?.tipo ? { tipoDocumento: documento.tipo } : {}),
    ...(documento?.rut ? { facturaRut: documento.rut } : {}),
    ...(documento?.razonSocial ? { facturaRazonSocial: documento.razonSocial } : {}),
    ...(documento?.giro ? { facturaGiro: documento.giro } : {}),
  });
}

/**
 * Con que datos llega prellenado el paso del documento tributario.
 *
 * Lo arma el backend y no cada cliente: juntar la tienda con el perfil del comprador por
 * separado en la web y en la app es como terminan sugiriendo cosas distintas.
 */
export async function fetchDatosDocumentoRecarga({ signal } = {}) {
  const datos = await getDatosDocumentoRecargaApi({ signal });
  return {
    tipoSugerido: datos?.tipoSugerido === 'FACTURA' ? 'FACTURA' : 'BOLETA',
    rut: datos?.rut || '',
    razonSocial: datos?.razonSocial || '',
    giro: datos?.giro || '',
  };
}


/**
 * Mensaje de error de un fallo del backend.
 *
 * `GlobalExceptionHandler` responde `{ message, errors }`: `errors` trae el detalle campo por
 * campo de las validaciones del DTO, y es lo unico que dice QUE dato quedo mal. El `message`
 * generico ("La solicitud contiene datos invalidos") no le sirve a nadie.
 */
export function apiErrorMessage(error, fallback = 'No se pudo completar la operación.') {
  const detail = error?.data?.errors;
  if (Array.isArray(detail) && detail.length > 0) return detail.join('\n');
  return error?.message || fallback;
}
