import React, { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PartsCatalogView from '../components/PartsCatalogView';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { catalogFilterFromParams } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useAppNavigation();
  const { activeVehicle, openQuote, searchQuery, setSearchQuery } = useMarketplace();

  const { filter, query, page } = useMemo(
    () => catalogFilterFromParams(searchParams),
    [searchParams]
  );

  useDocumentTitle(query
    ? `Búsqueda: ${query}`
    : (filter?.subcategory || filter?.category || 'Catálogo de repuestos'));

  // El buscador del header refleja el término que está aplicado en la URL.
  useEffect(() => {
    if (query !== searchQuery) setSearchQuery(query);
    // Solo debe reaccionar al término de la URL, no a lo que el usuario está tecleando.
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // El catálogo empuja sus filtros de vuelta a la URL. Se usa `replace` para no
  // llenar el historial con cada clic de filtro; el botón atrás sigue devolviendo
  // a la pantalla anterior.
  const syncUrl = useCallback((state) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const apply = (key, value) => {
        if (value) next.set(key, String(value));
        else next.delete(key);
      };

      // Cambiar de categoría dentro del catálogo invalida los ids que traía la URL
      // desde el menú del header: se descartan para no filtrar por la anterior.
      if ((state.category || null) !== (current.get('categoria') || null)) {
        next.delete('categoriaId');
        next.delete('categoriaNombre');
        next.delete('subcategoriaId');
      }
      if ((state.subcategory || null) !== (current.get('subcategoria') || null)) {
        next.delete('subcategoriaId');
      }

      apply('categoria', state.category);
      apply('subcategoria', state.subcategory);
      apply('q', state.query?.trim());
      apply('pagina', state.page > 1 ? state.page : null);

      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return (
    <PartsCatalogView
      onBackToStore={nav.goHome}
      onQuickView={nav.goProduct}
      onOpenQuote={openQuote}
      activeVehicle={activeVehicle}
      initialCatalogFilter={filter}
      initialSearchQuery={query}
      initialPage={page}
      onNavigationStateChange={syncUrl}
    />
  );
}
