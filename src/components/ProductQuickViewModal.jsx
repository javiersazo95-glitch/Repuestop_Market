import React, { useState } from 'react';
import { 
  X, Check, ShieldCheck, Truck, Star, ShoppingBag, 
  Store, Car, FileText, AlertTriangle, ChevronRight, CheckCircle2 
} from 'lucide-react';

export default function ProductQuickViewModal({ product, activeVehicle, onClose, onAddToCart }) {
  const [activeTab, setActiveTab] = useState('specs'); // 'specs' | 'compatibilidad' | 'vendedor'

  if (!product) return null;

  const isCompatible = activeVehicle ? product.compatibilidad.some(
    c => c.marca.toLowerCase() === activeVehicle.marca.toLowerCase() ||
         c.modelo.toLowerCase().includes(activeVehicle.modelo.toLowerCase())
  ) : false;

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
              <img src={product.imagen} alt={product.titulo} />
              {product.descuentoPercent > 0 && (
                <span className="modal-discount-tag">-{product.descuentoPercent}%</span>
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
              <div className="trust-spec-item"><ShieldCheck size={16} /> Garantía: {product.garantiaMeses} Meses</div>
              <div className="trust-spec-item"><Truck size={16} /> Despacho: {product.envioExpress ? 'Express 24 Horas' : 'Estándar 48 Horas'}</div>
            </div>
          </div>

          {/* Right Column: Title, Prices, Tabs & Add to Cart */}
          <div className="quickview-details-col">
            <div className="modal-category-breadcrumb">
              Repuestos &gt; {product.categoria.toUpperCase()} &gt; {product.subcategoria}
            </div>

            <h2 className="modal-product-title">{product.titulo}</h2>

            <div className="modal-oem-row">
              <span className="oem-label">Código OEM / Número de Parte:</span>
              <code className="oem-badge">{product.oemCode}</code>
              <span className="condition-badge">{product.condicion}</span>
            </div>

            <div className="modal-rating-row">
              <div className="rating-stars">
                <Star size={16} className="star-filled" />
                <span className="score">{product.rating}</span>
                <span className="count">({product.reviewsCount} evaluaciones)</span>
              </div>
              <span className="sold-volume">{product.vendidosCount} unidades vendidas</span>
            </div>

            <div className="modal-price-box">
              <span className="price-main">${product.precio.toLocaleString('es-CL')}</span>
              {product.precioOriginal > product.precio && (
                <span className="price-strikethrough">${product.precioOriginal.toLocaleString('es-CL')}</span>
              )}
              <span className="tax-included">IVA incluido • Boleta/Factura disponible</span>
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
                Vehículos Compatibles ({product.compatibilidad.length})
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
                  <p className="product-desc">{product.descripcion}</p>
                  <table className="specs-table">
                    <tbody>
                      {product.especificaciones.map((spec, i) => (
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
                    {product.compatibilidad.map((item, i) => (
                      <div key={i} className="compat-item-row">
                        <Car size={16} className="car-icon" />
                        <div>
                          <strong>{item.marca} {item.modelo}</strong>
                          <span className="years"> (Años: {item.anios.join(', ')})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'vendedor' && (
                <div className="vendedor-tab-content">
                  <div className="vendedor-profile-card">
                    <Store size={24} className="store-avatar-icon" />
                    <div>
                      <h4>{product.vendedor.nombre}</h4>
                      <p>Ubicación: {product.vendedor.ciudad} • {product.vendedor.ventas} ventas concretadas</p>
                      <div className="seller-badge-green"><ShieldCheck size={14} /> Tienda Verificada en Repuestop</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CTA Buttons */}
            <div className="modal-cta-row">
              <button className="btn-modal-add-cart" onClick={() => { onAddToCart(product); onClose(); }}>
                <ShoppingBag size={20} />
                <span>Agregar al Carrito • ${product.precio.toLocaleString('es-CL')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
