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
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Generic fetch wrapper for backend endpoints
 */
export async function fetchApi(endpoint, options = {}) {
  const token = localStorage.getItem('repuestop_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
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
    // Network or connection error
    throw new ApiError(
      'No se pudo conectar con el servidor backend. Por favor verifica tu conexión.',
      0
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

export async function registerBuyerApi(buyerData) {
  return fetchApi('/auth/register/buyer', {
    method: 'POST',
    body: JSON.stringify({
      email: buyerData.email.trim(),
      password: buyerData.password,
      userName: buyerData.name || buyerData.userName,
      phone: buyerData.phone || '',
      authProvider: 'EMAIL_PASSWORD',
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
export async function getBuyerOrdersApi(usuarioId) {
  return fetchApi(`/usuarios/${usuarioId}/pedidos`, { method: 'GET' });
}

export async function getSellerOrdersApi(proveedorId) {
  // Igual que mobile: el backend pagina este historial y permite hasta 100 filas.
  // Se carga el lote máximo para que búsqueda y filtros operen sobre el historial visible completo.
  return fetchApi(`/proveedores/${proveedorId}/pedidos?size=100`, { method: 'GET' });
}

export async function getFavoritesApi(usuarioId) {
  return fetchApi(`/usuarios/${usuarioId}/favoritos`, { method: 'GET' });
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
export async function getAddressesApi(usuarioId) {
  if (!usuarioId) return getLocalAddresses(usuarioId).map((item) => ({ ...item, tipoDireccion: resolveAddressType(usuarioId, item) }));
  try {
    const data = await fetchApi(`/usuarios/${usuarioId}/direcciones`, { method: 'GET' })
      .catch(async (err) => {
        if (err.status === 404) {
          return fetchApi(`/users/${usuarioId}/direcciones`, { method: 'GET' });
        }
        throw err;
      });
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

export async function createAddressApi(usuarioId, payload) {
  if (payload?.tipoDireccion) {
    saveAddressTypeMeta(usuarioId, null, payload.calleYNumero, payload.tipoDireccion);
  }
  try {
    const res = await fetchApi(`/usuarios/${usuarioId}/direcciones`, { method: 'POST', body: JSON.stringify(payload) })
      .catch(async (err) => {
        if (err.status === 404) {
          return fetchApi(`/users/${usuarioId}/direcciones`, { method: 'POST', body: JSON.stringify(payload) });
        }
        throw err;
      });
    const tipo = payload?.tipoDireccion || res?.tipoDireccion || res?.tipo || 'PERSONAL';
    const newAddress = {
      ...(res || {}),
      tipoDireccion: tipo
    };
    if (newAddress.id) {
      saveAddressTypeMeta(usuarioId, newAddress.id, payload.calleYNumero, tipo);
    }
    // No se guarda copia en `repuestop_user_addresses_*`: esa cache es solo el
    // respaldo offline (ver el catch de abajo). El backend ya persistió la
    // direccion con id real, así que `getAddressesApi` la trae de ahí en el
    // próximo fetch. Guardarla también acá dejaba un "fantasma" en localStorage
    // que sobrevivía a un DELETE exitoso en el servidor: al recargar, el merge
    // de getAddressesApi la volvía a mostrar como si nunca se hubiese borrado.
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

export async function updateAddressApi(usuarioId, direccionId, payload) {
  if (payload?.tipoDireccion) {
    saveAddressTypeMeta(usuarioId, direccionId, payload.calleYNumero, payload.tipoDireccion);
  }
  try {
    const res = await fetchApi(`/usuarios/${usuarioId}/direcciones/${direccionId}`, { method: 'PUT', body: JSON.stringify(payload) })
      .catch(async (err) => {
        if (err.status === 404) {
          return fetchApi(`/users/${usuarioId}/direcciones/${direccionId}`, { method: 'PUT', body: JSON.stringify(payload) });
        }
        throw err;
      });
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

export async function deleteAddressApi(usuarioId, direccionId) {
  try {
    const result = await fetchApi(`/usuarios/${usuarioId}/direcciones/${direccionId}`, { method: 'DELETE' })
      .catch(async (err) => {
        if (err.status === 404) {
          return fetchApi(`/users/${usuarioId}/direcciones/${direccionId}`, { method: 'DELETE' });
        }
        throw err;
      });
    // Por si quedó una copia "fantasma" en localStorage de antes de este fix
    // (ver comentario en createAddressApi): sin esto, una direccion ya borrada
    // en el servidor reaparecía en la lista porque getAddressesApi la seguía
    // fusionando desde la cache local.
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

export async function setDefaultAddressApi(usuarioId, direccionId) {
  try {
    return await fetchApi(`/usuarios/${usuarioId}/direcciones/${direccionId}/principal`, { method: 'PATCH' })
      .catch(async (err) => {
        if (err.status === 404) {
          return fetchApi(`/users/${usuarioId}/direcciones/${direccionId}/principal`, { method: 'PATCH' });
        }
        throw err;
      });
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

const FALLBACK_PAISES = [{ id: 1, nombre: 'Chile' }];

const FALLBACK_REGIONES = [
  { id: 13, nombre: 'Región Metropolitana de Santiago' },
  { id: 5, nombre: 'Valparaíso' },
  { id: 8, nombre: 'Bío Bío' },
  { id: 1, nombre: 'Tarapacá' },
  { id: 2, nombre: 'Antofagasta' },
  { id: 3, nombre: 'Atacama' },
  { id: 4, nombre: 'Coquimbo' },
  { id: 6, nombre: "O'Higgins" },
  { id: 7, nombre: 'Maule' },
  { id: 9, nombre: 'La Araucanía' },
  { id: 10, nombre: 'Los Lagos' },
  { id: 11, nombre: 'Aysén' },
  { id: 12, nombre: 'Magallanes' },
  { id: 14, nombre: 'Los Ríos' },
  { id: 15, nombre: 'Arica y Parinacota' },
  { id: 16, nombre: 'Ñuble' }
];

const FALLBACK_COMUNAS = [
  { id: 101, nombre: 'Santiago' }, { id: 102, nombre: 'Providencia' }, { id: 103, nombre: 'Las Condes' },
  { id: 104, nombre: 'Ñuñoa' }, { id: 105, nombre: 'Vitacura' }, { id: 106, nombre: 'Lo Barnechea' },
  { id: 107, nombre: 'Maipú' }, { id: 108, nombre: 'La Florida' }, { id: 109, nombre: 'San Miguel' },
  { id: 110, nombre: 'Peñalolén' }, { id: 111, nombre: 'Macul' }, { id: 112, nombre: 'La Reina' },
  { id: 113, nombre: 'Pudahuel' }, { id: 114, nombre: 'Quilicura' }, { id: 115, nombre: 'Lampa' },
  { id: 116, nombre: 'Colina' }, { id: 117, nombre: 'Puente Alto' }, { id: 118, nombre: 'San Bernardo' },
  { id: 201, nombre: 'Viña del Mar' }, { id: 202, nombre: 'Valparaíso' }, { id: 203, nombre: 'Concepción' }
];

export async function getPaisesApi() {
  return fetchApi('/geografia/paises', { method: 'GET' })
    .catch(() => fetchApi('/geography/paises', { method: 'GET' }))
    .catch(() => FALLBACK_PAISES);
}

export async function getRegionesApi(paisId) {
  return fetchApi(`/geografia/paises/${encodeURIComponent(paisId)}/regiones`, { method: 'GET' })
    .catch(() => fetchApi(`/geography/paises/${encodeURIComponent(paisId)}/regiones`, { method: 'GET' }))
    .catch(() => FALLBACK_REGIONES);
}

export async function getComunasApi(regionId) {
  return fetchApi(`/geografia/regiones/${encodeURIComponent(regionId)}/comunas`, { method: 'GET' })
    .catch(() => fetchApi(`/geography/regiones/${encodeURIComponent(regionId)}/comunas`, { method: 'GET' }))
    .catch(() => FALLBACK_COMUNAS);
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

export async function getSellerInventoryApi(proveedorId, { page = 0, size = 12, texto } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (texto) params.set('texto', texto);
  return fetchApi(`/proveedores/${proveedorId}/inventario?${params.toString()}`, { method: 'GET' });
}

export async function getSellerInventorySummaryApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/inventario/resumen`, { method: 'GET' });
}

export async function updateSellerProductTopApi(proveedorId, productId, destacado) {
  return fetchApi(`/proveedores/${proveedorId}/inventario/${productId}/top`, {
    method: 'PATCH',
    body: JSON.stringify({ destacado: Boolean(destacado) }),
  });
}

export async function getSellerConversationsApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/conversaciones`, { method: 'GET' });
}

export async function getBuyerConversationsApi(usuarioId) {
  return fetchApi(`/usuarios/${usuarioId}/conversaciones`, { method: 'GET' });
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
export async function getSellerProductQuestionsApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/preguntas-productos`, { method: 'GET' });
}

export async function getProductQuestionsApi(productoId) {
  return fetchApi(`/productos/${productoId}/preguntas`, { method: 'GET' });
}

export async function createProductQuestionApi(productoId, question) {
  return fetchApi(`/productos/${productoId}/preguntas`, {
    method: 'POST',
    body: JSON.stringify(question),
  });
}

export async function getSellerStoreApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/tienda`, { method: 'GET' });
}

/** Fondos de pedidos finalizados que todavía no han sido incluidos en un retiro. */
export async function getSellerPendingWithdrawalsApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/retiros/pendientes`, { method: 'GET' });
}

export async function getSellerWithdrawalsApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/retiros`, { method: 'GET' });
}

export async function getSellerWithdrawalDetailApi(proveedorId, retiroId) {
  return fetchApi(`/proveedores/${proveedorId}/retiros/${retiroId}`, { method: 'GET' });
}

export async function createSellerWithdrawalApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/retiros`, { method: 'POST' });
}

export async function getSellerBankAccountApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/cuenta-bancaria`, { method: 'GET' });
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

export async function getPublicStoresApi({ page = 0, size = 12, texto } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (texto) params.set('texto', texto);
  return fetchApi(`/tiendas/publicas?${params.toString()}`, { method: 'GET' });
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

export async function getPublicProductsApi({ page = 0, size = 12, texto, patente, soloCotizacion, categoriaId, subcategoriaId, marcaId, precioMin, precioMax, comunaId, sort = 'precio,asc' } = {}) {
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
  return fetchApi(`/inventario/productos?${params.toString()}`, { method: 'GET' });
}

/**
 * Ficha pública de un producto. Se usa al entrar por URL directa
 * (`/repuestos/{id}-{slug}`), cuando no venimos navegando desde el catálogo.
 * Si el backend aún no expone el detalle unitario, el llamador cae al listado.
 */
export async function getPublicProductApi(productId) {
  return fetchApi(`/inventario/productos/${productId}`, { method: 'GET' });
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
export async function getVehicleBrandsApi() {
  return fetchApi('/catalogos/inventario/marcas-vehiculo', { method: 'GET' });
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
