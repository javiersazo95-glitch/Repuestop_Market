import React from 'react';

export default function ProductCardSkeleton() {
  return (
    <div className="product-skeleton-card" aria-busy="true">
      <div className="skeleton-thumb" />
      <div className="skeleton-content">
        <div className="skeleton-line skeleton-meta" />
        <div className="skeleton-line skeleton-name" />
        <div className="skeleton-line skeleton-store" />
        <div className="skeleton-footer">
          <div className="skeleton-line skeleton-price" />
          <div className="skeleton-button" />
        </div>
      </div>
    </div>
  );
}
