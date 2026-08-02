import React from 'react';
import { Star, CheckCircle2, UserCheck, ShieldCheck, MapPin, Building2, Database } from 'lucide-react';
import { CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';

export default function SocialProofTestimonials() {
  const reviews = [
    {
      id: 1,
      nombre: 'Jorge Morales',
      cargo: 'Dueño de Casa de Repuestos San Pedro',
      ciudad: 'Concepción, Biobío',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      rating: 5,
      comentario: 'Conectamos nuestro sistema Bsale a RepuesTop. Ahora cuando un cliente busca por patente en la web, ve nuestro inventario en vivo y vendemos un 45% más a todo Chile.',
      fecha: 'Hace 2 días',
      patenteComprada: 'VENDEDOR VERIFICADO',
      categoria: null
    },
    {
      id: 2,
      nombre: 'Marcelo Rivas',
      cargo: 'Conductor Toyota RAV4 2021',
      ciudad: 'Santiago, Región Metropolitana',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      rating: 5,
      comentario: 'Ingresé la patente de mi RAV4 y me mostró el stock en tiempo real en una tienda de Santiago. Compré las pastillas cerámicas Brembo con factura y llegaron al día siguiente.',
      fecha: 'Hace 4 días',
      patenteComprada: 'BB-CL-12',
      categoria: 'frenos'
    },
    {
      id: 3,
      nombre: 'Taller Mecánico San Francisco',
      cargo: 'Jefe de Inventario & Compras',
      ciudad: 'Viña del Mar, Valparaíso',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
      rating: 5,
      comentario: 'Consultar el inventario por patente nos ahorró horas de llamadas a distribuidores. Encontramos amortiguadores KYB en stock directo de bodega con garantía de calce.',
      fecha: 'Hace 1 semana',
      patenteComprada: 'AA-123-BB',
      categoria: 'suspension'
    }
  ];

  return (
    <section className="testimonials-section container">
      <div className="section-title-wrap">
        <div className="title-badge-green"><Database size={14} /> TESTIMONIOS DE CASAS DE REPUESTOS & CONDUCTORES</div>
        <h2>Lo que dicen repuesteros, mecánicos y conductores en Chile</h2>
        <p>Más de +1.200 tiendas conectadas y 50.000 repuestos despachados desde inventarios verificados.</p>
      </div>

      <div className="reviews-grid-3">
        {reviews.map(rev => (
          <div key={rev.id} className="review-card-rich">
            <div className="review-header-flex">
              <div className="author-photo-wrap">
                <img src={rev.avatar} alt={rev.nombre} className="author-avatar-img" />
                <CheckCircle2 size={16} className="author-verified-icon" />
              </div>
              <div className="author-meta-wrap">
                <strong>{rev.nombre}</strong>
                <span className="author-role">{rev.cargo}</span>
                <span className="author-location"><MapPin size={12} /> {rev.ciudad}</span>
              </div>
            </div>

            <div className="review-stars-row">
              {Array.from({ length: rev.rating }).map((_, i) => (
                <Star key={i} size={15} className="star-filled" fill="#f59e0b" />
              ))}
              <span className="verified-buyer-pill">
                <ShieldCheck size={12} /> {rev.patenteComprada}
              </span>
            </div>

            <p className="review-text">"{rev.comentario}"</p>

            <div className="review-car-preview-bar">
              {rev.categoria ? (
                <CategoryIconTile
                  iconName={CATEGORY_ICON_BY_ID[rev.categoria]}
                  color={CATEGORY_COLOR_BY_ID[rev.categoria]}
                  size={22}
                  className="car-preview-thumb"
                />
              ) : (
                <div
                  className="category-icon-tile car-preview-thumb"
                  style={{ background: 'linear-gradient(135deg, #0066ff 0%, #0033aa 100%)' }}
                >
                  <Database size={22} strokeWidth={1.6} />
                </div>
              )}
              <div className="car-preview-info">
                <span>🗄️ Stock Sincronizado en Tiempo Real</span>
                <strong>Inventario 100% Verificado</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
