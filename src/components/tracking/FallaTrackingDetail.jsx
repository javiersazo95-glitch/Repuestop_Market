import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TallerRating from '../talleres/TallerRating';
import { Link } from 'react-router-dom';
import { ChevronRight, CircleHelp, ClipboardList, Loader2, Tag } from 'lucide-react';
import { commentFault, getFaultComments, priceRange, timeSince } from '../../services/faultApi';
import { faultDetailPath, workshopPath } from '../../routes/paths';
import { workshopThreads } from '../../utils/trackingNews';
import DiagnosticoDesglose from './DiagnosticoDesglose';
import { TrackingCells, TrackingItem, TrackingSection, TrackingTag } from './TrackingDetail';

const formatWhen = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * Mis fallas (comprador), `FallaTrackingDetail.tsx` de la app: los diagnósticos que llegaron, del más reciente al más
 * antiguo, para abrirlos (y aceptarlos o agendar desde la falla) y las preguntas de los talleres para responderlas ahí mismo.
 */
export default function FallaTrackingDetail({ faultId, vigente, newDiagnoses, onChanged }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [replies, setReplies] = useState({});
  const [actionError, setActionError] = useState('');
  // "Ver diagnóstico" abre el mismo desglose de la app en un popup.
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const list = await getFaultComments(faultId);
      setComments(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || 'No pudimos cargar el detalle.');
    } finally {
      setLoading(false);
    }
  }, [faultId]);
  useEffect(() => { load(); }, [load]);

  const diagnoses = useMemo(
    () => comments
      .filter((comment) => comment.tipo === 'DIAGNOSTICO' && comment.respondeAId == null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [comments],
  );
  const questions = useMemo(
    () => comments.filter((comment) => comment.tipo !== 'DIAGNOSTICO' && comment.respondeAId == null && !comment.esCreador
      && !comments.some((reply) => reply.respondeAId === comment.id)),
    [comments],
  );

  const answer = async (question) => {
    const text = (replies[question.id] ?? '').trim();
    if (!text) return;
    setBusyId(question.id);
    setActionError('');
    try {
      const created = await commentFault(faultId, { texto: text, respondeAId: question.id, tipo: 'COMENTARIO' });
      setComments((current) => [...current, created]);
      setReplies((current) => ({ ...current, [question.id]: '' }));
      onChanged?.();
    } catch (err) {
      setActionError(err?.message || 'No pudimos enviar tu respuesta.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="trk-muted"><Loader2 size={16} className="spin-icon" /> Cargando…</div>;
  if (error) return <p className="trk-error" role="alert">{error}</p>;

  return (
    <>
      <TrackingSection icon={ClipboardList} title="Diagnósticos recibidos" count={diagnoses.length}>
        {diagnoses.length === 0 ? <p className="trk-muted">Aún no llegan diagnósticos.</p> : diagnoses.map((diagnosis, index) => {
          const price = priceRange(diagnosis.precioDesde, diagnosis.precioHasta);
          const replyCount = comments.filter((comment) => comment.respondeAId === diagnosis.id).length;
          return (
            <TrackingItem key={diagnosis.id} highlight={index < newDiagnoses}>
              <div className="trk-diag-top">
                <div>
                  <strong>{diagnosis.autor}</strong>
                  <small>{[diagnosis.taller?.comuna, timeSince(diagnosis.createdAt)].filter(Boolean).join(' · ')}</small>
                </div>
                {index < newDiagnoses && <TrackingTag label="Nuevo" tone="info" />}
                {diagnosis.aceptado && <TrackingTag label="Aceptado" tone="ok" />}
              </div>
              {diagnosis.taller && <TallerRating rating={diagnosis.taller.calificacion} count={diagnosis.taller.opiniones} />}
              <p>{diagnosis.texto}</p>
              <span className="trk-price"><Tag size={13} /> {price || 'Sin precio estimado'}{replyCount > 0 && ` · ${replyCount} ${replyCount === 1 ? 'respuesta' : 'respuestas'}`}</span>
              <div className="trk-actions">
                {diagnosis.taller ? <Link className="trk-link" to={workshopPath(diagnosis.taller.tallerId)}>Ver perfil del taller</Link> : <span />}
                <button type="button" className="trk-link" onClick={() => setOpenId(diagnosis.id)}>Ver diagnóstico <ChevronRight size={15} /></button>
              </div>
            </TrackingItem>
          );
        })}
      </TrackingSection>

      {questions.length > 0 && (
        <TrackingSection icon={CircleHelp} title="Preguntas por responder" count={questions.length}>
          {questions.map((question) => (
            <TrackingItem key={question.id} highlight>
              <div className="trk-head"><strong>{question.autor}</strong><time>{formatWhen(question.createdAt)}</time></div>
              <p>{question.texto}</p>
              {vigente && (
                <div className="trk-reply">
                  <textarea placeholder="Escribe tu respuesta" value={replies[question.id] ?? ''} maxLength={1500} onChange={(event) => setReplies((current) => ({ ...current, [question.id]: event.target.value }))} />
                  <button type="button" disabled={busyId != null || !(replies[question.id] ?? '').trim()} onClick={() => answer(question)}>{busyId === question.id ? 'Enviando…' : 'Responder'}</button>
                </div>
              )}
            </TrackingItem>
          ))}
        </TrackingSection>
      )}
      {actionError && <p className="trk-error" role="alert">{actionError}</p>}
      {openId != null && diagnoses.some((item) => item.id === openId) && (
        <DiagnosticoDesglose
          key={openId}
          faultId={faultId}
          diagnosis={diagnoses.find((item) => item.id === openId)}
          replies={comments.filter((comment) => comment.respondeAId === openId)}
          canAct={vigente}
          onClose={() => setOpenId(null)}
          onChanged={() => { load(); onChanged?.(); }}
        />
      )}
    </>
  );
}

/**
 * Mis fallas del taller (`DiagnosticoTrackingDetail` de la app): su diagnóstico primero (aceptado o no, precio y respuestas del
 * cliente) y, juntas en una card, sus preguntas con lo que respondió el cliente.
 */
export function DiagnosticoTrackingDetail({ faultId, myUserId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getFaultComments(faultId)
      .then((list) => { if (active) setComments(Array.isArray(list) ? list : []); })
      .catch((err) => { if (active) setError(err?.message || 'No pudimos cargar el detalle.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [faultId]);
  const threads = useMemo(() => workshopThreads(comments, myUserId), [comments, myUserId]);

  if (loading) return <div className="trk-muted"><Loader2 size={16} className="spin-icon" /> Cargando…</div>;
  if (error) return <p className="trk-error" role="alert">{error}</p>;

  const diagnoses = threads.filter(({ mine }) => mine.tipo === 'DIAGNOSTICO');
  const questions = threads.filter(({ mine }) => mine.tipo !== 'DIAGNOSTICO');
  const answered = questions.filter(({ replies }) => replies.length > 0).length;

  return (
    <>
      {diagnoses.map(({ mine, replies }) => (
        <div key={mine.id} className="trk-item is-diagnosis">
          <div className="trk-head"><strong>Tu diagnóstico</strong><TrackingTag label={mine.aceptado ? 'Aceptado' : 'Sin aceptar'} tone={mine.aceptado ? 'ok' : 'warn'} /></div>
          <p>{mine.texto}</p>
          <TrackingCells cells={[
            { label: 'Precio estimado', value: priceRange(mine.precioDesde, mine.precioHasta) || 'Sin precio', tone: 'primary' },
            { label: 'Enviado', value: formatWhen(mine.createdAt) },
            { label: 'Respuestas', value: String(replies.length), tone: replies.length > 0 ? 'ok' : undefined },
          ]} />
          {replies.map((reply) => (
            <div key={reply.id} className="trk-qa-reply"><small>{`${reply.autor} (cliente) · ${formatWhen(reply.createdAt)}`}</small><p>{reply.texto}</p></div>
          ))}
        </div>
      ))}
      {questions.length > 0 && (
        <TrackingSection icon={CircleHelp} title="Tus preguntas" count={questions.length}>
          <TrackingItem>
            <p className="trk-muted">{`${answered} de ${questions.length} ${questions.length === 1 ? 'respondida' : 'respondidas'} por el cliente`}</p>
            {questions.map(({ mine, replies }) => (
              <div key={mine.id} className="trk-qa">
                <div className="trk-head"><strong>{mine.texto}</strong><time>{formatWhen(mine.createdAt)}</time></div>
                {replies.length > 0
                  ? replies.map((reply) => <div key={reply.id} className="trk-qa-reply"><small>{`${reply.autor} (cliente) · ${formatWhen(reply.createdAt)}`}</small><p>{reply.texto}</p></div>)
                  : <p className="trk-muted">Sin respuesta todavía.</p>}
              </div>
            ))}
          </TrackingItem>
        </TrackingSection>
      )}
      <Link className="trk-link" to={faultDetailPath(faultId)}>Abrir la falla completa</Link>
    </>
  );
}
