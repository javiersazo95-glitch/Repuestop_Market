import React, { useState } from 'react';
import {
  X, Check, ShieldCheck, Truck, Star, ShoppingBag,
  Store, Car, AlertTriangle, CheckCircle2, MessageSquare, MapPin, PackageCheck, Copy, BadgeCheck, ChevronRight, CreditCard, Landmark
} from 'lucide-react';
import { CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID, CATEGORY_IMAGE_BY_ID } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';

export default function ProductQuickViewModal({ product, activeVehicle, onClose, onAddToCart, onOpenQuote }) {
  const [activeTab, setActiveTab] = useState('specs'); // 'specs' | 'compatibilidad' | 'vendedor'
  const [quoteRequested, setQuoteRequested] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  if (!product) return null;

  const compatList = product.compatibilidad || [];
  const isCompatible = activeVehicle && compatList.length > 0 ? compatList.some(
    c => c.marca?.toLowerCase() === activeVehicle.marca?.toLowerCase() ||
         (c.modelo && c.modelo.toLowerCase().includes(activeVehicle.modelo?.toLowerCase()))
  ) : false;

  const sellerName = typeof product.vendedor === 'object'
    ? (product.vendedor.nombre || 'Tienda Verificada')
    : (product.vendedor || 'Tienda Verificada');

  const sellerCity = typeof product.vendedor === 'object'
    ? (product.vendedor.ciudad || product.ciudadVendedor || 'Santiago, RM')
    : (product.ciudadVendedor || product.ciudad || 'Santiago, RM');

  const isQuoteOnly = product.soloCotizacion || !product.precio || product.precio === 0;
  const images = (product.imagenes?.length ? product.imagenes : [product.imagen || CATEGORY_IMAGE_BY_ID[product.categoria]]).filter(Boolean);
  const stock = Number(product.stock ?? 0);
  const shippingMethods = String(product.metodosEnvio || '').split(',').map((item) => item.trim()).filter(Boolean);
  const categoryLabel = product.categoriaNombre || product.categoria || 'Repuestos';

  const specsList = product.especificaciones || [
    { label: 'Código OEM', val: product.oemCode || 'OEM-REF-100' },
    { label: 'Condición', val: product.condicion || 'Nuevo OEM Original' },
    { label: 'Origen', val: product.origen || 'Japón / Alemania' },
    { label: 'Garantía Escrita', val: `${product.garantiaDias || 90} Días` }
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="quickview-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="quickview-grid product-detail-redesign">
          {/* Left Column: High-Res Image & Badges */}
          <div className="quickview-media-col">
            <div className="main-image-wrap product-detail-image-stage">
              {images[activeImage] ? (
                <img
                  src={images[activeImage]}
                  alt={product.titulo}
                  className="quickview-product-img"
                />
              ) : (
                <CategoryIconTile
                  iconName={CATEGORY_ICON_BY_ID[product.categoria]}
                  color={CATEGORY_COLOR_BY_ID[product.categoria]}
                  size={64}
                />
              )}
              {product.descuento > 0 && (
                <span className="modal-discount-tag">-{product.descuento}% OFF</span>
              )}
              <span className={`product-detail-stock ${stock > 0 ? 'in-stock' : 'out-stock'}`}><PackageCheck size={14} />{stock > 0 ? `${stock} disponibles` : 'Sin stock'}</span>
            </div>
            {images.length > 1 && <div className="product-detail-thumbnails">{images.map((image, index) => <button type="button" key={image} className={activeImage === index ? 'active' : ''} onClick={() => setActiveImage(index)}><img src={image} alt={`Vista ${index + 1}`} /></button>)}</div>}

            {/* Compatibility Notification Banner */}
            {activeVehicle && (
              <div className={`compatibility-alert-box ${isCompatible ? 'match' : 'warning'}`}>
                {isCompatible ? (
                  <>
                    <CheckCircle2 size={20} className="icon-match" />
                    <div>
                      <strong>¡COMPATIBILIDAD CONFIRMADA!</strong>
                      <p>Este repuesto calza perfectamente en tu <strong>{activeVehicle.marca} {activeVehicle.modelo} ({activeVehicle.patente})</strong>.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={20} className="icon-warn" />
                    <div>
                      <strong>Verificación Recomendada</strong>
                      <p>Este producto podría no ser 100% compatible con tu patente activa ({activeVehicle.patente}).</p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="quick-trust-specs product-detail-trust">
              <div className="trust-spec-item"><ShieldCheck size={16} /> Compra protegida</div>
              <div className="trust-spec-item"><Truck size={16} /> Envío a todo Chile</div>
            </div>
          </div>

          {/* Right Column: Title, Prices, Tabs & Add to Cart */}
          <div className="quickview-details-col">
            <div className="modal-category-breadcrumb product-detail-breadcrumb">
              <span>{categoryLabel}</span>{product.subcategoria && <><ChevronRight size={13} /><span>{product.subcategoria}</span></>}
            </div>

            <h2 className="modal-product-title">{product.titulo}</h2>

            <div className="product-detail-seller-line"><Store size={15} /><strong>{sellerName}</strong><MapPin size={14} />{sellerCity}{product.vendedorVerificado && <span><BadgeCheck size={14} /> Tienda verificada</span>}</div>

            <div className="modal-oem-row">
              <span className="oem-label">Código OEM / Número de Parte:</span>
              <code className="oem-badge">{product.oemCode || 'Sin referencia OEM'}</code>
              {product.oemCode && <button className="product-detail-copy" type="button" onClick={() => navigator.clipboard?.writeText(product.oemCode)} aria-label="Copiar código OEM"><Copy size={13} /></button>}
              <span className="condition-badge">{product.condicion || 'Nuevo OEM Original'}</span>
            </div>

            <div className="modal-rating-row product-detail-rating-row">
              <div className="rating-stars">
                <Star size={16} className="star-filled" />
                <span className="score">{product.rating || 4.9}</span>
                <span className="count">({product.reviewsCount || 42} evaluaciones)</span>
              </div>
              <span className="sold-volume">{product.vendidos || 0} unidades vendidas</span>
            </div>

            {/* Price Box vs Quote Only Box */}
            <div className="modal-price-box product-detail-price-box">
              {isQuoteOnly ? (
                <div className="quote-only-header-pill">
                  <MessageSquare size={18} className="text-blue-500" />
                  <span className="price-main text-blue-600">Precio Bajo Cotización Directa</span>
                </div>
              ) : (
                <>
                  <span className="price-main">${Number(product.precio).toLocaleString('es-CL')}</span>
                  {product.precioOriginal > product.precio && (
                    <span className="price-strikethrough">${Number(product.precioOriginal).toLocaleString('es-CL')}</span>
                  )}
                  <span className="tax-included">IVA incluido • Boleta / Factura de Venta</span>
                </>
              )}
            </div>

            {shippingMethods.length > 0 && <div className="product-detail-shipping"><Truck size={15} /><div><strong>Opciones de entrega</strong><span>{shippingMethods.join(' · ')}</span></div></div>}

            {/* Modal Detail Tabs */}
            <div className="modal-tabs">
              <button 
                className={`modal-tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
                onClick={() => setActiveTab('specs')}
              >
                Ficha Técnica
              </button>
              <button 
                className={`modal-tab-btn ${activeTab === 'compatibilidad' ? 'active' : ''}`}
                onClick={() => setActiveTab('compatibilidad')}
              >
                Vehículos Compatibles ({compatList.length})
              </button>
              <button 
                className={`modal-tab-btn ${activeTab === 'vendedor' ? 'active' : ''}`}
                onClick={() => setActiveTab('vendedor')}
              >
                Vendedor
              </button>
            </div>

            {/* Tab Contents */}
            <div className="tab-body-container">
              {activeTab === 'specs' && (
                <div className="specs-tab-content">
                  <p className="product-desc">{product.descripcion || 'Pieza y repuesto garantizado con calce verificado por sistema de homologación oficial.'}</p>
                  <table className="specs-table">
                    <tbody>
                      {specsList.map((spec, i) => (
                        <tr key={i}>
                          <td className="lbl">{spec.label}</td>
                          <td className="val">{spec.val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'compatibilidad' && (
                <div className="compatibility-tab-content">
                  <p className="tab-note">Lista oficial de modelos donde este código OEM encaja directamente:</p>
                  <div className="compat-list">
                    {compatList.length > 0 ? (
                      compatList.map((item, i) => (
                        <div key={i} className="compat-item-row">
                          <Car size={16} className="car-icon" />
                          <div>
                            <strong>{item.marca} {item.modelo}</strong>
                            <span className="years"> (Años: {item.anioInicio ? `${item.anioInicio}-${item.anioFin}` : (item.anios ? item.anios.join(', ') : '2019-2024')})</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">Compatible con múltiples modelos mediante código OEM.</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'vendedor' && (
                <div className="vendedor-tab-content">
                  <div className="vendedor-profile-card">
                    <Store size={24} className="store-avatar-icon" />
                    <div>
                      <h4>{sellerName}</h4>
                      <p>Ubicación: {sellerCity} • RUT Comercial Verificado</p>
                      <div className="seller-badge-green"><ShieldCheck size={14} /> Tienda Acreditada en RepuesTop.cl</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <section className="marketplace-purchase-panel">
              <div className="marketplace-purchase-heading"><div><strong>Compra protegida RepuesTop</strong><span>Elige cómo quieres avanzar con este repuesto</span></div><ShieldCheck size={21} /></div>
              <div className="marketplace-payment-methods"><span><CreditCard size={15} /><b>Flow</b> Débito y crédito</span><span><Landmark size={15} /><b>Khipu</b> Transferencia bancaria</span></div>
            {/* CTA Buttons */}
            <div className="modal-cta-row marketplace-actions">
              {isQuoteOnly ? (
                <button className="btn-modal-add-cart bg-blue-600" onClick={() => onOpenQuote ? onOpenQuote(product) : setQuoteRequested(true)}>
                  <MessageSquare size={18} />
                  <span>Cotizar este repuesto con la tienda →</span>
                  </button>
              ) : (
                <>
                <button className="btn-modal-add-cart" disabled={stock <= 0} onClick={() => { onAddToCart && onAddToCart(product); onClose(); }}>
                  <ShoppingBag size={20} />
                  <span>{stock > 0 ? `Comprar ahora • $${Number(product.precio).toLocaleString('es-CL')}` : 'Producto sin stock'}</span>
                </button>
                <button className="marketplace-quote-link" type="button" onClick={() => onOpenQuote?.(product)}><MessageSquare size={16} /> Prefiero solicitar una cotización</button>
                </>
              )}
            </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
