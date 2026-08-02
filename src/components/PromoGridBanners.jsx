import React from 'react';
import { Database, Truck, Building2, Layers, ArrowRight } from 'lucide-react';

export default function PromoGridBanners({ onScrollToCatalog }) {
  return (
    <div className="container promo-banners-container" style={{ marginTop: '10px' }}>
      <div className="promo-grid-4">
        {/* Card 1: Inventarios de Frenos & Pastillas */}
        <div className="promo-card red-card" onClick={onScrollToCatalog}>
          <div className="promo-card-content">
            <div className="promo-badge-tag"><Database size={14} /> INVENTARIO EN VIVO ⚡</div>
            <h3 className="promo-discount-title">Kits de Freno <br /><span>45.000+ En Stock</span></h3>
            <button className="promo-action-btn-white">
              <span>Consultar stock</span>
              <ArrowRight size={14} />
            </button>
          </div>
          <img 
            src="/repuestos_warehouse_bg.jpg" 
            alt="Inventario de Frenos" 
            className="promo-bg-img"
          />
        </div>

        {/* Card 2: Despacho Directo de Bodegas */}
        <div className="promo-card yellow-card" onClick={onScrollToCatalog}>
          <div className="promo-card-content">
            <div className="promo-badge-tag dark"><Truck size={14} /> BODEGAS REGIONALES</div>
            <h3 className="promo-bold-heading">Despacho 24h</h3>
            <p className="promo-sub-heading">Envío gratis sobre <strong>$39.990</strong> directo de bodega</p>
            <button className="promo-action-btn-dark">
              <span>Ver bodegas</span>
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="truck-graphic-wrap">
            <Truck size={64} className="truck-icon-svg" />
          </div>
        </div>

        {/* Card 3: Distribuidores Directos OEM */}
        <div className="promo-card navy-card" onClick={onScrollToCatalog}>
          <div className="promo-card-content">
            <div className="promo-badge-tag blue"><Building2 size={14} /> TIENDAS VERIFICADAS</div>
            <h3 className="promo-bold-heading light">Distribuidores OEM</h3>
            <p className="promo-sub-heading light">Catálogo directo de marca</p>
            
            <div className="brand-logos-row">
              <span>BOSCH</span>
              <span>MANN</span>
              <span>NGK</span>
              <span>BREMBO</span>
            </div>

            <button className="promo-action-btn-white">
              <span>Ver catálogo</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Card 4: Desarmadurías & Piezas de Desarme */}
        <div className="promo-card blue-card" onClick={onScrollToCatalog}>
          <div className="promo-card-content">
            <div className="promo-badge-tag cyan"><Layers size={14} /> STOCK DESARME</div>
            <h3 className="promo-bold-heading light">Desarmadurías</h3>
            <p className="promo-sub-heading light">Piezas originales probadas con garantía</p>
            <button className="promo-action-btn-white">
              <span>Buscar repuesto</span>
              <ArrowRight size={14} />
            </button>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=300&q=80" 
            alt="Stock Desarmadurías" 
            className="promo-bg-img"
          />
        </div>
      </div>
    </div>
  );
}
