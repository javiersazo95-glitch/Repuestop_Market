import React, { useState } from 'react';
import { ChevronRight, CircleUserRound, FileText, LogIn, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import HelpContactForm from '../../components/help/HelpContactForm';
import { useAuth } from '../../context/AuthContext';
import { CONTACT_TOPICS, HELP_ROLES, resolveReportType } from '../../data/helpContent';
import { ROUTES } from '../../routes/paths';

const STEPS = [
  ['Recibimos tu caso', 'Queda registrado con un número de seguimiento.'],
  ['Lo revisa el equipo', 'Un agente evalúa el contexto y, si aplica, contacta a la otra parte.'],
  ['Te respondemos', 'La respuesta llega a tu correo y queda en Reportes y disputas.'],
];

/** Formulario de consulta o reclamo en su propia ruta, con `?tema=` opcional. */
export default function HelpContactView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role, isLoggedIn } = useAuth();
  const reportType = resolveReportType(role, user);
  const [topic, setTopic] = useState(searchParams.get('tema'));

  const topicLabel = (CONTACT_TOPICS[reportType] || []).find(([, value]) => value === topic)?.[0];

  return (
    <>
      <nav className="help-breadcrumb" aria-label="Ruta de navegación">
        <Link to={ROUTES.support}>Centro de ayuda</Link>
        <ChevronRight size={13} />
        <span>Contactar soporte</span>
      </nav>

      <div className="help-contact-layout">
        <div className="help-layout-main">
          <header className="help-contact-head">
            <h1>Emitir consulta o reclamo</h1>
            <p>Envía tu caso al equipo de soporte con el mayor contexto posible.</p>
          </header>

          {isLoggedIn ? (
            <HelpContactForm
              user={user}
              reportType={reportType}
              initialTopic={searchParams.get('tema')}
              onTopicChange={setTopic}
            />
          ) : (
            <section className="help-section help-guest-block">
              <span className="help-card-icon"><LogIn /></span>
              <h2>Inicia sesión para enviar tu consulta</h2>
              <p>
                Necesitamos identificar tu cuenta para asociar el caso a tus pedidos y responderte
                por correo.
              </p>
              <div>
                <button
                  type="button"
                  className="help-side-cta"
                  onClick={() => navigate(ROUTES.home, { state: { requireAuth: true } })}
                >
                  <LogIn size={16} />
                  Iniciar sesión
                </button>
                <Link className="help-side-link" to={ROUTES.support}>
                  Volver a las preguntas frecuentes <ChevronRight size={14} />
                </Link>
              </div>
            </section>
          )}
        </div>

        <aside className="help-contact-aside">
          <section className="help-side-card">
            <h2><FileText size={16} /> Qué pasa después</h2>
            <ol className="help-contact-steps">
              {STEPS.map(([titulo, descripcion], index) => (
                <li key={titulo}>
                  <span>{index + 1}</span>
                  <div><strong>{titulo}</strong><small>{descripcion}</small></div>
                </li>
              ))}
            </ol>
            <small className="help-contact-sla">Tiempo de respuesta: 24-48 horas hábiles</small>
          </section>

          {isLoggedIn && (
            <section className="help-side-card">
              <h2><CircleUserRound size={16} /> Tu caso</h2>
              <div className="support-ticket-meta help-contact-meta">
                <span>
                  <CircleUserRound />
                  <small>Usuario</small>
                  <strong>{user?.userName || user?.nombre || user?.storeName || 'Usuario'}</strong>
                </span>
                <span>
                  <ShieldCheck />
                  <small>Rol</small>
                  <strong>{reportType === HELP_ROLES.SELLER ? 'Vendedor' : 'Comprador'}</strong>
                </span>
              </div>
              {topicLabel && <p className="help-contact-topic">Tema: <strong>{topicLabel}</strong></p>}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}


