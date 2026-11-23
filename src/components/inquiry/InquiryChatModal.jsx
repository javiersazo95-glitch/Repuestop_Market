import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Barcode, Car, ChevronDown, ChevronRight, ChevronUp, Copy, ImagePlus, Loader2, Lock, Maximize2, Package, PackagePlus,
  Search, Send, Store, Tags, TrendingUp, User, X, Repeat2,
} from 'lucide-react';
import {
  getConversationApi, getConversationMessagesApi, getSellerFullInventoryApi, markConversationReadApi, markInquiryNoStockApi, offerInquiryExtraProductApi,
  offerInquiryProductApi, resolveMediaUrl, sendConversationMessageApi, uploadConversationImageApi,
} from '../../services/api';
import { compressImageFile } from '../../utils/imageCompression';
import { productPath, profileOrderPath, profilePath, storePath } from '../../routes/paths';
import {
  INQUIRY_KIND_LABEL, formatInquiryPrice, inquiryEventLabel, inquiryStage, inquiryStageLabel, inquiryVehicleIds,
} from '../../utils/inquiry';
import { InquiryStageBadge, RepuestinAvatar } from './InquiryCard';
import NewCatalogProductModal from '../NewCatalogProductModal';
import ChatImagePreview from '../ChatImagePreview';
import { useIsMobile } from '../../hooks/useIsMobile';
import { usePartAssistant } from '../../context/PartAssistantContext';
import '../../styles/inquiry.css';
import { ConditionBadge } from '../ProductCondition';
import { isPreOwned } from '../../data/productConditions';

const MAX_CHAT_MESSAGE = 500;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
/** Cada cuánto se releen los mensajes y la conversación (repuesto ofrecido, "no lo tengo", compra), como la app. */
const REFRESH_MS = 6000;

const HINTS = {
  buyer: {
    waiting: 'La tienda revisará si lo tiene. Te avisamos apenas responda.',
    noStock: 'Prueba con otras casas de repuestos o encárgalo para que todas lo vean.',
    offered: null,
    purchased: 'Compra realizada.',
  },
  seller: {
    waiting: null,
    noStock: null,
    offered: 'El comprador lo compra desde la ficha. Te avisamos cuando pague.',
    purchased: '¡Vendido! Prepara el despacho.',
  },
};

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '?';
const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cabecera de la pregunta (`components/assistant/InquiryPanel.tsx` de la app). */
function InquiryPanel({
  viewer, stage, conversation, busy, collapsible, defaultCollapsed,
  onCreateProduct, onPickProduct, onNoStock, onOpenProduct, onOpenOrder, onChangeProduct,
}) {
  const [collapsed, setCollapsed] = useState(Boolean(collapsible && defaultCollapsed));
  const isSeller = viewer === 'seller';
  const part = conversation.consultaRepuesto || 'Repuesto consultado';
  const vehicle = String(conversation.consultaVehiculo || '').trim();
  const { chassis, hasPlate } = inquiryVehicleIds(conversation);
  const showChassis = Boolean(chassis || hasPlate);
  const hasProduct = Boolean(conversation.productoId) && (stage === 'offered' || stage === 'purchased');
  const productName = conversation.productoNombre || part;
  const productPhoto = resolveMediaUrl(conversation.productoImagenUrl || '');
  const price = formatInquiryPrice(conversation.productoPrecio);
  const [copied, setCopied] = useState(false);

  if (collapsed) {
    const summary = hasProduct ? [productName, price].filter(Boolean).join(' · ') : vehicle;
    return (
      <button type="button" className="inq-panel inq-panel-collapsed" onClick={() => setCollapsed(false)} aria-expanded="false" aria-label={`${INQUIRY_KIND_LABEL}: ${part}. ${inquiryStageLabel(stage, viewer)}. Ver detalle`}>
        {hasProduct && productPhoto ? <img className="inq-thumb-sm" src={productPhoto} alt="" /> : <RepuestinAvatar size={28} />}
        <span className="inq-panel-collapsed-copy"><strong>{part}</strong>{summary && <small>{summary}</small>}</span>
        <InquiryStageBadge stage={stage} viewer={viewer} />
        <ChevronDown size={16} className="inq-chevron" />
      </button>
    );
  }

  const copyChassis = async () => {
    try {
      await navigator.clipboard.writeText(chassis);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Sin permiso de portapapeles: el chasis igual se puede seleccionar a mano.
    }
  };

  const header = (
    <>
      <RepuestinAvatar size={34} />
      <span className="inq-panel-head-copy">
        <small>{INQUIRY_KIND_LABEL.toUpperCase()}</small>
        <strong>{part}</strong>
      </span>
      <InquiryStageBadge stage={stage} viewer={viewer} />
      {collapsible && <ChevronUp size={16} className="inq-chevron" />}
    </>
  );

  const hint = HINTS[viewer][stage];

  return (
    <section className="inq-panel" aria-label={INQUIRY_KIND_LABEL}>
      {collapsible
        ? <button type="button" className="inq-panel-head is-toggle" onClick={() => setCollapsed(true)} aria-expanded="true" aria-label="Minimizar el detalle de la consulta">{header}</button>
        : <div className="inq-panel-head">{header}</div>}

      {(vehicle || showChassis) && (
        <div className="inq-vehicle-box">
          {vehicle && <div className="inq-detail-row"><Car size={14} /><span>{vehicle}</span></div>}
          {showChassis && (
            <div className="inq-detail-row">
              <Barcode size={14} />
              <span className="inq-muted">Chasis</span>
              {chassis ? (
                <>
                  <b className="inq-chassis">{chassis}</b>
                  <button type="button" className="inq-icon-btn" onClick={copyChassis} aria-label="Copiar chasis" title={copied ? 'Copiado' : 'Copiar chasis'}><Copy size={14} /></button>
                  {copied && <small className="inq-copied">Copiado</small>}
                </>
              ) : (
                <span className="inq-muted">{isSeller ? 'No identificado: pídeselo al comprador antes de ofrecer' : 'No identificado'}</span>
              )}
            </div>
          )}
        </div>
      )}

      {hasProduct && (
        <div className="inq-product" role="button" tabIndex={0} onClick={onOpenProduct} onKeyDown={(event) => { if (event.key === 'Enter') onOpenProduct?.(); }} aria-label={`Ver ${productName}`}>
          {productPhoto ? <img className="inq-thumb" src={productPhoto} alt="" /> : <span className="inq-thumb inq-thumb-fallback"><Package size={20} /></span>}
          <span className="inq-product-copy"><strong>{productName}</strong>{price && <b className="inq-price">{price}</b>}</span>
          {!isSeller && stage === 'offered'
            ? <button type="button" className="inq-btn inq-btn-primary inq-btn-sm" onClick={(event) => { event.stopPropagation(); onOpenProduct?.(); }}>Comprar</button>
            : <ChevronRight size={16} className="inq-muted" />}
        </div>
      )}

      {isSeller && stage === 'offered' && onChangeProduct && (
        <button type="button" className="inq-link inq-link-right" onClick={onChangeProduct} disabled={busy}><Repeat2 size={14} /> Cambiar repuesto</button>
      )}

      {isSeller && (stage === 'waiting' || stage === 'noStock') ? (
        <div className="inq-panel-footer">
          {stage === 'noStock' && <p className="inq-muted">Respondiste que no lo tienes. Si lo consigues, ofrécelo igual.</p>}
          <div className="inq-actions-row">
            <button type="button" className="inq-btn inq-btn-primary" onClick={onCreateProduct} disabled={busy}><PackagePlus size={15} /> Cargar y ofrecer</button>
            <button type="button" className="inq-btn inq-btn-outline" onClick={onPickProduct} disabled={busy}>{busy ? <Loader2 size={15} className="spin-icon" /> : <Tags size={15} />} Elegir de mis repuestos</button>
          </div>
          {stage === 'waiting' && onNoStock && <button type="button" className="inq-link inq-link-center" onClick={onNoStock} disabled={busy}>No lo tengo</button>}
        </div>
      ) : (hint || (stage === 'purchased' && onOpenOrder)) ? (
        <div className="inq-hint-row">
          <span className="inq-muted">{hint}</span>
          {stage === 'purchased' && onOpenOrder && <button type="button" className="inq-link" onClick={onOpenOrder}>{isSeller ? 'Ver venta' : 'Ver pedido'}</button>}
        </div>
      ) : null}
    </section>
  );
}

/** Elegir un repuesto del inventario para ofrecer (`components/seller-messages/OfferProductSheet.tsx`). */
function OfferProductPicker({ sellerId, initialQuery, title, busy, onClose, onSelect, onCreateNew }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sellerId) { setError('No pudimos identificar tu tienda.'); setLoading(false); return undefined; }
    const controller = new AbortController();
    getSellerFullInventoryApi(sellerId, { signal: controller.signal })
      .then((items) => setProducts(Array.isArray(items) ? items : []))
      .catch((err) => { if (err?.name !== 'AbortError') setError('No pudimos cargar tus repuestos.'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [sellerId]);

  const nameOf = (product) => product.nombrePublicado || product.repuestoNombre || product.nombre || 'Repuesto';
  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return products;
    const matches = products.filter((product) => {
      const haystack = normalize(`${nameOf(product)} ${product.marcaRepuesto || ''} ${product.skuProveedor || ''} ${product.referenciaOem || ''}`);
      return words.some((word) => haystack.includes(word));
    });
    // Si el texto del comprador no calza con nada, se muestra todo: mejor elegir a mano que una lista vacía.
    return matches.length > 0 ? matches : products;
  }, [products, query]);

  return (
    <div className="inq-sheet-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="inq-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="inq-sheet-head">
          <span><strong>{title}</strong><small>El que busca o uno compatible. El comprador lo compra desde la ficha.</small></span>
          <button type="button" className="inq-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <label className="inq-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en mis repuestos" aria-label="Buscar en mis repuestos" /></label>
        {loading && <div className="inq-loading"><Loader2 size={18} className="spin-icon" /> Cargando tus repuestos…</div>}
        {error && <p className="inq-error">{error}</p>}
        {!loading && (
          <ul className="inq-picker-list">
            {filtered.length === 0 && !error && <li className="inq-muted inq-empty">Aún no tienes repuestos publicados. Crea el que vas a ofrecer.</li>}
            {filtered.map((product) => {
              const quoteOnly = /QUOTE_ONLY|COTIZAR/i.test(String(product.pricingMode || product.modoPrecio || ''));
              const price = quoteOnly ? null : formatInquiryPrice(product.precio ?? product.precioVenta);
              const photo = resolveMediaUrl(product.imageUrls?.[0] || product.imagenUrl || '');
              return (
                <li key={product.id}>
                  <button type="button" disabled={!price || busy} onClick={() => onSelect(product)} aria-label={price ? `Ofrecer ${nameOf(product)}` : `${nameOf(product)}: sin precio, no se puede ofrecer`}>
                    {photo ? <img className="inq-thumb" src={photo} alt="" /> : <span className="inq-thumb inq-thumb-fallback"><Package size={18} /></span>}
                    <span className="inq-product-copy">
                      <strong>{nameOf(product)}</strong>
                      <small>{price ? [price, product.marcaRepuesto, `Stock ${product.stock ?? 0}`].filter(Boolean).join(' · ') : 'Solo cotización: ponle precio para ofrecerlo'}</small>
                    </span>
                    {price && <ChevronRight size={16} className="inq-muted" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="inq-btn inq-btn-outline inq-btn-block" onClick={onCreateNew} disabled={busy}><PackagePlus size={15} /> Cargar un repuesto nuevo</button>
      </section>
    </div>
  );
}

/** Mensaje con otro repuesto ofrecido (`components/assistant/OfferedProductMessage.tsx`). */
function OfferedProductMessage({ product, viewer, onOpen }) {
  const isBuyer = viewer === 'buyer';
  const price = formatInquiryPrice(product.precio);
  const photo = resolveMediaUrl(product.imagenUrl || '');
  return (
    <div className={`inq-offered ${isBuyer ? '' : 'mine'}`}>
      <small className="inq-offered-kicker">{isBuyer ? 'Te ofrece este repuesto' : 'Repuesto ofrecido'}</small>
      <div className="inq-offered-body">
        {photo ? <img className="inq-thumb" src={photo} alt="" /> : <span className="inq-thumb inq-thumb-fallback"><Package size={18} /></span>}
        <span className="inq-product-copy">
          <strong>{product.nombre || 'Repuesto'}</strong>
          {isPreOwned(product.condicion) && <ConditionBadge condition={product.condicion} compact />}
          {price && <b className="inq-price">{price}</b>}
          {product.stock != null && Number(product.stock) <= 0 && <small>Sin stock por ahora</small>}
        </span>
      </div>
      <button type="button" className={`inq-btn ${isBuyer ? 'inq-btn-primary' : 'inq-btn-soft'} inq-btn-block`} onClick={onOpen}>{isBuyer ? 'Ver y comprar' : 'Ver ficha'}</button>
    </div>
  );
}

/**
 * Chat de una pregunta de disponibilidad de Repuestín en el Market, con las mismas funciones que la app
 * (tienda: ofrecer, cargar y ofrecer, cambiar, ofrecer otro, "no lo tengo"; comprador: abrir la ficha y comprar).
 * En el celular ocupa toda la pantalla como la app; en el escritorio es una ventana con el detalle al costado.
 */
export default function InquiryChatModal({ conversation: initialConversation, mode = 'seller', user, isFounder = false, onClose, onChanged, onMarkedRead }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const viewer = mode === 'buyer' ? 'buyer' : 'seller';
  const isSeller = viewer === 'seller';
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickerMode, setPickerMode] = useState(null); // 'principal' | 'extra'
  const [createMode, setCreateMode] = useState(null);
  const [confirmNoStock, setConfirmNoStock] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [viewerImage, setViewerImage] = useState(null);
  const fileInputRef = useRef(null);
  const listRef = useRef(null);

  const stage = inquiryStage(conversation);
  const sellerId = user?.sellerId ?? conversation.proveedorId;
  const participantName = conversation.otroParticipanteNombre || (isSeller ? 'Comprador' : 'Tienda');
  const participantPhoto = resolveMediaUrl(conversation.otroParticipanteFotoUrl || '');
  const closed = conversation.estado === 'CERRADA';

  useEffect(() => { setConversation(initialConversation); }, [initialConversation]);

  // Como en la app: mientras este chat está abierto, sus avisos no hacen saltar la burbuja de Repuestín (los de otros chats sí).
  const { setOpenChatId } = usePartAssistant();
  useEffect(() => {
    setOpenChatId(conversation.id);
    return () => setOpenChatId(null);
  }, [conversation.id, setOpenChatId]);

  // Además de los mensajes se relee la conversación (`app/quote-chat.tsx`): así el repuesto que ofrece la tienda,
  // su "no lo tengo" o la compra aparecen en vivo en la cabecera, sin cerrar y volver a abrir el chat.
  const reloadMessages = useCallback(async () => {
    const [items, updated] = await Promise.all([
      getConversationMessagesApi(conversation.id).catch(() => null),
      getConversationApi(conversation.id).catch(() => null),
    ]);
    if (Array.isArray(items)) {
      setMessages((previous) => (
        previous.length === items.length && previous[previous.length - 1]?.id === items[items.length - 1]?.id ? previous : items
      ));
    }
    if (updated && typeof updated === 'object' && updated.id) {
      setConversation((previous) => ({ ...previous, ...updated }));
    }
  }, [conversation.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getConversationMessagesApi(conversation.id), markConversationReadApi(conversation.id).catch(() => null)])
      .then(([items]) => {
        if (cancelled) return;
        setMessages(Array.isArray(items) ? items : []);
        onMarkedRead?.(conversation.id);
      })
      .catch((error) => { if (!cancelled) setStatus({ type: 'error', text: error.message || 'No se pudo cargar la conversación.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') reloadMessages(); }, REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape' && !pickerMode && !createMode) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [onClose, pickerMode, createMode]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, loading]);

  const applyConversation = (updated) => {
    if (updated && typeof updated === 'object' && updated.id) {
      setConversation((previous) => ({ ...previous, ...updated }));
    }
    onChanged?.();
  };

  const offerProduct = async (product) => {
    setBusy(true);
    setStatus(null);
    try {
      const updated = await offerInquiryProductApi(conversation.id, product.id);
      applyConversation(updated || {
        productoId: product.id,
        productoNombre: product.nombrePublicado || product.repuestoNombre,
        productoPrecio: product.precio,
        productoImagenUrl: product.imageUrls?.[0],
      });
      setPickerMode(null);
      await reloadMessages();
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'No pudimos ofrecer el repuesto. Inténtalo de nuevo.' });
    } finally {
      setBusy(false);
    }
  };

  const offerExtraProduct = async (product) => {
    setBusy(true);
    setStatus(null);
    try {
      const sent = await offerInquiryExtraProductApi(conversation.id, product.id);
      setPickerMode(null);
      if (sent?.id) setMessages((previous) => [...previous, sent]);
      await reloadMessages();
      onChanged?.();
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'No pudimos ofrecer el repuesto. Inténtalo de nuevo.' });
    } finally {
      setBusy(false);
    }
  };

  const markNoStock = async () => {
    setConfirmNoStock(false);
    setBusy(true);
    setStatus(null);
    try {
      const updated = await markInquiryNoStockApi(conversation.id);
      applyConversation(updated || { consultaNoLoTiene: true });
      await reloadMessages();
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'No pudimos marcar que no lo tienes.' });
    } finally {
      setBusy(false);
    }
  };

  const openCreate = (offerMode) => {
    setPickerMode(null);
    setNudgeOpen(false);
    setCreateMode(offerMode);
  };

  // Recién creado desde la pregunta: se ofrece solo. Sin repuesto principal todavía, queda como principal.
  const handleCreated = (product) => {
    const offerMode = createMode;
    setCreateMode(null);
    if (!product?.id || offerMode === 'catalog') return;
    if (!conversation.productoId || offerMode === 'principal') void offerProduct(product);
    else void offerExtraProduct(product);
  };

  const openProduct = (productId, name) => {
    if (!productId) return;
    onClose();
    navigate(productPath({ id: productId, nombre: name }));
  };
  const openOrder = conversation.consultaCompradaPedidoId != null
    ? () => { onClose(); navigate(profileOrderPath(conversation.consultaCompradaPedidoId)); }
    : undefined;

  const pickImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setStatus({ type: 'error', text: 'Solo puedes adjuntar imágenes.' }); return; }
    const compressed = await compressImageFile(file).catch(() => file);
    if (compressed.size > MAX_IMAGE_BYTES) { setStatus({ type: 'error', text: 'La imagen supera los 3 MB.' }); return; }
    setImageFile(compressed);
    setImagePreview(URL.createObjectURL(compressed));
  };
  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    const clean = text.trim();
    if ((!clean && !imageFile) || sending) return;
    setSending(true);
    setStatus(null);
    try {
      if (imageFile) {
        const imageMessage = await uploadConversationImageApi(conversation.id, imageFile);
        if (imageMessage?.id) setMessages((previous) => [...previous, imageMessage]);
        removeImage();
      }
      if (clean) {
        const sent = await sendConversationMessageApi(conversation.id, clean);
        if (sent?.id) setMessages((previous) => [...previous, sent]);
        setText('');
      }
      onChanged?.();
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'No se pudo enviar el mensaje.' });
    } finally {
      setSending(false);
    }
  };

  const panel = (
    <InquiryPanel
      // Al cambiar la etapa se vuelve a montar: si la tienda ofrece el repuesto mientras el chat está abierto, se despliega.
      key={`${isMobile ? 'mobile' : 'desktop'}-${stage}`}
      viewer={viewer}
      stage={stage}
      conversation={conversation}
      busy={busy}
      collapsible={isMobile}
      // Minimizado salvo que haya algo que hacer: la tienda responde o el comprador compra lo ofrecido.
      defaultCollapsed={isSeller ? stage !== 'waiting' : stage !== 'offered'}
      onCreateProduct={() => openCreate('principal')}
      onPickProduct={() => setPickerMode('principal')}
      onChangeProduct={stage === 'offered' ? () => setPickerMode('principal') : undefined}
      onNoStock={() => setConfirmNoStock(true)}
      onOpenProduct={conversation.productoId ? () => openProduct(conversation.productoId, conversation.productoNombre) : undefined}
      onOpenOrder={openOrder}
    />
  );

  const buyerId = Number(conversation.usuarioId);
  // La foto y el nombre de la tienda abren su perfil: el comprador ve la casa de repuestos y todo lo que ofrece.
  const storeId = conversation.proveedorId;
  const openStoreProfile = !isSeller && storeId
    ? () => { onClose(); navigate(storePath({ id: storeId, nombre: participantName })); }
    : undefined;
  const storeLabel = `Ver el perfil de ${participantName}`;

  return (
    <div className="inq-modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !isMobile) onClose(); }}>
      <div className="inq-modal" role="dialog" aria-modal="true" aria-label={`${INQUIRY_KIND_LABEL} con ${participantName}`}>
        <header className="inq-modal-top">
          <button type="button" className="inq-icon-btn inq-back" onClick={onClose} aria-label="Volver"><ArrowLeft size={20} /></button>
          {openStoreProfile ? (
            <button type="button" className="inq-avatar inq-avatar-lg inq-avatar-btn" onClick={openStoreProfile} aria-label={storeLabel} title={storeLabel}>
              {participantPhoto ? <img src={participantPhoto} alt="" referrerPolicy="no-referrer" /> : <Store size={18} />}
            </button>
          ) : (
            <span className="inq-avatar inq-avatar-lg">
              {participantPhoto ? <img src={participantPhoto} alt="" referrerPolicy="no-referrer" /> : (isSeller ? <User size={18} /> : <Store size={18} />)}
            </span>
          )}
          <span className="inq-modal-title">
            <span className="inq-modal-name-row">
              <strong>{participantName}</strong>
              {openStoreProfile && (
                <button type="button" className="inq-profile-link" onClick={openStoreProfile} aria-label={storeLabel}>
                  Ver perfil <ChevronRight size={13} />
                </button>
              )}
            </span>
            <small><RepuestinAvatar size={16} /> {INQUIRY_KIND_LABEL}</small>
          </span>
          {isSeller && (
            <button type="button" className="inq-nudge-icon" onClick={() => setNudgeOpen(true)} aria-label="Hay más compradores buscando repuestos" title="Hay más compradores buscando repuestos">
              <TrendingUp size={18} /><i aria-hidden="true" />
            </button>
          )}
          {!isMobile && <button type="button" className="inq-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>}
        </header>

        <div className="inq-modal-body">
          {!isMobile && <aside className="inq-modal-aside">{panel}</aside>}
          <main className="inq-chat">
            <div className="inq-messages" ref={listRef}>
              {isMobile && panel}
              {status && <p className={`inq-status ${status.type === 'error' ? 'is-error' : ''}`}>{status.text}</p>}
              {loading ? (
                <div className="inq-loading"><Loader2 size={18} className="spin-icon" /> Cargando conversación…</div>
              ) : messages.map((message, index) => {
                const fromBuyer = Number(message.emisorId) === buyerId;
                const mine = isSeller ? !fromBuyer : fromBuyer;
                const offered = message.repuestoOfrecido?.productoId ? message.repuestoOfrecido : null;
                if (offered) {
                  return (
                    <div key={message.id ?? index} className={`inq-row ${mine ? 'mine' : ''}`}>
                      {openStoreProfile && (
                        <button type="button" className="inq-avatar inq-avatar-sm inq-avatar-btn" onClick={openStoreProfile} aria-label={storeLabel} title={storeLabel}>
                          {participantPhoto ? <img src={participantPhoto} alt="" referrerPolicy="no-referrer" /> : <Store size={14} />}
                        </button>
                      )}
                      <OfferedProductMessage product={offered} viewer={viewer} onOpen={() => openProduct(offered.productoId, offered.nombre)} />
                    </div>
                  );
                }
                const body = String(message.texto || '').trim();
                const event = inquiryEventLabel(body, viewer);
                if (event) {
                  return <div key={message.id ?? index} className="inq-event"><span><RepuestinAvatar size={18} />{event}</span></div>;
                }
                const image = message.imagenUrl ? resolveMediaUrl(message.imagenUrl) : null;
                if (!body && !image) return null;
                const senderPhoto = mine ? null : participantPhoto;
                return (
                  <div key={message.id ?? index} className={`inq-row ${mine ? 'mine' : ''}`}>
                    {!mine && <span className="inq-avatar inq-avatar-sm">{senderPhoto ? <img src={senderPhoto} alt="" referrerPolicy="no-referrer" /> : initials(participantName)}</span>}
                    <div className="inq-bubble">
                      {image && <button type="button" className="inq-bubble-image" onClick={() => setViewerImage(image)} aria-label="Ver imagen completa"><img src={image} alt="Adjunto" /><span><Maximize2 size={14} /></span></button>}
                      {body && <p>{body}</p>}
                      <small>{formatTime(message.createdAt)}</small>
                    </div>
                  </div>
                );
              })}
            </div>

            {closed ? (
              <div className="inq-closed"><Lock size={15} /> Esta conversación está cerrada.</div>
            ) : (
              <form className="inq-composer" onSubmit={submit}>
                {imagePreview && <ChatImagePreview previewUrl={imagePreview} fileName={imageFile?.name} fileSize={imageFile?.size} onRemove={removeImage} />}
                <div className="inq-composer-row">
                  {isSeller && (
                    // En la pregunta, la tienda tiene a mano "Ofrecer un repuesto" de su inventario.
                    <button type="button" className="inq-icon-btn inq-composer-btn" onClick={() => setPickerMode(conversation.productoId ? 'extra' : 'principal')} disabled={busy} aria-label="Ofrecer un repuesto de mi inventario" title="Ofrecer un repuesto de mi inventario"><Tags size={20} /></button>
                  )}
                  <button type="button" className="inq-icon-btn inq-composer-btn" onClick={() => fileInputRef.current?.click()} disabled={sending || Boolean(imageFile)} aria-label="Adjuntar imagen" title="Adjuntar imagen"><ImagePlus size={20} /></button>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickImage} />
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !isMobile) submit(event); }}
                    placeholder={isSeller ? 'Responder...' : 'Escribe tu mensaje...'}
                    maxLength={MAX_CHAT_MESSAGE}
                    rows={1}
                    aria-label="Mensaje"
                  />
                  <button type="submit" className="inq-send" disabled={sending || (!text.trim() && !imageFile)} aria-label="Enviar mensaje">
                    {sending ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
                  </button>
                </div>
              </form>
            )}
          </main>
        </div>
      </div>

      {pickerMode && (
        <OfferProductPicker
          sellerId={sellerId}
          initialQuery={pickerMode === 'extra' ? '' : (conversation.consultaRepuesto || '')}
          title={pickerMode === 'extra' ? 'Ofrecer otro repuesto' : conversation.productoId ? 'Cambiar el repuesto ofrecido' : 'Ofrecer un repuesto'}
          busy={busy}
          onClose={() => setPickerMode(null)}
          onSelect={(product) => void (pickerMode === 'extra' ? offerExtraProduct(product) : offerProduct(product))}
          onCreateNew={() => openCreate(pickerMode)}
        />
      )}

      {createMode && (
        <div className="inq-nested">
          <NewCatalogProductModal
            sellerId={sellerId}
            isFounder={isFounder}
            prefill={createMode === 'catalog' ? null : { name: conversation.consultaRepuesto || '' }}
            onClose={() => setCreateMode(null)}
            onCreated={handleCreated}
          />
        </div>
      )}

      {confirmNoStock && (
        <div className="inq-sheet-backdrop is-center" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setConfirmNoStock(false); }}>
          <section className="inq-dialog" role="alertdialog" aria-modal="true" aria-labelledby="inq-nostock-title">
            <strong id="inq-nostock-title">¿No tienes este repuesto?</strong>
            <p>Le avisaremos al comprador para que pruebe con otras casas de repuestos o lo encargue. Si más tarde lo consigues, puedes ofrecerlo igual.</p>
            <div className="inq-actions-row">
              <button type="button" className="inq-btn inq-btn-soft" onClick={() => setConfirmNoStock(false)}>Cancelar</button>
              <button type="button" className="inq-btn inq-btn-danger" onClick={markNoStock}>No lo tengo</button>
            </div>
          </section>
        </div>
      )}

      {nudgeOpen && (
        <div className="inq-sheet-backdrop is-center" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setNudgeOpen(false); }}>
          <section className="inq-dialog inq-nudge" role="dialog" aria-modal="true" aria-labelledby="inq-nudge-title">
            <span className="inq-nudge-badge"><TrendingUp size={26} /></span>
            <strong id="inq-nudge-title">Hay más compradores{participantName ? ` como ${participantName.trim().split(/\s+/)[0]}` : ''} buscando repuestos</strong>
            <p>Carga tus repuestos y Repuestín te los recomendará: te encontrarán más rápido y podrás ofrecerlos en este chat.</p>
            <button type="button" className="inq-btn inq-btn-primary inq-btn-block" onClick={() => { setNudgeOpen(false); onClose(); navigate(profilePath('productos')); }}>Cargar mis repuestos</button>
            <button type="button" className="inq-btn inq-btn-ghost inq-btn-block" onClick={() => setNudgeOpen(false)}>Cerrar</button>
          </section>
        </div>
      )}

      {viewerImage && (
        <div className="inq-sheet-backdrop is-center" role="presentation" onClick={() => setViewerImage(null)}>
          <img className="inq-image-viewer" src={viewerImage} alt="Imagen adjunta" />
        </div>
      )}
    </div>
  );
}
