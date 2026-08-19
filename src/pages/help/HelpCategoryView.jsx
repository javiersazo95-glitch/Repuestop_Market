import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

import HelpFaqAccordion from '../../components/help/HelpFaqAccordion';
import { useAuth } from '../../context/AuthContext';
import { faqsForRole, getCategory, resolveReportType } from '../../data/helpContent';
import { ROUTES } from '../../routes/paths';

/**
 * Preguntas frecuentes de una categoría. La fase 3 agrega breadcrumb, sidebar y
 * el bloque de "¿No resolviste tu problema?" hacia el formulario de contacto.
 */
export default function HelpCategoryView() {
  const { categoria } = useParams();
  const { user, role } = useAuth();
  const reportType = resolveReportType(role, user);
  const category = getCategory(categoria);
  const faqs = faqsForRole(category, reportType);

  // Slug inexistente o sin contenido para este rol: mejor la portada que una
  // pantalla vacía.
  if (!category || faqs.length === 0) return <Navigate to={ROUTES.support} replace />;

  return (
    <section className="help-view-placeholder">
      <h1>{category.titulo}</h1>
      <p>{category.descripcion}</p>
      <HelpFaqAccordion faqs={faqs} />
    </section>
  );
}
