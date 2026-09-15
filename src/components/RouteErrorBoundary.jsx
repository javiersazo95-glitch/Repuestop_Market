import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Sentry } from '../sentry.js';
import { isStaleChunkError, reloadForNewDeploy } from '../utils/staleDeploy';

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, staleDeploy: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, staleDeploy: isStaleChunkError(error) };
  }

  componentDidCatch(error, errorInfo) {
    // Chunk de un build anterior: la pestaña quedó vieja tras un deploy. Es el respaldo
    // del listener de `vite:preloadError` (ver utils/staleDeploy.js), para los fallos de
    // `lazy()` que no pasan por el helper de preload. No va a Sentry: no es un defecto
    // del código y se repetiría en cada despliegue, gastando la cuota del plan gratis.
    // El componentStack hace falta para el caso del módulo vacío: ahí el mensaje del error
    // es un TypeError genérico y lo único que lo delata es que reventó dentro de un lazy.
    if (isStaleChunkError(error, errorInfo?.componentStack)) {
      console.warn('Chunk de un build anterior; recargando para tomar el deploy nuevo:', error);
      if (!this.state.staleDeploy) this.setState({ staleDeploy: true });
      reloadForNewDeploy();
      return;
    }
    console.error('RouteErrorBoundary caught an error:', error, errorInfo);
    // No-op si Sentry.init() nunca corrio (sin VITE_SENTRY_DSN, como en dev local).
    Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
  }

  handleRetry = () => {
    // Con un chunk viejo no sirve reintentar el render: el build de esta pestaña ya no
    // existe en el servidor. Hay que traer el index.html nuevo sí o sí.
    if (this.state.staleDeploy) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, staleDeploy: false });
    if (this.props.onRetry) {
      this.props.onRetry();
    } else {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, staleDeploy: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="route-error-container" role="alert" aria-live="assertive">
          <div className="route-error-card">
            <div className="route-error-icon-wrapper">
              <AlertTriangle className="route-error-icon" size={36} />
            </div>
            <h2 className="route-error-title">
              {this.state.staleDeploy ? 'Hay una versión nueva de RepuesTop' : 'No pudimos cargar esta sección'}
            </h2>
            <p className="route-error-message">
              {this.state.staleDeploy
                ? 'Publicamos una actualización mientras tenías esta pestaña abierta. Recarga para seguir donde ibas; no se pierde nada de tu carrito ni de tu sesión.'
                : 'Ocurrió un problema inesperado al procesar la información. Puedes reintentar o regresar a la página principal.'}
            </p>
            {/* El detalle tecnico no aporta cuando ya sabemos que es un deploy nuevo. */}
            {!this.state.staleDeploy && this.state.error?.message && (
              <div className="route-error-details">
                <code>{this.state.error.message}</code>
              </div>
            )}
            <div className="route-error-actions">
              <button
                type="button"
                className="route-error-btn-primary"
                onClick={this.handleRetry}
                aria-label={this.state.staleDeploy ? 'Recargar la página' : 'Reintentar cargar la página'}
              >
                <RefreshCw size={16} /> {this.state.staleDeploy ? 'Recargar' : 'Reintentar'}
              </button>
              <button
                type="button"
                className="route-error-btn-secondary"
                onClick={this.handleGoHome}
                aria-label="Volver al Inicio"
              >
                <Home size={16} /> Volver al Inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
