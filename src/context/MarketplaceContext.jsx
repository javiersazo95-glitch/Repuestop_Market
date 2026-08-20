import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import { addCartItemApi, getCartApi, removeCartItemApi, resolveMediaUrl, updateCartItemApi } from '../services/api';
import { useAuth } from './AuthContext';

const MarketplaceContext = createContext(null);

// La clave lleva sufijo de versión: la versión anterior guardaba el vehículo de
// demostración de src/data/sampleVehicles.js, que al volver de localStorage activaba
// el filtro "solo compatibles" contra un auto que no existe en el inventario real y
// dejaba el catálogo en cero resultados. Cambiar la clave descarta ese dato una vez.
const ACTIVE_VEHICLE_KEY = 'repuestop_active_vehicle_v2';

// El carrito de invitado se persiste porque ahora vive en una URL propia (`/carrito`):
// antes solo existía dentro del drawer y morir al recargar no se notaba.
const GUEST_CART_KEY = 'repuestop_guest_cart_v1';

function readGuestCart() {
  try {
    const saved = localStorage.getItem(GUEST_CART_KEY);
    if (!saved || saved === 'undefined') return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Omitiendo carrito de invitado previo:', e);
    return [];
  }
}

/**
 * Totales de la compra, en un solo lugar para que el carrito, el checkout y el resumen
 * no puedan discrepar entre sí.
 *
 * El comprador paga subtotal + envío, sin recargo: `PedidoCheckoutCarritoSupport` deja
 * `comisionComprador` y `comisionPasarela` en cero (la comisión del 10/7/5% se le
 * descuenta al vendedor), y en la app móvil `buyerDisplayPrice` es identidad y
 * `flowFeeAmount()` devuelve 0.
 *
 * Los campos `comisionServicio` y `totalEstimado` que devuelve GET /carrito NO se usan
 * como fuente: `CarritoService` deja la comisión hardcodeada en cero y el total sin el
 * envío, así que mostrarlos daría un total más bajo que el que se cobra.
 *
 * El costo de envío se cuenta UNA vez por proveedor, igual que el checkout del backend
 * (`costoEnvioPorProveedor.putIfAbsent`).
 */
function calcularTotalesCarrito(items) {
  const subtotal = items.reduce((acc, item) => acc + Number(item.precio || 0) * Number(item.quantity || 0), 0);

  const envioPorProveedor = new Map();
  items.forEach((item) => {
    const fee = Number(item.shippingFee || 0);
    if (fee <= 0) return;
    const proveedorKey = String(item.proveedorId || item.vendedor || item.id);
    if (!envioPorProveedor.has(proveedorKey)) envioPorProveedor.set(proveedorKey, fee);
  });
  const costoEnvio = [...envioPorProveedor.values()].reduce((sum, fee) => sum + fee, 0);

  return { subtotal, costoEnvio, total: subtotal + costoEnvio };
}

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

  // Último producto agregado, para el aviso de confirmación. Sin esto, "Añadir al carro"
  // solo mueve el número del header, que es fácil de no ver.
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const lastAddedTimerRef = useRef(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const queryClient = useQueryClient();

  // Carrito de invitado: no hay usuarioId contra el cual persistirlo en el backend
  // hasta que la persona inicia sesión, así que vive en localStorage.
  const [guestCartItems, setGuestCartItems] = useState(readGuestCart);

  useEffect(() => {
    try {
      if (guestCartItems.length > 0) {
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(guestCartItems));
      } else {
        localStorage.removeItem(GUEST_CART_KEY);
      }
    } catch {
      // ignore quota or storage errors
    }
  }, [guestCartItems]);

  // Mensaje de la última mutación de carrito que falló, para que el usuario
  // sepa que su acción no se guardó (antes solo quedaba un console.warn).
  const [cartError, setCartError] = useState('');
  // Un timer de debounce por item: varios clics seguidos en +/- de cantidad
  // deben terminar en una sola petición al servidor con el valor final, no una
  // petición por clic. También evita que una respuesta lenta de un clic viejo
  // sobrescriba en el cliente el resultado de uno más nuevo.
  const quantityTimersRef = useRef(new Map());
  // Peticiones de agregar al carrito en vuelo por producto: si el usuario hace
  // clic en "Agregar" y luego en "Eliminar" antes de que la petición POST vuelva del
  // servidor, este map permite marcar la petición como cancelada para que, cuando
  // resuelva, elimine de inmediato la fila recién creada en la BD y no reaparezca en UI.
  const pendingAddsRef = useRef(new Map());

  // Carrito real de un usuario logueado: vive en la caché de TanStack Query,
  // no en un useState propio, así que las mutaciones de abajo pueden escribir
  // directamente en esa caché (optimista) y no hay dos fuentes de verdad.
  const { data: serverCartItems = [] } = useQuery({
    queryKey: qk.cart(userId),
    queryFn: () => getCartApi(userId).then(mapServerCart),
    enabled: Boolean(isLoggedIn && userId),
  });

  const cartItems = isLoggedIn && userId ? serverCartItems : guestCartItems;

  // Aplica un cambio optimista al carrito que esté activo (invitado o server).
  const applyOptimisticCart = useCallback((updater) => {
    if (isLoggedIn && userId) {
      queryClient.setQueryData(qk.cart(userId), (current = []) => updater(current || []));
    } else {
      setGuestCartItems((current) => updater(current));
    }
  }, [isLoggedIn, userId, queryClient]);

  // Al iniciar sesión con productos ya agregados como invitado, se empujan al
  // backend uno por uno. Antes esto vivía adentro del mismo efecto que hacía
  // el fetch normal del carrito; ahora ese fetch lo resuelve `useQuery` solo
  // (arriba) al activarse `enabled`, así que este efecto solo cubre el caso
  // de invitado con items pendientes.
  useEffect(() => {
    if (!isLoggedIn || !userId || guestCartItems.length === 0) return undefined;
    let cancelled = false;

    (async () => {
      try {
        let summary;
        for (const item of guestCartItems) {
          summary = await addCartItemApi(userId, {
            proveedorProductoId: Number(item.id),
            cantidad: item.quantity,
            metodoEnvio: item.shippingMethod,
            costoEnvioLocal: item.shippingFee || 0,
          });
        }
        if (!cancelled) {
          if (summary) queryClient.setQueryData(qk.cart(userId), mapServerCart(summary));
          setGuestCartItems([]);
        }
      } catch (error) {
        console.warn('No se pudo sincronizar el carrito de invitado con el servidor:', error);
      } finally {
        if (!cancelled) queryClient.invalidateQueries({ queryKey: qk.cart(userId) });
      }
    })();

    return () => { cancelled = true; };
    // Se dispara solo en la transición de login, no en cada cambio de
    // guestCartItems (ya vacío después de sincronizar una vez).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userId]);

  const dismissLastAdded = useCallback(() => {
    if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
    setLastAddedItem(null);
  }, []);

  useEffect(() => () => {
    if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
  }, []);

  const addToCart = useCallback(async (product, options = {}) => {
    const shippingMethod = options.shippingMethod || '';
    const shippingFee = Number(options.shippingFee || 0);
    const productIdStr = String(product.id);
    setCartError('');

    const previousServerCart = isLoggedIn && userId ? queryClient.getQueryData(qk.cart(userId)) : null;

    // Optimistic UI update: update local cart state immediately (0ms latency)
    applyOptimisticCart((current) => {
      const existing = current.find((item) => String(item.id) === productIdStr);
      if (existing) {
        return current.map((item) => (String(item.id) === productIdStr
          ? { ...item, quantity: item.quantity + 1, shippingMethod, shippingFee }
          : item));
      }
      return [...current, { ...product, quantity: 1, shippingMethod, shippingFee }];
    });

    // El aviso se muestra con el cambio optimista, no con la respuesta del servidor: si
    // la petición falla, el rollback y `cartError` se encargan de contarlo.
    setLastAddedItem({ id: product.id, titulo: product.titulo, imagen: product.imagen, precio: product.precio });
    if (lastAddedTimerRef.current) clearTimeout(lastAddedTimerRef.current);
    lastAddedTimerRef.current = setTimeout(() => setLastAddedItem(null), 5000);

    if (!isLoggedIn || !userId) return null;

    const pendingRecord = { cancelled: false };
    pendingAddsRef.current.set(productIdStr, pendingRecord);

    try {
      const summary = await addCartItemApi(userId, {
        proveedorProductoId: Number(product.id),
        cantidad: 1,
        metodoEnvio: shippingMethod,
        costoEnvioLocal: shippingFee,
      });

      if (pendingRecord.cancelled) {
        // El usuario eliminó el producto mientras la llamada HTTP estaba viajando.
        // Obtenemos el cartItemId que nos devolvió el servidor para eliminarlo de la BD.
        const mapped = mapServerCart(summary);
        const addedItem = mapped.find((item) => String(item.id) === productIdStr);
        if (addedItem?.cartItemId) {
          const cleanedSummary = await removeCartItemApi(userId, addedItem.cartItemId);
          queryClient.setQueryData(qk.cart(userId), mapServerCart(cleanedSummary));
          return cleanedSummary;
        }
        queryClient.setQueryData(qk.cart(userId), (current = []) => current.filter((item) => String(item.id) !== productIdStr));
        return summary;
      }

      queryClient.setQueryData(qk.cart(userId), mapServerCart(summary));
      return summary;
    } catch (error) {
      console.warn('No se pudo agregar el producto en el backend, revirtiendo:', error);
      queryClient.setQueryData(qk.cart(userId), previousServerCart ?? []);
      setCartError('No se pudo agregar el producto al carrito. Intenta nuevamente.');
      return null;
    } finally {
      if (pendingAddsRef.current.get(productIdStr) === pendingRecord) {
        pendingAddsRef.current.delete(productIdStr);
      }
    }
  }, [isLoggedIn, userId, queryClient, applyOptimisticCart]);

  const updateCartQuantity = useCallback((productId, newQty) => {
    const productIdStr = String(productId);
    setCartError('');
    const current = cartItems.find((item) => String(item.id) === productIdStr);
    if (!current) return;

    if (newQty <= 0) {
      const pendingRecord = pendingAddsRef.current.get(productIdStr);
      if (pendingRecord) pendingRecord.cancelled = true;
      applyOptimisticCart((list) => list.filter((item) => String(item.id) !== productIdStr));
    } else {
      applyOptimisticCart((list) => list.map((item) => (String(item.id) === productIdStr ? { ...item, quantity: newQty } : item)));
    }

    if (!isLoggedIn || !userId || !current.cartItemId) return;

    const timers = quantityTimersRef.current;
    const existingTimer = timers.get(productId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      timers.delete(productId);
      const previousServerCart = queryClient.getQueryData(qk.cart(userId));
      try {
        const summary = newQty > 0
          ? await updateCartItemApi(userId, current.cartItemId, {
            proveedorProductoId: Number(current.id),
            cantidad: newQty,
            metodoEnvio: current.shippingMethod,
            costoEnvioLocal: current.shippingFee || 0,
          })
          : await removeCartItemApi(userId, current.cartItemId);
        queryClient.setQueryData(qk.cart(userId), mapServerCart(summary));
      } catch (error) {
        console.warn('No se pudo actualizar la cantidad en el backend, revirtiendo:', error);
        queryClient.setQueryData(qk.cart(userId), previousServerCart ?? []);
        setCartError('No se pudo actualizar la cantidad. Intenta nuevamente.');
      }
    }, 500);
    timers.set(productId, timer);
  }, [cartItems, isLoggedIn, userId, queryClient, applyOptimisticCart]);

  const removeFromCart = useCallback(async (productId) => {
    const productIdStr = String(productId);
    setCartError('');
    const current = cartItems.find((item) => String(item.id) === productIdStr);

    const pendingRecord = pendingAddsRef.current.get(productIdStr);
    if (pendingRecord) pendingRecord.cancelled = true;

    applyOptimisticCart((list) => list.filter((item) => String(item.id) !== productIdStr));

    if (!isLoggedIn || !userId || !current?.cartItemId) return;

    // Si había un cambio de cantidad pendiente para este item, ya no aplica.
    const timers = quantityTimersRef.current;
    const existingTimer = timers.get(productId);
    if (existingTimer) { clearTimeout(existingTimer); timers.delete(productId); }

    const previousServerCart = queryClient.getQueryData(qk.cart(userId));
    try {
      const summary = await removeCartItemApi(userId, current.cartItemId);
      queryClient.setQueryData(qk.cart(userId), mapServerCart(summary));
    } catch (error) {
      console.warn('No se pudo eliminar el producto en el backend, revirtiendo:', error);
      queryClient.setQueryData(qk.cart(userId), previousServerCart ?? []);
      setCartError('No se pudo eliminar el producto. Intenta nuevamente.');
    }
  }, [cartItems, isLoggedIn, userId, queryClient, applyOptimisticCart]);

  /**
   * Cambia el método de entrega de un grupo de líneas. Recibe varias porque el cambio se
   * aplica a todas las de una misma tienda: el backend cobra un costo de envío por
   * proveedor, así que dos métodos distintos dentro de la misma tienda no tienen
   * representación posible en el pedido.
   */
  const updateCartShipping = useCallback(async (productIds, { shippingMethod, shippingFee = 0 }) => {
    const ids = (Array.isArray(productIds) ? productIds : [productIds]).map(String);
    if (ids.length === 0) return;
    setCartError('');

    const previousServerCart = isLoggedIn && userId ? queryClient.getQueryData(qk.cart(userId)) : null;

    applyOptimisticCart((list) => list.map((item) => (ids.includes(String(item.id))
      ? { ...item, shippingMethod, shippingFee }
      : item)));

    if (!isLoggedIn || !userId) return;

    try {
      let summary;
      for (const id of ids) {
        const item = cartItems.find((entry) => String(entry.id) === id);
        if (!item?.cartItemId) continue;
        summary = await updateCartItemApi(userId, item.cartItemId, {
          proveedorProductoId: Number(item.id),
          cantidad: item.quantity,
          metodoEnvio: shippingMethod,
          costoEnvioLocal: shippingFee,
        });
      }
      if (summary) queryClient.setQueryData(qk.cart(userId), mapServerCart(summary));
    } catch (error) {
      console.warn('No se pudo actualizar el método de entrega en el backend, revirtiendo:', error);
      queryClient.setQueryData(qk.cart(userId), previousServerCart ?? []);
      setCartError('No se pudo actualizar el método de entrega. Intenta nuevamente.');
    }
  }, [cartItems, isLoggedIn, userId, queryClient, applyOptimisticCart]);

  const clearCart = useCallback(() => {
    setCartError('');
    if (isLoggedIn && userId) {
      queryClient.setQueryData(qk.cart(userId), []);
      // El backend no tiene un endpoint de "vaciar carrito" aparte: se llama
      // tras un checkout exitoso, que ya deja el carrito vacío en el servidor.
      // invalidateQueries confirma ese estado real en la próxima sincronización.
      queryClient.invalidateQueries({ queryKey: qk.cart(userId) });
    } else {
      setGuestCartItems([]);
    }
  }, [isLoggedIn, userId, queryClient]);

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems]
  );

  const cartTotals = useMemo(() => calcularTotalesCarrito(cartItems), [cartItems]);

  const value = useMemo(() => ({
    activeVehicle,
    setActiveVehicle,
    cartItems,
    cartCount,
    cartTotals,
    cartError,
    dismissCartError: () => setCartError(''),
    lastAddedItem,
    dismissLastAdded,
    addToCart,
    updateCartQuantity,
    updateCartShipping,
    removeFromCart,
    clearCart,
    isAuthModalOpen,
    openAuthModal: () => setIsAuthModalOpen(true),
    closeAuthModal: () => setIsAuthModalOpen(false),
    quoteProduct,
    openQuote: setQuoteProduct,
    closeQuote: () => setQuoteProduct(null),
    searchQuery,
    setSearchQuery,
  }), [
    activeVehicle, cartItems, cartCount, cartTotals, cartError, addToCart, updateCartQuantity, updateCartShipping, removeFromCart, clearCart,
    isAuthModalOpen, quoteProduct, searchQuery, lastAddedItem, dismissLastAdded,
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
