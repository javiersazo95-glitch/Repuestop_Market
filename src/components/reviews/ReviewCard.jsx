import React, { useLayoutEffect, useRef, useState } from 'react';
import ReviewStars from './ReviewStars';
import ReviewVideo from './ReviewVideo';
import { resolveMediaUrl } from '../../services/api';
import { formatReviewDate } from '../../services/reviews';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'C';
}

/** Una opinion: foto y nombre del comprador, sus estrellas, el comentario y el video si hay. */
export default function ReviewCard({ review, pausedVideo = false }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const textRef = useRef(null);
  const comment = review.comment?.trim();
  const avatar = !avatarFailed && review.buyerAvatarUrl ? resolveMediaUrl(review.buyerAvatarUrl) : null;

  useLayoutEffect(() => {
    const node = textRef.current;
    if (node && !expanded) setClamped(node.scrollHeight > node.clientHeight + 1);
  }, [comment, expanded]);

  return (
    <article className="rv-card">
      <header className="rv-card-head">
        <span className="rv-avatar">
          {avatar
            ? <img src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} />
            : initials(review.buyerName)}
        </span>
        <span className="rv-card-who">
          <strong>{review.buyerName}</strong>
          <span className="rv-card-meta">
            <ReviewStars value={review.rating} size={13} />
            {review.createdAt && <small>· {formatReviewDate(review.createdAt)}</small>}
          </span>
        </span>
      </header>
      {review.productName && <p className="rv-card-product">Compró: {review.productName}</p>}
      {comment ? (
        <>
          <p ref={textRef} className={`rv-card-text${expanded ? '' : ' is-clamped'}`}>{comment}</p>
          {(clamped || expanded) && (
            <button type="button" className="rv-link" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Ver menos' : 'Ver más'}
            </button>
          )}
        </>
      ) : (
        <p className="rv-card-empty">Calificó sin dejar comentario.</p>
      )}
      {review.videoUrl && <ReviewVideo url={review.videoUrl} paused={pausedVideo} />}
    </article>
  );
}
