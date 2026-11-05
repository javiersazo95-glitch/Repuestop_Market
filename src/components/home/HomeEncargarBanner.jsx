import React from 'react';
import { ArrowRight, BadgeCheck, ShoppingCart, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes/paths';

const STEPS = [
  { icon: <ShoppingCart size={20} />, title: 'Publica lo que buscas', text: 'Cuéntanos qué repuesto necesitas.' },
  { icon: <Tag size={20} />, title: 'Recibe ofertas', text: 'De vendedores verificados.' },
  { icon: <BadgeCheck size={20} />, title: 'Elige la mejor', text: 'Con la confianza y seguridad.' },
];

/** Inicio · banner de Encargar repuesto: publica lo que buscas y las tiendas ofertan. */
export default function HomeEncargarBanner({ isSeller = false }) {
  const navigate = useNavigate();
  return (
    <section className="hb-encargar container" aria-labelledby="home-encargar-title">
      <span className="hb-new">Nuevo</span>
      <div className="hb-encargar-copy">
        <h2 id="home-encargar-title">
          {isSeller ? 'Atiende encargos' : '¿No encuentras tu repuesto?'}
          <span>{isSeller ? 'y vende más' : 'Nosotros lo conseguimos'}</span>
        </h2>
        <p>
          {isSeller
            ? 'Mira qué repuestos buscan los compradores y envía tu oferta.'
            : 'Publica tu solicitud y recibe ofertas de múltiples vendedores verificados con precios competitivos.'}
        </p>
        <button type="button" className="hb-btn hb-btn-white" onClick={() => navigate(ROUTES.auctions)}>
          {isSeller ? 'Atender encargos' : 'Encargar repuesto'} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <ol className="hb-encargar-steps">
        {STEPS.map((step) => (
          <li key={step.title}>
            <span className="hb-step-icon">{step.icon}</span>
            <span><strong>{step.title}</strong><small>{step.text}</small></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
