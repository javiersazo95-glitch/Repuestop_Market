import React, { forwardRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, MessageSquareText, Star } from 'lucide-react';
import ReviewCard from './ReviewCard';
import ReviewSummary from './ReviewSummary';
import ReviewsModal from './ReviewsModal';
import { qk } from '../../services/queryKeys';
import { EMPTY_REVIEWS, getReviewsApi, reviewCountLabel } from '../../services/reviews';
import '../../styles/reviews.css';

const PREVIEW_COUNT = 3;

/**
 * Opiniones del producto en la ficha, bajo las preguntas: resumen y las primeras opiniones
 * (primero las que traen comentario o video); "Ver todas" abre el popup completo. La nota del
 * producto de arriba baja hasta aca.
 */
const ProductReviewsSection = forwardRef(function ProductReviewsSection({ productId, productName }, ref) {
  const [modalOpen, setModalOpen] = useState(false);
  const { data = EMPTY_REVIEWS, isLoading } = useQuery({
    queryKey: qk.reviews('product', productId, PREVIEW_COUNT),
    queryFn: ({ signal }) => getReviewsApi('product', productId, { size: PREVIEW_COUNT, signal }),
    enabled: Boolean(productId),
    staleTime: 60000,
  });

  return (
    <section className="rv-section" ref={ref} aria-labelledby="rv-section-title">
      <div className="rv-section-head">
        <h2 id="rv-section-title"><Star size={18} /> Opiniones del producto</h2>
        {data.total > 0 && <span>{reviewCountLabel(data.total)}</span>}
      </div>
      {isLoading ? (
        <p className="rv-muted">Cargando opiniones...</p>
      ) : data.total === 0 ? (
        <div className="rv-empty">
          <MessageSquareText size={22} />
          <span><strong>Aún no hay opiniones</strong><small>Las dejan los compradores después de recibir este repuesto.</small></span>
        </div>
      ) : (
        <>
          <ReviewSummary data={data} />
          <div className="rv-list">
            {data.items.map((review) => <ReviewCard key={review.id} review={review} pausedVideo={modalOpen} />)}
          </div>
          {data.total > data.items.length && (
            <button type="button" className="rv-outline-btn" onClick={() => setModalOpen(true)}>
              Ver las {data.total} opiniones <ChevronRight size={15} />
            </button>
          )}
        </>
      )}
      <ReviewsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        kind="product"
        id={productId}
        title="Opiniones del producto"
        subtitle={productName}
      />
    </section>
  );
});

export default ProductReviewsSection;
