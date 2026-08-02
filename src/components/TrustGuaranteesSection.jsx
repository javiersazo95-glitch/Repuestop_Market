import React from 'react';
import { Database, Building2, ShieldCheck, Truck } from 'lucide-react';

export default function TrustGuaranteesSection() {
  const guarantees = [
    {
      icon: Database,
      color: '#0066ff',
      bg: '#eff6ff',
      border: '#bfdbfe',
      title: 'Inventario Digital Sincronizado en Vivo',
      description: 'Stock actualizado cada 5 minutos directamente con los sistemas de gestión (Bsale, Softland, ERP) de tiendas y bodegas.'
    },
    {
      icon: Building2,
      color: '#ea580c',
      bg: '#fff7ed',
      border: '#ffedd5',
      title: '+1.200 Casas de Repuestos y Desarmadurías',
      description: 'Comercializa con distribuidores oficiales y desarmadurías con RUT verificado, local físico y factura electrónica.'
    },
    {
      icon: ShieldCheck,
      color: '#059669',
      bg: '#ecfdf5',
      border: '#a7f3d0',
      title: 'Garantía de Calce por Ficha Técnica',
      description: 'Tu patente consulta la base de datos oficial del fabricante para asegurar un 100% de compatibilidad antes del despacho.'
    },
    {
      icon: Truck,
      color: '#9333ea',
      bg: '#f3e8ff',
      border: '#e9d5ff',
      title: 'Despacho Directo desde Bodega 24h',
      description: 'Enviamos tus repuestos desde la bodega más cercana a tu ciudad con seguimiento en tiempo real a todo Chile.'
    }
  ];

  return (
    <section className="trust-guarantees-section container">
      <div className="guarantees-grid-4">
        {guarantees.map((item, idx) => {
          const IconComp = item.icon;
          return (
            <div 
              key={idx} 
              className="guarantee-card-trust" 
              style={{ backgroundColor: item.bg, borderColor: item.border }}
            >
              <div className="icon-circle-bg" style={{ color: item.color, backgroundColor: '#ffffff' }}>
                <IconComp size={24} />
              </div>
              <div className="card-text-content">
                <h3 style={{ color: '#0f172a' }}>{item.title}</h3>
                <p style={{ color: '#475569' }}>{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
