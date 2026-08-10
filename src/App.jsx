import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MarketplaceProvider } from './context/MarketplaceContext';
import AppRoutes from './routes/AppRoutes';
import SystemErrorPage from './components/SystemErrorPage';

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
