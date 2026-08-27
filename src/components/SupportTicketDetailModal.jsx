import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from './ConfirmDialog';
import {
  X, Headphones, CheckCircle2, AlertTriangle, Send, Loader2, Lock, User, ShieldCheck
} from 'lucide-react';
import {
  getSupportTicketDetailApi,
  getSupportTicketMessagesApi,
  sendSupportTicketMessageApi,
  closeSupportTicketApi,
  markSupportTicketReadApi
} from '../services/api';

const STATUS_LABELS = {
  ABIERTO: 'Abierto',
  EN_PROCESO: 'En proceso',
  PENDIENTE_VENDEDOR: 'Pendiente de tu respuesta',
  PENDIENTE_COMPRADOR: 'Pendiente de tu respuesta',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
  CANCELADO: 'Cancelado',
};

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportTicketDetailModal({ ticketId, userId, user, onClose, onUpdated }) {
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const messagesEndRef = useRef(null);

  const loadTicketData = async () => {
    if (!ticketId || !userId) return;
    setLoading(true);
    setError('');
    try {
      const [ticketData, messagesData] = await Promise.all([
        getSupportTicketDetailApi(userId, ticketId),
        getSupportTicketMessagesApi(userId, ticketId).catch(() => []),
      ]);
      setTicket(ticketData);
      setMessages(Array.isArray(messagesData) ? messagesData : (messagesData?.content || []));
      markSupportTicketReadApi(userId, ticketId).catch(() => {});
    } catch (err) {
      setError(err?.message || 'No se pudo cargar el detalle de la consulta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicketData();
  }, [ticketId, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isClosed = ['RESUELTO', 'CERRADO', 'CANCELADO'].includes(String(ticket?.status || '').toUpperCase());

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
      onUpdated?.();
    } catch (err) {
      setActionError(err?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (isClosing || isClosed) return;
    // `window.confirm` no abre nada en un navegador embebido y devuelve `false`, con lo
    // que el boton de cerrar la consulta quedaba mudo. Se confirma con `ConfirmDialog`.
    if (!confirmClose) {
      setConfirmClose(true);
      return;
    }
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

  return createPortal(
    <div className="order-modal-backdrop" onClick={onClose}>
      <div className="order-modal-container support-ticket-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="order-modal-header">
          <div className="order-modal-title-group">
            <div className="order-modal-icon-badge">
              <Headphones size={20} />
            </div>
            <div className="order-subdialog-heading">
              <h2>{ticket?.reason || ticket?.subject || `Consulta #${ticketId}`}</h2>
              <span className="order-modal-subtitle">
                Ticket #{ticket?.externalId || ticketId} · {formatDate(ticket?.createdAt)}
              </span>
            </div>
          </div>
          <div className="order-modal-header-actions">
            {ticket && (
              <span className={`profile-ticket-status status-${String(ticket.status).toLowerCase()}`}>
                {STATUS_LABELS[ticket.status] || ticket.status}
              </span>
            )}
            <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="order-modal-body" style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '10px', color: '#64748b' }}>
              <Loader2 size={20} className="spin-icon" />
              <span>Cargando mensajes del ticket...</span>
            </div>
          ) : error ? (
            <div className="auth-alert alert-error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Initial description block */}
              {ticket?.description && (
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' }}>
                  <strong style={{ display: 'block', color: '#0f172a', marginBottom: '4px', fontSize: '12.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Descripción inicial
                  </strong>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>{ticket.description}</p>
                </div>
              )}

              {/* Messages Thread */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {messages.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px 0' }}>
                    No hay mensajes adicionales en este ticket.
                  </p>
                ) : (
                  messages.map((msg, index) => {
                    const isStaff = String(msg.autorTipo).toUpperCase() === 'SOPORTE' || String(msg.senderRole).toUpperCase() === 'SOPORTE';
                    return (
                      <div
                        key={msg.id || index}
                        style={{
                          alignSelf: isStaff ? 'flex-start' : 'flex-end',
                          maxWidth: '85%',
                          backgroundColor: isStaff ? '#f1f5f9' : '#0066ff',
                          color: isStaff ? '#1e293b' : '#ffffff',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          borderBottomLeftRadius: isStaff ? '2px' : '12px',
                          borderBottomRightRadius: isStaff ? '12px' : '2px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', fontSize: '11.5px', opacity: 0.85 }}>
                          {isStaff ? <ShieldCheck size={13} /> : <User size={13} />}
                          <strong>{msg.autorNombre || (isStaff ? 'Soporte RepuesTop' : 'Tú')}</strong>
                          <span>·</span>
                          <time>{formatTime(msg.createdAt || msg.fecha)}</time>
                        </div>
                        <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.4, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {msg.mensaje || msg.texto}
                        </p>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}

          {actionError && (
            <div className="auth-alert alert-error">
              <AlertTriangle size={15} />
              <span>{actionError}</span>
            </div>
          )}
        </div>

        {/* Footer / Reply Composer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#ffffff', borderRadius: '0 0 12px 12px' }}>
          {isClosed ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={14} /> Este ticket se encuentra cerrado.
              </span>
              <button type="button" className="btn-auth-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Escribe una respuesta para el equipo de soporte..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={isSending || loading}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                  }}
                />
                <button
                  type="submit"
                  className="btn-auth-primary"
                  disabled={isSending || !replyText.trim() || loading}
                  style={{ width: 'auto', padding: '0 16px' }}
                >
                  {isSending ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={handleCloseTicket}
                  disabled={isClosing}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 0',
                  }}
                >
                  <CheckCircle2 size={13} />
                  <span>{isClosing ? 'Cerrando...' : 'Dar por resuelta esta consulta'}</span>
                </button>
                <button type="button" className="btn-auth-secondary" onClick={onClose} style={{ padding: '6px 14px', fontSize: '13px' }}>
                  Cerrar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

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
    </div>,
    document.body
  );
}
