import React, { useEffect, useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpDown, Bookmark, Car, CheckCircle2, ChevronRight, FileText, Heart, Package, Search,
  ShieldCheck, Star, Store, Trash2, Wrench, X, PackageSearch
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MarketplaceProductCard from './MarketplaceProductCard';
import MarketplaceSellerCard from './MarketplaceSellerCard';
import TallerCard from './talleres/TallerCard';
import { FaultCard } from './faults/FaultsList';
import { getPublicProductApi, removeFavoriteApi, resolveMediaUrl } from '../services/api';
import { getSavedAuctions, setAuctionSaved } from '../services/auctionApi';
import { adaptProduct } from '../services/adapters';
import { qk } from '../services/queryKeys';
import { faultDetailPath, tallerPath, productPath, ROUTES, storePath } from '../routes/paths';
import { useSavedMarketplaceItems } from '../hooks/useSavedMarketplaceItems';
import { useRestoredState } from '../routes/useRestoredState';
import { useScrollMemory } from '../routes/useScrollMemory';

// Destino de "Explorar" en cada sección vacía.
const exploreTarget = (type) => ({ products: ROUTES.catalog, talleres: ROUTES.talleres, faults: ROUTES.faults, auctions: ROUTES.auctions }[type] || ROUTES.stores);

const TABS = [
  { id: 'all', label: 'Todos', Icon: Heart },
  { id: 'products', label: 'Repuestos', Icon: Package },
  { id: 'talleres', label: 'Talleres', Icon: Wrench },
  { id: 'faults', label: 'Fallas', Icon: Car },
  { id: 'auctions', label: 'Búsquedas', Icon: PackageSearch },
  { id: 'stores', label: 'Casas de repuestos', Icon: Store },
];

function EmptySection({ type, onExplore }) {
  const config = {
    products: { Icon: Package, title: 'Aún no guardas repuestos', text: 'Explora el catálogo y toca el corazón de los repuestos que quieras revisar después.', button: 'Explorar repuestos' },
    talleres: { Icon: Wrench, title: 'Aún no guardas talleres', text: 'Guarda talleres para volver a ver sus servicios y reservar rápidamente.', button: 'Explorar talleres' },
    faults: { Icon: Car, title: 'Aún no guardas fallas', text: 'Guarda las fallas automotrices que quieras seguir o diagnosticar más tarde.', button: 'Ver fallas automotrices' },
    auctions: { Icon: PackageSearch, title: 'Aún no guardas búsquedas', text: 'Abre una búsqueda de repuestos y presiona «Guardar» para tenerla aquí.', button: 'Ver búsquedas' },
    stores: { Icon: Store, title: 'Aún no guardas casas de repuestos', text: 'Sigue tus tiendas preferidas para tener siempre su catálogo a mano.', button: 'Explorar casas de repuestos' },
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

/** Busqueda de repuestos guardada: misma fila de las fallas guardadas. */
function SavedAuctionRow({ auction, onOpen, onRemove }) {
  return (
    <div className="fav-m-ad" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="fav-m-thumb is-ad">
        {auction.fotoPrincipalUrl ? <img src={resolveMediaUrl(auction.fotoPrincipalUrl)} alt="" /> : <PackageSearch size={26} />}
      </span>
      <span className="fav-m-copy">
        <em className="fav-m-overline">{auction.estado === 'ACTIVA' ? 'Búsqueda activa' : 'Búsqueda cerrada'}</em>
        <strong>{auction.repuestoSolicitado || 'Búsqueda de repuestos'}</strong>
        <small>{[auction.marca, auction.modelo, auction.anio].filter(Boolean).join(' ') || 'Vehículo no informado'}</small>
      </span>
      <button type="button" className="fav-m-heart" aria-label={`Quitar la búsqueda ${auction.repuestoSolicitado || ''} de guardadas`} onClick={(e) => { e.stopPropagation(); onRemove(); }}>
        <Bookmark size={17} fill="currentColor" />
      </button>
    </div>
  );
}

// Celular: la vista de favoritos de la app (`mobile/app/favorites.tsx`), por pedido del dueño.
const MOBILE_QUERY = '(max-width: 768px)';
function useIsMobile() {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : false
  ));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia(MOBILE_QUERY);
    // `resize` de respaldo: no todos los navegadores avisan el cambio de la media query (al girar
    // el teléfono o achicar la ventana la vista no cambiaba hasta recargar).
    const sync = () => setMatches(media.matches);
    media.addEventListener?.('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      media.removeEventListener?.('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);
  return matches;
}

function formatPrice(value) {
  const amount = Number(value) || 0;
  return amount > 0 ? `$${amount.toLocaleString('es-CL')}` : 'A cotizar';
}

function availabilityLabel(stock) {
  if (stock === null || stock === undefined) return 'Disponibilidad por confirmar';
  if (stock <= 0) return 'Sin stock';
  if (stock <= 5) return `Quedan ${stock}`;
  return `${stock} disponibles`;
}

export default function ProfileFavoritesPanel({ userId, productFavorites = [], isLoading, error }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Pestaña, busqueda y scroll se recuperan al volver de un repuesto, taller o tienda.
  const [activeTab, setActiveTab] = useRestoredState('favoritos', 'activeTab', 'all');
  const [query, setQuery] = useRestoredState('favoritos', 'query', '');
  const [removingId, setRemovingId] = useState(null);
  useScrollMemory(!isLoading);
  const { savedTalleres, savedStores, savedFaults, toggleTaller, toggleStore, toggleFault } = useSavedMarketplaceItems(userId);
  // Las busquedas de repuestos guardadas viven en el backend; el resto, en el dispositivo.
  const [savedAuctions, setSavedAuctions] = useState([]);
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    getSavedAuctions().then((list) => { if (active) setSavedAuctions(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, [userId]);

  // Ficha de cada favorito (tienda, marca, categoría, calidad y stock real), como hace la app. El
  // favorito del backend solo trae nombre, precio e imagen: sin esto todas las tarjetas decían
  // "Tienda RepuesTop". Si una ficha falla, la tarjeta se arma con lo que trae el favorito.
  const detailQueries = useQueries({
    queries: productFavorites.map((favorite) => ({
      queryKey: qk.product(String(favorite.proveedorProductoId)),
      queryFn: async ({ signal }) => adaptProduct(await getPublicProductApi(favorite.proveedorProductoId, { signal })),
      enabled: Boolean(favorite.proveedorProductoId),
      staleTime: 60 * 1000,
      retry: 1,
    })),
  });
  const detailsKey = detailQueries.map((query) => query.dataUpdatedAt).join(',');
  const normalizedProducts = useMemo(() => productFavorites.map((favorite, index) => {
    const detail = detailQueries[index]?.data || null;
    return {
      ...(detail || {}),
      ...favorite,
      id: favorite.proveedorProductoId,
      titulo: detail?.titulo || favorite.nombre,
      imagen: detail?.imagen || resolveMediaUrl(favorite.imagenUrl),
      precio: detail?.precio ?? favorite.precio,
      favoritoId: favorite.id,
      createdAt: favorite.createdAt,
      // Stock comprable: el del backend en el favorito (0 si está pausado o inactivo) y, si no
      // viene, el de la ficha. Antes se fijaba en null y la tarjeta lo leía como "Sin stock".
      stock: favorite.stock ?? detail?.stock ?? null,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [productFavorites, detailsKey]);
  const isMobile = useIsMobile();

  const term = query.trim().toLocaleLowerCase('es');
  const products = normalizedProducts.filter((item) => !term || `${item.titulo || ''}`.toLocaleLowerCase('es').includes(term));
  const talleres = savedTalleres.filter((item) => !term || `${item.name || ''} ${item.commune || ''}`.toLocaleLowerCase('es').includes(term));
  const stores = savedStores.filter((item) => !term || `${item.nombre || item.storeName || ''} ${item.ciudad || ''}`.toLocaleLowerCase('es').includes(term));
  const faults = savedFaults.filter((item) => !term || `${item.titulo || ''} ${item.marca || ''} ${item.modelo || ''} ${item.comuna || ''}`.toLocaleLowerCase('es').includes(term));
  const auctions = savedAuctions.filter((item) => !term || `${item.repuestoSolicitado || ''} ${item.marca || ''} ${item.modelo || ''}`.toLocaleLowerCase('es').includes(term));
  const total = normalizedProducts.length + savedTalleres.length + savedFaults.length + savedStores.length + savedAuctions.length;

  const removeAuction = async (auction) => {
    setSavedAuctions((current) => current.filter((item) => item.id !== auction.id));
    await setAuctionSaved(auction.id, false).catch(() => setSavedAuctions((current) => [...current, auction]));
  };

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

  if (isMobile) {
    return (
      <FavoritesMobile
        products={normalizedProducts}
        talleres={savedTalleres}
        faults={savedFaults}
        stores={savedStores}
        isLoading={isLoading}
        error={error}
        removingId={removingId}
        onRemoveProduct={removeProduct}
        onRemoveTaller={toggleTaller}
        onRemoveFault={toggleFault}
        auctions={savedAuctions}
        onRemoveAuction={removeAuction}
        onOpenAuction={(auction) => navigate(`${ROUTES.auctions}/${auction.id}`)}
        onOpenFault={(fault) => navigate(faultDetailPath(fault), { state: { fromMural: true } })}
        onRemoveStore={toggleStore}
        onOpenProduct={(product) => navigate(productPath(product))}
        onOpenStore={(store) => navigate(storePath(store), { state: { store } })}
        onOpenTaller={(taller) => navigate(tallerPath(taller), { state: { taller } })}
        onExplore={(type) => navigate(exploreTarget(type))}
      />
    );
  }
  const sections = [
    { type: 'products', title: 'Repuestos favoritos', subtitle: 'Productos que guardaste para revisar o comprar', count: normalizedProducts.length },
    { type: 'talleres', title: 'Talleres favoritos', subtitle: 'Talleres que quieres tener a mano', count: savedTalleres.length },
    { type: 'faults', title: 'Fallas guardadas', subtitle: 'Fallas automotrices que quieres seguir', count: savedFaults.length },
    { type: 'auctions', title: 'Búsquedas de repuestos guardadas', subtitle: 'Búsquedas a las que quieres hacer seguimiento', count: savedAuctions.length },
    { type: 'stores', title: 'Casas de repuestos favoritas', subtitle: 'Vendedores y catálogos que sigues', count: savedStores.length },
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
            const count = id === 'all' ? total : id === 'products' ? normalizedProducts.length : id === 'talleres' ? savedTalleres.length : id === 'faults' ? savedFaults.length : id === 'auctions' ? savedAuctions.length : savedStores.length;
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
            const visibleCount = section.type === 'products' ? products.length : section.type === 'talleres' ? talleres.length : section.type === 'faults' ? faults.length : section.type === 'auctions' ? auctions.length : stores.length;
            return (
              <section className="favorites-section" key={section.type}>
                <div className="favorites-section-heading">
                  <div><h3>{section.title}</h3><p>{section.subtitle}</p></div>
                  <span>{section.count}</span>
                </div>
                {visibleCount === 0 ? (
                  term ? <div className="favorites-no-results"><Search size={22} /> No encontramos coincidencias en esta sección.</div> : (
                    <EmptySection type={section.type} onExplore={() => navigate(exploreTarget(section.type))} />
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
                ) : section.type === 'talleres' ? (
                  <div className="favorites-cards-grid favorites-ad-grid">
                    {talleres.map((taller) => <TallerCard key={taller.id} taller={taller} isFavorite onToggleFavorite={toggleTaller} onOpenProfile={() => navigate(tallerPath(taller), { state: { taller } })} />)}
                  </div>
                ) : section.type === 'auctions' ? (
                  <div className="fav-m-list">
                    {auctions.map((auction) => <SavedAuctionRow key={auction.id} auction={auction} onOpen={() => navigate(`${ROUTES.auctions}/${auction.id}`)} onRemove={() => removeAuction(auction)} />)}
                  </div>
                ) : section.type === 'faults' ? (
                  <div className="ft-fault-list">
                    {faults.map((fault) => <FaultCard key={fault.id} fault={fault} fromMural isSaved onToggleSaved={toggleFault} />)}
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

/**
 * Favoritos en celular con el diseño de la app (`mobile/app/favorites.tsx`): pestañas con
 * contador, buscador y filtros de repuestos, tarjetas en lista con la tienda y la disponibilidad,
 * y bloques de talleres, fallas y tiendas con "Ver todos".
 */
function FavoritesMobile({
  products, talleres, faults, stores, auctions, isLoading, error, removingId,
  onRemoveProduct, onRemoveTaller, onRemoveFault, onRemoveStore, onRemoveAuction, onOpenAuction, onOpenProduct, onOpenStore, onOpenTaller, onOpenFault, onExplore,
}) {
  const [tab, setTab] = useRestoredState('favoritos-movil', 'tab', 'all');
  const [query, setQuery] = useRestoredState('favoritos-movil', 'query', '');
  const [onlyAvailable, setOnlyAvailable] = useRestoredState('favoritos-movil', 'onlyAvailable', false);
  const [newestFirst, setNewestFirst] = useRestoredState('favoritos-movil', 'newestFirst', true);

  const term = query.trim().toLocaleLowerCase('es');
  const visibleProducts = products
    .filter((product) => !onlyAvailable || (product.stock ?? 1) > 0)
    .filter((product) => !term || [product.titulo, product.marca, product.categoriaNombre, product.vendedor]
      .some((field) => String(field || '').toLocaleLowerCase('es').includes(term)))
    .sort((a, b) => (newestFirst
      ? String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      : String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es')));
  const hasFilters = Boolean(term) || onlyAvailable;
  const show = (type) => tab === 'all' || tab === type;
  const total = products.length + talleres.length + faults.length + stores.length + auctions.length;

  const tabs = [
    { id: 'all', label: 'Todo', count: total },
    { id: 'products', label: 'Repuestos', count: products.length },
    { id: 'talleres', label: 'Talleres', count: talleres.length },
    { id: 'faults', label: 'Fallas', count: faults.length },
    { id: 'auctions', label: 'Búsquedas', count: auctions.length },
    { id: 'stores', label: 'Tiendas', count: stores.length },
  ];

  return (
    <div className="profile-panel fav-m">
      <header className="fav-m-header">
        <div>
          <h2>Tus favoritos</h2>
          <p>Accede rápido a los repuestos, talleres y tiendas que guardaste.</p>
        </div>
        <span className="fav-m-header-icon"><Heart size={22} fill="currentColor" /></span>
      </header>

      <div className="fav-m-segmented" role="tablist" aria-label="Tipos de favoritos">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'is-active' : ''}
            onClick={() => setTab(item.id)}
          >
            <span>{item.label}</span>
            <small>{item.count}</small>
          </button>
        ))}
      </div>

      {error && <p className="fav-m-error">No pudimos actualizar tus repuestos favoritos. Intenta recargar la página.</p>}

      {show('products') && (
        <section className="fav-m-section">
          {tab === 'all' && <SectionTitle title="Repuestos guardados" count={products.length} />}
          <label className="fav-m-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en tus repuestos guardados" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}
          </label>
          <div className="fav-m-tools">
            <button type="button" className={`fav-m-chip ${onlyAvailable ? 'is-active' : ''}`} aria-pressed={onlyAvailable} onClick={() => setOnlyAvailable((value) => !value)}>
              <CheckCircle2 size={14} /> Solo disponibles
            </button>
            <button type="button" className="fav-m-chip" onClick={() => setNewestFirst((value) => !value)} aria-label={`Orden: ${newestFirst ? 'más recientes' : 'nombre A-Z'}. Toca para cambiar`}>
              <ArrowUpDown size={14} /> {newestFirst ? 'Más recientes' : 'Nombre A-Z'}
            </button>
            <span className="fav-m-count">{visibleProducts.length} {visibleProducts.length === 1 ? 'repuesto' : 'repuestos'}</span>
          </div>

          {isLoading ? (
            <div className="fav-m-list"><div className="fav-m-skeleton" /><div className="fav-m-skeleton" /></div>
          ) : visibleProducts.length ? (
            <div className="fav-m-list">
              {visibleProducts.map((product) => (
                <FavoriteProductCard
                  key={product.id}
                  product={product}
                  removing={removingId === product.id}
                  onOpen={() => onOpenProduct(product)}
                  onOpenStore={product.proveedorId ? () => onOpenStore({ id: product.proveedorId, nombre: product.vendedor }) : undefined}
                  onRemove={() => onRemoveProduct(product)}
                />
              ))}
            </div>
          ) : hasFilters ? (
            <EmptyMobile icon={Search} title="Sin resultados" text="Ningún repuesto guardado coincide con tu búsqueda o filtros." action="Limpiar filtros" onAction={() => { setQuery(''); setOnlyAvailable(false); }} compact />
          ) : (
            <EmptyMobile icon={Heart} title="Aún no tienes repuestos guardados" text="Toca el corazón en cualquier repuesto para encontrarlo rápido aquí." action="Explorar repuestos" onAction={() => onExplore('products')} />
          )}
        </section>
      )}

      {show('talleres') && (
        <section className="fav-m-section">
          <SectionTitle
            title="Talleres guardados"
            count={talleres.length}
            actionLabel={tab === 'all' && talleres.length > 2 ? 'Ver todos' : undefined}
            onAction={() => setTab('talleres')}
          />
          {talleres.length ? (
            <div className="fav-m-list">
              {(tab === 'all' ? talleres.slice(0, 2) : talleres).map((taller) => (
                <div key={taller.id} className="fav-m-ad" role="button" tabIndex={0} onClick={() => onOpenTaller(taller)} onKeyDown={(e) => e.key === 'Enter' && onOpenTaller(taller)}>
                  <span className="fav-m-thumb is-ad">
                    {taller.photos?.[0] ? <img src={taller.photos[0]} alt="" /> : <Wrench size={26} />}
                  </span>
                  <span className="fav-m-copy">
                    {taller.services?.[0]?.name && <em className="fav-m-overline">{taller.services[0].name}</em>}
                    <strong>{taller.name}</strong>
                    <small>{[taller.commune, taller.priceFrom != null ? `desde $${Number(taller.priceFrom).toLocaleString('es-CL')}` : null].filter(Boolean).join(' · ') || 'Taller automotriz'}</small>
                  </span>
                  <button type="button" className="fav-m-heart" aria-label={`Quitar ${taller.name} de favoritos`} onClick={(e) => { e.stopPropagation(); onRemoveTaller(taller); }}>
                    <Heart size={17} fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyMobile icon={Wrench} title="Aún no tienes talleres guardados" text="Toca el corazón en un taller para tenerlo a mano y reservar rápido." action="Ver talleres" onAction={() => onExplore('talleres')} compact />
          )}
        </section>
      )}

      {show('faults') && (
        <section className="fav-m-section">
          <SectionTitle
            title="Fallas guardadas"
            count={faults.length}
            actionLabel={tab === 'all' && faults.length > 2 ? 'Ver todos' : undefined}
            onAction={() => setTab('faults')}
          />
          {faults.length ? (
            <div className="fav-m-list">
              {(tab === 'all' ? faults.slice(0, 2) : faults).map((fault) => (
                <div key={fault.id} className="fav-m-ad" role="button" tabIndex={0} onClick={() => onOpenFault(fault)} onKeyDown={(e) => e.key === 'Enter' && onOpenFault(fault)}>
                  <span className="fav-m-thumb is-ad">
                    {fault.fotoVehiculo ? <img src={resolveMediaUrl(fault.fotoVehiculo)} alt="" /> : <Car size={26} />}
                  </span>
                  <span className="fav-m-copy">
                    {fault.titulo && <em className="fav-m-overline">{fault.titulo}</em>}
                    <strong>{[fault.marca, fault.modelo, fault.anio].filter(Boolean).join(' ') || 'Falla automotriz'}</strong>
                    <small>{[fault.comuna, fault.region].filter(Boolean).join(' · ') || 'Ubicación no informada'}</small>
                  </span>
                  <button type="button" className="fav-m-heart" aria-label={`Quitar la falla ${fault.titulo || ''} de guardados`} onClick={(e) => { e.stopPropagation(); onRemoveFault(fault); }}>
                    <Bookmark size={17} fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyMobile icon={Car} title="Aún no tienes fallas guardadas" text="Guarda una falla desde su detalle para seguirla o diagnosticarla más tarde." action="Ver fallas" onAction={() => onExplore('faults')} compact />
          )}
        </section>
      )}

      {show('auctions') && (
        <section className="fav-m-section">
          <SectionTitle
            title="Búsquedas guardadas"
            count={auctions.length}
            actionLabel={tab === 'all' && auctions.length > 2 ? 'Ver todos' : undefined}
            onAction={() => setTab('auctions')}
          />
          {auctions.length ? (
            <div className="fav-m-list">
              {(tab === 'all' ? auctions.slice(0, 2) : auctions).map((auction) => (
                <SavedAuctionRow key={auction.id} auction={auction} onOpen={() => onOpenAuction(auction)} onRemove={() => onRemoveAuction(auction)} />
              ))}
            </div>
          ) : (
            <EmptyMobile icon={PackageSearch} title="Aún no tienes búsquedas guardadas" text="Abre una búsqueda de repuestos y presiona «Guardar» para tenerla aquí." action="Ver búsquedas" onAction={() => onExplore('auctions')} />
          )}
        </section>
      )}

      {show('stores') && (
        <section className="fav-m-section">
          <SectionTitle
            title="Tiendas favoritas"
            count={stores.length}
            actionLabel={tab === 'all' && stores.length ? 'Ver todas' : undefined}
            onAction={() => setTab('stores')}
          />
          {stores.length ? (
            <div className="fav-m-stores">
              {(tab === 'all' ? stores.slice(0, 3) : stores).map((store) => {
                const logo = resolveMediaUrl(store.logoUrl || store.userProfileUrl || store.imagenUrl);
                const name = store.nombre || store.storeName || 'Tienda';
                return (
                  <div key={store.id} className="fav-m-store" role="button" tabIndex={0} onClick={() => onOpenStore(store)} onKeyDown={(e) => e.key === 'Enter' && onOpenStore(store)}>
                    <span className="fav-m-avatar">{logo ? <img src={logo} alt="" /> : <Store size={18} />}</span>
                    <span className="fav-m-copy">
                      <strong>{name}</strong>
                      <small>{store.ciudad || store.comuna || 'Casa de repuestos'}</small>
                    </span>
                    <button type="button" className="fav-m-heart" aria-label={`Quitar ${name} de favoritos`} onClick={(e) => { e.stopPropagation(); onRemoveStore(store); }}>
                      <Heart size={17} fill="currentColor" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyMobile icon={Store} title="Aún no tienes tiendas guardadas" text="Toca el corazón en una tienda del directorio o en su perfil para guardarla aquí." action="Buscar tiendas" onAction={() => onExplore('stores')} compact />
          )}
        </section>
      )}
    </div>
  );
}

function SectionTitle({ title, count, actionLabel, onAction }) {
  return (
    <div className="fav-m-section-title">
      <h3>{title}</h3>
      <span>{count}</span>
      {actionLabel && <button type="button" onClick={onAction}>{actionLabel} <ChevronRight size={14} /></button>}
    </div>
  );
}

function FavoriteProductCard({ product, removing, onOpen, onOpenStore, onRemove }) {
  const stock = product.stock;
  const tone = stock === null || stock === undefined ? 'unknown' : stock <= 0 ? 'out' : stock <= 5 ? 'low' : 'ok';
  const quality = product.condicion ? product.condicion.charAt(0) + product.condicion.slice(1).toLowerCase() : '';
  const oem = product.referenciaOem;
  const rating = Number(product.rating || 0);
  const storeLogo = product.logoTienda;

  return (
    <article className="fav-m-product">
      <div className="fav-m-product-main" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} aria-label={`Ver ${product.titulo}`}>
        <span className="fav-m-thumb">
          {product.imagen ? <img src={product.imagen} alt="" /> : <Package size={26} />}
        </span>
        <span className="fav-m-copy">
          <strong className="fav-m-title">{product.titulo}</strong>
          <small>{[product.marca, product.categoriaNombre].filter(Boolean).join(' · ')}</small>
          {(quality || oem) && (
            <span className="fav-m-pills">
              {quality && <span className="fav-m-pill"><ShieldCheck size={12} /> {quality}</span>}
              {oem && <span className="fav-m-pill"><FileText size={12} /> OEM {oem}</span>}
            </span>
          )}
          <span className="fav-m-price-row">
            <b className="fav-m-price">{formatPrice(product.precio)}</b>
            {rating > 0 && <small className="fav-m-rating"><Star size={12} fill="currentColor" /> {rating.toFixed(1)}</small>}
          </span>
        </span>
        <button
          type="button"
          className="fav-m-heart"
          disabled={removing}
          aria-label={`Quitar ${product.titulo} de favoritos`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          {removing ? <Trash2 size={16} /> : <Heart size={17} fill="currentColor" />}
        </button>
      </div>
      <div className="fav-m-store-row">
        <span className="fav-m-avatar is-sm">{storeLogo ? <img src={storeLogo} alt="" /> : <Store size={15} />}</span>
        <span className="fav-m-copy">
          <strong>{product.vendedor || 'Tienda asociada'}</strong>
          <small><i className={`fav-m-dot is-${tone}`} /> {availabilityLabel(stock)}{product.ciudadVendedor ? ` · ${product.ciudadVendedor}` : ''}</small>
        </span>
        {onOpenStore && (
          <button type="button" className="fav-m-store-link" onClick={onOpenStore}>Ver tienda <ChevronRight size={14} /></button>
        )}
      </div>
    </article>
  );
}

function EmptyMobile({ icon: Icon, title, text, action, onAction, compact = false }) {
  return (
    <div className={`fav-m-empty ${compact ? 'is-compact' : ''}`}>
      <span><Icon size={24} /></span>
      <strong>{title}</strong>
      <p>{text}</p>
      <button type="button" onClick={onAction}>{action}</button>
    </div>
  );
}
