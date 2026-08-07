import React from 'react';
import {
  Package, Tag, ChevronRight, Edit3, CheckCircle, AlertTriangle, XCircle, MessageCircleQuestion, Star, Loader2
} from 'lucide-react';
import { resolveMediaUrl } from '../services/api';

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
  questionCount,
  onOpenQuestions,
  onToggleTop,
  isUpdatingTop = false,
}) {
  if (!product) return null;

  const title = product.nombrePublicado || product.repuestoNombre || product.nombre || 'Repuesto sin título';
  const sku = product.skuProveedor || product.sku || product.codigoSKU || product.repuestoSku || 'SKU-000';
  const brand = product.marcaRepuesto || product.marca || product.productBrand || 'Genérico';
  const category = product.categoria || product.categoriaNombre || product.category || 'Repuestos';
  const price = Number(product.precio || 0);
  const oldPrice = product.precioAnterior ? Number(product.precioAnterior) : null;
  const stock = Number(product.stock ?? 0);
  const totalQuestions = Number(questionCount ?? product.questionCount ?? product.preguntasCount ?? product.totalPreguntas ?? 0);
  const rawPhoto = product.imageUrls?.[0]
    || product.imagenUrl
    || product.photoUri
    || product.imagenes?.[0]?.url;
  const photo = resolveMediaUrl(rawPhoto);
  const isTop = Boolean(product.destacado ?? product.isTop);

  return (
    <div className="order-card-container catalog-card-container" onClick={() => onSelectProduct && onSelectProduct(product)}>
      <div className="catalog-image-stage">
        {photo ? (
          <img src={photo} alt={title} className="catalog-product-image" />
        ) : (
          <div className="catalog-image-fallback">
            <Package size={46} />
            <span>Sin imagen</span>
          </div>
        )}
        <div className="catalog-image-overlay">
          <span className="catalog-category-pill"><Tag size={12} /> {category}</span>
          <StockBadge stock={stock} />
        </div>
        {isTop && <span className="catalog-top-ribbon"><Star size={13} fill="currentColor" /> Producto Top</span>}
      </div>

      <div className="catalog-card-content">
        <div className="catalog-card-heading">
          <div className="catalog-card-title-with-questions">
            <h3 className="order-card-id">{title}</h3>
            <button
              type="button"
              className={`catalog-product-question-count ${totalQuestions > 0 ? 'has-questions' : ''}`}
              title={`${totalQuestions} ${totalQuestions === 1 ? 'pregunta' : 'preguntas'} sobre este producto`}
              onClick={(event) => {
                event.stopPropagation();
                if (onOpenQuestions) onOpenQuestions(product);
              }}
            >
              <MessageCircleQuestion size={17} />
              <strong>{totalQuestions}</strong>
              <span>{totalQuestions === 1 ? 'pregunta' : 'preguntas'}</span>
            </button>
          </div>
          <span className="order-card-date-meta">SKU: {sku}</span>
        </div>
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
          <span className="product-pricing">{stock} unidades disponibles</span>
        </div>
      </div>

      {/* Bottom Actions Row */}
      <div className="order-card-actions">
        <button
          type="button"
          className={`catalog-top-toggle ${isTop ? 'is-active' : ''}`}
          disabled={isUpdatingTop}
          aria-pressed={isTop}
          title={isTop ? 'Quitar prioridad dentro de tu tienda' : 'Dar mayor visibilidad dentro de tu tienda'}
          onClick={(event) => {
            event.stopPropagation();
            onToggleTop?.(product, !isTop);
          }}
        >
          {isUpdatingTop ? <Loader2 size={14} className="spin-icon" /> : <Star size={14} fill={isTop ? 'currentColor' : 'none'} />}
          <span>{isTop ? 'Producto Top' : 'Marcar como Top'}</span>
        </button>

        <button
          type="button"
          className="btn-view-details"
          onClick={(e) => {
            e.stopPropagation();
            if (onSelectProduct) onSelectProduct(product);
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
            else if (onSelectProduct) onSelectProduct(product);
          }}
        >
          <Edit3 size={13} />
          <span>Editar / Stock</span>
        </button>
      </div>
    </div>
  );
}
