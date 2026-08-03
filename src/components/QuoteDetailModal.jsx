import React, { useState, useEffect } from 'react';
import {
  X, MessageSquare, Send, User, MapPin, Calendar, Clock, DollarSign, Truck
} from 'lucide-react';
import { QuoteStatusBadge } from './QuoteCard';

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
}) {
  if (!quote) return null;

  const quoteIdShort = String(quote.id || '').slice(-6).toUpperCase();
  const rawStatus = quote.estado || quote.status || 'PENDIENTE';
  const customerName = quote.otroParticipanteNombre || quote.compradorNombre || 'Comprador RepuesTop';
  const customerEmail = quote.compradorEmail || '—';
  const customerPhone = quote.compradorTelefono || '—';
  const customerCity = quote.comuna || quote.region || 'Chile';
  const productName = quote.productoNombre || quote.productName || 'Consulta de repuesto';
  const vehicleInfo = quote.vehiculoInfo || quote.vehicle || 'Vehículo no especificado';

  const [offeredPrice, setOfferedPrice] = useState(quote.precioCotizado || '');
  const [deliveryDays, setDeliveryDays] = useState(quote.diasEntrega || '2-3 días hábiles');
  const [responseNotes, setResponseNotes] = useState(quote.notasVendedor || '');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleResponseSubmit = async (e) => {
    e.preventDefault();
    if (!offeredPrice) {
      setStatusMessage({ type: 'error', text: 'Por favor ingresa un precio cotizado válido.' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);
    try {
      if (onSendQuoteResponse) {
        await onSendQuoteResponse(quote.id, {
          precioCotizado: Number(offeredPrice),
          diasEntrega: deliveryDays,
          notasVendedor: responseNotes,
          estado: 'RESPONDIDA',
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
                Recibida el {formatDate(quote.createdAt || quote.fecha)}
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

          <div className="order-details-grid">
            {/* Left Column: Customer & Vehicle Info */}
            <div className="details-card-block">
              <h3 className="section-subtitle">
                <User size={16} />
                <span>Datos del Solicitante</span>
              </h3>

              <div className="details-info-list">
                <div className="details-info-row">
                  <span className="info-label">Comprador</span>
                  <strong className="info-value">{customerName}</strong>
                </div>
                <div className="details-info-row">
                  <span className="info-label"><MapPin size={13} /> Ubicación</span>
                  <strong className="info-value">{customerCity}</strong>
                </div>
                <div className="details-info-row">
                  <span className="info-label">Vehículo de Interés</span>
                  <strong className="info-value">{vehicleInfo}</strong>
                </div>
                <div className="details-info-row">
                  <span className="info-label">Repuesto Solicitado</span>
                  <strong className="info-value">{productName}</strong>
                </div>
              </div>

              <div className="quote-query-box" style={{ marginTop: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <span className="info-label">Consulta del Cliente:</span>
                <p style={{ fontSize: '13px', color: '#334155', marginTop: '4px', fontStyle: 'italic' }}>
                  "{quote.ultimoMensaje || quote.mensaje || 'Hola, me gustaría saber si tienen stock de este repuesto y tiempo estimado de entrega.'}"
                </p>
              </div>
            </div>

            {/* Right Column: Send Quote Form */}
            <div className="details-card-block status-update-block">
              <h3 className="section-subtitle">
                <Send size={16} />
                <span>Responder Cotización</span>
              </h3>

              <form onSubmit={handleResponseSubmit} className="status-update-form">
                <div className="form-group">
                  <label className="form-label">Precio Ofertado ($ CLP)</label>
                  <input
                    type="number"
                    className="status-select-input"
                    value={offeredPrice}
                    onChange={(e) => setOfferedPrice(e.target.value)}
                    placeholder="Ej. 45000"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tiempo Estimado de Entrega</label>
                  <input
                    type="text"
                    className="status-select-input"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                    placeholder="Ej. 24 a 48 horas / Retiro inmediato"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mensaje / Observaciones al Comprador</label>
                  <textarea
                    className="status-select-input"
                    rows="3"
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    placeholder="Incluye detalles de garantía, marca o instrucciones de compra..."
                  />
                </div>

                <button
                  type="submit"
                  className="btn-auth-primary btn-save-status"
                  disabled={isSending}
                >
                  <Send size={15} />
                  <span>{isSending ? 'Enviando...' : 'Enviar Cotización'}</span>
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
