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
  relatedProducts: (id) => ['products', id, 'related'],
  categoryCounts: () => ['categoryCounts'],
  categories: () => ['categories'],
  brands: (categoria) => ['brands', categoria || 'all'],
  cart: (userId) => ['cart', userId],
  orders: (userId) => ['orders', userId],
  sellerOrders: (sellerId) => ['sellerOrders', sellerId],
  buyerOrders: (userId) => ['buyerOrders', userId],
  favorites: (userId) => ['favorites', userId],
  conversations: (id, isSeller) => ['conversations', isSeller ? 'seller' : 'buyer', id],
  sellerInventory: (sellerId, filters) => ['sellerInventory', sellerId, filters || {}],
  sellerInventorySummary: (sellerId) => ['sellerInventorySummary', sellerId],
  sellerProductQuestions: (sellerId) => ['sellerProductQuestions', sellerId],
  notifications: (userId) => ['notifications', userId],
  profile: () => ['profile'],
};
