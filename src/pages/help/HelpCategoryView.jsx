import React from 'react';
import { ChevronRight, MessageSquare } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import HelpFaqAccordion from '../../components/help/HelpFaqAccordion';
import HelpSidebar from '../../components/help/HelpSidebar';
import { helpIcon } from '../../components/help/helpIcons';
import { useAuth } from '../../context/AuthContext';
import { categoryTopicId, faqsForRole, getCategory, resolveReportType } from '../../data/helpContent';
import { ROUTES, helpContactPath } from '../../routes/paths';

/** Preguntas frecuentes de una categoría, con salida al formulario de contacto. */
export default function HelpCategoryView() {
  const { categoria } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const reportType = resolveReportType(role, user);
  const category = getCategory(categoria);
  const faqs = faqsForRole(category, reportType);

  // Slug inexistente o sin contenido para este rol: mejor la portada que una
  // pantalla vacía.
  if (!category || faqs.length === 0) return <Navigate to={ROUTES.support} replace />;

  const Icon = helpIcon(category.icono);

  return (
    <>
      <nav className="help-breadcrumb" aria-label="Ruta de navegación">
        <Link to={ROUTES.support}>Centro de ayuda</Link>
        <ChevronRight size={13} />
        <span>{category.titulo}</span>
      </nav>

      <div className="help-layout">
        <div className="help-layout-main">
          <section className="help-section">
            <header className="help-category-head">
              <span className="help-card-icon"><Icon /></span>
              <div>
                <h1>{category.titulo}</h1>
                <p>{category.descripcion}</p>
              </div>
            </header>
            <HelpFaqAccordion faqs={faqs} />
          </section>

          <section className="help-still-stuck">
            <div>
              <strong>¿No resolviste tu problema?</strong>
              <p>Envíanos tu caso con el mayor contexto posible y te respondemos por correo.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(helpContactPath(categoryTopicId(category, reportType)))}
            >
              <MessageSquare size={16} />
              Contactar soporte
            </button>
          </section>
        </div>

        <HelpSidebar currentSlug={category.slug} />
      </div>
    </>
  );
}

