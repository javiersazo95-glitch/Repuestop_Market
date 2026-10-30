import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Clock, Copy, Gavel, MessageSquareText, Package, X } from 'lucide-react';
import { itemVehicleLabel } from './AuctionItemsCard';
import '../styles/auction-items-modal.css';

/** Copia un texto al portapapeles; si el navegador lo bloquea, cae al método antiguo. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  }
}

function CopyChassis({ value }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className={`aim-icon-btn ${copied ? 'is-done' : ''}`}
      onClick={async () => setCopied(await copyText(value))}
      aria-label={copied ? 'Chasis copiado' : 'Copiar chasis'}
      title={copied ? 'Copiado' : 'Copiar chasis'}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function ItemRow({ item, index, vehicle, isOpen, focused }) {
  const [showMessage, setShowMessage] = useState(Boolean(focused));
  const own = item.vehiculoPropio;
  const label = own ? itemVehicleLabel(item) : vehicle.label;
  const chassis = own ? item.chasis : vehicle.chasis;
  const plate = own ? item.patenteAnonimizada : vehicle.plate;

  return (
    <li className={`aim-item ${item.pendiente ? '' : 'is-awarded'}`}>
      <div className="aim-item-main">
        <span className="aim-num">{index + 1}</span>
        <div className="aim-item-title">
          <strong>{item.repuesto}</strong>
          {item.categoria && <small>{item.categoria}</small>}
        </div>
        <span className="aim-qty">× {item.cantidad}</span>
        {item.pendiente ? (
          <span className="aim-status is-open"><Clock size={12} /> {isOpen ? 'Disponible' : 'Sin adjudicar'}</span>
        ) : (
          <span className="aim-status is-awarded"><CheckCircle2 size={12} /> Adjudicado</span>
        )}
        {item.descripcion ? (
          <button
            type="button"
            className={`aim-icon-btn ${showMessage ? 'is-active' : ''}`}
            aria-expanded={showMessage}
            aria-label="Ver mensaje del comprador para este repuesto"
            title="Mensaje del comprador"
            onClick={() => setShowMessage((value) => !value)}
          >
            <MessageSquareText size={15} />
          </button>
        ) : <span className="aim-icon-spacer" aria-hidden="true" />}
      </div>

      <dl className="aim-specs">
        <div><dt>Vehículo</dt><dd>{label || '—'}{own && <em>otro vehículo</em>}</dd></div>
        <div><dt>Patente</dt><dd className="is-mono">{plate || '—'}</dd></div>
        <div className="aim-chassis">
          <dt>Chasis / VIN</dt>
          <dd className="is-mono">{chassis || '—'}{chassis && <CopyChassis value={chassis} />}</dd>
        </div>
      </dl>

      {showMessage && item.descripcion && (
        <div className="aim-message"><MessageSquareText size={14} /><p><b>Mensaje del comprador:</b> {item.descripcion}</p></div>
      )}
    </li>
  );
}

/** Detalle estructurado de todos los repuestos del pedido, con su chasis copiable y el mensaje del comprador. */
export default function AuctionItemsModal({ isOpen, onClose, items = [], vehicle = {}, orderOpen, focusItemId = null, canOffer = false, onOffer }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const units = items.reduce((sum, item) => sum + item.cantidad, 0);

  return (
    <div className="aim-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="aim-modal" role="dialog" aria-modal="true" aria-label="Repuestos solicitados">
        <header className="aim-head">
          <span className="aim-head-icon"><Package size={18} /></span>
          <div>
            <h2>Repuestos solicitados</h2>
            <small>{items.length} {items.length === 1 ? 'repuesto' : 'repuestos'} · {units} {units === 1 ? 'unidad' : 'unidades'}{vehicle.label ? ` · ${vehicle.label}` : ''}</small>
          </div>
          <button type="button" className="aim-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <ol className="aim-list">
          {items.map((item, index) => (
            <ItemRow key={item.id} item={item} index={index} vehicle={vehicle} isOpen={orderOpen} focused={item.id === focusItemId} />
          ))}
        </ol>
        {canOffer && (
          <footer className="aim-foot">
            <span>¿Tienes alguno de estos repuestos? Puedes ofrecer solo los que tengas.</span>
            <button type="button" className="aim-offer" onClick={onOffer}><Gavel size={15} /> Tomar búsqueda y ofertar</button>
          </footer>
        )}
      </div>
    </div>
  );
}
