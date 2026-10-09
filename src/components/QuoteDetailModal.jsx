import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, BadgeDollarSign, CalendarDays, CalendarClock, Car,
  CheckCircle2, ChevronRight, CircleHelp, CircleUserRound, ClipboardList, CreditCard, Download, ExternalLink, Eye, FileText, Flag,
  Headphones, Image as ImageIcon, Info, Loader2, Lock, Maximize2, MessageSquare, Package, Paperclip,
  PauseCircle, Pencil, Send, Settings2, Share2, ShieldCheck, ShoppingCart, Store, Tag, Trash2, Truck, Undo2, X, PackageCheck
} from 'lucide-react';
import RepuesTopLogo from './RepuesTopLogo';
import ChatImagePreview from './ChatImagePreview';
import {
  cancelQuoteModificationApi, getConversationMessagesApi, keepOriginalQuoteApi,
  deleteConversationQuoteApi, getConversationQuoteApi, getQuoteRequestApi, getSellerStoreApi, getStoreProfileApi,
  markConversationReadApi, reportConversationApi, resolveMediaUrl,
  sendConversationMessageApi, sendQuoteRequestApi, uploadConversationImageApi,
  createQuoteShareLinkApi,
} from '../services/api';
import { adaptStore } from '../services/adapters';
import { compressImageFile } from '../utils/imageCompression';
import CommissionSummaryCard from './CommissionSummaryCard';
import {
  deliveryTermsLabel, isQuoteExpired, isQuotePaused, isValidPlate, normalizePlate, quantityFromLabel, quoteChargeBase,
  quoteExpirationLabel, quoteRequestChanges, quoteShippingCost as shippingCostOfQuote, resolveQuoteRequest, shippingCodeFromText,
  QUOTE_AVAILABILITY_OPTIONS, QUOTE_DELIVERY_OPTIONS, QUOTE_SHIPPING_LABELS,
  QUOTE_VALIDITY_OPTIONS, QUOTE_WARRANTY_OPTIONS,
} from '../utils/quoteFlow';
import { buildQuotePdfBlob, quoteDocumentFilename } from '../utils/quoteDocument';
import { checkoutPath, helpCategoryPath, productPath, profilePurchasePath, storePath } from '../routes/paths';
import { parseShippingMethods, resolveShippingService, shippingMethodCost } from '../data/shippingMethods';

// Tope del mensaje del chat. Una cotizacion se negocia con datos concretos -cantidad,
// estado, despacho, precio-; 500 caracteres son un parrafo completo y obligan a ser
// claro. La app usa 1000 y conviene alinearla.
const MAX_CHAT_MESSAGE = 500;

// Tope de imagenes por conversacion. Lo valida tambien `ConversacionService`, que es
// donde el limite es real: esto solo evita que el usuario llegue al error.
const MAX_CHAT_IMAGES = 10;

// Peso maximo DESPUES de comprimir. Ver `imageCompression` para el porque del numero.
const MAX_CHAT_IMAGE_BYTES = 3 * 1024 * 1024;

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function formatDate(value, withDate = false) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return withDate
    ? date.toLocaleString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  return String(name || 'RT').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function DataRow({ icon: Icon, label, value }) {
  return <div className="quote-ws-data-row"><Icon size={17} /><span><small>{label}</small><strong>{value || 'No informado'}</strong></span></div>;
}

// Motivos frecuentes para mantener la cotización original ante una solicitud de modificación.
const KEEP_ORIGINAL_REASONS = [
  'No tengo más unidades disponibles',
  'No realizo ese tipo de envío',
  'El precio no cambia con ese ajuste',
];

const REPORT_REASONS = [
  'Quiere pagar o vender fuera de RepuesTop',
  'Compartió contacto externo o link externo',
  'Sospecha de fraude o estafa',
  'Suplantación o datos falsos',
  'Insultos, amenazas o acoso',
  'Producto falso, robado o sin procedencia',
  'Información engañosa del producto',
  'Manipulación de evidencia o documentos',
  'Uso indebido del chat',
  'Otro motivo',
];

export default function QuoteDetailModal({
  quote, mode = 'seller', isFounder = false, user, storeInfo, onClose, onSendQuoteResponse, onMarkedRead,
}) {
  const navigate = useNavigate();
  const storeId = quote?.proveedorId || quote?.sellerId || user?.sellerId;
  const [storeDetails, setStoreDetails] = useState(() => (
    storeInfo ? adaptStore(storeInfo) : null
  ));

  useEffect(() => {
    if (storeInfo && (mode === 'seller' || String(storeInfo.id || storeInfo.proveedorId || storeInfo.sellerId) === String(storeId))) {
      setStoreDetails(adaptStore(storeInfo));
      return;
    }
    if (!storeId) return;
    let cancelled = false;
    const fetcher = mode === 'seller'
      ? getSellerStoreApi(storeId)
      : getStoreProfileApi(storeId).catch(() => getSellerStoreApi(storeId));

    fetcher
      .then((data) => {
        if (!cancelled && data) {
          setStoreDetails(adaptStore(data));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storeId, storeInfo, mode]);

  const [localQuote, setLocalQuote] = useState(quote?.cotizacion || null);
  // Tras eliminar la cotizacion, la que venia en las props ya no vale.
  const [quoteDeleted, setQuoteDeleted] = useState(false);
  const [isDeletingQuote, setIsDeletingQuote] = useState(false);
  const activeQuote = quoteDeleted ? localQuote : (localQuote || quote?.cotizacion || null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [quoteEditorOpen, setQuoteEditorOpen] = useState(false);
  const [quotePreviewOpen, setQuotePreviewOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [isSharingQuote, setIsSharingQuote] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccessOpen, setReportSuccessOpen] = useState(false);
  const [modificationOpen, setModificationOpen] = useState(false);
  const [modificationForm, setModificationForm] = useState(null);
  const [modificationSubmitting, setModificationSubmitting] = useState(false);
  const [modificationError, setModificationError] = useState('');
  // Respuestas a una modificación pendiente: el comprador la cancela o la tienda mantiene la original.
  const [isCancellingModification, setIsCancellingModification] = useState(false);
  const [keepOriginalOpen, setKeepOriginalOpen] = useState(false);
  const [keepOriginalReason, setKeepOriginalReason] = useState('');
  const [keepOriginalError, setKeepOriginalError] = useState('');
  const [isKeepingOriginal, setIsKeepingOriginal] = useState(false);
  const [requestSummaryOpen, setRequestSummaryOpen] = useState(false);

  // La miniatura de la burbuja no alcanza para revisar una pieza: el vendedor necesita
  // ver el detalle y a veces guardarse la foto. Se abre a pantalla completa con opcion
  // de descarga.
  const [viewerImage, setViewerImage] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = React.useRef(null);
  const chatTextareaRef = React.useRef(null);

  // Lo que pidio el comprador sale de la solicitud guardada en el backend (`solicitud`). Antes
  // se releia el texto del chat y, mientras cargaban los mensajes o si no calzaba la regex, la
  // condicion caia en "Retiro en tienda" aunque se hubiera pedido envio dentro de la comuna.
  const [solicitud, setSolicitud] = useState(quote?.solicitud || null);
  const requested = useMemo(
    () => resolveQuoteRequest(solicitud, messages, quote?.ultimoMensaje),
    [solicitud, messages, quote?.ultimoMensaje],
  );

  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [availability, setAvailability] = useState('Stock disponible');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [deliveryCost, setDeliveryCost] = useState('');
  const [warranty, setWarranty] = useState('3 meses');
  const [validity, setValidity] = useState('Valida por 24 horas');
  const [responseNotes, setResponseNotes] = useState('');
  // Los metodos de la TIENDA de esta conversacion. El respaldo a `user.shippingMethods` solo
  // vale para el vendedor (es su propia tienda): para un comprador que ademas vende eran los
  // metodos de su tienda, no los de la que cotiza.
  const storeShippingMethods = quote?.sellerShippingMethods || (mode === 'seller' ? user?.shippingMethods : '');
  const localShippingCost = useMemo(() => {
    const methods = parseShippingMethods(storeShippingMethods);
    const localMethod = methods.find((method) => resolveShippingService(method).name === 'Envío dentro de la comuna');
    return shippingMethodCost(localMethod);
  }, [storeShippingMethods]);
  // Metodos de envio de la tienda para el popup de "Solicitar modificación".
  const modificationShippingOptions = useMemo(() => {
    const methods = parseShippingMethods(storeShippingMethods);
    const names = methods.map((method) => QUOTE_SHIPPING_LABELS[shippingCodeFromText(method)]).filter(Boolean);
    return [...new Set(names.length ? names : QUOTE_DELIVERY_OPTIONS)];
  }, [storeShippingMethods]);
  const quoteShippingCost = shippingCostOfQuote(activeQuote);
  const isLocalDelivery = shippingCodeFromText(deliveryTerms) === 'DENTRO_DE_LA_COMUNA';

  useEffect(() => {
    const current = quote?.cotizacion;
    setLocalQuote(current || null);
    setUnitPrice(String(current?.precioUnitario ?? current?.precio ?? ''));
    setDiscount(String(current?.descuento ?? ''));
    setAvailability(current?.disponibilidad || 'Stock disponible');
    setWarranty(current?.garantia || '3 meses');
    setValidity(current?.vigencia || 'Valida por 24 horas');
    setResponseNotes(current?.notas || '');
  }, [quote]);

  // Aparte del efecto anterior: la solicitud se relee cada 8 s y, con todo junto, una
  // modificación del comprador borraba el precio y el descuento que la tienda estaba tipeando.
  useEffect(() => {
    // La condicion es SIEMPRE la que pidio el comprador, tambien si ya habia una cotizacion:
    // si pidio una modificacion, la cotizacion editada debe tomar el metodo nuevo. Antes una
    // cotizacion guardada como "Retiro en tienda" le ganaba a cualquier solicitud posterior.
    setDeliveryTerms(
      requested.hasRequestedDeliveryTerms
        ? requested.requestedDeliveryTerms
        : deliveryTermsLabel(quote?.cotizacion?.condicionesEntrega) || ''
    );
    setDeliveryCost(requested.requestedShippingCode === 'DENTRO_DE_LA_COMUNA' && localShippingCost ? String(localShippingCost) : '');
  }, [quote, requested.requestedDeliveryTerms, requested.hasRequestedDeliveryTerms, requested.requestedShippingCode, localShippingCost]);

  useEffect(() => {
    setSolicitud(quote?.solicitud || null);
    if (!quote?.id) return undefined;
    let cancelled = false;
    getQuoteRequestApi(quote.id)
      .then((current) => { if (!cancelled && current) setSolicitud(current); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [quote?.id, quote?.solicitud]);

  useEffect(() => {
    if (!quote) return undefined;
    let cancelled = false;
    setIsLoadingMessages(true);
    Promise.all([getConversationMessagesApi(quote.id), markConversationReadApi(quote.id).catch(() => null)])
      .then(([items]) => {
        if (!cancelled) {
          setMessages(Array.isArray(items) ? items : []);
          onMarkedRead?.(quote.id);
        }
      })
      .catch((error) => !cancelled && setStatusMessage({ type: 'error', text: error.message || 'No se pudo cargar la conversación.' }))
      .finally(() => !cancelled && setIsLoadingMessages(false));
    return () => { cancelled = true; };
  }, [quote, onMarkedRead]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!quote?.id) return undefined;
    const refreshQuoteDocument = () => {
      getConversationQuoteApi(quote.id)
        .then((current) => {
          if (current) setLocalQuote(current);
        })
        .catch(() => {});
      getQuoteRequestApi(quote.id)
        .then((current) => {
          if (current) setSolicitud(current);
        })
        .catch(() => {});
      // Los mensajes solo se cargaban al abrir: la solicitud de modificación del comprador o la
      // respuesta de la tienda no aparecían hasta reabrir el chat.
      getConversationMessagesApi(quote.id)
        .then((items) => {
          if (Array.isArray(items)) {
            setMessages((previous) => (
              previous.length === items.length && previous[previous.length - 1]?.id === items[items.length - 1]?.id
                ? previous
                : items
            ));
          }
        })
        .catch(() => {});
    };
    const interval = window.setInterval(refreshQuoteDocument, 8000);
    return () => window.clearInterval(interval);
  }, [quote?.id]);

  if (!quote) return null;

  const quantity = quantityFromLabel(requested.requestedQty);
  const subtotal = (Number(unitPrice) || 0) * quantity;
  const normalizedDiscount = Number(discount) || 0;
  const finalPrice = Math.max(0, subtotal - normalizedDiscount);
  const quoteIdShort = String(quote.id || '').slice(-6).toUpperCase();
  const participantName = quote.otroParticipanteNombre || (mode === 'buyer' ? 'Tienda RepuesTop' : 'Comprador RepuesTop');
  const productName = quote.productoNombre || 'Producto consultado';
  const productImage = resolveMediaUrl(quote.productoImagenUrl);
  // La sesión no siempre trae `storeName` (pruebas E2E en dev, 5-oct: la tienda veía "Mi tienda
  // RepuesTop" en su propia cotización); los datos de la tienda ya cargados sí lo tienen.
  const storeName = mode === 'buyer'
    ? participantName
    : (storeDetails?.nombre || storeDetails?.storeName || user?.storeName || 'Mi tienda RepuesTop');
  const buyerName = mode === 'seller' ? participantName : (user?.userName || user?.nombre || 'Comprador RepuesTop');
  const participantPhoto = resolveMediaUrl(quote.otroParticipanteFotoUrl);
  // `participantPhoto` es la del OTRO participante: solo es la del comprador mirando desde la
  // tienda. Si el editor lo abriera un comprador, pintaria al vendedor bajo el rotulo equivocado.
  const buyerPhoto = mode === 'seller' ? participantPhoto : null;
  // El logo va al PDF de la cotización, así que se agotan todos los campos donde
  // el backend o el usuario pueden entregarlo antes de caer en el placeholder.
  const rawStoreLogo = mode === 'buyer'
    ? (quote?.otroParticipanteFotoUrl || quote?.proveedorLogoUrl || quote?.sellerLogoUrl || quote?.tiendaLogoUrl || quote?.logoUrl || quote?.proveedorFotoUrl || quote?.logoTienda || quote?.imagenUrl || activeQuote?.proveedorLogoUrl || activeQuote?.logoUrl || user?.logoUrl || user?.userProfileUrl || user?.storeLogoUrl)
    : (user?.logoUrl || user?.userProfileUrl || user?.storeLogoUrl || user?.avatarUrl || quote?.proveedorLogoUrl || quote?.otroParticipanteFotoUrl || quote?.sellerLogoUrl || quote?.tiendaLogoUrl || quote?.logoUrl || activeQuote?.proveedorLogoUrl || activeQuote?.logoUrl);
  const storePhoto = resolveMediaUrl(rawStoreLogo);
  const myPhoto = resolveMediaUrl(user?.userProfileUrl || user?.logoUrl || user?.storeLogoUrl || user?.avatarUrl);
  const expired = activeQuote ? isQuoteExpired(activeQuote) : false;
  const imageCount = messages.filter((message) => message.imagenUrl).length;
  /**
   * El comprador no escribe hasta que el vendedor entra al hilo. Es la misma regla que
   * la app (`quote-chat.tsx:218`): sin esto el comprador puede llenar la conversacion
   * antes de que haya alguien del otro lado.
   *
   * Adjuntar fotos SI se permite desde el inicio, igual que en la app: al pedir la
   * cotizacion muchas veces hay que mostrar la pieza.
   */
  const sellerHasReplied = messages.some((message) => (
    String(message.emisorId ?? message.autorId ?? '') !== String(user?.userId ?? user?.id ?? '')
  ));
  const closed = quote.estado === 'CERRADA';
  // Ya se compro: el backend manda el pedido pagado que salio de esta cotizacion
  // (`ConversacionResponseDTO.pedidoCotizacionId`). Desde ahi no se ofrece "Revisar y pagar",
  // que hacia creer que faltaba pagar, sino ir a la compra.
  const purchasedOrderId = quote.pedidoCotizacionId ?? null;
  const purchased = mode === 'buyer' && purchasedOrderId != null;
  // Vencida o cerrada, el hilo deja de admitir mensajes: no tiene sentido negociar
  // sobre una oferta que ya no se puede pagar. El backend ya bloquea la CERRADA; la
  // vencida se decide aca, que es donde se interpreta `vigencia`.
  const chatLocked = closed || expired;
  // El comprador pidió una modificación y la tienda aún no responde: la cotización se ve pero
  // no se puede pagar (el backend también la rechaza en el checkout).
  const paused = !closed && isQuotePaused(solicitud, activeQuote);
  const modification = solicitud?.modificacion || null;
  const requestChanges = paused ? quoteRequestChanges(solicitud) : [];
  const canWriteText = !chatLocked && (mode === 'seller' || Boolean(activeQuote) || sellerHasReplied);
  const canAttach = !chatLocked && imageCount < MAX_CHAT_IMAGES;
  const documentName = quoteDocumentFilename(quote.id);
  const openProduct = () => navigate(productPath({ id: quote.productoId, titulo: productName }));
  const openStore = () => {
    if (!storeId) return;
    navigate(storePath({ id: storeId, nombre: storeName }));
  };
  const openHelp = () => {
    setOptionsOpen(false);
    navigate(helpCategoryPath('cotizaciones'));
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!reportReason || isSubmittingReport) return;
    setIsSubmittingReport(true);
    try {
      // Antes esto creaba un ticket de soporte con motivo "Reporte de chat: ..."
      // como truco para que el backend lo replicara a la tabla real de reportes
      // por coincidencia de texto (frágil: si el texto no calzaba exacto, el
      // reporte no quedaba registrado ahí). Ahora usa el endpoint que ya existía
      // para esto, que crea el reporte directo y resuelve quién es el reportado
      // a partir de la conversación.
      await reportConversationApi(quote.id, {
        motivo: reportReason,
        descripcion: reportDetail.trim() || `Reporte por el motivo: ${reportReason}`,
      });
      setReportReason('');
      setReportDetail('');
      setReportOpen(false);
      setReportSuccessOpen(true);
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo enviar el reporte.' });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const resolveStoreDetails = async () => {
    if (storeDetails) return storeDetails;
    if (storeInfo) {
      const adapted = adaptStore(storeInfo);
      setStoreDetails(adapted);
      return adapted;
    }
    if (!storeId) return null;
    try {
      const raw = mode === 'seller'
        ? await getSellerStoreApi(storeId)
        : await getStoreProfileApi(storeId).catch(() => getSellerStoreApi(storeId));
      if (raw) {
        const adapted = adaptStore(raw);
        setStoreDetails(adapted);
        return adapted;
      }
    } catch {}
    return null;
  };

  const createDocumentBlob = async () => {
    const details = await resolveStoreDetails();
    return buildQuotePdfBlob({
      conversationId: quote.id,
      quote: activeQuote,
      productName,
      storeName: details?.nombre || details?.storeName || storeName,
      storeTaxId: details?.rut || details?.taxId || (mode === 'seller' ? user?.taxId : ''),
      storeGiro: details?.tipo || details?.giro || details?.especialidad || '',
      storeAddress: details?.direccion || details?.address || '',
      storeCity: details?.ciudad || [details?.comuna, details?.region].filter(Boolean).join(', ') || '',
      storePhone: details?.telefono || details?.phone || (mode === 'seller' ? (user?.phone || user?.telefono) : ''),
      storeEmail: details?.email || (mode === 'seller' ? user?.email : ''),
      storeHours: details?.horario || details?.hours || '',
      buyerName,
      // Corto para que quepa en la línea "Vehículo:" del PDF: "BBCL12 · VIN 9BWZZZ377VT004251".
      vehicleConsulted: [
        requested.requestedPlate,
        requested.requestedChassis ? `VIN ${requested.requestedChassis}` : '',
      ].filter(Boolean).join(' · '),
      storeLogoUrl: details?.logoUrl || storePhoto,
    });
  };

  const viewDocument = async () => {
    if (!activeQuote) return;
    const previewWindow = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await createDocumentBlob());
      if (previewWindow) previewWindow.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      previewWindow?.close();
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo generar la cotización.' });
    }
  };

  // "Compartir cotizacion" (5-oct): comparte un enlace del Market para ver o descargar el PDF, no
  // un archivo. Con la hoja de compartir del sistema si existe; si no, copia el enlace.
  const shareQuoteLink = async () => {
    if (!activeQuote || isSharingQuote) return;
    setIsSharingQuote(true);
    try {
      const { url } = await createQuoteShareLinkApi(quote.id);
      const title = `Cotización · ${productName}`;
      if (navigator.share) {
        try {
          await navigator.share({ title, text: `${title} en RepuesTop`, url });
          return;
        } catch (shareError) {
          if (shareError?.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        setStatusMessage({ type: 'success', text: 'Enlace copiado. Quien lo abra podrá ver y descargar el PDF de la cotización.' });
      } catch {
        // Sin permiso de portapapeles (pruebas E2E en dev, 5-oct) el enlace ya existe: se muestra
        // para copiarlo a mano en vez del error crudo del navegador ("Failed to execute 'writeText'").
        window.prompt('Copia este enlace para compartir la cotización:', url);
      }
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo crear el enlace de la cotización.' });
    } finally {
      setIsSharingQuote(false);
    }
  };

  const downloadDocument = async () => {
    if (!activeQuote) return;
    try {
      const url = URL.createObjectURL(await createDocumentBlob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = documentName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo descargar la cotización.' });
    }
  };

  const handleImageSelected = async (e) => {
    const original = e.target.files?.[0];
    if (!original) return;
    if (imageCount >= MAX_CHAT_IMAGES) {
      setStatusMessage({ type: 'error', text: `Esta conversación ya alcanzó el máximo de ${MAX_CHAT_IMAGES} imágenes.` });
      return;
    }
    // Se comprime ANTES de mirar el peso: una foto de celular pesa varios MB en crudo y
    // pasaria el tope solo por no estar redimensionada.
    const file = await compressImageFile(original);
    if (file.size > MAX_CHAT_IMAGE_BYTES) {
      setStatusMessage({ type: 'error', text: 'La imagen supera los 3 MB incluso comprimida. Prueba con otra.' });
      return;
    }
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setSelectedImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitChatMessage = async (event) => {
    event.preventDefault();
    const text = chatMessage.trim();
    if (!text && !selectedImageFile) return;
    setIsSending(true);
    try {
      if (selectedImageFile) {
        setIsUploadingImage(true);
        const imageMsg = await uploadConversationImageApi(quote.id, selectedImageFile);
        setMessages((previous) => [...previous, imageMsg]);
        removeSelectedImage();
      }
      if (text) {
        const sent = await sendConversationMessageApi(quote.id, text);
        setMessages((previous) => [...previous, sent]);
        setChatMessage('');
      }
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo enviar el mensaje o imagen.' });
    } finally {
      setIsSending(false);
      setIsUploadingImage(false);
    }
  };

  // "Solicitar modificación" reabre el popup con el pedido ACTUAL (no el original) para
  // que el comprador lo ajuste. Antes solo precargaba el textarea del chat con una frase
  // fija, sin mostrar los datos que ya habia pedido ni dejar editarlos.
  const openModificationRequest = () => {
    // Parte en el metodo VIGENTE. Antes, si no calzaba el texto, tomaba la primera opcion
    // (casi siempre "Retiro en tienda") y la modificacion cambiaba el metodo sin querer.
    const matchedShipping = modificationShippingOptions.find(
      (option) => shippingCodeFromText(option) === requested.requestedShippingCode,
    );
    setModificationForm({
      quantity: quantityFromLabel(requested.requestedQty),
      shippingMethod: matchedShipping || '',
      chassis: requested.requestedPlate || requested.requestedChassis || '',
      notes: requested.requestedNotes || '',
    });
    setModificationError('');
    setModificationOpen(true);
  };

  const updateModificationField = (field, value) => {
    setModificationForm((previous) => ({ ...previous, [field]: value }));
  };

  const submitModificationRequest = async (event) => {
    event.preventDefault();
    if (!modificationForm?.shippingMethod) {
      setModificationError('Selecciona el método de envío que necesitas.');
      return;
    }
    const nextQuantity = Number(modificationForm.quantity);
    if (!Number.isInteger(nextQuantity) || nextQuantity < 1 || nextQuantity > 999) {
      setModificationError('Ingresa cuántas unidades necesitas (entre 1 y 999).');
      return;
    }
    const currentVehicle = String(requested.requestedPlate || requested.requestedChassis || '').trim().toUpperCase();
    const nextVehicle = String(modificationForm.chassis || '').trim().toUpperCase();
    const unchanged = nextQuantity === quantityFromLabel(requested.requestedQty)
      && shippingCodeFromText(modificationForm.shippingMethod) === requested.requestedShippingCode
      && (nextVehicle === '' || nextVehicle === currentVehicle)
      && String(modificationForm.notes || '').trim() === String(requested.requestedNotes || '').trim();
    if (activeQuote && unchanged) {
      setModificationError('Cambia al menos un dato para pedir una nueva cotización.');
      return;
    }
    setModificationSubmitting(true);
    setModificationError('');
    try {
      // La modificacion reemplaza la solicitud guardada en el backend, que publica en el chat
      // la lista "Solicitud de cotización actualizada" con unidades, metodo y chasis.
      const saved = await sendQuoteRequestApi(quote.id, {
        cantidad: modificationForm.quantity,
        metodoEnvio: shippingCodeFromText(modificationForm.shippingMethod) || modificationForm.shippingMethod,
        // Una patente se manda como patente (el backend completa el chasis); otro valor, como chasis.
        ...(isValidPlate(modificationForm.chassis)
          ? { patente: normalizePlate(modificationForm.chassis), chasis: normalizePlate(modificationForm.chassis) === requested.requestedPlate ? requested.requestedChassis : '' }
          : { patente: '', chasis: modificationForm.chassis }),
        nota: modificationForm.notes,
      });
      if (saved?.solicitud) setSolicitud(saved.solicitud);
      const refreshed = await getConversationMessagesApi(quote.id).catch(() => null);
      if (Array.isArray(refreshed)) setMessages(refreshed);
      setModificationOpen(false);
      onMarkedRead?.(quote.id);
      setStatusMessage({
        type: 'success',
        text: activeQuote
          ? 'Avisamos a la tienda. Tu cotización actual queda en pausa hasta que responda.'
          : 'Tu solicitud fue actualizada.',
      });
    } catch (error) {
      setModificationError(error.message || 'No se pudo enviar la modificación. Intenta nuevamente.');
    } finally {
      setModificationSubmitting(false);
    }
  };

  const refreshAfterModification = async (saved) => {
    if (saved?.solicitud) setSolicitud(saved.solicitud);
    const refreshed = await getConversationMessagesApi(quote.id).catch(() => null);
    if (Array.isArray(refreshed)) setMessages(refreshed);
    onMarkedRead?.(quote.id);
  };

  // El comprador retira su solicitud: la cotización original sale de la pausa.
  const cancelModification = async () => {
    if (isCancellingModification) return;
    if (!window.confirm('¿Cancelar tu solicitud de modificación?\n\nRetomarás la cotización original de la tienda y podrás pagarla mientras siga vigente.')) return;
    setIsCancellingModification(true);
    try {
      await refreshAfterModification(await cancelQuoteModificationApi(quote.id));
      setStatusMessage({ type: 'success', text: 'Solicitud cancelada. La cotización original vuelve a estar disponible.' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo cancelar la solicitud.' });
    } finally {
      setIsCancellingModification(false);
    }
  };

  // La tienda no hará el cambio: mantiene su cotización, con un motivo para el comprador.
  const submitKeepOriginal = async (event) => {
    event.preventDefault();
    if (!keepOriginalReason.trim()) {
      setKeepOriginalError('Cuéntale al comprador por qué mantienes la cotización.');
      return;
    }
    setIsKeepingOriginal(true);
    setKeepOriginalError('');
    try {
      await refreshAfterModification(await keepOriginalQuoteApi(quote.id, keepOriginalReason));
      setKeepOriginalOpen(false);
      setKeepOriginalReason('');
      setStatusMessage({ type: 'success', text: 'Mantuviste tu cotización original. Avisamos al comprador.' });
    } catch (error) {
      setKeepOriginalError(error.message || 'No se pudo completar la acción. Intenta nuevamente.');
    } finally {
      setIsKeepingOriginal(false);
    }
  };

  const submitQuote = async (event) => {
    event.preventDefault();
    if (finalPrice <= 0) {
      setStatusMessage({ type: 'error', text: 'Ingresa un precio por unidad válido.' });
      return;
    }
    setIsSending(true);
    setStatusMessage(null);
    try {
      if (!deliveryTerms) {
        setStatusMessage({ type: 'error', text: 'Selecciona el método de envío de la cotización.' });
        setIsSending(false);
        return;
      }
      // El backend fija el metodo y las unidades desde la solicitud y agrega la tarifa de la
      // tienda al envio dentro de la comuna ("(costo: $X)").
      const normalizedDelivery = deliveryTerms;
      const payload = {
        precio: finalPrice, cantidad: requested.requestedQty, disponibilidad: availability,
        condicionesEntrega: normalizedDelivery, precioUnitario: Number(unitPrice),
        descuento: Number(discount) || 0, precioFinal: finalPrice,
        garantia: warranty, vigencia: validity, notas: responseNotes,
      };
      const saved = await onSendQuoteResponse?.(quote.id, payload);
      setLocalQuote(saved || { ...payload, id: activeQuote?.id || `local-${quote.id}`, createdAt: activeQuote?.createdAt || new Date().toISOString() });
      setQuoteDeleted(false);
      setQuoteEditorOpen(false);
      // La nueva cotización cierra la modificación pendiente: se relee la solicitud para quitar la pausa.
      getQuoteRequestApi(quote.id).then((current) => { if (current) setSolicitud(current); }).catch(() => {});
      setStatusMessage({ type: 'success', text: activeQuote ? 'Cotización actualizada y documento regenerado.' : 'Cotización enviada. El documento ya está disponible para ambos.' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo guardar la cotización.' });
    } finally {
      setIsSending(false);
    }
  };

  // Eliminar la cotizacion enviada (paridad con la app, useMessageDetail.requestDeleteQuote).
  const deleteQuote = async () => {
    if (isDeletingQuote || !activeQuote) return;
    setOptionsOpen(false);
    if (!window.confirm('¿Eliminar esta cotización?\n\nEl comprador dejará de verla y no podrá pagarla. Esta acción no se puede deshacer.')) return;
    setIsDeletingQuote(true);
    try {
      await deleteConversationQuoteApi(quote.id);
      setLocalQuote(null);
      setQuoteDeleted(true);
      setStatusMessage({ type: 'success', text: 'Cotización eliminada. Puedes crear una nueva cuando quieras.' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo eliminar la cotización.' });
    } finally {
      setIsDeletingQuote(false);
    }
  };

  /**
   * El pago de la cotizacion vive en /checkout, junto con el del carrito: antes este
   * componente tenia su propia copia de direccion, documento tributario y llamada de
   * checkout. Los datos de display viajan en el state para pintar la vista al instante;
   * si se entra por URL directa, el checkout los recupera solo.
   */
  const goToQuoteCheckout = () => {
    navigate(checkoutPath({ cotizacion: quote.id }), {
      state: {
        quoteContext: {
          conversacionId: quote.id,
          productoId: quote.productoId,
          productoNombre: productName,
          productoImagenUrl: productImage,
          proveedorId: storeId,
          tiendaNombre: storeName,
        },
      },
    });
  };

  // La burbuja del documento va en su lugar segun la hora en que se envio la cotizacion, no
  // siempre al final: despues de una solicitud de modificacion quedaba debajo de ella.
  const documentBubble = activeQuote ? <div className={`quote-ws-message-row ${mode === 'seller' ? 'mine' : ''}`}><span className="quote-ws-message-avatar">{storePhoto ? <img src={storePhoto} alt="" referrerPolicy="no-referrer" /> : initials(storeName)}</span><div className="quote-ws-bubble quote-ws-document-bubble"><p>Te adjunto la propuesta comercial con todos los detalles de la cotización.</p><button type="button" className="quote-ws-file" onClick={viewDocument}><FileText size={25} /><span><strong>{documentName}</strong><small>PDF · Documento de cotización</small></span><Eye size={18} /></button><small>{formatDate(activeQuote.vigenteDesde || activeQuote.createdAt)}</small></div></div> : null;
  const documentTime = activeQuote ? new Date(activeQuote.vigenteDesde || activeQuote.createdAt).getTime() : NaN;
  const documentBubbleIndex = !activeQuote
    ? -1
    : Number.isNaN(documentTime)
      ? messages.length
      : (() => {
        const later = messages.findIndex((message) => new Date(message.createdAt).getTime() > documentTime);
        return later === -1 ? messages.length : later;
      })();

  return (
    <div className="quote-workspace" role="dialog" aria-modal="true" aria-label={`Chat de cotización ${quoteIdShort}`}>
      <header className="quote-ws-topbar">
        <button type="button" className="quote-ws-brand" onClick={onClose} aria-label="Volver al perfil"><RepuesTopLogo height={44} /></button>
        <div className="quote-ws-account"><span className="quote-ws-account-avatar">{myPhoto ? <img src={myPhoto} alt="" referrerPolicy="no-referrer" /> : initials(user?.userName || user?.nombre || participantName)}</span><div><strong>{user?.userName || user?.nombre || 'Mi cuenta'}</strong><small>{mode === 'seller' ? 'Vendedor' : 'Comprador'}</small></div><button type="button" onClick={onClose}><X size={18} /></button></div>
      </header>

      {statusMessage && <div className={`quote-ws-toast ${statusMessage.type}`}><span>{statusMessage.text}</span><button type="button" onClick={() => setStatusMessage(null)}><X size={15} /></button></div>}

      <div className="quote-ws-layout">
        <aside className="quote-ws-left">
          <button type="button" className="quote-ws-back" onClick={onClose}><ArrowLeft size={16} /> Volver a mis cotizaciones</button>
          <section className="quote-ws-side-card quote-ws-summary-card">
            <div className="quote-ws-id"><span><FileText size={24} /></span><div><small>Cotización</small><strong>#{quoteIdShort}</strong></div><em>{closed ? 'Cerrada' : 'Activa'}</em></div>
            <DataRow icon={CalendarDays} label="Fecha de solicitud" value={formatDate(quote.ultimoMensajeFecha || quote.createdAt, true)} />
            <button type="button" className="quote-ws-store" onClick={openStore} disabled={!storeId} aria-label={`Ver tienda ${storeName}`}><div className="quote-ws-avatar">{storePhoto ? <img src={storePhoto} alt={storeName} /> : <Store size={22} />}</div><div><small>Tienda vendedora</small><strong>{storeName}</strong><span><BadgeCheck size={12} /> Verificada</span></div><ChevronRight className="quote-ws-store-arrow" size={19} /></button>
            <button type="button" className="quote-ws-product-mini" onClick={openProduct}>{productImage ? <img src={productImage} alt={productName} /> : <Package size={25} />}<div><small>Producto cotizado</small><strong>{productName}</strong><span>Producto #{quote.productoId || '—'}</span></div><ChevronRight size={18} /></button>
            <DataRow icon={Package} label="Cantidad solicitada" value={requested.requestedQty} />
            <DataRow icon={Truck} label="Método de envío" value={requested.requestedDeliveryTerms || 'Por confirmar'} />
            <DataRow icon={Car} label="Patente" value={requested.requestedPlate || 'No informada'} />
            <DataRow icon={ShieldCheck} label="Chasis" value={requested.requestedChassis || (requested.requestedPlate ? 'No identificado' : 'No informado')} />
            <DataRow icon={MessageSquare} label="Nota del comprador" value={requested.requestedNotes || 'Sin nota adicional'} />
          </section>
        </aside>

        <main className="quote-ws-chat">
          <header className="quote-ws-chat-header">
            <div className="quote-ws-person"><span>{participantPhoto ? <img src={participantPhoto} alt={participantName} /> : initials(participantName)}</span><div><strong>{participantName}</strong><small>{mode === 'buyer' ? 'Vendedor verificado' : 'Comprador'} <i /> En línea</small></div></div>
            <div className="quote-ws-chat-actions">
              {(() => {
                const isBuyerPayReady = mode === 'buyer' && Boolean(activeQuote) && !paused;
                if (purchased) {
                  return (
                    <button
                      type="button"
                      className="quote-ws-details-button"
                      onClick={() => navigate(profilePurchasePath(purchasedOrderId))}
                    >
                      <PackageCheck size={17} />
                      <span>Compra realizada · Ver pedido</span>
                    </button>
                  );
                }
                return (
                  <button
                    type="button"
                    className={`quote-ws-details-button ${isBuyerPayReady ? 'pay-ready' : ''}`}
                    disabled={mode === 'buyer' && !activeQuote}
                    onClick={() => (mode === 'seller' ? setQuoteEditorOpen(true) : setQuotePreviewOpen(true))}
                  >
                    {isBuyerPayReady ? (
                      <>
                        <CreditCard size={16} />
                        <span>Revisar y pagar</span>
                      </>
                    ) : mode === 'seller' ? (
                      <>
                        <Eye size={17} />
                        <span>Ver detalles de la cotización</span>
                      </>
                    ) : paused ? (
                      <>
                        <PauseCircle size={17} />
                        <span>Cotización en pausa</span>
                      </>
                    ) : (
                      <>
                        <Eye size={17} />
                        <span>Esperando cotización</span>
                      </>
                    )}
                  </button>
                );
              })()}
              {/* "Gestionar" (5-oct): antes eran tres puntos que pasaban desapercibidos. Desde aqui se
                  gestiona todo (ver la solicitud o la cotizacion, responder o cancelar una
                  modificacion, eliminar, ayuda y reporte), asi la vista del chat queda limpia. */}
              <button type="button" className="quote-ws-manage-button" aria-label={paused ? 'Gestionar cotización, hay una acción pendiente' : 'Gestionar cotización'} aria-expanded={optionsOpen} onClick={() => setOptionsOpen(true)}><Settings2 size={17} /><span>Gestionar</span>{paused && <i className="quote-ws-manage-dot" aria-hidden="true" />}</button>
            </div>
          </header>

          {/* Avisos sobre los mensajes en un solo contenedor: el chat es una grilla de 4 filas
              (encabezado, avisos, mensajes, caja de texto). Con el aviso de modificacion como hijo
              suelto caia en la fila de los mensajes, que se encoge a 0, y su texto quedaba debajo
              de las burbujas. */}
          <div className="quote-ws-notices">
            <div className="quote-ws-private"><Info size={19} /><div><strong>Este chat es privado y está asociado a la cotización #{quoteIdShort}.</strong><span>Aquí podrás resolver dudas, solicitar ajustes o confirmar tu compra. El soporte, los reclamos y la mediación de RepuesTop solo cubren compras pagadas dentro de RepuesTop. No pagues ni coordines la compra por fuera.</span></div></div>

            {paused && (
              <section className="quote-ws-paused" aria-live="polite">
                <PauseCircle size={20} />
                <div>
                  <strong>{mode === 'buyer' ? 'Cotización en pausa: pediste una modificación' : 'El comprador pidió una modificación'}</strong>
                  <span>
                    {mode === 'buyer'
                      ? 'Avisamos a la tienda. No puedes pagar hasta que te envíe una nueva o confirme que la mantiene.'
                      : 'Tu cotización está en pausa: el comprador no puede pagarla hasta que respondas.'}
                  </span>
                  {requestChanges.length > 0 && (
                    <ul>
                      {requestChanges.map((change) => (
                        <li key={change.label}><small>{change.label}</small><b>{change.before} → {change.after}</b></li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}
            {!paused && modification?.resolucion === 'MANTENIDA' && activeQuote && !closed && (
              <section className="quote-ws-paused kept">
                <Info size={20} />
                <div>
                  <strong>{mode === 'buyer' ? 'La tienda mantuvo la cotización original' : 'Mantuviste tu cotización original'}</strong>
                  <span>{modification.motivo ? `Motivo: ${modification.motivo}` : 'La cotización vuelve a estar disponible para pagar.'}</span>
                </div>
              </section>
            )}
          </div>

          <div className="quote-ws-messages">
            {isLoadingMessages ? <div className="quote-messages-loading"><Loader2 size={20} className="spin-icon" /> Cargando conversación...</div> : messages.map((message, index) => {
              const isBuyer = Number(message.emisorId) === Number(quote.usuarioId);
              const mine = mode === 'buyer' ? isBuyer : !isBuyer;
              const bubblePhoto = mine ? myPhoto : participantPhoto;
              const bubbleInitials = mine ? initials(user?.userName || user?.nombre) : initials(participantName);
              return <React.Fragment key={message.id}>{index === documentBubbleIndex && documentBubble}<div className={`quote-ws-message-row ${mine ? 'mine' : ''}`}><span className="quote-ws-message-avatar">{bubblePhoto ? <img src={bubblePhoto} alt="" referrerPolicy="no-referrer" /> : bubbleInitials}</span><div className="quote-ws-bubble">{message.imagenUrl && <button type="button" className="quote-ws-image-open" onClick={() => setViewerImage(resolveMediaUrl(message.imagenUrl))} title="Ver imagen completa"><img src={resolveMediaUrl(message.imagenUrl)} alt="Adjunto" /><span><Maximize2 size={15} /></span></button>}{message.texto && <p>{message.texto}</p>}<small>{formatDate(message.createdAt)} {mine ? '✓✓' : ''}</small></div></div></React.Fragment>;
            })}
            {!isLoadingMessages && documentBubbleIndex === messages.length && documentBubble}
          </div>

          {!chatLocked ? (
            <form className="quote-ws-composer" onSubmit={submitChatMessage}>
              <ChatImagePreview
                previewUrl={selectedImagePreview}
                fileName={selectedImageFile?.name}
                fileSize={selectedImageFile?.size}
                onRemove={removeSelectedImage}
              />
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleImageSelected}
              />
              <textarea
                ref={chatTextareaRef}
                value={chatMessage}
                onChange={(event) => setChatMessage(event.target.value)}
                placeholder={canWriteText
                  ? 'Escribe tu mensaje o adjunta una imagen...'
                  : 'Podrás escribir cuando la tienda responda. Mientras tanto puedes adjuntar fotos de la pieza.'}
                maxLength={MAX_CHAT_MESSAGE}
                rows="2"
                disabled={!canWriteText}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || Boolean(selectedImageFile) || !canAttach}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', color: '#475569', cursor: 'pointer' }}
                    title="Adjuntar imagen"
                  >
                    <Paperclip size={14} /> {imageCount >= MAX_CHAT_IMAGES ? `Máximo ${MAX_CHAT_IMAGES} fotos` : 'Adjuntar foto'}
                  </button>
                  <span>
                    <Lock size={12} />
                    {canWriteText
                      ? 'Conversación segura y privada.'
                      : `Hasta 3 MB y ${MAX_CHAT_IMAGES} fotos por conversación (${imageCount}/${MAX_CHAT_IMAGES}).`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <small>{chatMessage.length}/{MAX_CHAT_MESSAGE}</small>
                  <button type="submit" disabled={isSending || (!chatMessage.trim() && !selectedImageFile)}>
                    {isSending ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
                    <span>{isUploadingImage ? 'Subiendo...' : 'Enviar'}</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="quote-chat-closed">
              <Lock size={16} />
              {closed
                ? 'Esta conversación está cerrada.'
                : 'La cotización venció, así que este chat quedó cerrado. Puedes pedir una nueva desde la ficha del producto.'}
            </div>
          )}
        </main>

        <aside className="quote-ws-right">
          <section className="quote-ws-side-card quote-ws-product-card">
            <h3>Detalles del producto</h3>
            <div className="quote-ws-product-head">{productImage ? <img src={productImage} alt={productName} /> : <Package size={28} />}<div><strong>{productName}</strong><span>Producto #{quote.productoId || '—'}</span></div></div>
            <DataRow icon={ShieldCheck} label="Estado" value="Publicado" />
            <DataRow icon={BadgeDollarSign} label="Precio cotizado" value={activeQuote ? formatCLP(activeQuote.precioFinal ?? activeQuote.precio) : 'Por definir'} />
            <button type="button" className="quote-ws-outline-button" onClick={openProduct}><ExternalLink size={15} /> Ver ficha completa</button>
            {/* Pedir un ajuste escribe en el chat, asi que sigue la misma suerte: sin
                chat no hay a quien pedirselo. */}
            {mode === 'buyer' && (
              <button
                type="button"
                className="quote-ws-primary-button"
                disabled={!canWriteText || paused}
                title={chatLocked
                  ? 'La cotización ya no admite cambios'
                  : paused ? 'Ya pediste una modificación. Cancélala para pedir otra.'
                  : !canWriteText ? 'Podrás escribir cuando la tienda responda' : undefined}
                onClick={openModificationRequest}
              >
                <Pencil size={15} /> Solicitar modificación
              </button>
            )}
          </section>

          <section className="quote-ws-side-card quote-ws-files-card">
            <h3>Archivos y documentos</h3>
            {activeQuote ? <div className="quote-ws-document-card"><FileText size={27} /><span><strong>{documentName}</strong><small>PDF · Generado al enviar</small></span><button type="button" onClick={viewDocument} title="Ver cotización"><Eye size={17} /></button><button type="button" onClick={downloadDocument} title="Descargar cotización"><Download size={17} /></button></div> : <div className="quote-ws-no-files"><FileText size={25} /><span><strong>Aún no hay documentos</strong><small>La cotización aparecerá aquí cuando el vendedor la cree y envíe.</small></span></div>}
          </section>

          <section className="quote-ws-help"><Headphones size={25} /><div><strong>¿Necesitas ayuda?</strong><span>Si tienes dudas sobre la cotización o el proceso, puedes contactarnos.</span><button type="button" onClick={openHelp}>Ir a ayuda <ChevronRight size={13} /></button></div></section>
        </aside>
      </div>

      {/* Menu "Gestionar cotizacion" (5-oct): las mismas opciones, nombres y descripciones que en la
          app (quote-chat y seller-messages), en el mismo orden. */}
      {optionsOpen && <div className="quote-ws-dialog-backdrop quote-ws-options-backdrop" onClick={() => setOptionsOpen(false)}><section className="quote-ws-options-dialog" role="dialog" aria-modal="true" aria-label="Gestionar cotización" onClick={(event) => event.stopPropagation()}><header><strong>Gestionar cotización</strong><button type="button" aria-label="Cerrar opciones" onClick={() => setOptionsOpen(false)}><X size={19} /></button></header><div>
        {mode === 'buyer' && paused && <button type="button" className="highlight" disabled={isCancellingModification} onClick={() => { setOptionsOpen(false); cancelModification(); }}><span><Undo2 size={20} /></span><div><strong>{isCancellingModification ? 'Cancelando…' : 'Cancelar solicitud y retomar la cotización'}</strong><small>Vuelves a la cotización original y podrás pagarla</small></div><ChevronRight size={18} /></button>}
        {mode === 'seller' && paused && activeQuote && <button type="button" className="highlight" onClick={() => { setOptionsOpen(false); setQuoteEditorOpen(true); }}><span><BadgeDollarSign size={20} /></span><div><strong>Enviar nueva cotización</strong><small>Responde la modificación con una cotización nueva</small></div><ChevronRight size={18} /></button>}
        {mode === 'seller' && paused && activeQuote && <button type="button" onClick={() => { setOptionsOpen(false); setKeepOriginalError(''); setKeepOriginalOpen(true); }}><span><CheckCircle2 size={20} /></span><div><strong>Mantener la cotización original</strong><small>El comprador vuelve a poder pagarla</small></div><ChevronRight size={18} /></button>}
        <button type="button" onClick={() => { setOptionsOpen(false); setRequestSummaryOpen(true); }}><span><ClipboardList size={20} /></span><div><strong>Ver solicitud</strong><small>Unidades, envío y vehículo pedidos</small></div><ChevronRight size={18} /></button>
        {activeQuote && <button type="button" onClick={() => { setOptionsOpen(false); if (mode === 'buyer') setQuotePreviewOpen(true); else viewDocument(); }}><span><FileText size={20} /></span><div><strong>Ver cotización</strong><small>Precio, envío, vigencia y documento</small></div><ChevronRight size={18} /></button>}
        {mode === 'buyer' && activeQuote && <button type="button" onClick={() => { setOptionsOpen(false); shareQuoteLink(); }}><span><Share2 size={20} /></span><div><strong>Compartir cotización</strong><small>Envía un enlace para ver o descargar el PDF</small></div><ChevronRight size={18} /></button>}
        {mode === 'buyer' && activeQuote && !purchased && !paused && !closed && !expired && <button type="button" onClick={() => { setOptionsOpen(false); goToQuoteCheckout(); }}><span><CreditCard size={20} /></span><div><strong>Revisar y pagar</strong><small>Paga la cotización con la compra protegida</small></div><ChevronRight size={18} /></button>}
        {mode === 'buyer' && canWriteText && activeQuote && !paused && !closed && !expired && <button type="button" onClick={() => { setOptionsOpen(false); openModificationRequest(); }}><span><Pencil size={20} /></span><div><strong>Solicitar modificación</strong><small>Pide otra cantidad, envío o vehículo</small></div><ChevronRight size={18} /></button>}
        {mode === 'seller' && !paused && !closed && <button type="button" onClick={() => { setOptionsOpen(false); setQuoteEditorOpen(true); }}><span><Pencil size={20} /></span><div><strong>{activeQuote ? 'Editar cotización' : 'Enviar cotización'}</strong><small>{activeQuote ? 'Cambia precio, envío o vigencia' : 'Responde la solicitud con precio y envío'}</small></div><ChevronRight size={18} /></button>}
        <button type="button" onClick={() => { openHelp(); }}><span><CircleHelp size={20} /></span><div><strong>Ayuda</strong><small>Obtén asistencia con esta cotización</small></div><ChevronRight size={18} /></button>
        {mode === 'seller' && activeQuote && !closed && <button type="button" className="danger" disabled={isDeletingQuote} onClick={() => { deleteQuote(); }}><span><Trash2 size={20} /></span><div><strong>Eliminar cotización</strong><small>El comprador dejará de verla y no podrá pagarla</small></div><ChevronRight size={18} /></button>}
        <button type="button" className="danger" onClick={() => { setOptionsOpen(false); setReportOpen(true); }}><span><Flag size={20} /></span><div><strong>Reportar {mode === 'seller' ? 'comprador' : 'vendedor'}</strong><small>Informa una conducta que incumple las normas</small></div><ChevronRight size={18} /></button>
      </div></section></div>}

      {reportOpen && <div className="quote-ws-dialog-backdrop" onClick={() => !isSubmittingReport && setReportOpen(false)}><form className="quote-ws-report-dialog" onSubmit={submitReport} onClick={(event) => event.stopPropagation()}><header><div><Flag size={22} /><span><strong>Reportar conversación</strong><small>Selecciona el motivo del reporte. Tu reporte es confidencial.</small></span></div><button type="button" aria-label="Cerrar reporte" disabled={isSubmittingReport} onClick={() => setReportOpen(false)}><X size={19} /></button></header><div className="quote-ws-report-body"><fieldset><legend>Motivo del reporte</legend>{REPORT_REASONS.map((reason) => <label key={reason} className={reportReason === reason ? 'selected' : ''}><input type="radio" name="reportReason" value={reason} checked={reportReason === reason} onChange={(event) => setReportReason(event.target.value)} /><span>{reason}</span><i /></label>)}</fieldset><label className="quote-ws-report-detail"><span>Detalle adicional (opcional)</span><textarea rows="3" maxLength="500" value={reportDetail} onChange={(event) => setReportDetail(event.target.value)} placeholder="Cuéntanos qué ocurrió..." /><small>{reportDetail.length}/500</small></label></div><footer><button type="button" className="secondary" disabled={isSubmittingReport} onClick={() => setReportOpen(false)}>Cancelar</button><button type="submit" disabled={!reportReason || isSubmittingReport}>{isSubmittingReport ? <Loader2 size={17} className="spin-icon" /> : <Flag size={17} />} {isSubmittingReport ? 'Enviando...' : 'Enviar reporte'}</button></footer></form></div>}

      {reportSuccessOpen && <div className="quote-ws-dialog-backdrop" onClick={() => setReportSuccessOpen(false)}><section className="quote-ws-report-success" role="dialog" aria-modal="true" aria-label="Reporte enviado" onClick={(event) => event.stopPropagation()}><span><CheckCircle2 size={34} /></span><h3>Reporte enviado</h3><p>Hemos recibido tu reporte de manera confidencial y lo revisaremos a la brevedad.</p><button type="button" onClick={() => setReportSuccessOpen(false)}>Entendido</button></section></div>}

      {quoteEditorOpen && <div className="quote-ws-dialog-backdrop" onClick={() => setQuoteEditorOpen(false)}>
        <form className="quote-ws-quote-dialog quote-ws-editor-dialog" onSubmit={submitQuote} onClick={(event) => event.stopPropagation()}>
          <header className="quote-editor-header">
            <div><span className="quote-editor-title-icon"><BadgeDollarSign size={25} /></span><span><strong>{activeQuote ? 'Editar cotización' : 'Crear cotización'}</strong><small>Completa los datos para generar y enviar la propuesta al comprador.</small></span></div>
            <button type="button" aria-label="Cerrar formulario" onClick={() => setQuoteEditorOpen(false)}><X size={21} /></button>
          </header>

          <div className="quote-editor-body">
            <section className="quote-editor-request">
              {/* La foto del comprador, el mismo avatar que ya muestran la tarjeta del listado
                  (`QuoteCard`) y el chat: este editor era el unico punto del flujo donde se perdia.
                  Va como hijo DIRECTO de la seccion porque `.quote-editor-request > svg` apunta al
                  icono de respaldo con `>`: envolverlo dejaria al fallback sin su circulo.
                  Al PDF no se lleva a proposito -- ese documento se descarga y se reenvia, y la foto
                  de una persona natural no deberia salir de la plataforma. */}
              {buyerPhoto
                ? <img className="quote-editor-request-avatar" src={buyerPhoto} alt="" referrerPolicy="no-referrer" />
                : <CircleUserRound size={25} />}
              <div className="quote-editor-request-content">
                <strong>Solicitud del comprador</strong>
                <div className="quote-editor-request-grid">
                  <span><small>Producto</small><b>{productName}</b></span>
                  <span><small>Cantidad solicitada</small><b>{requested.requestedQty}</b></span>
                  <span><small>Método de envío solicitado</small><b>{requested.requestedDeliveryTerms || 'Por confirmar'}</b></span>
                  <span><small>Patente</small><b>{requested.requestedPlate || 'No informada'}</b></span>
                  <span><small>Chasis del vehículo</small><b>{requested.requestedChassis || (requested.requestedPlate ? 'No identificado' : 'No informado')}</b></span>
                  <span><small>Nota del comprador</small><b>{requested.requestedNotes || 'Sin nota adicional'}</b></span>
                </div>
              </div>
            </section>

            <div className="quote-editor-pricing-layout">
              <div className="quote-editor-pricing-fields">
                <div className="quote-editor-price-row">
                  <label><span>Precio por unidad <Info size={13} /></span><div className="quote-editor-money-input"><i>$</i><input type="number" min="1" max="99999999" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value.replace(/[^0-9]/g, '').slice(0, 8))} required /></div></label>
                  <label><span>Cantidad solicitada <Lock size={13} /></span><div className="quote-locked-field">{requested.requestedQty}<Lock size={15} /></div></label>
                </div>
                <label><span>Descuento o rebaja total (opcional)</span><div className="quote-editor-money-input"><i>$</i><input type="number" min="0" max="99999999" value={discount} onChange={(event) => setDiscount(event.target.value.replace(/[^0-9]/g, '').slice(0, 8))} /></div><small>Dejar en 0 si no aplica descuento.</small></label>
                {/* Mismo desglose y calculadora inversa que la carga de productos y la
                    app: cotizar a ciegas es como el vendedor termina cobrando menos de
                    lo que cree. `onApplySuggested` escribe el precio por unidad. */}
                <CommissionSummaryCard
                  basePrice={finalPrice + (isLocalDelivery ? localShippingCost : 0)}
                  shippingCost={isLocalDelivery ? localShippingCost : 0}
                  isFounder={Boolean(isFounder ?? user?.founder ?? user?.fundador)}
                  suggestedContextLabel="Precio sugerido a COBRAR para recibir este líquido (no es lo que vas a publicar ni recibir tal cual; al presionar Aplicar se ajusta el precio por unidad):"
                  onApplySuggested={(value) => setUnitPrice(String(Math.min(Math.ceil((Math.max(0, value - (isLocalDelivery ? localShippingCost : 0)) + normalizedDiscount) / quantity), 99999999)))}
                />
              </div>
              <aside className="quote-editor-total-card">
                <span><small>Subtotal ({requested.requestedQty})</small><b>{formatCLP(subtotal)}</b></span>
                <span><small>Descuento o rebaja</small><b className="discount">−{formatCLP(normalizedDiscount)}</b></span>
                {isLocalDelivery && <span><small>Despacho dentro de la comuna</small><b>{formatCLP(localShippingCost)}</b></span>}
                <div><strong>Total a pagar</strong><b>{formatCLP(finalPrice + (isLocalDelivery ? localShippingCost : 0))}</b></div>
              </aside>
            </div>

            <div className="quote-editor-fields-grid">
              <label><span>Disponibilidad</span><select value={availability} onChange={(event) => setAvailability(event.target.value)}>{QUOTE_AVAILABILITY_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
              {/* La condicion de entrega la eligio el COMPRADOR al pedir la cotizacion:
                  el vendedor cotiza sobre esa condicion, no la cambia. Se muestra
                  bloqueada igual que la cantidad, que ya funcionaba asi. */}
              {requested.hasRequestedDeliveryTerms
                ? <label><span>Método de envío solicitado <Lock size={13} /></span><div className="quote-locked-field">{deliveryTerms}<Lock size={15} /></div></label>
                : <label><span>Método de envío</span><select value={deliveryTerms} onChange={(event) => setDeliveryTerms(event.target.value)} required><option value="">Selecciona el método</option>{QUOTE_DELIVERY_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>}
              {isLocalDelivery && <label><span>Costo del envío local configurado</span><div className="quote-locked-field">{deliveryCost ? formatCLP(deliveryCost) : 'Sin tarifa configurada'}<Lock size={15} /></div><small>Se obtiene desde los métodos de envío de Mi tienda y datos.</small></label>}
              <label><span>Garantía</span><select value={warranty} onChange={(event) => setWarranty(event.target.value)}>{QUOTE_WARRANTY_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label><span>Vigencia</span><select value={validity} onChange={(event) => setValidity(event.target.value)}>{QUOTE_VALIDITY_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
            </div>

            <label className="quote-editor-notes"><span>Nota adicional (opcional)</span><textarea rows="3" value={responseNotes} onChange={(event) => setResponseNotes(event.target.value)} maxLength="500" placeholder="Incluye condiciones, detalles de entrega, información de pago u otros comentarios relevantes..." /><small>{responseNotes.length}/500</small></label>
            <div className="quote-editor-info"><Info size={18} /><span>Esta cotización será enviada a ambos participantes. Puede incluir condiciones de entrega, garantía y pago acordadas.</span></div>
          </div>

          <footer className="quote-editor-footer"><button type="button" className="quote-editor-cancel" onClick={() => setQuoteEditorOpen(false)}>Cancelar</button><button className="quote-editor-submit" type="submit" disabled={isSending || closed}>{isSending ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />} {isSending ? 'Guardando...' : activeQuote ? 'Actualizar y enviar cotización' : 'Crear y enviar cotización'}</button></footer>
        </form>
      </div>}

      {viewerImage && (
        <div className="quote-ws-dialog-backdrop quote-ws-image-viewer" onClick={() => setViewerImage(null)}>
          <div className="quote-ws-image-viewer-body" onClick={(event) => event.stopPropagation()}>
            <header>
              <a href={viewerImage} download target="_blank" rel="noreferrer">
                <Download size={16} /> Descargar
              </a>
              <button type="button" onClick={() => setViewerImage(null)} aria-label="Cerrar">
                <X size={20} />
              </button>
            </header>
            <img src={viewerImage} alt="Adjunto de la conversación" />
          </div>
        </div>
      )}

      {modificationOpen && modificationForm && (
        <div className="modal-backdrop quote-request-backdrop" onClick={() => setModificationOpen(false)}>
          <section
            className="quote-request-modal quote-ws-modification-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modification-request-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close-btn quote-request-close"
              type="button"
              onClick={() => setModificationOpen(false)}
              aria-label="Cerrar"
            >
              <X size={28} />
            </button>

            <header className="quote-request-header">
              <div className="quote-request-header-icon"><Pencil className="quote-request-header-file" size={30} /></div>
              <div className="quote-request-header-copy">
                <span>COTIZACIÓN CON LA TIENDA</span>
                <h2 id="modification-request-title">Solicitar modificación</h2>
                <p>Ajusta los datos de tu solicitud y la tienda te enviará una cotización nueva.</p>
              </div>
            </header>

            <div className="quote-request-content">
              <form className="quote-request-form" onSubmit={submitModificationRequest}>
                {activeQuote && (
                  <div className="quote-ws-pause-notice">
                    <PauseCircle size={20} />
                    <div>
                      <strong>Tu cotización actual quedará en pausa</strong>
                      <span>No podrás pagarla hasta que la tienda responda. Si cambias de idea, cancela la solicitud y la retomas mientras siga vigente.</span>
                    </div>
                  </div>
                )}
                <div className="quote-request-section-title">
                  <ClipboardList size={22} />
                  <div><strong>Detalle de tu solicitud</strong><small>Estos datos quedarán visibles para el vendedor.</small></div>
                </div>

                <div className="quote-request-grid">
                  <label>
                    <span>Cantidad</span>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={modificationForm.quantity}
                      onChange={(event) => updateModificationField('quantity', event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Método de envío *</span>
                    <select
                      value={modificationForm.shippingMethod}
                      onChange={(event) => updateModificationField('shippingMethod', event.target.value)}
                      required
                    >
                      <option value="">Selecciona una opción</option>
                      {modificationShippingOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                </div>

                <label>
                  <span>Patente o chasis (opcional)</span>
                  <input
                    value={modificationForm.chassis}
                    onChange={(event) => updateModificationField('chassis', event.target.value.toUpperCase())}
                    maxLength="30"
                    placeholder="Ej. BBCL12 o VIN"
                  />
                </label>
                <label>
                  <span>Nota para el vendedor (opcional)</span>
                  <textarea
                    rows="3"
                    value={modificationForm.notes}
                    onChange={(event) => updateModificationField('notes', event.target.value)}
                    maxLength="500"
                    placeholder="Marca preferida, urgencia u otra información útil..."
                  />
                </label>

                {modificationError && <div className="modal-form-error"><AlertTriangle size={16} /><span>{modificationError}</span></div>}

                <button type="submit" disabled={modificationSubmitting} className="btn-submit-ticket">
                  <Send size={20} />
                  <span>{modificationSubmitting ? 'Enviando…' : 'Pedir modificación a la tienda'}</span>
                </button>
              </form>
            </div>
          </section>
        </div>
      )}

      {keepOriginalOpen && (
        <div className="quote-ws-dialog-backdrop" onClick={() => !isKeepingOriginal && setKeepOriginalOpen(false)}>
          <form className="quote-ws-report-dialog quote-ws-keep-dialog" onSubmit={submitKeepOriginal} onClick={(event) => event.stopPropagation()}>
            <header>
              <div><FileText size={22} /><span><strong>Mantener la cotización original</strong><small>Tu cotización vuelve a quedar disponible para pagar, tal como la enviaste.</small></span></div>
              <button type="button" aria-label="Cerrar" disabled={isKeepingOriginal} onClick={() => setKeepOriginalOpen(false)}><X size={19} /></button>
            </header>
            <div className="quote-ws-report-body">
              <div className="quote-ws-keep-reasons">
                {KEEP_ORIGINAL_REASONS.map((reason) => (
                  <button key={reason} type="button" className={keepOriginalReason === reason ? 'selected' : ''} onClick={() => setKeepOriginalReason(keepOriginalReason === reason ? '' : reason)}>{reason}</button>
                ))}
              </div>
              <label className="quote-ws-report-detail">
                <span>Motivo (se lo mostraremos al comprador)</span>
                <textarea rows="3" maxLength="300" value={keepOriginalReason} onChange={(event) => setKeepOriginalReason(event.target.value)} placeholder="Ej. Solo me quedan 2 unidades de este repuesto." />
                <small>{keepOriginalReason.length}/300</small>
              </label>
              {keepOriginalError && <div className="modal-form-error"><AlertTriangle size={16} /><span>{keepOriginalError}</span></div>}
            </div>
            <footer>
              <button type="button" className="secondary" disabled={isKeepingOriginal} onClick={() => setKeepOriginalOpen(false)}>Volver</button>
              <button type="submit" disabled={isKeepingOriginal}>{isKeepingOriginal ? <Loader2 size={17} className="spin-icon" /> : <CheckCircle2 size={17} />} {isKeepingOriginal ? 'Guardando…' : 'Mantener cotización'}</button>
            </footer>
          </form>
        </div>
      )}

      {requestSummaryOpen && (
        <div className="quote-ws-dialog-backdrop" onClick={() => setRequestSummaryOpen(false)}>
          <section className="quote-ws-quote-dialog quote-ws-preview-dialog" role="dialog" aria-modal="true" aria-label="Solicitud del comprador" onClick={(event) => event.stopPropagation()}>
            <header><div><ClipboardList size={22} /><span><strong>Solicitud del comprador</strong><small>Cotización #{quoteIdShort}</small></span></div><button type="button" aria-label="Cerrar" onClick={() => setRequestSummaryOpen(false)}><X size={20} /></button></header>
            <div className="quote-ws-dialog-body">
              <DataRow icon={Package} label="Cantidad solicitada" value={requested.requestedQty} />
              <DataRow icon={Truck} label="Método de envío" value={requested.requestedDeliveryTerms || 'Por confirmar'} />
              <DataRow icon={Car} label="Patente" value={requested.requestedPlate || 'No informada'} />
              <DataRow icon={ShieldCheck} label="Chasis" value={requested.requestedChassis || (requested.requestedPlate ? 'No identificado' : 'No informado')} />
              <DataRow icon={MessageSquare} label="Nota del comprador" value={requested.requestedNotes || 'Sin nota adicional'} />
            </div>
          </section>
        </div>
      )}

      {quotePreviewOpen && activeQuote && <div className="quote-ws-dialog-backdrop" onClick={() => setQuotePreviewOpen(false)}><section className="quote-ws-quote-dialog quote-ws-preview-dialog" onClick={(event) => event.stopPropagation()}><header><div><FileText size={22} /><span><strong>Detalle de la cotización</strong><small><CalendarClock size={13} /> {quoteExpirationLabel(activeQuote, now)}</small></span></div><button type="button" onClick={() => setQuotePreviewOpen(false)}><X size={20} /></button></header><div className="quote-ws-dialog-body"><div className="quote-ws-preview-price"><small>Total a pagar{quoteShippingCost > 0 ? ' (productos + despacho)' : ''}</small><strong>{formatCLP(quoteChargeBase(activeQuote))}</strong></div><DataRow icon={Package} label="Cantidad" value={activeQuote.cantidad} /><DataRow icon={CheckCircle2} label="Disponibilidad" value={activeQuote.disponibilidad} /><DataRow icon={Truck} label="Método de envío" value={deliveryTermsLabel(activeQuote.condicionesEntrega)} />{quoteShippingCost > 0 && <DataRow icon={CreditCard} label="Despacho dentro de la comuna" value={formatCLP(quoteShippingCost)} />}{Number(activeQuote.descuento) > 0 && <DataRow icon={Tag} label="Descuento" value={`-${formatCLP(activeQuote.descuento)}`} />}<DataRow icon={ShieldCheck} label="Garantía" value={activeQuote.garantia} /><DataRow icon={FileText} label="Notas" value={activeQuote.notas} /><div className="quote-ws-preview-document"><button type="button" onClick={viewDocument}><Eye size={16} /> Ver PDF</button><button type="button" onClick={downloadDocument}><Download size={16} /> Descargar PDF</button></div>{mode === 'buyer' && paused && <p className="quote-ws-preview-paused"><PauseCircle size={16} /> En pausa: pediste una modificación. Espera la respuesta de la tienda o cancela tu solicitud para pagar esta cotización.</p>}{purchased ? <button type="button" className="quote-ws-primary-button" onClick={() => navigate(profilePurchasePath(purchasedOrderId))}><PackageCheck size={16} /> Ver mi compra</button> : mode === 'buyer' && <button type="button" className="quote-ws-primary-button" disabled={expired || closed || paused} onClick={goToQuoteCheckout}><ShoppingCart size={16} /> {expired ? 'Cotización vencida' : paused ? 'Cotización en pausa' : 'Comprar esta cotización'}</button>}</div></section></div>}
    </div>
  );
}
