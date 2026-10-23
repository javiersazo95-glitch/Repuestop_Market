import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import HelpHeader from '../components/help/HelpHeader';
import Footer from '../components/Footer';
import { seoTitleFor } from '../routes/seoPages';
import { useDocumentTitle } from '../routes/useDocumentTitle';

/**
 * Layout del centro de ayuda: barra propia + la vista hija (portada, categoría
 * o contacto) + el mismo Footer del marketplace, para no perder la identidad
 * del sitio ni los accesos que ya vivían ahí.
 */
export default function HelpCenterPage() {
  // El layout pone el título de cada vista hija (sus efectos corren antes y este los
  // pisaría): así /ayuda/pedidos no se ve igual que /ayuda para los buscadores.
  const { pathname } = useLocation();
  useDocumentTitle(seoTitleFor(pathname.replace(/\/+$/, '')) || 'Centro de ayuda');

  return (
    <div className="help-center-page">
      <HelpHeader />

      <main className="help-center-main">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}



