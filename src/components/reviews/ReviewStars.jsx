import React from 'react';
import { Star, StarHalf } from 'lucide-react';

/** Cinco estrellas de solo lectura; con decimales (promedio) usa media estrella. */
export default function ReviewStars({ value = 0, size = 14 }) {
  const rounded = Math.round(Number(value || 0) * 2) / 2;
  return (
    <span className="rv-stars" role="img" aria-label={`${Number(value || 0).toFixed(1).replace('.', ',')} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((star) => {
        if (rounded >= star) return <Star key={star} size={size} className="is-on" fill="currentColor" />;
        if (rounded >= star - 0.5) {
          return (
            <span key={star} className="rv-star-half" style={{ width: size, height: size }}>
              <Star size={size} />
              <StarHalf size={size} className="is-on" fill="currentColor" />
            </span>
          );
        }
        return <Star key={star} size={size} />;
      })}
    </span>
  );
}
