import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Award, BookOpen, Camera, Car, Check, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  CircleUser, Clock, CloudUpload, CreditCard, Download, FileText, Flag, Gavel, GitCommitVertical, Headphones, Hourglass,
  Image as ImageIcon, Images, Info, Loader2, Lock, MessageCircleMore, MessageSquareMore, Package, Paperclip,
  MoreHorizontal, Receipt, Send, Shield, ShieldCheck, Store, User, Users, Wallet, Wrench, X,
} from 'lucide-react';
import {
  escalateMediationApi, getMediationChatApi, requestWarrantySupportApi, resolveMediationApi,
  sendConversationMessageApi, sendMediatorMessageApi, startSellerChatApi, uploadMediationEvidenceApi,
  uploadMediationChatImageApi, resolveMediaUrl,
} from '../services/api';
import { claimReasonLabel } from '../data/claimReason';
import { profileOrderPath, profilePath, profilePurchasePath } from '../routes/paths';
import compressImageFile from '../utils/imageCompression';
import ChatImagePreview from './ChatImagePreview';
import SaleReceiptViewerModal from './SaleReceiptViewerModal';
import { buildMediationTimeline, refundStatusLabel, resolutionFavorLabel } from '../utils/mediationTimeline';
import mediatorAvatar from '../assets/mediator-profile.webp';
import { InfoSheet } from './InfoHint';

/**
 * Chat del pedido entre el comprador y la tienda, clon 1:1 de `mobile/app/mediation-chat.tsx`:
 * cabecera de 3 filas (contraparte, accesos a la compra, acciones del reclamo), pestañas
 * Chat / Mediador cuando ya intervino un mediador, burbujas y compositor fijo abajo. Los
 * estilos viven en `src/styles/mediation-chat.css` con los tokens de la app.
 *
 * El GET del chat responde 404 mientras nadie lo haya abierto: en ese caso se ofrece
 * "Iniciar conversación" (POST idempotente) en vez de una cabecera sin contraparte y un
 * compositor que no envía nada.
 */

const MAX_EVIDENCE_FILES = 5;
// Mismos topes que el chat de cotizaciones (`ConversacionService`): son dos hilos
// equivalentes y no hay razon para que uno acepte el doble que el otro.
const MAX_CHAT_MESSAGE = 500;
const MAX_CHAT_IMAGES = 10;
const MAX_CHAT_IMAGE_SIZE = 3 * 1024 * 1024;
const MAX_DETAIL = 500;
const POLL_MS = 15000;

// Entradas automaticas que el backend deja en el hilo del mediador: no son
// mensajes de nadie, son asientos de la bitacora del caso.
const LOG_ENTRY_TYPES = new Set(['solicitud_mediador', 'evidencia', 'system', 'nota']);

// Mismos motivos que la app (`mediatorReasonOptions`).
const MEDIATOR_REASONS = [
  { label: 'No hay acuerdo', value: 'no_agreement' },
  { label: 'Falta respuesta', value: 'no_response' },
  { label: 'Evidencia contradictoria', value: 'conflicting_evidence' },
  { label: 'Necesito validación técnica', value: 'technical_review' },
  { label: 'Otro', value: 'other' },
];

const RECEIVED_STATES = ['ENTREGADO', 'RECIBIDO', 'RECEIVED', 'FINALIZADO', 'FINISHED', 'EN_MEDIACION'];

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
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatMediationState(value) {
  if (value === 'RESUELTA') return 'Resuelta';
  if (value === 'CERRADA') return 'Cerrada';
  return 'En mediación';
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
 * Fila compacta que abre el detalle de la mediación (resolución, línea de tiempo y
 * seguimiento del reembolso) en un modal centrado. Aparece apenas hay mediación.
 */
function ResolutionTrigger({ chat, mode, onOpen }) {
  const hasRefund = mode === 'buyer' && chat?.resolucionFavor === 'COMPRADOR' && Number(chat?.montoReembolso || 0) > 0;
  const inProgress = chat?.estadoMediacion === 'EN_MEDIACION';
  if (!chat?.estadoMediacion && !chat?.motivoResolucion && !hasRefund) return null;
  const title = inProgress
    ? 'Ver detalle de la mediación'
    : hasRefund ? 'Resolución y seguimiento del reembolso' : 'Ver resolución de la mediación';
  const subtitle = inProgress
    ? 'En revisión del mediador · línea de tiempo del caso'
    : hasRefund ? refundStatusLabel(chat?.estadoReembolso) : 'Línea de tiempo y detalle del caso';
  return (
    <button type="button" className="mchat-resolution-trigger" onClick={onOpen} aria-label={title}>
      <span className="mchat-resolution-trigger-icon">{inProgress ? <Clock size={16} /> : hasRefund ? <Wallet size={16} /> : <CheckCircle2 size={16} />}</span>
      <span className="mchat-resolution-trigger-copy">
        <strong>{title}</strong>
        <small className={hasRefund && !inProgress ? '' : 'is-muted'}>{subtitle}</small>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}

const TIMELINE_ICONS = {
  pago: CreditCard,
  recepcion: Package,
  reclamo: Flag,
  'reclamo-resuelto': CheckCircle2,
  mediador: ShieldCheck,
  evidencias: Images,
  revision: Hourglass,
  resolucion: Award,
  reembolso: Wallet,
};

function formatTimelineDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

function MediationTimeline({ steps }) {
  return (
    <ol className="dispute-timeline">
      {steps.map((step) => {
        const Icon = TIMELINE_ICONS[step.key] || CheckCircle2;
        const date = formatTimelineDate(step.date);
        return (
          <li key={step.key} className={`dispute-timeline-step is-${step.status} tone-${step.tone}`}>
            <span className="dispute-timeline-dot" aria-hidden="true"><Icon size={14} /></span>
            <div className="dispute-timeline-body">
              <div className="dispute-timeline-title">
                <strong>{step.title}</strong>
                {step.status === 'current' && <span className="dispute-timeline-now">En curso</span>}
                {step.status === 'pending' && <span className="dispute-timeline-next">Siguiente</span>}
              </div>
              {date && <time dateTime={step.date}>{date}</time>}
              {step.detail && <p>{step.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ResolutionDetailDialog({ chat, mode, codigo, onClose }) {
  if (typeof document === 'undefined') return null;
  const isBuyer = mode === 'buyer';
  const hasRefund = isBuyer && chat?.resolucionFavor === 'COMPRADOR' && Number(chat?.montoReembolso || 0) > 0;
  const steps = hasRefund ? buyerRefundSteps(chat, codigo) : [];
  const timeline = buildMediationTimeline(chat, isBuyer, claimReasonLabel);
  const inProgress = chat?.estadoMediacion === 'EN_MEDIACION';
  const closed = chat?.estadoMediacion === 'CERRADA';
  const favor = resolutionFavorLabel(chat?.resolucionFavor, isBuyer);
  const title = inProgress ? 'Detalle de la mediación' : 'Resolución de la mediación';
  const statusLabel = inProgress ? 'En mediación' : closed ? 'Cerrada' : (chat?.estadoMediacion || chat?.reclamoResuelto) ? 'Resuelta' : null;
  return createPortal(
    <div className="dispute-dialog-backdrop" onClick={onClose}>
      <section
        className="dispute-dialog dispute-claim-dialog dispute-resolution-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>{[chat?.codigoMediacion ? `Caso ${chat.codigoMediacion}` : null, codigo ? `Pedido ${codigo}` : null].filter(Boolean).join(' · ')}</small>
            <h2>{title}</h2>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="dispute-claim-dialog-body">
          <div className="dispute-resolution-summary">
            {statusLabel && (
              <span className={`dispute-seal seal-${inProgress ? 'mediation' : 'done'}`}>{statusLabel}</span>
            )}
            {favor && <strong>{favor}</strong>}
            {chat?.resolucionOpcionLabel && <span>{chat.resolucionOpcionLabel}</span>}
            {chat?.resolucionMotivo && <small>Motivo: {chat.resolucionMotivo}</small>}
            {inProgress && (
              <small>Un mediador de RepuesTop está revisando el caso. Aquí verás cada avance y la resolución final.</small>
            )}
          </div>

          {(chat?.motivo || chat?.motivoEscalacion) && (
            <div className="dispute-resolution-facts">
              {chat?.motivo && (
                <div><span>Reclamo</span><strong>{claimReasonLabel(chat.motivo)}</strong></div>
              )}
              {chat?.motivoEscalacion && (
                <div><span>Motivo de la mediación</span><strong>{chat.motivoEscalacion}</strong></div>
              )}
            </div>
          )}

          {timeline.length > 0 && (
            <div className="dispute-claim-field">
              <span><GitCommitVertical size={12} /> Línea de tiempo del caso</span>
              <MediationTimeline steps={timeline} />
            </div>
          )}

          {chat?.motivoResolucion && (
            <div className="dispute-claim-field">
              <span>Fundamento del mediador</span>
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

/** Miniaturas de lo que se va a subir, con botón de quitar (como `evidencePreviewRow` de la app). */
function EvidencePreviews({ files, onRemove, emptyText }) {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  if (!files.length) return emptyText ? <span className="mchat-caption mchat-muted">{emptyText}</span> : null;
  return (
    <div className="mchat-evidence-row">
      {files.map((file, index) => (
        <span key={`${file.name}-${index}`} className="mchat-evidence-preview">
          <img src={previews[index]} alt={`Evidencia ${index + 1} de ${files.length}`} />
          <button type="button" className="mchat-evidence-remove" onClick={() => onRemove(index)} aria-label={`Quitar evidencia ${index + 1}`}><X size={14} /></button>
        </span>
      ))}
    </div>
  );
}

/** Cámara + galería, como los dos botones chicos del modal "Solicitar mediador" de la app. */
function AttachButtons({ disabled, onFiles, className = 'mchat-small-attach', cameraSize = 19, clipSize = 20 }) {
  const handle = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (selected.length) void onFiles(selected);
  };
  return (
    <>
      <label className={className} aria-label="Adjuntar foto desde la cámara" title="Adjuntar foto desde la cámara">
        <Camera size={cameraSize} />
        <input type="file" accept="image/*" capture="environment" disabled={disabled} onChange={handle} />
      </label>
      <label className={className} aria-label="Adjuntar foto desde la galería" title="Adjuntar foto desde la galería">
        <Paperclip size={clipSize} />
        <input type="file" accept="image/*" multiple disabled={disabled} onChange={handle} />
      </label>
    </>
  );
}

/** Evidencia ya guardada en el caso. Al hacer clic abre el visor para verla en grande. */
function EvidenceStrip({ items, onOpenImage, labelPrefix }) {
  if (!items?.length) return null;
  return (
    <div className="mchat-evidence-strip">
      {items.map((item, index) => (
        <button
          type="button"
          key={item.url || index}
          onClick={() => onOpenImage?.(item.url)}
          aria-label={`${labelPrefix} ${index + 1}`}
          title={item.fileName || `${labelPrefix} ${index + 1}`}
        >
          <img src={item.url} alt={item.fileName || `Evidencia ${index + 1}`} loading="lazy" />
        </button>
      ))}
    </div>
  );
}

/** Burbuja del chat, réplica de `components/ui/chat/ChatBubble.tsx`. */
function ChatBubble({ variant, text, senderName, senderAvatarUrl, senderRole, createdAt, imageUrl, onOpenImage }) {
  if (variant === 'system') {
    return (
      <div className="mchat-system">
        <span className="mchat-system-pill"><Info size={14} /><span>{text}</span></span>
      </div>
    );
  }
  const isMe = variant === 'me';
  const isMediator = variant === 'mediator';
  const time = formatTime(createdAt);
  return (
    <div className={`mchat-bubble-wrap is-${variant}`}>
      {!isMe && (senderName || isMediator) && (
        <div className="mchat-sender">
          {senderAvatarUrl
            ? <img src={senderAvatarUrl} alt="" referrerPolicy="no-referrer" />
            : isMediator ? <span className="mchat-mediator-badge-avatar"><ShieldCheck size={12} /></span> : null}
          {isMediator
            ? <span className="mchat-mediator-badge"><ShieldCheck size={13} /> Mediador Oficial RepuesTop</span>
            : <small>{senderName}{senderRole ? ` (${senderRole})` : ''}</small>}
        </div>
      )}
      <div className="mchat-bubble">
        {text && <p>{text}</p>}
        {imageUrl && (
          <button type="button" className="mchat-bubble-image" onClick={() => onOpenImage?.(imageUrl)} aria-label="Ampliar imagen adjunta">
            <img src={imageUrl} alt="Imagen adjunta" loading="lazy" />
          </button>
        )}
        <span className="mchat-bubble-time">
          {time}
          {isMe && <Check size={14} />}
        </span>
      </div>
    </div>
  );
}

function CaseInfoCard({ icon: Icon, label, value }) {
  return (
    <div className="mchat-case-card">
      <span className="mchat-case-card-icon"><Icon size={18} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function MediatorMessageCard({ entry, isMine, avatarUrl }) {
  const isSystem = LOG_ENTRY_TYPES.has(entry.type);
  return (
    <div className={`mchat-mediator-msg ${isMine ? 'is-mine' : ''} ${isSystem ? 'is-system' : ''}`}>
      <div className="mchat-mediator-msg-card">
        <div className="mchat-mediator-msg-head">
          <span className="mchat-mediator-msg-author">
            {!isSystem && (avatarUrl
              ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
              : isMine ? <CircleUser size={24} /> : <img src={mediatorAvatar} alt="" />)}
            <span>{isSystem ? 'RepuesTop' : (entry.author || 'Mediador')}</span>
          </span>
          <time>{formatDateTime(entry.date)}</time>
        </div>
        <p>{entry.text}</p>
      </div>
    </div>
  );
}

export default function MediationCaseView({ pedidoId, proveedorId, user, mode: modeProp = 'buyer', initialDraft = '', onClose, onChanged }) {
  const navigate = useNavigate();
  const [chat, setChat] = useState(null);
  // El rol REAL en esta disputa no se puede sacar de si el usuario tiene tienda: una tienda
  // también compra. El backend ya resolvió la otra parte y el id del comprador en
  // `chat.conversacion`, así que se compara contra eso. Sin datos aún, se usa el prop.
  const viewerUserId = String(user?.userId ?? user?.id ?? '');
  const compradorUserId = chat?.conversacion?.usuarioId != null ? String(chat.conversacion.usuarioId) : null;
  const mode = compradorUserId != null
    ? (compradorUserId === viewerUserId ? 'buyer' : 'seller')
    : modeProp;
  const isBuyer = mode === 'buyer';
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // 'missing': el GET respondió 404 porque nadie abrió aún este chat.
  const [notStarted, setNotStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [messageText, setMessageText] = useState(initialDraft);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingImagePreview, setPendingImagePreview] = useState('');
  const [viewerImage, setViewerImage] = useState(null);
  const [showVehicleReceipt, setShowVehicleReceipt] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [showResolutionDetail, setShowResolutionDetail] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [summaryOpen, setSummaryOpen] = useState(false);
  // Celular (8-oct): menú "⋯", resumen en hoja y la hoja de los avisos largos.
  const [menuOpen, setMenuOpen] = useState(false);
  const [summarySheetOpen, setSummarySheetOpen] = useState(false);
  const [infoSheet, setInfoSheet] = useState(null);
  const [mediatorText, setMediatorText] = useState('');
  const [mediatorFiles, setMediatorFiles] = useState([]);
  const [mediatorError, setMediatorError] = useState('');
  const [isSendingMediator, setIsSendingMediator] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

  const [dialog, setDialog] = useState(null); // 'escalate' | 'resolve' (O79)
  const [showMediatorLockedInfo, setShowMediatorLockedInfo] = useState(false);
  const [helpReason, setHelpReason] = useState('no_agreement');
  const [helpCustomReason, setHelpCustomReason] = useState('');
  const [detail, setDetail] = useState('');
  const [files, setFiles] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolveReason, setResolveReason] = useState('');

  // O63 (pruebas de lanzamiento, 25-sep): pedir ayuda a soporte por garantia legal.
  const [warrantyDialog, setWarrantyDialog] = useState(false);
  const [warrantyComment, setWarrantyComment] = useState('');
  const [warrantyError, setWarrantyError] = useState('');
  const [isRequestingWarranty, setIsRequestingWarranty] = useState(false);
  const [warrantyDone, setWarrantyDone] = useState(false);

  const scrollRef = useRef(null);

  const chatImages = useMemo(() => messages.filter((m) => Boolean(m.imagenUrl)), [messages]);
  const imageCount = chatImages.length;

  // `quiet` refresca sin desmontar la vista: se usa en el polling, al cambiar de pestaña y
  // al volver de una acción.
  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setLoadError('');
    try {
      const data = await getMediationChatApi(pedidoId, proveedorId);
      setChat(data);
      setMessages(data?.mensajes || []);
      setNotStarted(false);
    } catch (error) {
      if (error?.status === 404) {
        setNotStarted(true);
        setChat(null);
        setMessages([]);
      } else if (!quiet) {
        setLoadError(error.message || 'No se pudo cargar el chat.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [pedidoId, proveedorId]);

  // Como `useSmartPolling` en la app: cada 15 s mientras la pestaña está visible.
  useEffect(() => {
    if (notStarted || loadError) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load({ quiet: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [pedidoId, proveedorId, notStarted, loadError]);

  // Deep link o notificación a un chat que nadie abrió todavía: lo crea el POST (idempotente).
  const startConversation = async () => {
    if (isStarting) return;
    setIsStarting(true);
    setStartError('');
    try {
      const data = await startSellerChatApi(pedidoId, proveedorId);
      if (data?.conversacion) {
        setChat(data);
        setMessages(data?.mensajes || []);
        setNotStarted(false);
      } else {
        await load();
      }
      onChanged?.();
    } catch (error) {
      setStartError(error.message || 'No se pudo abrir el chat.');
    } finally {
      setIsStarting(false);
    }
  };

  // El hilo arranca abajo, como cualquier chat.
  useEffect(() => {
    const node = scrollRef.current;
    if (node && activeTab === 'chat') node.scrollTop = node.scrollHeight;
  }, [messages.length, loading, activeTab]);

  useEffect(() => {
    if (!viewerImage) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setViewerImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerImage]);

  const estado = chat?.estadoMediacion;
  const isEscalated = Boolean(chat?.escalado);
  const mediationResolved = estado === 'RESUELTA';
  // O79: el comprador dio el reclamo por resuelto con la tienda, sin mediador.
  const reclamoResuelto = Boolean(chat?.reclamoResuelto);
  const claimResolvedByBuyer = reclamoResuelto && !estado;
  // U8: resuelta o cerrada la mediacion, el backend ya no marca `escalado` pero la conversacion
  // sigue cerrada. Mismo criterio que la app (`isCaseClosed` / `isThreadLocked`).
  const caseClosed = Boolean(chat?.chatCerrado) || estado === 'RESUELTA' || estado === 'CERRADA' || reclamoResuelto;
  const threadLocked = isEscalated || caseClosed;
  const resolved = mediationResolved || claimResolvedByBuyer;
  const canMarkResolved = isBuyer && Boolean(chat?.puedeMarcarResuelto) && !isEscalated && !mediationResolved;
  const orderReceived = RECEIVED_STATES.includes(String(chat?.estadoPedido || '').toUpperCase());
  // O63 "modelo mixto": hasta 10 días corridos (O68) desde la recepción se pide un mediador;
  // después, y hasta 6 meses desde la entrega (garantía legal, `garantiaHasta`), el comprador
  // pide ayuda a soporte y RepuesTop coordina con la tienda.
  const warrantyUntil = chat?.garantiaHasta ? new Date(chat.garantiaHasta) : null;
  const warrantyExpired = Boolean(warrantyUntil) && Date.now() > warrantyUntil.getTime();
  const warrantyActive = Boolean(warrantyUntil) && !warrantyExpired;
  const warrantyUntilLabel = warrantyUntil
    ? warrantyUntil.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const warrantyTicketId = isBuyer ? (chat?.ticketGarantiaId ?? null) : null;
  const canRequestWarrantySupport = isBuyer && Boolean(chat?.soporteGarantiaDisponible) && !warrantyTicketId;
  const sellerWarrantyNotice = !isBuyer && Boolean(chat) && !chat?.mediadorDisponible && warrantyActive;
  const warrantyTicketPath = warrantyTicketId != null
    ? `${profilePath('consultas')}?ticket=${encodeURIComponent(String(warrantyTicketId))}`
    : null;
  const mediatorLockedMessage = warrantyExpired
    ? 'Pasaron más de 6 meses desde la entrega: terminó la garantía legal y ya no se puede pedir un mediador ni ayuda de soporte desde este caso. Puedes seguir conversando con la otra parte.'
    : orderReceived
      ? 'La ayuda del mediador se puede solicitar una vez que recibes el producto y durante los 10 días corridos siguientes. Ese plazo ya venció.'
      : 'La ayuda del mediador se puede solicitar una vez que recibes el producto. Desde ese momento tienes 10 días corridos para pedirla.';

  // La OTRA parte con la que se chatea. El backend ya la resolvió según quién pide el chat
  // (`conversacion.otroParticipante*`): para el comprador es la tienda, para la tienda es el
  // comprador. Nunca hay que mostrarse a uno mismo arriba.
  const participantName = chat?.conversacion?.otroParticipanteNombre
    || (isBuyer ? chat?.vendedorNombre : chat?.compradorNombre);
  const participantPhoto = resolveMediaUrl(
    chat?.conversacion?.otroParticipanteFotoUrl
    || (isBuyer ? chat?.vendedorFotoUrl : chat?.compradorFotoUrl)
  );
  const participantRoleLabel = isBuyer ? 'Tienda' : 'Comprador';
  const buyerAvatar = isBuyer ? (user?.userProfileUrl || resolveMediaUrl(chat?.compradorFotoUrl)) : resolveMediaUrl(chat?.compradorFotoUrl);
  const sellerAvatar = !isBuyer ? (user?.userProfileUrl || resolveMediaUrl(chat?.vendedorFotoUrl)) : resolveMediaUrl(chat?.vendedorFotoUrl);
  // El número público del pedido lo manda el backend en el propio chat; `codigoMediacion` es el
  // respaldo para expedientes antiguos.
  const codigo = chat?.codigoPedido || chat?.codigoMediacion || '';
  const orderPath = isBuyer && user?.sellerId ? profilePurchasePath(pedidoId) : profileOrderPath(pedidoId);

  // El backend guarda la evidencia de escalación y la de resolución en el mismo
  // campo (urlDocumento, separado por "|"); las de cada parte vienen aparte.
  const ownRole = isBuyer ? 'COMPRADOR' : 'VENDEDOR';
  const withUrl = (list) => (list || []).map((item) => ({ ...item, url: resolveMediaUrl(item.url) }));
  const myEvidence = useMemo(
    () => withUrl(isBuyer ? chat?.evidenciasComprador : chat?.evidenciasVendedor),
    [chat, isBuyer]
  );
  const otherEvidence = useMemo(
    () => withUrl(isBuyer ? chat?.evidenciasVendedor : chat?.evidenciasComprador),
    [chat, isBuyer]
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
  // los de ambas partes y no se usa acá.
  const mediatorThread = useMemo(
    () => ((isBuyer ? chat?.mensajesMediadorComprador : chat?.mensajesMediadorVendedor) || [])
      .map(normalizeMediatorEntry),
    [chat, isBuyer]
  );
  const mediatorClosed = Boolean(chat?.chatCerrado);
  const otherPartyName = isBuyer ? (chat?.vendedorNombre ?? 'Vendedor') : (chat?.compradorNombre ?? 'Comprador');

  // Si el caso deja de estar escalado (o todavía no lo está), la pestaña del mediador no existe.
  useEffect(() => {
    if (!isEscalated && activeTab === 'mediator') setActiveTab('chat');
  }, [isEscalated, activeTab]);

  const openDialog = (kind) => {
    setDialog(kind);
    setHelpReason('no_agreement');
    setHelpCustomReason('');
    setDetail('');
    setResolveReason('');
    setFiles([]);
    setFormError('');
  };

  const submitMessage = async (event) => {
    event?.preventDefault?.();
    const text = messageText.trim();
    const conversacionId = chat?.conversacion?.id;
    if ((!text && !pendingImage) || !conversacionId || isSending || threadLocked) return;
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

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  // Elegir la imagen ya NO la envia: queda en espera con su miniatura. En una disputa
  // la foto es evidencia que le llega a la contraparte y no se puede deshacer.
  const handleChatImageSelect = async (e) => {
    const original = e.target.files?.[0];
    e.target.value = '';
    if (!original || isSending || threadLocked) return;
    if (imageCount >= MAX_CHAT_IMAGES) {
      setSendError(`Esta conversación ya alcanzó el máximo de ${MAX_CHAT_IMAGES} imágenes.`);
      return;
    }
    if (!original.type?.startsWith('image/')) {
      setSendError('Solo se permiten imágenes (JPG o PNG).');
      return;
    }
    setSendError('');
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
    event?.preventDefault?.();
    const text = mediatorText.trim();
    if (!text || isSendingMediator || mediatorClosed) return;
    setIsSendingMediator(true);
    setMediatorError('');
    try {
      await sendMediatorMessageApi(pedidoId, text, proveedorId);
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
      const data = await uploadMediationEvidenceApi(pedidoId, mediatorFiles, proveedorId);
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

  const submitEscalate = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const motivo = helpReason === 'other' ? helpCustomReason.trim() : (MEDIATOR_REASONS.find((o) => o.value === helpReason)?.label ?? helpReason);
    if (!motivo || !detail.trim()) {
      // El backend valida ambos campos (validarTexto en MediacionChatService).
      setFormError('Completa el motivo y el detalle: el mediador necesita los dos para tomar el caso.');
      return;
    }
    const warning = 'Al enviar esta solicitud, un mediador de RepuesTop tomará el caso. La conversación directa quedará pausada y el seguimiento continuará desde el apartado Mediador.';
    if (!window.confirm(warning)) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      await escalateMediationApi(pedidoId, { motivo, descripcion: detail.trim(), imagenes: files, proveedorId });
      // El chat con la otra parte queda pausado: el seguimiento pasa al apartado Mediador.
      setActiveTab('mediator');
      setSummaryOpen(true);
      setDialog(null);
      await load();
      onChanged?.();
    } catch (error) {
      setFormError(error.message || 'No se pudo registrar la solicitud.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // O79: el comprador cierra su reclamo con la tienda. Solo pide como se resolvio; la
  // evidencia es opcional. El backend deja constancia en el chat y cierra la conversacion.
  const submitResolve = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const reason = resolveReason.trim();
    if (!reason) {
      setFormError('Cuenta brevemente cómo se resolvió: queda registrado en el expediente.');
      return;
    }
    const warning = 'Queda registrado que resolviste el reclamo con la tienda. Esta conversación se cierra y tu compra sigue su curso normal.';
    if (!window.confirm(warning)) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      await resolveMediationApi(pedidoId, { motivoResolucion: reason, evidencias: files, proveedorId });
      setDialog(null);
      await load();
      onChanged?.();
    } catch (error) {
      setFormError(error.message || 'No se pudo marcar el reclamo como resuelto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWarrantyDialog = () => {
    setWarrantyComment('');
    setWarrantyError('');
    setWarrantyDone(false);
    setWarrantyDialog(true);
  };

  const closeWarrantyDialog = () => {
    if (isRequestingWarranty) return;
    setWarrantyDialog(false);
  };

  const submitWarranty = async (event) => {
    event.preventDefault();
    if (isRequestingWarranty) return;
    setIsRequestingWarranty(true);
    setWarrantyError('');
    try {
      const data = await requestWarrantySupportApi(pedidoId, { comentario: warrantyComment.trim(), proveedorId });
      if (data?.conversacion) {
        setChat(data);
        setMessages(data?.mensajes || []);
      } else {
        await load({ quiet: true });
      }
      setWarrantyDone(true);
      onChanged?.();
    } catch (error) {
      setWarrantyError(error.message || 'No se pudo enviar tu solicitud a soporte.');
    } finally {
      setIsRequestingWarranty(false);
    }
  };

  const openImage = (url) => setViewerImage(resolveMediaUrl(url));

  if (loading) {
    return (
      <article className="mchat">
        <div className="mchat-loading"><Loader2 size={20} className="spin-icon" /> Abriendo chat...</div>
      </article>
    );
  }

  if (loadError) {
    return (
      <article className="mchat">
        <div className="mchat-missing-head">
          <button type="button" className="mchat-back" onClick={onClose} aria-label="Volver"><ArrowLeft size={22} /></button>
        </div>
        <div className="mchat-empty is-error">
          <AlertTriangle size={36} />
          <strong>No se pudo abrir el chat</strong>
          <p>{loadError}</p>
          <button type="button" className="mchat-btn-outline" onClick={() => void load()}>Reintentar</button>
        </div>
      </article>
    );
  }

  if (notStarted) {
    return (
      <article className="mchat">
        <div className="mchat-missing-head">
          <button type="button" className="mchat-back" onClick={onClose} aria-label="Volver"><ArrowLeft size={22} /></button>
        </div>
        <div className="mchat-empty mchat-missing">
          <MessageCircleMore size={36} />
          <strong>Aún no has iniciado esta conversación</strong>
          <p>
            {isBuyer
              ? 'Al iniciarla, la tienda recibirá tus mensajes y podrá responderte desde su panel.'
              : 'Al iniciarla, el comprador recibirá tus mensajes y podrá responderte desde la app.'}
          </p>
          {startError && <span className="mchat-inline-error"><AlertTriangle size={14} /> {startError}</span>}
          <button type="button" className="mchat-btn-primary" disabled={isStarting} onClick={() => void startConversation()}>
            {isStarting ? <Loader2 size={16} className="spin-icon" /> : <MessageCircleMore size={16} />}
            {isStarting ? 'Iniciando…' : 'Iniciar conversación'}
          </button>
        </div>
      </article>
    );
  }

  const showActionsRow = canMarkResolved || (chat && !isEscalated && !mediationResolved && !claimResolvedByBuyer);
  // El detalle de la mediación, con el mismo criterio que `ResolutionTrigger`.
  const hasRefundDetail = mode === 'buyer' && chat?.resolucionFavor === 'COMPRADOR' && Number(chat?.montoReembolso || 0) > 0;
  const hasDetail = Boolean(chat?.estadoMediacion || chat?.motivoResolucion || hasRefundDetail);
  const detailLabel = chat?.estadoMediacion === 'EN_MEDIACION'
    ? 'Ver detalle de la mediación'
    : hasRefundDetail ? 'Resolución y seguimiento del reembolso' : 'Ver resolución de la mediación';
  const canAskMediator = Boolean(chat) && !isEscalated && !mediationResolved && !claimResolvedByBuyer;
  // Menú "⋯" en celular: lo que en escritorio son chips y botones grandes.
  const menuItems = [
    ...(hasDetail ? [{ key: 'detalle', Icon: Clock, label: detailLabel, onPress: () => setShowResolutionDetail(true) }] : []),
    ...(isEscalated ? [{ key: 'resumen', Icon: BookOpen, label: 'Resumen de la mediación', onPress: () => { setActiveTab('mediator'); setSummarySheetOpen(true); } }] : []),
    { key: 'vehiculo', Icon: Car, label: chat?.boletaVentaDisponible ? 'Vehículo y boleta' : 'Vehículo', onPress: () => setShowVehicleReceipt(true) },
    { key: 'pedido', Icon: Receipt, label: codigo ? `Pedido ${codigo}` : 'Ver compra', onPress: () => navigate(orderPath) },
    ...(canMarkResolved ? [{ key: 'resolver', Icon: CheckCircle2, label: 'Marcar reclamo como resuelto', tone: 'success', onPress: () => openDialog('resolve') }] : []),
    ...(canAskMediator ? [{
      key: 'mediador',
      Icon: chat.mediadorDisponible ? Gavel : Lock,
      label: 'Solicitar mediador',
      hint: chat.mediadorDisponible ? '' : 'Aún no disponible: toca para ver por qué',
      tone: chat.mediadorDisponible ? '' : 'muted',
      onPress: () => (chat.mediadorDisponible ? openDialog('escalate') : setShowMediatorLockedInfo(true)),
    }] : []),
    ...(canRequestWarrantySupport ? [{ key: 'garantia', Icon: Headphones, label: 'Pedir ayuda a soporte (garantía legal)', onPress: openWarrantyDialog }] : []),
    ...(warrantyTicketPath ? [{ key: 'ticket', Icon: Headphones, label: 'Ver ticket de soporte', onPress: () => navigate(warrantyTicketPath) }] : []),
  ];
  // El resumen del caso: en escritorio se despliega en la pantalla; en celular, en una hoja.
  // Desde la hoja del resumen, la foto se abre con la hoja cerrada (no quedan dos capas).
  const openSummaryImage = (image) => { setSummarySheetOpen(false); setViewerImage(image); };
  const summaryContent = (
    <>
          <div className="mchat-case-grid">
            <CaseInfoCard icon={Wrench} label="Motivo" value={chat?.motivoEscalacion ?? 'No informado'} />
            <CaseInfoCard icon={FileText} label="Solicitud" value={chat?.descripcionEscalacion ?? 'Sin detalle registrado'} />
            <CaseInfoCard icon={Receipt} label="Pedido" value={codigo || '-'} />
            <CaseInfoCard icon={Users} label="Solicitante" value={chat?.escaladoPor ?? 'No informado'} />
          </div>

          <section className="mchat-section">
            <div className="mchat-section-title"><Images size={18} /> Mis evidencias</div>
            {myEvidence.length
              ? <EvidenceStrip items={myEvidence} onOpenImage={openSummaryImage} labelPrefix="Ampliar mi evidencia" />
              : <span className="mchat-caption mchat-muted">Aún no has enviado evidencias.</span>}
          </section>

          <section className="mchat-section">
            <div className="mchat-section-title is-muted"><Images size={18} /> Evidencias de {otherPartyName}</div>
            {otherEvidence.length
              ? <EvidenceStrip items={otherEvidence} onOpenImage={openSummaryImage} labelPrefix={`Ampliar evidencia de ${otherPartyName}`} />
              : <span className="mchat-caption mchat-muted">{otherPartyName} aún no ha enviado evidencias.</span>}
          </section>

          {escalationEvidence.length > 0 && (
            <section className="mchat-section">
              <div className="mchat-section-title"><Images size={18} /> Adjuntos del caso</div>
              <EvidenceStrip items={escalationEvidence} onOpenImage={openSummaryImage} labelPrefix="Ampliar adjunto del caso" />
            </section>
          )}
    </>
  );
  const mediatorTabs = (compact) => (
    <div className={`mchat-tabs ${compact ? 'mchat-tabs--compact mchat-mobile-only' : 'mchat-desktop-only'}`} role="tablist" aria-label="Conversaciones del caso">
      <button type="button" role="tab" aria-selected={activeTab === 'chat'} className={`mchat-tab ${activeTab === 'chat' ? 'is-active' : ''}`} onClick={() => setActiveTab('chat')}>
        <MessageCircleMore size={compact ? 15 : 18} /> Chat
      </button>
      <button type="button" role="tab" aria-selected={activeTab === 'mediator'} className={`mchat-tab is-mediator ${compact && activeTab === 'mediator' ? 'is-active' : ''}`} onClick={() => { setActiveTab('mediator'); void load({ quiet: true }); }} aria-label="Ver pestaña del mediador">
        <img src={mediatorAvatar} alt="" className="mchat-tab-avatar" /> Mediador
      </button>
    </div>
  );
  const senderRoleOf = (emisorId) => {
    const mine = String(emisorId) === viewerUserId;
    if (isBuyer) return mine ? 'BUYER' : 'SELLER';
    return mine ? 'SELLER' : 'BUYER';
  };

  return (
    <article className="mchat">
      {/* Celular: encabezado de una fila y pestañas delgadas, fijos arriba. Vehículo/boleta,
          pedido y el menú "⋯" son íconos sutiles; el chat se queda con la pantalla. */}
      <header className={`mchat-headbar mchat-mobile-only ${resolved ? 'is-resolved' : ''}`}>
        <button type="button" className="mchat-iconbtn" onClick={onClose} aria-label="Volver"><ArrowLeft size={20} /></button>
        <span className={`mchat-avatar mchat-avatar--sm ${isBuyer ? 'is-store' : 'is-buyer'}`}>
          {participantPhoto
            ? <img src={participantPhoto} alt="" referrerPolicy="no-referrer" />
            : (isBuyer ? <Store size={15} /> : <User size={15} />)}
        </span>
        <span className="mchat-headbar-copy">
          <strong>{participantName || participantRoleLabel}</strong>
          <small className={resolved ? 'is-resolved' : ''}>
            {mediationResolved
              ? 'Mediación resuelta'
              : claimResolvedByBuyer
                ? (isBuyer ? 'Reclamo resuelto con la tienda' : 'Reclamo resuelto por el comprador')
                : isEscalated ? `${participantRoleLabel} · En mediación` : participantRoleLabel}
          </small>
        </span>
        <button type="button" className="mchat-iconbtn" onClick={() => setShowVehicleReceipt(true)} aria-label={chat?.boletaVentaDisponible ? 'Ver vehículo y boleta de la compra' : 'Ver vehículo de la compra'}>
          <Car size={18} />
          {chat?.boletaVentaDisponible && <i className="mchat-iconbtn-dot" aria-hidden="true" />}
        </button>
        <button type="button" className="mchat-iconbtn" onClick={() => navigate(orderPath)} aria-label={`Ver detalles de la compra${codigo ? ` (Pedido ${codigo})` : ''}`}><Receipt size={18} /></button>
        <button type="button" className="mchat-iconbtn is-strong" onClick={() => setMenuOpen(true)} aria-label="Más opciones del caso"><MoreHorizontal size={20} /></button>
      </header>
      {isEscalated && mediatorTabs(true)}

      <div className="mchat-scroll" ref={scrollRef}>
        {/* Cabecera: fila 1 contraparte, fila 2 accesos a la compra, fila 3 acciones. */}
        <section className={`mchat-header mchat-desktop-only ${resolved ? 'is-resolved' : ''}`}>
          <div className="mchat-header-top">
            <button type="button" className="mchat-back" onClick={onClose} aria-label="Volver"><ArrowLeft size={22} /></button>
            <span className={`mchat-avatar ${isBuyer ? 'is-store' : 'is-buyer'}`}>
              {participantPhoto
                ? <img src={participantPhoto} alt={`Foto de perfil de ${participantName || participantRoleLabel}`} referrerPolicy="no-referrer" />
                : (isBuyer ? <Store size={20} /> : <User size={20} />)}
            </span>
            <div className="mchat-name-col">
              <strong className="mchat-name">{participantName || participantRoleLabel}</strong>
              {resolved ? (
                <span className="mchat-resolved-pill">
                  <CheckCircle2 size={13} />
                  {mediationResolved ? 'Mediación resuelta' : isBuyer ? 'Reclamo resuelto con la tienda' : 'Reclamo resuelto por el comprador'}
                </span>
              ) : (
                <small className="mchat-role">{participantRoleLabel}</small>
              )}
            </div>
          </div>

          <div className="mchat-header-meta">
            <button type="button" className="mchat-chip" onClick={() => setShowVehicleReceipt(true)} aria-label="Ver vehículo y boleta de la compra">
              <Car size={15} />
              <span>{chat?.boletaVentaDisponible ? 'Vehículo y boleta' : 'Vehículo'}</span>
              {chat?.boletaVentaDisponible && <i className="mchat-dot" aria-hidden="true" />}
            </button>
            <button type="button" className="mchat-chip is-order" onClick={() => navigate(orderPath)} aria-label="Ver detalles de la compra">
              <Receipt size={14} />
              <span>{codigo ? `Pedido ${codigo}` : 'Ver compra'}</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {showActionsRow && (
            <div className="mchat-header-actions">
              {canMarkResolved && (
                <button type="button" className="mchat-action is-resolve" onClick={() => openDialog('resolve')} aria-label="Marcar el reclamo como resuelto">
                  <CheckCircle2 size={14} /> MARCAR RESUELTO
                </button>
              )}
              {chat && !isEscalated && !mediationResolved && !claimResolvedByBuyer && (
                <button
                  type="button"
                  className={`mchat-action ${chat.mediadorDisponible ? '' : 'is-locked'}`}
                  aria-disabled={!chat.mediadorDisponible}
                  aria-label={chat.mediadorDisponible ? 'Solicitar mediador' : 'Solicitar mediador (bloqueado)'}
                  onClick={() => (chat.mediadorDisponible ? openDialog('escalate') : setShowMediatorLockedInfo(true))}
                >
                  {chat.mediadorDisponible ? <Gavel size={14} /> : <Lock size={14} />} SOLICITAR MEDIADOR
                </button>
              )}
            </div>
          )}
        </section>

        {isEscalated && mediatorTabs(false)}

        <div className="mchat-desktop-only mchat-notices">
        {warrantyTicketPath ? (
          <button type="button" className="mchat-notice is-link" onClick={() => navigate(warrantyTicketPath)}>
            <Headphones size={19} className="is-primary" />
            <span className="mchat-notice-copy">Soporte ya está revisando tu caso por garantía legal. Toca para ver el ticket.</span>
            <ChevronRight size={16} />
          </button>
        ) : canRequestWarrantySupport ? (
          <div className="mchat-notice">
            <Headphones size={19} className="is-primary" />
            <div className="mchat-notice-copy">
              <span>Pasó el plazo para pedir un mediador, pero tu garantía legal sigue vigente{warrantyUntilLabel ? ` hasta el ${warrantyUntilLabel}` : ''}. Soporte de RepuesTop puede ayudarte con la tienda.</span>
              <button type="button" className="mchat-btn-outline" onClick={openWarrantyDialog}>
                <Headphones size={16} /> Pedir ayuda a soporte (garantía legal)
              </button>
            </div>
          </div>
        ) : sellerWarrantyNotice ? (
          <div className="mchat-notice">
            <Shield size={19} className="is-mediation" />
            <span className="mchat-notice-copy">Pasó el plazo para pedir un mediador, pero el comprador conserva su garantía legal{warrantyUntilLabel ? ` hasta el ${warrantyUntilLabel}` : ''}. Si pide ayuda, soporte de RepuesTop podría contactarte para coordinar una solución.</span>
          </div>
        ) : null}

        {claimResolvedByBuyer && (
          <div className="mchat-notice">
            <CheckCircle2 size={19} className="is-success" />
            <span className="mchat-notice-copy">
              {isBuyer ? 'Diste por resuelto este reclamo con la tienda.' : 'El comprador dio por resuelto este reclamo.'}
              {chat?.reclamoResueltoMotivo ? ` Motivo: ${chat.reclamoResueltoMotivo}` : ''}
              {' '}La conversación quedó cerrada y la compra sigue su curso normal.
            </span>
          </div>
        )}

        </div>

        {/* Celular: cada aviso largo es una franja de una línea; el texto completo se abre al tocarla. */}
        <div className="mchat-mobile-only mchat-strips">
          {warrantyTicketPath ? (
            <button type="button" className="mchat-strip" onClick={() => navigate(warrantyTicketPath)}>
              <Headphones size={15} /><span>Soporte revisa tu caso por garantía legal</span><ChevronRight size={14} />
            </button>
          ) : canRequestWarrantySupport ? (
            <button type="button" className="mchat-strip" onClick={() => setInfoSheet({
              title: 'Garantía legal',
              paragraphs: [`Pasó el plazo para pedir un mediador, pero tu garantía legal sigue vigente${warrantyUntilLabel ? ` hasta el ${warrantyUntilLabel}` : ''}. Soporte de RepuesTop puede ayudarte con la tienda.`],
              action: { label: 'Pedir ayuda a soporte (garantía legal)', onPress: openWarrantyDialog },
            })}>
              <Headphones size={15} /><span>Tu garantía legal sigue vigente</span><ChevronRight size={14} />
            </button>
          ) : sellerWarrantyNotice ? (
            <button type="button" className="mchat-strip is-mediation" onClick={() => setInfoSheet({
              title: 'Garantía legal del comprador',
              paragraphs: [`Pasó el plazo para pedir un mediador, pero el comprador conserva su garantía legal${warrantyUntilLabel ? ` hasta el ${warrantyUntilLabel}` : ''}. Si pide ayuda, soporte de RepuesTop podría contactarte para coordinar una solución.`],
            })}>
              <Shield size={15} /><span>El comprador conserva su garantía legal</span><ChevronRight size={14} />
            </button>
          ) : null}
          {claimResolvedByBuyer && (
            <button type="button" className="mchat-strip is-success" onClick={() => setInfoSheet({
              title: 'Reclamo resuelto',
              paragraphs: [
                `${isBuyer ? 'Diste por resuelto este reclamo con la tienda.' : 'El comprador dio por resuelto este reclamo.'}${chat?.reclamoResueltoMotivo ? ` Motivo: ${chat.reclamoResueltoMotivo}` : ''}`,
                'La conversación quedó cerrada y la compra sigue su curso normal.',
              ],
            })}>
              <CheckCircle2 size={15} /><span>{isBuyer ? 'Diste por resuelto este reclamo' : 'El comprador dio por resuelto el reclamo'}</span><ChevronRight size={14} />
            </button>
          )}
          {activeTab === 'chat' && !isEscalated && String(chat?.estadoPedido || '').toUpperCase() !== 'EN_MEDIACION' && hasDetail && (
            <button type="button" className="mchat-strip" onClick={() => setShowResolutionDetail(true)}>
              <Clock size={15} /><span>{detailLabel}</span><ChevronRight size={14} />
            </button>
          )}
          {activeTab === 'chat' && (chat?.motivo || chat?.descripcion) && (
            <button type="button" className="mchat-strip" onClick={() => setInfoSheet({
              title: `Reclamo: ${claimReasonLabel(chat?.motivo)}`,
              paragraphs: [chat?.descripcion, isBuyer ? 'Este proceso es gratuito. Siempre puedes acudir al Juzgado de Policía Local o reclamar en el SERNAC.' : null].filter(Boolean),
            })}>
              <Flag size={15} /><span>Reclamo: {claimReasonLabel(chat?.motivo)}</span><ChevronRight size={14} />
            </button>
          )}
        </div>

        {activeTab === 'chat' && !isEscalated && String(chat?.estadoPedido || '').toUpperCase() !== 'EN_MEDIACION' && (
          <div className="mchat-desktop-only">
            <ResolutionTrigger chat={chat} mode={mode} onOpen={() => setShowResolutionDetail(true)} />
          </div>
        )}

        {activeTab === 'mediator' ? (
          <div className="mchat-mediator-panel">
            {/* Celular: una línea de estado con dos íconos; resumen y detalle se abren al tocarlos. */}
            <div className="mchat-status-strip mchat-mobile-only">
              <i className={`mchat-status-dot ${estado === 'EN_MEDIACION' || !estado ? 'is-open' : 'is-done'}`} aria-hidden="true" />
              <span>{formatMediationState(estado)}{chat?.codigoMediacion ? ` · Caso ${chat.codigoMediacion}` : ''}</span>
              <button type="button" className="mchat-iconbtn" onClick={() => setSummarySheetOpen(true)} aria-label="Resumen de la mediación"><BookOpen size={17} /></button>
              {hasDetail && (
                <button type="button" className="mchat-iconbtn" onClick={() => setShowResolutionDetail(true)} aria-label="Ver detalle de la mediación"><GitCommitVertical size={17} /></button>
              )}
            </div>

            <button type="button" className="mchat-mediator-hero mchat-desktop-only" onClick={() => setSummaryOpen((v) => !v)} aria-expanded={summaryOpen} aria-label={summaryOpen ? 'Ocultar resumen de la mediación' : 'Mostrar resumen de la mediación'}>
              <span className="mchat-mediator-hero-icon"><BookOpen size={28} /></span>
              <span className="mchat-mediator-hero-copy">
                <span className="mchat-h3">Resumen de la mediación</span>
                <span className="mchat-caption mchat-muted">Estado: {formatMediationState(estado)}</span>
              </span>
              {summaryOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
            </button>

            <div className="mchat-desktop-only">
              <ResolutionTrigger chat={chat} mode={mode} onOpen={() => setShowResolutionDetail(true)} />
            </div>

            {summaryOpen && <div className="mchat-desktop-only mchat-summary-inline">{summaryContent}</div>}

            <section className="mchat-section">
              <div className="mchat-section-title mchat-desktop-only"><MessageSquareMore size={18} /> Conversación con mediador</div>
              {mediatorThread.length ? mediatorThread.map((entry) => {
                const isMine = !LOG_ENTRY_TYPES.has(entry.type) && entry.senderRole === ownRole;
                return (
                  <MediatorMessageCard
                    key={entry.id}
                    entry={entry}
                    isMine={isMine}
                    avatarUrl={isMine ? (isBuyer ? buyerAvatar : sellerAvatar) : undefined}
                  />
                );
              }) : (
                <div className="mchat-infobox">
                  <Clock size={20} />
                  <div><span>El mediador aún no ha respondido. Te notificaremos cuando haya novedades.</span></div>
                </div>
              )}
            </section>
          </div>
        ) : (
          <>
            {isEscalated && (
              <div className="mchat-notice mchat-desktop-only">
                <Lock size={19} className="is-mediation" />
                <span className="mchat-notice-copy">La conversación directa está pausada. Continúa el seguimiento con el mediador.</span>
              </div>
            )}

            {(chat?.motivo || chat?.descripcion) && (
              <div className="mchat-infobox mchat-desktop-only">
                <Flag size={20} />
                <div>
                  <strong>Reclamo: {claimReasonLabel(chat?.motivo)}</strong>
                  {chat?.descripcion && <span>{chat.descripcion}</span>}
                  {/* U4: al surgir el reclamo se informa el derecho a acudir a tribunales (art. 3 g Ley 19.496). */}
                  {isBuyer && <span>Este proceso es gratuito. Siempre puedes acudir al Juzgado de Policía Local o reclamar en el SERNAC.</span>}
                </div>
              </div>
            )}

            <span className="mchat-daychip mchat-desktop-only">Chat con {isBuyer ? 'vendedor' : 'comprador'}</span>

            {messages.length === 0 ? (
              <div className="mchat-infobox">
                <Info size={20} />
                <div><span>Aún no hay mensajes en esta mediación.</span></div>
              </div>
            ) : (
              <div className="mchat-thread">
                {messages.map((message) => {
                  const isSystem = message.tipo === 'system';
                  const mine = String(message.emisorId) === viewerUserId;
                  const role = senderRoleOf(message.emisorId);
                  const variant = isSystem ? 'system' : mine ? 'me' : 'other';
                  return (
                    <ChatBubble
                      key={message.id}
                      variant={variant}
                      text={message.texto?.trim() ? message.texto : undefined}
                      senderName={isSystem ? undefined : role === 'BUYER' ? (chat?.compradorNombre ?? 'Comprador') : (chat?.vendedorNombre ?? 'Vendedor')}
                      senderAvatarUrl={role === 'BUYER' ? buyerAvatar : sellerAvatar}
                      senderRole={role === 'BUYER' ? 'Comprador' : 'Vendedor'}
                      createdAt={message.createdAt}
                      imageUrl={message.imagenUrl ? resolveMediaUrl(message.imagenUrl) : null}
                      onOpenImage={openImage}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Panel inferior fijo: compositor o barra bloqueada. */}
      <div className="mchat-bottom">
        {activeTab === 'chat' ? (
          threadLocked ? (
            <div className="mchat-frozen">
              <Lock size={18} />
              <span>
                {caseClosed
                  ? `Este caso está ${estado === 'RESUELTA' || claimResolvedByBuyer ? 'resuelto' : 'cerrado'}; ya no admite mensajes.`
                  : 'Chat pausado por intervención de mediador'}
              </span>
            </div>
          ) : (
            <form className="mchat-composer" onSubmit={submitMessage}>
              {sendError && <span className="mchat-inline-error"><AlertTriangle size={14} /> {sendError}</span>}
              <ChatImagePreview
                previewUrl={pendingImagePreview}
                fileName={pendingImage?.name}
                fileSize={pendingImage?.size}
                hint="Se enviará al presionar Enviar"
                onRemove={discardPendingImage}
              />
              <div className="mchat-composer-row">
                <div className="mchat-input">
                  <textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Escribe tu respuesta..."
                    maxLength={MAX_CHAT_MESSAGE}
                    rows={1}
                    aria-label="Mensaje"
                  />
                  <label className={`mchat-attach ${imageCount >= MAX_CHAT_IMAGES || isSending ? 'is-disabled' : ''}`} aria-label="Tomar una foto ahora" title={imageCount >= MAX_CHAT_IMAGES ? `Máximo de ${MAX_CHAT_IMAGES} fotos alcanzado` : 'Tomar una foto ahora'}>
                    <Camera size={22} />
                    <input type="file" accept="image/*" capture="environment" onChange={handleChatImageSelect} disabled={isSending || imageCount >= MAX_CHAT_IMAGES} />
                  </label>
                  <label className={`mchat-attach ${imageCount >= MAX_CHAT_IMAGES || isSending ? 'is-disabled' : ''}`} aria-label="Adjuntar una foto de la galería" title={imageCount >= MAX_CHAT_IMAGES ? `Máximo de ${MAX_CHAT_IMAGES} fotos alcanzado` : 'Adjuntar una foto de la galería'}>
                    <Paperclip size={22} />
                    <input type="file" accept="image/*" onChange={handleChatImageSelect} disabled={isSending || imageCount >= MAX_CHAT_IMAGES} />
                  </label>
                </div>
                <button type="submit" className="mchat-send" disabled={isSending || (!messageText.trim() && !pendingImage)} aria-label="Enviar mensaje">
                  {isSending ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
                </button>
              </div>
            </form>
          )
        ) : (
          mediatorClosed ? (
            <div className="mchat-frozen"><Lock size={18} /><span>Chat con mediador cerrado</span></div>
          ) : (
            <form className="mchat-mediator-composer" onSubmit={submitMediatorMessage}>
              {mediatorError && <span className="mchat-inline-error"><AlertTriangle size={14} /> {mediatorError}</span>}
              <div className="mchat-mediator-composer-row">
                <AttachButtons
                  className="mchat-attach-btn"
                  cameraSize={21}
                  clipSize={22}
                  disabled={isUploadingEvidence}
                  onFiles={async (incoming) => {
                    const picked = await pickEvidenceFiles(incoming, mediatorFiles.length, setMediatorError);
                    if (picked.length) setMediatorFiles((current) => [...current, ...picked]);
                  }}
                />
                <textarea
                  value={mediatorText}
                  onChange={(event) => setMediatorText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitMediatorMessage(); } }}
                  placeholder="Escribir al mediador..."
                  maxLength={1000}
                  rows={1}
                  aria-label="Mensaje al mediador"
                />
                <button type="submit" className="mchat-send" disabled={isSendingMediator || !mediatorText.trim()} aria-label="Enviar mensaje al mediador">
                  {isSendingMediator ? <Loader2 size={20} className="spin-icon" /> : <Send size={20} />}
                </button>
              </div>
              <EvidencePreviews files={mediatorFiles} onRemove={(index) => setMediatorFiles((current) => current.filter((_, i) => i !== index))} />
              {mediatorFiles.length > 0 && (
                <button type="button" className="mchat-btn-primary" disabled={isUploadingEvidence} onClick={submitMediatorEvidence}>
                  {isUploadingEvidence ? <Loader2 size={16} className="spin-icon" /> : <CloudUpload size={16} />}
                  {isUploadingEvidence ? 'Subiendo...' : 'Enviar evidencias'}
                </button>
              )}
            </form>
          )
        )}
      </div>

      {/* Modales */}
      {showMediatorLockedInfo && typeof document !== 'undefined' && createPortal(
        <div className="mchat-centered-backdrop" onClick={() => setShowMediatorLockedInfo(false)}>
          <div className="mchat-centered" role="dialog" aria-modal="true" aria-label="Mediador no disponible" onClick={(e) => e.stopPropagation()}>
            <span className="mchat-centered-icon"><Lock size={26} /></span>
            <h3 className="mchat-h3">Mediador no disponible</h3>
            <p>{mediatorLockedMessage}{'\n\n'}Puedes seguir conversando con la {isBuyer ? 'tienda' : 'otra parte'} y marcar el caso como resuelto cuando lleguen a un acuerdo.</p>
            <button type="button" className="mchat-btn-primary" onClick={() => setShowMediatorLockedInfo(false)}>Entendido</button>
          </div>
        </div>,
        document.body
      )}

      {dialog === 'escalate' && typeof document !== 'undefined' && createPortal(
        <div className="mchat-sheet-backdrop" onClick={() => !isSubmitting && setDialog(null)}>
          <section className="mchat-sheet" role="dialog" aria-modal="true" aria-label="Solicitar mediador" onClick={(e) => e.stopPropagation()}>
            <header className="mchat-sheet-header">
              <span className="mchat-sheet-icon"><img src={mediatorAvatar} alt="" /></span>
              <div>
                <h3 className="mchat-h3">Solicitar mediador</h3>
                <span className="mchat-caption mchat-muted">Un especialista de RepuesTop revisará el caso y las evidencias.</span>
              </div>
              <button type="button" className="mchat-sheet-close" disabled={isSubmitting} onClick={() => setDialog(null)} aria-label="Cerrar"><X size={18} /></button>
            </header>
            <div className="mchat-sheet-body">
              <form onSubmit={submitEscalate} noValidate>
                <div className="mchat-warning-box">
                  <Info size={20} />
                  <span>La ayuda del mediador se puede solicitar una vez recibido el producto y durante los 10 días corridos siguientes. Al enviarla, el chat directo se pausará y el seguimiento continuará en el apartado Mediador.</span>
                </div>
                <div className="mchat-field">
                  <span>Motivo de la solicitud</span>
                  <div className="mchat-reason-grid" role="radiogroup" aria-label="Motivo de la solicitud">
                    {MEDIATOR_REASONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={helpReason === option.value}
                        className={`mchat-reason-pill ${helpReason === option.value ? 'is-selected' : ''}`}
                        onClick={() => setHelpReason(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {helpReason === 'other' && (
                    <input type="text" value={helpCustomReason} maxLength={150} onChange={(event) => setHelpCustomReason(event.target.value)} placeholder="Escribe el motivo" aria-label="Motivo" />
                  )}
                </div>
                <label className="mchat-field">
                  <span>Detalle para el mediador</span>
                  <textarea
                    value={detail}
                    maxLength={MAX_DETAIL}
                    onChange={(event) => setDetail(event.target.value)}
                    placeholder="Explica por qué necesitan intervención y qué evidencia estás adjuntando..."
                  />
                </label>
                <div className="mchat-field">
                  <div className="mchat-evidence-head">
                    <span>Evidencias</span>
                    <div className="mchat-evidence-actions">
                      <AttachButtons
                        disabled={isSubmitting || files.length >= MAX_EVIDENCE_FILES}
                        onFiles={async (incoming) => {
                          // La validacion corre en el handler, no dentro del updater:
                          // React puede invocar el updater dos veces y duplicaria el error.
                          const picked = await pickEvidenceFiles(incoming, files.length, setFormError);
                          if (picked.length) setFiles((current) => [...current, ...picked]);
                        }}
                      />
                    </div>
                  </div>
                  <EvidencePreviews files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} emptyText="Puedes adjuntar imágenes desde cámara o galería." />
                </div>
                {formError && <span className="mchat-inline-error"><AlertTriangle size={14} /> {formError}</span>}
                <button type="submit" className="mchat-btn-primary is-block" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
                  {isSubmitting ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </form>
            </div>
          </section>
        </div>,
        document.body
      )}

      {dialog === 'resolve' && typeof document !== 'undefined' && createPortal(
        <div className="mchat-sheet-backdrop" onClick={() => !isSubmitting && setDialog(null)}>
          <section className="mchat-sheet" role="dialog" aria-modal="true" aria-label="Marcar como resuelto" onClick={(e) => e.stopPropagation()}>
            <header className="mchat-sheet-header">
              <span className="mchat-sheet-icon is-success"><CheckCircle2 size={22} /></span>
              <div>
                <h3 className="mchat-h3">Marcar como resuelto</h3>
                <span className="mchat-caption mchat-muted">Queda registrado en el expediente que resolviste el reclamo con la tienda. Esta conversación se cierra y tu compra sigue su curso normal.</span>
              </div>
              <button type="button" className="mchat-sheet-close" disabled={isSubmitting} onClick={() => setDialog(null)} aria-label="Cerrar"><X size={18} /></button>
            </header>
            <div className="mchat-sheet-body">
              <form onSubmit={submitResolve} noValidate>
                <label className="mchat-field">
                  <span>¿Cómo se resolvió?</span>
                  <textarea value={resolveReason} maxLength={MAX_DETAIL} onChange={(event) => setResolveReason(event.target.value)} placeholder="Ej: La tienda me cambió la pieza" />
                </label>
                <div className="mchat-field">
                  <div className="mchat-evidence-head">
                    <span>Evidencia (opcional)</span>
                    <div className="mchat-evidence-actions">
                      <AttachButtons
                        disabled={isSubmitting || files.length >= MAX_EVIDENCE_FILES}
                        onFiles={async (incoming) => {
                          const picked = await pickEvidenceFiles(incoming, files.length, setFormError);
                          if (picked.length) setFiles((current) => [...current, ...picked]);
                        }}
                      />
                    </div>
                  </div>
                  <EvidencePreviews files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} />
                </div>
                {formError && <span className="mchat-inline-error"><AlertTriangle size={14} /> {formError}</span>}
                <button type="submit" className="mchat-btn-primary is-block" disabled={isSubmitting || !resolveReason.trim()}>
                  {isSubmitting ? <Loader2 size={18} className="spin-icon" /> : <Check size={18} />}
                  {isSubmitting ? 'Enviando...' : 'Marcar como resuelto'}
                </button>
              </form>
            </div>
          </section>
        </div>,
        document.body
      )}

      {warrantyDialog && typeof document !== 'undefined' && createPortal(
        <div className="mchat-sheet-backdrop" onClick={closeWarrantyDialog}>
          <section className="mchat-sheet" role="dialog" aria-modal="true" aria-label="Pedir ayuda a soporte por garantía legal" onClick={(e) => e.stopPropagation()}>
            <header className="mchat-sheet-header">
              <span className="mchat-sheet-icon"><Headphones size={22} /></span>
              <div>
                <h3 className="mchat-h3">{warrantyDone ? 'Solicitud enviada' : 'Pedir ayuda a soporte'}</h3>
                <span className="mchat-caption mchat-muted">
                  {warrantyDone
                    ? 'Soporte de RepuesTop revisará tu caso y coordinará con la tienda. Te avisaremos por notificación.'
                    : 'Por garantía legal tienes 6 meses desde que recibiste el producto para reclamar por fallas. Soporte revisará el reclamo original y coordinará con la tienda. Si quieres, agrega lo que haya cambiado.'}
                </span>
              </div>
              <button type="button" className="mchat-sheet-close" disabled={isRequestingWarranty} onClick={closeWarrantyDialog} aria-label="Cerrar"><X size={18} /></button>
            </header>
            <div className="mchat-sheet-body">
              {warrantyDone ? (
                <>
                  {warrantyTicketPath && (
                    <button type="button" className="mchat-btn-outline is-block" onClick={() => navigate(warrantyTicketPath)}>Ver ticket</button>
                  )}
                  <button type="button" className="mchat-btn-primary is-block" onClick={closeWarrantyDialog}><CheckCircle2 size={16} /> Entendido</button>
                </>
              ) : (
                <form onSubmit={submitWarranty} noValidate>
                  <label className="mchat-field">
                    <span className="mchat-caption mchat-muted">Comentario para soporte (opcional)</span>
                    <textarea value={warrantyComment} maxLength={MAX_DETAIL} onChange={(event) => setWarrantyComment(event.target.value)} placeholder="Comentario para soporte (opcional)" />
                  </label>
                  {warrantyError && <span className="mchat-inline-error"><AlertTriangle size={14} /> {warrantyError}</span>}
                  <button type="submit" className="mchat-btn-primary is-block" disabled={isRequestingWarranty}>
                    {isRequestingWarranty ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
                    {isRequestingWarranty ? 'Enviando…' : 'Enviar a soporte'}
                  </button>
                  <button type="button" className="mchat-btn-outline is-block" disabled={isRequestingWarranty} onClick={closeWarrantyDialog}>Cancelar</button>
                </form>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}

      {showResolutionDetail && (
        <ResolutionDetailDialog chat={chat} mode={mode} codigo={codigo} onClose={() => setShowResolutionDetail(false)} />
      )}

      {showVehicleReceipt && typeof document !== 'undefined' && createPortal(
        <div className="dispute-dialog-backdrop" onClick={() => setShowVehicleReceipt(false)}>
          <section
            className="dispute-dialog dispute-claim-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Vehículo y boleta de la compra"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>Pedido {codigo}</small>
                <h2>Vehículo y boleta de la compra</h2>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setShowVehicleReceipt(false)}><X size={16} /></button>
            </header>
            <div className="dispute-claim-dialog-body">
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                Lo ven el comprador y la tienda, para revisar la compatibilidad con los mismos datos.
              </p>
              <div className="dispute-vehicle-card" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'grid', gap: 6 }}>
                <small style={{ fontWeight: 700, color: '#0056BF', letterSpacing: '.04em' }}>VEHÍCULO CONFIRMADO</small>
                {(chat?.vehiculoPatente || chat?.vehiculoChasis || chat?.vehiculoMarca || chat?.vehiculoModelo) ? (
                  <>
                    <span><small style={{ color: '#64748b' }}>Vehículo</small><br /><strong>{[chat.vehiculoMarca, chat.vehiculoModelo, chat.vehiculoVersion, chat.vehiculoAnio].filter(Boolean).join(' ') || 'Marca y modelo no identificados'}</strong></span>
                    <span><small style={{ color: '#64748b' }}>Patente</small><br /><strong>{chat.vehiculoPatente || 'No informada'}</strong></span>
                    <span><small style={{ color: '#64748b' }}>Chasis</small><br /><strong style={{ userSelect: 'all' }}>{chat.vehiculoChasis || 'No identificado'}</strong></span>
                    {!isBuyer && (
                      <small style={{ color: '#64748b' }}>La patente se muestra parcial para proteger los datos del comprador; el chasis basta para validar el repuesto.</small>
                    )}
                  </>
                ) : (
                  <small style={{ color: '#64748b' }}>El comprador no informó su vehículo en esta compra.</small>
                )}
              </div>
              <div className="dispute-vehicle-card" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
                <small style={{ fontWeight: 700, color: '#0056BF', letterSpacing: '.04em' }}>BOLETA DE LA TIENDA</small>
                {chat?.boletaVentaDisponible ? (
                  <button type="button" onClick={() => setReceiptOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifySelf: 'start', padding: '8px 12px', borderRadius: 8, border: '1px solid #0056BF', background: '#fff', color: '#0056BF', fontWeight: 600, cursor: 'pointer' }}>
                    <FileText size={15} /> {chat.boletaVentaNombre || 'Ver boleta'}
                  </button>
                ) : (
                  <small style={{ color: '#64748b' }}>La tienda todavía no carga la boleta de esta compra.</small>
                )}
              </div>
            </div>
          </section>
        </div>,
        document.body,
      )}

      {receiptOpen && (
        <SaleReceiptViewerModal
          orderId={pedidoId}
          proveedorId={isBuyer ? (chat?.proveedorId ?? proveedorId ?? null) : null}
          orderCode={codigo}
          storeName={isBuyer ? participantName : undefined}
          onClose={() => setReceiptOpen(false)}
        />
      )}

      {viewerImage && typeof document !== 'undefined' && createPortal(
        <div className="quote-ws-dialog-backdrop quote-ws-image-viewer" onClick={() => setViewerImage(null)}>
          <div className="quote-ws-image-viewer-body" onClick={(event) => event.stopPropagation()}>
            <header>
              <div className="viewer-title">
                <ImageIcon size={16} />
                <span>Imagen adjunta</span>
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
            <img src={viewerImage} alt="Imagen del chat" />
          </div>
        </div>,
        document.body
      )}
      {/* Celular: menú "⋯", resumen de la mediación y avisos largos. */}
      {menuOpen && typeof document !== 'undefined' && createPortal(
        <div className="mchat-sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <section className="mchat-sheet mchat-menu-sheet" role="dialog" aria-modal="true" aria-label="Opciones del caso" onClick={(e) => e.stopPropagation()}>
            <span className="mchat-menu-grabber" aria-hidden="true" />
            <span className="mchat-menu-title">Opciones del caso</span>
            {menuItems.map(({ key, Icon, label, hint, tone, onPress }) => (
              <button key={key} type="button" className={`mchat-menu-item ${tone ? `is-${tone}` : ''}`} onClick={() => { setMenuOpen(false); onPress(); }}>
                <Icon size={19} />
                <span className="mchat-menu-copy"><span>{label}</span>{hint && <small>{hint}</small>}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </section>
        </div>,
        document.body,
      )}
      <InfoSheet open={summarySheetOpen} title="Resumen de la mediación" onClose={() => setSummarySheetOpen(false)}>
        <div className="mchat-summary-sheet">{summaryContent}</div>
      </InfoSheet>
      <InfoSheet
        open={Boolean(infoSheet)}
        title={infoSheet?.title ?? ''}
        paragraphs={infoSheet?.paragraphs ?? []}
        action={infoSheet?.action}
        onClose={() => setInfoSheet(null)}
      />
    </article>
  );
}
