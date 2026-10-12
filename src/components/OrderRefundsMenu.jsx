import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, ChevronRight, ShieldCheck, X } from 'lucide-react';
import { InfoSheet } from './InfoHint';
import {
  activeBuyerRefunds,
  buyerRefunds,
  refundOriginLabel,
  refundStateChip,
  refundTimeline,
} from '../data/refundStatus';

function formatCLP(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString('es-CL')}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * 12-oct: las devoluciones EN CURSO del pedido (paridad con la app). `trigger="icon"` es la
 * alerta del encabezado del detalle; `trigger="button"` es "Ver estado del reembolso" en la
 * tarjeta del listado. Con varias se despliega la lista; cada una abre su linea de tiempo con
 * Flow. Sin devoluciones en curso no se muestra nada.
 */
export default function OrderRefundsMenu({ order, trigger = 'icon' }) {
  const anchorRef = useRef(null);
  const [menuAt, setMenuAt] = useState(null);
  const queryClient = useQueryClient();
  // Se guarda el id y no el objeto: al refrescar el pedido, la linea de tiempo abierta toma el
  // estado nuevo (p.ej. pasa de "acepta el correo" a "Flow procesa la devolucion").
  const [selectedId, setSelectedId] = useState(null);
  const selected = selectedId ? buyerRefunds(order).find((refund) => refund.id === selectedId) || null : null;
  const active = activeBuyerRefunds(order);
  const hasActive = active.length > 0;

  // 12-oct: el detalle y la tarjeta leen el listado de pedidos, que no se refresca al volver a la
  // pestaña. El comprador sale a aceptar la devolucion en el correo de Flow y vuelve: se pide de
  // nuevo (el backend consulta a Flow los reembolsos en curso al responder).
  const refresh = () => { queryClient.refetchQueries({ queryKey: ['buyerOrders'] }); };
  useEffect(() => {
    if (!hasActive) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActive]);

  const setSelected = (refund) => {
    setSelectedId(refund ? refund.id : null);
    if (refund) refresh();
  };

  useEffect(() => {
    if (!menuAt) return undefined;
    const close = () => setMenuAt(null);
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menuAt]);

  // Con la linea de tiempo abierta no se desmonta aunque la devolucion acabe de completarse.
  if (!hasActive && !selected) return null;

  const chips = active.map(refundStateChip);
  // Rojo si alguna necesita atencion (rechazada o con error); ambar si solo siguen en curso.
  const tone = chips.some((chip) => chip.tone === 'error') ? 'error' : 'pending';
  const subs = Array.isArray(order?.subordenes) ? order.subordenes : [];
  const storeName = (sellerId) => (sellerId ? subs.find((sub) => String(sub?.proveedorId) === sellerId)?.nombreTienda || null : null);

  const open = (event) => {
    event.stopPropagation();
    if (active.length === 1) { setSelected(active[0]); return; }
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(300, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    setMenuAt({ top: rect.bottom + 6, left, width });
  };

  const label = active.length === 1 ? 'Ver estado del reembolso' : `Ver estado de ${active.length} reembolsos`;

  return (
    <>
      {hasActive && (
      <span ref={anchorRef} className="order-refunds-anchor">
        {trigger === 'button' ? (
          <button type="button" className={`order-refunds-button is-${tone}`} onClick={open} aria-label={label}>
            <AlertCircle size={16} />
            <span>Ver estado del reembolso</span>
          </button>
        ) : (
          <button type="button" className={`order-refunds-icon is-${tone}`} onClick={open} aria-label={label} title={label}>
            <AlertCircle size={18} />
            {active.length > 1 && <span className="order-refunds-badge">{active.length}</span>}
          </button>
        )}
      </span>
      )}

      {menuAt && createPortal(
        <div className="order-refunds-menu-backdrop" onClick={() => setMenuAt(null)}>
          <div
            className="order-refunds-menu"
            role="menu"
            style={{ top: menuAt.top, left: menuAt.left, width: menuAt.width }}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="order-refunds-menu-title">Devoluciones en curso</span>
            {active.map((refund, index) => {
              const chip = chips[index];
              const store = storeName(refund.sellerId);
              return (
                <button key={refund.id} type="button" role="menuitem" className="order-refunds-menu-item"
                  onClick={() => { setMenuAt(null); setSelected(refund); }}>
                  <span className="order-refunds-menu-copy">
                    <strong>{refund.amount > 0 ? formatCLP(refund.amount) : 'Devolución'}{store ? ` · ${store}` : ''}</strong>
                    <small>{refundOriginLabel(refund.origin)}</small>
                    <em className={`order-refunds-chip is-${chip.tone}`}>{chip.label}</em>
                  </span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}

      <InfoSheet open={Boolean(selected)} title="Seguimiento de tu devolución" onClose={() => setSelected(null)}>
        {selected && (
          <>
            <p className="order-refunds-sheet-sub">
              {[selected.amount > 0 ? formatCLP(selected.amount) : null, storeName(selected.sellerId)].filter(Boolean).join(' · ') || refundOriginLabel(selected.origin)}
            </p>
            <ol className="order-refund-timeline">
              {refundTimeline(selected, order?.codigoSoporte).map((step) => (
                <li key={step.key} className={`is-${step.status}`}>
                  <span className="order-refund-timeline-dot" aria-hidden="true">
                    {step.status === 'done' ? <Check size={12} /> : step.status === 'error' ? <X size={12} /> : null}
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    {step.date && <small>{formatDate(step.date)}</small>}
                    {step.detail && step.status !== 'upcoming' && <span>{step.detail}</span>}
                  </div>
                </li>
              ))}
            </ol>
            <p className="order-refunds-flow-note">
              <ShieldCheck size={15} />
              <span>Las devoluciones se hacen a través de Flow, la pasarela con que pagaste. El estado se actualiza a medida que Flow lo informa.</span>
            </p>
          </>
        )}
      </InfoSheet>
    </>
  );
}
