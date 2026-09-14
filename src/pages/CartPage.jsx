import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Lock, ShoppingBag, X } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { useSellerBlocked } from '../hooks/useSellerBlocked';
import { useBuyerBlocked } from '../hooks/useBuyerBlocked';
import { useAuth } from '../context/AuthContext';
import { resolveShippingService } from '../data/shippingMethods';
import { ROUTES } from '../routes/paths';
import { useAppNavigation } from '../routes/useAppNavigation';
import CartStoreGroup from '../components/CartStoreGroup';
import CheckoutSummaryPanel from '../components/CheckoutSummaryPanel';

export default function CartPage() {
  const navigate = useNavigate();
  const nav = useAppNavigation();
  const { isBlocked: isSellerBlockedAccount } = useSellerBlocked();
  const { isBlocked: isBuyerBlockedAccount } = useBuyerBlocked();
  const isBlockedAccount = isSellerBlockedAccount || isBuyerBlockedAccount;
  const { isLoggedIn } = useAuth();
  const {
    cartItems, cartCount, cartTotals, cartError, dismissCartError,
    updateCartQuantity, removeFromCart,
    activeVehicle, openAuthModal,
  } = useMarketplace();

  const groups = useMemo(() => {
    const byStore = new Map();
    cartItems.forEach((item) => {
      const key = String(item.proveedorId || item.vendedor || item.id);
      if (!byStore.has(key)) {
        byStore.set(key, { key, proveedorId: item.proveedorId, vendedor: item.vendedor, items: [] });
      }
      byStore.get(key).items.push(item);
    });
    return [...byStore.values()];
  }, [cartItems]);

  // Solo se usa cuando el costo de envío es 0: si hay monto, el resumen muestra el monto.
  // El método de entrega todavía no se elige acá (se pregunta por tienda en el
  // checkout), así que acá casi siempre da "Por definir".
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

  const goToCheckout = () => {
    if (!isLoggedIn) {
      openAuthModal();
      return;
    }
    navigate(ROUTES.checkout);
  };

  // Cuenta bloqueada: el backend responde 403 a todo el lado comprador, asi que la
  // compra no puede completarse. Se dice por que, en vez de dejar que falle sola.
  if (isBlockedAccount) {
    return (
      <main className="cart-page">
        <div className="cart-page-shell">
          <div className="cart-empty">
            <Lock size={40} strokeWidth={1.4} />
            <h1>Tu cuenta está bloqueada</h1>
            <p>
              Mientras se revisa tu caso no puedes comprar en RepuesTop. Puedes enviar una
              solicitud de revisión desde tu perfil.
            </p>
            <div className="cart-empty-actions">
              <button type="button" className="cart-empty-primary" onClick={() => nav.goProfile('resumen')}>
                Ir a mi perfil
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

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
          />
        </div>
      </div>
    </main>
  );
}
