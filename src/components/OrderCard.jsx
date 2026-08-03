import React, { useState } from 'react';
import {
  Clock, Wrench, Truck, PackageCheck, ShieldCheck, AlertCircle, XCircle,
  RotateCcw, FileText, User, Store, Package, Info, ChevronRight, Check
} from 'lucide-react';

export const UNIFIED_STATUS_CONFIG = {
  PENDIENTE: { label: 'Pendiente de pago', icon: Clock, className: 'badge-amber', tone: 'amber' },
  pending: { label: 'Pendiente de pago', icon: Clock, className: 'badge-amber', tone: 'amber' },
  PAGADO: { label: 'Pagado', icon: Clock, className: 'badge-amber', tone: 'amber' },
  EN_PREPARACION: { label: 'En preparación', icon: Wrench, className: 'badge-amber-dark', tone: 'amber' },
  preparing: { label: 'En preparación', icon: Wrench, className: 'badge-amber-dark', tone: 'amber' },
  ENVIADO: { label: 'Enviado', icon: Truck, className: 'badge-blue', tone: 'blue' },
  sent: { label: 'Enviado', icon: Truck, className: 'badge-blue', tone: 'blue' },
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
}) {
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const isSeller = mode === 'seller';

  if (!order) return null;

  const items = order.items || [];
  const firstItem = items[0] || {};
  const extraCount = Math.max(0, items.length - 1);

  // Normalización de campos según comprador vs vendedor
  const rawStatus = order.estado || order.status || 'PENDIENTE';
  const normStatus = String(rawStatus).toUpperCase();

  const orderIdShort = String(order.id || '').slice(-6).toUpperCase();
  const orderDate = formatOrderDate(order.createdAt || order.fecha);
  const orderSource = order.source === 'quote' || order.origen === 'COTIZACION' ? 'Cotización' : 'Carrito';

  const buyerName = order.compradorNombre || order.buyerName || order.usuarioNombre || 'Cliente sin nombre';
  const buyerAvatar = order.compradorAvatarUrl || order.buyerAvatarUrl || null;
  const sellerName = order.vendedorNombre || order.sellerName || order.nombreTienda || 'Tienda RepuesTop';

  const firstItemPhoto = firstItem.imagenUrl || firstItem.productPhotoUri || (firstItem.imageUrls && firstItem.imageUrls[0]);
  const firstItemName = firstItem.nombre || firstItem.productName || firstItem.name || 'Repuesto de auto';
  const firstItemBrand = firstItem.marca || firstItem.productBrand || firstItem.brand || '';
  const firstItemSku = firstItem.sku || firstItem.productSku || '';
  const firstItemPrice = Number(firstItem.precio || firstItem.unitPrice || 0);
  const firstItemQty = Number(firstItem.cantidad || firstItem.quantity || 1);

  const subtotal = Number(order.subtotal || order.total || 0);
  const totalSeller = Number(order.totalVendedor ?? order.totalSeller ?? (subtotal * 0.93));
  const totalBuyer = Number(order.total || subtotal);

  // Cálculo de comisiones para el modal de información del vendedor
  const commissionRate = order.commissionRate ? order.commissionRate * 100 : subtotal > 250000 ? 5 : subtotal > 100000 ? 7 : 10;
  const repuestopFee = order.commissionSeller || Math.round(subtotal * (commissionRate / 100) * 1.19);
  const paymentProcessingFee = order.comisionPasarela || Math.max(0, Math.round(subtotal * 0.025 * 1.19));
  const totalDeductions = repuestopFee + paymentProcessingFee;

  // Lógica de cambio de estado
  const handleQuickStatusChange = (e, nextStatus) => {
    e.stopPropagation();
    if (onUpdateStatus) {
      onUpdateStatus(order.id, nextStatus);
    }
  };

  const renderStatusButton = () => {
    if (!onUpdateStatus) return null;

    if (isSeller) {
      if (normStatus === 'PENDIENTE' || normStatus === 'PAGADO') {
        return (
          <button
            type="button"
            className="btn-order-action btn-action-amber"
            onClick={(e) => handleQuickStatusChange(e, 'EN_PREPARACION')}
          >
            <Wrench size={14} />
            <span>Iniciar Preparación</span>
          </button>
        );
      }
      if (normStatus === 'EN_PREPARACION') {
        return (
          <button
            type="button"
            className="btn-order-action btn-action-blue"
            onClick={(e) => handleQuickStatusChange(e, 'ENVIADO')}
          >
            <Truck size={14} />
            <span>Marcar como Enviado</span>
          </button>
        );
      }
      if (normStatus === 'ENVIADO') {
        return (
          <button
            type="button"
            className="btn-order-action btn-action-green"
            onClick={(e) => handleQuickStatusChange(e, 'FINALIZADO')}
          >
            <Check size={14} />
            <span>Marcar como Finalizado</span>
          </button>
        );
      }
    } else {
      if (normStatus === 'ENVIADO') {
        return (
          <button
            type="button"
            className="btn-order-action btn-action-green"
            onClick={(e) => handleQuickStatusChange(e, 'ENTREGADO')}
          >
            <PackageCheck size={14} />
            <span>Confirmar Recepción</span>
          </button>
        );
      }
      if (normStatus === 'PENDIENTE') {
        return (
          <button
            type="button"
            className="btn-order-action btn-action-red"
            onClick={(e) => handleQuickStatusChange(e, 'RETOMAR')}
          >
            <RotateCcw size={14} />
            <span>Retomar Pago</span>
          </button>
        );
      }
    }
    return null;
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
          <OrderStatusBadge status={rawStatus} size="small" />
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
              {order.deliveryTerms || order.tipoEnvio || order.direccionEntrega || 'Despacho a domicilio'}
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
          </div>
        </div>

        {/* Bottom Actions Row */}
        <div className="order-card-actions">
          <button
            type="button"
            className="btn-view-details"
            onClick={(e) => {
              e.stopPropagation();
              onSelectOrder && onSelectOrder(order);
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
              <p>
                <strong>Costo procesador de pago (Flow / IVA inc.):</strong> {formatCLP(paymentProcessingFee)}.
              </p>
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
