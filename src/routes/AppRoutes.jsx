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
const SupportPage = lazy(() => import('../pages/SupportPage'));
const AboutPage = lazy(() => import('../pages/AboutPage'));
const AdsWallPage = lazy(() => import('../pages/AdsWallPage'));
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
              <Route path={ROUTES.support} element={<SupportPage />} />
              <Route
                path={ROUTES.purchaseSuccess}
                element={<RequireAuth><PurchaseSuccessPage /></RequireAuth>}
              />
              <Route path={ROUTES.notFound} element={<NotFoundPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* Páginas a pantalla completa, sin el chrome del marketplace */}
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
