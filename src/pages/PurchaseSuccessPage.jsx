import React, { useEffect, useMemo, useState } from 'react';
import { Check, FileText, MapPin, Package, ReceiptText, ShoppingBag, Truck, XCircle } from 'lucide-react';
import deliveryTruck from '../assets/delivery-truck.webp';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getBuyerOrderByIdApi, resolveMediaUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();
  // plan_retorno_flow.md Fase 3: PagoController.retorno redirige aqui con
  // ?status=success&orderId=... El state/sessionStorage cubren el caso feliz (misma
  // pestaña); si no hay datos ahi (otra pestaña/dispositivo, storage limpiado) se
  // trae el pedido por id con el endpoint nuevo.
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const orderIdFromUrl = searchParams.get('orderId');
  const isFailure = status === 'failure';

  const storedOrder = useMemo(() => location.state?.order || readStoredOrder(), [location.state]);
  const [fetchedOrder, setFetchedOrder] = useState(null);
  const effectiveUserId = user?.userId || user?.buyerId || user?.compradorId || user?.id;

  useEffect(() => {
    if (storedOrder || !orderIdFromUrl || !effectiveUserId || isFailure) return;
    let active = true;
    getBuyerOrderByIdApi(effectiveUserId, orderIdFromUrl)
      .then((data) => { if (active) setFetchedOrder(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [storedOrder, orderIdFromUrl, effectiveUserId, isFailure]);

  const order = storedOrder || fetchedOrder;

  if (isFailure) {
    return (
      <main className="purchase-success-page">
        <section className="purchase-success-card" aria-labelledby="purchase-failure-title">
          <div className="purchase-success-hero">
            <div className="purchase-success-icon" style={{ background: '#fef2f2', color: '#b91c1c' }}><XCircle /></div>
            <h1 id="purchase-failure-title">Tu pago no pudo procesarse</h1>
            <p>El pago fue rechazado o cancelado. Puedes reintentarlo desde Mis pedidos.</p>
          </div>
          <div className="purchase-success-actions">
            <button type="button" className="purchase-success-primary" onClick={() => navigate(profilePath('pedidos'))}>Ir a Mis pedidos</button>
            <button type="button" className="purchase-success-secondary" onClick={() => navigate(ROUTES.catalog)}>Seguir comprando</button>
          </div>
        </section>
      </main>
    );
  }

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
  const orderDate = (() => {
    const raw = order?.fechaCreacion || order?.createdAt || order?.fecha;
    const date = raw ? new Date(raw) : new Date();
    return Number.isNaN(date.getTime())
      ? new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
      : date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return (
    <main className="purchase-success-page">
      <section className="purchase-success-card" aria-labelledby="purchase-success-title">
        <header className="purchase-receipt-head">
          <div>
            <span className="purchase-receipt-label">Comprobante de compra</span>
            <h1 id="purchase-success-title">Pedido #{orderNumber}</h1>
            <p>{orderDate}</p>
          </div>
          <span className="purchase-receipt-state"><Check size={13} strokeWidth={3} /> Pagado</span>
        </header>

        {/* Seguimiento del pedido con sus hitos, como el de los marketplaces locales. El
            camión de la app va sobre el hito actual y avanza un tramo corto de ida y
            vuelta: cruzar la pantalla entera dejaba la banda medio vacía y hacía ver el
            pedido más lejos de lo que está. CSS puro y respeta `prefers-reduced-motion`. */}
        <div className="purchase-journey">
          <div className="purchase-journey-track" aria-hidden="true">
            <span className="journey-road" />
            <span className="journey-dot is-done" />
            <span className="journey-dot is-current" />
            <span className="journey-dot" />
            <img className="journey-truck" src={deliveryTruck} alt="" />
          </div>
          <ol className="purchase-journey-stops">
            <li className="is-done">Pago confirmado</li>
            <li className="is-current">En preparación</li>
            <li>{isPickup ? 'Listo para retiro' : 'Entrega'}</li>
          </ol>
          <p className="purchase-journey-note">
            La tienda ya fue notificada y está preparando tu pedido. Te avisamos cuando lo despache.
          </p>
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

              {/* Las acciones viven al pie del resumen, no sueltas bajo la página: es
                  donde las ponen los marketplaces locales y donde ya está mirando quien
                  acaba de revisar el total. */}
              <div className="purchase-success-actions">
                <button type="button" className="purchase-success-primary" onClick={() => navigate(profilePath('pedidos'))}>Ver detalle del pedido</button>
                <button type="button" className="purchase-success-secondary" onClick={() => navigate(ROUTES.catalog)}>Seguir comprando</button>
              </div>
            </aside>
          </div>
        ) : (
          <div className="purchase-success-missing">
            <ShoppingBag />
            <p>Tu compra fue confirmada. Puedes consultar todos sus datos en Mis pedidos.</p>
            <div className="purchase-success-actions">
              <button type="button" className="purchase-success-primary" onClick={() => navigate(profilePath('pedidos'))}>Ver detalle del pedido</button>
              <button type="button" className="purchase-success-secondary" onClick={() => navigate(ROUTES.catalog)}>Seguir comprando</button>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}
