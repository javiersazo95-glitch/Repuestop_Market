import React from 'react';
import { Outlet } from 'react-router-dom';
import HelpHeader from '../components/help/HelpHeader';
import Footer from '../components/Footer';
import { useDocumentTitle } from '../routes/useDocumentTitle';

/**
 * Layout del centro de ayuda: barra propia + la vista hija (portada, categoría
 * o contacto) + el mismo Footer del marketplace, para no perder la identidad
 * del sitio ni los accesos que ya vivían ahí.
 */
export default function HelpCenterPage() {
  useDocumentTitle('Centro de ayuda');

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



