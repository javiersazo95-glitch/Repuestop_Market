import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES, adDetailPath, catalogPath, checkoutPath, helpCategoryPath, helpContactPath, productPath, profilePath, storePath } from './paths';

/**
 * Navegación de alto nivel del marketplace. Los componentes de vista siguen
 * recibiendo callbacks (`onOpenCatalog`, `onSelectStore`, ...) pero ahora esos
 * callbacks cambian la URL en lugar de un estado local de App.
 */
export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const canGoBack = Boolean(location.key && location.key !== 'default');

  /**
   * Vuelve exactamente a la pantalla anterior (con sus filtros, su pagina y su scroll), y al
   * destino de respaldo -o al inicio- cuando no hay ninguna.
   *
   * `location.key` vale 'default' solo en la primera entrada del historial de la app: es el
   * caso de quien llega por un enlace directo o desde Google. Ahi `navigate(-1)` sacaria al
   * usuario del sitio -o no haria nada-, asi que se manda al respaldo.
   *
   * El respaldo solo se toma si es una ruta: usado como `onClick={goBack}` llega el evento.
   */
  const goBack = useCallback((fallback) => {
    if (canGoBack) navigate(-1);
    else navigate(typeof fallback === 'string' ? fallback : ROUTES.home);
  }, [navigate, canGoBack]);

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

  const goAdDetail = useCallback((ad) => {
    // El anuncio viaja en el state para pintar la ficha al instante; por URL
    // directa la página lo recupera del backend por id.
    navigate(adDetailPath(ad), { state: { ad } });
  }, [navigate]);

  return useMemo(() => ({
    goHome: () => navigate(ROUTES.home),
    goBack,
    canGoBack,
    goCatalog: (filter = null, extra = {}) => navigate(catalogPath(filter, extra)),
    goProduct,
    goStores: () => navigate(ROUTES.stores),
    goStore,
    goProfile,
    goCart: () => navigate(ROUTES.cart),
    goCheckout: (options = {}) => navigate(checkoutPath(options)),
    goAbout: () => navigate(ROUTES.about),
    goAdsWall: () => navigate(ROUTES.adsWall),
    goAdDetail,
    goSupport: () => navigate(ROUTES.support),
    goSellerRegister: () => navigate(ROUTES.sellerRegister),
    // El centro de ayuda es una vista propia: misma URL para invitados y para
    // usuarios con sesión, porque se enlaza desde muchos puntos de la web.
    goHelp: () => navigate(ROUTES.support),
    goHelpCategory: (slug) => navigate(helpCategoryPath(slug)),
    goHelpContact: (topicId) => navigate(helpContactPath(topicId)),
    goTerms: () => navigate(ROUTES.terms),
    goPrivacy: () => navigate(ROUTES.privacy),
  }), [navigate, goProduct, goStore, goProfile, goAdDetail, goBack, canGoBack]);
}

