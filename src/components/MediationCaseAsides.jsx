import React from 'react';
import {
  CalendarClock, Car, CheckCircle2, ChevronRight, Circle, FileText, Flag, Gavel, Headphones,
  Lightbulb, Package, Receipt, ShieldCheck, Wallet,
} from 'lucide-react';
import { claimReasonLabel } from '../data/claimReason';
import { refundStatusLabel, resolutionFavorLabel } from '../utils/mediationTimeline';

/**
 * 12-oct: paneles a los costados del chat del pedido en escritorio. El chat es una columna de
 * 720 px y en una pantalla ancha quedaban dos franjas vacias; ahora a la izquierda va la compra
 * (producto, montos, vehiculo, documentos y fechas clave) y a la derecha el estado del caso
 * (reclamo, mediador, garantia, reembolso y que conviene hacer). Solo se muestran cuando hay
 * ancho de sobra (container query en mediation-chat.css); en celular y tablet no cambian nada.
 */

const formatMoney = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;

function formatDate(value, withTime = false) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', withTime
    ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const ESTADO_PEDIDO = {
  PENDIENTE: 'Pendiente de pago',
  PAGADO: 'Por confirmar',
  EN_PREPARACION: 'En preparación',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  FINALIZADO: 'Finalizado',
  EN_MEDIACION: 'En mediación',
  CANCELADO: 'Cancelado',
};

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="mchat-aside-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function CaseOrderAside({ chat, isBuyer, codigo, productPhoto, vehicles, onOpenOrder, onOpenVehicle }) {
  if (!chat) return null;
  const estadoPedido = ESTADO_PEDIDO[String(chat.estadoPedido || '').toUpperCase()] || null;
  const extraItems = Math.max(0, Number(chat.pedidoItemsCount || 0) - 1);
  const monto = isBuyer ? chat.pedidoTotal : (chat.montoTienda ?? chat.pedidoTotal);
  const hitos = [
    { key: 'pago', label: 'Pago aprobado', date: chat.pagadoAt },
    { key: 'recepcion', label: 'Recibido', date: chat.recibidoAt },
    { key: 'reclamo', label: 'Reclamo abierto', date: chat.reclamoAt },
    { key: 'mediacion', label: 'Mediador solicitado', date: chat.mediacionSolicitadaAt },
    { key: 'resolucion', label: 'Caso resuelto', date: chat.mediacionResueltaAt },
  ].filter((hito) => hito.date);

  return (
    <aside className="mchat-aside mchat-aside--left" aria-label={isBuyer ? 'Tu compra' : 'La venta'}>
      <section className="mchat-aside-card">
        <header className="mchat-aside-title"><Package size={16} /> {isBuyer ? 'Tu compra' : 'La venta'}</header>
        <div className="mchat-aside-product">
          {productPhoto
            ? <img src={productPhoto} alt="" referrerPolicy="no-referrer" />
            : <span className="mchat-aside-product-ph"><Package size={20} /></span>}
          <div>
            <strong>{chat.productoNombre || 'Repuesto'}</strong>
            {extraItems > 0 && <small>y {extraItems} {extraItems === 1 ? 'producto más' : 'productos más'}</small>}
          </div>
        </div>
        <Row label="Pedido" value={codigo} />
        <Row label="Estado" value={estadoPedido} />
        <Row label={isBuyer ? 'Total pagado' : 'Monto de tu venta'} value={monto != null ? formatMoney(monto) : null} />
        <button type="button" className="mchat-aside-link" onClick={onOpenOrder}>
          <Receipt size={15} /> Ver detalle del pedido <ChevronRight size={14} />
        </button>
      </section>

      <section className="mchat-aside-card">
        <header className="mchat-aside-title"><Car size={16} /> {vehicles.length > 1 ? `Vehículos (${vehicles.length})` : 'Vehículo'}</header>
        {vehicles.length ? vehicles.slice(0, 2).map((vehiculo, index) => (
          <div key={`${vehiculo.patente || vehiculo.chasis || index}`} className="mchat-aside-vehicle">
            <strong>{[vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(' ') || 'Vehículo del comprador'}</strong>
            <small>{[vehiculo.version, vehiculo.patente ? `Patente ${vehiculo.patente}` : null].filter(Boolean).join(' · ') || 'Sin más datos'}</small>
          </div>
        )) : <p className="mchat-aside-muted">El comprador no indicó un vehículo para esta compra.</p>}
        <button type="button" className="mchat-aside-link" onClick={onOpenVehicle}>
          <FileText size={15} /> {chat.boletaVentaDisponible ? 'Vehículo y boleta' : 'Ver vehículo'} <ChevronRight size={14} />
        </button>
      </section>

      {hitos.length > 0 && (
        <section className="mchat-aside-card">
          <header className="mchat-aside-title"><CalendarClock size={16} /> Fechas clave</header>
          <ol className="mchat-aside-steps">
            {hitos.map((hito) => (
              <li key={hito.key}>
                <span className="mchat-aside-step-dot" aria-hidden="true" />
                <span>{hito.label}</span>
                <time>{formatDate(hito.date, true)}</time>
              </li>
            ))}
          </ol>
        </section>
      )}
    </aside>
  );
}

export function CaseStatusAside({ chat, isBuyer, otherPartyName, resolved, isEscalated, onHelp }) {
  if (!chat) return null;
  const tieneReclamo = Boolean(chat.motivo || chat.descripcion);
  const enMediacion = chat.estadoMediacion === 'EN_MEDIACION';
  const estado = resolved
    ? { label: chat.estadoMediacion ? 'Mediación resuelta' : 'Reclamo resuelto', tone: 'ok', Icon: CheckCircle2 }
    : enMediacion || isEscalated
      ? { label: 'En mediación', tone: 'mediation', Icon: Gavel }
      : tieneReclamo
        ? { label: 'Reclamo abierto', tone: 'warning', Icon: Flag }
        : { label: isBuyer ? 'Conversación con la tienda' : 'Conversación con el comprador', tone: 'neutral', Icon: Circle };
  const plazoMediador = chat.fechaLimiteMediador ? formatDate(chat.fechaLimiteMediador) : null;
  const favor = resolutionFavorLabel(chat.resolucionFavor, isBuyer);
  const montoReembolso = Number(chat.montoReembolso || 0);

  const consejos = resolved
    ? [
      'El caso quedó cerrado; el historial de esta conversación se conserva.',
      isBuyer ? 'Si la pieza vuelve a fallar, tienes garantía legal: pide ayuda a soporte.' : 'Si el comprador pide ayuda por garantía, soporte podría contactarte.',
    ]
    : isBuyer
      ? [
        'Describe el problema con detalle y adjunta fotos de la pieza y del empaque.',
        'Mantén la conversación aquí: queda como respaldo si necesitas un mediador.',
        'Si no llegan a acuerdo, puedes pedir un mediador de RepuesTop sin costo.',
      ]
      : [
        `Responde pronto: ${otherPartyName || 'el comprador'} ve tus mensajes al instante.`,
        'Pide fotos o datos del vehículo si necesitas confirmar la compatibilidad.',
        'Ofrece una solución concreta: cambio de pieza, devolución o reembolso parcial.',
      ];

  return (
    <aside className="mchat-aside mchat-aside--right" aria-label="Estado del caso">
      <section className="mchat-aside-card">
        <header className="mchat-aside-title"><ShieldCheck size={16} /> Estado del caso</header>
        <span className={`mchat-aside-chip is-${estado.tone}`}><estado.Icon size={13} /> {estado.label}</span>
        {tieneReclamo && (
          <div className="mchat-aside-claim">
            <strong>{claimReasonLabel(chat.motivo)}</strong>
            {chat.descripcion && <p>{chat.descripcion}</p>}
          </div>
        )}
        {!resolved && !enMediacion && (
          <Row
            label="Mediador"
            value={chat.mediadorDisponible
              ? (plazoMediador ? `Disponible hasta el ${plazoMediador}` : 'Disponible')
              : (chat.recibidoAt ? 'Plazo vencido' : 'Disponible al recibir el producto')}
          />
        )}
        {chat.garantiaHasta && <Row label="Garantía legal" value={`Hasta el ${formatDate(chat.garantiaHasta)}`} />}
        {favor && <Row label="Resolución" value={favor} />}
        {chat.resolucionOpcionLabel && <Row label="Decisión" value={chat.resolucionOpcionLabel} />}
      </section>

      {montoReembolso > 0 && (
        <section className="mchat-aside-card">
          <header className="mchat-aside-title"><Wallet size={16} /> Reembolso</header>
          <Row label="Monto" value={formatMoney(montoReembolso)} />
          <Row label="Estado" value={refundStatusLabel(chat.estadoReembolso)} />
          {isBuyer && <p className="mchat-aside-muted">Flow te envía un correo para recibir la devolución; acéptalo antes de la fecha límite.</p>}
        </section>
      )}

      <section className="mchat-aside-card">
        <header className="mchat-aside-title"><Lightbulb size={16} /> {resolved ? 'Qué sigue' : 'Para resolverlo rápido'}</header>
        <ul className="mchat-aside-tips">
          {consejos.map((consejo) => <li key={consejo}>{consejo}</li>)}
        </ul>
        <button type="button" className="mchat-aside-link" onClick={onHelp}>
          <Headphones size={15} /> Centro de ayuda <ChevronRight size={14} />
        </button>
      </section>
    </aside>
  );
}
