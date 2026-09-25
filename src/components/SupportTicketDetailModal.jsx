import React, { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import {
  ArrowLeft, Headphones, CheckCircle2, AlertTriangle, Send, Loader2, Lock, ShieldCheck,
  Monitor, Smartphone, Tag, Clock, RefreshCw, Package, Paperclip, FileText,
} from 'lucide-react';
import {
  getSupportTicketDetailApi,
  getSupportTicketMessagesApi,
  getSupportTicketAttachmentsApi,
  sendSupportTicketMessageApi,
  closeSupportTicketApi,
  markSupportTicketReadApi,
  resolveMediaUrl,
} from '../services/api';
import { formatOrderNumber } from '../data/orderIdentity';

// Solo rutas reales del proxy de archivos (carpeta/archivo). Un ticket de prueba quedó con
// `/api/v1/uploads/upload` como adjunto, que no es un archivo y se mostraría roto.
const ATTACHMENT_PATH = /\/api\/v1\/uploads\/(r2\/)?[^/?]+\/[^?]+/i;
const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp)$/i;

function attachmentName(item) {
  return item.nombreArchivo || String(item.url || '').split('?')[0].split('/').pop() || 'Archivo';
}

const STATUS_LABELS = {
  ABIERTO: 'Abierto',
  EN_PROCESO: 'En proceso',
  PENDIENTE_VENDEDOR: 'Pendiente de tu respuesta',
  PENDIENTE_COMPRADOR: 'Pendiente de tu respuesta',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
  CANCELADO: 'Cancelado',
};

// El sello reutiliza los tonos del expediente de disputa (ámbar / rojo / verde).
const STATUS_TONE = {
  ABIERTO: 'wait',
  EN_PROCESO: 'mediation',
  PENDIENTE_VENDEDOR: 'wait',
  PENDIENTE_COMPRADOR: 'wait',
  SLA_VENCIDO: 'alert',
  CANCELADO: 'alert',
  RESUELTO: 'done',
  CERRADO: 'done',
};

const PLATFORM_LABELS = { SITIO_WEB: 'Sitio web', APP_MOBILE: 'App móvil' };

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function SupportTicketDetailModal({ ticketId, userId, user, onClose, onUpdated }) {
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const threadRef = useRef(null);

  const loadTicketData = async ({ quiet = false } = {}) => {
    if (!ticketId || !userId) return;
    if (quiet) setIsRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [ticketData, messagesData, attachmentsData] = await Promise.all([
        getSupportTicketDetailApi(userId, ticketId),
        getSupportTicketMessagesApi(userId, ticketId).catch(() => []),
        getSupportTicketAttachmentsApi(userId, ticketId).catch(() => []),
      ]);
      setTicket(ticketData);
      setMessages(Array.isArray(messagesData) ? messagesData : (messagesData?.content || []));
      setAttachments((Array.isArray(attachmentsData) ? attachmentsData : [])
        .filter((item) => ATTACHMENT_PATH.test(String(item?.url || ''))));
      markSupportTicketReadApi(userId, ticketId).catch(() => {});
    } catch (err) {
      if (!quiet) setError(err?.message || 'No se pudo cargar el detalle de la consulta.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadTicketData(); }, [ticketId, userId]);

  // El hilo arranca abajo, como cualquier chat.
  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, loading]);

  const status = String(ticket?.status || '').toUpperCase();
  // O36: RESUELTO ya no sella el hilo. Soporte lo marca resuelto, pero el cliente todavía puede
  // responder (se reabre) o cerrarlo; si no hace nada, se cierra solo en `autoCloseAt`.
  const isClosed = ['CERRADO', 'CANCELADO'].includes(status);
  const isResolved = status === 'RESUELTO';
  const statusTone = STATUS_TONE[status] || 'wait';
  // El "tema" del ticket es lo que el usuario eligió en el formulario (su motivo). Se muestra
  // como título; nunca una etiqueta fija.
  const platformLabel = ticket?.platform ? (PLATFORM_LABELS[ticket.platform] || ticket.platform) : null;

  const chips = useMemo(() => {
    const list = [];
    // El tema es lo que el usuario eligió en el formulario de ayuda (su motivo real),
    // nunca una etiqueta fija.
    if (ticket?.reason) list.push({ icon: Tag, text: `Tema · ${ticket.reason}`, strong: true });
    if (ticket?.orderId) list.push({ icon: Package, text: `Pedido ${formatOrderNumber(ticket.orderId)}` });
    if (platformLabel) list.push({ icon: platformLabel === 'App móvil' ? Smartphone : Monitor, text: platformLabel });
    if (ticket?.sla) list.push({ icon: Clock, text: `Respuesta en ${String(ticket.sla).toLowerCase()}` });
    return list;
  }, [ticket?.reason, ticket?.orderId, platformLabel, ticket?.sla]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || isSending || isClosed) return;
    setIsSending(true);
    setActionError('');
    try {
      const sent = await sendSupportTicketMessageApi(userId, ticketId, {
        mensaje: text,
        autorNombre: user?.nombre || user?.userName || 'Usuario',
      });
      setMessages((prev) => [...prev, sent]);
      setReplyText('');
      // Responder un RESUELTO lo reabre: se recarga para que el sello y el aviso cambien.
      if (isResolved) loadTicketData({ quiet: true });
      onUpdated?.();
    } catch (err) {
      setActionError(err?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (isClosing || isClosed) return;
    if (!confirmClose) { setConfirmClose(true); return; }
    setIsClosing(true);
    setActionError('');
    try {
      const updated = await closeSupportTicketApi(userId, ticketId);
      setTicket(updated);
      setConfirmClose(false);
      onUpdated?.();
    } catch (err) {
      setActionError(err?.message || 'No se pudo cerrar la consulta.');
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <article className="dispute-chat support-chat">
      <header className="dispute-chat-head">
        <button type="button" className="dispute-back" onClick={onClose} title="Volver a mis casos">
          <ArrowLeft size={15} /> Casos
        </button>

        <span className="dispute-chat-peer">
          <span className="dispute-chat-avatar support-agent-avatar"><Headphones size={17} /></span>
          <span className="dispute-chat-peer-id">
            <strong>Soporte RepuesTop</strong>
            <small>Ticket #{ticket?.externalId || ticketId} · {formatDate(ticket?.createdAt || ticket?.fechaCreacion)}</small>
          </span>
        </span>

        <span className="dispute-chat-head-right">
          {ticket && (
            <span className={`dispute-seal seal-${statusTone}`}>{STATUS_LABELS[status] || ticket.status}</span>
          )}
          <button
            type="button"
            className="dispute-chat-refresh"
            onClick={() => loadTicketData({ quiet: true })}
            disabled={isRefreshing || loading}
            title="Actualizar la conversación"
            aria-label="Actualizar"
          >
            {isRefreshing ? <Loader2 size={14} className="spin-icon" /> : <RefreshCw size={14} />}
          </button>
          {ticket && !isClosed && (
            <button
              type="button"
              className="support-resolve-btn"
              onClick={handleCloseTicket}
              disabled={isClosing}
              title="Marca la consulta como resuelta y cierra el ticket"
            >
              {isClosing ? <Loader2 size={14} className="spin-icon" /> : <CheckCircle2 size={15} />}
              <span>{isClosing ? 'Cerrando…' : isResolved ? 'Cerrar consulta' : 'Marcar resuelta'}</span>
            </button>
          )}
        </span>
      </header>

      {chips.length > 0 && (
        <div className="support-chat-meta">
          {chips.map((chip, i) => {
            const ChipIcon = chip.icon;
            return (
              <span key={i} className={`support-chat-chip ${chip.strong ? 'support-chat-chip--tema' : ''}`}>
                <ChipIcon size={12} /> {chip.text}
              </span>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="dispute-file-loading">
          <Loader2 size={20} className="spin-icon" /> Cargando la conversación…
        </div>
      ) : error ? (
        <div className="dispute-file-loading is-error">
          <AlertTriangle size={20} /> {error}
          <button type="button" onClick={onClose}>Volver a mis casos</button>
        </div>
      ) : (
        <div className="dispute-chat-body">
          {attachments.length > 0 && (
            <div className="support-chat-attachments">
              <span className="support-chat-attachments-title"><Paperclip size={12} /> Archivos del caso</span>
              <div className="support-chat-attachments-list">
                {attachments.map((item) => {
                  const name = attachmentName(item);
                  const href = resolveMediaUrl(item.url);
                  const isImage = IMAGE_EXTENSION.test(name) || IMAGE_EXTENSION.test(String(item.url).split('?')[0]);
                  return (
                    <a
                      key={item.id || item.url}
                      className="support-chat-attachment"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={name}
                    >
                      {isImage
                        ? <img src={href} alt={name} loading="lazy" />
                        : <span className="support-chat-attachment-file"><FileText size={18} /></span>}
                      <span className="support-chat-attachment-name">{name}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <div className="dispute-thread" ref={threadRef}>
            {messages.length === 0 && !ticket?.supportResponse ? (
              <p className="dispute-thread-empty">
                <Headphones size={20} />
                <strong>Sin respuestas todavía</strong>
                <span>El equipo de soporte revisará tu consulta y te responderá por aquí.</span>
              </p>
            ) : (
              messages.map((msg, index) => {
                const isStaff = String(msg.autorTipo || msg.senderRole || '').toUpperCase() === 'SOPORTE';
                return (
                  <div key={msg.id || index} className={`dispute-msg ${isStaff ? '' : 'is-mine'} ${isStaff ? 'support-msg-staff' : ''}`}>
                    <span className="dispute-msg-author">
                      {isStaff ? <ShieldCheck size={11} /> : null}
                      {isStaff ? (msg.autorNombre || 'Soporte RepuesTop') : 'Tú'}
                    </span>
                    <div className="dispute-msg-body">
                      <p>{msg.mensaje || msg.texto}</p>
                    </div>
                    <time>{formatTime(msg.createdAt || msg.fecha)}</time>
                  </div>
                );
              })
            )}

            {/* Respuesta consolidada de soporte cuando no viaja como mensaje del hilo. */}
            {messages.length === 0 && ticket?.supportResponse && (
              <div className="dispute-msg support-msg-staff">
                <span className="dispute-msg-author"><ShieldCheck size={11} /> Soporte RepuesTop</span>
                <div className="dispute-msg-body"><p>{ticket.supportResponse}</p></div>
                <time>{formatTime(ticket.respondedAt)}</time>
              </div>
            )}
          </div>

          {actionError && (
            <p className="dispute-inline-error" style={{ margin: '0 16px 8px' }}>{actionError}</p>
          )}

          {isResolved && (
            <p className="support-resolved-note">
              <CheckCircle2 size={14} /> Soporte marcó tu consulta como resuelta. Si todavía necesitas ayuda,
              respóndenos aquí y la reabrimos.
              {ticket?.autoCloseAt ? ` Si no, se cerrará automáticamente el ${formatDate(ticket.autoCloseAt)}.` : ''}
            </p>
          )}

          {isClosed ? (
            <p className="dispute-thread-closed">
              <Lock size={14} /> Este ticket está {(STATUS_LABELS[status] || 'cerrado').toLowerCase()}
              {ticket?.closedAt ? ` desde el ${formatDate(ticket.closedAt)}` : ''}
              {ticket?.closeReason && ticket?.closedBy !== 'USUARIO' ? ` (${ticket.closeReason})` : ''}. Si el problema
              vuelve, abre una consulta nueva desde el Centro de ayuda.
            </p>
          ) : (
              <form className="dispute-composer" onSubmit={handleSendMessage}>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escribe una respuesta para el equipo de soporte…"
                  rows={2}
                  maxLength={1000}
                  disabled={isSending}
                />
                <footer>
                  <small>El equipo de soporte responde en horario hábil.</small>
                  <button type="submit" disabled={isSending || !replyText.trim()}>
                    {isSending ? <Loader2 size={15} className="spin-icon" /> : <Send size={15} />} Enviar
                  </button>
                </footer>
              </form>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmClose}
        title="¿Dar por cerrada esta consulta?"
        message="El ticket queda cerrado y no podrás seguir respondiendo en este hilo. Si el problema vuelve, tendrás que abrir una consulta nueva."
        confirmLabel="Sí, cerrar consulta"
        cancelLabel="No, seguir abierta"
        isBusy={isClosing}
        error={actionError}
        onCancel={() => { if (!isClosing) { setConfirmClose(false); setActionError(''); } }}
        onConfirm={handleCloseTicket}
      />
    </article>
  );
}
