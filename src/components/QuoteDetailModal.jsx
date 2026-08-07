import React, { useState, useEffect } from 'react';
import {
  X, MessageSquare, Send, User, Package, Loader2, BadgeDollarSign
} from 'lucide-react';
import { QuoteStatusBadge } from './QuoteCard';
import { getConversationMessagesApi, markConversationReadApi, resolveMediaUrl } from '../services/api';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function QuoteDetailModal({
  quote,
  onClose,
  onSendQuoteResponse,
  onMarkedRead,
}) {
  if (!quote) return null;

  const quoteIdShort = String(quote.id || '').slice(-6).toUpperCase();
  const activeQuote = quote.cotizacion || null;
  const rawStatus = activeQuote ? 'RESPONDIDA' : 'PENDIENTE';
  const customerName = quote.otroParticipanteNombre || quote.compradorNombre || 'Comprador RepuesTop';
  const productName = quote.productoNombre || quote.productName || 'Consulta de repuesto';
  const [unitPrice, setUnitPrice] = useState(String(activeQuote?.precioUnitario ?? activeQuote?.precio ?? ''));
  const [quantity, setQuantity] = useState(activeQuote?.cantidad || '1 unidad');
  const [discount, setDiscount] = useState(String(activeQuote?.descuento ?? ''));
  const [availability, setAvailability] = useState(activeQuote?.disponibilidad || 'Stock disponible');
  const [deliveryTerms, setDeliveryTerms] = useState(activeQuote?.condicionesEntrega || 'Retiro en tienda');
  const [warranty, setWarranty] = useState(activeQuote?.garantia || '30 dias');
  const [validity, setValidity] = useState(activeQuote?.vigencia || 'Valida por 48 horas');
  const [responseNotes, setResponseNotes] = useState(activeQuote?.notas || '');
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const quantityNumber = Math.max(1, Number.parseInt(quantity, 10) || 1);
  const finalPrice = Math.max(0, (Number(unitPrice) || 0) * quantityNumber - (Number(discount) || 0));

  useEffect(() => {
    let cancelled = false;
    setIsLoadingMessages(true);
    Promise.all([
      getConversationMessagesApi(quote.id),
      markConversationReadApi(quote.id).catch(() => null),
    ])
      .then(([items]) => {
        if (!cancelled) {
          setMessages(Array.isArray(items) ? items : []);
          onMarkedRead?.(quote.id);
        }
      })
      .catch((error) => {
        if (!cancelled) setStatusMessage({ type: 'error', text: error.message || 'No se pudo cargar la conversación.' });
      })
      .finally(() => { if (!cancelled) setIsLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [quote.id, onMarkedRead]);

  const handleResponseSubmit = async (e) => {
    e.preventDefault();
    if (finalPrice <= 0) {
      setStatusMessage({ type: 'error', text: 'Por favor ingresa un precio cotizado válido.' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);
    try {
      if (onSendQuoteResponse) {
        await onSendQuoteResponse(quote.id, {
          precio: finalPrice,
          cantidad: quantity,
          disponibilidad: availability,
          condicionesEntrega: deliveryTerms,
          precioUnitario: Number(unitPrice),
          descuento: Number(discount) || 0,
          precioFinal: finalPrice,
          garantia: warranty,
          vigencia: validity,
          notas: responseNotes,
        });
      }
      setStatusMessage({ type: 'success', text: 'Cotización enviada exitosamente al comprador.' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al enviar la respuesta de cotización.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="order-modal-backdrop" onClick={onClose}>
      <div className="order-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="order-modal-header">
          <div className="order-modal-title-group">
            <div className="order-modal-icon-badge">
              <MessageSquare size={22} />
            </div>
            <div>
              <h2>Solicitud de Cotización #{quoteIdShort}</h2>
              <span className="order-modal-subtitle">
                Última actividad: {formatDate(quote.ultimoMensajeFecha || quote.createdAt || quote.fecha)}
              </span>
            </div>
          </div>
          <div className="order-modal-header-actions">
            <QuoteStatusBadge status={rawStatus} size="medium" />
            <button type="button" className="btn-close-modal" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="order-modal-body">
          {statusMessage && (
            <div className={`auth-alert ${statusMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="order-details-grid quote-detail-grid">
            <div className="details-card-block quote-conversation-block">
              <h3 className="section-subtitle">
                <User size={16} />
                <span>Solicitud de {customerName}</span>
              </h3>

              <div className="quote-product-context">
                {quote.productoImagenUrl ? <img src={resolveMediaUrl(quote.productoImagenUrl)} alt="" /> : <span><Package size={22} /></span>}
                <div>
                  <strong>{productName}</strong>
                  <small>Producto #{quote.productoId || '—'} · Cliente desde {quote.compradorFechaCreacion || 'fecha no informada'}</small>
                </div>
              </div>

              <div className="quote-message-thread">
                {isLoadingMessages ? (
                  <div className="quote-messages-loading"><Loader2 size={17} className="spin-icon" /> Cargando conversación...</div>
                ) : messages.length > 0 ? messages.map((message) => {
                  const isBuyer = Number(message.emisorId) === Number(quote.usuarioId);
                  return (
                    <div key={message.id} className={`quote-thread-message ${isBuyer ? 'is-buyer' : 'is-seller'}`}>
                      {message.imagenUrl && <img src={resolveMediaUrl(message.imagenUrl)} alt="Imagen adjunta" />}
                      {message.texto && <p>{message.texto}</p>}
                      <small>{formatDate(message.createdAt)}</small>
                    </div>
                  );
                }) : (
                  <div className="quote-query-box"><p>{quote.ultimoMensaje || 'El comprador inició una solicitud de cotización.'}</p></div>
                )}
              </div>
            </div>

            <div className="details-card-block status-update-block">
              <h3 className="section-subtitle">
                <BadgeDollarSign size={16} />
                <span>{activeQuote ? 'Actualizar cotización' : 'Crear cotización'}</span>
              </h3>

              <form onSubmit={handleResponseSubmit} className="status-update-form">
                <div className="quote-form-two-columns">
                  <div className="form-group">
                    <label className="form-label">Precio por unidad</label>
                    <input type="number" min="1" className="status-select-input" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Ej. 45000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cantidad</label>
                    <input className="status-select-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1 unidad" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Rebaja total (opcional)</label>
                  <input
                    type="number"
                    className="status-select-input"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="Ej. 5000"
                  />
                </div>
                <div className="quote-final-price"><span>Precio final</span><strong>{formatCLP(finalPrice)}</strong></div>
                <div className="quote-form-two-columns">
                  <label className="form-group"><span className="form-label">Disponibilidad</span><select className="status-select-input" value={availability} onChange={(e) => setAvailability(e.target.value)}><option>Disponible para retiro hoy</option><option>Disponible para despacho hoy</option><option>Stock disponible</option><option>Stock limitado</option><option>Disponible a pedido</option><option>Confirmar stock antes de pagar</option></select></label>
                  <label className="form-group"><span className="form-label">Condición de entrega</span><select className="status-select-input" value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)}><option>Retiro en tienda</option><option>Envío dentro de la comuna</option><option>Envío fuera de la comuna</option></select></label>
                </div>
                <div className="quote-form-two-columns">
                  <label className="form-group"><span className="form-label">Garantía</span><select className="status-select-input" value={warranty} onChange={(e) => setWarranty(e.target.value)}><option>Sin garantia informada</option><option>7 dias</option><option>15 dias</option><option>30 dias</option><option>3 meses</option><option>6 meses</option></select></label>
                  <label className="form-group"><span className="form-label">Vigencia</span><select className="status-select-input" value={validity} onChange={(e) => setValidity(e.target.value)}><option>Valida por 24 horas</option><option>Valida por 48 horas</option><option>Valida por 72 horas</option><option>Valida por 7 dias</option><option>Hasta agotar stock</option></select></label>
                </div>
                <div className="form-group">
                  <label className="form-label">Nota adicional</label>
                  <textarea
                    className="status-select-input"
                    rows="3"
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    placeholder="Aclara condiciones, marca o detalles importantes..."
                  />
                </div>

                <button
                  type="submit"
                  className="btn-auth-primary btn-save-status"
                  disabled={isSending}
                >
                  <Send size={15} />
                  <span>{isSending ? 'Guardando...' : activeQuote ? 'Actualizar Cotización' : 'Enviar Cotización'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="order-modal-footer">
          <button type="button" className="btn-auth-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
