import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './AppLayout';
import RequireAuth from './RequireAuth';
import ScrollToTop from './ScrollToTop';
import { ROUTES } from './paths';
import RouteErrorBoundary from '../components/RouteErrorBoundary';
import PageLoadingSkeleton from '../components/skeletons/PageLoadingSkeleton';

// Code-splitting por ruta (Fase 8)
const HomePage = lazy(() => import('../pages/HomePage'));
const CatalogPage = lazy(() => import('../pages/CatalogPage'));
const ProductPage = lazy(() => import('../pages/ProductPage'));
const StoresPage = lazy(() => import('../pages/StoresPage'));
const StorePage = lazy(() => import('../pages/StorePage'));
const HelpCenterPage = lazy(() => import('../pages/HelpCenterPage'));
const HelpHomeView = lazy(() => import('../pages/help/HelpHomeView'));
const HelpCategoryView = lazy(() => import('../pages/help/HelpCategoryView'));
const HelpContactView = lazy(() => import('../pages/help/HelpContactView'));
const HelpAllFaqsView = lazy(() => import('../pages/help/HelpAllFaqsView'));
const TermsPage = lazy(() => import('../pages/TermsPage'));
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'));
const AboutPage = lazy(() => import('../pages/AboutPage'));
const AdsWallPage = lazy(() => import('../pages/AdsWallPage'));
const CartPage = lazy(() => import('../pages/CartPage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const SellerRegisterPage = lazy(() => import('../pages/SellerRegisterPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const PurchaseSuccessPage = lazy(() => import('../pages/PurchaseSuccessPage'));

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <RouteErrorBoundary>
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Routes>
            {/* Rutas con header/footer/carrito del marketplace */}
            <Route element={<AppLayout />}>
              <Route path={ROUTES.home} element={<HomePage />} />
              <Route path={ROUTES.catalog} element={<CatalogPage />} />
              <Route path={ROUTES.product} element={<ProductPage />} />
              <Route path={ROUTES.stores} element={<StoresPage />} />
              <Route path={ROUTES.store} element={<StorePage />} />
              <Route path={ROUTES.adsWall} element={<AdsWallPage />} />
              {/* El carrito es público: un invitado tiene que poder revisarlo antes de
                  iniciar sesión. El checkout sí exige sesión. */}
              <Route path={ROUTES.cart} element={<CartPage />} />
              <Route
                path={ROUTES.checkout}
                element={<RequireAuth><CheckoutPage /></RequireAuth>}
              />
              <Route
                path={ROUTES.purchaseSuccess}
                element={<RequireAuth><PurchaseSuccessPage /></RequireAuth>}
              />
              <Route path={ROUTES.notFound} element={<NotFoundPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* Páginas a pantalla completa, sin el chrome del marketplace */}
            {/* Centro de ayuda: header propio + footer del marketplace. `contacto`
                va antes que `:categoria` o el param se lo comería. */}
            <Route path={ROUTES.support} element={<HelpCenterPage />}>
              <Route index element={<HelpHomeView />} />
              <Route path="contacto" element={<HelpContactView />} />
              <Route path="preguntas-frecuentes" element={<HelpAllFaqsView />} />
              <Route path=":categoria" element={<HelpCategoryView />} />
            </Route>

            <Route path={ROUTES.terms} element={<TermsPage />} />
            <Route path={ROUTES.privacy} element={<PrivacyPage />} />
            <Route path={ROUTES.about} element={<AboutPage />} />
            <Route path={ROUTES.sellerRegister} element={<SellerRegisterPage />} />

            <Route path={ROUTES.profile} element={<Navigate to={`${ROUTES.profile}/resumen`} replace />} />
            <Route
              path={ROUTES.profileTab}
              element={(
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              )}
            />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </>
  );
}


