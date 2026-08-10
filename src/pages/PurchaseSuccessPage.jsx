import React, { useMemo } from 'react';
import { Check, CheckCircle2, FileText, MapPin, Package, ReceiptText, ShoppingBag, Truck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveMediaUrl } from '../services/api';
import { profilePath, ROUTES } from '../routes/paths';

const LAST_SUCCESSFUL_ORDER_KEY = 'repuestop_last_successful_order';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function readStoredOrder() {
  try {
    const raw = sessionStorage.getItem(LAST_SUCCESSFUL_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function PurchaseSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const order = useMemo(() => location.state?.order || readStoredOrder(), [location.state]);

  const items = order?.items || [];
  const orderNumber = order?.id ? String(order.id).padStart(6, '0') : 'confirmado';
  const address = [
    order?.compradorDireccion || order?.direccionEntrega || order?.address,
    order?.compradorComuna || order?.comuna,
    order?.compradorRegion || order?.region,
  ].filter(Boolean).join(', ');
  const shippingMethod = order?.courier || order?.deliveryTerms || order?.tipoEnvio || 'Entrega por coordinar';
  const isPickup = /retiro|tienda|store_pickup/i.test(shippingMethod);
  const subtotal = items.reduce((sum, item) => (
    sum + Number(item.precioUnitario || item.precio || item.unitPrice || 0) * Number(item.cantidad || item.quantity || 1)
  ), 0);
  const shippingFee = Number(order?.costoEnvio || order?.shippingFee || 0);
  const total = Number(order?.total || subtotal + shippingFee);
  const documentType = String(order?.tipoDocumentoTributario || order?.documentType || 'BOLETA').toUpperCase();

  return (
    <main className="purchase-success-page">
      <section className="purchase-success-card" aria-labelledby="purchase-success-title">
        <div className="purchase-success-hero">
          <div className="purchase-success-icon"><CheckCircle2 /></div>
          <span className="purchase-success-kicker"><Check size={14} /> Compra confirmada</span>
          <h1 id="purchase-success-title">¡Tu compra fue exitosa!</h1>
          <p>El pedido <strong>#{orderNumber}</strong> quedó pagado y la tienda ya puede comenzar a prepararlo.</p>
        </div>

        {order ? (
          <div className="purchase-success-content">
            <section className="purchase-success-products" aria-labelledby="success-products-title">
              <h2 id="success-products-title"><Package size={19} /> Productos comprados</h2>
              <div className="purchase-success-items">
                {items.map((item, index) => {
                  const name = item.nombre || item.productName || item.name || 'Repuesto';
                  const photo = resolveMediaUrl(item.imagenUrl || item.imageUrl || item.productPhotoUri || item.imageUrls?.[0]);
                  const quantity = Number(item.cantidad || item.quantity || 1);
                  const unitPrice = Number(item.precioUnitario || item.precio || item.unitPrice || 0);
                  return (
                    <article className="purchase-success-item" key={item.productoId || item.id || index}>
                      {photo ? <img src={photo} alt={name} /> : <div className="purchase-success-item-placeholder"><Package /></div>}
                      <div>
                        <strong>{name}</strong>
                        <span>{item.marca || item.brand || item.proveedorNombre || ''}</span>
                        <small>Cantidad: {quantity}</small>
                      </div>
                      <b>{formatCLP(unitPrice * quantity)}</b>
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="purchase-success-summary">
              <h2><ReceiptText size={19} /> Resumen del pedido</h2>
              <div className="purchase-success-info-row">
                <Truck size={17} />
                <div><span>Método de entrega</span><strong>{shippingMethod}</strong></div>
              </div>
              {!isPickup && (
                <div className="purchase-success-info-row">
                  <MapPin size={17} />
                  <div><span>Dirección de envío</span><strong>{address || 'Dirección no registrada'}</strong></div>
                </div>
              )}
              <div className="purchase-success-info-row">
                <FileText size={17} />
                <div><span>Documento tributario</span><strong>{documentType === 'FACTURA' ? 'Factura' : 'Boleta'}</strong></div>
              </div>
              <div className="purchase-success-totals">
                <div><span>Productos</span><strong>{formatCLP(subtotal)}</strong></div>
                <div><span>Envío</span><strong>{shippingFee ? formatCLP(shippingFee) : 'Sin costo'}</strong></div>
                <div className="purchase-success-total"><span>Total pagado</span><strong>{formatCLP(total)}</strong></div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="purchase-success-missing"><ShoppingBag /><p>Tu compra fue confirmada. Puedes consultar todos sus datos en Mis pedidos.</p></div>
        )}

        <div className="purchase-success-actions">
          <button type="button" className="purchase-success-primary" onClick={() => navigate(profilePath('pedidos'))}>Ver detalle del pedido</button>
          <button type="button" className="purchase-success-secondary" onClick={() => navigate(ROUTES.catalog)}>Seguir comprando</button>
        </div>
      </section>
    </main>
  );
}
