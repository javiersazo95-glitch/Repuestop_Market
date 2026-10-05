import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_PREFIX = 'scroll:';

function readSaved(key) {
  try {
    const value = Number(window.sessionStorage.getItem(STORAGE_PREFIX + key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Recuerda el scroll de una vista por entrada del historial y lo devuelve al volver con
 * "atras" recien cuando el contenido ya esta pintado (`ready`).
 *
 * El navegador restaura el scroll en el mismo instante del popstate, cuando todavia esta la
 * ficha del repuesto (mas corta) o el catalogo cargando: la posicion quedaba recortada o caia
 * sobre una zona vacia y la pantalla se veia en blanco. Aqui se reaplica cuando el listado ya
 * tiene altura.
 *
 * La clave es `location.key`. Los filtros se sincronizan con `replace`, que cambia la clave de
 * la misma entrada; por eso lo guardado se lee una sola vez al montar.
 */
export function useScrollMemory(ready) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [savedOnMount] = useState(() => (navigationType === 'POP' ? readSaved(location.key) : null));
  const restoredRef = useRef(savedOnMount === null);

  useEffect(() => {
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        try {
          window.sessionStorage.setItem(STORAGE_PREFIX + location.key, String(Math.round(window.scrollY)));
        } catch {
          // Sin sessionStorage (modo privado estricto) simplemente no se recuerda el scroll.
        }
      });
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', save);
    };
  }, [location.key]);

  useEffect(() => {
    if (restoredRef.current || !ready) return;
    restoredRef.current = true;
    requestAnimationFrame(() => window.scrollTo({ top: savedOnMount, behavior: 'auto' }));
  }, [ready, savedOnMount]);
}
