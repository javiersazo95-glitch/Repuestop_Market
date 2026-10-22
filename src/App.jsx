import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { MarketplaceProvider } from './context/MarketplaceContext';
import AppRoutes from './routes/AppRoutes';
import TermsReacceptanceModal from './components/TermsReacceptanceModal';
import SellerAdhesionModal from './components/SellerAdhesionModal';
import DeclaracionIvaPrompt from './components/DeclaracionIvaPrompt';
import SystemErrorPage from './components/SystemErrorPage';
import CookieConsentBanner from './components/CookieConsentBanner';
import MobileAppNotice from './components/MobileAppNotice';
import { RemoteConfigProvider } from './remoteConfig/RemoteConfigContext';
import Feature from './remoteConfig/Feature';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) =>
        error?.status >= 400 && error?.status < 500 ? false : failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleWindowError = (event) => {
    if (event.error) this.setState({ hasError: true });
  };

  handleUnhandledRejection = () => {
    this.setState({ hasError: true });
  };

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary React caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <SystemErrorPage />;
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* Configuracion del Mantenedor comun: arranca con la cache local o los fallbacks y
          descarga el bootstrap en paralelo, sin bloquear el render. */}
      <RemoteConfigProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <MarketplaceProvider>
                {/* Los montajes globales se pueden apagar desde el mantenedor (`market.global.*`);
                    sin bootstrap el flag vale `true` y todo se monta como siempre. */}
                <Feature flag="market.global.aviso-app-movil"><MobileAppNotice /></Feature>
                <AppRoutes />
                {/* Va por encima de las rutas: el perfil vive fuera de AppLayout y el aviso
                    tiene que alcanzarlo igual. */}
                <Feature flag="market.global.modal-reaceptacion-terminos"><TermsReacceptanceModal /></Feature>
                <Feature flag="market.global.modal-adhesion-vendedor"><SellerAdhesionModal /></Feature>
                <Feature flag="market.global.prompt-declaracion-iva"><DeclaracionIvaPrompt /></Feature>
                <Feature flag="market.global.cookie-banner"><CookieConsentBanner /></Feature>
              </MarketplaceProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </RemoteConfigProvider>
    </ErrorBoundary>
  );
}
