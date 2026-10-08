import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

/**
 * Ícono "i" que abre la explicación completa (igual que la app, components/ui/InfoHint). Saca de
 * la pantalla los textos largos de ayuda: la vista queda limpia y quien quiere el detalle lo pide
 * con un clic. Se monta por portal en `document.body` para que el velo cubra toda la ventana.
 */
export default function InfoHint({ title, paragraphs, tone = 'blue', size = 17, testId }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`info-hint-trigger is-${tone}`}
        onClick={(event) => { event.stopPropagation(); setOpen(true); }}
        aria-label={`Más información: ${title}`}
        data-testid={testId}
      >
        <Info size={size} />
      </button>
      {open && createPortal(
        <div className="info-hint-backdrop" onClick={() => setOpen(false)}>
          <section className="info-hint-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
            <header>
              <span className="info-hint-sheet-icon"><Info size={18} /></span>
              <h3>{title}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={18} /></button>
            </header>
            <div className="info-hint-sheet-body">
              {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
