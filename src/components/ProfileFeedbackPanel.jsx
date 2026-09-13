import React, { useEffect, useState } from 'react';
import { Loader2, MessageSquare, Send, Star } from 'lucide-react';
import { createSystemFeedbackApi, getMySystemFeedbackApi } from '../services/api';

/**
 * Pestaña "Dejar feedback" del panel de perfil. Extraida de ProfileDashboard:
 * dueña de todo su propio estado (calificacion, comentario, pestana
 * nuevo/historial). Antes el boton del sidebar llamaba loadFeedbackHistory()
 * a mano al entrar; ahora el propio montaje del componente (React lo
 * desmonta/remonta al cambiar de pestana, igual que las demas piezas
 * extraidas) carga el historial una vez.
 */
export default function ProfileFeedbackPanel() {
  const [tab, setTab] = useState('nuevo');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      setHistory(await getMySystemFeedbackApi());
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'No pudimos cargar tu historial de feedback.' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSendFeedback = async (event) => {
    event.preventDefault();
    if (!rating || !text.trim() || isSending) return;
    setIsSending(true);
    setStatus(null);
    try {
      await createSystemFeedbackApi({ calificacion: rating, comentario: text.trim() });
      setRating(0);
      setText('');
      setStatus({ type: 'success', message: 'Gracias por tu feedback. Lo recibimos correctamente.' });
      await loadHistory();
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'No pudimos enviar tu feedback. Inténtalo nuevamente.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="profile-panel profile-feedback-panel" aria-labelledby="profile-feedback-title">
      <div className="profile-panel-header-row"><div><h2 id="profile-feedback-title" className="profile-panel-title"><MessageSquare size={19} /> Dejar feedback</h2><p>Tu opinión nos ayuda a mejorar RepuesTop.</p></div></div>
      <div className="profile-feedback-tabs" role="tablist" aria-label="Feedback del sistema">
        <button type="button" role="tab" aria-selected={tab === 'nuevo'} className={tab === 'nuevo' ? 'active' : ''} onClick={() => setTab('nuevo')}>Dejar comentario</button>
        <button type="button" role="tab" aria-selected={tab === 'historial'} className={tab === 'historial' ? 'active' : ''} onClick={() => setTab('historial')}>Mi historial</button>
      </div>
      {tab === 'nuevo' ? (
        <form className="profile-feedback-form" onSubmit={handleSendFeedback}>
          <fieldset className="profile-feedback-rating"><legend>¿Cómo calificarías el sistema?</legend><div>{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= rating ? 'selected' : ''} onClick={() => setRating(value)} aria-label={`${value} de 5 estrellas`}><Star size={22} fill="currentColor" /></button>)}</div></fieldset>
          <label htmlFor="profile-feedback-message">Tu comentario<textarea id="profile-feedback-message" value={text} onChange={(event) => setText(event.target.value)} placeholder="Escribe aquí tu sugerencia, comentario o problema que encontraste..." maxLength={1500} required /></label>
          <div className="profile-feedback-footer"><span>{text.length}/1500</span><button type="submit" className="btn-auth-primary" disabled={!rating || !text.trim() || isSending}>{isSending ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}{isSending ? 'Enviando...' : 'Enviar feedback'}</button></div>
        </form>
      ) : (
        <div className="profile-feedback-history">
          {isLoadingHistory ? <p> Cargando tu historial…</p> : history.length === 0 ? <p>Aún no has registrado feedback.</p> : history.map((item) => <article key={item.id}><div><span className="profile-feedback-stars">{'★'.repeat(item.calificacion)}{'☆'.repeat(5 - item.calificacion)}</span><time>{item.fechaCreacion ? new Date(item.fechaCreacion).toLocaleDateString('es-CL') : ''}</time></div><p>{item.comentario}</p></article>)}
        </div>
      )}
      {status && <p className={`profile-feedback-status ${status.type}`}>{status.message}</p>}
    </section>
  );
}
