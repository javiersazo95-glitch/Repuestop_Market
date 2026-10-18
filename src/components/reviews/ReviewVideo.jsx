import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VolumeX, X } from 'lucide-react';
import { resolveMediaUrl } from '../../services/api';

/**
 * Video de una opinion de producto: se reproduce solo, sin sonido y en bucle mientras esta a la
 * vista (y `paused` no lo frena); al tocarlo se abre grande con sonido y controles.
 */
export default function ReviewVideo({ url, paused = false }) {
  const videoRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [open, setOpen] = useState(false);
  const src = resolveMediaUrl(url);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (inView && !paused && !open) node.play().catch(() => {});
    else node.pause();
  }, [inView, paused, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!src) return null;
  return (
    <>
      <button type="button" className="rv-video" onClick={() => setOpen(true)} aria-label="Ver el video de la opinión con sonido">
        {/* `#t=0.1` muestra el primer cuadro en iPhone antes de reproducir. */}
        <video ref={videoRef} src={`${src}#t=0.1`} muted loop playsInline preload="metadata" />
        <span className="rv-video-badge" aria-hidden="true"><VolumeX size={12} /></span>
      </button>
      {open && createPortal(
        <div className="rv-video-viewer" role="dialog" aria-modal="true" aria-label="Video de la opinión" onClick={() => setOpen(false)}>
          <video src={src} controls autoPlay playsInline onClick={(event) => event.stopPropagation()} />
          <button type="button" className="rv-video-close" aria-label="Cerrar video" onClick={() => setOpen(false)}><X size={22} /></button>
        </div>,
        document.body,
      )}
    </>
  );
}
