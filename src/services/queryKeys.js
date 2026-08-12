/**
 * Centralized Query Keys factory for TanStack Query
 */
export const qk = {
  stores: (filters) => ['stores', filters || {}],
  store: (id) => ['stores', id],
  storeProducts: (id, filters) => ['stores', id, 'products', filters || {}],
  products: (filters) => ['products', filters || {}],
  product: (id) => ['products', id],
  categoryCounts: () => ['categoryCounts'],
  categories: () => ['categories'],
  brands: (categoria) => ['brands', categoria || 'all'],
  cart: (userId) => ['cart', userId],
  orders: (userId) => ['orders', userId],
  notifications: (userId) => ['notifications', userId],
  profile: () => ['profile'],
};
