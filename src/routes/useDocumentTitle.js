import { useEffect } from 'react';

const BASE_TITLE = 'RepuesTop | Marketplace de repuestos por patente';

/**
 * Título de pestaña por ruta. Importa para compartir enlaces, para el historial
 * del navegador y para los buscadores cuando el sitio salga a producción.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | RepuesTop` : BASE_TITLE;
    return () => { document.title = BASE_TITLE; };
  }, [title]);
}
