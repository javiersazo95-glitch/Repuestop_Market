import React from 'react';
import { Store, ShieldCheck, MapPin, CheckCircle2, Layers, Star, ArrowRight } from 'lucide-react';
import { NEW_ONBOARDED_STORES } from '../data/liveMarketplaceData';

export default function NewOnboardedStoresSection({ onOpenSellerModal }) {
  return (
    <section className="new-stores-section container">
      <div className="section-title-header-flex">
        <div className="title-left-group">
          <div className="title-badge-blue">
            <Store size={14} /> TIENDAS Y DESARMADURÍAS VERIFICADAS
          </div>
          <h2>🏢 Últimos Vendedores e Importadores Ingresados</h2>
          <p>Conoce las tiendas recién integradas a RepuesTop.cl. Verificamos su RUT, documentación comercial y local físico antes de activar su catálogo.</p>
        </div>

        <button className="btn-register-my-store-header" onClick={onOpenSellerModal}>
          <span>¿Tienes Tienda? Conectar Mi Inventario →</span>
        </button>
      </div>

      <div className="new-stores-grid-3">
        {NEW_ONBOARDED_STORES.map(store => (
          <div key={store.id} className="new-store-card">
            <div className="store-img-header-wrap">
              <img src={store.imagenStore} alt={store.nombre} className="store-banner-img" />
              <div className="store-img-overlay"></div>

              <span className="store-onboard-tag">
                <CheckCircle2 size={12} /> {store.verificadoFecha}
              </span>
            </div>

            <div className="store-body-content">
              <div className="store-title-row">
                <h3>{store.nombre}</h3>
                <span className="store-rut-badge">RUT {store.rut}</span>
              </div>

              <div className="store-meta-line">
                <span className="store-type-pill">{store.tipo}</span>
                <span className="store-location"><MapPin size={12} /> {store.ciudad}</span>
              </div>

              <p className="store-specialty">
                Especialidad: <strong>{store.especialidad}</strong>
              </p>

              <div className="store-stats-footer">
                <div className="stat-item">
                  <Layers size={14} className="icon-blue" />
                  <span><strong>+{store.totalPublicaciones.toLocaleString('es-CL')}</strong> Repuestos en Stock</span>
                </div>

                <div className="stat-item">
                  <Star size={14} className="icon-star" fill="#f59e0b" />
                  <span><strong>{store.rating} / 5.0</strong> Calificación</span>
                </div>
              </div>

              <button className="btn-view-store-catalog">
                <span>Ver catálogo de tienda</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
