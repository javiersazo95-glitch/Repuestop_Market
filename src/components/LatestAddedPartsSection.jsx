import React, { useState, useEffect } from 'react';
import { Loader2, Inbox, ArrowRight } from 'lucide-react';
import MarketplaceProductCard from './MarketplaceProductCard';
import { getPublicProductsApi } from '../services/api';
import { adaptPage, adaptLatestPart } from '../services/adapters';

const LATEST_PARTS_COUNT = 5;

export default function LatestAddedPartsSection({ onQuickView, onOpenCatalog }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Feed real de las últimas publicaciones: GET /api/v1/inventario/productos
  // ordenado por fecha de creación descendente (endpoint público).
  useEffect(() => {
    let isMounted = true;

    getPublicProductsApi({ page: 0, size: LATEST_PARTS_COUNT, sort: 'createdAt,desc' })
      .then((data) => {
        if (!isMounted) return;
        setParts(adaptPage(data, adaptLatestPart).items);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'No se pudieron cargar las últimas publicaciones.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  return (
    <section className="latest-parts-section container">
      <div className="section-title-header-flex">
        <div className="title-left-group">
          <div className="title-badge-pulse">
            <span className="pulse-dot"></span>
            <span>REPUESTOS DESTACADOS</span>
          </div>
          <h2>Top repuestos con mejores precios</h2>
          <p>Descubre repuestos destacados por precio competitivo y alta demanda.</p>
        </div>

        <div className="latest-header-right-actions">
          {onOpenCatalog && (
            <button className="btn-view-directory-blue" onClick={onOpenCatalog}>
              <span>Ver todos los repuestos</span><ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="latest-parts-state">
          <Loader2 size={22} className="spin-icon" />
          <span>Cargando últimas publicaciones…</span>
        </div>
      )}

      {!loading && error && (
        <div className="latest-parts-state latest-parts-state-error">
          <Inbox size={22} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && parts.length === 0 && (
        <div className="latest-parts-state">
          <Inbox size={22} />
          <span>Aún no hay repuestos publicados en el sistema.</span>
        </div>
      )}

      <div className="latest-parts-grid-4">
        {parts.map(part => (
          <MarketplaceProductCard key={part.id} product={part} onView={onQuickView} />
        ))}
      </div>
    </section>
  );
}
