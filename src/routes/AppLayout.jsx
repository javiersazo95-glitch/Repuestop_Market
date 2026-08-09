import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import CartDrawer from '../components/CartDrawer';
import QuotationRequestModal from '../components/QuotationRequestModal';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from './useAppNavigation';
import { catalogPath, profilePath } from './paths';

/**
 * Chrome compartido (header, footer, carrito y modales globales) para todas las
 * rutas públicas del marketplace. Las páginas a pantalla completa —perfil,
 * "quiénes somos" y registro de vendedor— quedan fuera de este layout.
 */
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nav = useAppNavigation();
  const {
    activeVehicle, cartCount, cartItems, updateCartQuantity, removeFromCart, clearCart,
    isCartOpen, openCart, closeCart,
    isAuthModalOpen, openAuthModal, closeAuthModal,
    quoteProduct, closeQuote,
    searchQuery, setSearchQuery,
  } = useMarketplace();
  const { isLoggedIn, user } = useAuth();

  // Una ruta protegida redirige aquí marcando `requireAuth`: abrimos el login y
  // recordamos a dónde quería ir el usuario.
  const redirectedFrom = location.state?.from;
  useEffect(() => {
    if (location.state?.requireAuth && !isLoggedIn) openAuthModal();
  }, [location.state, isLoggedIn, openAuthModal]);

  // El buscador del header es global: al enviarlo la búsqueda queda en la URL
  // del catálogo (`/repuestos?q=...`), así se puede compartir y refrescar.
  const submitSearch = () => {
    const term = searchQuery.trim();
    navigate(catalogPath(
      {
        category: searchParams.get('categoria'),
        categoryId: searchParams.get('categoriaId'),
        subcategory: searchParams.get('subcategoria'),
        subcategoryId: searchParams.get('subcategoriaId'),
      },
      { q: term }
    ));
  };

  return (
    <div className="repuestop-high-trust-app">
      <Header
        activeVehicle={activeVehicle}
        onOpenAuthModal={openAuthModal}
        onOpenSellerModal={nav.goSellerRegister}
        onOpenProfile={nav.goProfile}
        onOpenHome={nav.goHome}
        onOpenStores={nav.goStores}
        onOpenCatalog={() => nav.goCatalog()}
        onOpenAbout={nav.goAbout}
        onOpenHelp={nav.goHelp}
        cartCount={cartCount}
        onOpenCart={openCart}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={submitSearch}
        onSelectCategory={(filter) => nav.goCatalog(filter)}
      />

      <Outlet />

      <Footer
        onOpenSellerModal={nav.goSellerRegister}
        onOpenStores={nav.goStores}
        onOpenCatalog={() => nav.goCatalog()}
        onOpenHelp={nav.goHelp}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onOpenSellerRegister={nav.goSellerRegister}
        onLoginSuccess={() => navigate(redirectedFrom || profilePath('resumen'), { replace: true })}
      />

      <QuotationRequestModal
        product={quoteProduct}
        isOpen={!!quoteProduct}
        onClose={closeQuote}
        activeVehicle={activeVehicle}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={closeCart}
        cartItems={cartItems}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeFromCart}
        onClearCart={clearCart}
        activeVehicle={activeVehicle}
        user={user}
        isLoggedIn={isLoggedIn}
        onOpenAuthModal={openAuthModal}
      />
    </div>
  );
}
