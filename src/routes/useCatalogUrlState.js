import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATALOG_ADVANCED_PARAMS, catalogFilterFromParams } from './paths';

/**
 * Filtros, busqueda y pagina del catalogo leidos de la URL, y `syncUrl` para que el catalogo
 * los empuje de vuelta. Asi, al abrir un repuesto y volver, el catalogo se arma igual que estaba.
 * Lo usan /repuestos y el inventario de cada tienda.
 */
export function useCatalogUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const parsed = useMemo(
    () => catalogFilterFromParams(searchParams),
    [searchParams]
  );

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
      apply('todos', state.showAll ? '1' : null);

      // Filtros avanzados: sin esto se perdian al abrir la ficha de un repuesto y volver.
      const advancedState = state.advanced || {};
      Object.entries(CATALOG_ADVANCED_PARAMS).forEach(([field, key]) => apply(key, advancedState[field]));

      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return { ...parsed, syncUrl };
}
