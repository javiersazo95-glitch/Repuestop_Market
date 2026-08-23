// Mural de Anuncios y monedero de Fichas RepuesTop.
//
// Todo el ciclo de vida del anuncio pasa por el backend, igual que en el movil
// (`mobile/services/ads-storage.ts`): el mural publico por `GET /anuncios` y la
// gestion propia por `GET /anuncios/mios` + POST / PUT / DELETE.
//
// localStorage guarda solo dos cosas: la ultima copia del mural, para que la
// grilla no aparezca vacia mientras responde la red, y el monedero de Fichas,
// que sigue sin backend (no hay endpoint de saldo ni de consumo; ver la fase D
// del handoff). La llave `repuestop_classified_ads` de la fase A quedo sin uso:
// esos anuncios nunca existieron fuera del navegador.
import {
  getPublicAdsApi, getPublicAdApi, getMyAdsApi,
  createAdApi, updateAdApi, deleteAdApi, uploadAdImagesApi, resolveMediaUrl,
  getAdAppointmentsApi, getMyAppointmentsApi, createAdAppointmentApi,
  updateAdAppointmentStatusApi, sendAppointmentSummaryEmailsApi,
  createUserNotificationApi, createProviderNotificationApi
} from './api';
import {
  adaptAd, adaptAds, toAdRequestPayload,
  adaptAppointment, adaptAppointments, toAppointmentRequestPayload
} from './adapters';
import { isAdVisibleOnWall } from '../data/automotiveAdsData';

const ADS_WALL_CACHE_KEY = 'repuestop_ads_wall_cache';
const TOKENS_BALANCE_KEY = 'repuestop_fichas_balance';
const TOKENS_HISTORY_KEY = 'repuestop_fichas_transactions';

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

// Packs de recarga de Fichas RepuesTop
export const TOKEN_PACKS = [
  {
    id: 'pack-basico',
    name: 'Pack Básico',
    tokens: 100,
    bonus: 0,
    totalTokens: 100,
    priceClp: 4990,
    priceFormatted: '$4.990 CLP',
    tag: 'Inicial',
    highlight: false,
    description: 'Ideal para destacar 2 anuncios en el mural.',
    color: '#64748b'
  },
  {
    id: 'pack-medio',
    name: 'Pack Medio',
    tokens: 250,
    bonus: 25,
    totalTokens: 275,
    priceClp: 9990,
    priceFormatted: '$9.990 CLP',
    tag: 'Más Popular',
    highlight: true,
    description: 'Perfecto para clasificar en Plan Premium con WhatsApp directo.',
    color: '#7c3aed'
  },
  {
    id: 'pack-avanzado',
    name: 'Pack Avanzado',
    tokens: 600,
    bonus: 100,
    totalTokens: 700,
    priceClp: 19900,
    priceFormatted: '$19.990 CLP',
    tag: 'Empresarial',
    highlight: false,
    description: 'Accede a Plan Empresarial con agendamiento de citas en línea.',
    color: '#059669'
  },
  {
    id: 'pack-extra',
    name: 'Pack Extra Pro',
    tokens: 1500,
    bonus: 350,
    totalTokens: 1850,
    priceClp: 39990,
    priceFormatted: '$39.990 CLP',
    tag: 'Máximo Ahorro',
    highlight: false,
    description: 'Para talleres y redes automotrices con múltiples avisos permanentes.',
    color: '#d97706'
  }
];

// Costo en Fichas RepuesTop para mejorar de rango un anuncio
export const UPGRADE_TOKEN_COSTS = {
  basica: 0,
  destacada: 50,
  premium: 120,
  empresarial: 250
};

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

export function getTokensBalance() {
  try {
    const raw = localStorage.getItem(TOKENS_BALANCE_KEY);
    if (raw === null) {
      // Saldo de bienvenida inicial (300 fichas para probar)
      const initialBalance = 300;
      localStorage.setItem(TOKENS_BALANCE_KEY, String(initialBalance));
      return initialBalance;
    }
    return Number(raw) || 0;
  } catch {
    return 300;
  }
}

export function setTokensBalance(amount) {
  try {
    const val = Math.max(0, Math.round(amount));
    localStorage.setItem(TOKENS_BALANCE_KEY, String(val));
    window.dispatchEvent(new CustomEvent('repuestop_tokens_updated', { detail: val }));
    return val;
  } catch {
    return amount;
  }
}

export function getTokenTransactions() {
  try {
    const raw = localStorage.getItem(TOKENS_HISTORY_KEY);
    if (!raw) {
      const initialHistory = [
        {
          id: 'tx-welcome',
          type: 'credit',
          amount: 300,
          description: 'Bono de bienvenida Monedero RepuesTop',
          date: new Date().toISOString()
        }
      ];
      localStorage.setItem(TOKENS_HISTORY_KEY, JSON.stringify(initialHistory));
      return initialHistory;
    }
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function addTokenTransaction(tx) {
  try {
    const current = getTokenTransactions();
    const updated = [
      {
        id: `tx-${Date.now()}`,
        date: new Date().toISOString(),
        ...tx
      },
      ...current
    ];
    localStorage.setItem(TOKENS_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

// Recargar saldo mediante un Pack de Fichas
export function rechargeTokensWithPack(pack, paymentMethod = 'Webpay Plus') {
  const currentBalance = getTokensBalance();
  const newBalance = currentBalance + pack.totalTokens;
  setTokensBalance(newBalance);

  addTokenTransaction({
    type: 'credit',
    amount: pack.totalTokens,
    description: `Recarga ${pack.name} (${pack.totalTokens} Fichas) - Pago con ${paymentMethod}`,
    priceClp: pack.priceClp
  });

  return newBalance;
}

/**
 * Cobra las Fichas del plan al publicar un anuncio nuevo (todavia no hay adId).
 * Mismo tarifario que el upgrade, homologado con `spendTokensForNewAd` del movil:
 * si publicar en un plan fuera gratis, nadie pagaria por subir de rango.
 */
export function spendTokensForNewAd(tier, adTitle) {
  const cost = UPGRADE_TOKEN_COSTS[tier] || 0;
  const currentBalance = getTokensBalance();

  if (cost > 0 && currentBalance < cost) {
    throw new Error(`Saldo insuficiente: tienes ${currentBalance} fichas y necesitas ${cost} fichas.`);
  }

  const newBalance = currentBalance - cost;
  setTokensBalance(newBalance);

  if (cost > 0) {
    addTokenTransaction({
      type: 'debit',
      amount: cost,
      description: `Publicación de anuncio "${adTitle}" en plan ${tier.toUpperCase()}`
    });
  }

  return newBalance;
}

/**
 * Sube de rango un anuncio y descuenta las Fichas.
 *
 * El cambio de plan viaja como un PUT normal, asi que el anuncio vuelve a
 * PENDIENTE y desaparece del mural hasta que moderacion lo re-apruebe. Quien
 * llame tiene que haberlo advertido antes de cobrar.
 *
 * Primero guarda y despues cobra: al reves, un PUT fallido dejaria al usuario sin
 * fichas y con el anuncio en el plan viejo. Recibe el anuncio completo porque el
 * PUT reemplaza todos los campos.
 */
export async function spendTokensForAdUpgrade(ad, targetTier) {
  const cost = UPGRADE_TOKEN_COSTS[targetTier] || 0;
  const currentBalance = getTokensBalance();

  if (cost > 0 && currentBalance < cost) {
    throw new Error(`Saldo insuficiente: tienes ${currentBalance} fichas y necesitas ${cost} fichas.`);
  }

  // El plan desbloquea la funcion, pero la agenda se activa recien cuando el
  // socio guarda una configuracion horaria valida (fase C).
  const saved = await updateAd(ad.id, { ...ad, tier: targetTier });

  const newBalance = setTokensBalance(currentBalance - cost);
  if (cost > 0) {
    addTokenTransaction({
      type: 'debit',
      amount: cost,
      description: `Upgrade de anuncio "${ad.title}" a rango ${targetTier.toUpperCase()}`,
      adId: ad.id
    });
  }

  return { ad: saved, balance: newBalance };
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
