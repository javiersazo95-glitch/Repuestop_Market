import React from 'react';
import PaginationBar from './PaginationBar';

/**
 * Paginador de las listas del perfil (U2). Solo aparece con mas de una pagina; `note` avisa, por
 * ejemplo, que se muestran solo los pedidos mas recientes (antes se cortaba sin decirlo).
 */
export default function ListPager({ pagerProps, itemLabel, note }) {
  return (
    <>
      {pagerProps.totalPages > 1 && <PaginationBar {...pagerProps} itemLabel={itemLabel} />}
      {note && <p className="profile-list-note">{note}</p>}
    </>
  );
}
