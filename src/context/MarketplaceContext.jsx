import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const MarketplaceContext = createContext(null);

// La clave lleva sufijo de versión: la versión anterior guardaba el vehículo de
// demostración de src/data/sampleVehicles.js, que al volver de localStorage activaba
// el filtro "solo compatibles" contra un auto que no existe en el inventario real y
// dejaba el catálogo en cero resultados. Cambiar la clave descarta ese dato una vez.
const ACTIVE_VEHICLE_KEY = 'repuestop_active_vehicle_v2';

/**
 * Estado compartido por todas las rutas (garage activo, carrito, modales globales).
 * Vive por encima del router para sobrevivir a los cambios de página.
 */
export function MarketplaceProvider({ children }) {
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

  const addToCart = useCallback((product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  }, []);

  const updateCartQuantity = useCallback((productId, newQty) => {
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((item) => item.id !== productId));
      return;
    }
    setCartItems((prev) => prev.map((item) => (item.id === productId ? { ...item, quantity: newQty } : item)));
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
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
    activeVehicle, cartItems, cartCount, addToCart, updateCartQuantity, removeFromCart,
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
