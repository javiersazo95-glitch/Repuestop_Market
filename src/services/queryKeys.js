/**
 * Centralized Query Keys factory for TanStack Query
 */
export const qk = {
  stores: (filters) => ['stores', filters || {}],
  store: (id) => ['stores', id],
  storeProducts: (id, filters) => ['stores', id, 'products', filters || {}],
  sellerStore: (id) => ['seller', id, 'store'],
  products: (filters) => ['products', filters || {}],
  product: (id) => ['products', id],
  productQuestions: (id) => ['products', id, 'questions'],
  /** Bandeja del COMPRADOR con las preguntas que hizo (GET /usuarios/me/preguntas-productos). */
  buyerProductQuestions: (userId) => ['buyerProductQuestions', userId],
  relatedProducts: (id) => ['products', id, 'related'],
  categoryCounts: () => ['categoryCounts'],
  categories: () => ['categories'],
  subcategories: (categoriaId) => ['subcategories', categoriaId || 'none'],
  partOrigins: () => ['partOrigins'],
  /** Tiendas y comunas de todo el catalogo publico (filtros avanzados). */
  catalogFilterOptions: () => ['catalogFilterOptions'],
  brands: (categoria) => ['brands', categoria || 'all'],
  cart: (userId) => ['cart', userId],
  orders: (userId) => ['orders', userId],
  sellerOrders: (sellerId) => ['sellerOrders', sellerId],
  buyerOrders: (userId) => ['buyerOrders', userId],
  favorites: (userId) => ['favorites', userId],
  conversations: (id, isSeller) => ['conversations', isSeller ? 'seller' : 'buyer', id],
  sellerInventory: (sellerId, filters) => ['sellerInventory', sellerId, filters || {}],
  sellerInventorySummary: (sellerId) => ['sellerInventorySummary', sellerId],
  sellerFullInventory: (sellerId) => ['sellerInventory', sellerId, 'full'],
  /** Categorias presentes en el inventario del vendedor, para el filtro del panel. */
  sellerInventoryCategories: (sellerId) => ['sellerInventoryCategories', sellerId],
  sellerProductQuestions: (sellerId) => ['sellerProductQuestions', sellerId],
  notifications: (userId) => ['notifications', userId],
  /** Estado de bloqueo de la tienda (GET /proveedores/{id}/estado-cuenta). */
  sellerAccountStatus: (sellerId) => ['sellerAccountStatus', sellerId],
  sellerVerification: (sellerId) => ['sellerVerification', sellerId],
  /** Estado de bloqueo del comprador (GET /compradores/{id}/estado-cuenta). */
  buyerAccountStatus: (buyerId) => ['buyerAccountStatus', buyerId],
  /** Ofertas compatibles de repuestos para un vehiculo_catalogo (GET /vehiculos-catalogo/{id}/repuestos). */
  vehicleCompatibleProducts: (catalogoId, filters) => ['vehicleCatalogParts', catalogoId, filters || {}],
  /** Opciones de filtros acotadas a la patente (GET /vehiculos-catalogo/{id}/repuestos/filtros). */
  vehicleFilterOptions: (catalogoId, anio) => ['vehicleFilterOptions', catalogoId, anio || null],
  /** Cascada marca/modelo/año/versión con repuestos publicados (GET /inventario/productos/opciones-vehiculo). */
  vehicleCascadeOptions: (params) => ['vehicleCascadeOptions', params || {}],
  /** Opciones con conteo del catalogo general (GET /inventario/productos/opciones-filtro). */
  publishedFilterOptions: (params) => ['publishedFilterOptions', params || {}],
  vehicleBrands: () => ['vehicleBrands'],
  vehicleModels: (marcaId) => ['vehicleModels', marcaId],
  vehicleVersions: (marca, modelo, anio) => ['vehicleVersions', { marca, modelo, anio }],
  profile: () => ['profile'],
  /** Ficha publica de un anuncio del mural (GET /anuncios/{id}). */
  publicAd: (id) => ['publicAd', id],
};
