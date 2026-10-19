import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MessageSquareText, X } from 'lucide-react';
import ReviewCard from './ReviewCard';
import ReviewSummary from './ReviewSummary';
import { EMPTY_REVIEWS, getReviewsApi } from '../../services/reviews';
import '../../styles/reviews.css';

const PAGE_SIZE = 10;

/**
 * Todas las opiniones de una tienda o un producto: resumen arriba y la lista debajo. Es el popup
 * de la calificacion de la tienda y el "Ver todas" de la ficha. En el celular es una hoja inferior
 * que respeta la zona segura de los botones del sistema.
 */
export default function ReviewsModal({ open, onClose, kind, id, title, subtitle }) {
  const [data, setData] = useState(EMPTY_REVIEWS);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const loadFirst = useCallback(async () => {
    if (!id) return;
    const current = ++requestRef.current;
    setLoading(true);
    setError('');
    try {
      const page = await getReviewsApi(kind, id, { page: 0, size: PAGE_SIZE });
      if (current !== requestRef.current) return;
      setData(page);
      setItems(page.items);
    } catch (err) {
      if (current === requestRef.current) setError(err?.message || 'No se pudieron cargar las opiniones.');
    } finally {
      if (current === requestRef.current) setLoading(false);
    }
  }, [kind, id]);

  useEffect(() => { if (open) loadFirst(); }, [open, loadFirst]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const loadMore = async () => {
    if (loadingMore || !data.hasMore) return;
    const current = requestRef.current;
    setLoadingMore(true);
    try {
      const page = await getReviewsApi(kind, id, { page: data.page + 1, size: PAGE_SIZE });
      if (current !== requestRef.current) return;
      setData(page);
      setItems((previous) => [...previous, ...page.items.filter((item) => !previous.some((p) => p.id === item.id))]);
    } catch {
      // El boton queda para reintentar.
    } finally {
      setLoadingMore(false);
    }
  };

  if (!open) return null;
  return createPortal(
    <div className="rv-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="rv-modal" role="dialog" aria-modal="true" aria-labelledby="rv-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="rv-modal-head">
          <i className="rv-modal-handle" aria-hidden="true" />
          <span className="rv-modal-icon"><MessageSquareText size={20} /></span>
          <div className="rv-modal-title">
            <h2 id="rv-modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="rv-modal-close" aria-label="Cerrar opiniones" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="rv-modal-body">
          {loading ? (
            <div className="rv-state"><Loader2 size={22} className="spin-icon" /></div>
          ) : error ? (
            <div className="rv-state">
              <p>{error}</p>
              <button type="button" className="rv-outline-btn" onClick={loadFirst}>Reintentar</button>
            </div>
          ) : data.total === 0 ? (
            <div className="rv-state">
              <MessageSquareText size={28} />
              <strong>Aún no hay opiniones</strong>
              <p>Las escriben los compradores después de recibir su pedido.</p>
            </div>
          ) : (
            <>
              <ReviewSummary data={data} />
              <p className="rv-trust">Solo opinan compradores que recibieron su pedido en RepuesTop.</p>
              <div className="rv-list">
                {items.map((review) => <ReviewCard key={review.id} review={review} kind={kind} onBeforeLogin={onClose} />)}
              </div>
              {data.hasMore && (
                <button type="button" className="rv-outline-btn rv-more" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 size={16} className="spin-icon" /> : null}
                  {loadingMore ? 'Cargando...' : 'Ver más opiniones'}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
