import React from 'react';
import { Store, ShieldCheck, TrendingUp, Users, ArrowRight, Zap, Award } from 'lucide-react';

export default function SellerBanner({ onOpenSellerModal }) {
  return (
    <section className="seller-banner-section container">
      <div className="seller-banner-card">
        <div className="banner-decor-glow"></div>
        <div className="banner-content">
          <div className="banner-pill">
            <Store size={14} /> EXPANDE TU NEGOCIO AUTOMOTRIZ
          </div>
          <h2 className="banner-title">
            ¿Tienes una tienda de repuestos, importadora o desarmaduría?
          </h2>
          <p className="banner-description">
            Únete al marketplace de repuestos más rápido de la región. Sube tus repuestos con compatibilidad por patente y recibe pedidos directos de clientes y mecánicos verificados.
          </p>

          <div className="banner-features-grid">
            <div className="feature-item">
              <div className="feature-icon"><TrendingUp size={20} /></div>
              <div>
                <strong>Aumenta tus Ventas un 40%</strong>
                <p>Al conectar por patente, tus productos no tienen margen de devolución.</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><ShieldCheck size={20} /></div>
              <div>
                <strong>Pagos Garantizados Semanales</strong>
                <p>Transferencias directas a tu cuenta bancaria sin trabas.</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><Zap size={20} /></div>
              <div>
                <strong>Integración de Inventario Directa</strong>
                <p>Sube masivamente mediante Excel o código OEM.</p>
              </div>
            </div>
          </div>

          <div className="banner-cta-row">
            <button className="banner-register-btn" onClick={onOpenSellerModal}>
              <Store size={18} />
              <span>Registrar Mi Tienda Gratis</span>
              <ArrowRight size={18} />
            </button>
            <span className="banner-disclaimer">
              ✓ Sin costos de incorporación • Cancelación en cualquier momento
            </span>
          </div>
        </div>

        <div className="banner-illustration">
          <div className="illustration-card">
            <div className="illu-header">
              <Award size={20} className="award-icon" />
              <span>Vendedor Verificado Repuestop</span>
            </div>
            <div className="illu-store-preview">
              <div className="store-avatar">🚘</div>
              <div className="store-meta">
                <strong>Autopartes Express Chile</strong>
                <span>+15.400 repuestos despachados</span>
                <div className="store-rating">★★★★★ (4.9 / 5.0)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
