import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import '../styles/auction-items-modal.css';

/** Visor de imágenes a pantalla completa: la tienda ve en grande la falla o la pieza que necesita el comprador. */
export default function AuctionImageViewer({ photos = [], startIndex = 0, title, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const total = photos.length;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setIndex((value) => (value + 1) % total);
      if (event.key === 'ArrowLeft') setIndex((value) => (value - 1 + total) % total);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, total]);

  if (total === 0) return null;

  return (
    <div className="aiv-backdrop" role="dialog" aria-modal="true" aria-label="Imagen de la solicitud" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <button type="button" className="aiv-close" onClick={onClose} aria-label="Cerrar"><X size={22} /></button>
      {total > 1 && (
        <button type="button" className="aiv-nav is-prev" onClick={() => setIndex((value) => (value - 1 + total) % total)} aria-label="Imagen anterior"><ChevronLeft size={26} /></button>
      )}
      <figure className="aiv-figure">
        <img src={photos[index]} alt={title ? `${title} (foto ${index + 1})` : `Foto ${index + 1}`} />
        <figcaption>{title ? `${title} · ` : ''}Foto {index + 1} de {total}</figcaption>
      </figure>
      {total > 1 && (
        <button type="button" className="aiv-nav is-next" onClick={() => setIndex((value) => (value + 1) % total)} aria-label="Imagen siguiente"><ChevronRight size={26} /></button>
      )}
    </div>
  );
}
