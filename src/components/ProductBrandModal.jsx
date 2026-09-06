import React, { useEffect } from 'react';
import { Globe, ShieldCheck, ExternalLink, X, Info } from 'lucide-react';
import ProductBrandMark from './ProductBrandMark';
import { resolveBrandGuidance } from '../data/brandGuidance';

export default function ProductBrandModal({ isOpen, onClose, brand = '', product = {} }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const guidance = resolveBrandGuidance(brand, product);
  if (!guidance) return null;

  return (
    <div
      className="brand-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brand-modal-title"
      onClick={onClose}
    >
      <div
        className="brand-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="brand-modal-header">
          <div className="brand-modal-header-brand">
            <ProductBrandMark
              brand={guidance.nombre}
              logoUrl={guidance.logoUrl}
              size={54}
              className="brand-modal-mark"
            />
            <div className="brand-modal-title-wrap">
              <span className="brand-modal-eyebrow">INFORMACIÓN DE MARCA</span>
              <h2 id="brand-modal-title" className="brand-modal-title">{guidance.nombre}</h2>
            </div>
          </div>
          <button
            type="button"
            className="brand-modal-close"
            onClick={onClose}
            aria-label="Cerrar modal de marca"
          >
            <X size={20} />
          </button>
        </header>

        <div className="brand-modal-body">
          <div className="brand-info-rows">
            <div className="brand-info-row">
              <div className="brand-info-icon brand-info-icon-globe">
                <Globe size={20} />
              </div>
              <div className="brand-info-copy">
                <span className="brand-info-label">Origen de la marca</span>
                <strong className="brand-info-value">{guidance.paisOrigen}</strong>
              </div>
            </div>

            <div className="brand-info-row">
              <div className="brand-info-icon brand-info-icon-shield">
                <ShieldCheck size={20} />
              </div>
              <div className="brand-info-copy">
                <span className="brand-info-label">Calidad referencial</span>
                <strong className="brand-info-value brand-quality-value">{guidance.calidadReferencial}</strong>
              </div>
            </div>
          </div>

          <div className="brand-info-description">
            <p>{guidance.descripcionCalidad}</p>
          </div>

          <div className="brand-info-disclaimer">
            <Info size={18} className="brand-disclaimer-icon" />
            <p>
              Esta orientación describe la marca en general. El país de fabricación y la calidad pueden variar según la línea; confirma autenticidad, número de parte y compatibilidad con el vendedor.
            </p>
          </div>

          {guidance.fuenteUrl && (
            <a
              href={guidance.fuenteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="brand-source-link"
            >
              <ExternalLink size={16} />
              <span>Consultar referencia oficial</span>
            </a>
          )}
        </div>

        <footer className="brand-modal-footer">
          <button
            type="button"
            className="brand-modal-done-btn"
            onClick={onClose}
          >
            Entendido
          </button>
        </footer>
      </div>
    </div>
  );
}
