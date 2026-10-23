import { useEffect } from 'react';
import { BASE_TITLE, titleWithBrand } from './seoPages';

/**
 * Título de pestaña por ruta. Importa para compartir enlaces, para el historial
 * del navegador y para los buscadores. BASE_TITLE es el mismo <title> de
 * index.html: antes decía "por patente" y Google veía un título distinto al
 * del HTML.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = titleWithBrand(title);
    return () => { document.title = BASE_TITLE; };
  }, [title]);
}

/**
 * Marca la ruta como no indexable mientras esté montada. Las URL inexistentes
 * responden 200 (la SPA sirve app.html en todas): sin esto Google las guardaría
 * como páginas reales con el texto de "Página no encontrada".
 */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);
}
