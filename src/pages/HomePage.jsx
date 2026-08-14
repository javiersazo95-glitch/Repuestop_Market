import React from 'react';
import OfficialPatentHero from '../components/OfficialPatentHero';
import LatestAddedPartsSection from '../components/LatestAddedPartsSection';
import NewOnboardedStoresSection from '../components/NewOnboardedStoresSection';
import SocialProofTestimonials from '../components/SocialProofTestimonials';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function HomePage() {
  useDocumentTitle(null);
  const nav = useAppNavigation();
  const { activeVehicle, setActiveVehicle, addToCart, openQuote } = useMarketplace();

  return (
    <>
      {/* 1. Official Patent Hero Console */}
      <OfficialPatentHero
        activeVehicle={activeVehicle}
        onSelectVehicle={setActiveVehicle}
        onOpenSellerModal={nav.goSellerRegister}
        onOpenCatalog={(filter, extra) => nav.goCatalog(filter, extra)}
        onOpenHelp={nav.goHelp}
        selectedCategory={null}
        onSelectCategory={(filter) => nav.goCatalog(filter)}
      />

      {/* 2. LATEST ADDED SPARE PARTS IN REAL-TIME */}
      <LatestAddedPartsSection
        onAddToCart={addToCart}
        onQuickView={nav.goProduct}
        onOpenQuote={openQuote}
        onOpenCatalog={() => nav.goCatalog()}
      />

      {/* 3. NEW ONBOARDED AUTO PARTS STORES & WRECKING YARDS */}
      <NewOnboardedStoresSection
        onOpenSellerModal={nav.goSellerRegister}
        onOpenStores={nav.goStores}
        onSelectStore={nav.goStore}
      />

      {/* 4. Social Proof Testimonials Section */}
      <SocialProofTestimonials />
    </>
  );
}
