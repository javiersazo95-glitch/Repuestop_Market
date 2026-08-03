import React from 'react';
import {
  Package, Tag, Layers, ChevronRight, Edit3, CheckCircle, AlertTriangle, XCircle
} from 'lucide-react';

export function StockBadge({ stock }) {
  const numStock = Number(stock || 0);
  if (numStock <= 0) {
    return (
      <span className="order-status-badge badge-red badge-size-small">
        <XCircle size={12} />
        <span>Agotado</span>
      </span>
    );
  }
  if (numStock <= 3) {
    return (
      <span className="order-status-badge badge-amber badge-size-small">
        <AlertTriangle size={12} />
        <span>Bajo Stock ({numStock})</span>
      </span>
    );
  }
  return (
    <span className="order-status-badge badge-green badge-size-small">
      <CheckCircle size={12} />
      <span>En Stock ({numStock})</span>
    </span>
  );
}

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

export default function CatalogCard({
  product,
  onSelectProduct,
  onQuickEditStock,
}) {
  if (!product) return null;

  const title = product.nombrePublicado || product.repuestoNombre || product.nombre || 'Repuesto sin título';
  const sku = product.sku || product.codigoSKU || product.repuestoSku || 'SKU-000';
  const brand = product.marca || product.productBrand || 'Genérico';
  const category = product.categoriaNombre || product.category || 'Repuestos';
  const price = Number(product.precio || 0);
  const oldPrice = product.precioAnterior ? Number(product.precioAnterior) : null;
  const stock = Number(product.stock ?? 0);
  const photo = product.imageUrls?.[0] || product.imagenUrl || product.photoUri;

  return (
    <div className="order-card-container catalog-card-container" onClick={() => onSelectProduct && onSelectProduct(product)}>
      {/* Top Header Row */}
      <div className="order-card-header">
        <div className="order-card-title-group">
          <h3 className="order-card-id">{title}</h3>
          <span className="order-card-date-meta">
            SKU: {sku} · {category}
          </span>
        </div>
        <StockBadge stock={stock} />
      </div>

      {/* Product Image & Info Row */}
      <div className="order-card-product-row">
        {photo ? (
          <img src={photo} alt={title} className="product-thumb-img catalog-thumb-img" />
        ) : (
          <div className="product-thumb-fallback catalog-thumb-fallback">
            <Package size={26} />
          </div>
        )}
        <div className="product-copy">
          <span className="product-meta">
            Marca: <strong>{brand}</strong>
          </span>
          <div className="catalog-price-group">
            <strong className="total-amount">{formatCLP(price)}</strong>
            {oldPrice && oldPrice > price && (
              <span className="product-card-original">{formatCLP(oldPrice)}</span>
            )}
          </div>
          <span className="product-pricing">Stock disponible: {stock} unidades</span>
        </div>
      </div>

      {/* Bottom Actions Row */}
      <div className="order-card-actions">
        <button
          type="button"
          className="btn-view-details"
          onClick={(e) => {
            e.stopPropagation();
            onSelectProduct && onSelectProduct(product);
          }}
        >
          <span>Ver detalles completos</span>
          <ChevronRight size={15} />
        </button>

        <button
          type="button"
          className="btn-order-action btn-action-blue"
          onClick={(e) => {
            e.stopPropagation();
            if (onQuickEditStock) onQuickEditStock(product);
            else onSelectProduct && onSelectProduct(product);
          }}
        >
          <Edit3 size={13} />
          <span>Editar / Stock</span>
        </button>
      </div>
    </div>
  );
}
