import React from 'react';
import { Package, ShieldCheck, Truck, Tag } from 'lucide-react';

export default function TrustPerksRow() {
  const perks = [
    {
      icon: Package,
      bgColor: '#fee2e2',
      iconColor: '#ef4444',
      title: 'Miles de repuestos',
      subtitle: 'de todas las marcas'
    },
    {
      icon: ShieldCheck,
      bgColor: '#dbeafe',
      iconColor: '#2563eb',
      title: 'Compra segura',
      subtitle: 'Protección al comprador'
    },
    {
      icon: Truck,
      bgColor: '#f3e8ff',
      iconColor: '#9333ea',
      title: 'Envíos a todo Chile',
      subtitle: 'Rápido y seguro'
    },
    {
      icon: Tag,
      bgColor: '#ffedd5',
      iconColor: '#ea580c',
      title: 'Mejores precios',
      subtitle: 'Compara y ahorra'
    }
  ];

  return (
    <div className="container trust-perks-container">
      <div className="trust-perks-grid">
        {perks.map((perk, index) => {
          const IconComp = perk.icon;
          return (
            <div key={index} className="trust-perk-card">
              <div className="perk-circle-icon" style={{ backgroundColor: perk.bgColor, color: perk.iconColor }}>
                <IconComp size={22} />
              </div>
              <div className="perk-text-group">
                <strong className="perk-title">{perk.title}</strong>
                <span className="perk-subtitle">{perk.subtitle}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
