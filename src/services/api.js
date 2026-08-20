import { LEGAL_VERSION_CODE } from '../data/legalTexts';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// El backend persiste rutas de R2 como `/api/v1/uploads/...`. En desarrollo el
// marketplace vive en otro origen (Vite), por eso las convertimos en URLs de la
// API antes de entregarlas a un <img>. Las URLs absolutas y data/blob se preservan.
export function resolveMediaUrl(value) {
  if (!value || typeof value !== 'string' || /^(https?:|data:|blob:)/i.test(value)) {
    return value || null;
  }
  const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${apiOrigin}${value.startsWith('/') ? value : `/${value}`}`;
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
  return fetchApi('/auth/register/buyer', {
    method: 'POST',
    body: JSON.stringify({
      email: buyerData.email.trim(),
      password: buyerData.password,
      firstName: buyerData.firstName || partes[0] || '',
      lastName: buyerData.lastName || partes.slice(1).join(' ') || '',
      phone: buyerData.phone || '',
      authProvider: buyerData.authProvider || 'EMAIL_PASSWORD',
      acceptsTerms: buyerData.acceptsTerms === true,
      termsVersion: LEGAL_VERSION_CODE,
      direccion: {
        calleYNumero: buyerData.direccion?.calleYNumero || '',
        comunaId: buyerData.direccion?.comunaId ? Number(buyerData.direccion.comunaId) : null,
        codigoPostal: buyerData.direccion?.codigoPostal || '',
      },
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

export async function createConversationApi(proveedorId, productoId) {
  return fetchApi('/conversaciones', {
    method: 'POST',
    body: JSON.stringify({ proveedorId: Number(proveedorId), productoId: Number(productoId) }),
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

// Reportes y disputas reales del usuario (antes se adivinaban filtrando texto
// libre de los tickets de soporte / el estado del pedido; ver ProfileSupportPanel).
export async function getMyReportsApi(userId) {
  return fetchApi(`/usuarios/${userId}/reportes/mios`, { method: 'GET' });
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
