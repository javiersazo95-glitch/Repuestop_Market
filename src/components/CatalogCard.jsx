import React from 'react';
import {
  Package, Tag, ChevronRight, Edit3, CheckCircle, AlertTriangle, XCircle, MessageCircleQuestion, Trophy, Loader2, Pause, Play
} from 'lucide-react';
import { resolveMediaUrl } from '../services/api';
import ProductTopBadge from './ProductTopBadge';
import { getProductTopStatus, topExpiryDateLabel } from '../utils/productTop';

export function StockBadge({ stock, isPaused }) {
  if (isPaused) {
    return (
      <span className="order-status-badge badge-amber badge-size-small">
        <Pause size={12} />
        <span>Pausado</span>
      </span>
    );
  }
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
  onTogglePause,
  isUpdatingPause = false,
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
  const topStatus = getProductTopStatus(product);
  const isTop = topStatus.state === 'active';
  const topExpired = topStatus.state === 'expired';
  const isPaused = Boolean(product.pausado || product.isPaused || product.activo === false);

  return (
    <div className={`order-card-container catalog-card-container ${isPaused ? 'is-paused-card' : ''}`} onClick={() => onSelectProduct && onSelectProduct(product)}>
      <div className="catalog-image-stage">
        {photo ? (
          <img src={photo} alt={title} className="catalog-product-image" style={isPaused ? { filter: 'grayscale(60%) opacity(0.8)' } : {}} />
        ) : (
          <div className="catalog-image-fallback">
            <Package size={46} />
            <span>Sin imagen</span>
          </div>
        )}
        <div className="catalog-image-overlay">
          <span className="catalog-category-pill"><Tag size={12} /> {category}</span>
          <StockBadge stock={stock} isPaused={isPaused} />
        </div>
        {isTop && <ProductTopBadge compact className="catalog-product-top-badge" />}
        {topExpired && <span className="catalog-top-expired">Top vencido {topExpiryDateLabel(topStatus) && `· ${topExpiryDateLabel(topStatus)}`}</span>}
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
          <span className="product-pricing">
            {isPaused ? 'Publicación en pausa' : `${stock} unidades disponibles`}
          </span>
        </div>
      </div>

      {/* Bottom Actions Row */}
      <div className="order-card-actions">
        <button
          type="button"
          className={`catalog-top-toggle ${isTop ? 'is-active' : ''}`}
          disabled={isUpdatingTop || isPaused}
          aria-pressed={isTop}
          title={isTop ? 'Revisar vigencia o agregar 30 días' : topExpired ? 'Renovar la insignia Top por 30 días' : 'Activar insignia y prioridad por 30 días'}
          onClick={(event) => {
            event.stopPropagation();
            onToggleTop?.(product);
          }}
        >
          {isUpdatingTop ? <Loader2 size={14} className="spin-icon" /> : <Trophy size={14} />}
          <span>{isTop ? `Gestionar Top · ${topStatus.daysLeft || '—'} días` : topExpired ? 'Renovar Producto Top' : 'Marcar como Top'}</span>
        </button>

        {onTogglePause && (
          <button
            type="button"
            className={`btn-view-details ${isPaused ? 'btn-resume' : 'btn-pause'}`}
            disabled={isUpdatingPause}
            title={isPaused ? 'Reanudar publicación' : 'Pausar publicación temporalmente'}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePause(product, !isPaused);
            }}
          >
            {isUpdatingPause ? <Loader2 size={13} className="spin-icon" /> : isPaused ? <Play size={13} /> : <Pause size={13} />}
            <span>{isPaused ? 'Reanudar' : 'Pausar'}</span>
          </button>
        )}

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
          <span>Editar</span>
        </button>
      </div>
    </div>
  );
}
