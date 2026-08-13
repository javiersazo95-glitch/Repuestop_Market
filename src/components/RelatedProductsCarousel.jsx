import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Layers, Loader2 } from 'lucide-react';
import MarketplaceProductCard from './MarketplaceProductCard';
import { getPartCategoriesApi, getPublicProductsApi } from '../services/api';
import { adaptPage, adaptProduct } from '../services/adapters';
import { qk } from '../services/queryKeys';

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
  const trackRef = useRef(null);
  const [arrows, setArrows] = useState({ previous: false, next: false });

  const { data: { items = [], scope = null } = {}, isLoading: loading } = useQuery({
    queryKey: qk.relatedProducts(product.id),
    queryFn: async ({ signal }) => {
      const excludeCurrent = (list) => list.filter((item) => String(item.id) !== String(product.id));

      if (product.subcategoriaId) {
        const page = await getPublicProductsApi({
          page: 0, size: RELATED_FETCH_SIZE, subcategoriaId: product.subcategoriaId, sort: 'createdAt,desc', signal,
        });
        const found = excludeCurrent(adaptPage(page, adaptProduct).items);
        if (found.length) return { items: found.slice(0, RELATED_MAX_ITEMS), scope: 'subcategoria' };
      }

      const categoriaId = await resolveCategoryId(product);
      if (!categoriaId) return { items: [], scope: null };

      const page = await getPublicProductsApi({
        page: 0, size: RELATED_FETCH_SIZE, categoriaId, sort: 'createdAt,desc', signal,
      });
      const found = excludeCurrent(adaptPage(page, adaptProduct).items);
      return { items: found.slice(0, RELATED_MAX_ITEMS), scope: 'categoria' };
    },
    enabled: Boolean(product?.id),
    staleTime: 5 * 60 * 1000,
  });

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
