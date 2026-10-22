import React, { useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import AuctionAvatar from './AuctionAvatar';
import { getAuctionComments, postAuctionComment } from '../services/auctionApi';
import { useAuth } from '../context/AuthContext';
import '../styles/auction-social.css';

const MAX_LENGTH = 1000;

function timeAgo(iso) {
  if (!iso) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Hace un momento';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

/** Comentarios públicos de la necesidad: las tiendas preguntan para afinar la cotización. */
export default function AuctionCommentsPanel({ auctionId, isOpen, canComment = true }) {
  const { isLoggedIn } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('RECIENTES');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAuctionComments(auctionId)
      .then((data) => { if (active) setComments(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err?.message || 'No pudimos cargar los comentarios.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auctionId]);

  const submit = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setSending(true);
    setError('');
    try {
      const created = await postAuctionComment(auctionId, value);
      setComments((current) => [...current, created]);
      setText('');
    } catch (err) {
      setError(err?.message || 'No pudimos publicar tu comentario.');
    } finally {
      setSending(false);
    }
  };

  const ordered = sortBy === 'RECIENTES' ? [...comments].reverse() : comments;

  return (
    <section className="as-card as-comments" aria-label="Comentarios de la necesidad">
      <div className="as-comments-head">
        <h2 className="as-title">
          <span><MessageCircle size={18} /> Comentarios de usuarios</span>
          <small>{comments.length}</small>
        </h2>
        {comments.length > 1 && (
          <label className="as-sort">
            <span>Ordenar por:</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="RECIENTES">Más recientes</option>
              <option value="ANTIGUOS">Más antiguos</option>
            </select>
          </label>
        )}
      </div>

      {!isOpen ? (
        <p className="as-muted as-closed">Esta subasta ya no recibe comentarios.</p>
      ) : isLoggedIn && !canComment ? (
        <p className="as-muted as-closed">Solo las tiendas pueden comentar esta necesidad para afinar su oferta; el comprador responde aquí.</p>
      ) : isLoggedIn ? (
        <form className="as-composer" onSubmit={submit}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_LENGTH}
            placeholder="Escribe un comentario o pregunta para afinar tu cotización…"
            aria-label="Escribe tu comentario"
          />
          <button type="submit" className="as-btn-primary" disabled={sending || !text.trim()}>
            <Send size={14} /> {sending ? 'Publicando…' : 'Publicar'}
          </button>
        </form>
      ) : (
        <p className="as-muted as-closed">Inicia sesión para comentar.</p>
      )}
      {error && <p className="as-error" role="alert">{error}</p>}

      {loading ? (
        <p className="as-muted">Cargando comentarios…</p>
      ) : comments.length === 0 ? (
        <p className="as-muted as-empty">Aún no hay comentarios sobre esta necesidad. Pregunta lo que necesites saber para afinar tu cotización.</p>
      ) : (
        <ul className="as-comment-list">
          {ordered.map((comment) => (
            <li key={comment.id} className="as-comment">
              <AuctionAvatar className="as-comment-avatar" src={comment.autorFotoUrl} name={comment.autor} isStore={comment.autorEsTienda} />
              <div className="as-comment-body">
                <div className="as-comment-head">
                  <strong>{comment.autor}</strong>
                  {comment.autorEsComprador && <span className="as-tag">Comprador</span>}
                  <small>{timeAgo(comment.createdAt)}</small>
                </div>
                <p>{comment.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
