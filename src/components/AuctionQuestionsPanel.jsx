import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, CornerDownRight, Loader2, MessageCircle, Send } from 'lucide-react';
import AuctionAvatar from './AuctionAvatar';
import { getAuctionComments, postAuctionComment } from '../services/auctionApi';
import '../styles/auction-questions.css';

const MAX_LENGTH = 1000;
const TABS = [['new', 'Nuevas'], ['answered', 'Respondidas'], ['all', 'Todas']];

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Preguntas de las tiendas sobre una necesidad, para quien la publicó: lista a la izquierda, pregunta seleccionada y
 * caja de respuesta a la derecha. Cada respuesta queda enlazada a su pregunta y la vista pública la muestra como
 * «Respuesta del cliente».
 */
export default function AuctionQuestionsPanel({ auctionId, canReply = true, onPendingChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('new');
  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const areaRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAuctionComments(auctionId)
      .then((data) => { if (active) setComments(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err?.message || 'No pudimos cargar las preguntas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auctionId]);

  const { questions, repliesByQuestion } = useMemo(() => {
    const replies = comments.filter((c) => c.respondeAId != null);
    return {
      questions: comments.filter((c) => !c.autorEsComprador && c.respondeAId == null),
      repliesByQuestion: replies.reduce((acc, c) => ({ ...acc, [c.respondeAId]: [...(acc[c.respondeAId] || []), c] }), {}),
    };
  }, [comments]);

  const isAnswered = useCallback((question) => (repliesByQuestion[question.id] || []).length > 0, [repliesByQuestion]);
  const pending = questions.filter((q) => !isAnswered(q)).length;
  const counts = { new: pending, answered: questions.length - pending, all: questions.length };

  useEffect(() => { if (!loading) onPendingChange?.(pending); }, [pending, loading, onPendingChange]);

  // Las más antiguas sin responder primero: es el orden natural para contestarlas.
  const visible = useMemo(() => questions
    .filter((q) => tab === 'all' || (tab === 'new') === !isAnswered(q))
    .sort((a, b) => (tab === 'answered' ? new Date(b.createdAt) - new Date(a.createdAt) : new Date(a.createdAt) - new Date(b.createdAt))),
  [questions, tab, isAnswered]);

  const selected = visible.find((q) => q.id === selectedId) || visible[0] || null;
  const replies = selected ? repliesByQuestion[selected.id] || [] : [];

  const select = (question) => {
    setSelectedId(question.id);
    setMobileDetail(true);
    setText('');
    setError('');
  };

  const submit = async (event) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value || !selected) return;
    const nextPending = visible.filter((q) => q.id !== selected.id && !isAnswered(q))[0];
    setSending(true);
    setError('');
    try {
      const created = await postAuctionComment(auctionId, value, selected.id);
      setComments((current) => [...current, created]);
      setText('');
      if (tab === 'new') setSelectedId(nextPending ? nextPending.id : null);
      if (tab === 'new' && !nextPending) setMobileDetail(false);
    } catch (err) {
      setError(err?.message || 'No pudimos publicar tu respuesta.');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event);
  };

  if (loading) return <p className="qq-state"><Loader2 size={16} className="qq-spin" /> Cargando preguntas…</p>;
  if (questions.length === 0) {
    return (
      <div className="qq-empty">
        <MessageCircle size={30} />
        <strong>Aún no hay preguntas</strong>
        <p>Cuando una tienda necesite aclarar algo para afinar su oferta, la pregunta aparecerá aquí y podrás responderla.</p>
        {error && <p className="qq-error" role="alert"><AlertCircle size={14} /> {error}</p>}
      </div>
    );
  }

  return (
    <div className={`qq-layout ${mobileDetail ? 'is-detail' : ''}`}>
      <aside className="qq-side" aria-label="Lista de preguntas">
        <div className="qq-tabs" role="tablist" aria-label="Filtrar preguntas">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
              {label} <b>{counts[key]}</b>
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="qq-side-empty">
            {tab === 'new' ? <><CheckCircle2 size={18} /> Respondiste todas las preguntas.</> : 'No hay preguntas en este filtro.'}
          </p>
        ) : (
          <ul className="qq-list">
            {visible.map((question) => (
              <li key={question.id}>
                <button type="button" className={`qq-item ${selected?.id === question.id ? 'is-selected' : ''}`} onClick={() => select(question)}>
                  <AuctionAvatar className="qq-avatar" src={question.autorFotoUrl} name={question.autor || ''} isStore={question.autorEsTienda} />
                  <span className="qq-item-main">
                    <span className="qq-item-top"><strong>{question.autor || 'Tienda'}</strong><small>{formatDate(question.createdAt)}</small></span>
                    <span className="qq-item-text">{question.texto}</span>
                  </span>
                  {isAnswered(question) ? <CheckCircle2 size={15} className="qq-done" aria-label="Respondida" /> : <i className="qq-dot" aria-label="Sin responder" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="qq-main" aria-label="Pregunta seleccionada">
        {selected ? (
          <>
            <button type="button" className="qq-back" onClick={() => setMobileDetail(false)}><ArrowLeft size={15} /> Volver a la lista</button>
            <article className="qq-question">
              <AuctionAvatar className="qq-avatar is-lg" src={selected.autorFotoUrl} name={selected.autor || ''} isStore={selected.autorEsTienda} />
              <div>
                <p className="qq-who"><strong>{selected.autor || 'Tienda'}</strong> pregunta <small>{formatDate(selected.createdAt)}</small></p>
                <p className="qq-question-text">{selected.texto}</p>
              </div>
            </article>

            {replies.map((reply) => (
              <article key={reply.id} className="qq-reply">
                <CornerDownRight size={16} />
                <div>
                  <p className="qq-who"><strong>Tu respuesta</strong> <small>{formatDate(reply.createdAt)}</small></p>
                  <p>{reply.texto}</p>
                </div>
              </article>
            ))}

            {error && <p className="qq-error" role="alert"><AlertCircle size={14} /> {error}</p>}

            {canReply ? (
              <form className="qq-form" onSubmit={submit}>
                <label htmlFor="qq-reply-text">{replies.length === 0 ? 'Tu respuesta' : 'Agregar otra respuesta'}</label>
                <textarea
                  id="qq-reply-text"
                  ref={areaRef}
                  rows={4}
                  value={text}
                  maxLength={MAX_LENGTH}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Escribe una respuesta clara; será visible para todas las tiendas…"
                />
                <div className="qq-form-foot">
                  <small>{text.length}/{MAX_LENGTH} · Ctrl + Enter para enviar</small>
                  <button type="submit" disabled={sending || !text.trim()}>
                    {sending ? <Loader2 size={15} className="qq-spin" /> : <Send size={15} />} Responder
                  </button>
                </div>
                <p className="qq-note">Tu respuesta se publica en los comentarios de la necesidad como «Respuesta del cliente».</p>
              </form>
            ) : (
              <p className="qq-note">Esta necesidad ya cerró, por lo que no se pueden agregar respuestas.</p>
            )}
          </>
        ) : (
          <div className="qq-empty">
            <CheckCircle2 size={30} />
            <strong>{tab === 'new' ? 'Todo al día' : 'Selecciona una pregunta'}</strong>
            <p>{tab === 'new' ? 'No tienes preguntas nuevas por responder.' : 'Elige una pregunta de la lista para verla.'}</p>
          </div>
        )}
      </section>
    </div>
  );
}
