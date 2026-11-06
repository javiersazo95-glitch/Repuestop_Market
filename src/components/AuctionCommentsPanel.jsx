import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import AuctionAvatar from './AuctionAvatar';
import AuctionQuestionsModal from './AuctionQuestionsModal';
import StoreProfileLink, { commentStoreId } from './StoreProfileLink';
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

/**
 * Comentarios públicos de la búsqueda: las tiendas preguntan para afinar la cotización. La tarjeta muestra solo el
 * mensaje más nuevo (igual que Ofertas recibidas muestra la última oferta); "Ver más" abre el popup con todos.
 */
export default function AuctionCommentsPanel({ auctionId, autoOpen = false, title = '', isOpen, canComment = true, isCreator = false, quotes = [] }) {
  const { isLoggedIn } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [allOpen, setAllOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAuctionComments(auctionId)
      .then((data) => { if (active) setComments(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err?.message || 'No pudimos cargar los comentarios.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auctionId]);

  // Aviso de una pregunta o de su respuesta (`?comentarios=1`): al cargar, cae directo en el popup con la conversación.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpen && !loading && comments.length > 0 && !autoOpened.current) {
      autoOpened.current = true;
      setAllOpen(true);
    }
  }, [autoOpen, loading, comments.length]);

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

  // El mensaje más nuevo, sea una pregunta de una tienda o una respuesta del cliente.
  const latest = [...comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const isReply = latest?.respondeAId != null;
  const unansweredQuestion = latest && !isReply && !latest.autorEsComprador
    && !comments.some((comment) => comment.respondeAId === latest.id);

  return (
    <section className="as-card as-comments" aria-label="Comentarios del encargo">
      <div className="as-comments-head">
        <h2 className="as-title">
          <span><MessageCircle size={18} /> Comentarios</span>
          <small>{comments.length}</small>
        </h2>
      </div>

      {!isOpen ? (
        <p className="as-muted as-closed">Este encargo de repuestos ya no recibe comentarios.</p>
      ) : isLoggedIn && !canComment ? (
        <p className="as-muted as-closed">Solo las tiendas pueden comentar este encargo para afinar su oferta; el comprador responde aquí.</p>
      ) : isCreator ? (
        <p className="as-muted as-closed">Responde cada pregunta desde «Ver más comentarios»: tu respuesta queda anidada en esa pregunta.</p>
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
      ) : !latest ? (
        <p className="as-muted as-empty">Aún no hay comentarios sobre este encargo. Pregunta lo que necesites saber para afinar tu cotización.</p>
      ) : (
        <ul className="as-comment-list">
          <li key={latest.id} className="as-comment">
            <StoreProfileLink storeId={commentStoreId(latest, quotes)} name={latest.autor}>
              <AuctionAvatar className="as-comment-avatar" src={latest.autorFotoUrl} name={latest.autor} isStore={latest.autorEsTienda} storeId={commentStoreId(latest, quotes)} />
            </StoreProfileLink>
            <div className="as-comment-body">
              <div className="as-comment-head">
                <StoreProfileLink storeId={commentStoreId(latest, quotes)} name={latest.autor} showLabel><strong>{latest.autor}</strong></StoreProfileLink>
                {isReply ? <span className="as-tag">Respuesta del cliente</span> : latest.autorEsComprador && <span className="as-tag">Comprador</span>}
                <small>{timeAgo(latest.createdAt)}</small>
              </div>
              <p>{latest.texto}</p>
              {isCreator && isOpen && unansweredQuestion && (
                <button type="button" className="as-reply-btn" onClick={() => setAllOpen(true)}>Responder</button>
              )}
            </div>
          </li>
        </ul>
      )}

      {!loading && comments.length > 1 && (
        <button type="button" className="as-more" onClick={() => setAllOpen(true)}>
          Ver más comentarios ({comments.length - 1})
        </button>
      )}

      {allOpen && (
        <AuctionQuestionsModal
          auctionId={auctionId}
          title={title}
          eyebrow={isCreator ? 'Comentarios de tu encargo' : 'Comentarios del encargo'}
          canReply={isCreator && isOpen}
          isCreator={isCreator}
          onClose={() => {
            setAllOpen(false);
            getAuctionComments(auctionId).then((data) => setComments(Array.isArray(data) ? data : [])).catch(() => {});
          }}
        />
      )}
    </section>
  );
}
