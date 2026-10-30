import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Star } from 'lucide-react';

const GRADES = ['Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];
const COMMENT_MAX = 500;

/**
 * Califica al taller de una cita ya realizada: de 1 a 5 estrellas y un comentario opcional de hasta
 * 500 caracteres. Se puede una sola vez por cita y no se edita despues; la opinion queda publica en el
 * perfil del taller con el nombre abreviado de quien la deja. Contraparte de `TallerRatingSheet` de la app.
 *
 * `onSubmit(estrellas, comentario)` puede lanzar: el error se muestra aqui y la ventana sigue abierta.
 */
export default function WorkshopRatingDialog({ workshopName, onSubmit, onClose }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shown = hover || stars;

  const submit = async () => {
    if (stars < 1 || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(stars, comment.trim());
      onClose();
    } catch (err) {
      setError(err?.message || 'No pudimos guardar tu opinión. Inténtalo nuevamente.');
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="appt-reason-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Califica al taller"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="appt-reason-card appt-rating-card">
        <span className="appt-rating-icon"><Star size={24} /></span>
        <h4>Califica al taller</h4>
        <p>{workshopName}</p>

        <div className="appt-rating-stars" role="radiogroup" aria-label="Nota de 1 a 5 estrellas" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={stars === value}
              aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
              className={shown >= value ? 'is-on' : ''}
              onMouseEnter={() => setHover(value)}
              onClick={() => setStars(value)}
            >
              <Star size={34} />
            </button>
          ))}
        </div>
        <span className="appt-rating-grade" aria-live="polite">{shown > 0 ? GRADES[shown - 1] : 'Toca una estrella para calificar'}</span>

        <label className="appt-rating-comment">
          <span className="appt-reason-label">Comentario <small>Opcional</small></span>
          <textarea
            rows={3}
            value={comment}
            maxLength={COMMENT_MAX}
            placeholder="Cuéntanos cómo fue tu experiencia"
            onChange={(e) => setComment(e.target.value)}
          />
          <small className={`appt-rating-count ${comment.length >= COMMENT_MAX * 0.9 ? 'is-near' : ''}`}>{comment.length}/{COMMENT_MAX}</small>
        </label>
        <small className="appt-rating-note">Tu opinión es pública, con tu nombre abreviado, y no se puede editar después.</small>

        {error && <p className="appt-reason-error" role="alert">{error}</p>}

        <div className="appt-reason-actions">
          <button type="button" className="appt-reason-back" onClick={onClose} disabled={busy}>Volver</button>
          <button type="button" className="appt-reason-confirm" onClick={submit} disabled={busy || stars < 1}>
            {busy ? <Loader2 size={15} className="spin-icon" /> : 'Enviar opinión'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
