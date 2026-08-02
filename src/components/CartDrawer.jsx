import React from 'react';
import { ShoppingBag, X, Trash2, Plus, Minus, ShieldCheck, Truck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';

export default function CartDrawer({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, activeVehicle }) {
  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => acc + (item.precio * item.quantity), 0);
  const freeShippingThreshold = 30000;
  const isFreeShipping = subtotal >= freeShippingThreshold;
  const shippingFee = subtotal > 0 && !isFreeShipping ? 3990 : 0;
  const total = subtotal + shippingFee;

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

            <div className="checkout-trust-badge">
              <ShieldCheck size={16} /> Compra 100% Protegida con Garantía de Calce por Patente
            </div>

            <button className="btn-proceed-checkout" onClick={() => alert('¡Redirigiendo a Pasarela de Pago Segura (WebPay / MercadoPago)!')}>
              <span>PROCESAR COMPRA SEGURA</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
