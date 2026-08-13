import React from 'react';

export default function ProductDetailSkeleton() {
  return (
    <div className="product-detail-skeleton-container" aria-busy="true" aria-label="Cargando repuesto...">
      <div className="product-detail-skeleton-layout">
        {/* Gallery Column */}
        <div className="detail-skeleton-gallery">
          <div className="detail-skeleton-main-image" />
          <div className="detail-skeleton-thumbs">
            <div className="detail-skeleton-thumb" />
            <div className="detail-skeleton-thumb" />
            <div className="detail-skeleton-thumb" />
          </div>
        </div>

        {/* Info Column */}
        <div className="detail-skeleton-info">
          <div className="skeleton-line detail-skeleton-brand" />
          <div className="skeleton-line detail-skeleton-title" />
          <div className="skeleton-line detail-skeleton-subtitle" />
          <div className="detail-skeleton-price-box" />
          <div className="detail-skeleton-actions" />
          <div className="detail-skeleton-specs" />
        </div>
      </div>
    </div>
  );
}
