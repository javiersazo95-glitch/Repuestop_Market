import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES, catalogPath, helpCategoryPath, helpContactPath, productPath, profilePath, storePath } from './paths';

/**
 * Navegación de alto nivel del marketplace. Los componentes de vista siguen
 * recibiendo callbacks (`onOpenCatalog`, `onSelectStore`, ...) pero ahora esos
 * callbacks cambian la URL en lugar de un estado local de App.
 */
export function useAppNavigation() {
  const navigate = useNavigate();

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
    goAdsWall: () => navigate(ROUTES.adsWall),
    goSupport: () => navigate(ROUTES.support),
    goSellerRegister: () => navigate(ROUTES.sellerRegister),
    // El centro de ayuda es una vista propia: misma URL para invitados y para
    // usuarios con sesión, porque se enlaza desde muchos puntos de la web.
    goHelp: () => navigate(ROUTES.support),
    goHelpCategory: (slug) => navigate(helpCategoryPath(slug)),
    goHelpContact: (topicId) => navigate(helpContactPath(topicId)),
    goTerms: () => navigate(ROUTES.terms),
    goPrivacy: () => navigate(ROUTES.privacy),
  }), [navigate, goProduct, goStore, goProfile]);
}

