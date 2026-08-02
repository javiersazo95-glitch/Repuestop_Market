import React from 'react';
import { Database, Truck, Building2, Layers, ArrowRight } from 'lucide-react';

const CARDS = [
  {
    key: 'frenos',
    image: '/cat_frenos.jpg',
    badgeIcon: Database,
    badgeLabel: 'INVENTARIO EN VIVO',
    title: 'Kits de Freno',
    highlight: '45.000+ En Stock',
    actionLabel: 'Consultar stock'
  },
  {
    key: 'despacho',
    image: '/promo_despacho.jpg',
    badgeIcon: Truck,
    badgeLabel: 'BODEGAS REGIONALES',
    title: 'Despacho 24h',
    subtitle: 'Envío gratis sobre $39.990 directo de bodega',
    actionLabel: 'Ver bodegas'
  },
  {
    key: 'distribuidores',
    image: '/promo_distribuidores.jpg',
    badgeIcon: Building2,
    badgeLabel: 'TIENDAS VERIFICADAS',
    title: 'Distribuidores OEM',
    subtitle: 'Catálogo directo de marca',
    brands: ['BOSCH', 'MANN', 'NGK', 'BREMBO'],
    actionLabel: 'Ver catálogo'
  },
  {
    key: 'desarme',
    image: '/promo_desarme.jpg',
    badgeIcon: Layers,
    badgeLabel: 'STOCK DESARME',
    title: 'Desarmadurías',
    subtitle: 'Piezas originales probadas con garantía',
    actionLabel: 'Buscar repuesto'
  }
];

export default function PromoGridBanners({ onScrollToCatalog }) {
  return (
    <div className="container promo-banners-container" style={{ marginTop: '10px' }}>
      <div className="promo-grid-4">
        {CARDS.map(card => {
          const BadgeIcon = card.badgeIcon;
          return (
            <div key={card.key} className="promo-card" onClick={onScrollToCatalog}>
              <img src={card.image} alt="" className="promo-card-bg-img" loading="lazy" />
              <div className="promo-card-overlay"></div>

              <div className="promo-card-content">
                <div className="promo-badge-tag">
                  <BadgeIcon size={14} /> {card.badgeLabel}
                </div>

                <h3 className="promo-bold-heading light">
                  {card.title}
                  {card.highlight && <><br /><span className="promo-highlight">{card.highlight}</span></>}
                </h3>

                {card.subtitle && <p className="promo-sub-heading light">{card.subtitle}</p>}

                {card.brands && (
                  <div className="brand-logos-row">
                    {card.brands.map(b => <span key={b}>{b}</span>)}
                  </div>
                )}

                <button className="promo-action-btn-white">
                  <span>{card.actionLabel}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
