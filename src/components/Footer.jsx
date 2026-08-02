import React from 'react';
import { 
  ShieldCheck, Truck, Lock, FileText, Phone, Mail, MapPin, 
  Clock, Store, ArrowRight, CheckCircle2, ChevronRight, Sparkles 
} from 'lucide-react';
import RepuesTopLogo from './RepuesTopLogo';

export default function Footer({ onOpenSellerModal }) {
  return (
    <footer className="modern-footer-section">
      {/* 1. Top High-Trust Perks & Security Bar with Exact Logo Colors */}
      <div className="container footer-perks-wrapper">
        <div className="modern-perks-grid">
          <div className="modern-perk-card perk-blue">
            <div className="perk-icon-circle icon-blue">
              <Lock size={22} />
            </div>
            <div className="perk-info-group">
              <h4>Compra 100% Protegida</h4>
              <p>Fondos en custodia hasta que recibes y confirmas la compatibilidad.</p>
            </div>
          </div>

          <div className="modern-perk-card perk-cyan">
            <div className="perk-icon-circle icon-cyan">
              <Truck size={22} />
            </div>
            <div className="perk-info-group">
              <h4>Despacho Express 24-48h</h4>
              <p>Envíos trazables a todas las regiones desde la bodega más cercana.</p>
            </div>
          </div>

          <div className="modern-perk-card perk-slate">
            <div className="perk-icon-circle icon-slate">
              <FileText size={22} />
            </div>
            <div className="perk-info-group">
              <h4>Boleta y Factura Electrónica</h4>
              <p>Documentación tributaria oficial emitida por tiendas con RUT verificado.</p>
            </div>
          </div>

          <div className="modern-perk-card perk-electric">
            <div className="perk-icon-circle icon-electric">
              <ShieldCheck size={22} />
            </div>
            <div className="perk-info-group">
              <h4>Garantía por Patente</h4>
              <p>100% de calce respaldado por la ficha técnica oficial de fábrica.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Footer Body Columns */}
      <div className="main-footer-body">
        <div className="container footer-columns-grid">
          {/* Column 1: Brand & Seller Portal CTA */}
          <div className="footer-col brand-col">
            <RepuesTopLogo height={52} variant="footer" />
            <p className="footer-about-text">
              El marketplace automotriz líder de Chile. Conectamos a conductores y talleres con más de <strong className="text-cyan-glow">+1.200 casas de repuestos y desarmadurías verificadas</strong> en todo el país.
            </p>

            <div className="seller-box-card-vivid" onClick={onOpenSellerModal}>
              <div className="sb-header-vivid">
                <Store size={20} className="icon-store-glow" />
                <span>¿Tienes una Tienda de Repuestos?</span>
              </div>
              <p>Comienza a vender a miles de conductores y mecánicos a diario.</p>
              <button className="sb-btn-blue-official">
                <span>Registrar Mi Tienda Gratis</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Column 2: Popular Categories */}
          <div className="footer-col">
            <h4 className="title-official">Categorías Populares</h4>
            <ul className="footer-links-list">
              <li><ChevronRight size={12} className="link-arrow" /> Pastillas & Discos de Freno</li>
              <li><ChevronRight size={12} className="link-arrow" /> Kits de Distribución Motor</li>
              <li><ChevronRight size={12} className="link-arrow" /> Amortiguadores & Suspensión</li>
              <li><ChevronRight size={12} className="link-arrow" /> Aceites Sintéticos 5W30 / 10W40</li>
              <li><ChevronRight size={12} className="link-arrow" /> Iluminación & Focos LED</li>
              <li><ChevronRight size={12} className="link-arrow" /> Baterías 12V AGM & Start-Stop</li>
            </ul>
          </div>

          {/* Column 3: Seller Network & Integration */}
          <div className="footer-col">
            <h4 className="title-official">Red de Vendedores</h4>
            <ul className="footer-links-list">
              <li className="highlight-link-cyan" onClick={onOpenSellerModal}>
                <Sparkles size={13} /> Únete como Vendedor →
              </li>
              <li><ChevronRight size={12} className="link-arrow" /> Planes para Desarmadurías</li>
              <li><ChevronRight size={12} className="link-arrow" /> Integración Bsale / Softland / ERP</li>
              <li><ChevronRight size={12} className="link-arrow" /> Términos de Servicio para Tiendas</li>
              <li><ChevronRight size={12} className="link-arrow" /> Centro de Ayuda al Comercio</li>
            </ul>
          </div>

          {/* Column 4: Customer Support & Contact */}
          <div className="footer-col">
            <h4 className="title-official">Atención al Cliente</h4>
            
            <div className="contact-item-vivid">
              <Phone size={16} className="text-cyan-glow" />
              <span><strong>Mesa Central:</strong> +56 2 2938 4000</span>
            </div>

            <div className="contact-item-vivid">
              <Mail size={16} className="text-cyan-glow" />
              <span><strong>Email:</strong> contacto@repuestop.cl</span>
            </div>

            <div className="contact-item-vivid">
              <MapPin size={16} className="text-cyan-glow" />
              <span><strong>Sede:</strong> Av. Providencia 1200, Santiago</span>
            </div>

            <div className="contact-item-vivid">
              <Clock size={16} className="text-cyan-glow" />
              <span><strong>Horario:</strong> Lun a Vie 08:30 - 18:30 hrs</span>
            </div>

            <div className="payment-badges-row-vivid">
              <span className="pay-tag webpay-official">WebPay Plus 🇨🇱</span>
              <span className="pay-tag mp-official">MercadoPago</span>
              <span className="pay-tag card-official">Visa / MasterCard</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Legal & Copyright Bar */}
      <div className="footer-bottom-row-vivid">
        <div className="container bottom-flex">
          <p>© 2026 RepuesTop SpA Chile. Todos los derechos reservados.</p>
          <div className="legal-links-list">
            <span>Términos & Condiciones</span>
            <span>Política de Privacidad</span>
            <span>Garantía por Patente</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
