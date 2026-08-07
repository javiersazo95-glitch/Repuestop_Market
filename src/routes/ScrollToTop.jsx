import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Cada cambio de ruta arranca arriba, salvo cuando el usuario vuelve con el botón
 * atrás (ahí el navegador restaura su propia posición) o cuando solo cambian los
 * filtros del catálogo en el query string.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, navigationType]);

  return null;
}
