import React, { useEffect } from 'react';
import PartsCatalogView from '../components/PartsCatalogView';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useCatalogUrlState } from '../routes/useCatalogUrlState';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function CatalogPage() {
  const nav = useAppNavigation();
  const { activeVehicle, setActiveVehicle, openQuote, searchQuery, setSearchQuery } = useMarketplace();

  const { filter, query, page, showAll, advanced, syncUrl } = useCatalogUrlState();

  useDocumentTitle(query
    ? `Búsqueda: ${query}`
    : (filter?.subcategory || filter?.category || 'Catálogo de repuestos'));

  // El buscador del header refleja el término que está aplicado en la URL.
  useEffect(() => {
    if (query !== searchQuery) setSearchQuery(query);
    // Solo debe reaccionar al término de la URL, no a lo que el usuario está tecleando.
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PartsCatalogView
      onBackToStore={nav.goHome}
      onQuickView={nav.goProduct}
      onOpenQuote={openQuote}
      activeVehicle={activeVehicle}
      initialCatalogFilter={filter}
      initialSearchQuery={query}
      initialPage={page}
      initialShowAll={showAll}
      initialAdvancedFilters={advanced}
      onVehicleChange={setActiveVehicle}
      onNavigationStateChange={syncUrl}
    />
  );
}
