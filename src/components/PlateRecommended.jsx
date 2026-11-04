import React from 'react';
import { Sparkles } from 'lucide-react';

/** Texto único de la línea de apoyo: igual en todas las búsquedas por patente (y en la app). */
export const PLATE_BENEFIT_TEXT = 'Completamos los datos de tu vehículo por ti.';

/** Insignia "Recomendada" dentro de la pestaña "Por patente". */
export function RecommendedBadge() {
  return <span className="plate-reco">Recomendada</span>;
}

/** Línea corta bajo las pestañas que explica por qué buscar por patente. */
export function PlateBenefitHint({ className = '' }) {
  return (
    <p className={`plate-benefit ${className}`.trim()}>
      <Sparkles size={14} aria-hidden="true" />
      <span><span className="sr-only">Recomendado: </span>{PLATE_BENEFIT_TEXT}</span>
    </p>
  );
}
