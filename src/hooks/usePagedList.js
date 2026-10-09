import { useMemo } from 'react';
import { useEffectAfterMount, useRestoredState } from '../routes/useRestoredState';

export const LIST_PAGE_SIZE = 20;

/** Tope de pedidos por consulta del backend: se piden los mas recientes (`services/api.js`). */
export const RECENT_ORDERS_LIMIT = 100;

/** Nota al pie cuando se alcanza el tope: antes la lista se cortaba sin avisar (U2). */
export function recentOrdersNote(count) {
  return count >= RECENT_ORDERS_LIMIT ? `Mostrando tus ${RECENT_ORDERS_LIMIT} pedidos más recientes.` : null;
}

/**
 * Pagina en el navegador una lista ya filtrada (U2, 5-oct): compras, ventas y cotizaciones se
 * pintaban completas. Los filtros siguen operando sobre la lista entera; `resetKey` vuelve a la
 * pagina 1 cuando cambian, pero no cuando la lista solo se refresca.
 *
 * Con `viewId` la pagina se recupera al volver con "atras" (por ejemplo, desde el detalle de un
 * pedido), en vez de reiniciar en la 1.
 */
export default function usePagedList(items, resetKey, pageSize = LIST_PAGE_SIZE, viewId = null) {
  const [page, setPage] = useRestoredState(viewId, 'page', 1);

  useEffectAfterMount(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  // Si la lista se achica (se finalizo o cancelo un pedido) la pagina actual puede quedar vacia.
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  const changePage = (next) => {
    setPage(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    pageItems,
    pagerProps: {
      currentPage,
      totalPages,
      onPageChange: changePage,
      rangeStart: totalItems ? start + 1 : 0,
      rangeEnd: Math.min(start + pageSize, totalItems),
      totalItems,
    },
  };
}
