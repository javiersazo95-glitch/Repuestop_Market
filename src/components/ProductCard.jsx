import React from 'react';
import { Check, ShoppingBag, Eye } from 'lucide-react';

export default function ProductCard({ product, activeVehicle, onQuickView, onAddToCart }) {
  // Check compatibility with active vehicle in garage
  const isCompatible = activeVehicle ? product.compatibilidad.some(
    c => c.marca.toLowerCase() === activeVehicle.marca.toLowerCase() ||
         c.modelo.toLowerCase().includes(activeVehicle.modelo.toLowerCase())
  ) : false;

  return (
    <div className={`featured-product-card ${isCompatible ? 'is-compatible' : ''}`}>
      {/* Product Image Box */}
      <div className="product-img-wrap" onClick={() => onQuickView(product)}>
        <img src={product.imagen} alt={product.titulo} loading="lazy" />
        
        {isCompatible && (
          <span className="compat-floating-tag">
            <Check size={12} /> Calza en {activeVehicle.patente}
          </span>
        )}

        <button className="quick-hover-btn" onClick={(e) => { e.stopPropagation(); onQuickView(product); }}>
          <Eye size={14} /> Ver OEM
        </button>
      </div>

      {/* Product Information */}
      <div className="product-card-body">
        <h3 className="product-card-title" onClick={() => onQuickView(product)}>
          {product.titulo}
        </h3>

        <div className="product-card-price-row">
          <span className="price-main-bold">${product.precio.toLocaleString('es-CL')}</span>
          {product.precioOriginal > product.precio && (
            <span className="price-crossed-out">${product.precioOriginal.toLocaleString('es-CL')}</span>
          )}
          {product.descuentoPercent > 0 && (
            <span className="red-discount-badge">-{product.descuentoPercent}%</span>
          )}
        </div>

        <div className="product-card-sales-footer">
          <span className="sales-text">+{product.vendidosCount} vendidos</span>
          <button className="add-cart-mini-btn" onClick={() => onAddToCart(product)} title="Agregar al carrito">
            <ShoppingBag size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
