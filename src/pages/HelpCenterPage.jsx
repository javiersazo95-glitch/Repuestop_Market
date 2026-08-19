import React from 'react';
import { Outlet } from 'react-router-dom';
import HelpHeader from '../components/help/HelpHeader';
import Footer from '../components/Footer';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';

/**
 * Layout del centro de ayuda: barra propia + la vista hija (portada, categoría
 * o contacto) + el mismo Footer del marketplace, para no perder la identidad
 * del sitio ni los accesos que ya vivían ahí.
 */
export default function HelpCenterPage() {
  useDocumentTitle('Centro de ayuda');
  const nav = useAppNavigation();

  return (
    <div className="help-center-page">
      <HelpHeader />

      <main className="help-center-main">
        <Outlet />
      </main>

      <Footer
        onOpenSellerModal={nav.goSellerRegister}
        onOpenStores={nav.goStores}
        onOpenCatalog={() => nav.goCatalog()}
        onOpenAdsWall={nav.goAdsWall}
        // Ya estamos en el centro de ayuda: el enlace del footer sube al inicio
        // en vez de navegar a la misma ruta.
        onOpenHelp={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </div>
  );
}
