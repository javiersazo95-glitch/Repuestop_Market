import React from 'react';
import { Star } from 'lucide-react';
import './taller-card.css';

/** Calificación promedio del taller y cuántas opiniones tiene: "★ 4,6 (12)"; sin opiniones, "Sin opiniones aún". */
export default function TallerRating({ rating, count, className = '' }) {
  const total = Number(count) || 0;
  if (total <= 0) return <span className={`taller-rating is-empty ${className}`.trim()}>Sin opiniones aún</span>;
  const value = Number(rating) || 0;
  return (
    <span className={`taller-rating ${className}`.trim()} aria-label={`Calificación ${value.toFixed(1)} de 5, ${total} ${total === 1 ? 'opinión' : 'opiniones'}`}>
      <Star size={13} fill="currentColor" aria-hidden="true" /> <b>{value.toFixed(1).replace('.', ',')}</b> <em>({total})</em>
    </span>
  );
}
