import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, ClipboardList, CornerDownRight, Loader2, MapPin, MessageCircle, Send, Tag, X,
} from 'lucide-react';
import TallerAvatar from '../TallerAvatar';
import TallerRating from '../talleres/TallerRating';
import DiagnosticoDesglose from '../tracking/DiagnosticoDesglose';
import { commentFault, getFaultComments, priceRange, timeSince } from '../../services/faultApi';
import { workshopPath } from '../../routes/paths';
import '../../styles/auction-questions.css';
import '../../styles/fault-owner-modals.css';

const MAX_LENGTH = 1500;

/** Marco común de los dos popups (mismo del popup de preguntas de Encargar repuesto). */
function Shell({ icon: Icon, label, title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="qq-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="qq-modal" role="dialog" aria-modal="true" aria-label={label}>
        <header className="qq-modal-head">
          <div>
            <span><Icon size={14} /> {label}</span>
            <h3>{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="qq-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const formatDate = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const photoOf = (comment) => comment.autorFotoUrl || comment.taller?.logoUrl;

/** Carga los comentarios de la falla una vez y deja agregar los que se publican desde el popup. */
function useFaultComments(faultId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      const list = await getFaultComments(faultId);
      setComments(Array.isArray(list) ? list : []);
      setError('');
    } catch (err) {
      setError(err?.message || 'No pudimos cargar la información de la falla.');
    } finally {
      setLoading(false);
    }
  }, [faultId]);
  useEffect(() => { reload(); }, [reload]);
  return { comments, setComments, loading, error, reload };
}

/** "Ver perfil" del taller al lado de su nombre. */
function ProfileChip({ taller, name }) {
  if (!taller) return null;
  return (
    <Link className="fom-profile" to={workshopPath(taller.tallerId)} aria-label={`Ver perfil del taller ${name}`}>
      Ver perfil <ChevronRight size={12} aria-hidden="true" />
    </Link>
  );
}

/**
 * Comentarios de los talleres a una falla propia, separados de los diagnósticos: lista a la izquierda (nuevos, respondidos,
 * todos) y, a la derecha, el comentario con la caja para responderlo. Igual al popup de preguntas de Encargar repuesto.
 */
export function FaultCommentsModal({ fault, vehicle, canReply, onChanged, onClose }) {
  const { comments, setComments, loading, error: loadError } = useFaultComments(fault.id);
  const [tab, setTab] = useState('new');
  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const { questions, repliesBy } = useMemo(() => ({
    // Comentarios de talleres (no diagnósticos) que no escribió el propio cliente.
    questions: comments.filter((c) => c.tipo !== 'DIAGNOSTICO' && c.respondeAId == null && !c.esCreador),
    repliesBy: comments.filter((c) => c.respondeAId != null).reduce((acc, c) => ({ ...acc, [c.respondeAId]: [...(acc[c.respondeAId] || []), c] }), {}),
  }), [comments]);
  const answered = useCallback((question) => (repliesBy[question.id] || []).length > 0, [repliesBy]);
  const pending = questions.filter((q) => !answered(q)).length;
  const counts = { new: pending, answered: questions.length - pending, all: questions.length };

  const visible = useMemo(() => questions
    .filter((q) => tab === 'all' || (tab === 'new') === !answered(q))
    .sort((a, b) => (tab === 'answered' ? new Date(b.createdAt) - new Date(a.createdAt) : new Date(a.createdAt) - new Date(b.createdAt))),
  [questions, tab, answered]);
  const selected = visible.find((q) => q.id === selectedId) || visible[0] || null;
  const replies = selected ? repliesBy[selected.id] || [] : [];

  const submit = async (event) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value || !selected) return;
    const next = visible.find((q) => q.id !== selected.id && !answered(q));
    setSending(true);
    setError('');
    try {
      const created = await commentFault(fault.id, { texto: value, respondeAId: selected.id, tipo: 'COMENTARIO' });
      setComments((current) => [...current, created]);
      setText('');
      if (tab === 'new') { setSelectedId(next ? next.id : null); if (!next) setMobileDetail(false); }
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'No pudimos publicar tu respuesta.');
    } finally {
      setSending(false);
    }
  };

  let body;
  if (loading) {
    body = <p className="qq-state"><Loader2 size={16} className="qq-spin" /> Cargando comentarios…</p>;
  } else if (questions.length === 0) {
    body = (
      <div className="qq-empty">
        <MessageCircle size={30} />
        <strong>Aún no hay comentarios</strong>
        <p>Cuando un taller necesite aclarar algo para afinar su diagnóstico, su comentario aparecerá aquí y podrás responderlo.</p>
        {loadError && <p className="qq-error" role="alert"><AlertCircle size={14} /> {loadError}</p>}
      </div>
    );
  } else {
    body = (
      <div className={`qq-layout ${mobileDetail ? 'is-detail' : ''}`}>
        <aside className="qq-side" aria-label="Lista de comentarios">
          <div className="qq-tabs" role="tablist" aria-label="Filtrar comentarios">
            {[['new', 'Nuevos'], ['answered', 'Respondidos'], ['all', 'Todos']].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
                {label} <b>{counts[key]}</b>
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="qq-side-empty">{tab === 'new' ? <><CheckCircle2 size={18} /> Respondiste todos los comentarios.</> : 'No hay comentarios en este filtro.'}</p>
          ) : (
            <ul className="qq-list">
              {visible.map((question) => (
                <li key={question.id}>
                  <button type="button" className={`qq-item ${selected?.id === question.id ? 'is-selected' : ''}`} onClick={() => { setSelectedId(question.id); setMobileDetail(true); setText(''); setError(''); }}>
                    <TallerAvatar className="qq-avatar" src={photoOf(question)} name={question.autor || ''} />
                    <span className="qq-item-main">
                      <span className="qq-item-top"><strong>{question.autor || 'Taller'}</strong><small>{formatDate(question.createdAt)}</small></span>
                      <span className="qq-item-text">{question.texto}</span>
                    </span>
                    {answered(question) ? <CheckCircle2 size={15} className="qq-done" aria-label="Respondido" /> : <i className="qq-dot" aria-label="Sin responder" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="qq-main" aria-label="Comentario seleccionado">
          {selected ? (
            <>
              <button type="button" className="qq-back" onClick={() => setMobileDetail(false)}><ArrowLeft size={15} /> Volver a la lista</button>
              <article className="qq-question">
                <TallerAvatar className="qq-avatar is-lg" src={photoOf(selected)} name={selected.autor || ''} />
                <div>
                  <p className="qq-who"><strong>{selected.autor || 'Taller'}</strong> <ProfileChip taller={selected.taller} name={selected.autor} /> <small>{formatDate(selected.createdAt)}</small></p>
                  {selected.taller && <span className="fom-sub"><TallerRating rating={selected.taller.calificacion} count={selected.taller.opiniones} />{selected.taller.comuna && <span><MapPin size={12} /> {selected.taller.comuna}</span>}</span>}
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
                  <label htmlFor="fom-reply-text">{replies.length === 0 ? 'Tu respuesta' : 'Agregar otra respuesta'}</label>
                  <textarea
                    id="fom-reply-text"
                    rows={4}
                    value={text}
                    maxLength={MAX_LENGTH}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event); }}
                    placeholder="Escribe una respuesta clara; será visible para los talleres que ven la falla…"
                  />
                  <div className="qq-form-foot">
                    <small>{text.length}/{MAX_LENGTH} · Ctrl + Enter para enviar</small>
                    <button type="submit" disabled={sending || !text.trim()}>
                      {sending ? <Loader2 size={15} className="qq-spin" /> : <Send size={15} />} Responder
                    </button>
                  </div>
                  <p className="qq-note">Tu respuesta se publica en los comentarios de la falla como «Respuesta del cliente».</p>
                </form>
              ) : (
                <p className="qq-note">Esta falla ya está cerrada, por lo que no se pueden agregar respuestas.</p>
              )}
            </>
          ) : (
            <div className="qq-empty">
              <CheckCircle2 size={30} />
              <strong>{tab === 'new' ? 'Todo al día' : 'Selecciona un comentario'}</strong>
              <p>{tab === 'new' ? 'No tienes comentarios nuevos por responder.' : 'Elige un comentario de la lista para verlo.'}</p>
            </div>
          )}
        </section>
      </div>
    );
  }

  return <Shell icon={MessageCircle} label="Comentarios de los talleres" title={vehicle} onClose={onClose}>{body}</Shell>;
}

/**
 * Diagnósticos de los talleres a una falla propia, separados de los comentarios: lista a la izquierda y, a la derecha, el resumen
 * del diagnóstico elegido con el acceso a abrirlo completo (aceptarlo, responder o agendar).
 */
export function FaultDiagnosesModal({ fault, vehicle, canAct, onChanged, onClose }) {
  const { comments, loading, error: loadError, reload } = useFaultComments(fault.id);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [openId, setOpenId] = useState(null);

  const diagnoses = useMemo(
    () => comments.filter((c) => c.tipo === 'DIAGNOSTICO' && c.respondeAId == null).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [comments],
  );
  const repliesOf = useCallback((id) => comments.filter((c) => c.respondeAId === id), [comments]);
  const selected = diagnoses.find((d) => d.id === selectedId) || diagnoses[0] || null;

  let body;
  if (loading) {
    body = <p className="qq-state"><Loader2 size={16} className="qq-spin" /> Cargando diagnósticos…</p>;
  } else if (diagnoses.length === 0) {
    body = (
      <div className="qq-empty">
        <ClipboardList size={30} />
        <strong>Aún no hay diagnósticos</strong>
        <p>Cuando un taller diagnostique tu falla, lo verás aquí para compararlo, aceptarlo y agendar.</p>
        {loadError && <p className="qq-error" role="alert"><AlertCircle size={14} /> {loadError}</p>}
      </div>
    );
  } else {
    const price = selected ? priceRange(selected.precioDesde, selected.precioHasta) : '';
    const repliesCount = selected ? repliesOf(selected.id).length : 0;
    body = (
      <div className={`qq-layout ${mobileDetail ? 'is-detail' : ''}`}>
        <aside className="qq-side" aria-label="Lista de diagnósticos">
          <div className="fom-side-head">{diagnoses.length} {diagnoses.length === 1 ? 'diagnóstico recibido' : 'diagnósticos recibidos'}</div>
          <ul className="qq-list">
            {diagnoses.map((diagnosis) => (
              <li key={diagnosis.id}>
                <button type="button" className={`qq-item ${selected?.id === diagnosis.id ? 'is-selected' : ''}`} onClick={() => { setSelectedId(diagnosis.id); setMobileDetail(true); }}>
                  <TallerAvatar className="qq-avatar" src={photoOf(diagnosis)} name={diagnosis.autor || ''} />
                  <span className="qq-item-main">
                    <span className="qq-item-top"><strong>{diagnosis.autor}</strong><small>{timeSince(diagnosis.createdAt)}</small></span>
                    <span className="qq-item-text">{priceRange(diagnosis.precioDesde, diagnosis.precioHasta) || diagnosis.texto}</span>
                  </span>
                  {diagnosis.aceptado ? <span className="fom-accepted">Aceptado</span> : <ChevronRight size={15} className="fom-chev" />}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="qq-main" aria-label="Diagnóstico seleccionado">
          {selected && (
            <>
              <button type="button" className="qq-back" onClick={() => setMobileDetail(false)}><ArrowLeft size={15} /> Volver a la lista</button>
              <article className="qq-question">
                <TallerAvatar className="qq-avatar is-lg" src={photoOf(selected)} name={selected.autor || ''} />
                <div>
                  <p className="qq-who"><strong>{selected.autor}</strong> <ProfileChip taller={selected.taller} name={selected.autor} /> <small>{formatDate(selected.createdAt)}</small></p>
                  {selected.taller && <span className="fom-sub"><TallerRating rating={selected.taller.calificacion} count={selected.taller.opiniones} />{selected.taller.comuna && <span><MapPin size={12} /> {selected.taller.comuna}</span>}</span>}
                  <p className="qq-question-text">{selected.texto}</p>
                </div>
              </article>
              <div className="fom-facts">
                <div><small>Precio estimado</small><strong><Tag size={14} /> {price || 'Sin precio estimado'}</strong></div>
                <div><small>Conversación</small><strong><MessageCircle size={14} /> {repliesCount} {repliesCount === 1 ? 'respuesta' : 'respuestas'}</strong></div>
                <div><small>Estado</small><strong className={selected.aceptado ? 'is-ok' : ''}>{selected.aceptado ? 'Aceptado' : 'Sin aceptar'}</strong></div>
              </div>
              <div className="fom-cta">
                <button type="button" onClick={() => setOpenId(selected.id)}><ClipboardList size={15} /> Ver diagnóstico completo</button>
                <p className="qq-note">{canAct ? 'Desde ahí puedes aceptarlo, responder al taller y agendar tu cita.' : 'La falla está cerrada: puedes revisarlo, pero ya no aceptar ni agendar.'}</p>
              </div>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <>
      <Shell icon={ClipboardList} label="Diagnósticos de los talleres" title={vehicle} onClose={onClose}>{body}</Shell>
      {openId != null && diagnoses.some((item) => item.id === openId) && (
        <DiagnosticoDesglose
          key={openId}
          faultId={fault.id}
          diagnosis={diagnoses.find((item) => item.id === openId)}
          replies={repliesOf(openId)}
          canAct={canAct}
          onClose={() => setOpenId(null)}
          onChanged={() => { reload(); onChanged?.(); }}
        />
      )}
    </>
  );
}
