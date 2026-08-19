import React from 'react';
import { useParams } from 'react-router-dom';

/** Vista de una categoría de ayuda. Contenido real en la fase 3. */
export default function HelpCategoryView() {
  const { categoria } = useParams();

  return (
    <section className="help-view-placeholder">
      <h1>Categoría: {categoria}</h1>
      <p>Preguntas frecuentes de esta categoría.</p>
    </section>
  );
}
