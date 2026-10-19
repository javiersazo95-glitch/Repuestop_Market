import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { resolveMediaUrl } from '../../services/api';

/**
 * Fotos de una opinion de producto (hasta 4, 19-oct): miniaturas en fila; al tocar una se abre
 * el visor a pantalla completa, con flechas (y teclado) para pasar a las demas.
 */
export default function ReviewPhotos({ urls }) {
  const photos = (urls || []).map(resolveMediaUrl).filter(Boolean);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (open === null) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(null);
      if (event.key === 'ArrowRight') setOpen((index) => (index + 1) % photos.length);
      if (event.key === 'ArrowLeft') setOpen((index) => (index - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, photos.length]);

  if (!photos.length) return null;
  const move = (step) => (event) => {
    event.stopPropagation();
    setOpen((index) => (index + step + photos.length) % photos.length);
  };

  return (
    <>
      <div className="rv-photos">
        {photos.map((url, index) => (
          <button key={`${url}-${index}`} type="button" className="rv-photo" onClick={() => setOpen(index)} aria-label={`Ver foto ${index + 1} de ${photos.length}`}>
            <img src={url} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {open !== null && createPortal(
        <div className="rv-photo-viewer" role="dialog" aria-modal="true" aria-label="Foto de la opinión" onClick={() => setOpen(null)}>
          <img src={photos[open]} alt={`Foto ${open + 1} de ${photos.length}`} onClick={(event) => event.stopPropagation()} />
          <button type="button" className="rv-photo-close" onClick={() => setOpen(null)} aria-label="Cerrar foto"><X size={22} /></button>
          {photos.length > 1 && (
            <>
              <button type="button" className="rv-photo-nav is-prev" onClick={move(-1)} aria-label="Foto anterior"><ChevronLeft size={24} /></button>
              <button type="button" className="rv-photo-nav is-next" onClick={move(1)} aria-label="Foto siguiente"><ChevronRight size={24} /></button>
              <span className="rv-photo-count">{open + 1} / {photos.length}</span>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
