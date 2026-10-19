import React, { useLayoutEffect, useRef, useState } from 'react';
import ReviewStars from './ReviewStars';
import ReviewPhotos from './ReviewPhotos';
import ContextualReportButton from '../ContextualReportButton';
import { useMarketplace } from '../../context/MarketplaceContext';
import { resolveMediaUrl } from '../../services/api';
import { formatReviewDate } from '../../services/reviews';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'C';
}

/**
 * Una opinion: foto y nombre del comprador, sus estrellas, el comentario y sus fotos si hay.
 *
 * 19-oct (moderacion): si el backoffice la oculto (`contentHidden`), el backend manda el
 * comentario en null y sin fotos; se siguen viendo la nota, el nombre y la fecha, con un aviso en
 * lugar del texto. "Reportar" usa el reporte contextual (OPINION_PRODUCTO / OPINION_TIENDA, segun
 * `kind`) y sin sesion ofrece iniciarla; no se ofrece en las ya retiradas. `onBeforeLogin` deja
 * que el popup de opiniones se cierre antes, porque el de iniciar sesion queda debajo de el.
 */
export default function ReviewCard({ review, kind, onBeforeLogin }) {
  const { openAuthModal } = useMarketplace();
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const textRef = useRef(null);
  const hidden = review.contentHidden === true;
  const comment = hidden ? '' : review.comment?.trim();
  const avatar = !avatarFailed && review.buyerAvatarUrl ? resolveMediaUrl(review.buyerAvatarUrl) : null;
  const reportType = kind === 'product' ? 'OPINION_PRODUCTO' : kind === 'store' ? 'OPINION_TIENDA' : null;

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
        {reportType && !hidden && (
          <ContextualReportButton
            tipoObjeto={reportType}
            objetoId={review.id}
            objetoTitulo={review.buyerName ? `Opinión de ${review.buyerName}` : undefined}
            className="rv-report-btn"
            onRequireLogin={() => { onBeforeLogin?.(); openAuthModal(); }}
          />
        )}
      </header>
      {review.productName && <p className="rv-card-product">Compró: {review.productName}</p>}
      {hidden ? (
        <p className="rv-card-hidden">Comentario retirado por moderación: no cumplía las normas de la comunidad.</p>
      ) : comment ? (
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
      {!hidden && review.imageUrls?.length > 0 && <ReviewPhotos urls={review.imageUrls} />}
    </article>
  );
}
