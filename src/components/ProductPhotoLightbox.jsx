import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import ProductPhoto from './ProductPhoto';

/**
 * Fotos del repuesto a pantalla completa (escritorio), como el lightbox de la app. Comparte el
 * índice de la galería: las flechas y las miniaturas mueven la misma foto activa de la ficha.
 * Cierra con el botón, con Escape o tocando el fondo.
 */
export default function ProductPhotoLightbox({ images, index, product, title, onClose, onChange, onSelect }) {
  const total = images.length;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft' && total > 1) onChange(-1);
      else if (event.key === 'ArrowRight' && total > 1) onChange(1);
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onChange, total]);

  return (
    <div className="pdd-lightbox" role="dialog" aria-modal="true" aria-label={`Fotos de ${title}`} onMouseDown={onClose}>
      <div className="pdd-lightbox-top" onMouseDown={(event) => event.stopPropagation()}>
        <span className="pdd-lightbox-title">{title}</span>
        {total > 1 && <span className="pdd-lightbox-count">{index + 1} / {total}</span>}
        <button type="button" className="pdd-lightbox-close" onClick={onClose} aria-label="Cerrar fotos"><X size={22} /></button>
      </div>

      <div className="pdd-lightbox-stage">
        {total > 1 && (
          <button type="button" className="pdd-lightbox-arrow" onMouseDown={(event) => event.stopPropagation()} onClick={() => onChange(-1)} aria-label="Foto anterior">
            <ChevronLeft size={28} />
          </button>
        )}
        <figure className="pdd-lightbox-figure" onMouseDown={(event) => event.stopPropagation()}>
          <ProductPhoto src={images[index]} product={product} alt={`Foto ${index + 1} de ${title}`} iconSize={96} />
        </figure>
        {total > 1 && (
          <button type="button" className="pdd-lightbox-arrow" onMouseDown={(event) => event.stopPropagation()} onClick={() => onChange(1)} aria-label="Foto siguiente">
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      {total > 1 && (
        <div className="pdd-lightbox-thumbs" onMouseDown={(event) => event.stopPropagation()}>
          {images.map((image, position) => (
            <button
              key={`${image}-${position}`}
              type="button"
              className={position === index ? 'is-active' : ''}
              onClick={() => onSelect(position)}
              aria-label={`Ver foto ${position + 1}`}
              aria-current={position === index}
            >
              <ProductPhoto src={image} product={product} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
