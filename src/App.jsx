import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MarketplaceProvider } from './context/MarketplaceContext';
import AppRoutes from './routes/AppRoutes';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary React caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: '#0f172a', fontSize: '24px', fontWeight: 800 }}>¡RepuesTop.cl Marketplace!</h2>
          <p style={{ color: '#475569', margin: '12px 0 24px', maxWidth: '500px' }}>Ha ocurrido una actualización de interfaz. Haz clic para recargar la aplicación limpiamente.</p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ backgroundColor: '#0066ff', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '20px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,102,255,0.3)' }}
          >
            Cargar Mercado
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <MarketplaceProvider>
            <AppRoutes />
          </MarketplaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
