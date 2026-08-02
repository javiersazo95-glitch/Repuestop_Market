import React from 'react';
import { ShieldCheck, Lock, Headphones, Scale, Truck, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function SupportMediationSection() {
  const pillars = [
    {
      icon: Lock,
      color: '#0066ff',
      bg: '#eff6ff',
      border: '#bfdbfe',
      title: 'Pago Protegido en Custodia',
      description: 'El dinero de tu compra queda protegido en custodia por RepuesTop.cl y solo se libera a la tienda una vez que recibes el repuesto y confirmas el calce perfecto.'
    },
    {
      icon: Scale,
      color: '#9333ea',
      bg: '#f3e8ff',
      border: '#e9d5ff',
      title: 'Centro de Mediación e Impugnación',
      description: 'Si surge algún inconveniente o diferencia con la tienda, nuestro equipo de mediación especializado interviene de forma imparcial respaldado por evidencia y guía de despacho.'
    },
    {
      icon: ShieldCheck,
      color: '#059669',
      bg: '#ecfdf5',
      border: '#a7f3d0',
      title: 'Verificación Tributaria de Tiendas',
      description: 'Revisamos minuciosamente la documentación legal (RUT, patentes municipales, dirección comercial) de cada tienda y desarmaduría antes de habilitar su inventario.'
    }
  ];

  return (
    <section className="support-mediation-section container">
      <div className="section-title-wrap">
        <div className="title-badge-purple"><Scale size={14} /> RESPALDO Y SEGURIDAD REPUESTOP.CL</div>
        <h2>Sistema de Pago Protegido, Mediación y Garantía</h2>
        <p>Comprar repuestos en línea ahora es 100% seguro. Te acompañamos desde la cotización hasta la entrega final en tu domicilio o taller.</p>
      </div>

      <div className="mediation-pillars-grid">
        {pillars.map((pillar, idx) => {
          const IconComp = pillar.icon;
          return (
            <div 
              key={idx} 
              className="mediation-card"
              style={{ backgroundColor: pillar.bg, borderColor: pillar.border }}
            >
              <div className="pillar-icon-box" style={{ color: pillar.color, backgroundColor: '#ffffff' }}>
                <IconComp size={26} />
              </div>
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
            </div>
          );
        })}
      </div>

      {/* Support Direct Contact Banner */}
      <div className="support-contact-banner">
        <div className="banner-left">
          <Headphones size={32} className="icon-headphones" />
          <div>
            <h4>¿Necesitas ayuda con un pedido o tienes dudas de mediación?</h4>
            <p>Canal oficial de soporte: <strong>contacto@repuestop.cl</strong> • Teléfono: <strong>+56 2 2938 4000</strong></p>
          </div>
        </div>

        <button className="btn-contact-support">
          <span>Abrir Ticket de Soporte →</span>
        </button>
      </div>
    </section>
  );
}
