import React from 'react';
import { CalendarDays, Car, ChevronRight, MessageCircle, Package, Search, Store, User } from 'lucide-react';
import { resolveMediaUrl } from '../../services/api';
import {
  INQUIRY_KIND_LABEL, INQUIRY_STAGE_TONE, REPUESTIN_IMAGE, formatInquiryPrice, inquiryEventLabel, inquiryStage, inquiryStageLabel,
} from '../../utils/inquiry';
import '../../styles/app-kit.css';
import '../../styles/inquiry.css';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function RepuestinAvatar({ size = 18 }) {
  return <img className="inq-repuestin" src={REPUESTIN_IMAGE} alt="Repuestín, el asistente de RepuesTop" width={size} height={size} style={{ width: size, height: size }} />;
}

export function InquiryStageBadge({ stage, viewer }) {
  return <span className={`inq-stage inq-stage-${INQUIRY_STAGE_TONE[stage]}`}><i aria-hidden="true" />{inquiryStageLabel(stage, viewer)}</span>;
}

/**
 * Vista previa de una pregunta de disponibilidad en el menú "Cotizaciones" (igual que la app:
 * `app/(seller)/mensajes.tsx` para la tienda y `app/(buyer)/messages.tsx` para el comprador).
 */
export default function InquiryCard({ conversation, mode = 'seller', onOpen }) {
  const viewer = mode === 'buyer' ? 'buyer' : 'seller';
  const stage = inquiryStage(conversation);
  const part = conversation.consultaRepuesto || 'Repuesto consultado';
  const offered = Boolean(conversation.productoId);
  const title = offered ? (conversation.productoNombre || part) : part;
  const price = offered ? formatInquiryPrice(conversation.productoPrecio) : null;
  const photo = offered ? resolveMediaUrl(conversation.productoImagenUrl || '') : null;
  const participantName = conversation.otroParticipanteNombre || (viewer === 'buyer' ? 'Tienda' : 'Comprador');
  const participantPhoto = resolveMediaUrl(conversation.otroParticipanteFotoUrl || '');
  const lastText = conversation.ultimoMensaje || '';
  const preview = inquiryEventLabel(lastText, viewer) || lastText || part;
  const unread = Number(conversation.mensajesNoLeidos || 0);
  const actionLabel = viewer === 'seller'
    ? (stage === 'waiting' ? 'Responder' : 'Ver chat')
    : (stage === 'offered' ? 'Ver repuesto' : 'Ver chat');
  const open = () => onOpen?.(conversation);

  return (
    <article
      className={`inq-card ${unread > 0 ? 'is-unread' : ''} ${viewer === 'seller' && stage === 'waiting' ? 'is-pending' : ''}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}
      aria-label={`${INQUIRY_KIND_LABEL} ${viewer === 'seller' ? 'de' : 'a'} ${participantName}: ${part}. ${inquiryStageLabel(stage, viewer)}${unread > 0 ? `. ${unread} sin leer` : ''}`}
    >
      <header className="inq-card-top">
        <span className="inq-kind"><RepuestinAvatar size={20} />{INQUIRY_KIND_LABEL}</span>
        <span className="inq-card-top-right">
          {unread > 0 && <span className="inq-unread" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
          <InquiryStageBadge stage={stage} viewer={viewer} />
        </span>
      </header>

      <div className="inq-card-person">
        <span className="inq-avatar">
          {participantPhoto ? <img src={participantPhoto} alt="" referrerPolicy="no-referrer" /> : (viewer === 'buyer' ? <Store size={16} /> : <User size={16} />)}
        </span>
        <span className="inq-card-person-copy">
          <strong>{participantName}</strong>
          <small>{viewer === 'buyer' ? 'Tienda' : 'Cliente'}</small>
        </span>
        <span className="inq-card-date"><CalendarDays size={13} />{formatDate(conversation.ultimoMensajeFecha || conversation.createdAt)}</span>
      </div>

      <div className="inq-card-product">
        <span className="inq-thumb">
          {photo ? <img src={photo} alt="" /> : offered ? <Package size={22} /> : <Search size={20} />}
        </span>
        <span className="inq-card-product-copy">
          <strong>{title}</strong>
          {price ? <b className="inq-price">{price}</b> : <small>{offered ? 'Repuesto ofrecido' : viewer === 'seller' ? '¿Lo tienes? Ofrécelo o responde' : 'Buscando en esta tienda'}</small>}
        </span>
      </div>

      <dl className="inq-card-details">
        <div><dt><Car size={14} /> Vehículo:</dt><dd>{conversation.consultaVehiculo || 'Sin indicar'}</dd></div>
        <div className="is-message"><dt><MessageCircle size={14} /> Mensaje:</dt><dd>{preview}</dd></div>
      </dl>

      <footer className="inq-card-footer">
        <button type="button" className={`inq-btn ${viewer === 'seller' && stage === 'waiting' ? 'inq-btn-primary' : viewer === 'buyer' && stage === 'offered' ? 'inq-btn-primary' : 'inq-btn-soft'}`} onClick={(event) => { event.stopPropagation(); open(); }}>
          {actionLabel} <ChevronRight size={15} />
        </button>
      </footer>
    </article>
  );
}
