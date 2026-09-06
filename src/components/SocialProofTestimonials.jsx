import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Star, UserRound, Loader2, ShieldCheck, Store, Car, BadgeCheck,
  ChevronLeft, ChevronRight, CheckCircle2, MessageSquareQuote,
  CalendarDays, ThumbsUp,
} from 'lucide-react';
import { getPublicSystemFeedbackApi, resolveMediaUrl } from '../services/api';

const SELLER_ROLES = ['SELLER', 'VENDEDOR'];
const isSellerReview = (rev) => SELLER_ROLES.includes(rev?.usuarioRol);

// El backend todavia no expone un contador de "util", asi que el voto se guarda
// por navegador. Al existir el endpoint, reemplazar por la llamada real.
const HELPFUL_KEY = 'repuestop:feedback-util';

const readHelpful = () => {
  try {
    const raw = localStorage.getItem(HELPFUL_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

function StarRow({ value = 0, size = 14 }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className="tst-stars" role="img" aria-label={`${value} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < rounded ? 'tst-star-on' : 'tst-star-off'}
          fill={i < rounded ? '#f5a524' : 'none'}
          aria-hidden
        />
      ))}
    </span>
  );
}

export default function SocialProofTestimonials() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const [activeDot, setActiveDot] = useState(0);
  const [pages, setPages] = useState(0);
  const [helpful, setHelpful] = useState(() => readHelpful());
  const trackRef = useRef(null);

  useEffect(() => {
    let active = true;
    getPublicSystemFeedbackApi()
      .then((items) => { if (active) setReviews(Array.isArray(items) ? items : []); })
      .catch(() => { if (active) setReviews([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => {
    const rated = reviews.filter((r) => Number(r.calificacion) > 0);
    const average = rated.length
      ? rated.reduce((sum, r) => sum + Number(r.calificacion), 0) / rated.length
      : 0;
    return { average: Math.round(average * 10) / 10, total: reviews.length };
  }, [reviews]);

  const stepSize = () => {
    const el = trackRef.current;
    const card = el?.querySelector('.tst-card');
    return card ? card.offsetWidth + 18 : (el?.clientWidth ?? 0) * 0.8;
  };

  const syncTrack = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const card = el.querySelector('.tst-card');
    const step = card ? card.offsetWidth + 18 : el.clientWidth;
    setScrollable(max > 4);
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < max - 4);
    // Solo son alcanzables las posiciones hasta el final del scroll: con tres
    // tarjetas a la vista, seis opiniones dan cuatro paradas, no seis.
    const stops = step > 0 && max > 4 ? Math.round(max / step) + 1 : 0;
    setPages(stops);
    setActiveDot(step > 0 ? Math.min(Math.round(el.scrollLeft / step), Math.max(stops - 1, 0)) : 0);
  }, []);

  useEffect(() => {
    syncTrack();
    window.addEventListener('resize', syncTrack);
    return () => window.removeEventListener('resize', syncTrack);
  }, [syncTrack, reviews]);

  const slide = (direction) => {
    trackRef.current?.scrollBy({ left: stepSize() * direction, behavior: 'smooth' });
  };

  const goToDot = (index) => {
    trackRef.current?.scrollTo({ left: stepSize() * index, behavior: 'smooth' });
  };

  const toggleHelpful = (id) => {
    setHelpful((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      try {
        localStorage.setItem(HELPFUL_KEY, JSON.stringify([...next]));
      } catch {
        /* almacenamiento no disponible: el voto dura solo esta sesion */
      }
      return next;
    });
  };

  if (!loading && reviews.length === 0) return null;

  return (
    <section className="testimonials-section container" aria-labelledby="tst-title">
      {/* 1. Encabezado de la seccion */}
      <header className="tst-header">
        <span className="tst-header-icon" aria-hidden><MessageSquareQuote size={30} /></span>

        <div className="tst-header-text">
          <span className="tst-eyebrow">COMENTARIOS</span>
          <h2 id="tst-title">Lo que dice la comunidad RepuesTop</h2>
          <p>
            Experiencias reales de personas como tú, que ya confían en RepuesTop para
            encontrar el repuesto exacto y a los mejores precios.
          </p>
        </div>

        {!loading && summary.average > 0 && (
          <div className="tst-score">
            <span className="tst-score-icon"><Star size={17} fill="currentColor" /></span>
            <span className="tst-score-text">
              <strong>{summary.average.toFixed(1)}/5</strong>
              <small>
                Basado en {summary.total.toLocaleString('es-CL')}{' '}
                {summary.total === 1 ? 'opinión' : 'opiniones'}
              </small>
            </span>
          </div>
        )}
      </header>

      {loading ? (
        <div className="tst-loading"><Loader2 size={18} className="spin-icon" /> Cargando opiniones…</div>
      ) : (
        <>
          {/* 2. Carrusel de opiniones */}
          <div className="tst-carousel">
            {scrollable && (
              <>
                <button
                  type="button"
                  className="tst-nav-btn is-prev"
                  onClick={() => slide(-1)}
                  disabled={!canPrev}
                  aria-label="Ver opiniones anteriores"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="tst-nav-btn is-next"
                  onClick={() => slide(1)}
                  disabled={!canNext}
                  aria-label="Ver más opiniones"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            <div
              className="tst-track"
              ref={trackRef}
              onScroll={syncTrack}
              tabIndex={0}
              role="region"
              aria-label="Carrusel de opiniones de la comunidad"
            >
              {reviews.map((rev, index) => {
                const seller = isSellerReview(rev);
                const RoleIcon = seller ? Store : Car;
                const date = rev.fechaCreacion
                  ? new Date(rev.fechaCreacion).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '';
                const voted = helpful.has(rev.id);

                return (
                  <article key={rev.id} className={`tst-card${index === 0 ? ' is-featured' : ''}`}>
                    <div className="tst-card-head">
                      <span className="tst-avatar">
                        {rev.usuarioPerfilUrl
                          ? <img src={resolveMediaUrl(rev.usuarioPerfilUrl)} alt={rev.usuarioNombre} />
                          : <UserRound size={22} />}
                      </span>

                      <span className="tst-identity">
                        <span className="tst-name">
                          {rev.usuarioNombre}
                          <BadgeCheck size={15} className="tst-verified" aria-label="Cuenta verificada" />
                        </span>
                        <span className="tst-role">
                          <RoleIcon size={13} />
                          {seller ? 'Casa de repuestos' : 'Conductor'}
                        </span>
                      </span>

                      <span className="tst-rating">
                        <StarRow value={Number(rev.calificacion)} size={13} />
                        <strong>{Number(rev.calificacion).toFixed(1)}</strong>
                      </span>
                    </div>

                    <p className="tst-text">“{rev.comentario}”</p>

                    <footer className="tst-card-foot">
                      <button
                        type="button"
                        className={`tst-helpful${voted ? ' is-active' : ''}`}
                        onClick={() => toggleHelpful(rev.id)}
                        aria-pressed={voted}
                      >
                        <ThumbsUp size={15} />
                        {voted ? 'Te resultó útil' : 'Útil'}
                      </button>
                      {date && (
                        <time className="tst-date" dateTime={rev.fechaCreacion}>
                          <CalendarDays size={13} />{date}
                        </time>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          </div>

          {/* 3. Indicadores del carrusel */}
          {pages > 1 && (
            <div className="tst-dots" role="tablist" aria-label="Ir a un grupo de opiniones">
              {Array.from({ length: pages }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === activeDot}
                  aria-label={`Ver grupo ${index + 1} de ${pages}`}
                  className={`tst-dot${index === activeDot ? ' is-active' : ''}`}
                  onClick={() => goToDot(index)}
                />
              ))}
            </div>
          )}

          {/* 4. Leyenda de confianza */}
          <aside className="tst-trust">
            <span className="tst-trust-icon"><ShieldCheck size={22} /></span>
            <div className="tst-trust-copy">
              <strong>Opiniones reales, sin editar ni comprar</strong>
              <p>
                Cada comentario proviene de una cuenta verificada con actividad confirmada en
                RepuesTop. No editamos, ordenamos ni eliminamos opiniones.
              </p>
            </div>
            <span className="tst-trust-seal">
              <CheckCircle2 size={15} /> Verificado por RepuesTop
            </span>
          </aside>
        </>
      )}
    </section>
  );
}
