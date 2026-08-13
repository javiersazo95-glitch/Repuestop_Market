import React from 'react';

export default function PageLoadingSkeleton() {
  return (
    <div className="page-skeleton-container" aria-busy="true" aria-label="Cargando página...">
      <div className="page-skeleton-hero">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-subtitle" />
      </div>
      <div className="page-skeleton-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-card-image" />
            <div className="skeleton-card-body">
              <div className="skeleton-line skeleton-card-title" />
              <div className="skeleton-line skeleton-card-price" />
              <div className="skeleton-line skeleton-card-badge" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
