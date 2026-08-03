import React from 'react';
import { Search, Building2, Truck, ShieldCheck } from 'lucide-react';

const FEATURES = [
  {
    key: 'patente',
    icon: Search,
    iconColor: '#0066ff',
    iconBg: '#eff6ff',
    title: 'Búsqueda por Patente',
    description: 'Filtra repuestos 100% compatibles según el motor, chasis y año exacto de tu auto.'
  },
  {
    key: 'tiendas',
    icon: Building2,
    iconColor: '#0284c7',
    iconBg: '#e0f2fe',
    title: 'Tiendas RUT Verificadas',
    description: 'Importadores directos y locales acreditados con boleta o factura y soporte oficial.'
  },
  {
    key: 'envios',
    icon: Truck,
    iconColor: '#059669',
    iconBg: '#eafbf1',
    title: 'Despacho a todo Chile',
    description: 'Retiro presencial en tienda, envío dentro de la comuna o despacho a regiones.'
  },
  {
    key: 'usados',
    icon: ShieldCheck,
    iconColor: '#d97706',
    iconBg: '#fff7ed',
    title: 'Usados con Garantía',
    description: 'Piezas de desarmadurías certificadas probadas en banco con hasta 60% de ahorro.'
  }
];

export default function PromoGridBanners({ onScrollToCatalog }) {
  return (
    <div className="container promo-banners-container" style={{ marginTop: '16px' }}>
      <div className="informative-features-grid">
        {FEATURES.map((feat) => {
          const IconComponent = feat.icon;
          return (
            <div key={feat.key} className="feature-info-card" onClick={onScrollToCatalog}>
              <div
                className="feature-icon-badge"
                style={{ backgroundColor: feat.iconBg, color: feat.iconColor }}
              >
                <IconComponent size={22} strokeWidth={2.2} />
              </div>

              <div className="feature-text-block">
                <h4 className="feature-title">{feat.title}</h4>
                <p className="feature-desc">{feat.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
