import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('RouteErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    } else {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
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
            <h2 className="route-error-title">No pudimos cargar esta sección</h2>
            <p className="route-error-message">
              Ocurrió un problema inesperado al procesar la información. Puedes reintentar o regresar a la página principal.
            </p>
            {this.state.error?.message && (
              <div className="route-error-details">
                <code>{this.state.error.message}</code>
              </div>
            )}
            <div className="route-error-actions">
              <button
                type="button"
                className="route-error-btn-primary"
                onClick={this.handleRetry}
                aria-label="Reintentar cargar la página"
              >
                <RefreshCw size={16} /> Reintentar
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
