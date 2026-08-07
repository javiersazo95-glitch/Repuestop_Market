import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES, catalogPath, productPath, profilePath, storePath } from './paths';

/**
 * Navegación de alto nivel del marketplace. Los componentes de vista siguen
 * recibiendo callbacks (`onOpenCatalog`, `onSelectStore`, ...) pero ahora esos
 * callbacks cambian la URL en lugar de un estado local de App.
 */
export function useAppNavigation() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const goProfile = useCallback((tab = 'resumen') => {
    navigate(profilePath(typeof tab === 'string' ? tab : 'resumen'));
  }, [navigate]);

  const goProduct = useCallback((product) => {
    // El producto viaja en el state para pintar la ficha al instante; si el usuario
    // entra por URL directa, la página lo recupera del backend por id.
    navigate(productPath(product), { state: { product } });
  }, [navigate]);

  const goStore = useCallback((store) => {
    navigate(storePath(store), { state: { store } });
  }, [navigate]);

  return useMemo(() => ({
    goHome: () => navigate(ROUTES.home),
    goCatalog: (filter = null, extra = {}) => navigate(catalogPath(filter, extra)),
    goProduct,
    goStores: () => navigate(ROUTES.stores),
    goStore,
    goProfile,
    goAbout: () => navigate(ROUTES.about),
    goSupport: () => navigate(ROUTES.support),
    goSellerRegister: () => navigate(ROUTES.sellerRegister),
    // El centro de ayuda del usuario autenticado vive dentro de su panel.
    goHelp: () => (isLoggedIn ? goProfile('soporte') : navigate(ROUTES.support)),
  }), [navigate, isLoggedIn, goProduct, goStore, goProfile]);
}
