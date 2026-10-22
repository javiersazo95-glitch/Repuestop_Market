import React from 'react';
import { Star } from 'lucide-react';

export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="as-stars" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(value) ? 'is-on' : ''} />
      ))}
    </span>
  );
}

export function formatSeniority(profile) {
  const { antiguedadAnios: years, antiguedadMeses: months } = profile;
  if (years >= 1) return `${years} ${years === 1 ? 'año' : 'años'} en RepuesTop`;
  if (months >= 1) return `${months} ${months === 1 ? 'mes' : 'meses'} en RepuesTop`;
  return 'Miembro nuevo';
}

export function formatReviewDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
}
