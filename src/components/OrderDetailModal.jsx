import React, { useEffect, useState } from 'react';
import {
  X, Clock, Wrench, Truck, PackageCheck, User, Store,
  MapPin, Phone, Mail, FileText, Package, CreditCard, CheckCircle2, Copy, KeyRound,
  RotateCcw, Loader2, XCircle, AlertTriangle, FileUp, Star
} from 'lucide-react';
import { OrderStatusBadge } from './OrderCard';
import { resolveShippingService } from '../data/shippingMethods';
import { resolveMediaUrl, rateOrderApi } from '../services/api';
import { getControlledOrderAction, isStorePickupOrder, orderPaymentWindow } from '../data/orderStatusFlow';
import ConfirmDialog from './ConfirmDialog';
import { cancellationReasonLabel, cancellationReasonHint } from '../data/cancellationReason';

const SELLER_CANCEL_REASONS = [
  { code: 'SIN_STOCK', label: 'Sin stock disponible' },
  { code: 'ERROR_PRECIO', label: 'Error en el precio publicado' },
  { code: 'PRODUCTO_NO_DISPONIBLE', label: 'Producto dañado o no disponible' },
  { code: 'IMPOSIBILIDAD_DESPACHO', label: 'Imposibilidad de despacho a la dirección' },
  { code: 'OTRO', label: 'Otro motivo (especificar)' },
];

const COMMON_COURIERS = [
  'Starken',
  'Chilexpress',
  'Blue Express',
  'Correos de Chile',
  'Varmontt',
  'Pullman Cargo',
  'Transportes Chevalier',
  'Delivery Propio / Directo',
];

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
  sellerId,
  userId,
  onClose,
  onUpdateStatus,
  onRetryPayment,
  onCancelOrder,
  onCancelSellerOrder,
  onRegisterDispatch,
}) {
  const rawStatus = order?.estado || order?.status || 'PENDIENTE';
  const normStatus = String(rawStatus).toUpperCase();
  const [isUpdating, setIsUpdating] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [pickupPin, setPickupPin] = useState('');
  const [statusError, setStatusError] = useState('');
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [retryError, setRetryError] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [now, setNow] = useState(Date.now());

  // Seller Cancelation Modal State
  const [showSellerCancelModal, setShowSellerCancelModal] = useState(false);
  const [sellerCancelReason, setSellerCancelReason] = useState('SIN_STOCK');
  const [sellerCancelDetail, setSellerCancelDetail] = useState('');
  const [isCancellingSeller, setIsCancellingSeller] = useState(false);
  const [sellerCancelError, setSellerCancelError] = useState('');

  // Seller Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchCourier, setDispatchCourier] = useState(order?.courier || 'Starken');
  const [dispatchTrackingNumber, setDispatchTrackingNumber] = useState(order?.trackingNumber || '');
  const [dispatchShippingFee, setDispatchShippingFee] = useState(order?.shippingFee || '');
  const [dispatchVoucherFile, setDispatchVoucherFile] = useState(null);
  const [dispatchVoucherPreview, setDispatchVoucherPreview] = useState(null);
  const [isRegisteringDispatch, setIsRegisteringDispatch] = useState(false);
  const [dispatchError, setDispatchError] = useState('');

  // Buyer Rating Modal State (A4)
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [sellerRating, setSellerRating] = useState(5);
  const [productRatings, setProductRatings] = useState({});
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [ratingSuccess, setRatingSuccess] = useState(false);

  // El reloj corre por minuto solo mientras haya un plazo de pago que mostrar.
  const showsPaymentWindow = mode !== 'seller' && normStatus === 'PENDIENTE' && Boolean(onRetryPayment);
  useEffect(() => {
    if (!showsPaymentWindow) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, [showsPaymentWindow]);

  if (!order) return null;

  const isSeller = mode === 'seller';
  // Solo el comprador paga, y solo mientras el pedido siga sin pagarse.
  const canRetryPayment = !isSeller && normStatus === 'PENDIENTE' && Boolean(onRetryPayment);
  const paymentWindow = canRetryPayment ? orderPaymentWindow(order, now) : null;
  const canCancelOrder = !isSeller && normStatus === 'PENDIENTE' && Boolean(onCancelOrder);
  // Solo PENDIENTE y PAGADO: `PedidoCancelacionSupport` corta ahi ("Solo se pueden
  // cancelar pedidos pendientes") y con EN_PREPARACION el boton salia igual y el POST
  // moria en 400. Si el backend amplia la ventana, hay que ampliarla aca tambien.
  const canSellerCancel = isSeller && ['PENDIENTE', 'PAGADO'].includes(normStatus) && Boolean(onCancelSellerOrder);
  const cancellationReason = normStatus === 'CANCELADO' ? cancellationReasonLabel(order, isSeller ? 'seller' : 'buyer') : null;
  // La explicacion esta escrita para el comprador ("si pagaste, el reembolso...").
  // Al vendedor le basta la etiqueta: el motivo lo declaro el.
  const cancellationHint = cancellationReason && mode !== 'seller' ? cancellationReasonHint(order) : null;

  const orderIdShort = String(order.id || '').slice(-6).toUpperCase();
  const items = order.items || [];

  // `PedidoPostVentaSupport` solo acepta calificar pedidos ENTREGADO/FINALIZADO y rechaza
  // la segunda calificacion con "Este pedido ya ha sido calificado". Sin esta condicion el
  // boton seguia ahi despues de calificar y el reintento moria en un 400.
  const alreadyRated = items.some((item) => item.sellerRating != null || item.productRating != null);
  const canRateOrder = ['ENTREGADO', 'FINALIZADO', 'RECEIVED'].includes(normStatus) && !alreadyRated;

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

  const handleSellerCancelSubmit = async (e) => {
    e.preventDefault();
    if (!onCancelSellerOrder) return;
    if (sellerCancelReason === 'OTRO' && !sellerCancelDetail.trim()) {
      setSellerCancelError('Por favor describe el motivo de la cancelación.');
      return;
    }
    setIsCancellingSeller(true);
    setSellerCancelError('');
    try {
      await onCancelSellerOrder(order, {
        reasonCode: sellerCancelReason,
        reasonDetail: sellerCancelDetail.trim() || undefined,
      });
      setShowSellerCancelModal(false);
      onClose?.();
    } catch (err) {
      setSellerCancelError(err?.message || 'No se pudo cancelar el pedido.');
    } finally {
      setIsCancellingSeller(false);
    }
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!onRegisterDispatch) return;
    if (!dispatchCourier.trim() || !dispatchTrackingNumber.trim()) {
      setDispatchError('Por favor completa la empresa de transporte y el número de seguimiento.');
      return;
    }
    setIsRegisteringDispatch(true);
    setDispatchError('');
    try {
      await onRegisterDispatch(order, {
        courier: dispatchCourier.trim(),
        trackingNumber: dispatchTrackingNumber.trim(),
        valorEnvio: dispatchShippingFee ? Number(dispatchShippingFee) : undefined,
        comprobante: dispatchVoucherFile || undefined,
      });
      setShowDispatchModal(false);
    } catch (err) {
      setDispatchError(err?.message || 'No se pudo registrar el envío.');
    } finally {
      setIsRegisteringDispatch(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDispatchVoucherFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setDispatchVoucherPreview(ev.target?.result || null);
      reader.readAsDataURL(file);
    } else {
      setDispatchVoucherPreview(null);
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
                      <span className="person-highlight-eyebrow">Tienda Vendedora</span>
                      <h4 className="person-highlight-name">{seller.name}</h4>
                    </div>
                  </div>
                  <div className="participant-information-list">
                    {seller.email && <a href={`mailto:${seller.email}`}><Mail size={14} /><span><small>Correo</small><strong>{seller.email}</strong></span></a>}
                    {seller.phone && <a href={`tel:${seller.phone}`}><Phone size={14} /><span><small>Teléfono</small><strong>{seller.phone}</strong></span></a>}
                    {seller.address && <div><MapPin size={14} /><span><small>Ubicación</small><strong>{seller.address}</strong></span></div>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Delivery Details Block */}
          <div className="details-card-block delivery-details-block">
            <div className="delivery-block-header">
              <h3 className="section-subtitle">
                <Truck size={16} />
                <span>Información de Entrega y Despacho</span>
              </h3>
              <span className="delivery-badge-pill">{deliveryTerms}</span>
            </div>

            <div className="delivery-info-grid">
              <div className="delivery-info-item">
                <span className="info-label">Tipo de Entrega</span>
                <strong className="info-value">{isStorePickup ? 'Retiro en Tienda' : 'Despacho a Domicilio'}</strong>
              </div>

              {!isStorePickup && (
                <div className="delivery-info-item full-width">
                  <span className="info-label">Dirección de Destino</span>
                  <div className="address-copy-row">
                    <strong className="info-value address-text">{deliveryAddress}</strong>
                    <button
                      type="button"
                      className="btn-copy-address"
                      onClick={copyAddress}
                      title="Copiar dirección completa"
                    >
                      {addressCopied ? <CheckCircle2 size={15} className="text-emerald" /> : <Copy size={15} />}
                      <span>{addressCopied ? '¡Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              )}

              {order.trackingNumber && (
                <div className="delivery-info-item">
                  <span className="info-label">N° de Seguimiento</span>
                  <strong className="info-value">{order.trackingNumber}</strong>
                </div>
              )}

              {order.courier && (
                <div className="delivery-info-item">
                  <span className="info-label">Courier de Transporte</span>
                  <strong className="info-value">{order.courier}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Items / Products Table with C2 item cancellation support */}
          <div className="details-card-block order-products-block">
            <h3 className="section-subtitle">
              <Package size={16} />
              <span>Repuestos en el Pedido ({items.length})</span>
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

                  const itemStatus = String(item.estado || item.status || '').toUpperCase();
                  const isItemCancelled = [
                    'CANCELADO_BLOQUEO_VENDEDOR',
                    'CANCELADO_VENDEDOR',
                    'CANCELADO_EXPIRACION_PAGO',
                    'CANCELADO_COMPRADOR',
                    'CANCELADO',
                    'CANCELLED'
                  ].includes(itemStatus);

                  return (
                    <div key={item.id || i} className={`order-item-row ${isItemCancelled ? 'order-item-row--cancelled' : ''}`}>
                      {photo ? (
                        <img src={photo} alt={name} className="item-table-img" />
                      ) : (
                        <div className="item-table-fallback">
                          <Package size={20} />
                        </div>
                      )}
                      <div className="item-table-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong className="item-table-name">{name}</strong>
                          {isItemCancelled && (
                            <span className="item-cancelled-badge">Cancelado</span>
                          )}
                        </div>
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

        {/* Motivo de Cancelación */}
        {cancellationReason && (
          <div className="order-cancellation-block">
            <strong>{cancellationReason}</strong>
            {cancellationHint && <span>{cancellationHint}</span>}
          </div>
        )}

        {statusError && (
          <div className="auth-alert alert-error" style={{ margin: '0 24px 12px' }}>
            <AlertTriangle size={16} />
            <span>{statusError}</span>
          </div>
        )}

        {/* Plazo de Pago */}
        {paymentWindow && (
          <p className={`order-payment-window in-modal ${paymentWindow.expired ? 'is-expired' : ''}`}>
            <Clock size={14} />
            <span>
              {paymentWindow.expired
                ? 'El plazo para pagar venció. Este pedido se cancela y la unidad vuelve al stock; puedes volver a comprarla.'
                : `${paymentWindow.label}. Pasado ese plazo el pedido se cancela y la unidad vuelve al stock.`}
            </span>
          </p>
        )}

        <div className="order-modal-footer">
          {/* Acción principal del Vendedor */}
          {isSeller && controlledAction && !controlledAction.disabled && (
            normStatus === 'EN_PREPARACION' && !isStorePickup ? (
              <button
                type="button"
                className="btn-auth-primary"
                onClick={() => {
                  setDispatchCourier(order?.courier || 'Starken');
                  setDispatchTrackingNumber(order?.trackingNumber || '');
                  setDispatchShippingFee(order?.shippingFee || '');
                  setDispatchError('');
                  setShowDispatchModal(true);
                }}
              >
                <Truck size={16} />
                <span>Registrar Envío / Despacho</span>
              </button>
            ) : controlledAction.requiresPin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="input-with-icon" style={{ maxWidth: '160px' }}>
                  <KeyRound size={15} className="field-icon" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="PIN 6 dígitos"
                    value={pickupPin}
                    onChange={(e) => setPickupPin(e.target.value.replace(/\D/g, ''))}
                    style={{ textAlign: 'center', fontWeight: 'bold' }}
                  />
                </div>
                <button
                  type="button"
                  className="btn-auth-primary"
                  disabled={isUpdating || pickupPin.trim().length !== 6}
                  onClick={handleStatusSubmit}
                >
                  {isUpdating ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />}
                  <span>{controlledAction.label}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-auth-primary"
                disabled={isUpdating}
                onClick={handleStatusSubmit}
              >
                {isUpdating ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />}
                <span>{controlledAction.label}</span>
              </button>
            )
          )}

          {/* Retomar pago (Comprador) */}
          {canRetryPayment && (
            <button
              type="button"
              className="btn-auth-primary"
              disabled={isRetryingPayment}
              onClick={async () => {
                if (isRetryingPayment) return;
                setIsRetryingPayment(true);
                setRetryError('');
                try {
                  await onRetryPayment(order);
                } catch (err) {
                  setRetryError(err?.message || 'No se pudo regenerar el intento de pago.');
                } finally {
                  setIsRetryingPayment(false);
                }
              }}
            >
              {isRetryingPayment ? <Loader2 size={16} className="spin-icon" /> : <RotateCcw size={16} />}
              {isRetryingPayment ? 'Abriendo pago…' : 'Retomar pago'}
            </button>
          )}

          {/* Cancelar pedido (Comprador) */}
          {canCancelOrder && (
            <button type="button" className="btn-auth-danger" onClick={() => setConfirmCancel(true)}>
              <XCircle size={16} />
              Cancelar pedido
            </button>
          )}

          {/* Cancelar pedido (Vendedor) */}
          {canSellerCancel && (
            <button
              type="button"
              className="btn-auth-danger"
              onClick={() => {
                setSellerCancelReason('SIN_STOCK');
                setSellerCancelDetail('');
                setSellerCancelError('');
                setShowSellerCancelModal(true);
              }}
            >
              <XCircle size={16} />
              <span>Cancelar Pedido</span>
            </button>
          )}

          {/* Confirmar Recepción (Comprador) */}
          {!isSeller && (normStatus === 'ENVIADO' || normStatus === 'LISTO_PARA_RETIRO' || normStatus === 'DISPATCHED') && (
            <button
              type="button"
              className="btn-auth-primary"
              disabled={isUpdating}
              onClick={async () => {
                setIsUpdating(true);
                setStatusError('');
                try {
                  await onUpdateStatus(order.id, 'ENTREGADO');
                } catch (err) {
                  setStatusError(err?.message || 'No se pudo confirmar la recepción.');
                } finally {
                  setIsUpdating(false);
                }
              }}
            >
              {isUpdating ? <Loader2 size={16} className="spin-icon" /> : <PackageCheck size={16} />}
              <span>Confirmar Recepción</span>
            </button>
          )}

          {/* Calificar Compra (Comprador) */}
          {!isSeller && canRateOrder && (
            <button
              type="button"
              className="btn-auth-primary"
              onClick={() => {
                const initialProductRatings = {};
                items.forEach((item) => {
                  const pId = item.productoId || item.id;
                  if (pId) initialProductRatings[pId] = 5;
                });
                setProductRatings(initialProductRatings);
                setSellerRating(5);
                setRatingError('');
                setRatingSuccess(false);
                setShowRatingModal(true);
              }}
            >
              <Star size={16} />
              <span>Calificar Compra</span>
            </button>
          )}

          <button type="button" className="btn-auth-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {/* Modal de Cancelación por parte del Vendedor (A2, C1) */}
        {showSellerCancelModal && (
          <div className="order-modal-backdrop" onClick={() => setShowSellerCancelModal(false)}>
            <div className="order-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
              <div className="order-modal-header">
                <div className="order-modal-header-left">
                  <div className="order-modal-icon-badge" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
                    <XCircle size={20} />
                  </div>
                  <div>
                    <h3 className="order-modal-title">Cancelar Pedido #{orderIdShort}</h3>
                    <span className="order-modal-subtitle">Indica el motivo de la cancelación para el cliente</span>
                  </div>
                </div>
                <button className="order-modal-close-btn" onClick={() => setShowSellerCancelModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSellerCancelSubmit} className="order-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {sellerCancelError && (
                  <div className="auth-alert alert-error">
                    <AlertTriangle size={15} />
                    <span>{sellerCancelError}</span>
                  </div>
                )}

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Motivo de la cancelación *
                  </label>
                  <select
                    value={sellerCancelReason}
                    onChange={(e) => setSellerCancelReason(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {SELLER_CANCEL_REASONS.map((r) => (
                      <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Detalle o explicación {sellerCancelReason === 'OTRO' ? '*' : '(opcional)'}
                  </label>
                  <textarea
                    required={sellerCancelReason === 'OTRO'}
                    rows={3}
                    maxLength={300}
                    placeholder={sellerCancelReason === 'OTRO' ? 'Escribe aquí la razón de la cancelación...' : 'Información adicional para el cliente...'}
                    value={sellerCancelDetail}
                    onChange={(e) => setSellerCancelDetail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    className="btn-auth-secondary"
                    onClick={() => setShowSellerCancelModal(false)}
                    disabled={isCancellingSeller}
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    className="btn-auth-danger"
                    disabled={isCancellingSeller}
                  >
                    {isCancellingSeller ? 'Cancelando...' : 'Confirmar Cancelación'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Registro de Despacho (A3) */}
        {showDispatchModal && (
          <div className="order-modal-backdrop" onClick={() => setShowDispatchModal(false)}>
            <div className="order-modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
              <div className="order-modal-header">
                <div className="order-modal-header-left">
                  <div className="order-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#0066ff' }}>
                    <Truck size={20} />
                  </div>
                  <div>
                    <h3 className="order-modal-title">Registrar Despacho de Envío</h3>
                    <span className="order-modal-subtitle">Pedido #{orderIdShort} · Destino: {order.compradorComuna || 'Chile'}</span>
                  </div>
                </div>
                <button className="order-modal-close-btn" onClick={() => setShowDispatchModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleDispatchSubmit} className="order-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {dispatchError && (
                  <div className="auth-alert alert-error">
                    <AlertTriangle size={15} />
                    <span>{dispatchError}</span>
                  </div>
                )}

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Empresa de transporte (Courier) *
                  </label>
                  <input
                    type="text"
                    required
                    list="couriers-list"
                    placeholder="Ej: Starken, Chilexpress, Blue Express..."
                    value={dispatchCourier}
                    onChange={(e) => setDispatchCourier(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                    }}
                  />
                  <datalist id="couriers-list">
                    {COMMON_COURIERS.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Número de Orden de Flete / Seguimiento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 1234567890"
                    value={dispatchTrackingNumber}
                    onChange={(e) => setDispatchTrackingNumber(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                    }}
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Valor del envío (opcional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej: 4500"
                    value={dispatchShippingFee}
                    onChange={(e) => setDispatchShippingFee(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                    }}
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Comprobante de envío / Voucher (opcional)
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px dashed #94a3b8',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                  }}>
                    <FileUp size={20} color="#0066ff" />
                    <span style={{ fontSize: '12.5px', color: '#475569' }}>
                      {dispatchVoucherFile ? dispatchVoucherFile.name : 'Adjuntar foto o PDF del comprobante'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {dispatchVoucherPreview && (
                    <div style={{ marginTop: '4px', maxHeight: '100px', overflow: 'hidden', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <img src={dispatchVoucherPreview} alt="Comprobante" style={{ width: '100%', height: 'auto', display: 'block' }} />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    className="btn-auth-secondary"
                    onClick={() => setShowDispatchModal(false)}
                    disabled={isRegisteringDispatch}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-auth-primary"
                    disabled={isRegisteringDispatch || !dispatchCourier.trim() || !dispatchTrackingNumber.trim()}
                  >
                    {isRegisteringDispatch ? 'Registrando...' : 'Confirmar Envío'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Calificación de Pedido para el Comprador (A4) */}
        {showRatingModal && (
          <div className="order-modal-backdrop" onClick={() => setShowRatingModal(false)}>
            <div className="order-modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
              <div className="order-modal-header">
                <div className="order-modal-header-left">
                  <div className="order-modal-icon-badge" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                    <Star size={20} />
                  </div>
                  <div>
                    <h3 className="order-modal-title">Calificar Compra #{orderIdShort}</h3>
                    <span className="order-modal-subtitle">Tu opinión ayuda a mantener la calidad en RepuesTop</span>
                  </div>
                </div>
                <button className="order-modal-close-btn" onClick={() => setShowRatingModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (isSubmittingRating) return;
                  setIsSubmittingRating(true);
                  setRatingError('');
                  try {
                    const effectiveUserId = userId || order?.compradorId || order?.usuarioId;
                    if (!effectiveUserId) throw new Error('No se pudo identificar tu cuenta de usuario.');
                    const itemsPayload = items.map((item) => {
                      const pId = item.productoId || item.id;
                      return {
                        productoId: Number(pId) || 0,
                        sellerRating: Number(sellerRating) || 5,
                        productRating: Number(productRatings[pId]) || 5,
                      };
                    });
                    await rateOrderApi(effectiveUserId, order.id, itemsPayload);
                    setRatingSuccess(true);
                    setTimeout(() => {
                      setShowRatingModal(false);
                    }, 1400);
                  } catch (err) {
                    setRatingError(err?.message || 'No se pudo guardar la calificación.');
                  } finally {
                    setIsSubmittingRating(false);
                  }
                }}
                className="order-modal-body"
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                {ratingSuccess ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#16a34a' }}>
                    <CheckCircle2 size={40} style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ margin: '0 0 6px', fontSize: '17px' }}>¡Muchas gracias por tu calificación!</h4>
                    <p style={{ margin: 0, fontSize: '13.5px', color: '#475569' }}>Tus valoraciones fueron registradas con éxito.</p>
                  </div>
                ) : (
                  <>
                    {ratingError && (
                      <div className="auth-alert alert-error">
                        <AlertTriangle size={15} />
                        <span>{ratingError}</span>
                      </div>
                    )}

                    {/* Calificación del Vendedor */}
                    <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                        Atención y servicio de {sellerNames[0] || 'la tienda vendedora'}:
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setSellerRating(star)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                          >
                            <Star
                              size={24}
                              fill={star <= sellerRating ? '#f59e0b' : 'none'}
                              color={star <= sellerRating ? '#f59e0b' : '#94a3b8'}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Calificación por Producto */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Calidad de los repuestos
                      </span>
                      {items.map((item, idx) => {
                        const pId = item.productoId || item.id || idx;
                        const currentProductRating = productRatings[pId] || 5;
                        const pName = item.nombre || item.productName || item.name || 'Repuesto';
                        return (
                          <div key={pId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                            <span style={{ fontSize: '13.5px', color: '#1e293b', maxWidth: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {pName}
                            </span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setProductRatings((prev) => ({ ...prev, [pId]: star }))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                                >
                                  <Star
                                    size={18}
                                    fill={star <= currentProductRating ? '#f59e0b' : 'none'}
                                    color={star <= currentProductRating ? '#f59e0b' : '#94a3b8'}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botones de acción */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                      <button type="button" className="btn-auth-secondary" onClick={() => setShowRatingModal(false)} disabled={isSubmittingRating}>
                        Cancelar
                      </button>
                      <button type="submit" className="btn-auth-primary" disabled={isSubmittingRating} style={{ width: 'auto', padding: '0 20px' }}>
                        {isSubmittingRating ? <Loader2 size={16} className="spin-icon" /> : <Star size={16} />}
                        <span>Guardar Calificación</span>
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={confirmCancel}
          title="¿Cancelar este pedido?"
          message="Las unidades vuelven al stock y el pedido queda cancelado. Esta acción no se puede deshacer; si aún quieres el repuesto tendrás que comprarlo de nuevo."
          confirmLabel="Sí, cancelar pedido"
          cancelLabel="No, mantenerlo"
          isBusy={isCancelling}
          error={cancelError}
          onCancel={() => { if (!isCancelling) { setConfirmCancel(false); setCancelError(''); } }}
          onConfirm={async () => {
            setIsCancelling(true);
            setCancelError('');
            try {
              await onCancelOrder(order);
              setConfirmCancel(false);
              onClose?.();
            } catch (err) {
              setCancelError(err?.message || 'No se pudo cancelar el pedido.');
            } finally {
              setIsCancelling(false);
            }
          }}
        />
        {retryError && <p className="order-modal-retry-error">{retryError}</p>}
      </div>
    </div>
  );
}
