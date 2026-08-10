import React, { useState } from 'react';
import {
  X, Clock, Wrench, Truck, PackageCheck, User, Store,
  MapPin, Phone, Mail, FileText, Package, CreditCard, CheckCircle2, Copy, KeyRound
} from 'lucide-react';
import { OrderStatusBadge } from './OrderCard';
import { resolveShippingService } from '../data/shippingMethods';
import { resolveMediaUrl } from '../services/api';
import { getControlledOrderAction, isStorePickupOrder } from '../data/orderStatusFlow';

function initialsFromName(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

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
  const rawStatus = order?.estado || order?.status || 'PENDIENTE';
  const normStatus = String(rawStatus).toUpperCase();
  const [isUpdating, setIsUpdating] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [pickupPin, setPickupPin] = useState('');
  const [statusError, setStatusError] = useState('');

  if (!order) return null;

  const isSeller = mode === 'seller';

  const orderIdShort = String(order.id || '').slice(-6).toUpperCase();
  const items = order.items || [];

  const buyerName = order.compradorNombre || order.buyerName || order.usuarioNombre || 'Cliente RepuesTop';
  const buyerEmail = order.compradorEmail || order.buyerEmail || order.email || '—';
  const buyerPhone = order.compradorTelefono || order.buyerPhone || order.telefono || '—';
  const buyerRut = order.facturaRut || order.compradorRut || order.taxId || order.rutEmpresa || '—';
  const buyerAvatar = resolveMediaUrl(order.compradorFotoPerfil || order.buyerAvatar || order.buyerAvatarUrl);

  const sellerName = order.vendedorNombre || order.sellerName || order.nombreTienda || 'Tienda RepuesTop';
  const deliveryAddress = [
    order.compradorDireccion || order.direccionEntrega || order.address,
    order.compradorComuna || order.comuna,
    order.compradorRegion || order.region,
  ].filter(Boolean).join(', ') || 'Dirección de envío no registrada';
  const deliveryTerms = order.courier || order.deliveryTerms || order.tipoEnvio || 'Envío por coordinar';
  // Traduce el método de envío a español + ícono, con la misma lógica que la
  // ficha de producto usa para los métodos que declara la tienda.
  const shippingService = resolveShippingService(deliveryTerms);
  const ShippingIcon = shippingService.icon;
  const isStorePickup = isStorePickupOrder(order);
  const copyAddress = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(deliveryAddress).then(() => {
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 1500);
    });
  };

  const subtotal = Number(order.subtotal || order.total || 0);
  const shippingFee = Number(order.shippingFee || order.costoEnvio || 0);
  const totalSeller = Number(order.totalVendedor ?? order.totalSeller ?? (subtotal * 0.93));
  const totalBuyer = Number(order.total || (subtotal + shippingFee));

  const commissionRate = order.commissionRate ? order.commissionRate * 100 : subtotal > 250000 ? 5 : subtotal > 100000 ? 7 : 10;
  const repuestopFee = order.commissionSeller || Math.round(subtotal * (commissionRate / 100) * 1.19);
  const paymentProcessingFee = Number(order.comisionPasarela ?? Math.max(0, Math.round(subtotal * 0.025 * 1.19)));

  const timelineIndex = getTimelineIndex(normStatus);
  const controlledAction = getControlledOrderAction(order, mode);
  const sellers = [...new Map(items.map((item) => {
    const name = item.proveedorNombre || item.sellerName || sellerName;
    const id = item.proveedorId || item.sellerId || name;
    return [String(id), {
      id,
      name,
      logo: resolveMediaUrl(item.proveedorLogoUrl || item.sellerLogoUrl),
      phone: item.proveedorTelefono || item.sellerPhone || '',
      email: item.proveedorEmail || item.sellerEmail || '',
      address: [
        item.proveedorDireccion || item.sellerAddress,
        item.proveedorComuna || item.sellerCity,
        item.proveedorRegion || item.sellerRegion,
      ].filter(Boolean).join(', '),
      giro: item.proveedorGiro || '',
      horario: item.proveedorHorario || '',
    }];
  })).values()];

  const handleStatusSubmit = async () => {
    if (!onUpdateStatus || !controlledAction?.nextStatus || controlledAction.disabled) return;
    const pin = pickupPin.trim();
    if (controlledAction.requiresPin && !/^\d{6}$/.test(pin)) {
      setStatusError('Ingresa el código de retiro de 6 dígitos entregado al comprador.');
      return;
    }
    if (!controlledAction.requiresPin
      && !window.confirm(`${controlledAction.title}\n\n${controlledAction.message}`)) return;
    setIsUpdating(true);
    setStatusError('');
    try {
      await onUpdateStatus(order.id, controlledAction.nextStatus, controlledAction.requiresPin ? pin : undefined);
      setPickupPin('');
    } catch (error) {
      setStatusError(error.message || 'No se pudo actualizar el estado del pedido.');
    } finally {
      setIsUpdating(false);
    }
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

          <section className="order-participants-section" aria-labelledby="order-participants-title">
            <h3 id="order-participants-title"><User size={17} /> Participantes del pedido</h3>
            <div className="order-participants-grid">
              <article className="details-card-block person-highlight-card participant-card buyer-participant-card">
                <div className="person-highlight-header">
                  <div className="person-highlight-avatar">
                    {buyerAvatar ? <img src={buyerAvatar} alt={buyerName} /> : <><User size={20} /><span>{initialsFromName(buyerName)}</span></>}
                  </div>
                  <div className="person-highlight-copy">
                    <span className="person-highlight-eyebrow">Comprador</span>
                    <h4 className="person-highlight-name">{buyerName}</h4>
                  </div>
                </div>
                <div className="participant-information-list">
                  <a href={`mailto:${buyerEmail}`}><Mail size={14} /><span><small>Correo</small><strong>{buyerEmail}</strong></span></a>
                  <a href={`tel:${buyerPhone}`}><Phone size={14} /><span><small>Teléfono</small><strong>{buyerPhone}</strong></span></a>
                  {!isStorePickup && <div><MapPin size={14} /><span><small>Dirección de entrega</small><strong>{deliveryAddress}</strong></span></div>}
                  {(order.tipoDocumentoTributario || order.tipoDocumento || order.documentType) && (
                    <div><FileText size={14} /><span><small>Documento</small><strong>{String(order.tipoDocumentoTributario || order.tipoDocumento || order.documentType).toUpperCase() === 'FACTURA' ? `Factura · RUT ${buyerRut}` : 'Boleta electrónica'}</strong></span></div>
                  )}
                </div>
              </article>

              {sellers.map((seller) => (
                <article className="details-card-block person-highlight-card participant-card seller-participant-card" key={seller.id}>
                  <div className="person-highlight-header">
                    <div className="person-highlight-avatar seller-avatar">
                      {seller.logo ? <img src={seller.logo} alt={seller.name} /> : <><Store size={20} /><span>{initialsFromName(seller.name)}</span></>}
                    </div>
                    <div className="person-highlight-copy">
                      <span className="person-highlight-eyebrow">Tienda vendedora</span>
                      <h4 className="person-highlight-name">{seller.name}</h4>
                      {seller.giro && <p>{seller.giro}</p>}
                    </div>
                  </div>
                  <div className="participant-information-list">
                    {seller.email && <a href={`mailto:${seller.email}`}><Mail size={14} /><span><small>Correo</small><strong>{seller.email}</strong></span></a>}
                    {seller.phone && <a href={`tel:${seller.phone}`}><Phone size={14} /><span><small>Teléfono</small><strong>{seller.phone}</strong></span></a>}
                    {seller.address && <div><MapPin size={14} /><span><small>Ubicación de la tienda</small><strong>{seller.address}</strong></span></div>}
                    {seller.horario && <div><Clock size={14} /><span><small>Horario</small><strong>{seller.horario}</strong></span></div>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="order-details-grid">
            {/* Tarjeta de envío: método traducido a español con su ícono y color
                propios, y la dirección de entrega bien visible con copia rápida. */}
            <div className={`details-card-block shipping-highlight-card ${!onUpdateStatus ? 'full-width' : ''}`} style={{ '--shipping-color': shippingService.color, '--shipping-bg': shippingService.bg }}>
              <h3 className="section-subtitle">
                <Truck size={16} />
                <span>Envío</span>
              </h3>

              <div className="shipping-method-badge">
                <ShippingIcon size={16} />
                <span>{shippingService.label}</span>
              </div>

              {!isStorePickup && (
                <div className="shipping-address-block">
                  <MapPin size={16} />
                  <div className="shipping-address-copy">
                    <span className="info-label">Dirección de entrega</span>
                    <strong className="shipping-address-text">{deliveryAddress}</strong>
                  </div>
                  <button type="button" className="btn-copy-address" onClick={copyAddress} title="Copiar dirección">
                    {addressCopied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              )}
            </div>

            {/* La acción disponible replica el flujo controlado de la app móvil. */}
            {onUpdateStatus && (
              <div className="details-card-block status-update-block">
                <h3 className="section-subtitle">
                  <CheckCircle2 size={16} />
                  <span>Gestionar Estado del Pedido</span>
                </h3>
                {!controlledAction ? (
                  <p className="order-status-complete-message">Este pedido no tiene más avances disponibles para tu perfil.</p>
                ) : controlledAction.waiting ? (
                  <div className="order-status-waiting"><Clock size={17} /><span>{controlledAction.label}</span></div>
                ) : (
                  <div className="status-update-form controlled-status-form">
                    <div className="controlled-status-next">
                      <small>Siguiente estado permitido</small>
                      <strong>{controlledAction.label}</strong>
                      <p>{controlledAction.message}</p>
                    </div>
                    {controlledAction.requiresPin && (
                      <label className="controlled-status-pin">
                        <span><KeyRound size={15} /> Código de retiro</span>
                        <input
                          inputMode="numeric"
                          maxLength={6}
                          value={pickupPin}
                          onChange={(event) => setPickupPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          autoComplete="one-time-code"
                        />
                      </label>
                    )}
                    {statusError && <p className="order-status-action-error">{statusError}</p>}
                    <button
                      type="button"
                      className="btn-auth-primary btn-save-status"
                      disabled={isUpdating || controlledAction.disabled}
                      onClick={handleStatusSubmit}
                    >
                      {isUpdating ? 'Actualizando...' : controlledAction.label}
                    </button>
                  </div>
                )}
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
                  const photo = resolveMediaUrl(item.imagenUrl || item.imageUrl || item.productPhotoUri || (item.imageUrls && item.imageUrls[0]));
                  const name = item.nombre || item.productName || item.name || 'Repuesto de vehículo';
                  const brand = item.marca || item.productBrand || item.brand || '';
                  const sku = item.sku || item.productSku || '';
                  const qty = Number(item.cantidad || item.quantity || 1);
                  const price = Number(item.precioUnitario || item.precio || item.unitPrice || 0);

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
                  {paymentProcessingFee > 0 && (
                    <div className="financial-row deduction-row">
                      <span>Procesador de pago</span>
                      <strong className="negative-text">-{formatCLP(paymentProcessingFee)}</strong>
                    </div>
                  )}
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
