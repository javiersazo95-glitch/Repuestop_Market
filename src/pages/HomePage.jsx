import React from 'react';
import OfficialPatentHero from '../components/OfficialPatentHero';
import HomeFeaturedParts from '../components/home/HomeFeaturedParts';
import HomeEncargarBanner from '../components/home/HomeEncargarBanner';
import HomeFeaturedStores from '../components/home/HomeFeaturedStores';
import HomeServiceBanners from '../components/home/HomeServiceBanners';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { useScrollMemory } from '../routes/useScrollMemory';
import Feature from '../remoteConfig/Feature';
import '../styles/home-sections.css';

export default function HomePage() {
  useDocumentTitle(null);
  const nav = useAppNavigation();
  const { activeVehicle, setActiveVehicle } = useMarketplace();
  const { user, role } = useAuth();
  // La cuenta vendedora solo vende: no tiene talleres ni servicios automotrices (igual que el menu).
  const isSellerAccount = String(user?.role || role || '').toUpperCase() === 'SELLER' && Boolean(user?.sellerId);
  // Al volver de un repuesto o una tienda, el inicio queda en la misma posición (las secciones
  // se pintan desde la caché de React Query).
  useScrollMemory(true);

  return (
    <>
      {/* Cada seccion se puede apagar desde el Mantenedor comun (`market.home.*`). Sin bootstrap
          el flag vale `true` y el inicio se ve como siempre. El orden es el del menu superior:
          repuestos, encargar repuesto, casas de repuestos, fallas automotrices y talleres. */}
      {/* 1. Repuestos: buscador por patente y categorias */}
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

      {/* 1b. Ultimos repuestos agregados */}
      <Feature flag="market.home.ultimos-agregados">
        <HomeFeaturedParts
          onQuickView={nav.goProduct}
          onOpenCatalog={() => nav.goCatalog(null, { todos: true })}
        />
      </Feature>

      {/* 2. Encargar repuesto */}
      <Feature flag="market.home.encargar-repuesto">
        <HomeEncargarBanner isSeller={isSellerAccount} />
      </Feature>

      {/* 3. Casas de repuestos */}
      <Feature flag="market.home.tiendas-nuevas">
        <HomeFeaturedStores onOpenStores={nav.goStores} onSelectStore={nav.goStore} />
      </Feature>

      {/* 4 y 5. Fallas automotrices y talleres (la cuenta vendedora no tiene talleres) */}
      <HomeServiceBanners showWorkshops={!isSellerAccount} />
    </>
  );
}
