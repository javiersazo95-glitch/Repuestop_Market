import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Download, FileText, Image as ImageIcon,
  Loader2, Lock, Maximize2, MessageSquare, Package, Paperclip, RefreshCw, Scale, Send, ShieldAlert, Store, User, Wallet, X,
} from 'lucide-react';
import {
  escalateMediationApi, getMediationChatApi, resolveMediationApi,
  sendConversationMessageApi, sendMediatorMessageApi, uploadMediationEvidenceApi,
  uploadMediationChatImageApi, resolveMediaUrl,
} from '../services/api';
import { MEDIATION_STATUS_LABELS, MEDIATION_STATUS_TONES } from '../data/mediationStatus';
import { claimReasonLabel } from '../data/claimReason';
import compressImageFile from '../utils/imageCompression';
import ChatImagePreview from './ChatImagePreview';

const MAX_EVIDENCE_FILES = 5;
const MAX_REASON = 150;
const MAX_DETAIL = 500;
// Mismos topes que el chat de cotizaciones (`ConversacionService`): son dos hilos
// equivalentes y no hay razon para que uno acepte el doble que el otro.
const MAX_CHAT_MESSAGE = 500;
const MAX_CHAT_IMAGES = 10;
const MAX_CHAT_IMAGE_SIZE = 3 * 1024 * 1024;

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

function refundStatusLabel(estado) {
  switch (String(estado || '').toUpperCase()) {
    case 'REEMBOLSADO': return 'Reembolso acreditado';
    case 'REEMBOLSO_SOLICITADO': return 'Solicitado a la pasarela (Flow)';
    case 'REEMBOLSO_RECHAZADO':
    case 'REEMBOLSO_ERROR': return 'En revisión con nuestro equipo';
    default: return 'En proceso';
  }
}

function buyerRefundSteps(chat, codigo) {
  const monto = Number(chat?.montoReembolso || 0);
  const pct = Number(chat?.porcentajeReembolso) || 100;
  const montoTxt = `$${monto.toLocaleString('es-CL')}`;
  return [
    `El reembolso del ${pct}% de tu compra en la tienda (${montoTxt}) fue solicitado a la pasarela de pagos (Flow).`,
    'Se acreditará automáticamente en el mismo medio de pago que usaste al comprar, en un plazo estimado de 5 a 10 días hábiles.',
    `Puedes seguir el estado en "Mis pedidos" → detalle del pedido ${codigo}.`,
    'Cuando el reembolso se concrete recibirás un comprobante por correo electrónico.',
  ];
}

/**
 * Disparador compacto (una fila) que abre el detalle de la resolución al centro de
 * la pantalla. Pensado para no ocupar espacio en móvil: la resolución y los pasos
 * del reembolso viven en el modal, no en el hilo.
 */
function ResolutionDetailButton({ chat, mode, onOpen }) {
  const hasRefund = mode === 'buyer' && chat?.resolucionFavor === 'COMPRADOR' && Number(chat?.montoReembolso || 0) > 0;
  if (!chat?.motivoResolucion && !hasRefund) return null;
  return (
    <button type="button" className="dispute-resolution-trigger" onClick={onOpen}>
      <span className="dispute-resolution-trigger-icon">{hasRefund ? <Wallet size={14} /> : <Scale size={14} />}</span>
      <span className="dispute-resolution-trigger-copy">
        <strong>{hasRefund ? 'Resolución y seguimiento del reembolso' : 'Ver resolución de la disputa'}</strong>
        {hasRefund && <small>{refundStatusLabel(chat?.estadoReembolso)}</small>}
      </span>
      <ChevronRight size={16} />
    </button>
  );
}

function ResolutionDetailDialog({ chat, mode, codigo, onClose }) {
  if (typeof document === 'undefined') return null;
  const hasRefund = mode === 'buyer' && chat?.resolucionFavor === 'COMPRADOR' && Number(chat?.montoReembolso || 0) > 0;
  const steps = hasRefund ? buyerRefundSteps(chat, codigo) : [];
  return createPortal(
    <div className="dispute-dialog-backdrop" onClick={onClose}>
      <section
        className="dispute-dialog dispute-claim-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Resolución de la disputa"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>Pedido {codigo}</small>
            <h2>Resolución de la disputa</h2>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="dispute-claim-dialog-body">
          {chat?.motivoResolucion && (
            <div className="dispute-claim-field">
              <span>Veredicto</span>
              <p style={{ whiteSpace: 'pre-line' }}>{chat.motivoResolucion}</p>
            </div>
          )}
          {hasRefund && (
            <div className="dispute-claim-field">
              <span>Seguimiento de tu reembolso</span>
              <span className="dispute-refund-status">{refundStatusLabel(chat?.estadoReembolso)}</span>
              <ol className="dispute-mediator-steps" style={{ marginTop: 8 }}>
                {steps.map((step, index) => (
                  <li key={index}><span>{index + 1}</span>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}


/**
 * Valida tipo, comprime la imagen (1600 px / JPEG 80%) y valida el peso final.
 * Comprimir ANTES de guardar en el estado evita subir fotos crudas de 5-8 MB a Cloudflare R2.
 */
async function pickEvidenceFiles(incoming, currentCount, onError) {
  const files = Array.from(incoming || []);
  const accepted = [];
  for (const file of files) {
    if (currentCount + accepted.length >= MAX_EVIDENCE_FILES) {
      onError(`Solo puedes adjuntar ${MAX_EVIDENCE_FILES} imágenes por solicitud.`);
      break;
    }
    if (!file.type?.startsWith('image/')) {
      onError(`"${file.name}" no es una imagen válida (JPG o PNG).`);
      continue;
    }
    const compressed = await compressImageFile(file);
    if (compressed.size > MAX_CHAT_IMAGE_SIZE) {
      onError(`"${file.name}" supera los 3 MB incluso comprimida. Prueba con otra.`);
      continue;
    }
    accepted.push(compressed);
  }
  return accepted;
}

/** Miniaturas de lo que se va a subir con estado de compresión. */
function EvidencePicker({ files, onAdd, onRemove, disabled }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  const full = files.length >= MAX_EVIDENCE_FILES;

  const handleFilesAdded = async (incoming) => {
    if (!incoming.length) return;
    setIsProcessing(true);
    try {
      await onAdd(incoming);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="dispute-evidence-picker">
      <div className="dispute-evidence-counter">
        <span><ImageIcon size={13} /> {files.length} de {MAX_EVIDENCE_FILES} imágenes</span>
        <small>{isProcessing ? 'Optimizando imágenes...' : 'JPG o PNG · hasta 3 MB comprimida'}</small>
      </div>

      {files.length > 0 && (
        <ul className="dispute-evidence-thumbs">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <img src={previews[index]} alt={file.name} />
              <button type="button" onClick={() => onRemove(index)} aria-label={`Quitar ${file.name}`}><X size={12} /></button>
              <small title={file.name}>{(file.size / 1024).toFixed(0)} KB</small>
            </li>
          ))}
        </ul>
      )}

      <label className={`dispute-evidence-drop ${disabled || full || isProcessing ? 'is-off' : ''}`}>
        {isProcessing ? <Loader2 size={14} className="spin-icon" /> : <Paperclip size={14} />}
        <span>{full ? 'Alcanzaste el máximo de imágenes' : isProcessing ? 'Comprimiendo imágenes...' : 'Elegir imágenes desde tu equipo'}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={disabled || full || isProcessing}
          onChange={(event) => {
            const selected = Array.from(event.target.files || []);
            event.target.value = '';
            void handleFilesAdded(selected);
          }}
        />
      </label>
    </div>
  );
}

/** Evidencia ya guardada en el caso. Al hacer clic abre el visor modal para ver en grande. */
function EvidenceStrip({ title, items, onOpenImage }) {
  if (!items?.length) return null;
  return (
    <div className="dispute-evidence-strip">
      <small>{title} ({items.length})</small>
      <ul>
        {items.map((item, index) => (
          <li key={item.url || index}>
            <button
              type="button"
              className="dispute-evidence-thumb-btn"
              onClick={() => onOpenImage?.(item.url)}
              title={item.fileName || `Ver evidencia ${index + 1}`}
            >
              <img src={item.url} alt={item.fileName || `Evidencia ${index + 1}`} loading="lazy" />
              <span className="dispute-evidence-zoom-hint"><Maximize2 size={12} /></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MediationCaseView({ pedidoId, user, mode: modeProp = 'buyer', onClose, onChanged }) {
  const [chat, setChat] = useState(null);
  // El rol REAL en esta disputa no se puede sacar de si el usuario tiene tienda: una tienda
  // también compra. El backend ya resolvió la otra parte y el id del comprador en
  // `chat.conversacion`, así que se compara contra eso. Sin datos aún, se usa el prop.
  const viewerUserId = String(user?.userId ?? user?.id ?? '');
  const compradorUserId = chat?.conversacion?.usuarioId != null ? String(chat.conversacion.usuarioId) : null;
  const mode = compradorUserId != null
    ? (compradorUserId === viewerUserId ? 'buyer' : 'seller')
    : modeProp;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingImagePreview, setPendingImagePreview] = useState('');
  const [viewerImage, setViewerImage] = useState(null);
  // Modal con el motivo y la descripción del reclamo (se abre desde la cabecera del chat,
  // igual que "Ver detalle del reclamo" en la app móvil).
  const [showClaimDetail, setShowClaimDetail] = useState(false);
  const [showResolutionDetail, setShowResolutionDetail] = useState(false);
  // Resumen del caso plegado dentro del hilo del mediador (motivo, evidencia).
  const [mediatorSummaryOpen, setMediatorSummaryOpen] = useState(false);

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

  const chatImages = useMemo(
    () => messages
      .filter((m) => Boolean(m.imagenUrl))
      .map((m) => ({ url: resolveMediaUrl(m.imagenUrl) })),
    [messages]
  );
  const imageCount = chatImages.length;

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

  useEffect(() => {
    if (!viewerImage) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setViewerImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerImage]);

  const estado = chat?.estadoMediacion;
  const statusTone = MEDIATION_STATUS_TONES[estado] || 'wait';
  const isClosed = chat?.chatCerrado || estado === 'RESUELTA' || estado === 'CERRADA';
  // Al escalar, el backend cierra la conversacion directa (EstadoConversacion.CERRADA)
  // y rechaza mensajes nuevos con "la conversacion directa esta pausada". Se bloquea
  // el compositor acá para no dejar escribir algo que va a fallar al enviar.
  const isPaused = Boolean(chat?.escalado) && !isClosed;
  const threadLocked = isClosed || isPaused;
  // La OTRA parte con la que se chatea. El backend ya la resolvió según quién pide el chat
  // (`conversacion.otroParticipante*`): para el comprador es la tienda, para la tienda es el
  // comprador. Nunca hay que mostrarse a uno mismo arriba.
  const participantName = chat?.conversacion?.otroParticipanteNombre
    || (mode === 'buyer' ? chat?.vendedorNombre : chat?.compradorNombre);
  const participantPhoto = resolveMediaUrl(
    chat?.conversacion?.otroParticipanteFotoUrl
    || (mode === 'buyer' ? chat?.vendedorFotoUrl : chat?.compradorFotoUrl)
  );
  const participantRoleLabel = mode === 'buyer' ? 'Tienda' : 'Comprador';
  const codigo = chat?.codigoMediacion || `PED-${pedidoId}`;
  // Resumen del pedido reclamado (lo manda el backend en el propio chat).
  const productoNombre = chat?.productoNombre || null;
  const productoFoto = resolveMediaUrl(chat?.productoFotoUrl);
  const pedidoItemsCount = Number(chat?.pedidoItemsCount || 0);
  const pedidoTotal = Number(chat?.pedidoTotal || 0);
  const formatCLP = (value) => `$${Number(value || 0).toLocaleString('es-CL')}`;

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
    const conversacionId = chat?.conversacion?.id;
    if ((!text && !pendingImage) || !conversacionId || isSending) return;
    setIsSending(true);
    setSendError('');
    try {
      if (pendingImage) {
        // Ya viene comprimida desde la seleccion (1600 px / JPEG 80).
        const enviada = await uploadMediationChatImageApi(conversacionId, pendingImage);
        setMessages((previous) => [...previous, enviada]);
        discardPendingImage();
      }
      if (text) {
        const sent = await sendConversationMessageApi(conversacionId, text);
        setMessages((previous) => [...previous, sent]);
        setMessageText('');
      }
    } catch (error) {
      setSendError(error.message || 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  // Elegir la imagen ya NO la envia: queda en espera con su miniatura. En una disputa
  // la foto es evidencia que le llega a la contraparte y no se puede deshacer, asi que
  // subirla en el mismo gesto de abrir la galeria era un accidente esperando ocurrir.
  const handleChatImageSelect = async (e) => {
    const original = e.target.files?.[0];
    e.target.value = '';
    if (!original || isSending) return;
    if (imageCount >= MAX_CHAT_IMAGES) {
      setSendError(`Esta conversación ya alcanzó el máximo de ${MAX_CHAT_IMAGES} imágenes.`);
      return;
    }
    if (!original.type?.startsWith('image/')) {
      setSendError('Solo se permiten imágenes (JPG o PNG).');
      return;
    }
    setSendError('');
    // Se comprime al SELECCIONAR y no al enviar, igual que el chat de cotizaciones: asi
    // la miniatura muestra el peso que realmente se va a subir, y una foto de celular de
    // 4 MB que queda en 300 KB no se rechaza por su tamano original.
    const file = await compressImageFile(original);
    if (file.size > MAX_CHAT_IMAGE_SIZE) {
      setSendError('La imagen supera los 3 MB incluso comprimida. Prueba con otra.');
      return;
    }
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImage(file);
    setPendingImagePreview(URL.createObjectURL(file));
  };

  const discardPendingImage = () => {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImage(null);
    setPendingImagePreview('');
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
      setFormError('Cuenta cómo se resolvió para dejarlo registrado en el expediente.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      if (dialog === 'escalate') {
        await escalateMediationApi(pedidoId, { motivo: reason.trim(), descripcion: detail.trim(), imagenes: files });
        // El chat con la otra parte queda archivado: el seguimiento pasa al hilo del
        // mediador, así que se abre esa pestaña directamente (igual que la app móvil).
        setActiveThread('mediador');
        setMediatorSummaryOpen(true);
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
    <article className="dispute-chat">
      <header className="dispute-chat-head">
        <button type="button" className="dispute-back" onClick={onClose} title="Volver a mis casos">
          <ArrowLeft size={15} /> Casos
        </button>

        <span className="dispute-chat-peer">
          <span className="dispute-chat-avatar">
            {participantPhoto
              ? <img src={participantPhoto} alt="" referrerPolicy="no-referrer" />
              : (mode === 'buyer' ? <Store size={16} /> : <User size={16} />)}
          </span>
          <span className="dispute-chat-peer-id">
            <strong>{participantName || participantRoleLabel}</strong>
            <small>{participantRoleLabel} · Pedido {codigo}</small>
          </span>
        </span>

        <span className="dispute-chat-head-right">
          <span className={`dispute-seal seal-${statusTone}`}>{MEDIATION_STATUS_LABELS[estado] || estado || 'En curso'}</span>
          <button
            type="button"
            className="dispute-chat-refresh"
            onClick={() => load({ quiet: true })}
            disabled={isRefreshing}
            title="Actualizar la conversación"
            aria-label="Actualizar"
          >
            {isRefreshing ? <Loader2 size={14} className="spin-icon" /> : <RefreshCw size={14} />}
          </button>
        </span>
      </header>

      {/* Contexto del pedido: qué se está reclamando (imagen + nombre del producto) y su
          resumen. Deja claro dentro del chat a qué pedido corresponde la disputa. */}
      <div className="dispute-order-strip">
        <span className="dispute-order-strip-thumb">
          {productoFoto
            ? <img src={productoFoto} alt="" referrerPolicy="no-referrer" />
            : <Package size={16} />}
        </span>
        <div className="dispute-order-strip-copy">
          <strong>{productoNombre || 'Repuesto del pedido'}</strong>
          <small>
            Pedido {codigo}
            {pedidoItemsCount > 1 ? ` · ${pedidoItemsCount} repuestos` : ''}
            {pedidoTotal > 0 ? ` · ${formatCLP(pedidoTotal)}` : ''}
          </small>
        </div>
        {(chat?.motivo || chat?.descripcion) && (
          <button type="button" className="dispute-claim-link" onClick={() => setShowClaimDetail(true)}>
            <FileText size={13} /> Ver detalle del reclamo
          </button>
        )}
      </div>

      {/* Solapas: solo cuando ya intervino un mediador. Antes de eso el expediente ES el
          chat directo con la otra parte, sin nada encima. */}
      {chat?.escalado && (
        <div className="dispute-chat-tabs" role="tablist" aria-label="Conversaciones del caso">
          <button
            type="button" role="tab" aria-selected={activeThread === 'parte'}
            className={activeThread === 'parte' ? 'active' : ''}
            onClick={() => setActiveThread('parte')}
          >
            <MessageSquare size={14} /> Chat con {mode === 'buyer' ? 'el vendedor' : 'el comprador'} <b>{messages.length}</b>
          </button>
          <button
            type="button" role="tab" aria-selected={activeThread === 'mediador'}
            className={`is-mediator ${activeThread === 'mediador' ? 'active' : ''}`}
            onClick={() => { setActiveThread('mediador'); void load({ quiet: true }); }}
          >
            <Scale size={14} /> Mediador RepuesTop <b>{mediatorThread.length}</b>
          </button>
        </div>
      )}

      {isClosed && (
        <div className="dispute-resolved-banner">
          <CheckCircle2 size={16} />
          <div>
            <strong>{estado === 'RESUELTA' ? 'Disputa resuelta' : 'Caso cerrado'}</strong>
            {chat?.motivoResolucion && <p className="dispute-resolved-banner-reason">{chat.motivoResolucion}</p>}
            {(chat?.motivoResolucion
              || (mode === 'buyer' && chat?.resolucionFavor === 'COMPRADOR' && Number(chat?.montoReembolso || 0) > 0)) && (
              <button type="button" className="dispute-resolved-banner-link" onClick={() => setShowResolutionDetail(true)}>
                Ver resolución completa
                {mode === 'buyer' && chat?.resolucionFavor === 'COMPRADOR' && Number(chat?.montoReembolso || 0) > 0
                  ? ' y seguimiento del reembolso' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Acciones de la disputa directa, arriba del hilo. "¿Necesitas ayuda?" abre solicitar
          mediador; al confirmarlo este chat queda archivado y pasa a ser la pestaña "Chat". */}
      {!threadLocked && (
        <div className="dispute-chat-actions">
          <button type="button" onClick={() => openDialog('escalate')}>
            <span className="dispute-chat-action-icon is-help"><Scale size={16} /></span>
            <span>¿Necesitas ayuda?</span>
          </button>
          <button type="button" onClick={() => openDialog('resolve')}>
            <span className="dispute-chat-action-icon is-resolve"><CheckCircle2 size={16} /></span>
            <span>Marcar como resuelta</span>
          </button>
        </div>
      )}

      {activeThread === 'parte' ? (
        <div className="dispute-chat-body">
          {isPaused && (
            <p className="dispute-frozen-notice">
              <Lock size={13} /> La conversación directa quedó archivada al pedir un mediador. El seguimiento sigue en la pestaña <b>Mediador RepuesTop</b>.
            </p>
          )}

          {/* Mismo layout que el hilo del mediador: guía + reclamo a la izquierda,
              chat acotado al centro, fotos a la derecha. */}
          <div className="dispute-mediator-layout">
            <aside className="dispute-mediator-rail is-guide">
              <ResolutionDetailButton chat={chat} mode={mode} onOpen={() => setShowResolutionDetail(true)} />
              <div className="dispute-rail-card">
                <h4><MessageSquare size={13} /> Chat directo</h4>
                <p>Aquí te pones de acuerdo con {mode === 'buyer' ? 'el vendedor' : 'el comprador'}. Si no llegan a una solución, puedes sumar un mediador de RepuesTop.</p>
              </div>

              <div className="dispute-rail-card">
                <h4><FileText size={13} /> El reclamo</h4>
                <dl className="dispute-summary-fields">
                  <div className="dispute-summary-field">
                    <dt>Motivo del reclamo</dt>
                    <dd>{chat?.motivo ? claimReasonLabel(chat.motivo) : 'No informado'}</dd>
                  </div>
                  <div className="dispute-summary-field">
                    <dt>Detalle de lo ocurrido</dt>
                    <dd className="is-detail">{chat?.descripcion || 'Sin detalle registrado'}</dd>
                  </div>
                </dl>
                {(chat?.motivo || chat?.descripcion) && (
                  <button type="button" className="dispute-claim-link" onClick={() => setShowClaimDetail(true)}>
                    <FileText size={13} /> Ver ficha completa
                  </button>
                )}
              </div>

              {!threadLocked && (
                <div className="dispute-rail-card">
                  <h4><CheckCircle2 size={13} /> Qué puedes hacer</h4>
                  <ol className="dispute-mediator-steps">
                    <li><span>1</span> Escríbele a la otra parte y propón cómo resolverlo.</li>
                    <li><span>2</span> Adjunta fotos con el botón <b>Foto</b> si ayudan a explicar el problema.</li>
                    <li><span>3</span> ¿Sin acuerdo? Usa <b>¿Necesitas ayuda?</b> para pedir un mediador.</li>
                  </ol>
                </div>
              )}
            </aside>

            <div className="dispute-mediator-center">
              <div className="dispute-thread" ref={threadRef}>
                {messages.length === 0 ? (
                  <p className="dispute-thread-empty">
                    <MessageSquare size={20} />
                    <strong>Todavía no hay mensajes</strong>
                    <span>Escribe abajo para contarle a {mode === 'buyer' ? 'el vendedor' : 'el comprador'} qué pasó y buscar una solución.</span>
                  </p>
                ) : messages.map((message) => {
                  if (message.tipo === 'system') {
                    return <p key={message.id} className="dispute-system-note">{message.texto}</p>;
                  }
                  const mine = Number(message.emisorId) === Number(user?.userId ?? user?.id);
                  return (
                    <div key={message.id} className={`dispute-msg ${mine ? 'is-mine' : ''}`}>
                      <span className="dispute-msg-author">{mine ? 'Tú' : (participantName || 'Contraparte')}</span>
                      <div className="dispute-msg-body">
                        {message.imagenUrl && (
                          <button
                            type="button"
                            className="quote-ws-image-open"
                            onClick={() => setViewerImage(resolveMediaUrl(message.imagenUrl))}
                            title="Ver imagen completa"
                          >
                            <img src={resolveMediaUrl(message.imagenUrl)} alt="Adjunto del mensaje" />
                            <span><Maximize2 size={15} /></span>
                          </button>
                        )}
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
                    ? 'La conversación directa está archivada: el caso sigue con el mediador de RepuesTop.'
                    : `Este caso está ${String(MEDIATION_STATUS_LABELS[estado] || 'cerrado').toLowerCase()}; ya no admite mensajes.`}
                </p>
              ) : (
                <form className="dispute-composer" onSubmit={submitMessage}>
                  <span className="dispute-composer-label"><MessageSquare size={12} /> Mensaje para {mode === 'buyer' ? 'el vendedor' : 'el comprador'}</span>
                  {sendError && <span className="dispute-inline-error">{sendError}</span>}
                  <ChatImagePreview
                    previewUrl={pendingImagePreview}
                    fileName={pendingImage?.name}
                    fileSize={pendingImage?.size}
                    hint="Se enviará al presionar Enviar"
                    onRemove={discardPendingImage}
                  />
                  <textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Escribe tu mensaje para la otra parte..."
                    maxLength={MAX_CHAT_MESSAGE}
                    rows={2}
                  />
                  <footer>
                    <label
                      className={`dispute-attach-btn ${imageCount >= MAX_CHAT_IMAGES ? 'is-disabled' : ''}`}
                      title={imageCount >= MAX_CHAT_IMAGES ? `Máximo de ${MAX_CHAT_IMAGES} fotos alcanzado` : 'Adjuntar foto al chat'}
                    >
                      <ImageIcon size={14} color="#0066ff" />
                      <span>{imageCount >= MAX_CHAT_IMAGES ? `Máx. ${MAX_CHAT_IMAGES}` : 'Foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleChatImageSelect}
                        style={{ display: 'none' }}
                        disabled={isSending || threadLocked || imageCount >= MAX_CHAT_IMAGES}
                      />
                    </label>
                    <small>{messageText.length}/{MAX_CHAT_MESSAGE}</small>
                    <button type="submit" disabled={isSending || (!messageText.trim() && !pendingImage)}>
                      {isSending ? <Loader2 size={15} className="spin-icon" /> : <Send size={15} />} Enviar
                    </button>
                  </footer>
                </form>
              )}
            </div>

            <aside className="dispute-mediator-rail is-evidence">
              <section className="dispute-mediator-evidence-panel">
                <header>
                  <span><ImageIcon size={14} /> Fotos del chat</span>
                  <small>{chatImages.length} de {MAX_CHAT_IMAGES}</small>
                </header>
                {chatImages.length > 0 ? (
                  <div className="dispute-mediator-evidence-lists">
                    <EvidenceStrip title="Compartidas en esta conversación" items={chatImages} onOpenImage={setViewerImage} />
                  </div>
                ) : (
                  <p className="dispute-mediator-evidence-empty">
                    <ImageIcon size={14} /> Todavía no hay fotos. Adjunta con el botón <b>Foto</b> del mensaje.
                  </p>
                )}
              </section>
            </aside>
          </div>
        </div>
      ) : (
        <div className="dispute-chat-body is-mediator">
          <button
            type="button"
            className="dispute-mediator-summary-toggle"
            onClick={() => setMediatorSummaryOpen((v) => !v)}
            aria-expanded={mediatorSummaryOpen}
          >
            <span className="dispute-thread-avatar is-mediator"><Scale size={15} /></span>
            <span className="dispute-mediator-summary-copy">
              <strong>Resumen de la mediación</strong>
              <small>Solo tú y el mediador ven este hilo · {MEDIATION_STATUS_LABELS[estado] || 'En mediación'}</small>
            </span>
            <ChevronDown size={16} className={`dispute-mediator-summary-chevron ${mediatorSummaryOpen ? 'is-open' : ''}`} />
          </button>

          {mediatorSummaryOpen && (
            <div className="dispute-mediator-summary">
              {(chat?.motivoEscalacion || chat?.descripcionEscalacion) ? (
                <dl className="dispute-summary-fields">
                  <div className="dispute-summary-field">
                    <dt>Motivo de la solicitud</dt>
                    <dd>{chat?.motivoEscalacion || 'No informado'}</dd>
                  </div>
                  <div className="dispute-summary-field">
                    <dt>Detalle de lo ocurrido</dt>
                    <dd className="is-detail">{chat?.descripcionEscalacion || 'Sin detalle registrado'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="dispute-record-note">Sin resumen registrado todavía.</p>
              )}
              {chat?.escaladoPor && (
                <p className="dispute-record-note">Solicitado por {chat.escaladoPor}</p>
              )}
            </div>
          )}

          {/* Tres columnas: guía a la izquierda, chat acotado al centro, evidencia
              a la derecha. En pantallas chicas se apilan en ese mismo orden. */}
          <div className="dispute-mediator-layout">
            <aside className="dispute-mediator-rail is-guide">
              <ResolutionDetailButton chat={chat} mode={mode} onOpen={() => setShowResolutionDetail(true)} />
              <div className="dispute-rail-card">
                <h4><MessageSquare size={13} /> ¿Qué es este hilo?</h4>
                <p>Es tu canal privado con el equipo de RepuesTop. La otra parte no ve lo que escribes ni lo que adjuntas aquí.</p>
              </div>
              {!mediatorClosed && (
                <div className="dispute-rail-card">
                  <h4><CheckCircle2 size={13} /> Qué tienes que hacer</h4>
                  <ol className="dispute-mediator-steps">
                    <li><span>1</span> Adjunta en el panel de evidencia las fotos que respalden tu reclamo.</li>
                    <li><span>2</span> Cuéntale al mediador qué pasó en el mensaje de abajo.</li>
                    <li><span>3</span> Espera la respuesta: el mediador revisa el caso y contesta en este hilo.</li>
                  </ol>
                </div>
              )}
              <p className="dispute-rail-tip">
                <ShieldAlert size={12} /> Cuantas más pruebas aportes, más rápido se resuelve.
              </p>
            </aside>

            <div className="dispute-mediator-center">
              <div className="dispute-thread" ref={threadRef}>
                {mediatorThread.length === 0 ? (
                  <p className="dispute-thread-empty">
                    <MessageSquare size={20} />
                    <strong>El mediador todavía no registró movimientos</strong>
                    <span>Cuéntale aquí el problema y adjunta evidencia si la tienes; un mediador de RepuesTop revisará el caso.</span>
                  </p>
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
                  <span className="dispute-composer-label"><Scale size={12} /> Mensaje para el mediador</span>
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
                </form>
              )}
            </div>

            <aside className="dispute-mediator-rail is-evidence">
              <section className="dispute-mediator-evidence-panel">
                <header>
                  <span><Paperclip size={14} /> Evidencia del expediente</span>
                  <small>
                    {myEvidence.length + otherEvidence.length + escalationEvidence.length === 0
                      ? 'Sin imágenes por ahora'
                      : `${myEvidence.length + otherEvidence.length + escalationEvidence.length} ${myEvidence.length + otherEvidence.length + escalationEvidence.length === 1 ? 'imagen' : 'imágenes'}`}
                  </small>
                </header>

                {(escalationEvidence.length > 0 || myEvidence.length > 0 || otherEvidence.length > 0) ? (
                  <div className="dispute-mediator-evidence-lists">
                    <EvidenceStrip title="Adjuntos del caso" items={escalationEvidence} onOpenImage={setViewerImage} />
                    <EvidenceStrip title="Mis evidencias" items={myEvidence} onOpenImage={setViewerImage} />
                    <EvidenceStrip title={`Aportada por ${mode === 'buyer' ? 'el vendedor' : 'el comprador'}`} items={otherEvidence} onOpenImage={setViewerImage} />
                  </div>
                ) : (
                  <p className="dispute-mediator-evidence-empty">
                    <ImageIcon size={14} /> Todavía no adjuntaste imágenes. Suma fotos del repuesto, del embalaje o de la conversación.
                  </p>
                )}

                {!mediatorClosed && (
                  <div className="dispute-mediator-evidence-add">
                    <EvidencePicker
                      files={mediatorFiles}
                      disabled={isUploadingEvidence}
                      onAdd={async (incoming) => {
                        const picked = await pickEvidenceFiles(incoming, mediatorFiles.length, setMediatorError);
                        if (picked.length) setMediatorFiles((current) => [...current, ...picked]);
                      }}
                      onRemove={(index) => setMediatorFiles((current) => current.filter((_, i) => i !== index))}
                    />
                    <button
                      type="button"
                      className="dispute-btn is-primary"
                      disabled={isUploadingEvidence || mediatorFiles.length === 0}
                      onClick={submitMediatorEvidence}
                    >
                      {isUploadingEvidence ? <Loader2 size={15} className="spin-icon" /> : <Paperclip size={15} />}
                      {isUploadingEvidence
                        ? 'Subiendo...'
                        : `Enviar ${mediatorFiles.length || ''} al expediente`.replace('  ', ' ')}
                    </button>
                    {mediatorError && <span className="dispute-inline-error">{mediatorError}</span>}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      )}

      {showResolutionDetail && (
        <ResolutionDetailDialog
          chat={chat}
          mode={mode}
          codigo={codigo}
          onClose={() => setShowResolutionDetail(false)}
        />
      )}

      {showClaimDetail && typeof document !== 'undefined' && createPortal(
        <div className="dispute-dialog-backdrop" onClick={() => setShowClaimDetail(false)}>
          <section
            className="dispute-dialog dispute-claim-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Detalle del reclamo"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>Pedido {codigo}</small>
                <h2>Detalle del reclamo</h2>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setShowClaimDetail(false)}><X size={16} /></button>
            </header>
            <div className="dispute-claim-dialog-body">
              {/* Resumen del pedido: imagen del producto + qué y cuánto se compró. */}
              <div className="dispute-claim-order">
                <span className="dispute-claim-order-thumb">
                  {productoFoto
                    ? <img src={productoFoto} alt="" referrerPolicy="no-referrer" />
                    : <Package size={20} />}
                </span>
                <div>
                  <strong>{productoNombre || 'Repuesto del pedido'}</strong>
                  <small>
                    Pedido {codigo}
                    {pedidoItemsCount > 1 ? ` · ${pedidoItemsCount} repuestos` : ''}
                  </small>
                  {pedidoTotal > 0 && <small>Total del pedido: {formatCLP(pedidoTotal)}</small>}
                </div>
              </div>

              <div className="dispute-claim-field">
                <span>Motivo del reclamo</span>
                <strong>{chat?.motivo ? claimReasonLabel(chat.motivo) : 'No informado'}</strong>
              </div>
              <div className="dispute-claim-field">
                <span>Contraparte</span>
                <strong>{participantName || 'Sin datos'} · {participantRoleLabel.toLowerCase()}</strong>
              </div>
              <div className="dispute-claim-field">
                <span>Apertura</span>
                <strong>{formatDate(chat?.createdAt)}</strong>
              </div>
              {chat?.descripcion && (
                <div className="dispute-claim-field">
                  <span>Lo que se declaró</span>
                  <p>{chat.descripcion}</p>
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}

      {dialog && typeof document !== 'undefined' && createPortal(
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
                ? 'Un mediador de RepuesTop revisará el caso. Al enviarlo, la conversación directa con la otra parte queda pausada.'
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
                    placeholder="Cuenta qué pasó hasta ahora y qué esperas que resuelva el mediador"
                  />
                </label>
              )}

              <div className="dispute-field">
                <span>Evidencia {dialog === 'escalate' ? '(recomendada)' : '(opcional)'}</span>
                <EvidencePicker
                  files={files}
                  disabled={isSubmitting}
                  onAdd={async (incoming) => {
                    // La validacion corre en el handler, no dentro del updater:
                    // React puede invocar el updater dos veces y duplicaria el error.
                    const picked = await pickEvidenceFiles(incoming, files.length, setFormError);
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
        </div>,
        document.body
      )}

      {viewerImage && typeof document !== 'undefined' && createPortal(
        <div className="quote-ws-dialog-backdrop quote-ws-image-viewer" onClick={() => setViewerImage(null)}>
          <div className="quote-ws-image-viewer-body" onClick={(event) => event.stopPropagation()}>
            <header>
              <div className="viewer-title">
                <ImageIcon size={16} />
                <span>Evidencia / Imagen adjunta</span>
              </div>
              <div className="viewer-actions">
                <a href={viewerImage} download target="_blank" rel="noreferrer" className="viewer-btn-download" title="Descargar imagen original">
                  <Download size={15} /> Descargar
                </a>
                <button type="button" onClick={() => setViewerImage(null)} className="viewer-btn-close" aria-label="Cerrar visor" title="Cerrar (Esc)">
                  <X size={18} />
                </button>
              </div>
            </header>
            <img src={viewerImage} alt="Evidencia de la disputa" />
          </div>
        </div>,
        document.body
      )}
    </article>
  );
}
