import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const BADGE_SRC = '/top-ventas-badge-transparent.png';

/** La misma insignia informativa que usa la app movil en cards y detalle. */
export default function ProductTopBadge({ compact = false, className = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`product-top-badge ${compact ? 'is-compact' : ''} ${className}`.trim()}
        aria-label="Producto Top. Ver qué significa"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <img src={BADGE_SRC} alt="Insignia Top Ventas" />
      </button>

      {open && createPortal(
        <div className="product-top-explainer-overlay" role="dialog" aria-modal="true" aria-labelledby="product-top-explainer-title" onClick={() => setOpen(false)}>
          <section className="product-top-explainer" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="product-top-explainer-close" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={18} /></button>
            <img src={BADGE_SRC} alt="Insignia Top Ventas" />
            <h3 id="product-top-explainer-title">Producto Top</h3>
            <p>Repuesto destacado por sus resultados de venta, calidad y precio. Los productos Top aparecen primero en las búsquedas durante 30 días.</p>
            <button type="button" className="product-top-explainer-understood" onClick={() => setOpen(false)}>Entendido</button>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}

