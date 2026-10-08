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
      <InfoSheet open={open} title={title} paragraphs={paragraphs} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * La hoja de InfoHint, controlada desde afuera (igual que la app): para abrirla desde un ícono o
 * una franja propia. `action` agrega un botón al pie; `children`, contenido bajo los párrafos.
 */
export function InfoSheet({ open, title, paragraphs = [], onClose, action, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="info-hint-backdrop" onClick={onClose}>
      <section className="info-hint-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header>
          <span className="info-hint-sheet-icon"><Info size={18} /></span>
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="info-hint-sheet-body">
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {children}
        </div>
        {action && (
          <footer className="info-hint-sheet-footer">
            <button type="button" onClick={() => { onClose(); action.onPress(); }}>{action.label}</button>
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}

