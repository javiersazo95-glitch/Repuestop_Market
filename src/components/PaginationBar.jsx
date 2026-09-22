import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Barra de paginación común del catálogo, la ficha de tienda y el directorio.
 *
 * Existía copiada tres veces y solo la del catálogo acotaba los números. Las otras dos
 * pintaban un botón por página con `Array.from({ length: totalPages })`, así que un
 * resultado grande —853 repuestos en 72 páginas, por ejemplo— dibujaba 72 botones en una
 * fila sin `flex-wrap`: se salían del contenedor por la derecha y rompían el margen.
 */

const MAX_VISIBLE_PAGES = 7;

/**
 * Números a mostrar: siempre la primera y la última, el actual con un vecino a cada lado, y
 * puntos suspensivos donde se saltan páginas. Devuelve a lo más `MAX_VISIBLE_PAGES` entradas,
 * así que la barra mide lo mismo con 8 páginas que con 8.000.
 */
export function buildPageItems(currentPage, totalPages) {
  if (totalPages <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  if (currentPage > 3) items.push('dots-prev');

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let page = start; page <= end; page += 1) items.push(page);

  if (currentPage < totalPages - 2) items.push('dots-next');
  items.push(totalPages);

  return items;
}

export default function PaginationBar({
  currentPage,
  totalPages,
  onPageChange,
  rangeStart,
  rangeEnd,
  totalItems,
  // "repuestos" o "tiendas": va tanto en el resumen como en las opciones del selector.
  itemLabel = 'resultados',
  itemsPerPage,
  onItemsPerPageChange,
  perPageOptions = [12, 24, 36],
}) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const pageItems = buildPageItems(currentPage, safeTotalPages);

  return (
    <div className="directory-pagination-bar">
      <div className="pagination-info">
        <span>
          Mostrando del <strong>{rangeStart}</strong> al <strong>{rangeEnd}</strong> de{' '}
          <strong>{Number(totalItems || 0).toLocaleString('es-CL')}</strong> {itemLabel}{' '}
          (Página {currentPage} de {safeTotalPages})
        </span>
      </div>

      <div className="pagination-controls-group">
        {onItemsPerPageChange && (
          <div className="per-page-selector">
            <span>Ver:</span>
            <select
              value={itemsPerPage}
              onChange={(event) => onItemsPerPageChange(Number(event.target.value))}
              className="select-per-page"
            >
              {perPageOptions.map((option) => (
                <option key={option} value={option}>{option} por página</option>
              ))}
            </select>
          </div>
        )}

        <nav className="page-buttons-list" aria-label="Paginación">
          <button
            type="button"
            className="btn-page-nav"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            title="Página Anterior"
          >
            <ChevronLeft size={16} />
            <span>Anterior</span>
          </button>

          {pageItems.map((item, index) => (
            typeof item === 'string' ? (
              <span key={`${item}-${index}`} className="pagination-dots" aria-hidden="true">…</span>
            ) : (
              <button
                type="button"
                key={item}
                className={`btn-page-number ${currentPage === item ? 'active' : ''}`}
                aria-current={currentPage === item ? 'page' : undefined}
                aria-label={`Página ${item}`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            )
          ))}

          <button
            type="button"
            className="btn-page-nav"
            disabled={currentPage === safeTotalPages}
            onClick={() => onPageChange(currentPage + 1)}
            title="Página Siguiente"
          >
            <span>Siguiente</span>
            <ChevronRight size={16} />
          </button>
        </nav>
      </div>
    </div>
  );
}
