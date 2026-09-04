import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Heart, Megaphone, Package, Search, Store, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MarketplaceProductCard from './MarketplaceProductCard';
import MarketplaceSellerCard from './MarketplaceSellerCard';
import AdCard from './ads/AdCard';
import { removeFavoriteApi, resolveMediaUrl } from '../services/api';
import { qk } from '../services/queryKeys';
import { adDetailPath, productPath, ROUTES, storePath } from '../routes/paths';
import { useSavedMarketplaceItems } from '../hooks/useSavedMarketplaceItems';

const TABS = [
  { id: 'all', label: 'Todos', Icon: Heart },
  { id: 'products', label: 'Repuestos', Icon: Package },
  { id: 'ads', label: 'Anuncios', Icon: Megaphone },
  { id: 'stores', label: 'Tiendas', Icon: Store },
];

function EmptySection({ type, onExplore }) {
  const config = {
    products: { Icon: Package, title: 'Aún no guardas repuestos', text: 'Explora el catálogo y toca el corazón de los repuestos que quieras revisar después.', button: 'Explorar repuestos' },
    ads: { Icon: Megaphone, title: 'Aún no guardas anuncios', text: 'Guarda servicios automotrices para volver a contactarlos rápidamente.', button: 'Explorar anuncios' },
    stores: { Icon: Store, title: 'Aún no guardas tiendas', text: 'Sigue tus tiendas preferidas para tener siempre su catálogo a mano.', button: 'Explorar tiendas' },
  }[type];
  return (
    <div className="favorites-empty">
      <span><config.Icon size={27} /></span>
      <h3>{config.title}</h3>
      <p>{config.text}</p>
      <button type="button" onClick={onExplore}>{config.button}</button>
    </div>
  );
}

export default function ProfileFavoritesPanel({ userId, productFavorites = [], isLoading, error }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const { savedAds, savedStores, toggleAd, toggleStore } = useSavedMarketplaceItems(userId);

  const normalizedProducts = useMemo(() => productFavorites.map((favorite) => ({
    ...favorite,
    id: favorite.proveedorProductoId,
    titulo: favorite.nombre,
    imagen: resolveMediaUrl(favorite.imagenUrl),
    favoritoId: favorite.id,
    stock: null,
  })), [productFavorites]);

  const term = query.trim().toLocaleLowerCase('es');
  const products = normalizedProducts.filter((item) => !term || `${item.titulo || ''}`.toLocaleLowerCase('es').includes(term));
  const ads = savedAds.filter((item) => !term || `${item.title || ''} ${item.company || ''} ${item.categoryLabel || ''}`.toLocaleLowerCase('es').includes(term));
  const stores = savedStores.filter((item) => !term || `${item.nombre || item.storeName || ''} ${item.ciudad || ''}`.toLocaleLowerCase('es').includes(term));
  const total = normalizedProducts.length + savedAds.length + savedStores.length;

  const removeProduct = async (product) => {
    if (!userId || !product.favoritoId || removingId) return;
    setRemovingId(product.id);
    try {
      await removeFavoriteApi(userId, product.favoritoId);
      await queryClient.invalidateQueries({ queryKey: qk.favorites(userId) });
    } finally {
      setRemovingId(null);
    }
  };

  const show = (type) => activeTab === 'all' || activeTab === type;
  const sections = [
    { type: 'products', title: 'Repuestos favoritos', subtitle: 'Productos que guardaste para revisar o comprar', count: normalizedProducts.length },
    { type: 'ads', title: 'Anuncios favoritos', subtitle: 'Servicios automotrices que quieres tener a mano', count: savedAds.length },
    { type: 'stores', title: 'Tiendas favoritas', subtitle: 'Vendedores y catálogos que sigues', count: savedStores.length },
  ];

  return (
    <div className="profile-panel favorites-hub">
      <header className="favorites-hero">
        <div>
          <span className="favorites-eyebrow"><Heart size={14} fill="currentColor" /> TU COLECCIÓN</span>
          <h2>Tus favoritos</h2>
          <p>Todo lo que te interesa, organizado y a un clic de distancia.</p>
        </div>
        <div className="favorites-total"><strong>{total}</strong><span>guardados</span></div>
      </header>

      <div className="favorites-toolbar">
        <div className="favorites-tabs" role="tablist" aria-label="Tipos de favoritos">
          {TABS.map(({ id, label, Icon }) => {
            const count = id === 'all' ? total : id === 'products' ? normalizedProducts.length : id === 'ads' ? savedAds.length : savedStores.length;
            return (
              <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)}>
                <Icon size={16} /><span>{label}</span><small>{count}</small>
              </button>
            );
          })}
        </div>
        <label className="favorites-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en favoritos…" /></label>
      </div>

      {error && <p className="favorites-error">No pudimos actualizar tus repuestos favoritos. Intenta recargar la página.</p>}
      {isLoading ? <div className="favorites-loading">Cargando tus favoritos…</div> : (
        <div className="favorites-sections">
          {sections.filter((section) => show(section.type)).map((section) => {
            const visibleCount = section.type === 'products' ? products.length : section.type === 'ads' ? ads.length : stores.length;
            return (
              <section className="favorites-section" key={section.type}>
                <div className="favorites-section-heading">
                  <div><h3>{section.title}</h3><p>{section.subtitle}</p></div>
                  <span>{section.count}</span>
                </div>
                {visibleCount === 0 ? (
                  term ? <div className="favorites-no-results"><Search size={22} /> No encontramos coincidencias en esta sección.</div> : (
                    <EmptySection type={section.type} onExplore={() => navigate(section.type === 'products' ? ROUTES.catalog : section.type === 'ads' ? ROUTES.adsWall : ROUTES.stores)} />
                  )
                ) : section.type === 'products' ? (
                  <div className="favorites-cards-grid favorites-product-grid">
                    {products.map((product) => (
                      <div className="favorites-card-wrap" key={product.id}>
                        <MarketplaceProductCard product={product} isFavorite onView={() => navigate(productPath(product))} onToggleFavorite={() => removeProduct(product)} />
                        {removingId === product.id && <span className="favorites-removing"><Trash2 size={14} /> Quitando…</span>}
                      </div>
                    ))}
                  </div>
                ) : section.type === 'ads' ? (
                  <div className="favorites-cards-grid favorites-ad-grid">
                    {ads.map((ad) => <AdCard key={ad.id} ad={ad} isFavorite onToggleFavorite={toggleAd} onOpenDetail={() => navigate(adDetailPath(ad), { state: { ad } })} />)}
                  </div>
                ) : (
                  <div className="favorites-cards-grid favorites-store-grid">
                    {stores.map((store) => <MarketplaceSellerCard key={store.id} store={store} avatarPhoto={store.logoUrl || store.userProfileUrl || store.imagenUrl} isFavorite onToggleFavorite={toggleStore} onView={() => navigate(storePath(store), { state: { store } })} />)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
