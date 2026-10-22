import React, { useEffect, useState } from 'react';
import { X, Store } from 'lucide-react';
import { getAuctionBuyerHistory } from '../services/auctionApi';
import { Stars, formatReviewDate } from './AuctionStars';
import '../styles/auction-social.css';

/** Popup con todas las calificaciones y comentarios que han dejado las tiendas sobre el comprador. */
export default function AuctionBuyerReviewsModal({ isOpen, onClose, auctionId, buyerName, average, total }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    getAuctionBuyerHistory(auctionId)
      .then((data) => { if (active) setItems(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err?.message || 'No pudimos cargar los comentarios.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, auctionId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="auction-modal-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="auction-modal-card as-modal" role="dialog" aria-modal="true" aria-label={`Comentarios sobre ${buyerName}`}>
        <div className="as-modal-head">
          <div>
            <h2>Comentarios sobre {buyerName}</h2>
            {total > 0 && (
              <span className="as-modal-summary"><Stars value={average} /> <strong>{average.toFixed(1)}</strong> · {total} {total === 1 ? 'calificación' : 'calificaciones'}</span>
            )}
          </div>
          <button type="button" className="auction-modal-close-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="as-modal-body">
          {loading ? (
            <p className="as-muted">Cargando comentarios…</p>
          ) : error ? (
            <p className="as-error" role="alert">{error}</p>
          ) : items.length === 0 ? (
            <p className="as-muted">Este comprador aún no tiene compras en subasta.</p>
          ) : (
            <ul className="as-review-list">
              {items.map((item) => (
                <li key={item.necesidadId} className="as-review">
                  <div className="as-review-head">
                    <strong>{item.repuesto}</strong>
                    {item.estrellas ? <Stars value={item.estrellas} /> : <small className="as-muted">Sin calificar</small>}
                  </div>
                  <small className="as-muted">
                    {item.tienda ? <><Store size={12} /> {item.tienda} · </> : null}{formatReviewDate(item.fecha)}
                  </small>
                  {item.comentario
                    ? <p className="as-review-comment">“{item.comentario}”</p>
                    : item.estrellas ? <p className="as-muted">La tienda no dejó comentario.</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
