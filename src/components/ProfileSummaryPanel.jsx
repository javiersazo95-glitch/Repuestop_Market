import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronRight, CheckCircle2, Circle, Lightbulb } from 'lucide-react';
import CapturerContactCard from './CapturerContactCard';
import { ROUTES } from '../routes/paths';
import { formatCLP, EmptyState } from './ProfileDashboard';

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRelativeTime(date) {
  if (!date) return 'Reciente';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs < 1) return 'Hace unos minutos';
  if (diffHrs < 24) return `Hace ${diffHrs} ${diffHrs === 1 ? 'hora' : 'horas'}`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  return formatDate(date);
}

/**
 * Pestaña "Resumen" del panel de perfil: KPIs, acciones rápidas, actividad
 * reciente y los 3 widgets laterales (rendimiento/compras, checklist de la
 * cuenta, consejos). Extraida de ProfileDashboard: es puramente
 * presentacional, no tiene estado propio — todos los datos ya vienen
 * calculados del padre (que los sigue necesitando para otras pestañas, como
 * `quoteSummary` en Cotizaciones), asi que se reciben como props en vez de
 * recalcularse acá.
 */
export default function ProfileSummaryPanel({
  isSeller,
  user,
  overviewStats,
  overviewActions,
  recentActivities,
  ordersThisMonthTotal,
  ordersCount,
  quoteSummary,
  shippingOrdersCount,
  onboardingSteps,
  completedOnboardingCount,
  onViewAllActivity,
}) {
  const navigate = useNavigate();

  return (
    <div className="profile-overview-grid">
      {/* Columna principal */}
      <div className="profile-overview-main-col">
        {/* 1. KPIs del rol */}
        <div className="profile-stats-grid-v2">
          {overviewStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.id}
                type="button"
                className={`profile-stat-card-v2 stat-v2-${stat.tone}`}
                onClick={stat.onClick}
              >
                <div className="stat-v2-top">
                  <span className="stat-v2-label">{stat.label}</span>
                  <span className="stat-v2-icon"><Icon size={20} /></span>
                </div>
                <strong className="stat-v2-val">{stat.value}</strong>
                <span className="stat-v2-action">
                  {stat.actionLabel} <ArrowUpRight size={13} />
                </span>
              </button>
            );
          })}
        </div>

        {/* 2. Acciones rápidas */}
        <section className="profile-panel-clean">
          <h2 className="profile-section-title">Acciones rápidas</h2>
          <div className="quick-actions-grid-v2">
            {overviewActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  className="quick-action-card-v2"
                  onClick={action.onClick}
                >
                  <span className={`action-v2-icon bg-${action.tone}-subtle`}><Icon size={20} /></span>
                  <span className="action-v2-body">
                    <strong>{action.title}</strong>
                    <span className="action-v2-desc">{action.description}</span>
                  </span>
                  <ChevronRight size={16} className="action-v2-arrow" />
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Actividad reciente */}
        <section className="profile-panel-clean">
          <div className="profile-panel-header-row">
            <h2 className="profile-section-title">Actividad reciente</h2>
            <button type="button" className="btn-view-details" onClick={onViewAllActivity}>
              Ver todo
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <EmptyState label="Aún no hay actividad reciente registrada." />
          ) : (
            <div className="activity-feed-table">
              <div className="activity-feed-header">
                <span>Actividad</span>
                <span>Detalle</span>
                <span>Fecha</span>
              </div>
              <div className="activity-feed-rows">
                {recentActivities.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    className="activity-feed-row"
                    onClick={act.action}
                  >
                    <span className="activity-type-col">
                      <span className={`activity-dot ${act.badgeClass}`} />
                      <strong>{act.title}</strong>
                    </span>
                    <span className="activity-detail-col">{act.detail}</span>
                    <span className="activity-date-col">{formatRelativeTime(act.date)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Columna lateral (widgets de apoyo) */}
      <aside className="profile-overview-side-col">
        {isSeller && (
          <CapturerContactCard capturer={user?.captadorCasaRepuestos} context="store" />
        )}

        {/* El resumen de compras se mantiene para compradores. El
            rendimiento de la tienda no se muestra hasta contar con
            datos reales del backend. */}
        {!isSeller && <div className="overview-widget-card">
          <div className="widget-header-row">
            <h3>{isSeller ? 'Rendimiento de la tienda' : 'Resumen de tus compras'}</h3>
            <span className="widget-tag">Este mes</span>
          </div>
          <div className="widget-metric-box">
            <span className="metric-label">{isSeller ? 'Ventas' : 'Total comprado'}</span>
            <strong className="metric-value">${formatCLP(ordersThisMonthTotal)}</strong>
            <span className="metric-sub">
              {isSeller
                ? `${ordersCount} pedidos recibidos en total`
                : `${ordersCount} pedidos realizados en total`}
            </span>
          </div>
          <div className="widget-metric-split">
            <div>
              <span className="metric-label">{isSeller ? 'Por responder' : 'En camino'}</span>
              <strong>{isSeller ? quoteSummary.pending : shippingOrdersCount}</strong>
            </div>
            <div>
              <span className="metric-label">{isSeller ? 'Sin leer' : 'Cotizaciones'}</span>
              <strong>{isSeller ? quoteSummary.unread : quoteSummary.total}</strong>
            </div>
          </div>
        </div>}

        {/* Widget 2: checklist de la cuenta */}
        <div className="overview-widget-card">
          <div className="widget-header-row">
            <h3>{isSeller ? 'Completa tu tienda' : 'Completa tu perfil'}</h3>
          </div>
          <div className="onboarding-progress-meta">
            <span>{completedOnboardingCount} de {onboardingSteps.length} completado</span>
            <div
              className="onboarding-progress-bar"
              role="progressbar"
              aria-valuenow={completedOnboardingCount}
              aria-valuemin={0}
              aria-valuemax={onboardingSteps.length}
            >
              <div
                className="onboarding-progress-fill"
                style={{ width: `${onboardingSteps.length ? (completedOnboardingCount / onboardingSteps.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="onboarding-steps-list">
            {onboardingSteps.map((step) => (
              <button
                key={step.id}
                type="button"
                className={`onboarding-step-row ${step.completed ? 'completed' : 'pending'}`}
                onClick={step.action}
              >
                {step.completed ? (
                  <CheckCircle2 size={17} className="step-icon-done" />
                ) : (
                  <Circle size={17} className="step-icon-todo" />
                )}
                <span>{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Widget 3: consejos según rol */}
        <div className="overview-widget-card tips-widget">
          <div className="tips-widget-icon-row">
            <Lightbulb size={18} className="tips-icon" />
            <h4>{isSeller ? 'Consejos para vender más' : 'Consejos para comprar mejor'}</h4>
          </div>
          <p className="tips-widget-text">
            {isSeller
              ? 'Responde rápido a las cotizaciones y mantén tu catálogo actualizado con fotos nítidas para aumentar tus ventas.'
              : 'Consulta por patente para filtrar repuestos compatibles y pide cotizaciones a varias tiendas antes de comprar.'}
          </p>
          <button type="button" className="tips-widget-link" onClick={() => navigate(ROUTES.support)}>
            Ver más consejos <ArrowUpRight size={13} />
          </button>
        </div>
      </aside>
    </div>
  );
}
