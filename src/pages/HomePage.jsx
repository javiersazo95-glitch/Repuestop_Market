import React from 'react';
import OfficialPatentHero from '../components/OfficialPatentHero';
import LatestAddedPartsSection from '../components/LatestAddedPartsSection';
import NewOnboardedStoresSection from '../components/NewOnboardedStoresSection';
import SocialProofTestimonials from '../components/SocialProofTestimonials';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { useScrollMemory } from '../routes/useScrollMemory';
import Feature from '../remoteConfig/Feature';

export default function HomePage() {
  useDocumentTitle(null);
  const nav = useAppNavigation();
  const { activeVehicle, setActiveVehicle, openQuote } = useMarketplace();
  // Al volver de un repuesto o una tienda, el inicio queda en la misma posición (las secciones
  // se pintan desde la caché de React Query).
  useScrollMemory(true);

  return (
    <>
      {/* Cada seccion se puede apagar desde el Mantenedor comun (`market.home.*`). Sin bootstrap
          el flag vale `true` y el inicio se ve como siempre. */}
      {/* 1. Official Patent Hero Console */}
      <Feature flag="market.home.hero-patente">
        <OfficialPatentHero
          activeVehicle={activeVehicle}
          onSelectVehicle={setActiveVehicle}
          onOpenSellerModal={nav.goSellerRegister}
          onOpenCatalog={(filter, extra) => nav.goCatalog(filter, extra)}
          onOpenHelp={nav.goHelp}
          selectedCategory={null}
          onSelectCategory={(filter) => nav.goCatalog(filter)}
        />
      </Feature>

      {/* 2. LATEST ADDED SPARE PARTS IN REAL-TIME */}
      <Feature flag="market.home.ultimos-agregados">
        <LatestAddedPartsSection
          onQuickView={nav.goProduct}
          onOpenQuote={openQuote}
          onOpenCatalog={() => nav.goCatalog(null, { todos: true })}
        />
      </Feature>

      {/* 3. NEW ONBOARDED AUTO PARTS STORES & WRECKING YARDS */}
      <Feature flag="market.home.tiendas-nuevas">
        <NewOnboardedStoresSection
          onOpenSellerModal={nav.goSellerRegister}
          onOpenStores={nav.goStores}
          onSelectStore={nav.goStore}
        />
      </Feature>

      {/* 4. Social Proof Testimonials Section */}
      <Feature flag="market.home.testimonios">
        <SocialProofTestimonials />
      </Feature>
    </>
  );
}
