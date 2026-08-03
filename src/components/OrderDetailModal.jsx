import React, { useState } from 'react';
import {
  X, Clock, Wrench, Truck, PackageCheck, ShieldCheck, User, Store,
  MapPin, Phone, Mail, FileText, Package, CreditCard, CheckCircle2, ChevronRight
} from 'lucide-react';
import { OrderStatusBadge } from './OrderCard';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function formatDate(value) {
  if (!value) return 'Fecha no especificada';
  return new Date(value).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TIMELINE_STEPS = [
  { key: 'PENDIENTE', label: 'Pendiente', icon: Clock },
  { key: 'EN_PREPARACION', label: 'En preparación', icon: Wrench },
  { key: 'ENVIADO', label: 'Enviado', icon: Truck },
  { key: 'FINALIZADO', label: 'Entregado/Finalizado', icon: PackageCheck },
];

function getTimelineIndex(status) {
  const norm = String(status || '').toUpperCase();
  if (norm === 'EN_PREPARACION' || norm === 'PREPARING') return 1;
  if (norm === 'ENVIADO' || norm === 'SENT') return 2;
  if (norm === 'ENTREGADO' || norm === 'RECEIVED' || norm === 'FINALIZADO' || norm === 'FINISHED') return 3;
  return 0; // PENDIENTE / PAGADO
}

export default function OrderDetailModal({
  order,
  mode = 'buyer',
  onClose,
  onUpdateStatus,
}) {
  if (!order) return null;

  const isSeller = mode === 'seller';
  const rawStatus = order.estado || order.status || 'PENDIENTE';
  const normStatus = String(rawStatus).toUpperCase();
  const [selectedNextStatus, setSelectedNextStatus] = useState(rawStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const orderIdShort = String(order.id || '').slice(-6).toUpperCase();
  const items = order.items || [];

  const buyerName = order.compradorNombre || order.buyerName || order.usuarioNombre || 'Cliente RepuesTop';
  const buyerEmail = order.compradorEmail || order.buyerEmail || order.email || '—';
  const buyerPhone = order.compradorTelefono || order.buyerPhone || order.telefono || '—';
  const buyerRut = order.compradorRut || order.taxId || order.rutEmpresa || '—';

  const sellerName = order.vendedorNombre || order.sellerName || order.nombreTienda || 'Tienda RepuesTop';
  const deliveryAddress = order.direccionEntrega || order.address || order.comuna ? `${order.direccionEntrega || ''} ${order.comuna || ''} ${order.region || ''}`.trim() : 'Despacho a domicilio';
  const deliveryTerms = order.deliveryTerms || order.tipoEnvio || 'Envío por Starken / Chilexpress';

  const subtotal = Number(order.subtotal || order.total || 0);
  const shippingFee = Number(order.shippingFee || order.costoEnvio || 0);
  const totalSeller = Number(order.totalVendedor ?? order.totalSeller ?? (subtotal * 0.93));
  const totalBuyer = Number(order.total || (subtotal + shippingFee));

  const commissionRate = order.commissionRate ? order.commissionRate * 100 : subtotal > 250000 ? 5 : subtotal > 100000 ? 7 : 10;
  const repuestopFee = order.commissionSeller || Math.round(subtotal * (commissionRate / 100) * 1.19);
  const paymentProcessingFee = order.comisionPasarela || Math.max(0, Math.round(subtotal * 0.025 * 1.19));

  const timelineIndex = getTimelineIndex(normStatus);

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!onUpdateStatus || selectedNextStatus === rawStatus) return;
    setIsUpdating(true);
    await onUpdateStatus(order.id, selectedNextStatus);
    setIsUpdating(false);
  };

  return (
    <div className="order-modal-backdrop" onClick={onClose}>
      <div className="order-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="order-modal-header">
          <div className="order-modal-title-group">
            <div className="order-modal-icon-badge">
              <Package size={22} />
            </div>
            <div>
              <h2>Detalles del Pedido #{orderIdShort}</h2>
              <span className="order-modal-subtitle">
                {formatDate(order.createdAt || order.fecha)} · {order.source === 'quote' ? 'Cotización' : 'Carrito'}
              </span>
            </div>
          </div>
          <div className="order-modal-header-actions">
            <OrderStatusBadge status={rawStatus} size="medium" />
            <button type="button" className="btn-close-modal" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="order-modal-body">
          {/* Timeline Step-by-Step Progress Bar */}
          <div className="order-timeline-card">
            <h3 className="section-subtitle">Estado del Pedido</h3>
            <div className="order-timeline-steps">
              {TIMELINE_STEPS.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = idx <= timelineIndex;
                const isCurrent = idx === timelineIndex;
                return (
                  <div
                    key={step.key}
                    className={`timeline-step-item ${isCompleted ? 'step-completed' : ''} ${isCurrent ? 'step-current' : ''}`}
                  >
                    <div className="step-icon-wrapper">
                      <StepIcon size={16} />
                    </div>
                    <span className="step-label">{step.label}</span>
                    {idx < TIMELINE_STEPS.length - 1 && <div className="step-line" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="order-details-grid">
            {/* Left Column: Customer & Shipping Info */}
            <div className="details-card-block">
              <h3 className="section-subtitle">
                {isSeller ? <User size={16} /> : <Store size={16} />}
                <span>{isSeller ? 'Información del Comprador' : 'Información de la Tienda'}</span>
              </h3>

              <div className="details-info-list">
                <div className="details-info-row">
                  <span className="info-label">Nombre</span>
                  <strong className="info-value">{isSeller ? buyerName : sellerName}</strong>
                </div>
                {isSeller && (
                  <>
                    <div className="details-info-row">
                      <span className="info-label"><Mail size={13} /> Correo</span>
                      <strong className="info-value">{buyerEmail}</strong>
                    </div>
                    <div className="details-info-row">
                      <span className="info-label"><Phone size={13} /> Teléfono</span>
                      <strong className="info-value">{buyerPhone}</strong>
                    </div>
                    {(order.tipoDocumento || order.documentType) && (
                      <div className="details-info-row">
                        <span className="info-label"><FileText size={13} /> Documento</span>
                        <strong className="info-value">
                          {order.tipoDocumento === 'factura' || order.documentType === 'factura'
                            ? `Factura (RUT: ${buyerRut})`
                            : 'Boleta Electrónica'}
                        </strong>
                      </div>
                    )}
                  </>
                )}

                <div className="details-info-row">
                  <span className="info-label"><MapPin size={13} /> Dirección de Entrega</span>
                  <strong className="info-value">{deliveryAddress}</strong>
                </div>
                <div className="details-info-row">
                  <span className="info-label"><Truck size={13} /> Método de Envío</span>
                  <strong className="info-value">{deliveryTerms}</strong>
                </div>
              </div>
            </div>

            {/* Right Column: Update Order Status */}
            {onUpdateStatus && (
              <div className="details-card-block status-update-block">
                <h3 className="section-subtitle">
                  <CheckCircle2 size={16} />
                  <span>Gestionar Estado del Pedido</span>
                </h3>
                <form onSubmit={handleStatusSubmit} className="status-update-form">
                  <label className="form-label">Seleccionar nuevo estado:</label>
                  <select
                    className="status-select-input"
                    value={selectedNextStatus}
                    onChange={(e) => setSelectedNextStatus(e.target.value)}
                  >
                    <option value="PENDIENTE">Pendiente de pago</option>
                    <option value="EN_PREPARACION">En preparación</option>
                    <option value="ENVIADO">Enviado</option>
                    <option value="ENTREGADO">Entregado</option>
                    <option value="FINALIZADO">Finalizado</option>
                    <option value="EN_MEDIACION">En mediación</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>

                  <button
                    type="submit"
                    className="btn-auth-primary btn-save-status"
                    disabled={isUpdating || selectedNextStatus === rawStatus}
                  >
                    {isUpdating ? 'Actualizando...' : 'Actualizar Estado'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Products List Table */}
          <div className="details-card-block">
            <h3 className="section-subtitle">
              <Package size={16} />
              <span>Repuestos del Pedido ({items.length})</span>
            </h3>

            {items.length === 0 ? (
              <p className="empty-text">No hay repuestos registrados en este pedido.</p>
            ) : (
              <div className="order-items-table">
                {items.map((item, i) => {
                  const photo = item.imagenUrl || item.productPhotoUri || (item.imageUrls && item.imageUrls[0]);
                  const name = item.nombre || item.productName || item.name || 'Repuesto de vehículo';
                  const brand = item.marca || item.productBrand || item.brand || '';
                  const sku = item.sku || item.productSku || '';
                  const qty = Number(item.cantidad || item.quantity || 1);
                  const price = Number(item.precio || item.unitPrice || 0);

                  return (
                    <div key={item.id || i} className="order-item-row">
                      {photo ? (
                        <img src={photo} alt={name} className="item-table-img" />
                      ) : (
                        <div className="item-table-fallback">
                          <Package size={20} />
                        </div>
                      )}
                      <div className="item-table-info">
                        <strong className="item-table-name">{name}</strong>
                        <span className="item-table-meta">
                          {[brand ? `Marca: ${brand}` : null, sku ? `SKU: ${sku}` : null].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <div className="item-table-pricing">
                        <span className="item-qty">x{qty}</span>
                        <strong className="item-subtotal">{formatCLP(price * qty)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Financial Breakdown Section */}
          <div className="details-card-block financial-summary-block">
            <h3 className="section-subtitle">
              <CreditCard size={16} />
              <span>Desglose Financiero</span>
            </h3>

            <div className="financial-rows-list">
              <div className="financial-row">
                <span>Subtotal Repuestos</span>
                <strong>{formatCLP(subtotal)}</strong>
              </div>
              {shippingFee > 0 && (
                <div className="financial-row">
                  <span>Costo de Envío</span>
                  <strong>{formatCLP(shippingFee)}</strong>
                </div>
              )}

              {isSeller && (
                <>
                  <div className="financial-row deduction-row">
                    <span>Comisión RepuesTop ({commissionRate}% + IVA)</span>
                    <strong className="negative-text">-{formatCLP(repuestopFee)}</strong>
                  </div>
                  <div className="financial-row deduction-row">
                    <span>Procesador de Pago Flow (IVA inc.)</span>
                    <strong className="negative-text">-{formatCLP(paymentProcessingFee)}</strong>
                  </div>
                </>
              )}

              <div className="financial-row total-highlight-row">
                <span>{isSeller ? 'Monto Neto a Recibir' : 'Total Pagado'}</span>
                <strong className="total-highlight-amount">
                  {formatCLP(isSeller ? totalSeller : totalBuyer)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="order-modal-footer">
          <button type="button" className="btn-auth-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
