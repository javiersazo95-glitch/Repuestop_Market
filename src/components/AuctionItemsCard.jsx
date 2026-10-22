import React, { useState } from 'react';
import { CheckCircle2, Clock, ListTree, MessageSquareText, Package } from 'lucide-react';
import AuctionInfoTip from './AuctionInfoTip';
import AuctionItemsModal from './AuctionItemsModal';

const PREVIEW_COUNT = 3;

/** "Kia Rio 2019" para el vehículo de un repuesto. */
export function itemVehicleLabel(item) {
  return [item.marca, item.modelo, item.anio].filter(Boolean).join(' ');
}

/**
 * Repuestos del pedido, uno por uno: cantidad, categoría, el vehículo si es otro que el del pedido y si
 * sigue disponible para ofertar o ya fue adjudicado.
 */
export default function AuctionItemsCard({ items = [], isOpen, vehicle = {}, canOffer = false, onOffer }) {
  const [showAll, setShowAll] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const openModal = (itemId = null) => { setFocusId(itemId); setShowAll(true); };
  const preview = items.slice(0, PREVIEW_COUNT);
  const hidden = items.length - preview.length;
  const units = items.reduce((sum, item) => sum + item.cantidad, 0);

  return (
    <section className="as-card av-items" aria-label="Repuestos solicitados">
      <h2 className="as-title">
        <span>
          <Package size={17} /> Repuestos solicitados
          <AuctionInfoTip label="Información sobre el pedido">
            Una tienda puede ofrecer solo los repuestos que tenga. Si el comprador acepta una oferta parcial, los repuestos que queden pendientes siguen disponibles para que otras tiendas ofrezcan solo lo que falta. ¿Dudas? Deja un comentario y el comprador te responderá.
          </AuctionInfoTip>
        </span>
        <small>{items.length} {items.length === 1 ? 'repuesto' : 'repuestos'} · {units} {units === 1 ? 'unidad' : 'unidades'}</small>
        {items.length > 0 && (
          <button type="button" className="av-items-all" onClick={() => openModal()} aria-label="Ver todos los repuestos solicitados" title="Ver todos los repuestos">
            <ListTree size={16} />
          </button>
        )}
      </h2>

      <ol className="av-items-list is-compact">
        {preview.map((item, index) => (
          <li key={item.id} className={item.pendiente ? '' : 'is-awarded'}>
            <span className="av-item-number">{index + 1}</span>
            <div className="av-item-line">
              <strong>{item.repuesto}</strong>
              <span className="av-item-qty">× {item.cantidad}</span>
              {item.categoria && <span className="av-item-cat">{item.categoria}</span>}
              {item.vehiculoPropio && <span className="av-item-cat is-vehicle">{itemVehicleLabel(item)}</span>}
              {item.pendiente ? (
                <span className="av-item-status is-open"><Clock size={12} /> {isOpen ? 'Disponible' : 'Sin adjudicar'}</span>
              ) : (
                <span className="av-item-status is-awarded"><CheckCircle2 size={12} /> Adjudicado</span>
              )}
            </div>
            {item.descripcion && (
              <button type="button" className="av-item-msg" onClick={() => openModal(item.id)} aria-label={`Ver mensaje del comprador sobre ${item.repuesto}`} title="Ver mensaje del comprador">
                <MessageSquareText size={15} />
              </button>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className="av-items-more" onClick={() => openModal()}>
        {hidden > 0 ? `+ ${hidden} ${hidden === 1 ? 'repuesto más' : 'repuestos más'} · ` : ''}Ver desglose completo
      </button>
      <AuctionItemsModal
        isOpen={showAll}
        onClose={() => setShowAll(false)}
        items={items}
        vehicle={vehicle}
        orderOpen={isOpen}
        focusItemId={focusId}
        canOffer={canOffer}
        onOffer={() => { setShowAll(false); onOffer?.(); }}
      />
    </section>
  );
}
