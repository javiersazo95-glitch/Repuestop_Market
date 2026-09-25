import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AboutHeader from '../components/about/AboutHeader';
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
    isAuthModalOpen, authModalOptions, openAuthModal, closeAuthModal,
    quoteProduct, closeQuote,
    searchQuery, setSearchQuery,
  } = useMarketplace();
  const { isLoggedIn, user } = useAuth();
  const isAboutPage = location.pathname === ROUTES.about;

  // Detección de link de referido o solicitud directa de registro:
  // Si la URL trae `ref=...` o `crear_cuenta=true` / `registro=true` / `register=true`,
  // abre directamente el popup de creación de cuenta rápida (selección Comprador vs Proveedor).
  const hasTriggeredRefModal = useRef(false);
  useEffect(() => {
    if (isLoggedIn) return;
    const hasRef = searchParams.has('ref');
    const wantsRegister = searchParams.get('crear_cuenta') === 'true'
      || searchParams.get('registro') === 'true'
      || searchParams.get('register') === 'true';

    if ((hasRef || wantsRegister) && !hasTriggeredRefModal.current) {
      hasTriggeredRefModal.current = true;
      openAuthModal({ initialStep: 'select_role', isRegistrationFlow: true });
    }
  }, [searchParams, isLoggedIn, openAuthModal]);

  // Una ruta protegida redirige aquí marcando `requireAuth`: abrimos el login y
  // recordamos a dónde quería ir el usuario.
  const redirectedFrom = location.state?.from;
  useEffect(() => {
    if (location.state?.requireAuth && !isLoggedIn) openAuthModal();
    // `openAuthModal` sale del value memoizado de MarketplaceContext y cambia de
    // referencia cada vez que `isAuthModalOpen` cambia (ver su useMemo). Si entra
    // en este array, cerrar el modal recalcula esa referencia, este efecto se
    // repite, `location.state.requireAuth` sigue en true y el modal se reabre
    // solo -- se cierra y aparece de nuevo al instante.
  }, [location.state, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {isAboutPage ? (
        <AboutHeader
          onBack={nav.goBack}
          onHome={nav.goHome}
          onSeller={nav.goSellerRegister}
          onLogin={openAuthModal}
        />
      ) : <Header
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
      />}

      <Outlet />

      <Footer />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        modalOptions={authModalOptions}
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

