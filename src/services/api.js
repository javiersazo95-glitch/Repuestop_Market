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
  
  const headers = {
    'Content-Type': 'application/json',
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

/** Sube un logo/avatar o portada al backend; el backend lo persiste en R2. */
export async function uploadProfileImageApi(file, type = 'avatar') {
  const token = localStorage.getItem('repuestop_token');
  const formData = new FormData();
  formData.append('file', file);
  const endpoint = type === 'cover' ? '/users/perfil/portada' : '/users/perfil/foto';
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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

/**
 * Perfil: Pedidos, favoritos e inventario/tienda del proveedor
 */
export async function getBuyerOrdersApi(usuarioId) {
  return fetchApi(`/usuarios/${usuarioId}/pedidos`, { method: 'GET' });
}

export async function getSellerOrdersApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/pedidos`, { method: 'GET' });
}

export async function getFavoritesApi(usuarioId) {
  return fetchApi(`/usuarios/${usuarioId}/favoritos`, { method: 'GET' });
}

export async function getSellerInventoryApi(proveedorId, { page = 0, size = 12, texto } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (texto) params.set('texto', texto);
  return fetchApi(`/proveedores/${proveedorId}/inventario?${params.toString()}`, { method: 'GET' });
}

export async function getSellerInventorySummaryApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/inventario/resumen`, { method: 'GET' });
}

export async function getSellerConversationsApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/conversaciones`, { method: 'GET' });
}

export async function getSellerStoreApi(proveedorId) {
  return fetchApi(`/proveedores/${proveedorId}/tienda`, { method: 'GET' });
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

export async function getPublicProductsApi({ page = 0, size = 12, texto, patente, soloCotizacion, categoriaId, marcaId, precioMin, precioMax, sort = 'precio,asc' } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size), sort });
  if (texto) params.set('texto', texto);
  if (patente) params.set('patente', patente);
  if (soloCotizacion !== undefined) params.set('soloCotizacion', String(soloCotizacion));
  if (categoriaId) params.set('categoriaId', String(categoriaId));
  if (marcaId) params.set('marcaId', String(marcaId));
  if (precioMin) params.set('precioMin', String(precioMin));
  if (precioMax) params.set('precioMax', String(precioMax));
  return fetchApi(`/inventario/productos?${params.toString()}`, { method: 'GET' });
}

export async function getPublicCategoryCountsApi() {
  return fetchApi('/inventario/productos/resumen-categorias', { method: 'GET' });
}

export async function getPartCategoriesApi() {
  return fetchApi('/catalogos/inventario/categorias-repuesto', { method: 'GET' });
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
