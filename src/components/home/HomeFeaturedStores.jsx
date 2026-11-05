import React from 'react';
import { ArrowRight, BadgeCheck, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../../services/queryKeys';
import { getPublicStoresApi } from '../../services/api';
import { adaptPage, adaptStore } from '../../services/adapters';

const nf = new Intl.NumberFormat('es-CL');

/** Inicio · "Compra en tiendas destacadas": las casas de repuestos mejor evaluadas. */
export default function HomeFeaturedStores({ onOpenStores, onSelectStore }) {
  const { data: stores = [] } = useQuery({
    queryKey: qk.stores({ size: 5 }),
    queryFn: ({ signal }) => getPublicStoresApi({ page: 0, size: 5, signal }),
    select: (data) => adaptPage(data, adaptStore).items,
  });
  const shown = [...stores].sort((a, b) => (b.rating - a.rating) || (b.reviewCount - a.reviewCount)).slice(0, 4);

  return (
    <section className="hb-stores container" aria-labelledby="home-stores-title">
      <div className="hb-stores-head">
        <div>
          <h2 id="home-stores-title">Compra en tiendas destacadas</h2>
          <p>Tiendas verificadas, con excelente reputación y miles de ventas.</p>
        </div>
        {onOpenStores && (
          <button type="button" className="hb-btn hb-btn-outline" onClick={onOpenStores}>
            Ver todas las tiendas <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="hb-stores-grid">
        {shown.map((store) => {
          const photo = store.logoUrl || store.userProfileUrl || store.imagenUrl;
          return (
            <article key={store.id} className="hb-store-card">
              <span className="hb-store-avatar" style={!photo ? { background: `linear-gradient(145deg, ${store.bgColor || '#1268f3'}, #071934)` } : undefined}>
                {photo ? <img src={photo} alt="" loading="lazy" /> : <b>{store.initials}</b>}
              </span>
              <span className="hb-store-info">
                <strong>{store.nombre}{store.verificada && <BadgeCheck size={16} aria-label="Tienda verificada" />}</strong>
                {store.reviewCount > 0
                  ? <span className="hb-store-rating"><Star size={13} fill="currentColor" aria-hidden="true" /> {store.rating.toFixed(1)} <em>({nf.format(store.reviewCount)})</em></span>
                  : <span className="hb-store-rating is-new">Nueva tienda</span>}
                <button type="button" className="hb-btn hb-btn-outline hb-btn-sm" onClick={() => onSelectStore(store)} aria-label={`Ver tienda ${store.nombre}`}>
                  Ver tienda <ArrowRight size={14} aria-hidden="true" />
                </button>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
