import React from 'react';
import {
  MessageSquare, Clock, CheckCircle2, XCircle, Send, User, ChevronRight
} from 'lucide-react';
import { resolveMediaUrl } from '../services/api';

export const UNIFIED_QUOTE_STATUS = {
  PENDIENTE: { label: 'Pendiente de respuesta', icon: Clock, className: 'badge-amber' },
  pending: { label: 'Pendiente de respuesta', icon: Clock, className: 'badge-amber' },
  RESPONDIDA: { label: 'Cotización enviada', icon: Send, className: 'badge-blue' },
  answered: { label: 'Cotización enviada', icon: Send, className: 'badge-blue' },
  ACEPTADA: { label: 'Aceptada', icon: CheckCircle2, className: 'badge-green' },
  accepted: { label: 'Aceptada', icon: CheckCircle2, className: 'badge-green' },
  RECHAZADA: { label: 'Rechazada', icon: XCircle, className: 'badge-red' },
  rejected: { label: 'Rechazada', icon: XCircle, className: 'badge-red' },
};

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function QuoteStatusBadge({ status, size = 'small' }) {
  const norm = String(status || 'PENDIENTE').toUpperCase();
  const config = UNIFIED_QUOTE_STATUS[status] || UNIFIED_QUOTE_STATUS[norm] || UNIFIED_QUOTE_STATUS.PENDIENTE;
  const Icon = config.icon;

  return (
    <span className={`order-status-badge ${config.className} badge-size-${size}`}>
      <Icon size={size === 'small' ? 12 : 14} />
      <span>{config.label}</span>
    </span>
  );
}

export default function QuoteCard({
  quote,
  mode = 'seller',
  onSelectQuote,
  onQuickRespond,
}) {
  if (!quote) return null;

  const quoteIdShort = String(quote.id || '').slice(-6).toUpperCase();
  const activeQuote = quote.cotizacion || null;
  const dateStr = formatDate(quote.ultimoMensajeFecha || quote.createdAt || quote.fecha);
  const rawStatus = activeQuote ? 'RESPONDIDA' : 'PENDIENTE';
  const normStatus = String(rawStatus).toUpperCase();

  const customerName = quote.otroParticipanteNombre || quote.compradorNombre || quote.buyerName || (mode === 'buyer' ? 'Tienda RepuesTop' : 'Comprador RepuesTop');
  const customerAvatar = resolveMediaUrl(quote.otroParticipanteFotoUrl || quote.compradorAvatarUrl || null);
  const productName = quote.productoNombre || quote.productName || 'Consulta de repuesto';
  const productPhoto = resolveMediaUrl(quote.productoImagenUrl || quote.imagenUrl || quote.productoImagen);
  const lastMessage = quote.ultimoMensaje || quote.mensaje || 'Solicito cotización para este repuesto...';
  const quotedPriceRaw = activeQuote?.precioFinal ?? activeQuote?.precio ?? quote.precioCotizado ?? quote.montoEstimado;
  const quotedPrice = quotedPriceRaw != null ? Number(quotedPriceRaw) : null;
  const unreadCount = Number(quote.mensajesNoLeidos || 0);

  return (
    <div className="order-card-container quote-card-container" onClick={() => onSelectQuote && onSelectQuote(quote)}>
      {/* Top Header Row */}
      <div className="order-card-header">
        <div className="order-card-title-group">
          <h3 className="order-card-id">Cotización #{quoteIdShort}</h3>
          <span className="order-card-date-meta">{dateStr}{unreadCount > 0 ? ` · ${unreadCount} sin leer` : ''}</span>
        </div>
        <QuoteStatusBadge status={rawStatus} size="small" />
      </div>

      {/* Customer Row */}
      <div className="order-card-person-row">
        {customerAvatar ? (
          <img src={customerAvatar} alt={customerName} className="person-avatar-img" />
        ) : (
          <div className="person-avatar-fallback">
            <User size={15} />
          </div>
        )}
        <div className="person-copy">
          <strong className="person-name">{customerName}</strong>
          <span className="person-role">{mode === 'buyer' ? 'Tienda vendedora' : 'Solicitante'}</span>
        </div>
      </div>

      {/* Product & Query Row */}
      <div className="order-card-product-row">
        {productPhoto ? (
          <img src={productPhoto} alt={productName} className="product-thumb-img" />
        ) : (
          <div className="product-thumb-fallback">
            <MessageSquare size={22} />
          </div>
        )}
        <div className="product-copy">
          <h4 className="product-title">{productName}</h4>
          <span className="product-meta quote-message-preview">"{lastMessage}"</span>
        </div>
      </div>

      {/* Footer Row */}
      <div className="order-card-footer">
        <div className="delivery-info">
          <span className="footer-label">Estado solicitud</span>
          <strong className="footer-value">
            {normStatus === 'PENDIENTE' ? (mode === 'buyer' ? 'Esperando a la tienda' : 'Esperando tu respuesta') : activeQuote?.disponibilidad || 'Oferta enviada'}
          </strong>
        </div>

        <div className="total-info">
          <span className="footer-label">Monto Cotizado</span>
          <strong className="total-amount">
            {quotedPrice ? formatCLP(quotedPrice) : 'Por definir'}
          </strong>
        </div>
      </div>

      {/* Bottom Actions Row */}
      <div className="order-card-actions">
        <button
          type="button"
          className="btn-view-details"
          onClick={(e) => {
            e.stopPropagation();
            onSelectQuote?.(quote);
          }}
        >
          <span>Ver conversación completa</span>
          <ChevronRight size={15} />
        </button>

        <button
          type="button"
          className={`btn-order-action ${normStatus === 'PENDIENTE' ? 'btn-action-blue' : 'btn-action-amber'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onQuickRespond) onQuickRespond(quote);
            else onSelectQuote?.(quote);
          }}
        >
          <Send size={13} />
          <span>{normStatus === 'PENDIENTE' ? (mode === 'buyer' ? 'Ver chat' : 'Responder') : 'Ver oferta'}</span>
        </button>
      </div>
    </div>
  );
}
