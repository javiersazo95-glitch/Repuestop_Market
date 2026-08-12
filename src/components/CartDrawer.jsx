import React, { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, X, Trash2, Plus, Minus, ShieldCheck, Truck, ArrowRight, CheckCircle2, MapPin, Loader2, AlertTriangle, ReceiptText, Building2 } from 'lucide-react';
import { CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';
import BuyerAddressBook from './BuyerAddressBook';
import { getAddressesApi, checkoutCartApi } from '../services/api';

export default function CartDrawer({
  isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, activeVehicle,
  user, isLoggedIn, onOpenAuthModal, onOrderCreated, onClearCart,
}) {
  const userId = user?.userId ?? user?.id;
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showAddressManager, setShowAddressManager] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [documentType, setDocumentType] = useState('');
  const [invoiceData, setInvoiceData] = useState({
    rut: user?.facturaRut || '',
    razonSocial: user?.facturaRazonSocial || '',
    giro: user?.facturaGiro || '',
  });

  const needsAddress = cartItems.some((item) => {
    const method = String(item.shippingMethod || '').toLowerCase();
    return !method.includes('retiro') && !method.includes('tienda');
  });

  const loadAddresses = useCallback(() => {
    if (!userId) return;
    setAddressesLoading(true);
    getAddressesApi(userId)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAddresses(list);
        const principal = list.find((address) => address.esPrincipal);
        setSelectedAddressId((current) => current || String(principal?.id || list[0]?.id || ''));
      })
      .catch(() => setAddresses([]))
      .finally(() => setAddressesLoading(false));
  }, [userId]);

  useEffect(() => {
    if (isOpen && isLoggedIn && userId) loadAddresses();
  }, [isOpen, isLoggedIn, userId, loadAddresses]);

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => acc + (item.precio * item.quantity), 0);
  const shippingBySeller = new Map();
  cartItems.forEach((item) => {
    const fee = Number(item.shippingFee || 0);
    if (fee <= 0) return;
    const sellerKey = String(item.proveedorId || item.vendedor || item.id);
    if (!shippingBySeller.has(sellerKey)) shippingBySeller.set(sellerKey, fee);
  });
  const shippingFee = [...shippingBySeller.values()].reduce((sum, fee) => sum + fee, 0);
  const total = subtotal + shippingFee;
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedShippingMethods = [...new Set(cartItems.map((item) => item.shippingMethod).filter(Boolean))];

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      onOpenAuthModal?.();
      return;
    }
    if (!documentType) {
      setCheckoutError('Indica si necesitas boleta o factura para continuar.');
      return;
    }
    if (documentType === 'FACTURA' && !invoiceData.rut.trim()) {
      setCheckoutError('Ingresa el RUT de facturación.');
      return;
    }
    if (needsAddress && !selectedAddressId) {
      setCheckoutError('Selecciona la dirección donde quieres recibir tu pedido.');
      return;
    }
    setCheckingOut(true);
    setCheckoutError('');
    try {
      const order = await checkoutCartApi(userId, {
        direccionId: needsAddress ? selectedAddressId : '',
        metodoEnvio: selectedShippingMethods.join(' | '),
        tipoDocumentoTributario: documentType,
        facturaRut: documentType === 'FACTURA' ? invoiceData.rut.trim() : '',
        facturaRazonSocial: documentType === 'FACTURA' ? invoiceData.razonSocial.trim() : '',
        facturaGiro: documentType === 'FACTURA' ? invoiceData.giro.trim() : '',
      });
      onClearCart?.();
      if (onOrderCreated) onOrderCreated(order);
      else setOrderSuccess(order);
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
            <span className="count-badge">{cartCount}</span>
          </div>
          <button className="drawer-close-btn" onClick={onClose} aria-label="Cerrar carrito">
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
        <div className="cart-flow-note"><ShieldCheck size={16} /><span>Revisa productos, entrega y documento tributario antes de pagar.</span></div>

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
                  {item.imagen ? <img className="item-thumb cart-item-image" src={item.imagen} alt="" /> : (
                    <CategoryIconTile
                      iconName={CATEGORY_ICON_BY_ID[item.categoria]}
                      color={CATEGORY_COLOR_BY_ID[item.categoria]}
                      size={22}
                      className="item-thumb"
                    />
                  )}

                  <div className="item-details">
                    <h4 className="item-title">{item.titulo}</h4>
                    <span className="item-oem">OEM: {item.oemCode}</span>
                    <span className="cart-item-shipping"><Truck size={12} /> {item.shippingMethod || 'Entrega por coordinar'}</span>
                    
                    {activeVehicle && (
                      <span className="item-veh-tag">
                        ✓ Verificado para {activeVehicle.patente}
                      </span>
                    )}

                    <div className="item-price-row">
                      <span className="item-unit-price">${(item.precio * item.quantity).toLocaleString('es-CL')}</span>
                      
                      <div className="quantity-controls">
                        <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} aria-label={`Restar una unidad de ${item.titulo}`}>
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} aria-label={`Sumar una unidad de ${item.titulo}`}>
                          <Plus size={14} />
                        </button>
                      </div>

                      <button className="btn-remove-item" onClick={() => onRemoveItem(item.id)} aria-label={`Eliminar ${item.titulo} del carrito`}>
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
            <h3 className="cart-summary-title">Resumen de la compra</h3>
            <div className="summary-row">
              <span>Productos ({cartCount}):</span>
              <span>${subtotal.toLocaleString('es-CL')}</span>
            </div>
            <div className="summary-row">
              <span>Método de entrega:</span>
              <span className="cart-summary-shipping-method">{selectedShippingMethods.join(', ') || 'Por coordinar'}</span>
            </div>
            <div className="summary-row">
              <span>Costo de envío:</span>
              <span>{shippingFee > 0 ? `$${shippingFee.toLocaleString('es-CL')}` : needsAddress ? 'Por pagar / coordinar' : <strong className="green-text">Sin costo</strong>}</span>
            </div>

            <div className="total-row">
              <span>TOTAL (IVA Incluido):</span>
              <span className="total-amount">${total.toLocaleString('es-CL')}</span>
            </div>

            {isLoggedIn && needsAddress && (
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
                    <BuyerAddressBook usuarioId={userId} />
                  </div>
                )}
              </div>
            )}

            <section className="cart-document-section" aria-labelledby="cart-document-title">
              <div className="cart-document-heading"><ReceiptText size={17} /><div><strong id="cart-document-title">¿Necesitas boleta o factura?</strong><small>Esta información se enviará a la tienda para emitir tu documento.</small></div></div>
              <div className="cart-document-options">
                <label className={documentType === 'BOLETA' ? 'selected' : ''}>
                  <input type="radio" name="document-type" value="BOLETA" checked={documentType === 'BOLETA'} onChange={(event) => setDocumentType(event.target.value)} />
                  <ReceiptText /><span><strong>Boleta</strong><small>Compra personal</small></span>
                </label>
                <label className={documentType === 'FACTURA' ? 'selected' : ''}>
                  <input type="radio" name="document-type" value="FACTURA" checked={documentType === 'FACTURA'} onChange={(event) => setDocumentType(event.target.value)} />
                  <Building2 /><span><strong>Factura</strong><small>Compra empresa</small></span>
                </label>
              </div>
              {documentType === 'FACTURA' && (
                <div className="cart-invoice-fields">
                  <label><span>RUT empresa *</span><input value={invoiceData.rut} onChange={(event) => setInvoiceData((current) => ({ ...current, rut: event.target.value }))} placeholder="76.123.456-7" /></label>
                  <label><span>Razón social</span><input value={invoiceData.razonSocial} onChange={(event) => setInvoiceData((current) => ({ ...current, razonSocial: event.target.value }))} placeholder="Nombre de la empresa" /></label>
                  <label><span>Giro</span><input value={invoiceData.giro} onChange={(event) => setInvoiceData((current) => ({ ...current, giro: event.target.value }))} placeholder="Actividad comercial" /></label>
                </div>
              )}
            </section>

            <div className="checkout-trust-badge">
              <ShieldCheck size={16} /> Confirmación inmediata y compra protegida por RepuesTop
            </div>

            {checkoutError && <div className="cart-checkout-error"><AlertTriangle size={15} /> {checkoutError}</div>}

            <button
              className="btn-proceed-checkout"
              onClick={handleCheckout}
              disabled={checkingOut || (isLoggedIn && (!documentType || (documentType === 'FACTURA' && !invoiceData.rut.trim()) || (needsAddress && !selectedAddressId)))}
            >
              <span>{checkingOut ? 'Confirmando compra...' : isLoggedIn ? 'CONFIRMAR COMPRA' : 'INICIA SESIÓN PARA COMPRAR'}</span>
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
