import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Image as ImageIcon, Loader2, Lock,
  MessageSquare, Paperclip, RefreshCw, Scale, Send, ShieldAlert, X,
} from 'lucide-react';
import {
  escalateMediationApi, getMediationChatApi, resolveMediationApi,
  sendConversationMessageApi, sendMediatorMessageApi, uploadMediationEvidenceApi,
  resolveMediaUrl,
} from '../services/api';
import { MEDIATION_STATUS_LABELS, MEDIATION_STATUS_TONES } from '../data/mediationStatus';

const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024;
const MAX_REASON = 150;
const MAX_DETAIL = 500;

// Entradas automaticas que el backend deja en el hilo del mediador: no son
// mensajes de nadie, son asientos de la bitacora del caso.
const LOG_ENTRY_TYPES = new Set(['solicitud_mediador', 'evidencia', 'system', 'nota']);

/**
 * El DTO del hilo del mediador serializa con nombres distintos a los campos Java
 * (`@JsonProperty`): el texto llega como `text`, el autor como `author`, el tipo
 * como `noteType` y la fecha como `createdAt`. Se normaliza acá, con los mismos
 * respaldos que usa la app movil, para no depender de una sola forma.
 */
function normalizeMediatorEntry(entry, index) {
  return {
    id: entry.id ?? `entry-${index}`,
    author: entry.author ?? entry.remitente ?? entry.sender ?? '',
    text: entry.text ?? entry.mensaje ?? entry.message ?? '',
    type: entry.noteType ?? entry.tipo ?? entry.type ?? '',
    date: entry.createdAt ?? entry.fecha ?? entry.date ?? null,
    senderRole: entry.senderRole ?? '',
  };
}

/** Nombre de archivo de una URL, para cruzar la evidencia que llega por dos vias. */
function fileKey(url) {
  return String(url || '').split('?')[0].split('/').pop().toLowerCase();
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name) {
  return String(name || 'RT').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

/**
 * Valida tipo y peso antes de subir. El backend acepta hasta 10 MB por archivo
 * (spring.servlet.multipart.max-file-size), acá se corta en 5 MB para no
 * mandar fotos de cámara sin comprimir por una conexión móvil.
 */
function pickEvidenceFiles(incoming, currentCount, onError) {
  const files = Array.from(incoming || []);
  const accepted = [];
  for (const file of files) {
    if (currentCount + accepted.length >= MAX_EVIDENCE_FILES) {
      onError(`Solo puedes adjuntar ${MAX_EVIDENCE_FILES} imágenes por solicitud.`);
      break;
    }
    if (!file.type.startsWith('image/')) {
      onError(`"${file.name}" no es una imagen.`);
      continue;
    }
    if (file.size > MAX_EVIDENCE_SIZE) {
      onError(`"${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es 5 MB.`);
      continue;
    }
    accepted.push(file);
  }
  return accepted;
}

/** Miniaturas de lo que se va a subir: sin previsualización el usuario no sabe si el archivo entró. */
function EvidencePicker({ files, onAdd, onRemove, disabled }) {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  const full = files.length >= MAX_EVIDENCE_FILES;

  return (
    <div className="dispute-evidence-picker">
      <div className="dispute-evidence-counter">
        <span><ImageIcon size={13} /> {files.length} de {MAX_EVIDENCE_FILES} imágenes</span>
        <small>JPG o PNG · hasta 5 MB cada una</small>
      </div>

      {files.length > 0 && (
        <ul className="dispute-evidence-thumbs">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <img src={previews[index]} alt={file.name} />
              <button type="button" onClick={() => onRemove(index)} aria-label={`Quitar ${file.name}`}><X size={12} /></button>
              <small title={file.name}>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
            </li>
          ))}
        </ul>
      )}

      <label className={`dispute-evidence-drop ${disabled || full ? 'is-off' : ''}`}>
        <Paperclip size={14} />
        <span>{full ? 'Alcanzaste el máximo de imágenes' : 'Elegir imágenes desde tu equipo'}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={disabled || full}
          onChange={(event) => {
            // Array.from ANTES de limpiar el input: `event.target.files` es una
            // FileList viva y `value = ''` la deja en cero, asi que pasarla tal
            // cual hacia que el archivo elegido nunca llegara al estado.
            onAdd(Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

/** Evidencia ya guardada en el caso (la que devuelve el backend, hasta ahora invisible en la web). */
function EvidenceStrip({ title, items }) {
  if (!items.length) return null;
  return (
    <div className="dispute-evidence-strip">
      <small>{title} ({items.length})</small>
      <ul>
        {items.map((item, index) => (
          <li key={item.url || index}>
            <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.fileName || `Evidencia ${index + 1}`}>
              <img src={item.url} alt={item.fileName || `Evidencia ${index + 1}`} loading="lazy" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MediationCaseView({ pedidoId, user, mode = 'buyer', onClose, onChanged }) {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Hilo activo: con la otra parte o con el mediador de RepuesTop.
  const [activeThread, setActiveThread] = useState('parte');
  const [mediatorText, setMediatorText] = useState('');
  const [mediatorFiles, setMediatorFiles] = useState([]);
  const [mediatorError, setMediatorError] = useState('');
  const [isSendingMediator, setIsSendingMediator] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [dialog, setDialog] = useState(null); // 'escalate' | 'resolve'
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [files, setFiles] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const threadRef = useRef(null);

  // `quiet` refresca sin desmontar la vista: se usa al cambiar de solapa, al
  // volver de una accion y con el boton Actualizar.
  const load = async ({ quiet = false } = {}) => {
    if (quiet) setIsRefreshing(true); else setLoading(true);
    setLoadError('');
    try {
      const data = await getMediationChatApi(pedidoId);
      setChat(data);
      setMessages(data?.mensajes || []);
    } catch (error) {
      if (!quiet) setLoadError(error.message || 'No se pudo cargar el expediente.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, [pedidoId]);

  // El hilo arranca abajo, como cualquier chat: sin esto hay que scrollear a
  // mano para ver el último mensaje en un caso largo.
  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, loading, activeThread]);

  const estado = chat?.estadoMediacion;
  const statusTone = MEDIATION_STATUS_TONES[estado] || 'wait';
  const isClosed = chat?.chatCerrado || estado === 'RESUELTA' || estado === 'CERRADA';
  // Al escalar, el backend cierra la conversacion directa (EstadoConversacion.CERRADA)
  // y rechaza mensajes nuevos con "la conversacion directa esta pausada". Se bloquea
  // el compositor acá para no dejar escribir algo que va a fallar al enviar.
  const isPaused = Boolean(chat?.escalado) && !isClosed;
  const threadLocked = isClosed || isPaused;
  const participantName = mode === 'buyer' ? chat?.vendedorNombre : chat?.compradorNombre;
  const participantPhoto = resolveMediaUrl(mode === 'buyer' ? chat?.vendedorFotoUrl : chat?.compradorFotoUrl);
  const codigo = chat?.codigoMediacion || `PED-${pedidoId}`;

  // El backend guarda la evidencia de escalación y la de resolución en el mismo
  // campo (urlDocumento, separado por "|"); las de cada parte vienen aparte.
  const ownRole = mode === 'buyer' ? 'COMPRADOR' : 'VENDEDOR';
  const withUrl = (list) => (list || []).map((item) => ({ ...item, url: resolveMediaUrl(item.url) }));
  const myEvidence = useMemo(
    () => withUrl(mode === 'buyer' ? chat?.evidenciasComprador : chat?.evidenciasVendedor),
    [chat, mode]
  );
  const otherEvidence = useMemo(
    () => withUrl(mode === 'buyer' ? chat?.evidenciasVendedor : chat?.evidenciasComprador),
    [chat, mode]
  );

  // `evidenciasEscalacion` es el acumulado de `urlDocumento`, asi que repite los
  // archivos que ya vienen atribuidos a cada parte. Solo se listan los que no
  // estan en ninguna de las dos tiras, para no mostrar la misma foto tres veces.
  const escalationEvidence = useMemo(() => {
    const known = new Set([...myEvidence, ...otherEvidence].map((item) => fileKey(item.url)));
    return (chat?.evidenciasEscalacion || [])
      .map((url) => ({ url: resolveMediaUrl(url) }))
      .filter((item) => !known.has(fileKey(item.url)));
  }, [chat, myEvidence, otherEvidence]);

  // Cada parte ve SOLO su propio hilo con el mediador. `mensajesMediador` trae
  // los de ambas partes y no se usa acá: le mostraría al comprador lo que el
  // vendedor le escribió al mediador.
  const mediatorThread = useMemo(
    () => ((mode === 'buyer' ? chat?.mensajesMediadorComprador : chat?.mensajesMediadorVendedor) || [])
      .map(normalizeMediatorEntry),
    [chat, mode]
  );
  const mediatorClosed = Boolean(chat?.chatCerrado);

  // Si el caso deja de estar escalado (o todavía no lo está), la solapa del
  // mediador no existe: hay que volver a la conversación directa.
  useEffect(() => {
    if (!chat?.escalado && activeThread === 'mediador') setActiveThread('parte');
  }, [chat?.escalado, activeThread]);

  const openDialog = (kind) => {
    setDialog(kind);
    setReason('');
    setDetail('');
    setFiles([]);
    setFormError('');
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || !chat?.conversacion?.id || isSending) return;
    setIsSending(true);
    setSendError('');
    try {
      const sent = await sendConversationMessageApi(chat.conversacion.id, text);
      setMessages((previous) => [...previous, sent]);
      setMessageText('');
    } catch (error) {
      setSendError(error.message || 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  const submitMediatorMessage = async (event) => {
    event.preventDefault();
    const text = mediatorText.trim();
    if (!text || isSendingMediator) return;
    setIsSendingMediator(true);
    setMediatorError('');
    try {
      await sendMediatorMessageApi(pedidoId, text);
      setMediatorText('');
      // El endpoint devuelve solo el mensaje creado; el hilo que ve cada parte
      // lo arma el backend filtrando por rol, asi que se relee el expediente.
      await load({ quiet: true });
    } catch (error) {
      setMediatorError(error.message || 'No se pudo enviar el mensaje al mediador.');
    } finally {
      setIsSendingMediator(false);
    }
  };

  const submitMediatorEvidence = async () => {
    if (!mediatorFiles.length || isUploadingEvidence) return;
    setIsUploadingEvidence(true);
    setMediatorError('');
    try {
      const data = await uploadMediationEvidenceApi(pedidoId, mediatorFiles);
      setMediatorFiles([]);
      if (data?.conversacion) {
        setChat(data);
        setMessages(data?.mensajes || []);
      } else {
        await load({ quiet: true });
      }
      onChanged?.();
    } catch (error) {
      setMediatorError(error.message || 'No se pudo adjuntar la evidencia.');
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  const submitDialog = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (dialog === 'escalate' && (!reason.trim() || !detail.trim())) {
      // El backend valida ambos campos (validarTexto en MediacionChatService),
      // así que el detalle no es opcional aunque lo parezca.
      setFormError('Completa el motivo y el detalle: el mediador necesita los dos para tomar el caso.');
      return;
    }
    if (dialog === 'resolve' && !reason.trim()) {
      setFormError('Contá cómo se resolvió para dejarlo registrado en el expediente.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      if (dialog === 'escalate') {
        await escalateMediationApi(pedidoId, { motivo: reason.trim(), descripcion: detail.trim(), imagenes: files });
      } else {
        await resolveMediationApi(pedidoId, { motivoResolucion: reason.trim(), evidencias: files });
      }
      setDialog(null);
      await load();
      onChanged?.();
    } catch (error) {
      setFormError(error.message || 'No se pudo registrar la acción.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="dispute-file-loading"><Loader2 size={20} className="spin-icon" /> Abriendo expediente...</div>;
  }

  if (loadError) {
    return (
      <div className="dispute-file-loading is-error">
        <AlertTriangle size={20} /> {loadError}
        <button type="button" onClick={onClose}>Volver a mis casos</button>
      </div>
    );
  }

  return (
    <article className="dispute-file">
      <header className="dispute-file-head">
        <button type="button" className="dispute-back" onClick={onClose} title="Volver a mis casos"><ArrowLeft size={15} /> Casos</button>
        <div className="dispute-folio">
          <small>Expediente de disputa</small>
          <strong>{codigo}</strong>
        </div>
        <span className={`dispute-seal seal-${statusTone}`}>{MEDIATION_STATUS_LABELS[estado] || estado || 'En curso'}</span>
      </header>

      <dl className="dispute-meta">
        <div>
          <dt>Motivo del reclamo</dt>
          <dd>{chat?.motivo || 'No informado'}</dd>
        </div>
        <div>
          <dt>Contraparte</dt>
          <dd>{participantName || 'Sin datos'} <em>{mode === 'buyer' ? 'vendedor' : 'comprador'}</em></dd>
        </div>
        <div>
          <dt>Apertura</dt>
          <dd>{formatDate(chat?.createdAt)}</dd>
        </div>
        <div>
          <dt>Estado del pedido</dt>
          <dd>{chat?.estadoPedido ? chat.estadoPedido.replaceAll('_', ' ').toLowerCase() : '—'}</dd>
        </div>
      </dl>

      {chat?.descripcion && (
        <p className="dispute-statement"><span>Declaración inicial</span>{chat.descripcion}</p>
      )}

      {chat?.escalado && (
        <section className="dispute-record is-escalated">
          <h3><ShieldAlert size={15} /> Caso en manos de un mediador{chat?.escaladoPor ? ` · solicitado por ${chat.escaladoPor}` : ''}</h3>
          {chat?.motivoEscalacion && <p><b>Motivo:</b> {chat.motivoEscalacion}</p>}
          {chat?.descripcionEscalacion && <p>{chat.descripcionEscalacion}</p>}
          <p className="dispute-record-note">La conversación directa queda pausada mientras el mediador revisa el caso.</p>
        </section>
      )}

      {estado === 'RESUELTA' && chat?.motivoResolucion && (
        <section className="dispute-record is-resolved">
          <h3><CheckCircle2 size={15} /> Disputa cerrada de común acuerdo</h3>
          <p>{chat.motivoResolucion}</p>
        </section>
      )}

      {(escalationEvidence.length > 0 || myEvidence.length > 0 || otherEvidence.length > 0) && (
        <section className="dispute-record is-evidence">
          <h3><Paperclip size={15} /> Evidencia del expediente</h3>
          <EvidenceStrip title="Adjuntos del caso" items={escalationEvidence} />
          <EvidenceStrip title="Mis evidencias" items={myEvidence} />
          <EvidenceStrip title={`Aportada por ${mode === 'buyer' ? 'el vendedor' : 'el comprador'}`} items={otherEvidence} />
        </section>
      )}

      {!isClosed && (
        <div className="dispute-actions">
          <button type="button" className="dispute-btn" disabled={chat?.escalado} onClick={() => openDialog('escalate')}>
            <ShieldAlert size={15} /> {chat?.escalado ? 'Mediador ya solicitado' : 'Solicitar mediador'}
          </button>
          <button type="button" className="dispute-btn is-primary" onClick={() => openDialog('resolve')}>
            <CheckCircle2 size={15} /> Marcar como resuelta
          </button>
        </div>
      )}

      <section className="dispute-thread-block">
        {/* Las solapas van sobre el hilo, no sobre todo el expediente: la
            cabecera, los datos y la evidencia son comunes a las dos
            conversaciones y no tiene sentido repetirlas dentro de cada una. */}
        <div className="dispute-tabs">
          <div role="tablist" aria-label="Conversaciones del expediente">
            <button
              type="button"
              role="tab"
              aria-selected={activeThread === 'parte'}
              className={activeThread === 'parte' ? 'active' : ''}
              onClick={() => setActiveThread('parte')}
            >
              Con {mode === 'buyer' ? 'el vendedor' : 'el comprador'} <b>{messages.length}</b>
            </button>
            {chat?.escalado && (
              <button
                type="button"
                role="tab"
                aria-selected={activeThread === 'mediador'}
                className={activeThread === 'mediador' ? 'active' : ''}
                onClick={() => { setActiveThread('mediador'); void load({ quiet: true }); }}
              >
                Con el mediador <b>{mediatorThread.length}</b>
              </button>
            )}
          </div>
          <button
            type="button"
            className="dispute-refresh"
            onClick={() => load({ quiet: true })}
            disabled={isRefreshing}
            title="Volver a leer el expediente"
          >
            {isRefreshing ? <Loader2 size={13} className="spin-icon" /> : <RefreshCw size={13} />} Actualizar
          </button>
        </div>

        {activeThread === 'parte' ? (
          <>
            <header className="dispute-thread-head">
              <span className="dispute-thread-avatar">
                {participantPhoto ? <img src={participantPhoto} alt="" referrerPolicy="no-referrer" /> : initials(participantName)}
              </span>
              <div>
                <strong>{participantName || 'Otra parte'}</strong>
                <small><Lock size={11} /> Conversación privada del pedido {codigo}</small>
              </div>
            </header>

            <div className="dispute-thread" ref={threadRef}>
              {messages.length === 0 ? (
                <p className="dispute-thread-empty"><MessageSquare size={18} /> Todavía no hay mensajes en este expediente.</p>
              ) : messages.map((message) => {
                if (message.tipo === 'system') {
                  return <p key={message.id} className="dispute-system-note">{message.texto}</p>;
                }
                const mine = Number(message.emisorId) === Number(user?.userId ?? user?.id);
                return (
                  <div key={message.id} className={`dispute-msg ${mine ? 'is-mine' : ''}`}>
                    <span className="dispute-msg-author">{mine ? 'Tú' : (participantName || 'Contraparte')}</span>
                    <div className="dispute-msg-body">
                      {message.imagenUrl && <img src={resolveMediaUrl(message.imagenUrl)} alt="Adjunto del mensaje" />}
                      {message.texto && <p>{message.texto}</p>}
                    </div>
                    <time>{formatTime(message.createdAt)}</time>
                  </div>
                );
              })}
            </div>

            {threadLocked ? (
              <p className="dispute-thread-closed">
                <Lock size={14} /> {isPaused
                  ? 'La conversación directa está pausada: el caso sigue con el mediador de RepuesTop.'
                  : `Este expediente está ${String(MEDIATION_STATUS_LABELS[estado] || 'cerrado').toLowerCase()}; ya no admite mensajes.`}
              </p>
            ) : (
              <form className="dispute-composer" onSubmit={submitMessage}>
                {sendError && <span className="dispute-inline-error">{sendError}</span>}
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Escribe tu mensaje para la otra parte..."
                  maxLength={1000}
                  rows={2}
                />
                <footer>
                  <small>{messageText.length}/1000</small>
                  <button type="submit" disabled={isSending || !messageText.trim()}>
                    {isSending ? <Loader2 size={15} className="spin-icon" /> : <Send size={15} />} Enviar
                  </button>
                </footer>
              </form>
            )}
          </>
        ) : (
          <>
            <header className="dispute-thread-head">
              <span className="dispute-thread-avatar is-mediator"><Scale size={16} /></span>
              <div>
                <strong>Mediador RepuesTop</strong>
                <small><Lock size={11} /> Solo vos y el mediador ven este hilo</small>
              </div>
            </header>

            <div className="dispute-thread" ref={threadRef}>
              {mediatorThread.length === 0 ? (
                <p className="dispute-thread-empty"><MessageSquare size={18} /> El mediador todavía no registró movimientos.</p>
              ) : mediatorThread.map((entry) => {
                if (LOG_ENTRY_TYPES.has(entry.type)) {
                  return (
                    <p key={entry.id} className="dispute-log-entry">
                      <span>{formatDate(entry.date)} · {formatTime(entry.date)}</span>
                      {entry.text}
                    </p>
                  );
                }
                const mine = entry.senderRole === ownRole;
                return (
                  <div key={entry.id} className={`dispute-msg ${mine ? 'is-mine' : ''}`}>
                    <span className="dispute-msg-author">{mine ? 'Tú' : (entry.author || 'Mediador RepuesTop')}</span>
                    <div className="dispute-msg-body"><p>{entry.text}</p></div>
                    <time>{formatTime(entry.date)}</time>
                  </div>
                );
              })}
            </div>

            {mediatorClosed ? (
              <p className="dispute-thread-closed"><Lock size={14} /> El mediador cerró este hilo; ya no admite mensajes ni evidencia.</p>
            ) : (
              <form className="dispute-composer is-mediator" onSubmit={submitMediatorMessage}>
                {mediatorError && <span className="dispute-inline-error">{mediatorError}</span>}
                <textarea
                  value={mediatorText}
                  onChange={(event) => setMediatorText(event.target.value)}
                  placeholder="Escribe al mediador de RepuesTop..."
                  maxLength={1000}
                  rows={2}
                />
                <footer>
                  <small>{mediatorText.length}/1000</small>
                  <button type="submit" disabled={isSendingMediator || !mediatorText.trim()}>
                    {isSendingMediator ? <Loader2 size={15} className="spin-icon" /> : <Send size={15} />} Enviar
                  </button>
                </footer>

                {/* Adjuntar es un envío aparte del mensaje: el backend lo registra
                    como aporte de evidencia al expediente, no como archivo del chat. */}
                <div className="dispute-evidence-tray">
                  <EvidencePicker
                    files={mediatorFiles}
                    disabled={isUploadingEvidence}
                    onAdd={(incoming) => {
                      const picked = pickEvidenceFiles(incoming, mediatorFiles.length, setMediatorError);
                      if (picked.length) setMediatorFiles((current) => [...current, ...picked]);
                    }}
                    onRemove={(index) => setMediatorFiles((current) => current.filter((_, i) => i !== index))}
                  />
                  <button
                    type="button"
                    className="dispute-btn"
                    disabled={isUploadingEvidence || mediatorFiles.length === 0}
                    onClick={submitMediatorEvidence}
                  >
                    {isUploadingEvidence ? <Loader2 size={15} className="spin-icon" /> : <Paperclip size={15} />}
                    {isUploadingEvidence ? 'Subiendo...' : 'Enviar evidencia al expediente'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>

      {dialog && (
        <div className="dispute-dialog-backdrop" onClick={() => !isSubmitting && setDialog(null)}>
          <section
            className="dispute-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={dialog === 'escalate' ? 'Solicitar mediador' : 'Marcar la disputa como resuelta'}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>Expediente {codigo}</small>
                <h2>{dialog === 'escalate' ? 'Solicitar mediador' : 'Marcar como resuelta'}</h2>
              </div>
              <button type="button" aria-label="Cerrar" disabled={isSubmitting} onClick={() => setDialog(null)}><X size={16} /></button>
            </header>

            <p className="dispute-dialog-lead">
              {dialog === 'escalate'
                ? 'Un mediador de RepuesTop va a revisar el caso. Al enviarlo, la conversación directa con la otra parte queda pausada.'
                : 'Queda registrado en el expediente que llegaron a un acuerdo y el pedido pasa a entregado.'}
            </p>

            <form onSubmit={submitDialog} noValidate>
              <label className="dispute-field">
                <span>{dialog === 'escalate' ? 'Motivo' : '¿Cómo se resolvió?'}<i>{reason.length}/{MAX_REASON}</i></span>
                {dialog === 'escalate' ? (
                  <input
                    type="text"
                    value={reason}
                    maxLength={MAX_REASON}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Ej: No llegamos a un acuerdo con el vendedor"
                  />
                ) : (
                  <textarea
                    rows={3}
                    value={reason}
                    maxLength={MAX_REASON}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Ej: El vendedor reembolsó la compra"
                  />
                )}
              </label>

              {dialog === 'escalate' && (
                <label className="dispute-field">
                  <span>Detalle de lo ocurrido<i>{detail.length}/{MAX_DETAIL}</i></span>
                  <textarea
                    rows={3}
                    value={detail}
                    maxLength={MAX_DETAIL}
                    onChange={(event) => setDetail(event.target.value)}
                    placeholder="Contá qué pasó hasta ahora y qué esperás que resuelva el mediador"
                  />
                </label>
              )}

              <div className="dispute-field">
                <span>Evidencia {dialog === 'escalate' ? '(recomendada)' : '(opcional)'}</span>
                <EvidencePicker
                  files={files}
                  disabled={isSubmitting}
                  onAdd={(incoming) => {
                    // La validacion corre en el handler, no dentro del updater:
                    // React puede invocar el updater dos veces y duplicaria el error.
                    const picked = pickEvidenceFiles(incoming, files.length, setFormError);
                    if (picked.length) setFiles((current) => [...current, ...picked]);
                  }}
                  onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))}
                />
              </div>

              {formError && <p className="dispute-dialog-error"><AlertTriangle size={14} /> {formError}</p>}

              <footer>
                <button type="button" className="dispute-btn" disabled={isSubmitting} onClick={() => setDialog(null)}>Cancelar</button>
                <button
                  type="submit"
                  className="dispute-btn is-primary"
                  disabled={isSubmitting || !reason.trim() || (dialog === 'escalate' && !detail.trim())}
                >
                  {isSubmitting ? <Loader2 size={15} className="spin-icon" /> : (dialog === 'escalate' ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />)}
                  {isSubmitting ? 'Enviando...' : (dialog === 'escalate' ? 'Solicitar mediador' : 'Marcar como resuelta')}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </article>
  );
}
