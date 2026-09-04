// Mural de Anuncios y monedero de Monedas RepuesTop.
//
// Todo el ciclo de vida del anuncio pasa por el backend, igual que en el movil
// (`mobile/services/ads-storage.ts`): el mural publico por `GET /anuncios` y la
// gestion propia por `GET /anuncios/mios` + POST / PUT / DELETE.
//
// NOMBRES: de cara al usuario la moneda se llama "Moneda RepuesTop" desde el
// commit `fae41ed` del monorepo, pero por dentro sigue siendo "ficha" en todas
// partes — los endpoints (`/fichas/saldo`, `/fichas/movimientos`,
// `/fichas/compras`), los campos del DTO (`cantidadFichas`), la tabla
// (`RT_movimiento_ficha`) y la llave de localStorage. Renombrarlos NO es
// cosmetico: rompe el contrato con el backend y le borra el saldo cacheado a
// todo el que ya tenga la llave escrita. El renombre es solo texto visible.
//
// localStorage guarda solo dos cosas: la ultima copia del mural, para que la
// grilla no aparezca vacia mientras responde la red, y una copia de solo lectura
// del ultimo saldo confirmado por el servidor, para el primer render. La llave
// `repuestop_classified_ads` de la fase A quedo sin uso: esos anuncios nunca
// existieron fuera del navegador.
import {
  getPublicAdsApi, getPublicAdApi, getMyAdsApi,
  createAdApi, updateAdApi, updateAdAgendaApi, deleteAdApi, uploadAdImagesApi, resolveMediaUrl,
  getFichasBalanceApi, getFichasMovimientosApi, registrarCompraFichasApi,
  getAdAppointmentsApi, getMyAppointmentsApi, createAdAppointmentApi,
  updateAdAppointmentStatusApi, sendAppointmentSummaryEmailsApi,
  createUserNotificationApi, createProviderNotificationApi
} from './api';
import {
  adaptAd, adaptAds, toAdRequestPayload,
  adaptAppointment, adaptAppointments, toAppointmentRequestPayload
} from './adapters';
import { isAdVisibleOnWall } from '../data/automotiveAdsData';
import { toAgendaConfigPayload, getAgendaSummaryText } from '../data/agendaConfig';

const ADS_WALL_CACHE_KEY = 'repuestop_ads_wall_cache';
const TOKENS_BALANCE_KEY = 'repuestop_fichas_balance';
// La llave del historial local se retiro: el historial lo sirve el backend
// (`GET /fichas/movimientos`). Los navegadores que la tengan escrita se la quedan
// sin que nadie la lea; son datos del usuario.

// Anuncios de demostracion que este proyecto tuvo sembrados antes de retirarlos.
// Los navegadores que ya habian abierto el mural los tienen persistidos desde
// antes, asi que vaciar INITIAL_CLASSIFIED_ADS no los borra por si solo: se
// filtran aqui la primera vez que se lee el storage. Mismo patron que el movil.
const SEED_AD_ID_PATTERN = /^ad-(emp|prem|dest|bas)-\d+$/;

const dropSeedAds = (ads) => (Array.isArray(ads) ? ads : []).filter(
  (ad) => ad && typeof ad.id === 'string' && !SEED_AD_ID_PATTERN.test(ad.id)
);

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return dropSeedAds(parsed);
  } catch {
    return [];
  }
}

/** Valor nominal validado por el backend para cada Moneda RepuesTop. */
export const TOKEN_VALUE_CLP = 50;

/** Precios comerciales de los planes por cada período de 30 días. */
export const AD_TIER_PRICES_CLP = {
  basica: 4990,
  destacada: 9990,
  premium: 19990,
  empresarial: 39990
};

export function tokensForClp(priceClp) {
  return Math.ceil(priceClp / TOKEN_VALUE_CLP);
}

// Packs oficiales: el backend exige montoPagado === cantidadFichas * $50 CLP.
export const TOKEN_PACKS = [
  {
    id: 'pack-basico',
    name: 'Pack Básico',
    tokens: 100,
    bonus: 0,
    totalTokens: 100,
    priceClp: 5000,
    priceFormatted: '$5.000 CLP',
    tag: 'Inicial',
    highlight: false,
    description: '100 monedas a $50 CLP cada una.',
    color: '#64748b'
  },
  {
    id: 'pack-medio',
    name: 'Pack Medio',
    tokens: 200,
    bonus: 0,
    totalTokens: 200,
    priceClp: 10000,
    priceFormatted: '$10.000 CLP',
    tag: 'Destacado',
    highlight: true,
    description: 'Cubre un anuncio Destacado por 30 días.',
    color: '#7c3aed'
  },
  {
    id: 'pack-avanzado',
    name: 'Pack Avanzado',
    tokens: 400,
    bonus: 0,
    totalTokens: 400,
    priceClp: 20000,
    priceFormatted: '$20.000 CLP',
    tag: 'Premium',
    highlight: false,
    description: 'Cubre un anuncio Premium por 30 días.',
    color: '#059669'
  },
  {
    id: 'pack-extra',
    name: 'Pack Extra Pro',
    tokens: 800,
    bonus: 0,
    totalTokens: 800,
    priceClp: 40000,
    priceFormatted: '$40.000 CLP',
    tag: 'Empresarial',
    highlight: false,
    description: 'Cubre un anuncio Empresarial por 30 días.',
    color: '#d97706'
  }
];

// Costo en Monedas RepuesTop para mejorar de rango un anuncio
export const UPGRADE_TOKEN_COSTS = {
  basica: tokensForClp(AD_TIER_PRICES_CLP.basica),
  destacada: tokensForClp(AD_TIER_PRICES_CLP.destacada),
  premium: tokensForClp(AD_TIER_PRICES_CLP.premium),
  empresarial: tokensForClp(AD_TIER_PRICES_CLP.empresarial)
};

/** El backend es la fuente final del tarifario; conserva los valores locales como fallback. */
function syncTierCosts(costosPorTier) {
  if (!costosPorTier || typeof costosPorTier !== 'object') return;
  for (const tier of Object.keys(UPGRADE_TOKEN_COSTS)) {
    const cost = Number(costosPorTier[tier]);
    if (Number.isInteger(cost) && cost >= 0) UPGRADE_TOKEN_COSTS[tier] = cost;
  }
}

// -------------------------------------------------------------
// GESTIÓN DE ANUNCIOS EN STORAGE
// -------------------------------------------------------------

/**
 * Trae el mural desde el backend y refresca la cache.
 *
 * El backend ya filtra activo + APROBADO + no expirado, pero se vuelve a filtrar
 * aca con `isAdVisibleOnWall()` porque la cache puede tener anuncios que
 * caducaron o que fueron editados (editar un anuncio lo devuelve a PENDIENTE) desde
 * la ultima vez que se leyo.
 *
 * Si la red falla, devuelve la cache y marca `fromCache` para que la vista pueda
 * avisar que lo mostrado puede estar desactualizado, en vez de fingir que todo va bien.
 */
export async function fetchPublicAds({ signal } = {}) {
  try {
    const response = await getPublicAdsApi({ signal });
    const ads = adaptAds(response).filter(isAdVisibleOnWall);
    writeWallCache(ads);
    return { ads, fromCache: false, error: null };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return { ads: readCache(ADS_WALL_CACHE_KEY).filter(isAdVisibleOnWall), fromCache: true, error };
  }
}

/** Ficha publica de un anuncio, ya adaptada. Lanza si el backend responde 404. */
export async function fetchPublicAd(adId, { signal } = {}) {
  return adaptAd(await getPublicAdApi(adId, { signal }));
}

// Evento propio del mural: lo escucha `AdsWallView` para repintarse cuando otra
// vista refresca la cache (por ejemplo al publicar o editar desde el perfil).
export const ADS_WALL_UPDATED_EVENT = 'repuestop_ads_wall_updated';

function writeWallCache(ads) {
  try {
    localStorage.setItem(ADS_WALL_CACHE_KEY, JSON.stringify(ads));
    window.dispatchEvent(new CustomEvent(ADS_WALL_UPDATED_EVENT, { detail: ads }));
  } catch (err) {
    console.warn('Error al guardar la cache del mural:', err);
  }
}

/** Ultima copia conocida del mural. Sincrona, para pintar algo en el primer render. */
export function getCachedWallAds() {
  return readCache(ADS_WALL_CACHE_KEY).filter(isAdVisibleOnWall);
}

// -------------------------------------------------------------
// GESTIÓN DE MIS ANUNCIOS (contra el backend)
// -------------------------------------------------------------

/**
 * Anuncios de la sesion en cualquier estado de moderacion, ya adaptados.
 *
 * No cachea: a diferencia del mural, aca importa mas ver el estado real de la
 * moderacion que tener algo pintado. Si la red falla, la vista muestra el error.
 *
 * Tampoco filtra los dados de baja: el backend ya no los devuelve (los marca
 * `ELIMINADO` y los excluye de `/anuncios/mios`). Esta funcion llego a llevar una
 * lista de ids borrados en `localStorage` porque la baja solo apagaba `activo` y
 * quedaba idéntica a un anuncio en revision; era por navegador y se desincronizaba
 * si moderacion aprobaba un anuncio ya dado de baja.
 */
export async function fetchMyAds({ signal } = {}) {
  return adaptAds(await getMyAdsApi({ signal })).sort((a, b) => Number(b.id) - Number(a.id));
}

/** Publica un anuncio. Nace PENDIENTE: no entra al mural hasta que lo aprueben. */
export async function createAd(ad) {
  const created = adaptAd(await createAdApi(toAdRequestPayload(ad)));
  refreshWallCache();
  return created;
}

/**
 * Guarda los cambios de un anuncio. Recibe el anuncio COMPLETO ya modificado,
 * no solo los campos tocados: el PUT reemplaza todo (ver `updateAdApi`).
 *
 * Devuelve el anuncio a PENDIENTE y lo saca del mural, por eso se refresca la
 * cache del mural: si estaba publicado, tiene que dejar de aparecer.
 */
export async function updateAd(adId, ad) {
  const saved = adaptAd(await updateAdApi(adId, toAdRequestPayload(ad)));
  refreshWallCache();
  return saved;
}

/**
 * Ajusta SOLO la agenda de un anuncio empresarial (`PATCH /anuncios/{id}/agenda`).
 * No manda el anuncio completo ni lo devuelve a moderacion: sigue publicado.
 * `bookingEnabled` false apaga las reservas; `config` puede ser la configuracion
 * de agenda de la UI (se serializa con `toAgendaConfigPayload`).
 */
export async function updateAdAgenda(adId, { bookingEnabled, config, agendaConfigId, agendaConfigName }) {
  const on = Boolean(bookingEnabled && config);
  const payload = {
    hasOnlineBooking: on,
    agendaConfig: on ? toAgendaConfigPayload(config) : null,
    agendaConfigId: on ? (agendaConfigId || `web-agc-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`) : null,
    agendaConfigName: on ? (agendaConfigName || 'Agenda de mi taller') : null,
    agendaHours: on ? getAgendaSummaryText(config) : '',
  };
  const saved = adaptAd(await updateAdAgendaApi(adId, payload));
  refreshWallCache();
  return saved;
}

/** Baja logica: el backend lo marca `ELIMINADO` y deja de listarlo. */
export async function deleteAd(adId) {
  await deleteAdApi(adId);
  refreshWallCache();
}

/** Sube fotos y devuelve sus URLs listas para mostrar. */
export async function uploadAdImages(files) {
  const response = await uploadAdImagesApi(files);
  const uploaded = Array.isArray(response?.imagenes) ? response.imagenes : [];
  return uploaded.map((item) => resolveMediaUrl(item?.url)).filter(Boolean);
}

/**
 * Vuelve a leer el mural para que la cache no quede mostrando un anuncio que
 * acaba de salir de circulacion. Es al margen de la accion del usuario: si falla,
 * la vista del mural lo resuelve en su propia carga.
 */
function refreshWallCache() {
  fetchPublicAds().catch(() => {});
}

/**
 * Mensaje de error de un fallo del backend de anuncios.
 *
 * `GlobalExceptionHandler` responde `{ message, errors }`: `errors` trae el
 * detalle campo por campo de las validaciones del DTO, y es lo unico que dice
 * QUE dato quedo mal. El `message` generico ("La solicitud contiene datos
 * invalidos") no le sirve a nadie.
 */
export function adErrorMessage(error, fallback = 'No se pudo completar la operación.') {
  const detail = error?.data?.errors;
  if (Array.isArray(detail) && detail.length > 0) return detail.join('\n');
  return error?.message || fallback;
}

// -------------------------------------------------------------
// GESTIÓN DE MONEDERO Y FICHAS REPUES-TOP
// -------------------------------------------------------------
//
// El saldo lo manda el backend (`GET /fichas/saldo`), que lo calcula sumando
// `RT_movimiento_ficha`. Antes vivia en `localStorage` y el bono de bienvenida se
// otorgaba aca mismo, asi que vaciar el navegador reponia 300 Monedas y publicar
// un anuncio Empresarial cuesta 250.
//
// Y el gasto ya no se descuenta desde el cliente: el backend cobra dentro de
// `AnuncioService.crear()` y `actualizar()`, en la misma transaccion que el
// anuncio. Si el saldo no alcanza, el POST o el PUT responden 422 y el anuncio no
// llega a existir, asi que no hay forma de publicar sin pagar ni de quedarse sin
// Monedas por una publicacion que fallo a medias.
//
// De `localStorage` queda solo una copia del ultimo saldo conocido, para pintar
// algo en el primer render sin esperar la red. Es SOLO para mostrar: se escribe
// unicamente con lo que respondio el servidor, nunca con una resta hecha aca.

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
 * Arranca en 0 y no en 300: el bono de bienvenida lo otorga el backend, y pintar
 * un saldo inventado mientras responde la red es prometer Monedas que pueden no
 * existir. Lo reemplaza `fetchTokensBalance()` apenas contesta.
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
    const { saldo, costosPorTier } = await getFichasBalanceApi({ signal });
    syncTierCosts(costosPorTier);
    return cacheTokensBalance(Number(saldo) || 0);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return getCachedTokensBalance();
  }
}

const MOTIVO_LABELS = {
  COMPRA: 'Recarga de Monedas',
  BONO_BIENVENIDA: 'Bono de bienvenida Monedero RepuesTop',
  PUBLICACION: 'Publicación de anuncio',
  UPGRADE: 'Mejora de plan del anuncio'
};

/**
 * Historial de movimientos, del mas nuevo al mas viejo.
 *
 * El DTO trae `tipo` en mayusculas y la cantidad SIEMPRE positiva: el signo lo da
 * el tipo. Se traduce a la forma que ya pintaba la UI (`credit` / `debit`) para
 * no tener que tocar las vistas.
 */
export async function fetchTokenTransactions({ signal } = {}) {
  const { saldo, movimientos, costosPorTier } = await getFichasMovimientosApi({ signal });
  syncTierCosts(costosPorTier);
  cacheTokensBalance(Number(saldo) || 0);
  return (Array.isArray(movimientos) ? movimientos : []).map((item) => ({
    id: String(item.id),
    type: item.tipo === 'CREDITO' ? 'credit' : 'debit',
    amount: Number(item.cantidad) || 0,
    description: item.descripcion || MOTIVO_LABELS[item.motivo] || 'Movimiento de Monedas',
    date: item.fecha,
    adId: item.anuncioId || null
  }));
}

/**
 * Registra la compra pagada y devuelve el saldo ya actualizado por el servidor.
 *
 * El credito lo aplica el backend al registrar la compra, asi que aca no se suma
 * nada: sumarlo en el navegador es exactamente lo que hacia que los dos numeros
 * se separaran. Si el registro falla, se propaga el error — esas Monedas todavia
 * no existen y mostrarlas seria mentir.
 *
 * Esta llamada NO existia en la web: solo la hacia el movil, asi que hasta ahora
 * toda recarga hecha desde el navegador era invisible para Administracion
 * Contable, ademas de no acreditar nada.
 */
export async function rechargeTokensWithPack(pack, paymentMethod = 'Webpay Plus', origin = 'ANUNCIOS') {
  await registrarCompraFichasApi({
    cantidadFichas: pack.totalTokens,
    montoPagado: pack.priceClp,
    packNombre: pack.name,
    metodoPago: paymentMethod,
    origen: String(origin || 'ANUNCIOS').toUpperCase(),
    // Identifica la compra: el backend la usa para no registrarla ni acreditarla
    // dos veces si un reintento llega despues de que ya entro.
    referenciaPago: `WEB-${pack.id}-${Date.now()}`
  });
  return fetchTokensBalance();
}

/**
 * Sube de rango un anuncio y devuelve el anuncio guardado con el saldo que quedo.
 *
 * El PUT es el que cobra, dentro de su propia transaccion: si el saldo no alcanza
 * responde 422 y el anuncio se queda en el plan viejo, asi que no hay nada que
 * revertir aca. Esta funcion llego a descontar las Monedas por su cuenta, y como
 * el descuento era local, un PUT fallido dejaba al usuario sin saldo y con el
 * anuncio sin mejorar.
 */
export async function spendTokensForAdUpgrade(ad, targetTier) {
  const saved = await updateAd(ad.id, { ...ad, tier: targetTier });
  return { ad: saved, balance: await fetchTokensBalance() };
}

// -------------------------------------------------------------
// AGENDAMIENTO DE CITAS
// -------------------------------------------------------------

/**
 * Reservas de un anuncio. La MISMA ruta sirve para dos cosas segun quien
 * pregunte (ver `getAdAppointmentsApi`): al dueño le devuelve su agenda completa
 * y a cualquier otro solo los bloques futuros ocupados, censurados.
 *
 * A diferencia del movil no hay respaldo local: `getAppointmentsForAd()` cae a
 * la copia de AsyncStorage si la red falla, y ahi el riesgo es real —
 * disponibilidad vieja significa ofrecer un bloque que ya no existe y comerse un
 * 409 recien al confirmar. Aca se propaga el error y la vista lo dice.
 */
export async function fetchAdAppointments(adId, { signal } = {}) {
  return adaptAppointments(await getAdAppointmentsApi(adId, { signal }));
}

/**
 * Todas las reservas que tocan a la sesion, en una lista sola: el backend
 * (`findRelevantes()`) mezcla las que uno pidio como cliente con las que le
 * hicieron a sus anuncios. Se separan comparando `customerUserId` con el id de
 * la sesion, que es el unico dato del DTO que distingue los dos roles.
 */
export async function fetchMyAppointments({ signal } = {}) {
  return adaptAppointments(await getMyAppointmentsApi({ signal }));
}

/**
 * Reserva una hora y devuelve la cita ya creada.
 *
 * No notifica: quien llama decide cuando disparar `notifyAppointmentCreated()`,
 * porque los avisos no deben poder tumbar una reserva que el backend ya guardo.
 */
export async function createAdAppointment(adId, form) {
  return adaptAppointment(await createAdAppointmentApi(adId, toAppointmentRequestPayload(form)));
}

/** Acepta, rechaza o cancela una reserva. Devuelve la cita con el estado nuevo. */
export async function updateAppointmentStatus(appointmentId, status) {
  return adaptAppointment(await updateAdAppointmentStatusApi(appointmentId, status));
}

/**
 * Avisa la cita nueva al taller y al cliente: correo con el resumen para ambos y
 * notificacion dentro de la plataforma para cada uno. Contraparte de
 * `mobile/services/appointment-notifications.ts`.
 *
 * NUNCA lanza. La reserva ya quedo confirmada por el backend y un fallo de aviso
 * no debe deshacerla ni mostrarse como si la cita hubiera fallado; por eso los
 * tres envios van en paralelo con `allSettled` y el resultado es informativo.
 *
 * `dateLabel` llega ya formateado ("jueves 20 de agosto de 2026") porque el
 * correo lo imprime tal cual: el backend no formatea fechas de este payload.
 */
export async function notifyAppointmentCreated({ appointment, ad, customerUserId, dateLabel }) {
  // Los ids del backend son numericos. Un 'guest' o un id vacio darian un 404
  // que no aporta nada, asi que esos avisos simplemente no se intentan.
  const isNumericId = (value) => Boolean(value && /^\d+$/.test(String(value).trim()));

  const notifyProvider = async () => {
    if (!isNumericId(ad?.ownerSellerId)) return;
    await createProviderNotificationApi(String(ad.ownerSellerId), {
      tipo: 'AGENDAMIENTO_CITA',
      titulo: 'Nueva reserva en tu agenda',
      mensaje: `${appointment.customerName} reservó ${appointment.service} para el ${dateLabel} a las ${appointment.time} en "${ad.title}".`,
      targetRoute: '/perfil',
      targetParams: { adId: String(ad.id) },
      // Idempotencia del lado del backend: si el aviso se reintenta, no duplica.
      eventKey: `ad-appointment:${appointment.id}`
    });
  };

  const notifyCustomer = async () => {
    if (!isNumericId(customerUserId)) return;
    await createUserNotificationApi(String(customerUserId), {
      tipo: 'AGENDAMIENTO_CITA',
      titulo: 'Tu cita quedó registrada',
      mensaje: `${appointment.service} en ${ad?.company || ad?.title} el ${dateLabel} a las ${appointment.time}. Te avisaremos cuando el taller la confirme.`,
      targetRoute: '/mural-anuncios',
      targetParams: { adId: String(ad?.id ?? '') },
      eventKey: `ad-appointment-customer:${appointment.id}`
    });
  };

  const sendEmails = async () => {
    await sendAppointmentSummaryEmailsApi({
      reservaId: appointment.id,
      avisoTitulo: ad?.title || appointment.adTitle,
      empresa: ad?.company || '',
      servicio: appointment.service,
      fecha: dateLabel,
      hora: appointment.time,
      clienteNombre: appointment.customerName,
      clienteCorreo: appointment.customerEmail,
      clienteTelefono: appointment.customerPhone,
      vehiculo: appointment.vehicleModel,
      patente: appointment.vehiclePatent,
      notas: appointment.notes,
      direccion: [ad?.address, ad?.commune].filter(Boolean).join(', '),
      tallerCorreo: ad?.ownerEmail,
      tallerNombre: ad?.company
    });
  };

  const [provider, customer, email] = await Promise.allSettled([
    notifyProvider(), notifyCustomer(), sendEmails()
  ]);

  return {
    inApp: provider.status === 'fulfilled' || customer.status === 'fulfilled',
    email: email.status === 'fulfilled'
  };
}
