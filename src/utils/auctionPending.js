/** "3 ofertas · 1 pregunta por revisar": lo pendiente de una necesidad propia, como el preview de la app. */
export function pendingSummary(offers, questions) {
  if (offers + questions <= 0) return '';
  return [
    offers > 0 ? `${offers} ${offers === 1 ? 'oferta' : 'ofertas'}` : null,
    questions > 0 ? `${questions} ${questions === 1 ? 'pregunta' : 'preguntas'}` : null,
  ].filter(Boolean).join(' · ') + ' por revisar';
}
