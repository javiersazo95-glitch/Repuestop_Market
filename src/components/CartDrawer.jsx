import React, { useEffect, useState } from 'react';
import { ShoppingBag, X, Trash2, Plus, Minus, ShieldCheck, Truck, ArrowRight, CheckCircle2, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';
import BuyerAddressBook from './BuyerAddressBook';
import { getAddressesApi, checkoutCartApi } from '../services/api';

export default function CartDrawer({
  isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, activeVehicle,
  user, isLoggedIn, onOpenAuthModal, onOrderCreated, onClearCart,
}) {
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showAddressManager, setShowAddressManager] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);

  const loadAddresses = () => {
    if (!user?.userId) return;
    setAddressesLoading(true);
    getAddressesApi(user.userId)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAddresses(list);
        const principal = list.find((address) => address.esPrincipal);
        setSelectedAddressId((current) => current || String(principal?.id || list[0]?.id || ''));
      })
      .catch(() => setAddresses([]))
      .finally(() => setAddressesLoading(false));
  };

  useEffect(() => {
    if (isOpen && isLoggedIn && user?.userId) loadAddresses();
  }, [isOpen, isLoggedIn, user?.userId]);

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => acc + (item.precio * item.quantity), 0);
  const freeShippingThreshold = 30000;
  const isFreeShipping = subtotal >= freeShippingThreshold;
  const shippingFee = subtotal > 0 && !isFreeShipping ? 3990 : 0;
  const total = subtotal + shippingFee;

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      onOpenAuthModal?.();
      return;
    }
    if (!selectedAddressId) {
      setCheckoutError('Selecciona la dirección donde quieres recibir tu pedido.');
      return;
    }
    setCheckingOut(true);
    setCheckoutError('');
    try {
      const order = await checkoutCartApi(user.userId, { direccionId: selectedAddressId });
      setOrderSuccess(order);
      onClearCart?.();
      onOrderCreated?.(order);
    } catch (error) {
      setCheckoutError(error.message || 'No se pudo generar el pedido. Intenta nuevamente.');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="cart-drawer-backdrop" onClick={onClose}>
      <div className="cart-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title">
            <ShoppingBag size={20} />
            <h2>Mi Carrito de Repuestos</h2>
            <span className="count-badge">{cartItems.length}</span>
          </div>
          <button className="drawer-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {orderSuccess ? (
          <div className="cart-order-success">
            <CheckCircle2 size={44} />
            <h3>¡Pedido generado con éxito!</h3>
            <p>Pedido #{String(orderSuccess.id || '').slice(-6).toUpperCase() || orderSuccess.id} enviado a la dirección seleccionada. Sigue su estado desde tu perfil.</p>
            <button
              type="button"
              className="btn-continue-shopping"
              onClick={() => { setOrderSuccess(null); onClose(); }}
            >
              Seguir comprando
            </button>
          </div>
        ) : (
        <>
        {/* Free Shipping Progress Indicator */}
        <div className="free-shipping-bar-wrapper">
          {isFreeShipping ? (
            <div className="free-shipping-success">
              <CheckCircle2 size={16} /> ¡Felicidades! Tienes <strong>ENVÍO GRATIS</strong> en esta compra.
            </div>
          ) : (
            <div className="free-shipping-progress">
              <p>Agrega <strong>${(freeShippingThreshold - subtotal).toLocaleString('es-CL')}</strong> más para tener Envío Gratis</p>
              <div className="progress-bar-outer">
                <div 
                  className="progress-bar-inner" 
                  style={{ width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Body - Items List */}
        <div className="drawer-body">
          {cartItems.length === 0 ? (
            <div className="empty-cart-state">
              <ShoppingBag size={48} className="empty-icon" />
              <h3>Tu carrito está vacío</h3>
              <p>Busca tus repuestos por patente o navega por las categorías para agregar productos.</p>
              <button className="btn-continue-shopping" onClick={onClose}>
                Explorar Repuestos
              </button>
            </div>
          ) : (
            <div className="cart-items-list">
              {cartItems.map((item) => (
                <div key={item.id} className="cart-item-row">
                  <CategoryIconTile
                    iconName={CATEGORY_ICON_BY_ID[item.categoria]}
                    color={CATEGORY_COLOR_BY_ID[item.categoria]}
                    size={22}
                    className="item-thumb"
                  />

                  <div className="item-details">
                    <h4 className="item-title">{item.titulo}</h4>
                    <span className="item-oem">OEM: {item.oemCode}</span>
                    
                    {activeVehicle && (
                      <span className="item-veh-tag">
                        ✓ Verificado para {activeVehicle.patente}
                      </span>
                    )}

                    <div className="item-price-row">
                      <span className="item-unit-price">${(item.precio * item.quantity).toLocaleString('es-CL')}</span>
                      
                      <div className="quantity-controls">
                        <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>
                          <Plus size={14} />
                        </button>
                      </div>

                      <button className="btn-remove-item" onClick={() => onRemoveItem(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer - Checkout & Totals */}
        {cartItems.length > 0 && (
          <div className="drawer-footer">
            <div className="summary-row">
              <span>Subtotal Repuestos:</span>
              <span>${subtotal.toLocaleString('es-CL')}</span>
            </div>
            <div className="summary-row">
              <span>Envío Express a domicilio:</span>
              <span>{shippingFee === 0 ? <strong className="green-text">GRATIS</strong> : `$${shippingFee.toLocaleString('es-CL')}`}</span>
            </div>

            <div className="total-row">
              <span>TOTAL (IVA Incluido):</span>
              <span className="total-amount">${total.toLocaleString('es-CL')}</span>
            </div>

            {isLoggedIn && (
              <div className="cart-checkout-address">
                <label htmlFor="cart-checkout-address-select"><MapPin size={14} /> Dirección de envío</label>
                {addressesLoading ? (
                  <div className="cart-address-loading"><Loader2 size={15} className="spin-icon" /> Cargando tus direcciones...</div>
                ) : addresses.length > 0 ? (
                  <>
                    <select
                      id="cart-checkout-address-select"
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                    >
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.calleYNumero} · {address.comunaNombre}{address.esPrincipal ? ' (Principal)' : ''}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn-manage-cart-addresses" onClick={() => setShowAddressManager((v) => !v)}>
                      {showAddressManager ? 'Ocultar direcciones' : 'Agregar otra dirección'}
                    </button>
                  </>
                ) : (
                  <div className="cart-address-empty">
                    <AlertTriangle size={15} /> No tienes direcciones guardadas todavía.
                  </div>
                )}
                {(showAddressManager || addresses.length === 0) && (
                  <div className="cart-address-manager">
                    <BuyerAddressBook usuarioId={user?.userId} />
                  </div>
                )}
              </div>
            )}

            <div className="checkout-trust-badge">
              <ShieldCheck size={16} /> Pago protegido con Flow o transferencia vía Khipu
            </div>

            {checkoutError && <div className="cart-checkout-error"><AlertTriangle size={15} /> {checkoutError}</div>}

            <button className="btn-proceed-checkout" onClick={handleCheckout} disabled={checkingOut}>
              <span>{checkingOut ? 'Generando pedido...' : isLoggedIn ? 'CONTINUAR AL PAGO' : 'INICIA SESIÓN PARA COMPRAR'}</span>
              {checkingOut ? <Loader2 size={18} className="spin-icon" /> : <ArrowRight size={18} />}
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
