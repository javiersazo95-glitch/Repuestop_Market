import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, BadgeDollarSign, Bell, CalendarDays, CalendarClock,
  CheckCircle2, ChevronRight, CircleHelp, CircleUserRound, Download, ExternalLink, Eye, FileText, Flag,
  Headphones, Info, Loader2, Lock, MessageSquare, MoreHorizontal, Package,
  Pencil, Send, ShieldCheck, ShoppingCart, Store, Truck, X,
} from 'lucide-react';
import RepuesTopLogo from './RepuesTopLogo';
import {
  checkoutConversationQuoteApi, createSupportTicketApi, getAddressesApi, getConversationMessagesApi,
  getConversationQuoteApi, markConversationReadApi, resolveMediaUrl, sendConversationMessageApi,
} from '../services/api';
import {
  isQuoteExpired, parseQuoteRequestMessage, quantityFromLabel,
  quoteExpirationLabel, QUOTE_AVAILABILITY_OPTIONS, QUOTE_DELIVERY_OPTIONS,
  QUOTE_VALIDITY_OPTIONS, QUOTE_WARRANTY_OPTIONS,
} from '../utils/quoteFlow';
import { buildQuotePdfBlob, quoteDocumentFilename } from '../utils/quoteDocument';
import { productPath, ROUTES, storePath } from '../routes/paths';

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
  quote, mode = 'seller', user, onClose, onSendQuoteResponse, onMarkedRead,
}) {
  const navigate = useNavigate();
  const [localQuote, setLocalQuote] = useState(quote?.cotizacion || null);
  const activeQuote = localQuote || quote?.cotizacion || null;
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [quoteEditorOpen, setQuoteEditorOpen] = useState(false);
  const [quotePreviewOpen, setQuotePreviewOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccessOpen, setReportSuccessOpen] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [documentType, setDocumentType] = useState('BOLETA');
  const [invoice, setInvoice] = useState({ rut: '', razonSocial: '', giro: '' });

  const requestMessage = useMemo(() => {
    const structured = messages.find((message) => /Solicitud de cotización por\s+/i.test(message.texto || ''));
    return structured?.texto || quote?.ultimoMensaje || '';
  }, [messages, quote?.ultimoMensaje]);
  const requested = useMemo(() => parseQuoteRequestMessage(requestMessage), [requestMessage]);

  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [availability, setAvailability] = useState('Stock disponible');
  const [deliveryTerms, setDeliveryTerms] = useState('Retiro en tienda');
  const [deliveryCost, setDeliveryCost] = useState('');
  const [warranty, setWarranty] = useState('3 meses');
  const [validity, setValidity] = useState('Valida por 24 horas');
  const [responseNotes, setResponseNotes] = useState('');

  useEffect(() => {
    const current = quote?.cotizacion;
    setLocalQuote(current || null);
    setUnitPrice(String(current?.precioUnitario ?? current?.precio ?? ''));
    setDiscount(String(current?.descuento ?? ''));
    setAvailability(current?.disponibilidad || 'Stock disponible');
    setDeliveryTerms(current?.condicionesEntrega?.replace(/ \(costo:.*\)$/i, '') || 'Retiro en tienda');
    setDeliveryCost(current?.condicionesEntrega?.match(/costo:\s*\$?([\d.]+)/i)?.[1]?.replace(/\./g, '') || '');
    setWarranty(current?.garantia || '3 meses');
    setValidity(current?.vigencia || 'Valida por 24 horas');
    setResponseNotes(current?.notas || '');
  }, [quote]);

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
    };
    const interval = window.setInterval(refreshQuoteDocument, 8000);
    return () => window.clearInterval(interval);
  }, [quote?.id]);

  useEffect(() => {
    if (mode !== 'buyer' || !showCheckout || !user?.userId) return;
    getAddressesApi(user.userId).then((items) => {
      const list = Array.isArray(items) ? items : [];
      setAddresses(list);
      const main = list.find((item) => item.esPrincipal) || list[0];
      if (main) setSelectedAddressId(String(main.id));
    }).catch(() => setAddresses([]));
  }, [mode, showCheckout, user?.userId]);

  if (!quote) return null;

  const quantity = quantityFromLabel(requested.requestedQty);
  const subtotal = (Number(unitPrice) || 0) * quantity;
  const normalizedDiscount = Number(discount) || 0;
  const finalPrice = Math.max(0, subtotal - normalizedDiscount);
  const quoteIdShort = String(quote.id || '').slice(-6).toUpperCase();
  const participantName = quote.otroParticipanteNombre || (mode === 'buyer' ? 'Tienda RepuesTop' : 'Comprador RepuesTop');
  const productName = quote.productoNombre || 'Producto consultado';
  const productImage = resolveMediaUrl(quote.productoImagenUrl);
  const storeName = mode === 'buyer' ? participantName : (user?.storeName || 'Mi tienda RepuesTop');
  const buyerName = mode === 'seller' ? participantName : (user?.userName || user?.nombre || 'Comprador RepuesTop');
  const participantPhoto = resolveMediaUrl(quote.otroParticipanteFotoUrl);
  // El logo va al PDF de la cotización, así que se agotan todos los campos donde
  // el backend puede entregarlo antes de caer en el placeholder.
  const storePhoto = mode === 'buyer'
    ? resolveMediaUrl(quote.otroParticipanteFotoUrl || quote.proveedorLogoUrl || quote.sellerLogoUrl || quote.tiendaLogoUrl)
    : resolveMediaUrl(user?.logoUrl || user?.userProfileUrl || user?.storeLogoUrl || user?.avatarUrl);
  const expired = activeQuote ? isQuoteExpired(activeQuote) : false;
  const closed = quote.estado === 'CERRADA';
  const documentName = quoteDocumentFilename(quote.id);
  const openProduct = () => navigate(productPath({ id: quote.productoId, titulo: productName }));
  const storeId = quote.proveedorId || quote.sellerId || user?.sellerId;
  const openStore = () => {
    if (!storeId) return;
    navigate(storePath({ id: storeId, nombre: storeName }));
  };
  const openHelp = () => {
    setOptionsOpen(false);
    navigate(ROUTES.support);
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!reportReason || isSubmittingReport) return;
    setIsSubmittingReport(true);
    try {
      const reporterName = user?.userName || user?.nombre || user?.storeName || (mode === 'seller' ? 'Vendedor' : 'Comprador');
      await createSupportTicketApi({
        usuarioId: user?.userId ?? user?.id,
        nombreReportante: reporterName,
        tipoReportante: mode === 'seller' ? 'VENDEDOR' : 'COMPRADOR',
        categoria: 'SOLICITUD_AYUDA',
        plataforma: 'APP_MOBILE',
        motivo: `Reporte de chat: ${reportReason}`,
        detalle: reportDetail.trim() || `Reporte por el motivo: ${reportReason}`,
        pedidoId: String(quote.id),
        sellerId: Number(user?.sellerId || quote?.sellerId || quote?.proveedorId) || undefined,
        contexto: `Reporte de chat (${mode === 'seller' ? 'Vendedor' : 'Comprador'}). ID conversación: ${quote.id} | Reportado: ${participantName}`,
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

  const createDocumentBlob = () => buildQuotePdfBlob({
    conversationId: quote.id,
    quote: activeQuote,
    productName,
    storeName,
    buyerName,
    vehicleConsulted: requested.requestedChassis,
    storeLogoUrl: storePhoto,
  });

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

  const submitChatMessage = async (event) => {
    event.preventDefault();
    const text = chatMessage.trim();
    if (!text) return;
    setIsSending(true);
    try {
      const sent = await sendConversationMessageApi(quote.id, text);
      setMessages((previous) => [...previous, sent]);
      setChatMessage('');
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo enviar el mensaje.' });
    } finally {
      setIsSending(false);
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
      let normalizedDelivery = deliveryTerms;
      if (['Delivery local', 'Envío dentro de la comuna'].includes(deliveryTerms) && deliveryCost) {
        normalizedDelivery += ` (costo: ${formatCLP(deliveryCost)})`;
      }
      const payload = {
        precio: finalPrice, cantidad: requested.requestedQty, disponibilidad: availability,
        condicionesEntrega: normalizedDelivery, precioUnitario: Number(unitPrice),
        descuento: Number(discount) || 0, precioFinal: finalPrice,
        garantia: warranty, vigencia: validity, notas: responseNotes,
      };
      const saved = await onSendQuoteResponse?.(quote.id, payload);
      setLocalQuote(saved || { ...payload, id: activeQuote?.id || `local-${quote.id}`, createdAt: activeQuote?.createdAt || new Date().toISOString() });
      setQuoteEditorOpen(false);
      setStatusMessage({ type: 'success', text: activeQuote ? 'Cotización actualizada y documento regenerado.' : 'Cotización enviada. El documento ya está disponible para ambos.' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo guardar la cotización.' });
    } finally {
      setIsSending(false);
    }
  };

  const purchaseQuote = async () => {
    if (!activeQuote || expired || !user?.userId) return;
    const needsAddress = !String(activeQuote.condicionesEntrega || '').toLowerCase().includes('retiro');
    if (needsAddress && !selectedAddressId) {
      setStatusMessage({ type: 'error', text: 'Selecciona una dirección de envío antes de comprar.' });
      return;
    }
    if (documentType === 'FACTURA' && (!invoice.rut.trim() || !invoice.razonSocial.trim() || !invoice.giro.trim())) {
      setStatusMessage({ type: 'error', text: 'Completa RUT, razón social y giro para emitir factura.' });
      return;
    }
    setIsSending(true);
    try {
      const order = await checkoutConversationQuoteApi(user.userId, {
        productoId: quote.productoId,
        precioUnitario: activeQuote.precioUnitario ?? activeQuote.precio,
        cantidad: quantityFromLabel(activeQuote.cantidad || requested.requestedQty),
        metodoEnvio: activeQuote.condicionesEntrega,
        conversacionId: quote.id,
        tipoDocumentoTributario: documentType,
        facturaRut: documentType === 'FACTURA' ? invoice.rut : null,
        facturaRazonSocial: documentType === 'FACTURA' ? invoice.razonSocial : null,
        facturaGiro: documentType === 'FACTURA' ? invoice.giro : null,
        direccionId: needsAddress ? Number(selectedAddressId) : null,
      });
      sessionStorage.setItem('repuestop_last_successful_order', JSON.stringify(order));
      window.location.assign('/compra-exitosa');
    } catch (error) {
      setStatusMessage({ type: 'error', text: error.message || 'No se pudo procesar la cotización.' });
      setIsSending(false);
    }
  };

  return (
    <div className="quote-workspace" role="dialog" aria-modal="true" aria-label={`Chat de cotización ${quoteIdShort}`}>
      <header className="quote-ws-topbar">
        <button type="button" className="quote-ws-brand" onClick={onClose} aria-label="Volver al perfil"><RepuesTopLogo height={44} /></button>
        <div className="quote-ws-account"><Bell size={20} /><span>{initials(user?.userName || user?.nombre || participantName)}</span><div><strong>{user?.userName || user?.nombre || 'Mi cuenta'}</strong><small>{mode === 'seller' ? 'Vendedor' : 'Comprador'}</small></div><button type="button" onClick={onClose}><X size={18} /></button></div>
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
            <DataRow icon={Truck} label="Método de envío" value={requested.requestedDeliveryTerms} />
            <DataRow icon={ShieldCheck} label="Patente o chasis" value={requested.requestedChassis || 'No informado'} />
            <DataRow icon={MessageSquare} label="Nota del comprador" value={requested.requestedNotes || 'Sin nota adicional'} />
          </section>
        </aside>

        <main className="quote-ws-chat">
          <header className="quote-ws-chat-header">
            <div className="quote-ws-person"><span>{participantPhoto ? <img src={participantPhoto} alt={participantName} /> : initials(participantName)}</span><div><strong>{participantName}</strong><small>{mode === 'buyer' ? 'Vendedor verificado' : 'Comprador'} <i /> En línea</small></div></div>
            <div className="quote-ws-chat-actions">
              <button
                type="button"
                className="quote-ws-details-button"
                disabled={mode === 'buyer' && !activeQuote}
                onClick={() => mode === 'seller' ? setQuoteEditorOpen(true) : setQuotePreviewOpen(true)}
              ><Eye size={17} /> {mode === 'seller' ? 'Ver detalles de la cotización' : (activeQuote ? 'Ver detalle de la cotización' : 'Esperando cotización')}</button>
              <button type="button" className="quote-ws-icon-button" aria-label="Opciones de la conversación" aria-expanded={optionsOpen} onClick={() => setOptionsOpen(true)}><MoreHorizontal size={20} /></button>
            </div>
          </header>

          <div className="quote-ws-private"><Info size={19} /><div><strong>Este chat es privado y está asociado a la cotización #{quoteIdShort}.</strong><span>Aquí podrás resolver dudas, solicitar ajustes o confirmar tu compra.</span></div></div>

          <div className="quote-ws-messages">
            {isLoadingMessages ? <div className="quote-messages-loading"><Loader2 size={20} className="spin-icon" /> Cargando conversación...</div> : messages.map((message) => {
              const isBuyer = Number(message.emisorId) === Number(quote.usuarioId);
              const mine = mode === 'buyer' ? isBuyer : !isBuyer;
              return <div key={message.id} className={`quote-ws-message-row ${mine ? 'mine' : ''}`}><span className="quote-ws-message-avatar">{mine ? initials(user?.userName || user?.nombre) : initials(participantName)}</span><div className="quote-ws-bubble">{message.imagenUrl && <img src={resolveMediaUrl(message.imagenUrl)} alt="Adjunto" />}{message.texto && <p>{message.texto}</p>}<small>{formatDate(message.createdAt)} {mine ? '✓✓' : ''}</small></div></div>;
            })}
            {activeQuote && <div className={`quote-ws-message-row ${mode === 'seller' ? 'mine' : ''}`}><span className="quote-ws-message-avatar">{initials(storeName)}</span><div className="quote-ws-bubble quote-ws-document-bubble"><p>Te adjunto la propuesta comercial con todos los detalles de la cotización.</p><button type="button" className="quote-ws-file" onClick={viewDocument}><FileText size={25} /><span><strong>{documentName}</strong><small>PDF · Documento de cotización</small></span><Eye size={18} /></button><small>{formatDate(activeQuote.createdAt)}</small></div></div>}
          </div>

          {!closed ? <form className="quote-ws-composer" onSubmit={submitChatMessage}><textarea value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Escribe tu mensaje..." maxLength="1000" rows="2" /><div><span><Lock size={12} /> Tu conversación se mantiene segura y privada.</span><small>{chatMessage.length}/1000</small><button type="submit" disabled={isSending || !chatMessage.trim()}><Send size={17} /> Enviar</button></div></form> : <div className="quote-chat-closed"><Lock size={16} /> Esta conversación está cerrada.</div>}
        </main>

        <aside className="quote-ws-right">
          <section className="quote-ws-side-card quote-ws-product-card">
            <h3>Detalles del producto</h3>
            <div className="quote-ws-product-head">{productImage ? <img src={productImage} alt={productName} /> : <Package size={28} />}<div><strong>{productName}</strong><span>Producto #{quote.productoId || '—'}</span></div></div>
            <DataRow icon={ShieldCheck} label="Estado" value="Publicado" />
            <DataRow icon={BadgeDollarSign} label="Precio cotizado" value={activeQuote ? formatCLP(activeQuote.precioFinal ?? activeQuote.precio) : 'Por definir'} />
            <button type="button" className="quote-ws-outline-button" onClick={openProduct}><ExternalLink size={15} /> Ver ficha completa</button>
            {mode === 'buyer' && <button type="button" className="quote-ws-primary-button" onClick={() => setChatMessage('Necesito una modificación en la cotización: ')}><Pencil size={15} /> Solicitar modificación</button>}
          </section>

          <section className="quote-ws-side-card quote-ws-files-card">
            <h3>Archivos y documentos</h3>
            {activeQuote ? <div className="quote-ws-document-card"><FileText size={27} /><span><strong>{documentName}</strong><small>PDF · Generado al enviar</small></span><button type="button" onClick={viewDocument} title="Ver cotización"><Eye size={17} /></button><button type="button" onClick={downloadDocument} title="Descargar cotización"><Download size={17} /></button></div> : <div className="quote-ws-no-files"><FileText size={25} /><span><strong>Aún no hay documentos</strong><small>La cotización aparecerá aquí cuando el vendedor la cree y envíe.</small></span></div>}
          </section>

          <section className="quote-ws-help"><Headphones size={25} /><div><strong>¿Necesitas ayuda?</strong><span>Si tienes dudas sobre la cotización o el proceso, puedes contactarnos.</span><button type="button" onClick={openHelp}>Ir a ayuda <ChevronRight size={13} /></button></div></section>
        </aside>
      </div>

      {optionsOpen && <div className="quote-ws-dialog-backdrop quote-ws-options-backdrop" onClick={() => setOptionsOpen(false)}><section className="quote-ws-options-dialog" role="dialog" aria-modal="true" aria-label="Opciones de la conversación" onClick={(event) => event.stopPropagation()}><header><strong>Opciones</strong><button type="button" aria-label="Cerrar opciones" onClick={() => setOptionsOpen(false)}><X size={19} /></button></header><div><button type="button" onClick={openHelp}><span><CircleHelp size={20} /></span><div><strong>Ayuda</strong><small>Obtén asistencia con esta cotización</small></div><ChevronRight size={18} /></button><button type="button" className="danger" onClick={() => { setOptionsOpen(false); setReportOpen(true); }}><span><Flag size={20} /></span><div><strong>Reportar {mode === 'seller' ? 'comprador' : 'vendedor'}</strong><small>Informa una conducta que incumple las normas</small></div><ChevronRight size={18} /></button></div></section></div>}

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
              <CircleUserRound size={25} />
              <div className="quote-editor-request-content">
                <strong>Solicitud del comprador</strong>
                <div className="quote-editor-request-grid">
                  <span><small>Producto</small><b>{productName}</b></span>
                  <span><small>Cantidad solicitada</small><b>{requested.requestedQty}</b></span>
                  <span><small>Método de envío solicitado</small><b>{requested.requestedDeliveryTerms}</b></span>
                  <span><small>Nota del comprador</small><b>{requested.requestedNotes || 'Sin nota adicional'}</b></span>
                </div>
              </div>
            </section>

            <div className="quote-editor-pricing-layout">
              <div className="quote-editor-pricing-fields">
                <div className="quote-editor-price-row">
                  <label><span>Precio por unidad <Info size={13} /></span><div className="quote-editor-money-input"><i>$</i><input type="number" min="1" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value.replace(/[^0-9]/g, ''))} required /></div></label>
                  <label><span>Cantidad solicitada <Lock size={13} /></span><div className="quote-locked-field">{requested.requestedQty}<Lock size={15} /></div></label>
                </div>
                <label><span>Descuento o rebaja total (opcional)</span><div className="quote-editor-money-input"><i>$</i><input type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value.replace(/[^0-9]/g, ''))} /></div><small>Dejar en 0 si no aplica descuento.</small></label>
              </div>
              <aside className="quote-editor-total-card">
                <span><small>Subtotal ({requested.requestedQty})</small><b>{formatCLP(subtotal)}</b></span>
                <span><small>Descuento o rebaja</small><b className="discount">−{formatCLP(normalizedDiscount)}</b></span>
                <div><strong>Precio final</strong><b>{formatCLP(finalPrice)}</b></div>
              </aside>
            </div>

            <div className="quote-editor-fields-grid">
              <label><span>Disponibilidad</span><select value={availability} onChange={(event) => setAvailability(event.target.value)}>{QUOTE_AVAILABILITY_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label><span>Condición de entrega</span><select value={deliveryTerms} onChange={(event) => setDeliveryTerms(event.target.value)}>{[...new Set([requested.requestedDeliveryTerms, ...QUOTE_DELIVERY_OPTIONS, 'Delivery local'])].map((option) => <option key={option}>{option}</option>)}</select></label>
              {['Delivery local', 'Envío dentro de la comuna'].includes(deliveryTerms) && <label><span>Costo del envío</span><div className="quote-editor-money-input"><i>$</i><input type="number" min="0" value={deliveryCost} onChange={(event) => setDeliveryCost(event.target.value.replace(/[^0-9]/g, ''))} required /></div></label>}
              <label><span>Garantía</span><select value={warranty} onChange={(event) => setWarranty(event.target.value)}>{QUOTE_WARRANTY_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label><span>Vigencia</span><select value={validity} onChange={(event) => setValidity(event.target.value)}>{QUOTE_VALIDITY_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
            </div>

            <label className="quote-editor-notes"><span>Nota adicional (opcional)</span><textarea rows="3" value={responseNotes} onChange={(event) => setResponseNotes(event.target.value)} maxLength="500" placeholder="Incluye condiciones, detalles de entrega, información de pago u otros comentarios relevantes..." /><small>{responseNotes.length}/500</small></label>
            <div className="quote-editor-info"><Info size={18} /><span>Esta cotización será enviada a ambos participantes. Puede incluir condiciones de entrega, garantía y pago acordadas.</span></div>
          </div>

          <footer className="quote-editor-footer"><button type="button" className="quote-editor-cancel" onClick={() => setQuoteEditorOpen(false)}>Cancelar</button><button className="quote-editor-submit" type="submit" disabled={isSending || closed}>{isSending ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />} {isSending ? 'Guardando...' : activeQuote ? 'Actualizar y enviar cotización' : 'Crear y enviar cotización'}</button></footer>
        </form>
      </div>}

      {quotePreviewOpen && activeQuote && <div className="quote-ws-dialog-backdrop" onClick={() => setQuotePreviewOpen(false)}><section className="quote-ws-quote-dialog quote-ws-preview-dialog" onClick={(event) => event.stopPropagation()}><header><div><FileText size={22} /><span><strong>Detalle de la cotización</strong><small><CalendarClock size={13} /> {quoteExpirationLabel(activeQuote, now)}</small></span></div><button type="button" onClick={() => setQuotePreviewOpen(false)}><X size={20} /></button></header><div className="quote-ws-dialog-body"><div className="quote-ws-preview-price"><small>Total cotizado</small><strong>{formatCLP(activeQuote.precioFinal ?? activeQuote.precio)}</strong></div><DataRow icon={Package} label="Cantidad" value={activeQuote.cantidad} /><DataRow icon={CheckCircle2} label="Disponibilidad" value={activeQuote.disponibilidad} /><DataRow icon={Truck} label="Entrega" value={activeQuote.condicionesEntrega} /><DataRow icon={ShieldCheck} label="Garantía" value={activeQuote.garantia} /><DataRow icon={FileText} label="Notas" value={activeQuote.notas} /><div className="quote-ws-preview-document"><button type="button" onClick={viewDocument}><Eye size={16} /> Ver PDF</button><button type="button" onClick={downloadDocument}><Download size={16} /> Descargar PDF</button></div>{mode === 'buyer' && !showCheckout && <button type="button" className="quote-ws-primary-button" disabled={expired || closed} onClick={() => setShowCheckout(true)}><ShoppingCart size={16} /> {expired ? 'Cotización vencida' : 'Comprar esta cotización'}</button>}{mode === 'buyer' && showCheckout && <div className="quote-checkout-box"><h4>Finalizar compra</h4>{!String(activeQuote.condicionesEntrega || '').toLowerCase().includes('retiro') && <label><span>Dirección de envío</span><select value={selectedAddressId} onChange={(event) => setSelectedAddressId(event.target.value)}><option value="">Selecciona una dirección</option>{addresses.map((address) => <option key={address.id} value={address.id}>{address.calleYNumero}{address.comunaNombre ? `, ${address.comunaNombre}` : ''}</option>)}</select></label>}<div className="quote-document-toggle"><button type="button" className={documentType === 'BOLETA' ? 'active' : ''} onClick={() => setDocumentType('BOLETA')}>Boleta</button><button type="button" className={documentType === 'FACTURA' ? 'active' : ''} onClick={() => setDocumentType('FACTURA')}>Factura</button></div>{documentType === 'FACTURA' && <div className="quote-invoice-fields"><input placeholder="RUT empresa" value={invoice.rut} onChange={(event) => setInvoice((value) => ({ ...value, rut: event.target.value }))} /><input placeholder="Razón social" value={invoice.razonSocial} onChange={(event) => setInvoice((value) => ({ ...value, razonSocial: event.target.value }))} /><input placeholder="Giro" value={invoice.giro} onChange={(event) => setInvoice((value) => ({ ...value, giro: event.target.value }))} /></div>}<button type="button" className="quote-ws-primary-button" onClick={purchaseQuote} disabled={isSending}>{isSending ? <Loader2 size={16} className="spin-icon" /> : <ShoppingCart size={16} />} Confirmar compra</button></div>}</div></section></div>}
    </div>
  );
}
