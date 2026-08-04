import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, Truck, ShieldCheck, Package, Bike } from 'lucide-react';
import { getPublicStoresApi, getStoreProductsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MarketplaceSellerCard from './MarketplaceSellerCard';
import { adaptPage, adaptProduct, adaptStore } from '../services/adapters';

export function getShippingIconConfig(method) {
  const norm = String(method || '').toLowerCase().trim();

  // 1. Retiro en tienda
  if (norm.includes('retiro') || norm.includes('tienda')) {
    return {
      name: 'Retiro en tienda',
      icon: Building2,
      label: 'Retiro en tienda',
      color: '#7c3aed',
      bg: '#f3f0ff'
    };
  }

  // 2. Envío dentro de la comuna
  if (norm.includes('dentro') || (norm.includes('comuna') && !norm.includes('fuera'))) {
    return {
      name: 'Envío dentro de la comuna',
      icon: Bike,
      label: 'Envío dentro de la comuna',
      color: '#059669',
      bg: '#eafbf1'
    };
  }

  // 3. Envío fuera de la comuna (Camión)
  if (norm.includes('fuera') || norm.includes('region') || norm.includes('región') || norm.includes('nacional') || norm.includes('starken') || norm.includes('chilexpress')) {
    return {
      name: 'Envío fuera de la comuna',
      icon: Truck,
      label: 'Envío fuera de la comuna',
      color: '#0284c7',
      bg: '#e0f2fe'
    };
  }

  return {
    name: method,
    icon: Package,
    label: method,
    color: '#475569',
    bg: '#f1f5f9'
  };
}

export default function NewOnboardedStoresSection({ onOpenStores, onSelectStore }) {
  const { user } = useAuth();
  const [stores, setStores] = useState([]);
  const [inventoryTotals, setInventoryTotals] = useState({});

  useEffect(() => {
    let isMounted = true;
    getPublicStoresApi({ page: 0, size: 5 })
      .then((data) => {
        if (isMounted) {
          // Sin respaldo de mocks: solo se muestran tiendas reales y públicas.
          setStores(adaptPage(data, adaptStore).items);
        }
      })
      .catch((err) => {
        console.warn('No se pudieron cargar los vendedores recientes:', err);
        if (isMounted) setStores([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleStoreIds = stores.slice(0, 5).map((store) => store.id).filter(Boolean).join(',');

  useEffect(() => {
    const storesToMeasure = stores.slice(0, 5).filter((store) => (
      store.id && !Object.prototype.hasOwnProperty.call(inventoryTotals, store.id)
    ));
    if (!storesToMeasure.length) return undefined;

    let isMounted = true;
    Promise.all(storesToMeasure.map(async (store) => {
      try {
        const response = await getStoreProductsApi(store.id, { page: 0, size: 1 });
        return [store.id, adaptPage(response, adaptProduct).total];
      } catch {
        return null;
      }
    })).then((entries) => {
      if (!isMounted) return;
      const resolvedEntries = entries.filter(Boolean);
      if (resolvedEntries.length) setInventoryTotals((current) => ({ ...current, ...Object.fromEntries(resolvedEntries) }));
    });

    return () => { isMounted = false; };
  }, [visibleStoreIds, inventoryTotals]);

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
          const storeWithInventoryTotal = Object.prototype.hasOwnProperty.call(inventoryTotals, syncedStore.id)
            ? { ...syncedStore, totalPublicaciones: inventoryTotals[syncedStore.id] }
            : syncedStore;
          const avatarPhoto = storeWithInventoryTotal.logoUrl || storeWithInventoryTotal.userProfileUrl || storeWithInventoryTotal.imagenUrl;

          return <MarketplaceSellerCard key={storeWithInventoryTotal.id} store={storeWithInventoryTotal} avatarPhoto={avatarPhoto} onView={onSelectStore} />;
        })}
      </div>
    </section>
  );
}
