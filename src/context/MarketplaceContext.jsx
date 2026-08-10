import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addCartItemApi, getCartApi, removeCartItemApi, resolveMediaUrl, updateCartItemApi } from '../services/api';
import { useAuth } from './AuthContext';

const MarketplaceContext = createContext(null);

// La clave lleva sufijo de versión: la versión anterior guardaba el vehículo de
// demostración de src/data/sampleVehicles.js, que al volver de localStorage activaba
// el filtro "solo compatibles" contra un auto que no existe en el inventario real y
// dejaba el catálogo en cero resultados. Cambiar la clave descarta ese dato una vez.
const ACTIVE_VEHICLE_KEY = 'repuestop_active_vehicle_v2';

function mapServerCart(summary) {
  return (summary?.items || []).map((item) => ({
    id: item.proveedorProductoId ?? item.productId,
    cartItemId: item.itemId,
    proveedorId: item.proveedorId ?? item.sellerId,
    titulo: item.repuestoNombre || item.name || 'Repuesto',
    marca: item.repuestoMarca || item.brand,
    oemCode: item.skuProveedor || item.sku || 'Sin referencia',
    precio: Number(item.precioUnitario ?? item.price ?? 0),
    quantity: Number(item.cantidad ?? item.quantity ?? 1),
    stock: Number(item.stockDisponible ?? item.stockAvailable ?? 0),
    imagen: resolveMediaUrl(item.imageUrl),
    vendedor: item.proveedor,
    shippingMethod: item.metodoEnvio || '',
    shippingFee: Number(item.costoEnvioLocal || 0),
  }));
}

/**
 * Estado compartido por todas las rutas (garage activo, carrito, modales globales).
 * Vive por encima del router para sobrevivir a los cambios de página.
 */
export function MarketplaceProvider({ children }) {
  const { isLoggedIn, user } = useAuth();
  const userId = user?.userId ?? user?.id;
  const [activeVehicle, setActiveVehicle] = useState(() => {
    try {
      localStorage.removeItem('repuestop_active_vehicle'); // dato de la era mock
      const saved = localStorage.getItem(ACTIVE_VEHICLE_KEY);
      if (saved && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.warn('Omitiendo parseo de vehículo previo:', e);
    }
    // Sin vehículo precargado: el usuario identifica su auto por patente contra
    // el backend (GET /api/v1/vehiculos/patente/{patente}).
    return null;
  });

  useEffect(() => {
    try {
      if (activeVehicle) {
        localStorage.setItem(ACTIVE_VEHICLE_KEY, JSON.stringify(activeVehicle));
      } else {
        localStorage.removeItem(ACTIVE_VEHICLE_KEY);
      }
    } catch {
      // ignore quota or storage errors
    }
  }, [activeVehicle]);

  // El carrito parte vacío; antes venía precargado con un producto de ejemplo.
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isLoggedIn || !userId) return undefined;
    let cancelled = false;

    const syncCart = async () => {
      const guestItems = cartItems.filter((item) => !item.cartItemId);
      try {
        let summary;
        if (guestItems.length > 0) {
          for (const item of guestItems) {
            summary = await addCartItemApi(userId, {
              proveedorProductoId: Number(item.id),
              cantidad: item.quantity,
              metodoEnvio: item.shippingMethod,
              costoEnvioLocal: item.shippingFee || 0,
            });
          }
        } else {
          summary = await getCartApi(userId);
        }
        if (!cancelled) setCartItems(mapServerCart(summary));
      } catch (error) {
        console.warn('No se pudo sincronizar el carrito:', error);
      }
    };

    syncCart();
    return () => { cancelled = true; };
    // La sincronización se dispara al iniciar/cambiar sesión. Los cambios posteriores
    // se persisten directamente en las acciones del carrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userId]);

  const addToCart = useCallback(async (product, options = {}) => {
    const shippingMethod = options.shippingMethod || '';
    const shippingFee = Number(options.shippingFee || 0);

    if (isLoggedIn && userId) {
      const summary = await addCartItemApi(userId, {
        proveedorProductoId: Number(product.id),
        cantidad: 1,
        metodoEnvio: shippingMethod,
        costoEnvioLocal: shippingFee,
      });
      setCartItems(mapServerCart(summary));
      return summary;
    }

    setCartItems((prev) => {
      const existing = prev.find((item) => String(item.id) === String(product.id));
      if (existing) {
        return prev.map((item) => (String(item.id) === String(product.id)
          ? { ...item, quantity: item.quantity + 1, shippingMethod, shippingFee }
          : item));
      }
      return [...prev, { ...product, quantity: 1, shippingMethod, shippingFee }];
    });
    return null;
  }, [isLoggedIn, userId]);

  const updateCartQuantity = useCallback(async (productId, newQty) => {
    const current = cartItems.find((item) => String(item.id) === String(productId));
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((item) => String(item.id) !== String(productId)));
    } else {
      setCartItems((prev) => prev.map((item) => (String(item.id) === String(productId) ? { ...item, quantity: newQty } : item)));
    }

    if (isLoggedIn && userId && current?.cartItemId) {
      try {
        const summary = newQty > 0
          ? await updateCartItemApi(userId, current.cartItemId, {
            proveedorProductoId: Number(current.id),
            cantidad: newQty,
            metodoEnvio: current.shippingMethod,
            costoEnvioLocal: current.shippingFee || 0,
          })
          : await removeCartItemApi(userId, current.cartItemId);
        setCartItems(mapServerCart(summary));
      } catch (error) {
        console.warn('No se pudo actualizar la cantidad del carrito:', error);
        const summary = await getCartApi(userId).catch(() => null);
        if (summary) setCartItems(mapServerCart(summary));
      }
    }
  }, [cartItems, isLoggedIn, userId]);

  const removeFromCart = useCallback(async (productId) => {
    const current = cartItems.find((item) => String(item.id) === String(productId));
    setCartItems((prev) => prev.filter((item) => String(item.id) !== String(productId)));
    if (isLoggedIn && userId && current?.cartItemId) {
      try {
        const summary = await removeCartItemApi(userId, current.cartItemId);
        setCartItems(mapServerCart(summary));
      } catch (error) {
        console.warn('No se pudo eliminar el producto del carrito:', error);
        const summary = await getCartApi(userId).catch(() => null);
        if (summary) setCartItems(mapServerCart(summary));
      }
    }
  }, [cartItems, isLoggedIn, userId]);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems]
  );

  const value = useMemo(() => ({
    activeVehicle,
    setActiveVehicle,
    cartItems,
    cartCount,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    isCartOpen,
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
    isAuthModalOpen,
    openAuthModal: () => setIsAuthModalOpen(true),
    closeAuthModal: () => setIsAuthModalOpen(false),
    quoteProduct,
    openQuote: setQuoteProduct,
    closeQuote: () => setQuoteProduct(null),
    searchQuery,
    setSearchQuery,
  }), [
    activeVehicle, cartItems, cartCount, addToCart, updateCartQuantity, removeFromCart, clearCart,
    isCartOpen, isAuthModalOpen, quoteProduct, searchQuery,
  ]);

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (!context) {
    throw new Error('useMarketplace debe usarse dentro de <MarketplaceProvider>');
  }
  return context;
}
