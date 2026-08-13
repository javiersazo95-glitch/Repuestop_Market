import React from 'react';

export default function StoreCardSkeleton() {
  return (
    <div className="store-skeleton-card" aria-busy="true">
      <div className="store-skeleton-header">
        <div className="store-skeleton-avatar" />
        <div className="store-skeleton-title-group">
          <div className="skeleton-line store-skeleton-name" />
          <div className="skeleton-line store-skeleton-location" />
        </div>
      </div>
      <div className="store-skeleton-body">
        <div className="skeleton-line store-skeleton-badge" />
        <div className="skeleton-line store-skeleton-desc" />
      </div>
    </div>
  );
}
