import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Inbox, ArrowRight, Award, LayoutGrid } from 'lucide-react';
import MarketplaceProductCard from './MarketplaceProductCard';
import { getPublicProductsApi } from '../services/api';
import { qk } from '../services/queryKeys';
import { adaptPage, adaptLatestPart } from '../services/adapters';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../hooks/useFavorites';

const LATEST_PARTS_COUNT = 5;

export default function LatestAddedPartsSection({ onQuickView, onOpenCatalog }) {
  const { user, isLoggedIn } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites(user?.userId ?? user?.id);

  // Feed real de las últimas publicaciones: GET /api/v1/inventario/productos
  // ordenado por fecha de creación descendente (endpoint público). Va por React Query para que,
  // al volver al inicio desde un repuesto, la sección se pinte al instante desde la caché y el
  // scroll se pueda restaurar donde estaba.
  const { data: parts = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: qk.products({ latest: LATEST_PARTS_COUNT }),
    queryFn: async () => adaptPage(
      await getPublicProductsApi({ page: 0, size: LATEST_PARTS_COUNT, sort: 'createdAt,desc' }),
      adaptLatestPart,
    ).items,
    staleTime: 60 * 1000,
  });
  const error = queryError ? (queryError.message || 'No se pudieron cargar las últimas publicaciones.') : null;

  return (
    <section className="latest-parts-section container">
      <div className="section-title-header-flex">
        <div className="title-left-group">
          <div className="title-badge-pulse">
            <span className="pulse-dot" aria-hidden="true"><Award size={15} /></span>
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
          <MarketplaceProductCard
            key={part.id}
            product={part}
            onView={onQuickView}
            isFavorite={isFavorite(part.id)}
            onToggleFavorite={isLoggedIn ? toggleFavorite : undefined}
          />
        ))}
        {/* Solo movil (public-mobile.css): la seccion muestra 5 repuestos; en dos columnas
            este acceso ocupa el hueco del sexto y lleva al catalogo completo. */}
        {onOpenCatalog && parts.length > 0 && (
          <button type="button" className="latest-parts-see-all" onClick={onOpenCatalog}>
            <span className="latest-parts-see-all-icon"><LayoutGrid size={22} /></span>
            <strong>Ver todos los repuestos</strong>
            <small>Explora el catálogo completo</small>
            <span className="latest-parts-see-all-cta">Ir al catálogo <ArrowRight size={16} /></span>
          </button>
        )}
      </div>
    </section>
  );
}
