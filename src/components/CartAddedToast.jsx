import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Package, X } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { ROUTES } from '../routes/paths';

/**
 * Confirmación de "producto agregado". Reemplaza al drawer que se abría de golpe encima
 * de la página: avisa sin interrumpir y deja seguir comprando.
 *
 * No aparece dentro de /carrito ni /checkout: ahí el cambio ya se ve en la lista, y un
 * aviso encima sería ruido.
 */
export default function CartAddedToast() {
  const { lastAddedItem, cartCount, dismissLastAdded } = useMarketplace();
  const location = useLocation();
  const navigate = useNavigate();

  const enFlujoDeCompra = location.pathname.startsWith(ROUTES.cart)
    || location.pathname.startsWith(ROUTES.checkout);

  if (!lastAddedItem || enFlujoDeCompra) return null;

  return (
    <div className="cart-added-toast" role="status" aria-live="polite">
      <div className="cart-added-head">
        <span className="cart-added-check"><Check size={13} strokeWidth={3} /></span>
        <strong>Agregado a tu carrito</strong>
        <button type="button" onClick={dismissLastAdded} aria-label="Cerrar aviso"><X size={15} /></button>
      </div>

      <div className="cart-added-body">
        {lastAddedItem.imagen
          ? <img src={lastAddedItem.imagen} alt="" />
          : <span className="cart-added-placeholder"><Package size={18} /></span>}
        <div>
          <p>{lastAddedItem.titulo}</p>
          <small>{cartCount} {cartCount === 1 ? 'producto' : 'productos'} en el carrito</small>
        </div>
      </div>

      <div className="cart-added-actions">
        <button type="button" className="cart-added-ghost" onClick={dismissLastAdded}>
          Seguir comprando
        </button>
        <button
          type="button"
          className="cart-added-primary"
          onClick={() => { dismissLastAdded(); navigate(ROUTES.cart); }}
        >
          Ir al carrito
        </button>
      </div>
    </div>
  );
}
