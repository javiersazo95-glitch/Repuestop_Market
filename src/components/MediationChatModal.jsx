import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Info, Loader2, Lock, MessageSquare,
  Scale, Send, ShieldAlert, Upload, X,
} from 'lucide-react';
import RepuesTopLogo from './RepuesTopLogo';
import {
  escalateMediationApi, getMediationChatApi, resolveMediationApi,
  sendConversationMessageApi, resolveMediaUrl,
} from '../services/api';
import { MEDIATION_STATUS_LABELS } from './ProfileSupportPanel';

const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024;

function formatDate(value, withDate = false) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return withDate
    ? date.toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  return String(name || 'RT').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

/** Valida tipo/tamaño antes de subir, mismo criterio que ya usa el resto de la app (foto de perfil: máx. 5MB, solo imágenes). */
function pickEvidenceFiles(fileList, currentCount, onError) {
  const files = Array.from(fileList || []);
  const accepted = [];
  for (const file of files) {
    if (currentCount + accepted.length >= MAX_EVIDENCE_FILES) {
      onError(`Puedes adjuntar hasta ${MAX_EVIDENCE_FILES} imágenes.`);
      break;
    }
    if (!file.type.startsWith('image/')) {
      onError(`"${file.name}" no es una imagen válida.`);
      continue;
    }
    if (file.size > MAX_EVIDENCE_SIZE) {
      onError(`"${file.name}" supera los 5 MB.`);
      continue;
    }
    accepted.push(file);
  }
  return accepted;
}

function EvidencePicker({ files, onAdd, onRemove, disabled }) {
  return (
    <div className="mediation-evidence-picker">
      <div className="mediation-evidence-list">
        {files.map((file, index) => (
          <span key={`${file.name}-${index}`} className="mediation-evidence-chip">
            {file.name}
            <button type="button" onClick={() => onRemove(index)} aria-label={`Quitar ${file.name}`}><X size={12} /></button>
          </span>
        ))}
      </div>
      <label className={`mediation-evidence-upload ${disabled ? 'disabled' : ''}`}>
        <Upload size={14} />
        <span>Adjuntar evidencia (opcional, hasta {MAX_EVIDENCE_FILES} imágenes)</span>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={disabled}
          onChange={(event) => {
            onAdd(event.target.files);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

export default function MediationChatModal({ pedidoId, user, mode = 'buyer', onClose }) {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateDetail, setEscalateDetail] = useState('');
  const [escalateFiles, setEscalateFiles] = useState([]);
  const [isEscalating, setIsEscalating] = useState(false);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveReason, setResolveReason] = useState('');
  const [resolveFiles, setResolveFiles] = useState([]);
  const [isResolving, setIsResolving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await getMediationChatApi(pedidoId);
      setChat(data);
      setMessages(data?.mensajes || []);
    } catch (error) {
      setLoadError(error.message || 'No se pudo cargar la disputa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [pedidoId]);

  // Mismo bloqueo de scroll del fondo que ya usa QuoteDetailModal: sin esto,
  // la página de perfil detrás sigue siendo scrolleable con el modal abierto.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const participantName = mode === 'buyer' ? chat?.vendedorNombre : chat?.compradorNombre;
  const participantPhoto = resolveMediaUrl(mode === 'buyer' ? chat?.vendedorFotoUrl : chat?.compradorFotoUrl);
  const estado = chat?.estadoMediacion;
  const isClosed = chat?.chatCerrado || estado === 'RESUELTA' || estado === 'CERRADA';

  const submitMessage = async (event) => {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || !chat?.conversacion?.id) return;
    setIsSending(true);
    try {
      const sent = await sendConversationMessageApi(chat.conversacion.id, text);
      setMessages((previous) => [...previous, sent]);
      setMessageText('');
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo enviar el mensaje.' });
    } finally {
      setIsSending(false);
    }
  };

  const submitEscalate = async (event) => {
    event.preventDefault();
    if (!escalateReason.trim() || isEscalating) return;
    setIsEscalating(true);
    try {
      await escalateMediationApi(pedidoId, {
        motivo: escalateReason.trim(),
        descripcion: escalateDetail.trim(),
        imagenes: escalateFiles,
      });
      setEscalateOpen(false);
      setEscalateReason('');
      setEscalateDetail('');
      setEscalateFiles([]);
      setStatusMessage({ type: 'success', text: 'Se solicitó un mediador para este caso.' });
      await load();
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo solicitar el mediador.' });
    } finally {
      setIsEscalating(false);
    }
  };

  const submitResolve = async (event) => {
    event.preventDefault();
    if (!resolveReason.trim() || isResolving) return;
    setIsResolving(true);
    try {
      await resolveMediationApi(pedidoId, {
        motivoResolucion: resolveReason.trim(),
        evidencias: resolveFiles,
      });
      setResolveOpen(false);
      setResolveReason('');
      setResolveFiles([]);
      setStatusMessage({ type: 'success', text: 'La disputa se marcó como resuelta.' });
      await load();
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo resolver la disputa.' });
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="quote-workspace" role="dialog" aria-modal="true" aria-label={`Disputa del pedido ${chat?.codigoMediacion || pedidoId}`}>
      <header className="quote-ws-topbar">
        <button type="button" className="quote-ws-brand" onClick={onClose} aria-label="Volver al perfil"><RepuesTopLogo height={44} /></button>
        <div className="quote-ws-account">
          <span>{initials(user?.userName || user?.nombre)}</span>
          <div><strong>{user?.userName || user?.nombre || 'Mi cuenta'}</strong><small>{mode === 'seller' ? 'Vendedor' : 'Comprador'}</small></div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      {statusMessage && (
        <div className={`quote-ws-toast ${statusMessage.type}`}>
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)}><X size={15} /></button>
        </div>
      )}

      {loading ? (
        <div className="mediation-ws-loading"><Loader2 size={22} className="spin-icon" /> Cargando disputa...</div>
      ) : loadError ? (
        <div className="mediation-ws-loading error"><AlertTriangle size={22} /> {loadError}</div>
      ) : (
        <div className="mediation-ws-layout">
          <aside className="quote-ws-left">
            <button type="button" className="quote-ws-back" onClick={onClose}><ArrowLeft size={16} /> Volver a mis disputas</button>

            <section className="quote-ws-side-card">
              <div className="quote-ws-id">
                <span><Scale size={24} /></span>
                <div><small>Disputa</small><strong>{chat?.codigoMediacion || `#${pedidoId}`}</strong></div>
                <em>{MEDIATION_STATUS_LABELS[estado] || estado || 'En curso'}</em>
              </div>
              <div className="mediation-detail-row"><small>Motivo</small><strong>{chat?.motivo || 'No informado'}</strong></div>
              {chat?.descripcion && <div className="mediation-detail-row"><small>Descripción</small><span>{chat.descripcion}</span></div>}
              <div className="mediation-detail-row"><small>Iniciada</small><span>{formatDate(chat?.createdAt, true)}</span></div>
              {chat?.escalado && (
                <div className="mediation-escalated-banner">
                  <ShieldAlert size={16} />
                  <span>Este caso ya fue escalado a un mediador de RepuesTop{chat?.escaladoPor ? ` por ${chat.escaladoPor}` : ''}.</span>
                </div>
              )}
              {estado === 'RESUELTA' && chat?.motivoResolucion && (
                <div className="mediation-resolved-banner">
                  <CheckCircle2 size={16} />
                  <span>{chat.motivoResolucion}</span>
                </div>
              )}
            </section>

            {!isClosed && (
              <section className="quote-ws-side-card mediation-actions-card">
                <h3>Acciones</h3>
                <button type="button" className="btn-auth-secondary mediation-action-button" disabled={chat?.escalado} onClick={() => setEscalateOpen(true)}>
                  <ShieldAlert size={16} /> {chat?.escalado ? 'Ya escalado a mediador' : 'Solicitar mediador'}
                </button>
                <button type="button" className="btn-auth-primary mediation-action-button" onClick={() => setResolveOpen(true)}>
                  <CheckCircle2 size={16} /> Marcar como resuelta
                </button>
              </section>
            )}
          </aside>

          <main className="quote-ws-chat">
            <header className="quote-ws-chat-header">
              <div className="quote-ws-person">
                <span>{participantPhoto ? <img src={participantPhoto} alt={participantName} /> : initials(participantName)}</span>
                <div><strong>{participantName || 'Otra parte'}</strong><small>{mode === 'buyer' ? 'Vendedor' : 'Comprador'}</small></div>
              </div>
            </header>

            <div className="quote-ws-private">
              <Info size={19} />
              <div>
                <strong>Este chat es privado y está asociado a la disputa del pedido {chat?.codigoMediacion || `#${pedidoId}`}.</strong>
                <span>Usalo para conversar directo con la otra parte antes de escalar a un mediador.</span>
              </div>
            </div>

            <div className="quote-ws-messages">
              {messages.length === 0 ? (
                <div className="mediation-empty-messages"><MessageSquare size={22} /><span>Todavía no hay mensajes en esta disputa.</span></div>
              ) : messages.map((message) => {
                const mine = Number(message.emisorId) === Number(user?.userId ?? user?.id);
                return (
                  <div key={message.id} className={`quote-ws-message-row ${mine ? 'mine' : ''}`}>
                    <span className="quote-ws-message-avatar">{mine ? initials(user?.userName || user?.nombre) : initials(participantName)}</span>
                    <div className="quote-ws-bubble">
                      {message.imagenUrl && <img src={resolveMediaUrl(message.imagenUrl)} alt="Adjunto" />}
                      {message.texto && <p>{message.texto}</p>}
                      <small>{formatDate(message.createdAt)} {mine ? '✓✓' : ''}</small>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isClosed ? (
              <form className="quote-ws-composer" onSubmit={submitMessage}>
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Escribe tu mensaje..."
                  maxLength="1000"
                  rows="2"
                />
                <div>
                  <span><Lock size={12} /> Esta conversación se mantiene privada.</span>
                  <small>{messageText.length}/1000</small>
                  <button type="submit" disabled={isSending || !messageText.trim()}><Send size={17} /> Enviar</button>
                </div>
              </form>
            ) : (
              <div className="quote-chat-closed"><Lock size={16} /> Esta disputa ya está {MEDIATION_STATUS_LABELS[estado]?.toLowerCase() || 'cerrada'}.</div>
            )}
          </main>
        </div>
      )}

      {escalateOpen && (
        <div className="order-modal-backdrop" onClick={() => !isEscalating && setEscalateOpen(false)}>
          <section className="order-modal-container mediation-action-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="mediation-action-modal-header">
              <span><ShieldAlert size={18} /></span>
              <div><h2>Solicitar mediador</h2><p>Un mediador de RepuesTop va a revisar el caso y ayudar a resolverlo.</p></div>
              <button type="button" aria-label="Cerrar" disabled={isEscalating} onClick={() => setEscalateOpen(false)}><X size={18} /></button>
            </header>
            <form className="unified-profile-form" onSubmit={submitEscalate}>
              <div className="form-group">
                <label>Motivo</label>
                <input type="text" value={escalateReason} onChange={(event) => setEscalateReason(event.target.value)} maxLength={150} required placeholder="Ej: No llegamos a un acuerdo con el vendedor" />
              </div>
              <div className="form-group">
                <label>Detalle adicional (opcional)</label>
                <textarea rows="3" maxLength={500} value={escalateDetail} onChange={(event) => setEscalateDetail(event.target.value)} placeholder="Contanos qué pasó hasta ahora" />
              </div>
              <div className="form-group">
                <label>Evidencia</label>
                <EvidencePicker
                  files={escalateFiles}
                  disabled={isEscalating}
                  onAdd={(fileList) => setEscalateFiles((current) => [...current, ...pickEvidenceFiles(fileList, current.length, (msg) => setStatusMessage({ type: 'error', text: msg }))])}
                  onRemove={(index) => setEscalateFiles((current) => current.filter((_, i) => i !== index))}
                />
              </div>
              <div className="profile-data-form-actions">
                <button type="button" className="btn-auth-secondary" disabled={isEscalating} onClick={() => setEscalateOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-auth-primary" disabled={isEscalating || !escalateReason.trim()} style={{ width: 'auto' }}>
                  {isEscalating ? <Loader2 size={16} className="spin-icon" /> : <ShieldAlert size={16} />} {isEscalating ? 'Enviando...' : 'Solicitar mediador'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {resolveOpen && (
        <div className="order-modal-backdrop" onClick={() => !isResolving && setResolveOpen(false)}>
          <section className="order-modal-container mediation-action-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="mediation-action-modal-header">
              <span className="icon-emerald"><CheckCircle2 size={18} /></span>
              <div><h2>Marcar como resuelta</h2><p>Confirmá que llegaron a un acuerdo con la otra parte.</p></div>
              <button type="button" aria-label="Cerrar" disabled={isResolving} onClick={() => setResolveOpen(false)}><X size={18} /></button>
            </header>
            <form className="unified-profile-form" onSubmit={submitResolve}>
              <div className="form-group">
                <label>¿Cómo se resolvió?</label>
                <textarea rows="3" maxLength={500} value={resolveReason} onChange={(event) => setResolveReason(event.target.value)} required placeholder="Ej: El vendedor reembolsó la compra" />
              </div>
              <div className="form-group">
                <label>Evidencia (opcional)</label>
                <EvidencePicker
                  files={resolveFiles}
                  disabled={isResolving}
                  onAdd={(fileList) => setResolveFiles((current) => [...current, ...pickEvidenceFiles(fileList, current.length, (msg) => setStatusMessage({ type: 'error', text: msg }))])}
                  onRemove={(index) => setResolveFiles((current) => current.filter((_, i) => i !== index))}
                />
              </div>
              <div className="profile-data-form-actions">
                <button type="button" className="btn-auth-secondary" disabled={isResolving} onClick={() => setResolveOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-auth-primary" disabled={isResolving || !resolveReason.trim()} style={{ width: 'auto' }}>
                  {isResolving ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />} {isResolving ? 'Guardando...' : 'Marcar como resuelta'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
