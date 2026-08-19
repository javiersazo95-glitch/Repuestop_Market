import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import HelpFaqAccordion from '../../components/help/HelpFaqAccordion';
import HelpSidebar from '../../components/help/HelpSidebar';
import { helpIcon } from '../../components/help/helpIcons';
import { useAuth } from '../../context/AuthContext';
import { faqsForRole, getCategoriesForRole, resolveReportType } from '../../data/helpContent';
import { ROUTES, helpCategoryPath } from '../../routes/paths';

/**
 * Índice completo: todas las preguntas del rol agrupadas por categoría. Es el
 * destino de "Ver todas" de la portada, que antes caía en la primera categoría
 * y daba a entender que ahí estaban todas.
 */
export default function HelpAllFaqsView() {
  const { user, role } = useAuth();
  const reportType = resolveReportType(role, user);
  const categories = getCategoriesForRole(reportType);
  const total = categories.reduce((count, category) => count + faqsForRole(category, reportType).length, 0);

  return (
    <>
      <nav className="help-breadcrumb" aria-label="Ruta de navegación">
        <Link to={ROUTES.support}>Centro de ayuda</Link>
        <ChevronRight size={13} />
        <span>Todas las preguntas</span>
      </nav>

      <div className="help-layout">
        <div className="help-layout-main">
          <header className="help-contact-head">
            <h1>Todas las preguntas frecuentes</h1>
            <p>{total} respuestas para tu perfil, agrupadas por tema.</p>
          </header>

          {categories.map((category) => {
            const Icon = helpIcon(category.icono);
            return (
              <section className="help-section" key={category.slug}>
                <div className="help-section-head">
                  <h2><Icon size={18} /> {category.titulo}</h2>
                  <Link className="help-section-link" to={helpCategoryPath(category.slug)}>
                    Abrir categoría <ChevronRight size={14} />
                  </Link>
                </div>
                <HelpFaqAccordion faqs={faqsForRole(category, reportType)} defaultOpen={-1} />
              </section>
            );
          })}
        </div>

        <HelpSidebar />
      </div>
    </>
  );
}

