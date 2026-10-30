// Buscador de talleres, perfil del taller y citas.
//
// El perfil publico del taller vive en el backend, igual que en el movil
// (`mobile/services/talleres-storage.ts`): el buscador por `GET /talleres`, el perfil por
// `GET /talleres/{id}` y la edicion propia por `PUT /automotive-services/me/perfil`.
//
// localStorage guarda solo la ultima copia del buscador, para que la grilla no aparezca vacia
// mientras responde la red.
import {
  getTalleresApi, getTallerApi, getMiTallerPerfilApi, updateMiTallerPerfilApi, uploadTallerPhotosApi, resolveMediaUrl,
  getTallerAppointmentsApi, getMyAppointmentsApi, createTallerAppointmentApi,
  updateAppointmentStatusApi, sendAppointmentSummaryEmailsApi, rescheduleAppointmentApi, rateAppointmentWorkshopApi,
} from './api';
import {
  adaptTaller, adaptTalleres, toTallerProfilePayload,
  adaptAppointment, adaptAppointments, toAppointmentRequestPayload
} from './adapters';

const TALLERES_CACHE_KEY = 'repuestop_talleres_cache';

function readCache() {
  try {
    const raw = localStorage.getItem(TALLERES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string') : [];
  } catch {
    return [];
  }
}

// Evento propio del buscador: lo escucha `TalleresDirectoryView` para repintarse cuando otra vista
// refresca la cache (por ejemplo al editar el perfil desde Mi taller).
export const TALLERES_UPDATED_EVENT = 'repuestop_talleres_updated';

function writeCache(talleres) {
  try {
    localStorage.setItem(TALLERES_CACHE_KEY, JSON.stringify(talleres));
    window.dispatchEvent(new CustomEvent(TALLERES_UPDATED_EVENT, { detail: talleres }));
  } catch (err) {
    console.warn('Error al guardar la cache de talleres:', err);
  }
}

/** Ultima copia conocida del buscador. Sincrona, para pintar algo en el primer render. */
export function getCachedTalleres() {
  return readCache();
}

/**
 * Trae los talleres desde el backend y refresca la cache.
 *
 * Si la red falla, devuelve la cache y marca `fromCache` para que la vista pueda avisar que lo
 * mostrado puede estar desactualizado, en vez de fingir que todo va bien.
 */
export async function fetchTalleres({ signal } = {}) {
  try {
    const talleres = adaptTalleres(await getTalleresApi({ signal }));
    writeCache(talleres);
    return { talleres, fromCache: false, error: null };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return { talleres: readCache(), fromCache: true, error };
  }
}

/** Perfil publico de un taller, ya adaptado. Lanza si el backend responde 404. */
export async function fetchTaller(tallerId, { signal } = {}) {
  return adaptTaller(await getTallerApi(tallerId, { signal }));
}

/** El perfil del taller de la sesion tal como lo edita: existe aunque aun no sea publico. */
export async function fetchMiTaller({ signal } = {}) {
  return adaptTaller(await getMiTallerPerfilApi({ signal }));
}

/**
 * Guarda el perfil publico del taller de la sesion. Recibe solo lo que cambio (los campos
 * ausentes no se tocan) y devuelve el perfil ya adaptado. Refresca el buscador.
 */
export async function updateMiTallerPerfil(profile) {
  const saved = adaptTaller(await updateMiTallerPerfilApi(toTallerProfilePayload(profile)));
  fetchTalleres().catch(() => {});
  return saved;
}

/** Sube fotos y devuelve sus URLs listas para mostrar. */
export async function uploadTallerPhotos(files) {
  const response = await uploadTallerPhotosApi(files);
  const uploaded = Array.isArray(response?.imagenes) ? response.imagenes : [];
  return uploaded.map((item) => resolveMediaUrl(item?.url)).filter(Boolean);
}

// -------------------------------------------------------------
// AGENDAMIENTO DE CITAS
// -------------------------------------------------------------

/**
 * Reservas de un taller. La MISMA ruta sirve para dos cosas segun quien pregunte (ver
 * `getTallerAppointmentsApi`): al dueño le devuelve su agenda completa y a cualquier otro solo
 * los bloques futuros ocupados, censurados.
 *
 * A diferencia del movil no hay respaldo local: disponibilidad vieja significa ofrecer un bloque
 * que ya no existe y comerse un 409 recien al confirmar. Aca se propaga el error y la vista lo dice.
 */
export async function fetchTallerAppointments(tallerId, { signal } = {}) {
  return adaptAppointments(await getTallerAppointmentsApi(tallerId, { signal }));
}

/**
 * Todas las reservas que tocan a la sesion, en una lista sola: el backend las mezcla (las que uno
 * pidio como cliente y las que le hicieron a su taller). Se separan comparando `customerUserId`
 * con el id de la sesion.
 */
export async function fetchMyAppointments({ signal } = {}) {
  return adaptAppointments(await getMyAppointmentsApi({ signal }));
}

/**
 * Reserva una hora y devuelve la cita ya creada.
 *
 * No notifica: quien llama decide cuando disparar `notifyAppointmentCreated()`, porque los avisos
 * no deben poder tumbar una reserva que el backend ya guardo.
 */
export async function createTallerAppointment(tallerId, form) {
  return adaptAppointment(await createTallerAppointmentApi(tallerId, toAppointmentRequestPayload(form)));
}

/** Evento de ventana: las citas cambiaron (una accion propia o una notificacion de cita). */
export const APPOINTMENTS_UPDATED_EVENT = 'repuestop:appointments-updated';

export function notifyAppointmentsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(APPOINTMENTS_UPDATED_EVENT));
}

/**
 * Acepta, rechaza o cancela una reserva (con motivo opcional). Devuelve la cita con el estado
 * nuevo. El aviso a la contraparte lo crea el backend junto con el cambio.
 */
export async function updateAppointmentStatus(appointmentId, status, reason) {
  const updated = adaptAppointment(await updateAppointmentStatusApi(appointmentId, status, reason));
  notifyAppointmentsChanged();
  return updated;
}

/** Califica al taller de una cita ya realizada (una vez por cita). Avisa a las listas para que muestren la nota. */
export async function rateAppointmentWorkshop(appointmentId, stars, comment) {
  await rateAppointmentWorkshopApi(appointmentId, stars, comment);
  notifyAppointmentsChanged();
}

/** Cambia la hora de una cita propia: el backend cancela la anterior y crea la nueva. */
export async function rescheduleAppointment(appointmentId, form) {
  const created = adaptAppointment(await rescheduleAppointmentApi(appointmentId, toAppointmentRequestPayload(form)));
  notifyAppointmentsChanged();
  return created;
}

/**
 * Envia a ambos el correo con el resumen de la cita nueva.
 *
 * Las notificaciones dentro de la plataforma las crea el backend junto con la reserva y con cada
 * cambio de estado. NUNCA lanza: la reserva ya quedo guardada.
 */
export async function notifyAppointmentCreated({ appointment, taller, dateLabel }) {
  try {
    await sendAppointmentSummaryEmailsApi({
      reservaId: appointment.id,
      avisoTitulo: taller?.name || appointment.tallerName,
      empresa: taller?.name || '',
      servicio: appointment.service,
      fecha: dateLabel,
      hora: appointment.time,
      clienteNombre: appointment.customerName,
      clienteCorreo: appointment.customerEmail,
      clienteTelefono: appointment.customerPhone,
      vehiculo: appointment.vehicleModel,
      patente: appointment.vehiclePatent,
      notas: appointment.notes,
      direccion: [taller?.address, taller?.commune].filter(Boolean).join(', '),
      // Los destinatarios los pone el backend desde la reserva guardada.
      tallerNombre: taller?.name
    });
    return { email: true };
  } catch {
    return { email: false };
  }
}
