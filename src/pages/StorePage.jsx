import React, { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import StorePublicProfileView from '../components/StorePublicProfileView';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { parseIdSlug } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';

const SELLER_ROLES = ['SELLER', 'PROVIDER', 'PROVEEDOR'];

export default function StorePage() {
  const { storeId: storeParam } = useParams();
  const location = useLocation();
  const nav = useAppNavigation();
  const { user, role } = useAuth();
  const { activeVehicle, openQuote } = useMarketplace();

  const storeId = parseIdSlug(storeParam);
  // La vista completa la ficha con GET /tiendas/{id}; desde el directorio llega
  // además la versión resumida para pintar la cabecera sin esperar la petición.
  const preloaded = location.state?.store;
  const store = useMemo(() => (
    preloaded && String(preloaded.id) === String(storeId) ? preloaded : { id: storeId }
  ), [preloaded, storeId]);

  useDocumentTitle(preloaded?.nombre || 'Tienda');

  const ownsStore = SELLER_ROLES.includes(role) && (
    String(user?.sellerId || '') === String(storeId)
    || (!!user?.storeName && user.storeName === preloaded?.nombre)
  );

  return (
    <StorePublicProfileView
      store={store}
      onBackToStores={nav.goStores}
      onQuickView={nav.goProduct}
      onOpenQuote={openQuote}
      activeVehicle={activeVehicle}
      onEditStore={ownsStore ? () => nav.goProfile('tienda_datos') : null}
    />
  );
}
