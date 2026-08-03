import React from 'react';
import { 
  ShieldCheck, Truck, Lock, FileText, Phone, Mail, MapPin, 
  Clock, Store, ArrowRight, CheckCircle2, ChevronRight, Sparkles, Building2, Wrench, HelpCircle
} from 'lucide-react';
import RepuesTopLogo from './RepuesTopLogo';

export default function Footer({
  onOpenSellerModal,
  onOpenStores,
  onOpenCatalog,
  onOpenHelp
}) {
  return (
    <footer className="modern-footer-section">
      {/* Main Footer Body Columns */}
      <div className="main-footer-body">
        <div className="container footer-columns-grid">
          {/* Column 1: Brand & Seller Portal CTA */}
          <div className="footer-col brand-col">
            <RepuesTopLogo height={52} variant="footer" />
            <p className="footer-about-text">
              El marketplace automotriz líder de Chile. Conectamos a conductores y talleres con más de <strong className="text-cyan-glow">+1.200 casas de repuestos y desarmadurías verificadas</strong> en todo el país.
            </p>

            <div className="seller-box-card-vivid" onClick={onOpenSellerModal} style={{ cursor: 'pointer' }}>
              <div className="sb-header-vivid">
                <Store size={20} className="icon-store-glow" />
                <span>¿Tienes una Tienda de Repuestos?</span>
              </div>
              <p>Comienza a vender a miles de conductores y mecánicos a diario.</p>
              <button className="sb-btn-blue-official" onClick={(e) => { e.stopPropagation(); onOpenSellerModal?.(); }}>
                <span>Registrar Mi Tienda Gratis</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Column 2: Navigation & Directories */}
          <div className="footer-col">
            <h4 className="title-official">Explorar Marketplace</h4>
            <ul className="footer-links-list">
              <li onClick={onOpenCatalog} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Catálogo General de Repuestos</span>
              </li>
              <li onClick={onOpenStores} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Directorio de Tiendas Verificadas</span>
              </li>
              <li onClick={onOpenCatalog} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Búsqueda por Patente / VIN</span>
              </li>
              <li onClick={onOpenHelp} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Centro de Ayuda & Soporte Ticket</span>
              </li>
              <li onClick={onOpenSellerModal} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Portal de Vendedores & Desarmadurías</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Categorías de Repuestos */}
          <div className="footer-col">
            <h4 className="title-official">Categorías Populares</h4>
            <ul className="footer-links-list">
              <li onClick={onOpenCatalog} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Pastillas & Discos de Freno</span>
              </li>
              <li onClick={onOpenCatalog} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Kits de Distribución Motor</span>
              </li>
              <li onClick={onOpenCatalog} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Amortiguadores & Suspensión</span>
              </li>
              <li onClick={onOpenCatalog} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Aceites Sintéticos 5W30 / 10W40</span>
              </li>
              <li onClick={onOpenCatalog} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Iluminación & Focos LED</span>
              </li>
              <li onClick={onOpenCatalog} style={{ cursor: 'pointer' }}>
                <ChevronRight size={12} className="link-arrow" />
                <span>Baterías 12V AGM & Start-Stop</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Customer Support & Contact */}
          <div className="footer-col">
            <h4 className="title-official">Atención al Cliente</h4>
            
            <div className="contact-item-vivid" onClick={onOpenHelp} style={{ cursor: 'pointer' }}>
              <Phone size={16} className="text-cyan-glow" />
              <span><strong>Mesa Central:</strong> +56 2 2938 4000</span>
            </div>

            <div className="contact-item-vivid" onClick={onOpenHelp} style={{ cursor: 'pointer' }}>
              <Mail size={16} className="text-cyan-glow" />
              <span><strong>Email:</strong> contacto@repuestop.cl</span>
            </div>

            <div className="contact-item-vivid">
              <MapPin size={16} className="text-cyan-glow" />
              <span><strong>Sede:</strong> Av. Providencia 1200, Santiago</span>
            </div>

            <div className="contact-item-vivid">
              <Clock size={16} className="text-cyan-glow" />
              <span><strong>Atención:</strong> Lun a Vie 08:30 - 18:30 hrs</span>
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
          <p>© 2026 Corebit SpA Chile. Todos los derechos reservados.</p>
          <div className="legal-links-list">
            <span onClick={onOpenHelp} style={{ cursor: 'pointer' }}>Términos & Condiciones</span>
            <span onClick={onOpenHelp} style={{ cursor: 'pointer' }}>Política de Privacidad</span>
            <span onClick={onOpenHelp} style={{ cursor: 'pointer' }}>Garantía por Patente</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
