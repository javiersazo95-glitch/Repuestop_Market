import React from 'react';
import {
  ChevronRight, Compass, Headphones, Mail, MessageSquare,
  PackageSearch, RotateCcw, Search, ShieldCheck, Store, Tag, Truck
} from 'lucide-react';

const MARKETPLACE_LINKS = [
  ['Catálogo General de Repuestos', PackageSearch],
  ['Directorio de Tiendas Verificadas', Store],
  ['Búsqueda por Patente / VIN', Search],
  ['Centro de Ayuda & Soporte', Headphones]
];

const CATEGORY_LINKS = [
  ['Pastillas & Discos de Freno', Tag],
  ['Kits de Distribución Motor', PackageSearch],
  ['Amortiguadores & Suspensión', RotateCcw],
  ['Aceites y Filtros', PackageSearch]
];

const SUPPORT_LINKS = [
  ['Centro de Ayuda', 'Preguntas frecuentes y soporte', Headphones],
  ['Mediación de Conflictos', 'Te ayudamos con tu compra', MessageSquare]
];

export default function Footer({ onOpenStores, onOpenCatalog, onOpenHelp }) {
  const openCatalog = () => onOpenCatalog?.();

  return (
    <footer className="modern-footer-section reference-footer">
      <div className="container reference-footer-grid">
        <section className="reference-footer-brand">
          <div className="reference-footer-logo">
            <img src="/repuestop_icon.png" alt="" />
            <span>Repues<b>Top</b></span>
          </div>
          <p>El marketplace automotriz para encontrar repuestos, comparar opciones y comprar con seguridad.</p>

          <div className="footer-trust-points">
            <div><ShieldCheck /><span><strong>Compra 100% segura</strong>Protegemos tu compra en cada paso.</span></div>
            <div><Truck /><span><strong>Envíos a todo Chile</strong>Entregas rápidas y seguras donde estés.</span></div>
          </div>

        </section>

        <section className="reference-footer-column">
          <h2><Compass /> Explorar Marketplace</h2>
          <ul>
            {MARKETPLACE_LINKS.map(([label, Icon], index) => (
              <li key={label}>
                <button onClick={index === 1 ? onOpenStores : index === 3 ? onOpenHelp : openCatalog}>
                  <Icon /> <span>{label}</span> <ChevronRight className="footer-link-chevron" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="reference-footer-column">
          <h2><Tag /> Categorías Populares</h2>
          <ul>
            {CATEGORY_LINKS.map(([label, Icon]) => (
              <li key={label}>
                <button onClick={openCatalog}><Icon /> <span>{label}</span> <ChevronRight className="footer-link-chevron" /></button>
              </li>
            ))}
          </ul>
        </section>

        <section className="reference-footer-column reference-support-column">
          <h2><ShieldCheck /> Soporte y Mediación</h2>
          <ul>
            {SUPPORT_LINKS.map(([label, detail, Icon]) => (
              <li key={label}>
                <button onClick={onOpenHelp}><Icon /><span><strong>{label}</strong><small>{detail}</small></span></button>
              </li>
            ))}
          </ul>
        </section>

        <section className="reference-footer-column reference-contact-column">
          <h2><Headphones /> Atención al Cliente</h2>
          <div className="reference-contact-list compact-contact-list">
            <button onClick={onOpenHelp}><Headphones /><span><strong>Soporte</strong>Resolvemos tus dudas de compra</span></button>
            <button onClick={onOpenHelp}><Mail /><span><strong>Centro de ayuda</strong>Encuentra respuestas y asistencia</span></button>
          </div>
        </section>
      </div>

      <div className="container reference-footer-bottom">
        <p>© 2026 Corebit SpA Chile.<br />Todos los derechos reservados.</p>
        <nav>
          <button onClick={onOpenHelp}>Términos y Condiciones</button>
          <button onClick={onOpenHelp}>Política de Privacidad</button>
          <button onClick={onOpenHelp}>Garantía por Patente</button>
        </nav>
        <span className="reference-footer-security">Compra protegida</span>
      </div>
    </footer>
  );
}
