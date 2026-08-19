import React from 'react';
import { ChevronRight, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';
import HelpFaqAccordion from '../../components/help/HelpFaqAccordion';
import HelpSidebar from '../../components/help/HelpSidebar';
import { helpIcon } from '../../components/help/helpIcons';
import { useAuth } from '../../context/AuthContext';
import { getCategoriesForRole, highlightedFaqs, resolveReportType } from '../../data/helpContent';
import { ROUTES, helpCategoryPath } from '../../routes/paths';

/** Portada del centro de ayuda: accesos por categoría y preguntas destacadas. */
export default function HelpHomeView() {
  const { user, role } = useAuth();
  const reportType = resolveReportType(role, user);
  const categories = getCategoriesForRole(reportType);
  const destacadas = highlightedFaqs(reportType);

  return (
    <>
      <section className="help-hero">
        <div>
          <h1>Centro de ayuda</h1>
          <p>Estamos aquí para ayudarte. Encuentra respuestas rápidas o escríbenos.</p>
        </div>
        <span className="help-hero-icon"><Headphones /></span>
      </section>

      <div className="help-layout">
        <div className="help-layout-main">
          <section className="help-section">
            <div className="help-section-head">
              <h2>Accesos rápidos</h2>
            </div>
            <div className="help-quick-grid">
              {categories.map((category) => {
                const Icon = helpIcon(category.icono);
                return (
                  <Link key={category.slug} className="help-card" to={helpCategoryPath(category.slug)}>
                    <span className="help-card-icon"><Icon /></span>
                    <strong>{category.titulo}</strong>
                    <small>{category.descripcion}</small>
                    <ChevronRight className="help-card-chevron" size={16} />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="help-section">
            <div className="help-section-head">
              <h2>Preguntas frecuentes</h2>
              <Link className="help-section-link" to={ROUTES.helpAllFaqs}>
                Ver todas <ChevronRight size={14} />
              </Link>
            </div>
            <HelpFaqAccordion faqs={destacadas} defaultOpen={-1} />
          </section>
        </div>

        <HelpSidebar />
      </div>
    </>
  );
}


