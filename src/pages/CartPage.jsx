import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, ShoppingBag, X } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { getPublicProductApi } from '../services/api';
import { adaptProduct } from '../services/adapters';
import { resolveShippingService, shippingMethodCost } from '../data/shippingMethods';
import { ROUTES } from '../routes/paths';
import { useAppNavigation } from '../routes/useAppNavigation';
import CartStoreGroup from '../components/CartStoreGroup';
import CheckoutSummaryPanel from '../components/CheckoutSummaryPanel';
import PurchaseShippingModal from '../components/PurchaseShippingModal';

export default function CartPage() {
  const navigate = useNavigate();
  const nav = useAppNavigation();
  const { isLoggedIn } = useAuth();
  const {
    cartItems, cartCount, cartTotals, cartError, dismissCartError,
    updateCartQuantity, updateCartShipping, removeFromCart,
    activeVehicle, openAuthModal,
  } = useMarketplace();

  // Editor de entrega: se abre desde el encabezado de una tienda y necesita los métodos
  // reales del producto (`metodosEnvio`), que el ítem del carrito no trae. Por eso el
  // detalle se pide recién al abrirlo, y no para todo el carrito al entrar.
  const [shippingEditor, setShippingEditor] = useState(null);

  const groups = useMemo(() => {
    const byStore = new Map();
    cartItems.forEach((item) => {
      const key = String(item.proveedorId || item.vendedor || item.id);
      if (!byStore.has(key)) {
        byStore.set(key, {
          key,
          proveedorId: item.proveedorId,
          vendedor: item.vendedor,
          items: [],
          shippingMethod: item.shippingMethod || '',
        });
      }
      byStore.get(key).items.push(item);
    });
    return [...byStore.values()];
  }, [cartItems]);

  const missingShipping = cartItems.some((item) => !item.shippingMethod);

  // Solo se usa cuando el costo de envío es 0: si hay monto, el resumen muestra el monto.
  const shippingLabel = useMemo(() => {
    const services = cartItems
      .map((item) => item.shippingMethod)
      .filter(Boolean)
      .map((method) => resolveShippingService(method).name);
    if (services.length === 0) return 'Por definir';
    if (services.every((name) => name === 'Retiro en tienda')) return 'Retiro en tienda';
    // "Por pagar" y no "Por coordinar": el backend marca este caso como
    // `tipoEnvio = "courier_por_pagar"` (el courier se le paga al recibir) y la app móvil
    // usa la misma etiqueta.
    if (services.some((name) => name === 'Envío fuera de la comuna')) return 'Por pagar';
    return 'Sin costo';
  }, [cartItems]);

  const openShippingEditor = useCallback(async (group) => {
    setShippingEditor({ group, product: null, loading: true, error: '' });
    try {
      const dto = await getPublicProductApi(group.items[0].id);
      setShippingEditor({ group, product: adaptProduct(dto), loading: false, error: '' });
    } catch {
      setShippingEditor({
        group,
        product: null,
        loading: false,
        error: 'No pudimos cargar las formas de entrega de esta tienda. Intenta nuevamente.',
      });
    }
  }, []);

  const confirmShipping = async ({ shippingMethod }) => {
    const { group } = shippingEditor;
    await updateCartShipping(group.items.map((item) => item.id), {
      shippingMethod,
      shippingFee: shippingMethodCost(shippingMethod),
    });
    setShippingEditor(null);
  };

  const goToCheckout = () => {
    if (!isLoggedIn) {
      openAuthModal();
      return;
    }
    navigate(ROUTES.checkout);
  };

  if (cartItems.length === 0) {
    return (
      <main className="cart-page">
        <div className="cart-page-shell">
          <div className="cart-empty">
            <ShoppingBag size={40} strokeWidth={1.4} />
            <h1>Tu carrito está vacío</h1>
            <p>Busca tu repuesto por patente o código OEM, o entra al catálogo por categoría.</p>
            <div className="cart-empty-actions">
              <button type="button" className="cart-empty-primary" onClick={() => nav.goCatalog()}>
                Ver el catálogo
              </button>
              <button type="button" className="cart-empty-secondary" onClick={nav.goHome}>
                Buscar por patente
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <div className="cart-page-shell">
        <header className="cart-page-head">
          <button type="button" className="cart-page-back" onClick={() => nav.goCatalog()}>
            <ArrowLeft size={16} /> Seguir comprando
          </button>
          <h1>Mi carrito</h1>
          <p>{cartCount} {cartCount === 1 ? 'producto' : 'productos'} de {groups.length} {groups.length === 1 ? 'tienda' : 'tiendas'}</p>
        </header>

        {cartError && (
          <div className="cart-page-alert" role="alert">
            <AlertTriangle size={15} />
            <span>{cartError}</span>
            <button type="button" onClick={dismissCartError} aria-label="Cerrar aviso"><X size={14} /></button>
          </div>
        )}

        <div className="cart-page-layout">
          <div className="cart-page-main">
            {groups.map((group) => (
              <CartStoreGroup
                key={group.key}
                group={group}
                activeVehicle={activeVehicle}
                onUpdateQuantity={updateCartQuantity}
                onRemove={removeFromCart}
                onChangeShipping={openShippingEditor}
              />
            ))}
          </div>

          <CheckoutSummaryPanel
            itemCount={cartCount}
            subtotal={cartTotals.subtotal}
            costoEnvio={cartTotals.costoEnvio}
            total={cartTotals.total}
            shippingLabel={shippingLabel}
            ctaLabel={isLoggedIn ? 'Continuar la compra' : 'Inicia sesión para continuar'}
            onCta={goToCheckout}
            ctaDisabled={missingShipping}
            warning={missingShipping ? 'Elige cómo recibir los productos de cada tienda para continuar.' : ''}
          />
        </div>
      </div>

      {shippingEditor?.loading && (
        <div className="cart-shipping-loading" role="status">
          <Loader2 size={18} className="spin-icon" /> Cargando formas de entrega…
        </div>
      )}

      {shippingEditor?.error && (
        <div className="cart-page-alert is-floating" role="alert">
          <AlertTriangle size={15} />
          <span>{shippingEditor.error}</span>
          <button type="button" onClick={() => setShippingEditor(null)} aria-label="Cerrar aviso"><X size={14} /></button>
        </div>
      )}

      <PurchaseShippingModal
        product={shippingEditor?.product || null}
        intent={shippingEditor?.product ? 'update' : null}
        initialMethod={shippingEditor?.group?.shippingMethod || ''}
        onClose={() => setShippingEditor(null)}
        onConfirm={confirmShipping}
      />
    </main>
  );
}
