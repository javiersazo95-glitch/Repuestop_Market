import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import { getPublicStoresApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MarketplaceSellerCard from './MarketplaceSellerCard';
import { adaptPage, adaptStore } from '../services/adapters';
import { resolveShippingService } from '../data/shippingMethods';

// Se mantiene el nombre exportado porque StoresDirectoryView ya lo consume; la
// tabla vive ahora en src/data/shippingMethods.js, compartida con la card del
// vendedor, el perfil de tienda y la ficha del producto.
export const getShippingIconConfig = resolveShippingService;

export default function NewOnboardedStoresSection({ onOpenStores, onSelectStore }) {
  const { user } = useAuth();

  const { data: stores = [] } = useQuery({
    queryKey: qk.stores({ size: 5 }),
    queryFn: ({ signal }) => getPublicStoresApi({ page: 0, size: 5, signal }),
    select: (data) => adaptPage(data, adaptStore).items,
  });

  return (
    <section className="new-stores-section container">
      {/* 1. Section Header */}
      <div className="stores-section-header">
        <div className="header-text-group">
          <div className="badge-verified-stores">
            <ShieldCheck size={14} />
            <span>NUEVOS MIEMBROS</span>
          </div>

          <h2 className="stores-main-title">
            <span>Últimos vendedores agregados</span>
          </h2>

          <p className="stores-description">
            Conoce a los nuevos miembros que se han unido a nuestra red.
          </p>
        </div>

        <div className="stores-header-actions-group">
          {onOpenStores && (
            <button className="btn-view-directory-blue" onClick={onOpenStores}>
              <span>Ver todos los vendedores</span><ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Sellers Grid */}
      <div className="stores-cards-grid">
        {stores.slice(0, 5).map((store) => {
          const isCurrentUserStore =
            user &&
            (store.id === user.sellerId ||
             store.id === user.userId ||
             store.id === 'store-tiensoft' ||
             (user.storeName && store.nombre.toLowerCase().includes(user.storeName.toLowerCase())) ||
             (user.userName && store.nombre.toLowerCase().includes(user.userName.toLowerCase())));

          const syncedStore = isCurrentUserStore
            ? {
                ...store,
                logoUrl: user.userProfileUrl || user.logoUrl || store.logoUrl,
                userProfileUrl: user.userProfileUrl || store.userProfileUrl,
                coverUrl: user.coverUrl || store.coverUrl,
              }
            : store;
          const avatarPhoto = syncedStore.logoUrl || syncedStore.userProfileUrl || syncedStore.imagenUrl;

          return <MarketplaceSellerCard key={syncedStore.id} store={syncedStore} avatarPhoto={avatarPhoto} onView={onSelectStore} />;
        })}
      </div>
    </section>
  );
}
