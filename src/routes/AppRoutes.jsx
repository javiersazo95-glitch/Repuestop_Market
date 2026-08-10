import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './AppLayout';
import RequireAuth from './RequireAuth';
import ScrollToTop from './ScrollToTop';
import { ROUTES } from './paths';
import HomePage from '../pages/HomePage';
import CatalogPage from '../pages/CatalogPage';
import ProductPage from '../pages/ProductPage';
import StoresPage from '../pages/StoresPage';
import StorePage from '../pages/StorePage';
import SupportPage from '../pages/SupportPage';
import AboutPage from '../pages/AboutPage';
import ProfilePage from '../pages/ProfilePage';
import SellerRegisterPage from '../pages/SellerRegisterPage';
import NotFoundPage from '../pages/NotFoundPage';
import PurchaseSuccessPage from '../pages/PurchaseSuccessPage';

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Rutas con header/footer/carrito del marketplace */}
        <Route element={<AppLayout />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.catalog} element={<CatalogPage />} />
          <Route path={ROUTES.product} element={<ProductPage />} />
          <Route path={ROUTES.stores} element={<StoresPage />} />
          <Route path={ROUTES.store} element={<StorePage />} />
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
    </>
  );
}
