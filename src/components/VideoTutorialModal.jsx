import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import '../styles/video-tutorial.css';

/**
 * Video tutorial del sistema para las tiendas (19-oct, decision del usuario): "Manual de uso
 * RepuesTop", del canal de RepuesTop en YouTube. Solo lo ve el perfil vendedor (Resumen y menu
 * "Soporte" de Mi cuenta).
 *
 * Va con youtube-nocookie.com (modo de privacidad mejorada de YouTube): no guarda cookies en el
 * navegador hasta que la persona le da play. El iframe se monta solo con la ventana abierta, asi
 * que abrir Mi cuenta no carga nada de YouTube. La CSP (vercel.json, frame-src) lo permite y la
 * politica de cookies (seccion 15) lo informa.
 */
export const VIDEO_TUTORIAL_ID = 'QGvfVGSFOAA';
export const VIDEO_TUTORIAL_URL = `https://www.youtube.com/watch?v=${VIDEO_TUTORIAL_ID}`;

export default function VideoTutorialModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return createPortal(
    <div className="video-tutorial-overlay" role="presentation" onClick={onClose}>
      <div
        className="video-tutorial-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-tutorial-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="video-tutorial-header">
          <div>
            <h2 id="video-tutorial-title">Aprende a usar RepuesTop</h2>
            <p>Manual de uso para tiendas: publicar, vender, cotizar y retirar tu dinero.</p>
          </div>
          <button type="button" className="video-tutorial-close" onClick={onClose} aria-label="Cerrar video">
            <X size={18} />
          </button>
        </header>
        <div className="video-tutorial-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_TUTORIAL_ID}?rel=0&modestbranding=1`}
            title="Manual de uso RepuesTop"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <a className="video-tutorial-external" href={VIDEO_TUTORIAL_URL} target="_blank" rel="noopener noreferrer">
          Ver en YouTube
        </a>
      </div>
    </div>,
    document.body
  );
}
