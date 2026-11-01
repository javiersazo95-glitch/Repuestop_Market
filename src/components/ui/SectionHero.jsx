import React from 'react';
import '../../styles/app-kit.css';

/**
 * Cabecera compacta de una sección en el celular: degradado propio, etiqueta corta, título, bajada de hasta dos
 * líneas e ilustración a la derecha. Es `mobile/components/ui/SectionHero.tsx` de la app; la usan Búsqueda de
 * repuestos, Talleres y Catálogo para que la web móvil y la app se vean igual.
 */
export default function SectionHero({ gradient, eyebrow, title, subtitle, art, action = null, label }) {
  const [from, via, to] = gradient;
  return (
    <section
      className="ak-hero"
      style={{ '--ak-hero-from': from, '--ak-hero-via': via, '--ak-hero-to': to }}
      aria-label={label || `${title}: ${subtitle}`}
    >
      <div className="ak-hero-copy">
        <span className="ak-hero-eyebrow">
          {eyebrow.icon}
          {eyebrow.label}
        </span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {art && <div className="ak-hero-art" aria-hidden="true">{art}</div>}
      {action}
    </section>
  );
}

/** Pastilla blanca flotante de las ilustraciones ("3 ofertas", "Diagnóstico"). */
export function HeroChip({ icon, label, color, className = '' }) {
  return (
    <span className={`ak-hero-chip ${className}`} style={{ color }}>
      {icon}
      {label}
    </span>
  );
}
