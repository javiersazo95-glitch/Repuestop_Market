import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Lock, MessageCircle, Send, X } from 'lucide-react';
import { fetchAppointmentMessages, sendAppointmentMessage } from '../../services/talleresStorage';
import { apiErrorMessage } from '../../services/walletStorage';
import { resolveMediaUrl } from '../../services/api';
import '../../styles/appointment-chat-mobile.css';

/** Avatar chico del autor (foto o inicial), como el de la burbuja de la app. */
function ChatAvatar({ name, src }) {
  return <span className="appointment-chat-avatar" aria-hidden="true">{src ? <img src={resolveMediaUrl(src)} alt="" /> : (name || 'U').slice(0, 1).toUpperCase()}</span>;
}

export default function AppointmentChatDialog({ appointment, sessionUserId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const loadMessages = useCallback(async (signal, silent = false) => {
    try {
      const next = await fetchAppointmentMessages(appointment.id, { signal });
      setMessages(next);
      setError('');
    } catch (loadError) {
      if (loadError?.name === 'AbortError') return;
      if (loadError?.status === 400 || loadError?.status === 403) setClosed(true);
      setError(apiErrorMessage(loadError, 'No pudimos cargar los mensajes.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [appointment.id]);

  useEffect(() => {
    const controller = new AbortController();
    loadMessages(controller.signal);
    const timer = setInterval(() => loadMessages(controller.signal, true), 8000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = async (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending || closed) return;
    setSending(true);
    setError('');
    try {
      const saved = await sendAppointmentMessage(appointment.id, message);
      setMessages((current) => [...current, saved]);
      setText('');
    } catch (sendError) {
      if (sendError?.status === 400 || sendError?.status === 403) setClosed(true);
      setError(apiErrorMessage(sendError, 'No pudimos enviar el mensaje.'));
    } finally {
      setSending(false);
    }
  };

  const isCustomer = String(appointment.customerUserId) === String(sessionUserId);
  const title = isCustomer
    ? (appointment.tallerName || 'Taller')
    : (appointment.customerName || 'Cliente');
  const appointmentType = appointment.fallaId
    ? `Falla: ${appointment.fallaTitle || 'Falla automotriz'}`
    : 'Cita general';
  const appointmentVehicle = [appointment.vehiclePatent, appointment.vehicleModel].filter(Boolean).join(' · ');

  return createPortal(
    <div className="appointment-chat-overlay" role="dialog" aria-modal="true" aria-label={`Chat con ${title}`}>
      <section className="appointment-chat-card">
        <header className="appointment-chat-header">
          <div>
            <MessageCircle size={20} />
            <span>
              <strong>{title}</strong>
              <small>{appointmentType} · {appointment.time}</small>
              <small>{appointmentVehicle || 'Vehículo no informado'}</small>
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar chat"><X size={18} /></button>
        </header>

        <div className="appointment-chat-messages" aria-live="polite">
          {loading ? (
            <div className="appointment-chat-state"><Loader2 className="spin-icon" size={24} /> Cargando mensajes…</div>
          ) : messages.length === 0 ? (
            <div className="appointment-chat-state"><MessageCircle size={34} /><strong>Coordina los detalles de tu cita</strong>Puedes escribir desde ahora y durante la atención.</div>
          ) : messages.map((message) => {
            const mine = String(message.autorId) === String(sessionUserId);
            const label = message.autorNombre || (mine ? 'Tú' : 'Usuario');
            return (
              <div key={message.id} className={`appointment-chat-row ${mine ? 'is-mine' : ''}`}>
                {!mine && <ChatAvatar name={label} src={message.autorFotoUrl} />}
                <div className={`appointment-chat-message ${mine ? 'is-mine' : ''}`}>
                  {!mine && <strong>{label}</strong>}
                  <p>{message.mensaje}</p>
                  <time>{message.creadoEn ? new Date(message.creadoEn).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}</time>
                </div>
                {mine && <ChatAvatar name={label} src={message.autorFotoUrl} />}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {error && <p className="appointment-chat-error">{error}</p>}
        {closed ? (
          <div className="appointment-chat-closed"><Lock size={15} /> El chat terminó junto con la cita.</div>
        ) : (
          <>
          <form className="appointment-chat-form" onSubmit={submit}>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Escribe un mensaje…"
              maxLength={2000}
              rows={2}
              aria-label="Mensaje"
            />
            <button type="submit" disabled={!text.trim() || sending} aria-label="Enviar mensaje">
              {sending ? <Loader2 className="spin-icon" size={18} /> : <Send size={18} />}
            </button>
          </form>
          <p className="appointment-chat-hint">Enter envía · Shift+Enter agrega una línea</p>
          </>
        )}
      </section>
    </div>,
    document.body
  );
}
