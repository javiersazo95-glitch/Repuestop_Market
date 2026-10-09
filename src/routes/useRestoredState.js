import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_PREFIX = 'view:';

function readView(viewId) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_PREFIX + viewId));
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

/**
 * `useState` que sobrevive a ir y volver: al regresar con "atras" (POP) la vista recupera los
 * filtros, la pagina o el "cargar mas" que tenia, en vez de partir de cero. Una visita nueva
 * (link, menu) arranca con el valor inicial.
 *
 * Existe porque listas como el mural o el directorio guardaban todo en estado del componente:
 * al abrir un anuncio o una tienda la lista se desmontaba y, al volver, la persona perdia donde
 * estaba. Junto con `useScrollMemory` la deja exactamente en el mismo punto.
 *
 * Solo para valores serializables en JSON. Se guarda en sessionStorage (por pestaña). Con
 * `viewId` vacio se comporta como un `useState` comun.
 */
export function useRestoredState(viewId, field, initial) {
  const navigationType = useNavigationType();
  const location = useLocation();
  const [value, setValue] = useState(() => {
    // `default` es la primera entrada de la pestaña: ahi no hay a que "volver".
    if (viewId && navigationType === 'POP' && location.key !== 'default') {
      const saved = readView(viewId);
      if (Object.prototype.hasOwnProperty.call(saved, field)) return saved[field];
    }
    return typeof initial === 'function' ? initial() : initial;
  });

  useEffect(() => {
    if (!viewId) return;
    try {
      const saved = readView(viewId);
      saved[field] = value;
      window.sessionStorage.setItem(STORAGE_PREFIX + viewId, JSON.stringify(saved));
    } catch {
      // Sin sessionStorage (modo privado estricto) la vista simplemente no se recuerda.
    }
  }, [viewId, field, value]);

  return [value, setValue];
}

/**
 * `useEffect` que no corre en el montaje. Para los "volver a la pagina 1 si cambia un filtro":
 * en el montaje no cambio nada y, si corriera, pisaria la pagina recuperada con
 * `useRestoredState`.
 */
export function useEffectAfterMount(effect, deps) {
  // Se comparan las dependencias en vez de usar un flag de "ya monto": en StrictMode el efecto
  // corre dos veces al montar y el flag dejaba pasar la segunda.
  const prevDepsRef = useRef(deps);
  useEffect(() => {
    const prev = prevDepsRef.current;
    prevDepsRef.current = deps;
    const changed = prev.length !== deps.length || deps.some((dep, i) => !Object.is(dep, prev[i]));
    if (!changed) return undefined;
    return effect();
    // Las dependencias las define quien llama, igual que en useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
