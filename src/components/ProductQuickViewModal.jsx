import React, { useState } from 'react';
import {
  X, Check, ShieldCheck, Truck, Star, ShoppingBag,
  Store, Car, FileText, AlertTriangle, ChevronRight, CheckCircle2, MessageSquare
} from 'lucide-react';
import { CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID, CATEGORY_IMAGE_BY_ID } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';

export default function ProductQuickViewModal({ product, activeVehicle, onClose, onAddToCart }) {
  const [activeTab, setActiveTab] = useState('specs'); // 'specs' | 'compatibilidad' | 'vendedor'
  const [quoteRequested, setQuoteRequested] = useState(false);

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

        <div className="quickview-grid">
          {/* Left Column: High-Res Image & Badges */}
          <div className="quickview-media-col">
            <div className="main-image-wrap">
              {product.imagen || CATEGORY_IMAGE_BY_ID[product.categoria] ? (
                <img
                  src={product.imagen || CATEGORY_IMAGE_BY_ID[product.categoria]}
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
            </div>

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

            <div className="quick-trust-specs">
              <div className="trust-spec-item"><ShieldCheck size={16} /> Garantía: {product.garantiaDias || 90} Días</div>
              <div className="trust-spec-item"><Truck size={16} /> Despacho: {product.envioRapido ? 'Mismo Día / Express' : 'Estándar a Regiones'}</div>
            </div>
          </div>

          {/* Right Column: Title, Prices, Tabs & Add to Cart */}
          <div className="quickview-details-col">
            <div className="modal-category-breadcrumb">
              Repuestos &gt; {String(product.categoria || 'general').toUpperCase()} &gt; {product.subcategoria || 'Repuestos Mecánicos'}
            </div>

            <h2 className="modal-product-title">{product.titulo}</h2>

            <div className="modal-oem-row">
              <span className="oem-label">Código OEM / Número de Parte:</span>
              <code className="oem-badge">{product.oemCode || 'OEM-REF-100'}</code>
              <span className="condition-badge">{product.condicion || 'Nuevo OEM Original'}</span>
            </div>

            <div className="modal-rating-row">
              <div className="rating-stars">
                <Star size={16} className="star-filled" />
                <span className="score">{product.rating || 4.9}</span>
                <span className="count">({product.reviewsCount || 42} evaluaciones)</span>
              </div>
              <span className="sold-volume">{product.vendidos || 120} unidades vendidas</span>
            </div>

            {/* Price Box vs Quote Only Box */}
            <div className="modal-price-box">
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

            {/* CTA Buttons */}
            <div className="modal-cta-row">
              {isQuoteOnly ? (
                !quoteRequested ? (
                  <button className="btn-modal-add-cart bg-blue-600" onClick={() => setQuoteRequested(true)}>
                    <MessageSquare size={18} />
                    <span>Cotizar este repuesto con la tienda →</span>
                  </button>
                ) : (
                  <div className="quote-success-banner">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    <span>¡Solicitud enviada a <strong>{sellerName}</strong>! Te contactarán a la brevedad.</span>
                  </div>
                )
              ) : (
                <button className="btn-modal-add-cart" onClick={() => { onAddToCart && onAddToCart(product); onClose(); }}>
                  <ShoppingBag size={20} />
                  <span>Agregar al Carrito • ${Number(product.precio).toLocaleString('es-CL')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
