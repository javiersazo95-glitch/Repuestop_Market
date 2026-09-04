import React, { useEffect, useState } from 'react';
import { Star, CheckCircle2, UserRound, Database, Loader2 } from 'lucide-react';
import { getPublicSystemFeedbackApi, resolveMediaUrl } from '../services/api';

export default function SocialProofTestimonials() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPublicSystemFeedbackApi().then((items) => { if (active) setReviews(Array.isArray(items) ? items : []); })
      .catch(() => { if (active) setReviews([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <section className="testimonials-section container">
      <div className="section-title-wrap">
        <div className="title-badge-green"><Database size={14} /> TESTIMONIOS DE CASAS DE REPUESTOS & CONDUCTORES</div>
        <h2>Lo que dicen repuesteros, mecánicos y conductores en Chile</h2>
        <p>Experiencias compartidas por usuarios que conocen RepuesTop.</p>
      </div>

      {loading ? <div className="testimonials-loading"><Loader2 size={20} className="spin-icon" /> Cargando testimonios…</div> : reviews.length > 0 && <div className="reviews-grid-3 testimonials-carousel">
        {reviews.map(rev => (
          <div key={rev.id} className="review-card-rich">
            <div className="review-header-flex">
              <div className="author-photo-wrap">
                {rev.usuarioPerfilUrl ? <img src={resolveMediaUrl(rev.usuarioPerfilUrl)} alt={rev.usuarioNombre} className="author-avatar-img" /> : <span className="author-avatar-fallback"><UserRound size={20} /></span>}
                <CheckCircle2 size={16} className="author-verified-icon" />
              </div>
              <div className="author-meta-wrap">
                <strong>{rev.usuarioNombre}</strong>
                <span className="author-role">{['SELLER', 'VENDEDOR'].includes(rev.usuarioRol) ? 'Casa de repuestos' : 'Conductor'}</span>
                <span className="author-location">{rev.fechaCreacion ? new Date(rev.fechaCreacion).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}</span>
              </div>
            </div>

            <div className="review-stars-row">
              <div className="review-stars-cluster" aria-label={`${rev.calificacion} de 5 estrellas`}>
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={16} className={i < rev.calificacion ? 'star-filled' : 'star-empty'} fill={i < rev.calificacion ? '#f59e0b' : 'none'} />)}
                <strong>{rev.calificacion}/5</strong>
              </div>
              <span className="review-feedback-kind">Feedback del sistema</span>
            </div>

            <p className="review-text">“{rev.comentario}”</p>
            <div className="review-details-row">
              <span><CheckCircle2 size={13} /> Opinión verificada</span>
              <span>{['SELLER', 'VENDEDOR'].includes(rev.usuarioRol) ? 'Perfil de tienda' : 'Perfil de conductor'}</span>
              <time>{rev.fechaCreacion ? new Date(rev.fechaCreacion).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</time>
            </div>
          </div>
        ))}
      </div>}
    </section>
  );
}
