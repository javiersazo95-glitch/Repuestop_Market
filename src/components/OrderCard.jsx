import React, { useState } from 'react';
import {
  Clock, Wrench, Truck, PackageCheck, ShieldCheck, AlertCircle, XCircle,
  RotateCcw, FileText, User, Store, Package, Info, ChevronRight, Check,
  Phone, MapPin, Boxes
} from 'lucide-react';
import { resolveMediaUrl } from '../services/api';
import { getControlledOrderAction, isStorePickupOrder } from '../data/orderStatusFlow';

export const UNIFIED_STATUS_CONFIG = {
  PENDIENTE: { label: 'Pendiente de pago', icon: Clock, className: 'badge-amber', tone: 'amber' },
  pending: { label: 'Pendiente de pago', icon: Clock, className: 'badge-amber', tone: 'amber' },
  PAGADO: { label: 'Pagado', icon: Clock, className: 'badge-amber', tone: 'amber' },
  EN_PREPARACION: { label: 'En preparación', icon: Wrench, className: 'badge-amber-dark', tone: 'amber' },
  preparing: { label: 'En preparación', icon: Wrench, className: 'badge-amber-dark', tone: 'amber' },
  ENVIADO: { label: 'Enviado', icon: Truck, className: 'badge-blue', tone: 'blue' },
  sent: { label: 'Enviado', icon: Truck, className: 'badge-blue', tone: 'blue' },
  LISTO_RETIRO: { label: 'Listo para retirar', icon: Store, className: 'badge-blue', tone: 'blue' },
  ENTREGADO: { label: 'Entregado', icon: PackageCheck, className: 'badge-green', tone: 'green' },
  received: { label: 'Recibido', icon: PackageCheck, className: 'badge-green', tone: 'green' },
  FINALIZADO: { label: 'Finalizado', icon: ShieldCheck, className: 'badge-emerald', tone: 'green' },
  finished: { label: 'Finalizado', icon: ShieldCheck, className: 'badge-emerald', tone: 'green' },
  EN_MEDIACION: { label: 'En mediación', icon: AlertCircle, className: 'badge-purple', tone: 'purple' },
  mediation: { label: 'En mediación', icon: AlertCircle, className: 'badge-purple', tone: 'purple' },
  CANCELADO: { label: 'Cancelado', icon: XCircle, className: 'badge-red', tone: 'red' },
  cancelled: { label: 'Cancelado', icon: XCircle, className: 'badge-red', tone: 'red' },
  RETOMAR: { label: 'Retomar pago', icon: RotateCcw, className: 'badge-red-outline', tone: 'red' },
  retomar: { label: 'Retomar pago', icon: RotateCcw, className: 'badge-red-outline', tone: 'red' },
};

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function formatOrderDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrderStatusBadge({ status, size = 'medium' }) {
  const normalizedStatus = String(status || 'PENDIENTE').toUpperCase();
  const config = UNIFIED_STATUS_CONFIG[status] || UNIFIED_STATUS_CONFIG[normalizedStatus] || UNIFIED_STATUS_CONFIG.PENDIENTE;
  const Icon = config.icon;

  return (
    <span className={`order-status-badge ${config.className} badge-size-${size}`}>
      <Icon size={size === 'small' ? 12 : 14} />
      <span>{config.label}</span>
    </span>
  );
}

export default function OrderCard({
  order,
  mode = 'buyer',
  onSelectOrder,
  onUpdateStatus,
  withdrawalDate,
}) {
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [actionError, setActionError] = useState('');
  const isSeller = mode === 'seller';

  if (!order) return null;

  const items = order.items || [];
  const firstItem = items[0] || {};
  const extraCount = Math.max(0, items.length - 1);

  // Normalización de campos según comprador vs vendedor
  const rawStatus = order.estado || order.status || 'PENDIENTE';
  const normStatus = String(rawStatus).toUpperCase();
  const deliveryTerms = String(order.courier || order.deliveryTerms || order.tipoEnvio || order.compradorDireccion || order.direccionEntrega || 'Despacho a domicilio');
  const isStorePickup = isStorePickupOrder(order);
  const displayStatus = normStatus === 'ENVIADO' && isStorePickup ? 'LISTO_RETIRO' : rawStatus;

  const orderIdShort = String(order.id || '').slice(-6).toUpperCase();
  const orderDate = formatOrderDate(order.createdAt || order.fecha);
  const orderSource = order.source === 'quote' || order.origen === 'COTIZACION' ? 'Cotización' : 'Carrito';

  const buyerName = order.compradorNombre || order.buyerName || order.usuarioNombre || 'Cliente sin nombre';
  const buyerAvatar = resolveMediaUrl(order.compradorFotoPerfil || order.compradorAvatarUrl || order.buyerAvatarUrl || order.buyerAvatar || null);
  const buyerPhone = order.compradorTelefono || order.buyerPhone || order.telefono || '';
  const sellerName = order.vendedorNombre || order.sellerName || order.nombreTienda || 'Tienda RepuesTop';

  // Dirección real de despacho (no solo la etiqueta genérica "Despacho a domicilio"):
  // el vendedor la necesita para preparar el envío sin tener que abrir el detalle.
  const deliveryAddress = [
    order.compradorDireccion || order.direccionEntrega || order.address,
    order.compradorComuna || order.comuna,
    order.compradorRegion || order.region,
  ].filter(Boolean).join(', ');
  const shippingFee = Number(order.shippingFee || order.costoEnvio || 0);
  const itemsCount = items.reduce((total, item) => total + Number(item.cantidad || item.quantity || 1), 0) || 1;

  const firstItemPhoto = resolveMediaUrl(firstItem.imagenUrl || firstItem.imageUrl || firstItem.productPhotoUri || (firstItem.imageUrls && firstItem.imageUrls[0]));
  const firstItemName = firstItem.nombre || firstItem.productName || firstItem.name || 'Repuesto de auto';
  const firstItemBrand = firstItem.marca || firstItem.productBrand || firstItem.brand || '';
  const firstItemSku = firstItem.sku || firstItem.productSku || '';
  const firstItemPrice = Number(firstItem.precioUnitario || firstItem.precio || firstItem.unitPrice || 0);
  const firstItemQty = Number(firstItem.cantidad || firstItem.quantity || 1);

  const itemsSubtotal = items.reduce((total, item) => total + (Number(item.precioUnitario || item.precio || item.unitPrice || 0) * Number(item.cantidad || item.quantity || 1)), 0);
  const subtotal = Number(order.subtotal || itemsSubtotal || order.total || 0);
  const totalSeller = Number(order.totalVendedor ?? order.totalSeller ?? (subtotal * 0.93));
  const totalBuyer = Number(order.total || subtotal);

  // Cálculo de comisiones para el modal de información del vendedor
  const storedCommissionRate = Number(order.commissionRate ?? order.comisionTasaAplicada ?? 0);
  const commissionRate = storedCommissionRate > 0 ? (storedCommissionRate <= 1 ? storedCommissionRate * 100 : storedCommissionRate) : subtotal > 250000 ? 5 : subtotal > 100000 ? 7 : 10;
  const repuestopFee = order.commissionSeller || Math.round(subtotal * (commissionRate / 100) * 1.19);
  const paymentProcessingFee = Number(order.comisionPasarela ?? Math.max(0, Math.round(subtotal * 0.025 * 1.19)));
  const totalDeductions = repuestopFee + paymentProcessingFee;
  const paymentFailed = String(order.paymentStatus || '').toLowerCase() === 'failed' && !['CANCELADO', 'CANCELLED'].includes(normStatus);
  const hasRefund = ['REEMBOLSADO', 'REEMBOLSO_SOLICITADO'].includes(String(order.refundStatus || '').toUpperCase());

  const controlledAction = getControlledOrderAction(order, mode);

  // La app móvil solo permite avanzar al siguiente estado válido para cada rol.
  const handleQuickStatusChange = async (e) => {
    e.stopPropagation();
    if (!onUpdateStatus || !controlledAction || controlledAction.waiting || controlledAction.disabled) return;
    if (controlledAction.requiresPin) {
      onSelectOrder?.(order);
      return;
    }
    if (!window.confirm(`${controlledAction.title}\n\n${controlledAction.message}`)) return;
    setIsAdvancing(true);
    setActionError('');
    try {
      await onUpdateStatus(order.id, controlledAction.nextStatus);
    } catch (error) {
      setActionError(error.message || 'No se pudo actualizar el pedido.');
    } finally {
      setIsAdvancing(false);
    }
  };

  const renderStatusButton = () => {
    if (!onUpdateStatus || !controlledAction) return null;
    if (controlledAction.waiting) {
      return <span className="order-controlled-wait"><Clock size={14} /> {controlledAction.label}</span>;
    }
    return (
      <div className="order-controlled-action-wrap">
        <button
          type="button"
          className={`btn-order-action ${controlledAction.disabled ? 'btn-action-disabled' : isSeller ? 'btn-action-blue' : 'btn-action-green'}`}
          disabled={controlledAction.disabled || isAdvancing}
          onClick={handleQuickStatusChange}
        >
          {controlledAction.nextStatus === 'ENVIADO' ? <Truck size={14} /> : <Check size={14} />}
          <span>{isAdvancing ? 'Actualizando...' : controlledAction.label}</span>
        </button>
        {actionError && <small className="order-controlled-error">{actionError}</small>}
      </div>
    );
  };

  return (
    <>
      <div className="order-card-container" onClick={() => onSelectOrder && onSelectOrder(order)}>
        {/* Top Header Row */}
        <div className="order-card-header">
          <div className="order-card-title-group">
            <h3 className="order-card-id">Pedido #{orderIdShort}</h3>
            <span className="order-card-date-meta">
              {orderDate} · {orderSource}
            </span>
            {isSeller && (order.tipoDocumento || order.documentType) && (
              <span className="order-document-badge">
                <FileText size={12} />
                <span>{order.tipoDocumento === 'factura' || order.documentType === 'factura' ? 'Factura' : 'Boleta'}</span>
              </span>
            )}
          </div>
          <OrderStatusBadge status={displayStatus} size="small" />
        </div>

        {/* Persona Row (Buyer vs Seller profile) */}
        <div className="order-card-person-row">
          {isSeller ? (
            <>
              {buyerAvatar ? (
                <img src={buyerAvatar} alt={buyerName} className="person-avatar-img" />
              ) : (
                <div className="person-avatar-fallback">
                  <User size={15} />
                </div>
              )}
              <div className="person-copy">
                <strong className="person-name">{buyerName}</strong>
                <span className="person-role">Comprador</span>
              </div>
              {buyerPhone && (
                <a
                  className="person-contact-link"
                  href={`tel:${buyerPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  title="Llamar al comprador"
                >
                  <Phone size={13} /> {buyerPhone}
                </a>
              )}
            </>
          ) : (
            <>
              <div className="person-avatar-fallback store-fallback">
                <Store size={15} />
              </div>
              <div className="person-copy">
                <strong className="person-name">{sellerName}</strong>
                <span className="person-role">Vendedor</span>
              </div>
            </>
          )}
        </div>

        {/* Chips informativos: llenan el espacio en blanco de la card con datos
            reales del pedido (cantidad de productos, envío, forma de entrega). */}
        <div className="order-card-info-chips">
          <span className="order-info-chip"><Boxes size={13} /> {itemsCount} {itemsCount === 1 ? 'producto' : 'productos'}</span>
          {isStorePickup ? (
            <span className="order-info-chip"><Store size={13} /> Retiro en tienda</span>
          ) : shippingFee > 0 ? (
            <span className="order-info-chip"><Truck size={13} /> Envío: {formatCLP(shippingFee)}</span>
          ) : (
            <span className="order-info-chip"><Truck size={13} /> Despacho a domicilio</span>
          )}
          {isSeller && deliveryAddress && !isStorePickup && (
            <span className="order-info-chip address"><MapPin size={13} /> {deliveryAddress}</span>
          )}
        </div>

        {paymentFailed && (
          <div className="order-card-state-banner payment-failed">
            <AlertCircle size={18} />
            <div><strong>Pago fallido</strong><span>El comprador puede retomarlo desde su menú de pedidos.</span></div>
          </div>
        )}

        {hasRefund && (
          <div className="order-card-state-banner refund">
            <ShieldCheck size={18} />
            <div><strong>{String(order.refundStatus).toUpperCase() === 'REEMBOLSADO' ? 'Reembolsado' : 'Reembolso en proceso'}</strong></div>
          </div>
        )}

        {/* Product Details Row */}
        <div className="order-card-product-row">
          {firstItemPhoto ? (
            <img src={firstItemPhoto} alt={firstItemName} className="product-thumb-img" />
          ) : (
            <div className="product-thumb-fallback">
              <Package size={24} />
            </div>
          )}
          <div className="product-copy">
            <h4 className="product-title">{firstItemName}</h4>
            <span className="product-meta">
              {[firstItemBrand, firstItemSku ? `SKU ${firstItemSku}` : null].filter(Boolean).join(' · ')}
            </span>
            <span className="product-pricing">
              {formatCLP(isSeller ? firstItemPrice : firstItemPrice)} x {firstItemQty}
              {extraCount > 0 && <span className="extra-items-tag"> · +{extraCount} más</span>}
            </span>
          </div>
        </div>

        {/* Footer Row with Delivery and Price */}
        <div className="order-card-footer">
          <div className="delivery-info">
            <span className="footer-label">Entrega</span>
            <strong className="footer-value">
              {deliveryTerms}
            </strong>
          </div>

          <div className="total-info">
            <span className="footer-label">{isSeller ? 'Neto a recibir' : 'Total'}</span>
            <div className="total-amount-row">
              <strong className="total-amount">
                {formatCLP(isSeller ? totalSeller : totalBuyer)}
              </strong>
              {isSeller && (
                <button
                  type="button"
                  className="btn-commission-info"
                  title="Ver cálculo de comisión"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCommissionModal(true);
                  }}
                >
                  <Info size={16} />
                </button>
              )}
            </div>
            {isSeller && totalDeductions > 0 && (
              <span className="commission-deductions-note">
                Descuentos por servicio y pago: -{formatCLP(totalDeductions)}
              </span>
            )}
            {isSeller && (
              <span className="order-withdrawal-note">
                {normStatus === 'FINALIZADO'
                  ? withdrawalDate
                    ? `Retiro programado para el ${new Date(withdrawalDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : 'Listo para solicitar retiro'
                  : 'Finaliza el pedido para solicitar el retiro del dinero'}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Actions Row */}
        <div className="order-card-actions">
          <button
            type="button"
            className="btn-view-details"
            onClick={(e) => {
              e.stopPropagation();
              onSelectOrder?.(order);
            }}
          >
            <span>Ver detalles completos</span>
            <ChevronRight size={15} />
          </button>
          {renderStatusButton()}
        </div>
      </div>

      {/* Seller Commission Modal */}
      {showCommissionModal && (
        <div className="commission-modal-backdrop" onClick={() => setShowCommissionModal(false)}>
          <div className="commission-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="commission-modal-header">
              <div className="commission-icon-badge">
                <Info size={22} />
              </div>
              <h3>Comisión de servicio RepuesTop</h3>
            </div>
            <div className="commission-modal-body">
              <p>
                <strong>Tarifa de servicio RepuesTop:</strong> {commissionRate}% sobre productos ({formatCLP(subtotal)}). Comisión + IVA: {formatCLP(repuestopFee)}.
              </p>
              {paymentProcessingFee > 0 && (
                <p><strong>Costo procesador de pago:</strong> {formatCLP(paymentProcessingFee)}.</p>
              )}
              <p className="commission-highlight">
                <strong>Descuentos totales:</strong> -{formatCLP(totalDeductions)}
              </p>
              <p className="commission-footer-note">
                El porcentaje estándar de RepuesTop es 10% hasta $100.000, 7% hasta $250.000 y 5% sobre $250.000.
              </p>
            </div>
            <button
              type="button"
              className="btn-auth-primary"
              onClick={() => setShowCommissionModal(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
