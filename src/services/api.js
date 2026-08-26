import { LEGAL_VERSION_CODE } from '../data/legalTexts';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

const apiOrigin = () => API_BASE_URL.replace(/\/api\/v1\/?$/, '');

// Registros antiguos guardaron la URL ABSOLUTA del backend que subio el archivo,
// asi que una foto cargada contra un backend local o de otro ambiente apunta a
// ese host y no se ve desde otra build (y si el host quedo en http://, el
// navegador la bloquea por contenido mixto). Del proxy propio solo importa la
// ruta. Contraparte de `resolveImageUri()` en `mobile/utils/images.ts` y de
// `AnuncioService.normalizarRutaImagen()`, que arregla el dato en el origen.
const PROXY_ABSOLUTE_URL = /^https?:\/\/[^/]+(\/api\/v1\/uploads\/.*)$/i;

// El backend persiste rutas de R2 como `/api/v1/uploads/...`. En desarrollo el
// marketplace vive en otro origen (Vite), por eso las convertimos en URLs de la
// API antes de entregarlas a un <img>. Las URLs externas y data/blob se preservan.
export function resolveMediaUrl(value) {
  if (!value || typeof value !== 'string') return value || null;

  const legacyProxyPath = value.match(PROXY_ABSOLUTE_URL);
  if (legacyProxyPath) return `${apiOrigin()}${legacyProxyPath[1]}`;

  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${apiOrigin()}${value.startsWith('/') ? value : `/${value}`}`;
}

/**
 * Inverso de `resolveMediaUrl`: deja la ruta relativa que guarda el backend.
 *
 * Lo que se muestra en pantalla es la URL absoluta que arma `resolveMediaUrl`,
 * pero al reenviarla en un PUT quedaria persistida con el origen de este
 * ambiente; un anuncio editado en local terminaria apuntando a localhost en
 * produccion. Las URLs externas (http de otro dominio, data:, blob:) se dejan
 * intactas: no son del proxy de archivos.
 */
export function toMediaPath(value) {
  if (!value || typeof value !== 'string') return null;
  const proxyPath = value.match(PROXY_ABSOLUTE_URL);
  if (proxyPath) return proxyPath[1];
  return value.startsWith(apiOrigin()) ? value.slice(apiOrigin().length) : value;
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(message, status, data = null, options = {}) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let refreshPromise = null;

/**
 * Renueva la sesión enviando el JWT actual a POST /auth/refresh.
 * Garantiza una sola petición concurrente (single flight) para múltiples llamadas simultáneas.
 */
export async function refreshSessionApi(currentJwt) {
  const tokenToRefresh = currentJwt || localStorage.getItem('repuestop_token');
  if (!tokenToRefresh) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenToRefresh, refreshToken: tokenToRefresh }),
        });

        if (!response.ok) {
          if ([400, 401, 403].includes(response.status)) {
            localStorage.removeItem('repuestop_token');
            window.dispatchEvent(new CustomEvent('repuestop:session_expired'));
            return null;
          }
          return null;
        }

        const data = await response.json();
        if (data && data.token) {
          localStorage.setItem('repuestop_token', data.token);
          window.dispatchEvent(new CustomEvent('repuestop:token_refreshed', { detail: data }));
          return data.token;
        }
        return null;
      } catch (err) {
        console.warn('Error intentando renovar sesión:', err);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

/**
 * Generic fetch wrapper for backend endpoints
 */
export async function fetchApi(endpoint, options = {}) {
  const token = localStorage.getItem('repuestop_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  
  const isCustomSignal = Boolean(options.signal);
  const signal = options.signal ?? (typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15000) : undefined);

  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-Request-Id': requestId,
    ...options.headers,
  };

  const config = {
    credentials: 'include',
    ...options,
    headers,
    ...(signal ? { signal } : {}),
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');
    let data = null;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Si recibimos 401 y hay token, intentamos renovar con POST /auth/refresh
      // (siempre que la llamada no provenga del grupo /auth/ ni sea un reintento previo).
      if (response.status === 401 && token && !endpoint.includes('/auth/') && !options._retry) {
        const newToken = await refreshSessionApi(token);
        if (newToken) {
          return fetchApi(endpoint, { ...options, _retry: true });
        }
      }

      if (response.status === 401 && token && !endpoint.includes('/auth/login')) {
        window.dispatchEvent(new CustomEvent('repuestop:unauthorized'));
      }
      const errorMessage =
        (typeof data === 'object' && (data?.message || data?.error)) ||
        (typeof data === 'string' ? data : `Error HTTP ${response.status}`);
      throw new ApiError(errorMessage, response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (isCustomSignal && error.name === 'AbortError') {
      throw error;
    }
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new ApiError(
        'La petición al servidor ha superado el tiempo límite de espera (15s).',
        0,
        null,
        { cause: error }
      );
    }
    // Network or connection error
    throw new ApiError(
      'No se pudo conectar con el servidor backend. Por favor verifica tu conexión.',
      0,
      null,
      { cause: error }
    );
  }
}

/**
 * Auth API endpoints
 */
export async function loginApi({ email, password }) {
  return fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim(),
      password,
      authProvider: 'EMAIL_PASSWORD',
    }),
  });
}

export async function loginGoogleApi({ idToken }) {
  return fetchApi('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
}

/**
 * Registro de comprador. El contrato del backend (`validarComprador` en AuthService)
 * exige firstName, lastName, email, password, `direccion` con comunaId y calleYNumero, y
 * `acceptsTerms` en true. Mandaba `userName` y ningun otro de esos campos, asi que el
 * registro fallaba con 400 antes de llegar al servidor de correo.
 */
export async function registerBuyerApi(buyerData) {
  const nombreCompleto = String(buyerData.name || buyerData.userName || '').trim();
  const partes = nombreCompleto.split(/\s+/);
  const authProvider = buyerData.authProvider || 'EMAIL_PASSWORD';

  return fetchApi('/auth/register/buyer', {
    method: 'POST',
    body: JSON.stringify({
      email: buyerData.email.trim(),
      password: buyerData.password || '',
      firstName: buyerData.firstName || partes[0] || '',
      lastName: buyerData.lastName || partes.slice(1).join(' ') || '',
      // Nulo y no cadena vacia cuando no hay telefono: es opcional, y `Usuario.telefono`
      // guardaba "" en vez de null, con lo que "no tiene telefono" dejaba de ser
      // distinguible mirando el campo. Se vio en el primer alta con Google.
      phone: buyerData.phone?.trim() || null,
      authProvider,
      // Con Google el backend NO se fia del correo del formulario: lo saca del
      // idToken que verifica el mismo (`resolverEmailVerificado`), para que nadie
      // registre una cuenta con un correo ajeno. Sin este campo el alta falla.
      idToken: buyerData.idToken || null,
      userProfileUrl: buyerData.userProfileUrl || null,
      acceptsTerms: buyerData.acceptsTerms === true,
      termsVersion: LEGAL_VERSION_CODE,
      // El alta con Google puede venir SIN direccion, y entonces hay que MANDARLA
      // NULA: `validarComprador()` solo se salta la validacion cuando el campo
      // llega nulo, asi que un objeto con calle vacia y comuna nula —que es lo
      // que se enviaba siempre— hace fallar el registro igual que antes.
      direccion: buyerData.direccion?.comunaId
        ? {
          calleYNumero: buyerData.direccion.calleYNumero || '',
          comunaId: Number(buyerData.direccion.comunaId),
          codigoPostal: buyerData.direccion.codigoPostal || '',
        }
        : null,
    }),
  });
}

export async function registerSellerApi(sellerData) {
  return fetchApi('/auth/register/seller', {
    method: 'POST',
    body: JSON.stringify({
      email: sellerData.email.trim(),
      password: sellerData.password,
      userName: sellerData.userName || sellerData.nombreTienda,
      storeName: sellerData.storeName || sellerData.nombreTienda,
      taxId: sellerData.taxId || sellerData.rutEmpresa,
      phone: sellerData.phone || sellerData.telefono,
      region: sellerData.region || 'Región Metropolitana',
      comuna: sellerData.comuna || sellerData.ciudad,
      address: sellerData.address || '',
      shippingMethods: sellerData.shippingMethods || 'Starken, Chilexpress, Retiro en Tienda',
      authProvider: 'EMAIL_PASSWORD',
    }),
  });
}

export async function getRecentSellersApi() {
  return fetchApi('/auth/recent-sellers', {
    method: 'GET',
  });
}

/**
 * Envía un código de 6 dígitos al correo registrado para iniciar la recuperación de contraseña.
 * @param {string} email Correo electrónico (o RUT en caso de tienda)
 * @param {string} [rol] 'CLIENTE' o 'PROVEEDOR'
 */
export async function recoverPasswordSendCodeApi(email, rol = 'CLIENTE') {
  return fetchApi('/auth/recover-password/send-code', {
    method: 'POST',
    body: JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
      rol: rol || 'CLIENTE',
    }),
  });
}

/**
 * Valida que el código de 6 dígitos corresponda al correo indicado.
 */
export async function recoverPasswordVerifyCodeApi(email, code, rol = 'CLIENTE') {
  return fetchApi('/auth/recover-password/verify-code', {
    method: 'POST',
    body: JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
      code: String(code || '').trim(),
      rol: rol || 'CLIENTE',
    }),
  });
}

/**
 * Restablece la contraseña del usuario tras validar el código.
 */
export async function recoverPasswordResetApi(email, code, newPassword, rol = 'CLIENTE') {
  return fetchApi('/auth/recover-password/reset', {
    method: 'POST',
    body: JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
      code: String(code || '').trim(),
      newPassword: String(newPassword || ''),
      rol: rol || 'CLIENTE',
    }),
  });
}

/**
 * Verificación rápida de disponibilidad de correo antes de crear cuenta.
 * @returns {Promise<{exists: boolean, provider?: string, role?: string}>}
 */
export async function checkEmailAvailabilityApi(email) {
  const trimmed = String(email || '').trim().toLowerCase();
  return fetchApi(`/auth/check-email?email=${encodeURIComponent(trimmed)}`, {
    method: 'GET',
  });
}

/**
 * Estado de bloqueo de la tienda. Es la UNICA fuente de verdad que sobrevive a un
 * refresco: `GET /users/perfil` (PerfilUsuarioDTO) no trae ningun campo de bloqueo y
 * pisa el `user` completo al montar, asi que el `sellerBlocked` del login se pierde.
 *
 * Devuelve `{ sellerBlocked, blockReason }`. El backend lo marca por dos vias:
 * `proveedor.status` en 'suspended'/'rejected', o una mediacion con
 * `cuentaBloqueada = true` (de ahi sale el motivo).
 */
export async function getSellerAccountStatusApi(proveedorId, { signal } = {}) {
  return fetchApi(`/proveedores/${proveedorId}/estado-cuenta`, {
    method: 'GET',
    signal,
  });
}

/**
 * Envía solicitud de revisión cuando la cuenta del vendedor está bloqueada.
 */
export async function requestBlockedAccountReviewApi(proveedorId, { mensaje, contactoAlternativo } = {}) {
  const finalMessage = [mensaje, contactoAlternativo ? `Contacto alternativo: ${contactoAlternativo}` : '']
    .filter(Boolean)
    .join(' | ');
  return fetchApi(`/proveedores/${proveedorId}/cuenta-bloqueada/solicitud-revision`, {
    method: 'POST',
    body: JSON.stringify({ mensaje: finalMessage || 'Solicito revisión de cuenta bloqueada' }),
  });
}

export async function logoutApi(token) {
  try {
    return await fetchApi('/auth/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (err) {
    console.warn('Logout remoto omitido o fallido:', err);
    return null;
  }
}

export async function getProfileApi() {
  return fetchApi('/users/perfil', {
    method: 'GET',
  });
}

/**
 * Registra que el usuario acepto la version vigente de los terminos. Se llama cuando el
 * perfil devuelve `requiereAceptarTerminos: true`, o sea cuando cambio el documento
 * desde la ultima vez que acepto.
 */
export async function acceptTermsApi() {
  return fetchApi('/users/perfil/aceptar-terminos', {
    method: 'POST',
    body: JSON.stringify({ termsVersion: LEGAL_VERSION_CODE }),
  });
}

export async function updateProfileApi(payload) {
  return fetchApi('/users/perfil', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Desactiva la cuenta autenticada y anonimiza sus credenciales en el backend. */
export async function deleteAccountApi(userId) {
  return fetchApi(`/auth/users/${userId}`, { method: 'DELETE' });
}

/** Sube el logo/avatar del perfil. Las portadas se eligen desde plantillas R2. */
export async function uploadProfileImageApi(file) {
  const token = localStorage.getItem('repuestop_token');
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/users/perfil/foto`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.message || data?.error || 'No se pudo subir la imagen.', response.status, data);
  }
  return data;
}

export async function getStoreCoverTemplatesApi() {
  return fetchApi('/users/perfil/portadas-plantilla', { method: 'GET' });
}

export async function selectStoreCoverTemplateApi(templateId) {
  return fetchApi('/users/perfil/portada-plantilla', {
    method: 'PUT',
    body: JSON.stringify({ templateId }),
  });
}

/**
 * Perfil: Pedidos, favoritos e inventario/tienda del proveedor
 */
export async function getBuyerOrdersApi(usuarioId, { signal } = {}) {
  return fetchApi(`/usuarios/${usuarioId}/pedidos`, { method: 'GET', signal });
}

/**
 * Detalle de un pedido puntual. Usado por PurchaseSuccessPage al volver de Flow: si
 * sessionStorage no tiene el pedido (otra pestaña/dispositivo, storage limpiado), esto
 * lo trae directo por id en vez de depender del listado completo.
 */
export async function getBuyerOrderByIdApi(usuarioId, orderId, { signal } = {}) {
  return fetchApi(`/usuarios/${usuarioId}/pedidos/${orderId}`, { method: 'GET', signal });
}

/**
 * Pide una intencion de pago NUEVA para un pedido que quedo en PENDIENTE y
 * devuelve el `PedidoResponseDTO` con un `urlPago` fresco de Flow.
 *
 * Contraparte de `retryOrderPayment()` en `mobile/utils/orders.ts`. La web no lo
 * usaba: sin esto, un pedido del CARRITO que quedaba pendiente era impagable,
 * porque la idempotencia de `PedidoCheckoutCotizacionSupport` —que si renueva el
 * `urlPago`— cuelga de `conversacion_id` y solo cubre a las cotizaciones.
 *
 * `PedidoPagoSupport.reintentarPago()` responde 409 si el pedido ya no esta
 * PENDIENTE, y tambien si pasaron los 30 minutos de la ventana de pago, en cuyo
 * caso ademas lo cancela y restaura el stock. Ese mensaje viene del backend y hay
 * que mostrarlo tal cual: explica que el pedido quedo cancelado.
 */
export async function retryOrderPaymentApi(usuarioId, orderId) {
  return fetchApi(`/usuarios/${usuarioId}/pedidos/${orderId}/reintentar-pago`, { method: 'POST' });
}

/**
 * Fuerza la confirmacion del pago contra la pasarela y devuelve el pedido ya
 * actualizado.
 *
 * En el movil esto se llama en un sondeo de 60 intentos cada 2s porque Flow se
 * abre en un navegador incrustado y la pantalla nunca se destruye. En la web la
 * pagina se va entera a Flow y vuelve a `?status=...&orderId=...`, asi que basta
 * UNA llamada al volver: el sondeo no tendria donde correr.
 */
export async function confirmOrderPaymentApi(usuarioId, orderId) {
  return fetchApi(`/usuarios/${usuarioId}/pedidos/${orderId}/confirmar-pago`, { method: 'POST' });
}

export async function getSellerOrdersApi(proveedorId, { signal } = {}) {
  // Igual que mobile: el backend pagina este historial y permite hasta 100 filas.
  // Se carga el lote máximo para que búsqueda y filtros operen sobre el historial visible completo.
  return fetchApi(`/proveedores/${proveedorId}/pedidos?size=100`, { method: 'GET', signal });
}

export async function getFavoritesApi(usuarioId, { signal } = {}) {
  return fetchApi(`/usuarios/${usuarioId}/favoritos`, { method: 'GET', signal });
}

/**
 * Local Storage Key for Address Fallback
 */
function getLocalAddressKey(usuarioId) {
  return `repuestop_user_addresses_${usuarioId || 'guest'}`;
}

function getLocalAddresses(usuarioId) {
  try {
    const raw = localStorage.getItem(getLocalAddressKey(usuarioId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAddresses(usuarioId, items) {
  try {
    localStorage.setItem(getLocalAddressKey(usuarioId), JSON.stringify(items));
  } catch {
    // ignore
  }
}

function getAddressTypeMap(usuarioId) {
  try {
    const raw = localStorage.getItem(`repuestop_address_type_map_${usuarioId || 'guest'}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAddressTypeMeta(usuarioId, addressId, streetName, tipo) {
  if (!tipo) return;
  try {
    const map = getAddressTypeMap(usuarioId);
    if (addressId) map[String(addressId)] = tipo;
    if (streetName) map[String(streetName).trim().toLowerCase()] = tipo;
    localStorage.setItem(`repuestop_address_type_map_${usuarioId || 'guest'}`, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function resolveAddressType(usuarioId, address) {
  if (!address) return 'PERSONAL';
  if (address.tipoDireccion) return address.tipoDireccion;
  if (address.tipo) return address.tipo;
  const map = getAddressTypeMap(usuarioId);
  if (address.id && map[String(address.id)]) return map[String(address.id)];
  if (address.calleYNumero && map[String(address.calleYNumero).trim().toLowerCase()]) {
    return map[String(address.calleYNumero).trim().toLowerCase()];
  }
  return 'PERSONAL';
}

/**
 * Direcciones guardadas del comprador (agregar/editar/eliminar/marcar principal).
 */
export async function getAddressesApi(usuarioId, options = {}) {
  if (!usuarioId) return getLocalAddresses(usuarioId).map((item) => ({ ...item, tipoDireccion: resolveAddressType(usuarioId, item) }));
  try {
    const data = await fetchApi(`/usuarios/${usuarioId}/direcciones`, { method: 'GET', ...options });
    const serverItems = Array.isArray(data) ? data : [];
    const localItems = getLocalAddresses(usuarioId);
    const combined = serverItems.map((srv) => {
      const locMatch = localItems.find((loc) => String(loc.id) === String(srv.id));
      const resolved = resolveAddressType(usuarioId, srv) || locMatch?.tipoDireccion || 'PERSONAL';
      return {
        ...srv,
        tipoDireccion: resolved
      };
    });
    localItems.forEach((loc) => {
      if (!combined.some((srv) => String(srv.id) === String(loc.id))) {
        combined.push({
          ...loc,
          tipoDireccion: resolveAddressType(usuarioId, loc)
        });
      }
    });
    return combined;
  } catch (err) {
    if (err.status === 404 || err.status === 0 || err.status === 500) {
      return getLocalAddresses(usuarioId).map((item) => ({ ...item, tipoDireccion: resolveAddressType(usuarioId, item) }));
    }
    throw err;
  }
}

export async function createAddressApi(usuarioId, payload, options = {}) {
  if (payload?.tipoDireccion) {
    saveAddressTypeMeta(usuarioId, null, payload.calleYNumero, payload.tipoDireccion);
  }
  try {
    const res = await fetchApi(`/usuarios/${usuarioId}/direcciones`, { method: 'POST', body: JSON.stringify(payload), ...options });
    const tipo = payload?.tipoDireccion || res?.tipoDireccion || res?.tipo || 'PERSONAL';
    const newAddress = {
      ...(res || {}),
      tipoDireccion: tipo
    };
    if (newAddress.id) {
      saveAddressTypeMeta(usuarioId, newAddress.id, payload.calleYNumero, tipo);
    }
    return newAddress;
  } catch (err) {
    if (err.status === 404 || err.status === 0 || err.status === 500) {
      const local = getLocalAddresses(usuarioId);
      const isFirst = local.length === 0;
      const tipo = payload?.tipoDireccion || 'PERSONAL';
      const newAddress = {
        id: `addr_${Date.now()}`,
        usuarioId: Number(usuarioId),
        comunaId: payload.comunaId,
        comunaNombre: payload.comunaNombre || 'Comuna',
        regionNombre: payload.regionNombre || '',
        calleYNumero: payload.calleYNumero,
        codigoPostal: payload.codigoPostal || null,
        tipoDireccion: tipo,
        esPrincipal: isFirst,
        createdAt: new Date().toISOString()
      };
      saveAddressTypeMeta(usuarioId, newAddress.id, payload.calleYNumero, tipo);
      local.push(newAddress);
      saveLocalAddresses(usuarioId, local);
      return newAddress;
    }
    throw err;
  }
}

export async function updateAddressApi(usuarioId, direccionId, payload, options = {}) {
  if (payload?.tipoDireccion) {
    saveAddressTypeMeta(usuarioId, direccionId, payload.calleYNumero, payload.tipoDireccion);
  }
  try {
    const res = await fetchApi(`/usuarios/${usuarioId}/direcciones/${direccionId}`, { method: 'PUT', body: JSON.stringify(payload), ...options });
    const tipo = payload?.tipoDireccion || res?.tipoDireccion || res?.tipo || 'PERSONAL';
    saveAddressTypeMeta(usuarioId, direccionId, payload.calleYNumero, tipo);
    const updatedAddress = {
      ...(res || {}),
      tipoDireccion: tipo
    };
    let local = getLocalAddresses(usuarioId);
    local = local.map((item) => String(item.id) === String(direccionId) ? { ...item, ...updatedAddress } : item);
    saveLocalAddresses(usuarioId, local);
    return updatedAddress;
  } catch (err) {
    if (err.status === 404 || err.status === 0 || err.status === 500) {
      let local = getLocalAddresses(usuarioId);
      const tipo = payload?.tipoDireccion || 'PERSONAL';
      saveAddressTypeMeta(usuarioId, direccionId, payload.calleYNumero, tipo);
      local = local.map((item) => {
        if (String(item.id) === String(direccionId)) {
          return {
            ...item,
            comunaId: payload.comunaId || item.comunaId,
            comunaNombre: payload.comunaNombre || item.comunaNombre,
            regionNombre: payload.regionNombre || item.regionNombre,
            calleYNumero: payload.calleYNumero || item.calleYNumero,
            codigoPostal: payload.codigoPostal !== undefined ? payload.codigoPostal : item.codigoPostal,
            tipoDireccion: tipo
          };
        }
        return item;
      });
      saveLocalAddresses(usuarioId, local);
      return local.find((item) => String(item.id) === String(direccionId));
    }
    throw err;
  }
}

export async function deleteAddressApi(usuarioId, direccionId, options = {}) {
  try {
    const result = await fetchApi(`/usuarios/${usuarioId}/direcciones/${direccionId}`, { method: 'DELETE', ...options });
    const local = getLocalAddresses(usuarioId).filter((item) => String(item.id) !== String(direccionId));
    saveLocalAddresses(usuarioId, local);
    return result;
  } catch (err) {
    if (err.status === 404 || err.status === 0 || err.status === 500) {
      let local = getLocalAddresses(usuarioId);
      local = local.filter((item) => String(item.id) !== String(direccionId));
      if (local.length > 0 && !local.some((item) => item.esPrincipal)) {
        local[0].esPrincipal = true;
      }
      saveLocalAddresses(usuarioId, local);
      return { success: true };
    }
    throw err;
  }
}

export async function setDefaultAddressApi(usuarioId, direccionId, options = {}) {
  try {
    return await fetchApi(`/usuarios/${usuarioId}/direcciones/${direccionId}/principal`, { method: 'PATCH', ...options });
  } catch (err) {
    if (err.status === 404 || err.status === 0 || err.status === 500) {
      let local = getLocalAddresses(usuarioId);
      local = local.map((item) => ({
        ...item,
        esPrincipal: String(item.id) === String(direccionId)
      }));
      saveLocalAddresses(usuarioId, local);
      return { success: true };
    }
    throw err;
  }
}

/**
 * Sugerencias de direccion para autocompletar (Photon / OpenStreetMap por detras,
 * cacheado en el backend). Endpoint publico: tambien sirve sin sesion iniciada.
 * Devuelve `{ direccion, comuna, region, latitud, longitud }`.
 */
export async function getDireccionSugerenciasApi(texto, { comuna, region, signal } = {}) {
  const params = new URLSearchParams({ texto });
  if (comuna) params.set('comuna', comuna);
  if (region) params.set('region', region);
  return fetchApi(`/ubicaciones/direcciones?${params.toString()}`, { method: 'GET', signal });
}

export async function getPaisesApi(options = {}) {
  return fetchApi('/geografia/paises', { method: 'GET', ...options });
}

export async function getRegionesApi(paisId, options = {}) {
  return fetchApi(`/geografia/paises/${encodeURIComponent(paisId)}/regiones`, { method: 'GET', ...options });
}

export async function getComunasApi(regionId, options = {}) {
  return fetchApi(`/geografia/regiones/${encodeURIComponent(regionId)}/comunas`, { method: 'GET', ...options });
}

/**
 * Checkout del carrito: crea el pedido a partir de la dirección elegida por
 * el comprador (o la principal si no se especifica ninguna).
 */
export async function checkoutCartApi(usuarioId, payload) {
  return fetchApi(`/usuarios/${usuarioId}/pedidos/checkout`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function getCartApi(usuarioId) {
  return fetchApi(`/usuarios/${usuarioId}/carrito`, { method: 'GET' });
}

export async function addCartItemApi(usuarioId, payload) {
  return fetchApi(`/usuarios/${usuarioId}/carrito/items`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function removeCartItemApi(usuarioId, itemId) {
  return fetchApi(`/usuarios/${usuarioId}/carrito/items/${itemId}`, { method: 'DELETE' });
}

export async function updateCartItemApi(usuarioId, itemId, payload) {
  return fetchApi(`/usuarios/${usuarioId}/carrito/items/${itemId}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function getSellerInventoryApi(proveedorId, { page = 0, size = 12, texto, signal } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (texto) params.set('texto', texto);
  return fetchApi(`/proveedores/${proveedorId}/inventario?${params.toString()}`, { method: 'GET', signal });
}

export async function getSellerInventorySummaryApi(proveedorId, { signal } = {}) {
  return fetchApi(`/proveedores/${proveedorId}/inventario/resumen`, { method: 'GET', signal });
}

export async function updateSellerProductTopApi(proveedorId, productId, destacado) {
  return fetchApi(`/proveedores/${proveedorId}/inventario/${productId}/top`, {
    method: 'PATCH',
    body: JSON.stringify({ destacado: Boolean(destacado) }),
  });
}

export async function getSellerConversationsApi(proveedorId, { signal } = {}) {
  try {
    const res = await fetchApi(`/proveedores/${proveedorId}/conversaciones`, { method: 'GET', signal });
    return Array.isArray(res) ? res : (res?.content || []);
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

export async function getBuyerConversationsApi(usuarioId, { signal } = {}) {
  try {
    const res = await fetchApi(`/usuarios/${usuarioId}/conversaciones`, { method: 'GET', signal });
    return Array.isArray(res) ? res : (res?.content || []);
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

/**
 * Sin `forceNew`, el backend REUTILIZA la conversacion ABIERTA que ya exista para ese
 * producto (`crearOObtenerConversacion`). Eso esta bien mientras la cotizacion siga
 * viva, pero deja al comprador atrapado cuando vencio: pedia una nueva y le devolvian
 * el hilo viejo. La condicion la decide quien llama, que es el unico que sabe si la
 * oferta anterior sigue vigente.
 */
export async function createConversationApi(proveedorId, productoId, { forceNew = false } = {}) {
  return fetchApi('/conversaciones', {
    method: 'POST',
    body: JSON.stringify({
      proveedorId: Number(proveedorId),
      productoId: Number(productoId),
      forceNew: Boolean(forceNew),
    }),
  });
}

export async function getConversationMessagesApi(conversationId) {
  return fetchApi(`/conversaciones/${conversationId}/mensajes`, { method: 'GET' });
}

export async function sendConversationMessageApi(conversationId, texto) {
  return fetchApi(`/conversaciones/${conversationId}/mensajes`, {
    method: 'POST',
    body: JSON.stringify({ texto }),
  });
}

export async function saveConversationQuoteApi(conversationId, payload) {
  return fetchApi(`/conversaciones/${conversationId}/cotizacion`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getConversationQuoteApi(conversationId) {
  const result = await fetchApi(`/conversaciones/${conversationId}/cotizacion`, { method: 'GET' });
  return result && typeof result === 'object' ? result : null;
}

export async function markConversationReadApi(conversationId) {
  return fetchApi(`/conversaciones/${conversationId}/leidos`, { method: 'PUT' });
}

export async function checkoutConversationQuoteApi(usuarioId, payload) {
  return fetchApi(`/usuarios/${usuarioId}/pedidos/cotizacion/checkout`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Preguntas públicas asociadas a productos del catálogo del vendedor.
export async function getSellerProductQuestionsApi(proveedorId, { signal } = {}) {
  try {
    const res = await fetchApi(`/proveedores/${proveedorId}/preguntas-productos`, { method: 'GET', signal });
    return Array.isArray(res) ? res : (res?.content || []);
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

export async function getProductQuestionsApi(productoId, { signal } = {}) {
  return fetchApi(`/inventario/productos/${productoId}/preguntas`, { method: 'GET', signal });
}

export async function createProductQuestionApi(productoId, question) {
  return fetchApi(`/inventario/productos/${productoId}/preguntas`, {
    method: 'POST',
    body: JSON.stringify(question),
  });
}

export async function getSellerStoreApi(proveedorId, { signal } = {}) {
  try {
    return await fetchApi(`/proveedores/${proveedorId}/tienda`, { method: 'GET', signal });
  } catch (err) {
    if (err.status === 404 || err.status === 0 || err.status === 500) {
      try {
        return await fetchApi(`/tiendas/${proveedorId}`, { method: 'GET', signal });
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Fondos de pedidos finalizados que todavía no han sido incluidos en un retiro. */
export async function getSellerPendingWithdrawalsApi(proveedorId) {
  try {
    return await fetchApi(`/proveedores/${proveedorId}/retiros/pendientes`, { method: 'GET' });
  } catch (err) {
    return { acumuladoActual: 0, disponibleRetiro: 0, pendientesLiquidacion: 0, items: [] };
  }
}

export async function getSellerWithdrawalsApi(proveedorId) {
  try {
    const res = await fetchApi(`/proveedores/${proveedorId}/retiros`, { method: 'GET' });
    return Array.isArray(res) ? res : (res?.content || []);
  } catch (err) {
    return [];
  }
}

export async function getSellerWithdrawalDetailApi(proveedorId, retiroId) {
  return fetchApi(`/proveedores/${proveedorId}/retiros/${retiroId}`, { method: 'GET' });
}

export async function createSellerWithdrawalApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/retiros`, { method: 'POST' });
}

export async function getSellerBankAccountApi(proveedorId) {
  try {
    return await fetchApi(`/proveedores/${proveedorId}/cuenta-bancaria`, { method: 'GET' });
  } catch (err) {
    return null;
  }
}

export async function updateSellerBankAccountApi(proveedorId, payload) {
  return fetchApi(`/proveedores/${proveedorId}/cuenta-bancaria`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// El backend expone PUT /pedidos/{pedidoId}/estado (PedidoController). Con PATCH
// responde 405. El `pin` es opcional y solo lo exigen algunas transiciones de estado.
export async function updateOrderStatusApi(orderId, estado, pin) {
  return fetchApi(`/pedidos/${orderId}/estado`, {
    method: 'PUT',
    body: JSON.stringify(pin ? { estado, pin } : { estado }),
  });
}

/**
 * Cancelación del pedido por parte de la tienda vendedora.
 * Requiere un código de motivo formal (`MotivoCancelacionPedido`).
 */
export async function cancelSellerOrderApi(proveedorId, orderId, { reasonCode, reasonDetail } = {}) {
  return fetchApi(`/proveedores/${proveedorId}/pedidos/${orderId}/cancelacion`, {
    method: 'POST',
    body: JSON.stringify({
      reasonCode: String(reasonCode || 'OTRO').toUpperCase(),
      reasonDetail: reasonDetail ? String(reasonDetail).trim() : null,
    }),
  });
}

/**
 * Registra el despacho del pedido por courier con número de seguimiento y comprobante opcional.
 */
export async function registerOrderDispatchApi(orderId, { courier, trackingNumber, valorEnvio, comprobante } = {}) {
  const formData = new FormData();
  formData.append('courier', String(courier || '').trim());
  formData.append('trackingNumber', String(trackingNumber || '').trim());
  if (valorEnvio !== undefined && valorEnvio !== null && valorEnvio !== '') {
    formData.append('valorEnvio', String(valorEnvio));
  }
  if (comprobante instanceof File || comprobante instanceof Blob) {
    formData.append('comprobante', comprobante);
  }
  return fetchApi(`/pedidos/${orderId}/envio`, {
    method: 'POST',
    body: formData,
  });
}

/**
 * Marketplace Endpoints (Unificados con Spring Boot Backend)
 */

export async function getPublicStoresApi({ page = 0, size = 12, texto, comuna, signal } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (texto) params.set('texto', texto);
  if (comuna) params.set('comuna', comuna);
  return fetchApi(`/tiendas/publicas?${params.toString()}`, { method: 'GET', signal });
}

export async function getStoreProfileApi(storeId) {
  return fetchApi(`/tiendas/${storeId}`, { method: 'GET' });
}

export async function getStoreProductsApi(storeId, { page = 0, size = 12, texto, categoriaId } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (texto) params.set('texto', texto);
  if (categoriaId) params.set('categoriaId', String(categoriaId));
  return fetchApi(`/tiendas/${storeId}/productos?${params.toString()}`, { method: 'GET' });
}

export async function getPublicProductsApi({ page = 0, size = 12, texto, patente, soloCotizacion, categoriaId, subcategoriaId, marcaId, precioMin, precioMax, comunaId, sort = 'precio,asc', signal } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size), sort });
  if (texto) params.set('texto', texto);
  if (patente) params.set('patente', patente);
  if (soloCotizacion !== undefined) params.set('soloCotizacion', String(soloCotizacion));
  if (categoriaId) params.set('categoriaId', String(categoriaId));
  if (subcategoriaId) params.set('subcategoriaId', String(subcategoriaId));
  if (marcaId) params.set('marcaId', String(marcaId));
  if (precioMin) params.set('precioMin', String(precioMin));
  if (precioMax) params.set('precioMax', String(precioMax));
  if (comunaId) params.set('comunaId', String(comunaId));
  return fetchApi(`/inventario/productos?${params.toString()}`, { method: 'GET', signal });
}

/**
 * Ficha pública de un producto. Se usa al entrar por URL directa
 * (`/repuestos/{id}-{slug}`), cuando no venimos navegando desde el catálogo.
 * Si el backend aún no expone el detalle unitario, el llamador cae al listado.
 */
export async function getPublicProductApi(productId, { signal } = {}) {
  return fetchApi(`/inventario/productos/${productId}`, { method: 'GET', signal });
}

export async function getPublicCategoryCountsApi() {
  return fetchApi('/inventario/productos/resumen-categorias', { method: 'GET' });
}

export async function getPartCategoriesApi() {
  return fetchApi('/catalogos/inventario/categorias-repuesto', { method: 'GET' });
}

export async function getPartBrandsApi(categoria) {
  const query = categoria ? `?categoria=${encodeURIComponent(categoria)}` : '';
  return fetchApi(`/catalogos/inventario/marcas-repuesto${query}`, { method: 'GET' });
}

export async function getPartSubcategoriesApi(categoriaId) {
  return fetchApi(`/catalogos/inventario/categorias-repuesto/${categoriaId}/subcategorias`, { method: 'GET' });
}

export async function getVehicleModelsApi(marcaId) {
  return fetchApi(`/catalogos/inventario/marcas-vehiculo/${marcaId}/modelos`, { method: 'GET' });
}

export async function getVehicleVersionsApi({ marca, modelo, anioDesde, anioHasta }) {
  const params = new URLSearchParams({ marca, modelo });
  if (anioDesde) params.set('anioDesde', String(anioDesde));
  if (anioHasta) params.set('anioHasta', String(anioHasta));
  return fetchApi(`/catalogos/inventario/versiones?${params.toString()}`, { method: 'GET' });
}

/** Crea un producto personalizado mediante el mismo flujo multipart del panel de inventario. */
export async function createSellerInventoryProductApi(proveedorId, formData) {
  return fetchApi(`/proveedores/${proveedorId}/inventario/personalizado`, {
    method: 'POST',
    body: formData,
  });
}

/** Edita un producto personalizado, manteniendo las imágenes actuales si no se adjuntan nuevas. */
export async function updateSellerInventoryProductApi(proveedorId, productId, formData) {
  return fetchApi(`/proveedores/${proveedorId}/inventario/${productId}/editar`, {
    method: 'POST',
    body: formData,
  });
}

/** Marcas de vehículo disponibles para declarar la especialidad de una tienda. */
export async function getVehicleBrandsApi({ signal } = {}) {
  return fetchApi('/catalogos/inventario/marcas-vehiculo', { method: 'GET', signal });
}

/** Reemplaza las marcas especialistas de la tienda autenticada. */
export async function updateStoreSpecialistBrandsApi(sellerId, marcaIds) {
  return fetchApi(`/proveedores/${sellerId}/marcas-especialistas`, {
    method: 'PUT',
    body: JSON.stringify({ marcaIds }),
  });
}

export async function sendDirectQuotationApi(quoteData) {
  return fetchApi('/cotizaciones/directa', {
    method: 'POST',
    body: JSON.stringify(quoteData),
  });
}

/**
 * Identificación por patente. El backend exige sesión en este endpoint porque cada
 * consulta no cacheada golpea una API externa facturada (ver SecurityConfig), así que
 * el 401 se traduce a un mensaje accionable en vez de "no autorizado".
 */
export async function searchVehicleByPatenteApi(patente) {
  try {
    return await fetchApi(`/vehiculos/patente/${encodeURIComponent(patente)}`, { method: 'GET' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(
        'Inicia sesión para identificar tu vehículo por patente.',
        401,
        error.data
      );
    }
    throw error;
  }
}

// Soporte y notificaciones del usuario autenticado.
export async function getMySupportTicketsApi(userId) {
  return fetchApi(`/support/tickets/mine/${userId}`, { method: 'GET' });
}

export async function getSupportTicketDetailApi(userId, ticketId) {
  return fetchApi(`/support/tickets/mine/${userId}/${ticketId}`, { method: 'GET' });
}

export async function getSupportTicketMessagesApi(userId, ticketId) {
  return fetchApi(`/support/tickets/mine/${userId}/${ticketId}/messages`, { method: 'GET' });
}

export async function sendSupportTicketMessageApi(userId, ticketId, { mensaje, autorNombre } = {}) {
  return fetchApi(`/support/tickets/mine/${userId}/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      autorTipo: 'USUARIO',
      autorNombre: autorNombre || 'Usuario',
      mensaje: String(mensaje || '').trim(),
    }),
  });
}

export async function closeSupportTicketApi(userId, ticketId) {
  return fetchApi(`/support/tickets/mine/${userId}/${ticketId}/close`, { method: 'PUT' });
}

export async function markSupportTicketReadApi(userId, ticketId) {
  return fetchApi(`/support/tickets/mine/${userId}/${ticketId}/read`, { method: 'PUT' });
}

export async function createSupportTicketApi(ticket) {
  return fetchApi('/support/tickets', {
    method: 'POST',
    body: JSON.stringify(ticket),
  });
}

export async function createOrderClaimApi(userId, orderId, claim) {
  return fetchApi(`/usuarios/${userId}/pedidos/${orderId}/reclamo`, {
    method: 'POST',
    body: JSON.stringify(claim),
  });
}

/** Califica los productos y la atención del vendedor para un pedido entregado/finalizado. */
export async function rateOrderApi(userId, orderId, items) {
  return fetchApi(`/usuarios/${userId}/pedidos/${orderId}/calificaciones`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

// Reportes y disputas reales del usuario (antes se adivinaban filtrando texto
// libre de los tickets de soporte / el estado del pedido; ver ProfileSupportPanel).
export async function getMyReportsApi(userId) {
  return fetchApi(`/usuarios/${userId}/reportes/mios`, { method: 'GET' });
}

/** Crea un reporte contextual (pedido, producto, tienda o usuario). */
export async function createContextualReportApi(userId, { tipoObjeto, objetoId, motivo, descripcion }) {
  return fetchApi(`/usuarios/${userId}/reportes`, {
    method: 'POST',
    body: JSON.stringify({ tipoObjeto, objetoId: Number(objetoId), motivo, descripcion }),
  });
}

export async function getMyMediationsApi(userId) {
  return fetchApi(`/usuarios/${userId}/mediaciones/mias`, { method: 'GET' });
}

/** Reporta a la otra persona de una conversación (chat de cotización). */
export async function reportConversationApi(conversacionId, { motivo, descripcion }) {
  return fetchApi(`/conversaciones/${conversacionId}/reportar`, {
    method: 'POST',
    body: JSON.stringify({ motivo, descripcion }),
  });
}

// Chat de mediación de un pedido (Fase 6a): reusa el mismo endpoint que ya
// consume la app móvil, no hay nada nuevo del lado del backend.
export async function getMediationChatApi(pedidoId) {
  return fetchApi(`/pedidos/${pedidoId}/mediacion-chat`, { method: 'GET' });
}

/** Sube una imagen al chat peer-to-peer de la mediación. */
export async function uploadMediationChatImageApi(conversacionId, file) {
  const formData = new FormData();
  formData.append('imagen', file);
  return fetchApi(`/conversaciones/${conversacionId}/mediacion-imagenes`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
}

export async function escalateMediationApi(pedidoId, { motivo, descripcion, imagenes }) {
  const formData = new FormData();
  formData.append('motivo', motivo);
  formData.append('descripcion', descripcion);
  (imagenes || []).forEach((file) => formData.append('imagenes', file));
  // Timeout mas largo que el default de fetchApi (15s): son varias imagenes.
  return fetchApi(`/pedidos/${pedidoId}/mediacion-escalar`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
}

export async function resolveMediationApi(pedidoId, { motivoResolucion, evidencias }) {
  const formData = new FormData();
  formData.append('motivoResolucion', motivoResolucion);
  (evidencias || []).forEach((file) => formData.append('evidencias', file));
  return fetchApi(`/pedidos/${pedidoId}/mediacion-resolver`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
}

// Hilo con el mediador de RepuesTop. No tiene GET propio: se lee desde
// getMediationChatApi (`mensajesMediadorComprador` / `mensajesMediadorVendedor`
// segun el rol). El backend recibe `mensaje` como @RequestParam, asi que va
// como FormData igual que el resto de los endpoints de mediacion.
export async function sendMediatorMessageApi(pedidoId, mensaje) {
  const formData = new FormData();
  formData.append('mensaje', mensaje);
  return fetchApi(`/pedidos/${pedidoId}/mediacion-mensajes`, {
    method: 'POST',
    body: formData,
  });
}

/** Aporta evidencia al expediente durante la mediacion (endpoint aparte del mensaje). */
export async function uploadMediationEvidenceApi(pedidoId, imagenes) {
  const formData = new FormData();
  (imagenes || []).forEach((file) => formData.append('imagenes', file));
  return fetchApi(`/pedidos/${pedidoId}/mediacion-evidencias`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
}

export async function getNotificationsApi(userId) {
  return fetchApi(`/usuarios/${userId}/notificaciones`, { method: 'GET' });
}

export async function getUnreadNotificationsCountApi(userId) {
  return fetchApi(`/usuarios/${userId}/notificaciones/unread-count`, { method: 'GET' });
}

export async function markNotificationReadApi(userId, notificationId) {
  return fetchApi(`/usuarios/${userId}/notificaciones/${notificationId}/leida`, { method: 'PUT' });
}

export async function markAllNotificationsReadApi(userId) {
  return fetchApi(`/usuarios/${userId}/notificaciones/leidas`, { method: 'PUT' });
}

export async function deleteReadNotificationsApi(userId) {
  return fetchApi(`/usuarios/${userId}/notificaciones/leidas`, { method: 'DELETE' });
}

// -------------------------------------------------------------
// MURAL DE ANUNCIOS
// -------------------------------------------------------------

/**
 * Mural publico. El backend ya filtra por activo + APROBADO + no expirado
 * (`AnuncioService.listarPublicos()`), asi que devuelve solo lo visible.
 * No pagina: `AnuncioController` responde la lista completa.
 */
export async function getPublicAdsApi({ signal } = {}) {
  return fetchApi('/anuncios', { method: 'GET', signal });
}

/** Ficha publica de un anuncio. Da 404 si esta pendiente, rechazado o vencido. */
export async function getPublicAdApi(adId, { signal } = {}) {
  return fetchApi(`/anuncios/${adId}`, { method: 'GET', signal });
}

/**
 * Anuncios de la sesion, en cualquier estado de moderacion (PENDIENTE, APROBADO
 * o RECHAZADO) y tambien los vencidos. Es la unica lectura que ve un anuncio que
 * todavia no esta publicado: `GET /anuncios` solo devuelve lo aprobado y vigente.
 */
export async function getMyAdsApi({ signal } = {}) {
  return fetchApi('/anuncios/mios', { method: 'GET', signal });
}

/**
 * Publica un anuncio. Nace `PENDIENTE` y con `activo=false`
 * (`AnuncioService.crear()`): no aparece en el mural hasta que moderacion lo aprueba.
 */
export async function createAdApi(payload) {
  return fetchApi('/anuncios', { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * Reemplaza TODOS los campos del anuncio: `AnuncioService.aplicar()` escribe cada
 * uno, asi que lo que no venga en el payload se pierde (las historias, la agenda
 * y las fotos incluidas). Hay que mandar el anuncio completo, no solo lo editado.
 *
 * Ademas devuelve el anuncio a `PENDIENTE` y lo deja `activo=false`, o sea que lo
 * saca del mural hasta que lo re-aprueben. La UI tiene que advertirlo antes.
 */
export async function updateAdApi(adId, payload) {
  return fetchApi(`/anuncios/${adId}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/**
 * Baja logica: el backend solo hace `setActivo(false)` y conserva el
 * `moderationStatus`, asi que el anuncio sigue llegando en `GET /anuncios/mios`.
 * Quien lo consuma tiene que ocultarlo por su cuenta (ver `adsStorage.js`).
 */
export async function deleteAdApi(adId) {
  return fetchApi(`/anuncios/${adId}`, { method: 'DELETE' });
}

/**
 * Sube las fotos del anuncio a la carpeta Publicidad de R2 y devuelve
 * `{ imagenes: [{ key, url }] }` con rutas relativas al proxy del backend.
 * Timeout largo como manda CLAUDE.md: son varias imagenes de hasta 5MB.
 */
export async function uploadAdImagesApi(files) {
  const formData = new FormData();
  (files || []).forEach((file) => formData.append('imagenes', file));
  return fetchApi('/anuncios/imagenes', {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
}

// -------------------------------------------------------------
// AGENDAMIENTO DE ANUNCIOS
// -------------------------------------------------------------

/**
 * Reservas de un anuncio. La respuesta depende de QUIEN pregunta
 * (`AnuncioAgendamientoService.listarPorAnuncio()`):
 *
 * - el dueño del anuncio recibe todas las reservas, de cualquier fecha y estado,
 *   con los datos completos del cliente. Es su agenda.
 * - cualquier otra sesion recibe solo las futuras en `pending` o `accepted`, y
 *   con los datos del cliente CENSURADOS (nombre, telefono, correo y patente
 *   vienen vacios o en null). Sirve para saber que bloques estan tomados sin
 *   exponer a quien reservo.
 *
 * O sea que el modal de reserva usa esta misma ruta para tachar los horarios
 * ocupados: no hace falta un endpoint de disponibilidad aparte.
 */
export async function getAdAppointmentsApi(adId, { signal } = {}) {
  return fetchApi(`/anuncios/agendamientos/anuncios/${adId}`, { method: 'GET', signal });
}

/**
 * Reservas relevantes para la sesion: `findRelevantes()` trae tanto las que uno
 * pidio como cliente como las que le hicieron a sus anuncios, en una sola lista.
 * Se separan por `adId` contra los anuncios propios, no por un campo del DTO.
 */
export async function getMyAppointmentsApi({ signal } = {}) {
  return fetchApi('/anuncios/agendamientos/mias', { method: 'GET', signal });
}

/**
 * Reserva una hora. Exige sesion iniciada y falla con 400 si el anuncio no tiene
 * las reservas encendidas, si esta vencido, si el bloque no pertenece al horario
 * publicado, si ya paso, o si es tu propio anuncio.
 *
 * `customerEmail` viaja porque el DTO lo exige (`@NotBlank @Email`), pero el
 * backend lo IGNORA: guarda siempre el correo de la sesion. No sirve para
 * reservar a nombre de otro.
 *
 * Un 409 (`DuplicateResourceException`) significa que alguien tomo ese bloque
 * mientras se llenaba el formulario; hay que recargar la disponibilidad.
 */
export async function createAdAppointmentApi(adId, payload) {
  return fetchApi(`/anuncios/agendamientos/anuncios/${adId}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Responde o cancela una reserva. Quien puede hacer que esta partido:
 * `accepted` y `rejected` solo el dueño del anuncio, y solo mientras siga
 * `pending`; `cancelled` solo el cliente, y solo si todavia no se cerro.
 * Cualquier otra combinacion responde 403.
 */
export async function updateAdAppointmentStatusApi(appointmentId, status) {
  return fetchApi(`/anuncios/agendamientos/${appointmentId}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

/**
 * Manda el resumen de la cita por correo al cliente y al taller. Es solo el
 * despacho del mail: la reserva ya quedo guardada por el POST.
 * `AgendamientoNotificacionService` lo envia con `enviarSeguro()`, asi que un
 * fallo de correo no revienta la respuesta.
 */
export async function sendAppointmentSummaryEmailsApi(payload) {
  return fetchApi('/anuncios/agendamientos/notificaciones', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/** Crea una notificacion in-app para un usuario. Responde 204 sin cuerpo. */
export async function createUserNotificationApi(userId, payload) {
  return fetchApi(`/usuarios/${userId}/notificaciones`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Igual que la anterior pero apuntando a un proveedor: el backend la entrega al
 * usuario dueño de ese proveedor (`NotificationController.crearParaProveedor()`).
 */
export async function createProviderNotificationApi(proveedorId, payload) {
  return fetchApi(`/proveedores/${proveedorId}/notificaciones`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// -------------------------------------------------------------
// MONEDERO DE FICHAS
// -------------------------------------------------------------

/**
 * Saldo del monedero. El backend lo calcula sumando `RT_movimiento_ficha`, no lo
 * guarda en una columna, asi que no hay dos numeros que puedan discrepar.
 *
 * Devuelve tambien `costosPorTier`: el tarifario de publicacion. Mientras la web
 * lo replique a mano en `UPGRADE_TOKEN_COSTS`, cambiar un precio obliga a
 * desplegar las tres plataformas a la vez.
 *
 * Ojo: esta llamada puede ESCRIBIR. La primera vez que una cuenta consulta su
 * monedero, el backend le otorga el bono de bienvenida (idempotente por
 * `event_key`, o sea que solo pasa una vez).
 */
export async function getFichasBalanceApi({ signal } = {}) {
  return fetchApi('/fichas/saldo', { method: 'GET', signal });
}

/** Saldo + historial de movimientos, del mas nuevo al mas viejo. */
export async function getFichasMovimientosApi({ signal } = {}) {
  return fetchApi('/fichas/movimientos', { method: 'GET', signal });
}

/**
 * Informa una compra de monedas ya pagada. El backend la registra para
 * Administracion Contable Y acredita las monedas en el monedero.
 *
 * `referenciaPago` es la llave de idempotencia: si la misma referencia llega dos
 * veces, la compra no se registra ni se acredita de nuevo.
 */
export async function registrarCompraFichasApi(payload) {
  return fetchApi('/fichas/compras', { method: 'POST', body: JSON.stringify(payload) });
}

// -------------------------------------------------------------
// FASE 4: HERRAMIENTAS DE VENDEDOR, INVENTARIO Y VERIFICACIÓN
// -------------------------------------------------------------

/**
 * Responde una pregunta pública realizada sobre un producto del catálogo.
 */
export async function answerProductQuestionApi(productoId, preguntaId, payload) {
  return fetchApi(`/inventario/productos/${productoId}/preguntas/${preguntaId}/respuesta`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Pausa temporalmente un producto del inventario para que no aparezca en búsquedas públicas.
 */
export async function pauseSellerProductApi(proveedorId, productoId) {
  return fetchApi(`/proveedores/${proveedorId}/inventario/${productoId}/pausa`, {
    method: 'POST',
  });
}

/**
 * Retoma o despausa un producto del inventario.
 */
export async function resumeSellerProductApi(proveedorId, productoId) {
  return fetchApi(`/proveedores/${proveedorId}/inventario/${productoId}/retomar`, {
    method: 'POST',
  });
}

// No hay `GET /proveedores/{id}/shipping-methods`: PerfilProveedorController solo expone
// el PUT. Habia un getter apuntando ahi que hubiera dado 405 (no 404, que era lo unico
// que atajaba). Los metodos configurados llegan dentro de `GET /proveedores/{id}/tienda`.

/**
 * Actualiza los métodos de envío que acepta la tienda.
 */
export async function updateSellerShippingMethodsApi(proveedorId, shippingMethods) {
  return fetchApi(`/proveedores/${proveedorId}/shipping-methods`, {
    method: 'PUT',
    body: JSON.stringify({ shippingMethods }),
  });
}

/**
 * Consulta el estado de verificación y revisión documental del proveedor.
 */
export async function getSellerVerificationStatusApi(proveedorId, { signal } = {}) {
  try {
    return await fetchApi(`/proveedores/${proveedorId}/verificacion`, { method: 'GET', signal });
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * Sube documentos de verificación comercial del proveedor (multipart).
 */
export async function submitSellerVerificationApi(proveedorId, formData) {
  return fetchApi(`/proveedores/${proveedorId}/verificacion`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
}

/**
 * Actualiza documentos de verificación en caso de correcciones solicitadas.
 */
export async function updateSellerVerificationApi(proveedorId, formData) {
  return fetchApi(`/proveedores/${proveedorId}/verificacion`, {
    method: 'PUT',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
}

/**
 * Envía una apelación formal ante una verificación rechazada.
 */
export async function appealSellerVerificationApi(proveedorId, apelacion) {
  return fetchApi(`/proveedores/${proveedorId}/verificacion/apelar`, {
    method: 'POST',
    body: JSON.stringify({ apelacion }),
  });
}

/**
 * Registra la aceptación del Contrato de Adhesión del proveedor.
 */
export async function acceptSellerAdhesionApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/adhesion`, {
    method: 'POST',
  });
}

// -------------------------------------------------------------
// FASE 6: CHATS CON IMAGEN
// -------------------------------------------------------------

/**
 * Sube una imagen al chat de conversación / cotización.
 */
export async function uploadConversationImageApi(conversacionId, file, { signal } = {}) {
  const formData = new FormData();
  formData.append('imagen', file);
  return fetchApi(`/conversaciones/${conversacionId}/imagenes`, {
    method: 'POST',
    body: formData,
    signal: signal || AbortSignal.timeout(30000),
  });
}

// -------------------------------------------------------------
// FASE 5: DESCUBRIMIENTO, VEHÍCULOS Y FAVORITOS
// -------------------------------------------------------------

/**
 * Obtiene las preguntas públicas realizadas por el comprador autenticado.
 */
export async function getBuyerProductQuestionsApi({ signal } = {}) {
  try {
    const res = await fetchApi('/usuarios/me/preguntas-productos', { method: 'GET', signal });
    return Array.isArray(res) ? res : (res?.content || []);
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

/**
 * OJO: estas dos funciones TODAVIA NO LAS USA NINGUNA VISTA.
 *
 * Son la mitad de la busqueda por vehiculo (A16 del plan de paridad). En la app, elegir
 * un vehiculo filtra el catalogo, la tienda y el directorio; en la web `activeVehicle`
 * es decorativo (muestra "Compatible con {patente}" y nada mas), y su `catalogoId` se
 * adapta pero no se consume.
 *
 * Quedan escritas a proposito para quien conecte la vista, pero A16 sigue PENDIENTE:
 * que existan aca no significa que la funcion exista para el usuario. Conectarlas
 * implica una segunda fuente de datos en PartsCatalogView, porque
 * `/vehiculos-catalogo/{id}/repuestos` devuelve `RepuestoOfertaPageDTO` con las ofertas
 * anidadas, no el listado plano de `/inventario/productos`.
 */

/**
 * Consulta información detallada de vehículos en catálogo por sus IDs.
 */
export async function getInventoryVehicleCatalogsApi(ids, { signal } = {}) {
  if (!ids || !ids.length) return [];
  const params = new URLSearchParams({ ids: ids.join(',') });
  return fetchApi(`/catalogos/inventario/vehiculo-catalogos?${params.toString()}`, { method: 'GET', signal });
}

/**
 * Retorna las ofertas de repuestos compatibles con un vehiculo_catalogo específico.
 */
export async function getVehicleCatalogPartsApi(catalogoId, { categoriaId, marcaId, precioMin, precioMax, texto, page = 0, size = 20, signal } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (categoriaId) params.set('categoriaId', String(categoriaId));
  if (marcaId) params.set('marcaId', String(marcaId));
  if (precioMin) params.set('precioMin', String(precioMin));
  if (precioMax) params.set('precioMax', String(precioMax));
  if (texto) params.set('texto', texto);
  return fetchApi(`/vehiculos-catalogo/${catalogoId}/repuestos?${params.toString()}`, { method: 'GET', signal });
}

/**
 * Registra o identifica un vehículo ingresado manualmente por el usuario.
 */
export async function createManualVehicleApi(data) {
  return fetchApi('/vehiculos/manual', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Agrega un producto a la lista de favoritos del usuario.
 */
export async function addFavoriteApi(usuarioId, productoId) {
  return fetchApi(`/usuarios/${usuarioId}/favoritos`, {
    method: 'POST',
    body: JSON.stringify({ proveedorProductoId: Number(productoId) }),
  });
}

/**
 * Elimina un producto de la lista de favoritos del usuario por su ID de favorito.
 */
export async function removeFavoriteApi(usuarioId, favoritoId) {
  return fetchApi(`/usuarios/${usuarioId}/favoritos/${favoritoId}`, {
    method: 'DELETE',
  });
}

/**
 * Consulta si un producto específico está en los favoritos del usuario.
 */
export async function checkIsFavoriteApi(usuarioId, productoId, { signal } = {}) {
  try {
    return await fetchApi(`/usuarios/${usuarioId}/favoritos/productos/${productoId}`, { method: 'GET', signal });
  } catch (err) {
    if (err.status === 404) return { esFavorito: false };
    throw err;
  }
}

// -------------------------------------------------------------
// ACREDITACIÓN DE SERVICIO AUTOMOTRIZ
// -------------------------------------------------------------

/**
 * Consulta el expediente de acreditación de servicio de la cuenta autenticada.
 *
 * Es un expediente INDEPENDIENTE de la verificación de la tienda
 * (`getSellerVerificationStatusApi`): aunque el proveedor ya esté verificado,
 * para publicar servicios debe presentar de nuevo los tres documentos.
 * Devuelve `null` cuando todavía no hay solicitud presentada.
 */
export async function getAutomotiveServiceAccreditationApi({ signal } = {}) {
  try {
    return await fetchApi('/automotive-services/me', { method: 'GET', signal });
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * Envía el expediente de acreditación con sus tres documentos (multipart).
 */
export async function submitAutomotiveServiceAccreditationApi(data, files) {
  const formData = new FormData();
  formData.append('data', JSON.stringify({ ...data, canal: 'MARKETPLACE_WEB' }));
  formData.append('identidad', files.identidad);
  formData.append('inicioActividades', files.inicioActividades);
  formData.append('patenteMunicipal', files.patenteMunicipal);
  return fetchApi('/automotive-services/me', {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
}
