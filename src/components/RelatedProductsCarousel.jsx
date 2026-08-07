import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers, Loader2 } from 'lucide-react';
import MarketplaceProductCard from './MarketplaceProductCard';
import { getPartCategoriesApi, getPublicProductsApi } from '../services/api';
import { adaptPage, adaptProduct } from '../services/adapters';

const RELATED_FETCH_SIZE = 24;
const RELATED_MAX_ITEMS = 12;

const normalizeName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

/**
 * Resuelve el id de categoría del producto. El endpoint público entrega el nombre
 * de la categoría pero no siempre su id, así que se busca contra el catálogo.
 */
async function resolveCategoryId(product) {
  if (product.categoriaId) return product.categoriaId;
  const name = product.categoriaNombre || product.categoria;
  if (!name) return null;
  const categories = await getPartCategoriesApi();
  return (Array.isArray(categories) ? categories : [])
    .find((category) => normalizeName(category.nombre) === normalizeName(name))?.id ?? null;
}

/**
 * Vitrina de productos relacionados. Prioriza la subcategoría del producto —el
 * criterio más cercano para el comprador— y solo si no hay otros repuestos ahí
 * amplía a la categoría completa.
 */
export default function RelatedProductsCarousel({ product, onSelectProduct }) {
  const [items, setItems] = useState([]);
  const [scope, setScope] = useState(null); // 'subcategoria' | 'categoria'
  const [loading, setLoading] = useState(true);
  const trackRef = useRef(null);
  const [arrows, setArrows] = useState({ previous: false, next: false });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);

    const excludeCurrent = (list) => list.filter((item) => String(item.id) !== String(product.id));

    const load = async () => {
      if (product.subcategoriaId) {
        const page = await getPublicProductsApi({
          page: 0, size: RELATED_FETCH_SIZE, subcategoriaId: product.subcategoriaId, sort: 'createdAt,desc',
        });
        const found = excludeCurrent(adaptPage(page, adaptProduct).items);
        if (found.length) return { found, scope: 'subcategoria' };
      }

      const categoriaId = await resolveCategoryId(product);
      if (!categoriaId) return { found: [], scope: null };

      const page = await getPublicProductsApi({
        page: 0, size: RELATED_FETCH_SIZE, categoriaId, sort: 'createdAt,desc',
      });
      return { found: excludeCurrent(adaptPage(page, adaptProduct).items), scope: 'categoria' };
    };

    load()
      .then(({ found, scope: resolvedScope }) => {
        if (cancelled) return;
        setItems(found.slice(0, RELATED_MAX_ITEMS));
        setScope(resolvedScope);
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [product.id, product.subcategoriaId, product.categoriaId, product.categoriaNombre, product.categoria]);

  const syncArrows = () => {
    const track = trackRef.current;
    if (!track) return;
    setArrows({
      previous: track.scrollLeft > 4,
      next: track.scrollLeft + track.clientWidth < track.scrollWidth - 4,
    });
  };

  useEffect(() => {
    syncArrows();
    const track = trackRef.current;
    if (!track) return undefined;
    const observer = new ResizeObserver(syncArrows);
    observer.observe(track);
    return () => observer.disconnect();
  }, [items]);

  const scrollByCards = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    // Se avanza de a un "página" visible, alineado al ancho de tarjeta + gap.
    const card = track.querySelector('.related-products-item');
    const step = card ? (card.getBoundingClientRect().width + 14) : 240;
    const visible = Math.max(1, Math.floor(track.clientWidth / step));
    track.scrollBy({ left: direction * step * visible, behavior: 'smooth' });
  };

  if (!loading && !items.length) return null;

  return (
    <section className="related-products" aria-label="Productos relacionados">
      <header className="related-products-head">
        <div>
          <h2><Layers /> Productos relacionados</h2>
          <p>
            {scope === 'subcategoria'
              ? `Otros repuestos de ${product.subcategoria}`
              : `Otros repuestos de ${product.categoriaNombre || product.categoria}`}
          </p>
        </div>
        {items.length > 0 && (
          <div className="related-products-arrows">
            <button type="button" onClick={() => scrollByCards(-1)} disabled={!arrows.previous} aria-label="Ver productos anteriores">
              <ChevronLeft />
            </button>
            <button type="button" onClick={() => scrollByCards(1)} disabled={!arrows.next} aria-label="Ver más productos">
              <ChevronRight />
            </button>
          </div>
        )}
      </header>

      {loading ? (
        <div className="related-products-loading">
          <Loader2 className="related-products-spinner" aria-hidden="true" />
          <span>Buscando repuestos relacionados…</span>
        </div>
      ) : (
        <div className="related-products-track" ref={trackRef} onScroll={syncArrows}>
          {items.map((item) => (
            <div className="related-products-item" key={item.id}>
              <MarketplaceProductCard
                product={item}
                onView={() => onSelectProduct?.(item)}
                fallbackCity={item.ciudadVendedor}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
