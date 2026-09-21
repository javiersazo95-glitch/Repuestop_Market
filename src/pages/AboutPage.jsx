import React from 'react';
import AboutRepuesTopPage from '../components/AboutRepuesTopPage';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function AboutPage() {
  // Fuente unica del titulo: antes el componente hijo tambien lo escribia y,
  // como sus efectos corren primero, ese valor nunca llegaba a verse.
  useDocumentTitle('Sobre RepuesTop');
  const nav = useAppNavigation();

  return (
    <AboutRepuesTopPage
      onBack={nav.goHome}
      onContact={nav.goSupport}
      onOpenSeller={nav.goSellerRegister}
      onOpenCatalog={nav.goCatalog}
      onOpenStores={nav.goStores}
      onOpenAdsWall={nav.goAdsWall}
    />
  );
}
