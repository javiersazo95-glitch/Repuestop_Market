import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck, Heart, Inbox, Loader2, Package, ShoppingCart, Star, Tag, Truck } from 'lucide-react';
import { getPartImage, useCategories } from '../../data/categories';
import { getPublicProductsApi } from '../../services/api';
import { qk } from '../../services/queryKeys';
import { adaptPage, adaptLatestPart, compatibilidadLinea } from '../../services/adapters';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../hooks/useFavorites';

const FEATURED_COUNT = 4;
const FETCH_COUNT = 12;
const nf = new Intl.NumberFormat('es-CL');

/** Etiqueta de la esquina: el descuento si lo hay; si no, lo mas vendido, lo nuevo o simplemente destacado. */
function badgeOf(product) {
  const discount = Math.round(Number(product.descuento || 0));
  if (discount > 0) return { label: `-${discount}%`, kind: 'discount' };
  if (Number(product.ventas || 0) > 0) return { label: 'Más vendido', kind: 'best' };
  if (String(product.condicion || '').toLowerCase().includes('nuevo')) return { label: 'Nuevo', kind: 'new' };
  return { label: 'Destacado', kind: 'offer' };
}

/** Foto del repuesto; si no carga prueba la referencial de la pieza y, al final, un icono neutro. */
function PartPhoto({ src, fallback }) {
  const [current, setCurrent] = React.useState(src);
  React.useEffect(() => { setCurrent(src); }, [src]);
  if (!current) return <Package size={40} className="hb-part-noimg" aria-hidden="true" />;
  return (
    <img
      src={current}
      alt=""
      loading="lazy"
      onError={() => setCurrent(current !== fallback && fallback ? fallback : null)}
    />
  );
}

function FeaturedCard({ product, onView, isFavorite, onToggleFavorite }) {
  const { CATEGORY_IMAGE_BY_ID } = useCategories();
  const category = product.categoria || 'motor';
  const price = Number(product.precio || 0);
  const oldPrice = Number(product.precioOriginal || 0);
  const discount = Math.round(Number(product.descuento || 0));
  const badge = badgeOf(product);
  const rating = Number(product.rating || product.calificacion || 0);
  const sales = typeof product.ventas === 'number' && product.ventas > 0 ? product.ventas : null;
  const storeName = product.vendedor || product.tienda || 'Tienda RepuesTop';
  const storeLogo = product.logoTienda || product.storeIconUrl || product.tiendaLogo || null;
  const referenceImage = getPartImage(product.titulo, product.subcategoria, product.categoriaNombre) || CATEGORY_IMAGE_BY_ID[category];
  const image = product.imagen || product.imagenes?.[0] || product.imageUrls?.[0] || referenceImage;
  const compat = compatibilidadLinea(product.compatibilidad);

  return (
    <article className="hb-part">
      <div className="hb-part-media" onClick={() => onView?.(product)}>
        <span className={`hb-part-badge is-${badge.kind}`}>{badge.label}</span>
        <button
          type="button"
          className={`hb-part-fav ${isFavorite ? 'is-active' : ''}`}
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          onClick={(event) => { event.stopPropagation(); onToggleFavorite?.(product); }}
        >
          <Heart size={20} fill={isFavorite ? '#ef4444' : 'none'} color={isFavorite ? '#ef4444' : 'currentColor'} />
        </button>
        <PartPhoto src={image} fallback={referenceImage} />
      </div>
      <div className="hb-part-body">
        <h3 onClick={() => onView?.(product)}>{product.titulo}</h3>
        <p className="hb-part-sub">{compat || product.categoriaNombre || 'Compatibilidad multimarca'}</p>
        <div className="hb-part-store">
          {storeLogo ? <img src={storeLogo} alt="" /> : <span className="hb-part-store-dot" aria-hidden="true"><Tag size={11} /></span>}
          <strong>{storeName}</strong>
          {product.verificado !== false && <BadgeCheck size={15} aria-label="Tienda verificada" />}
        </div>
        {(rating > 0 || sales != null) && (
          <div className="hb-part-rating">
            {rating > 0 && <><Star size={13} fill="currentColor" aria-hidden="true" /> <b>{rating.toFixed(1)}</b></>}
            {sales != null && <span>({nf.format(sales)} {sales === 1 ? 'venta' : 'ventas'})</span>}
          </div>
        )}
        <div className="hb-part-ship"><Truck size={14} aria-hidden="true" /> Envío a todo Chile</div>
        <div className="hb-part-price">
          <strong>{product.soloCotizacion || !price ? 'A cotizar' : `$${nf.format(price)} CLP`}</strong>
          {oldPrice > price && price > 0 && (
            <>
              <del>${nf.format(oldPrice)} CLP</del>
              {discount > 0 && <span>-{discount}%</span>}
            </>
          )}
        </div>
        <button type="button" className="hb-part-buy" onClick={() => onView?.(product)}>
          <ShoppingCart size={16} aria-hidden="true" /> Comprar ahora
        </button>
      </div>
    </article>
  );
}

/** Inicio · "Aprovecha las mejores ofertas en repuestos": 4 repuestos con descuento primero, luego los mas vendidos. */
export default function HomeFeaturedParts({ onQuickView, onOpenCatalog }) {
  const { user, isLoggedIn } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites(user?.userId ?? user?.id);

  const { data: parts = [], isLoading, error } = useQuery({
    queryKey: qk.products({ featured: FETCH_COUNT }),
    queryFn: async () => adaptPage(
      await getPublicProductsApi({ page: 0, size: FETCH_COUNT, sort: 'createdAt,desc' }),
      adaptLatestPart,
    ).items,
    staleTime: 60 * 1000,
  });
  const featured = React.useMemo(() => [...parts]
    .sort((a, b) => (Number(b.descuento || 0) > 0) - (Number(a.descuento || 0) > 0)
      || Number(b.descuento || 0) - Number(a.descuento || 0)
      || Number(b.ventas || 0) - Number(a.ventas || 0))
    .slice(0, FEATURED_COUNT), [parts]);

  return (
    <section className="hb-offers container" aria-labelledby="home-offers-title">
      <div className="hb-offers-head">
        <div>
          <span className="hb-offers-badge"><Tag size={13} aria-hidden="true" /> Ofertas destacadas</span>
          <h2 id="home-offers-title">Aprovecha las <em>mejores ofertas</em> en repuestos</h2>
          <p>Precios competitivos, envíos a todo Chile y vendedores verificados.</p>
        </div>
        {onOpenCatalog && (
          <button type="button" className="hb-btn hb-btn-outline" onClick={onOpenCatalog}>
            Ver todas las ofertas <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {isLoading && <div className="hb-offers-state"><Loader2 size={22} className="spin-icon" /> Cargando repuestos…</div>}
      {!isLoading && (error || featured.length === 0) && (
        <div className="hb-offers-state"><Inbox size={22} /> {error ? 'No se pudieron cargar los repuestos.' : 'Aún no hay repuestos publicados en el sistema.'}</div>
      )}

      <div className="hb-offers-grid">
        {featured.map((part) => (
          <FeaturedCard
            key={part.id}
            product={part}
            onView={onQuickView}
            isFavorite={isFavorite(part.id)}
            onToggleFavorite={isLoggedIn ? toggleFavorite : undefined}
          />
        ))}
      </div>
    </section>
  );
}
