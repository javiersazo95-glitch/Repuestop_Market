import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import CartAddedToast from '../components/CartAddedToast';
import QuotationRequestModal from '../components/QuotationRequestModal';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from './useAppNavigation';
import { catalogPath, profilePath, ROUTES } from './paths';

/**
 * Chrome compartido (header, footer, carrito y modales globales) para todas las
 * rutas públicas del marketplace. Las páginas a pantalla completa —perfil y
 * registro de vendedor— quedan fuera de este layout.
 */
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nav = useAppNavigation();
  const {
    activeVehicle, cartCount,
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

  // Sincronizar el buscador global con la ruta: si el usuario no está en el catálogo,
  // el input del header se limpia automáticamente para una nueva búsqueda fresca.
  useEffect(() => {
    if (location.pathname !== ROUTES.catalog) {
      if (searchQuery) setSearchQuery('');
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
        onOpenAdsWall={nav.goAdsWall}
        onOpenHelp={nav.goHelp}
        cartCount={cartCount}
        onOpenCart={nav.goCart}
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
        onOpenAdsWall={nav.goAdsWall}
        onOpenHelp={nav.goHelp}
        onOpenTerms={nav.goTerms}
        onOpenPrivacy={nav.goPrivacy}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onOpenSellerRegister={nav.goSellerRegister}
        onLoginSuccess={() => {
          // Si el usuario está comprando, iniciar sesión no debe sacarlo del flujo.
          const enFlujoDeCompra = location.pathname.startsWith(ROUTES.cart)
            || location.pathname.startsWith(ROUTES.checkout);
          if (!enFlujoDeCompra) {
            const defaultTarget = location.pathname === ROUTES.adsWall ? profilePath('anuncios') : profilePath('resumen');
            navigate(redirectedFrom || defaultTarget, { replace: true });
          }
        }}
      />

      <QuotationRequestModal
        product={quoteProduct}
        isOpen={!!quoteProduct}
        onClose={closeQuote}
        activeVehicle={activeVehicle}
        user={user}
        isLoggedIn={isLoggedIn}
        onRequireLogin={() => {
          closeQuote();
          openAuthModal();
        }}
      />

      <CartAddedToast />

    </div>
  );
}


