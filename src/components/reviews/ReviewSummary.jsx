import React from 'react';
import ReviewStars from './ReviewStars';
import { formatRating, ratingWord, reviewCountLabel } from '../../services/reviews';

/** Nota grande con sus estrellas y, al lado, cuantas opiniones hay de cada nota. */
export default function ReviewSummary({ data }) {
  const max = Math.max(1, ...Object.values(data.distribution || {}).map(Number));
  const word = ratingWord(data.average);
  return (
    <div className="rv-summary">
      <div className="rv-summary-score">
        <strong>{formatRating(data.average)}</strong>
        <ReviewStars value={data.average} size={15} />
        <small>{word ? `${word} · ` : ''}{reviewCountLabel(data.total)}</small>
      </div>
      <ul className="rv-summary-bars">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = Number(data.distribution?.[star] ?? 0);
          return (
            <li key={star} aria-label={`${star} estrellas: ${count}`}>
              <span>{star}</span>
              <i><b style={{ width: `${(count / max) * 100}%` }} /></i>
              <em>{count}</em>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
