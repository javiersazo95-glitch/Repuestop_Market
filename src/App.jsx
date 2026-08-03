import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import OfficialPatentHero from './components/OfficialPatentHero';
import PromoGridBanners from './components/PromoGridBanners';
import LatestAddedPartsSection from './components/LatestAddedPartsSection';
import NewOnboardedStoresSection from './components/NewOnboardedStoresSection';
import CategoryGrid from './components/CategoryGrid';
import SocialProofTestimonials from './components/SocialProofTestimonials';
import ProductQuickViewModal from './components/ProductQuickViewModal';
import SellerRegisterModal from './components/SellerRegisterModal';
import AuthModal from './components/AuthModal';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';
import ProfileDashboard from './components/ProfileDashboard';
import StoresDirectoryView from './components/StoresDirectoryView';
import HelpSupportModal from './components/HelpSupportModal';
import PartsCatalogView from './components/PartsCatalogView';
import QuotationRequestModal from './components/QuotationRequestModal';
import StorePublicProfileView from './components/StorePublicProfileView';
import { AuthProvider, useAuth } from './context/AuthContext';


function MainApp() {
  const { isLoggedIn } = useAuth();

  // Top-level view: 'store' (marketplace homepage), 'profile' (account dashboard), 'stores' (stores directory), 'catalog' (all parts) or 'store-profile' (single store)
  const [view, setView] = useState('store');
  const [selectedStore, setSelectedStore] = useState(null);

  // Active Vehicle Garage State
  //
  // La clave lleva sufijo de versión: la versión anterior guardaba el vehículo de
  // demostración de src/data/sampleVehicles.js, que al volver de localStorage activaba
  // el filtro "solo compatibles" contra un auto que no existe en el inventario real y
  // dejaba el catálogo en cero resultados. Cambiar la clave descarta ese dato una vez.
  const ACTIVE_VEHICLE_KEY = 'repuestop_active_vehicle_v2';

  const [activeVehicle, setActiveVehicle] = useState(() => {
    try {
      localStorage.removeItem('repuestop_active_vehicle'); // dato de la era mock
      const saved = localStorage.getItem(ACTIVE_VEHICLE_KEY);
      if (saved && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.warn('Omitiendo parseo de vehículo previo:', e);
    }
    // Sin vehículo precargado: el usuario identifica su auto por patente contra
    // el backend (GET /api/v1/vehiculos/patente/{patente}).
    return null;
  });

  useEffect(() => {
    try {
      if (activeVehicle) {
        localStorage.setItem(ACTIVE_VEHICLE_KEY, JSON.stringify(activeVehicle));
      } else {
        localStorage.removeItem(ACTIVE_VEHICLE_KEY);
      }
    } catch (e) {
      // ignore quota or storage errors
    }
  }, [activeVehicle]);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Modals & Cart Drawer State
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [quoteProduct, setQuoteProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  // El carrito parte vacío; antes venía precargado con un producto de ejemplo.
  const [cartItems, setCartItems] = useState([]);

  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (productId, newQty) => {
    if (newQty <= 0) {
      setCartItems(prev => prev.filter(item => item.id !== productId));
      return;
    }
    setCartItems(prev => prev.map(item => item.id === productId ? { ...item, quantity: newQty } : item));
  };

  const handleRemoveFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const scrollToSection = () => {
    const el = document.querySelector('.latest-parts-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectStore = (store) => {
    setSelectedStore(store);
    setView('store-profile');
  };

  if (view === 'profile' && isLoggedIn) {
    return <ProfileDashboard onBackToStore={() => setView('store')} />;
  }

  return (
    <div className="repuestop-high-trust-app">
      {/* 1. Header with Top Security Bar & Active Garage Subbar */}
      <Header 
        activeVehicle={activeVehicle}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenSellerModal={() => setIsSellerModalOpen(true)}
        onOpenProfile={() => setView('profile')}
        onOpenStores={() => setView('stores')}
        onOpenCatalog={() => setView('catalog')}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        cartCount={cartItems.reduce((a, b) => a + b.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={() => {
          if (view !== 'catalog') setView('catalog');
        }}
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          setView('catalog');
        }}
      />

      {/* DYNAMIC VIEW CONTENT */}
      {view === 'stores' ? (
        <StoresDirectoryView
          onBackToStore={() => setView('store')}
          onSelectStore={handleSelectStore}
        />
      ) : view === 'store-profile' ? (
        <StorePublicProfileView
          store={selectedStore}
          onBackToStores={() => setView('stores')}
          onAddToCart={handleAddToCart}
          onQuickView={(prod) => setQuickViewProduct(prod)}
          onOpenQuote={(prod) => setQuoteProduct(prod)}
          activeVehicle={activeVehicle}
        />
      ) : view === 'catalog' ? (
        <PartsCatalogView
          onBackToStore={() => setView('store')}
          onAddToCart={handleAddToCart}
          onQuickView={(prod) => setQuickViewProduct(prod)}
          onOpenQuote={(prod) => setQuoteProduct(prod)}
          activeVehicle={activeVehicle}
        />
      ) : (
        <>
          {/* 2. Official Patent Hero Console */}
          <OfficialPatentHero 
            activeVehicle={activeVehicle}
            setActiveVehicle={setActiveVehicle}
            onOpenSellerModal={() => setIsSellerModalOpen(true)}
            onSearchSubmit={scrollToSection}
          />

          {/* 3. PROMO GRID BANNERS */}
          <PromoGridBanners onScrollToCatalog={() => setView('catalog')} />

          {/* 4. LATEST ADDED SPARE PARTS IN REAL-TIME */}
          <LatestAddedPartsSection 
            onAddToCart={handleAddToCart} 
            onQuickView={(prod) => setQuickViewProduct(prod)}
            onOpenQuote={(prod) => setQuoteProduct(prod)}
            onOpenCatalog={() => setView('catalog')}
          />

          {/* 5. NEW ONBOARDED AUTO PARTS STORES & WRECKING YARDS */}
          <NewOnboardedStoresSection 
            onOpenSellerModal={() => setIsSellerModalOpen(true)}
            onOpenStores={() => setView('stores')}
            onSelectStore={handleSelectStore}
          />

          {/* 6. Illustrated Category Grid Section */}
          <CategoryGrid 
            selectedCategory={selectedCategory} 
            onSelectCategory={(catId) => {
              setSelectedCategory(catId);
              setView('catalog');
            }} 
          />

          {/* 7. Social Proof Testimonials Section */}
          <SocialProofTestimonials />
        </>
      )}

      {/* 8. Footer Component */}
      <Footer
        onOpenSellerModal={() => setIsSellerModalOpen(true)}
        onOpenStores={() => setView('stores')}
        onOpenCatalog={() => setView('catalog')}
        onOpenHelp={() => setIsHelpModalOpen(true)}
      />

      {/* Shared Modals & Drawers */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onOpenSellerRegister={() => setIsSellerModalOpen(true)}
        onLoginSuccess={() => setView('profile')}
      />

      <SellerRegisterModal 
        isOpen={isSellerModalOpen} 
        onClose={() => setIsSellerModalOpen(false)} 
      />

      <ProductQuickViewModal 
        product={quickViewProduct} 
        activeVehicle={activeVehicle} 
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <QuotationRequestModal
        product={quoteProduct}
        isOpen={!!quoteProduct}
        onClose={() => setQuoteProduct(null)}
        activeVehicle={activeVehicle}
      />

      <HelpSupportModal 
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        activeVehicle={activeVehicle}
      />
    </div>
  );
}

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
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
