import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

/** Ícono "i" que despliega un aviso informativo de fondo azul al presionarlo. */
export default function AuctionInfoTip({ label = 'Más información', children, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="as-tip" ref={ref}>
      <button type="button" className={`as-tip-btn ${open ? 'is-open' : ''}`} aria-label={label} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Info size={16} />
      </button>
      {open && <span className={`as-tip-pop is-${align}`} role="note">{children}</span>}
    </span>
  );
}
