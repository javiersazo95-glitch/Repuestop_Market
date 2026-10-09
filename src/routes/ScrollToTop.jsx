import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Cada pagina nueva arranca arriba, salvo cuando el usuario vuelve con el botón atrás (ahí la
 * vista restaura su posición, ver `useScrollMemory`).
 *
 * Solo reacciona al cambio de ruta: si dependiera también del tipo de navegación, los
 * `setSearchParams(..., { replace: true })` con que el catálogo y el directorio sincronizan sus
 * filtros al montar (tipo REPLACE) subían la página justo después de volver.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const navigationTypeRef = useRef(navigationType);
  navigationTypeRef.current = navigationType;

  useEffect(() => {
    if (navigationTypeRef.current === 'POP') return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}
