import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, Hourglass } from 'lucide-react';
import '../../styles/tracking-detail.css';

/**
 * Desplegable "Detalle" de un registro de seguimiento (`TrackingDetail.tsx` de la app). Es también su historial: se abre
 * siempre que haya llegado algo (ofertas, diagnósticos, respuestas) y lo nuevo se marca con un punto. Solo queda cerrado
 * mientras no llega nada. El contenido se arma al abrir y, al cerrarlo, `onClose` marca la novedad como vista.
 */
export default function TrackingDetail({ news, onClose, openSignal, children }) {
  const { hasNews, summary } = news;
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  const enabled = news.hasRecords || hasNews || open;
  const text = hasNews ? summary : news.hasRecords ? news.history : 'Aún no llega nada';

  const toggle = () => {
    if (open) onClose?.();
    setOpen((value) => !value);
  };

  return (
    <div className="trk">
      <button type="button" className={`trk-toggle ${hasNews ? 'has-news' : ''}`} onClick={toggle} disabled={!enabled} aria-expanded={open} aria-label={`Detalle: ${text}`}>
        {hasNews ? <i className="trk-dot" /> : enabled ? <Clock3 size={14} /> : <Hourglass size={14} />}
        <strong>Detalle</strong>
        <span>{text}</span>
        {enabled && (open ? <ChevronUp size={18} /> : <ChevronDown size={18} />)}
      </button>
      {open && <div className="trk-body">{children}</div>}
    </div>
  );
}

/** Bloque del detalle: título con contador y su contenido. */
export function TrackingSection({ icon: Icon, title, count, children }) {
  return (
    <section className="trk-section">
      <h4><Icon size={14} /> {title}{count != null && <small>({count})</small>}</h4>
      {children}
    </section>
  );
}

/** Un elemento del detalle (una oferta, un diagnóstico, una pregunta), encerrado para no mezclarse. */
export function TrackingItem({ highlight, children }) {
  return <div className={`trk-item ${highlight ? 'is-highlight' : ''}`}>{children}</div>;
}

/** Fila de datos con etiqueta arriba y valor abajo. */
export function TrackingCells({ cells }) {
  return (
    <div className="trk-cells">
      {cells.map((cell) => (
        <div key={cell.label}><small>{cell.label}</small><strong className={cell.tone ? `is-${cell.tone}` : ''}>{cell.value}</strong></div>
      ))}
    </div>
  );
}

/** Etiqueta de estado pequeña ("Nueva", "Rechazada", "Aceptado"). */
export function TrackingTag({ label, tone }) {
  return <span className={`trk-tag is-${tone}`}>{label}</span>;
}
