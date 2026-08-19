import React, { useEffect, useState } from 'react';
import { ChevronRight, Headphones, LifeBuoy, LogIn, MessageSquare } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyMediationsApi, getMyReportsApi, getMySupportTicketsApi } from '../../services/api';
import { HELP_ROLES, getCategoriesForRole, resolveReportType } from '../../data/helpContent';
import { ROUTES, helpCategoryPath, profilePath } from '../../routes/paths';

// Un caso deja de estar abierto cuando llega a uno de estos estados. Son los
// mismos valores de los enums del backend que ya usa ProfileSupportPanel.
const CLOSED_STATUSES = ['RESUELTO', 'CERRADO', 'CANCELADO', 'RESUELTA', 'CERRADA'];

function openCases(list) {
  const items = Array.isArray(list) ? list : list?.content || [];
  return items.filter((item) => !CLOSED_STATUSES.includes(String(item.status || item.estado || '').toUpperCase()));
}

/**
 * Columna lateral del centro de ayuda: contacto, casos abiertos del usuario y
 * salto a las demás categorías.
 *
 * En vez de un indicador de "estado del sistema" (no existe endpoint de health
 * y sería un dato inventado) se muestra el conteo real de tickets, reportes y
 * mediaciones abiertas.
 */
export default function HelpSidebar({ currentSlug = null }) {
  const navigate = useNavigate();
  const { user, role, isLoggedIn } = useAuth();
  const reportType = resolveReportType(role, user);
  const userId = user?.userId ?? user?.id;
  const [caseCount, setCaseCount] = useState(null);

  const otherCategories = currentSlug
    ? getCategoriesForRole(reportType).filter((category) => category.slug !== currentSlug)
    : [];

  useEffect(() => {
    if (!userId) { setCaseCount(null); return; }
    let cancelled = false;
    Promise.all([
      getMySupportTicketsApi(userId),
      getMyReportsApi(userId),
      getMyMediationsApi(userId),
    ])
      .then(([tickets, reports, mediations]) => {
        if (cancelled) return;
        setCaseCount(openCases(tickets).length + openCases(reports).length + openCases(mediations).length);
      })
      // El bloque es informativo: si falla la carga simplemente no se muestra,
      // no tiene sentido alarmar con un error en una barra lateral.
      .catch(() => { if (!cancelled) setCaseCount(null); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <aside className="help-sidebar">
      <section className="help-side-card help-side-contact">
        <h2>¿Necesitas más ayuda?</h2>
        <p>Nuestro equipo está listo para asistirte.</p>
        <button type="button" className="help-side-cta" onClick={() => navigate(ROUTES.helpContact)}>
          <MessageSquare size={16} />
          Contactar soporte
        </button>
        <small>Tiempo de respuesta: 24-48 horas hábiles</small>
      </section>

      {isLoggedIn ? (
        caseCount !== null && (
          <section className="help-side-card">
            <h2><LifeBuoy size={16} /> Mis casos</h2>
            <p className="help-side-count">
              <strong>{caseCount}</strong>
              {caseCount === 1 ? 'caso abierto' : 'casos abiertos'}
            </p>
            <Link className="help-side-link" to={profilePath('consultas')}>
              Ver reportes y disputas <ChevronRight size={14} />
            </Link>
          </section>
        )
      ) : (
        <section className="help-side-card">
          <h2><LifeBuoy size={16} /> Mis casos</h2>
          <p>Inicia sesión para ver el estado de tus consultas y reclamos.</p>
          <button
            type="button"
            className="help-side-link as-button"
            onClick={() => navigate(ROUTES.home, { state: { requireAuth: true } })}
          >
            <LogIn size={14} /> Iniciar sesión
          </button>
        </section>
      )}

      {otherCategories.length > 0 && (
        <section className="help-side-card">
          <h2><Headphones size={16} /> Otras categorías</h2>
          <ul className="help-side-list">
            {otherCategories.map((category) => (
              <li key={category.slug}>
                <Link to={helpCategoryPath(category.slug)}>
                  {category.titulo} <ChevronRight size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reportType === HELP_ROLES.GUEST && (
        <section className="help-side-card help-side-note">
          <p>¿Quieres vender repuestos en RepuesTop? Crea tu tienda y publica tu inventario.</p>
          <Link className="help-side-link" to={ROUTES.sellerRegister}>
            Quiero vender <ChevronRight size={14} />
          </Link>
        </section>
      )}
    </aside>
  );
}

