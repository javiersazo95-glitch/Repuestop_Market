import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Info, X } from 'lucide-react';
import { founderBenefitDetails } from '../utils/founderBenefit';
import '../styles/founder-info.css';

/**
 * Boton "i" del chip Fundador del perfil del vendedor (19-oct). Abre el detalle del servicio
 * gratis: en que consiste, que es la comision por venta, de cuanto es, cuando empezo y cuando
 * termina, con un ejemplo de cuanto recibe hoy y despues. En el celular es una hoja inferior.
 */
export default function FounderBenefitInfo({ founderSince, founderUntil }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const details = open ? founderBenefitDetails(founderSince, founderUntil) : null;

  return (
    <>
      <button
        type="button"
        className="founder-info-trigger"
        onClick={(event) => { event.stopPropagation(); setOpen(true); }}
        aria-label="Ver en qué consiste el servicio gratis de Fundador"
        title="¿En qué consiste?"
      >
        <Info size={15} strokeWidth={2.4} />
      </button>
      {open && createPortal(
        <div className="founder-info-backdrop" onMouseDown={() => setOpen(false)}>
          <section
            className="founder-info-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="founder-info-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="founder-info-handle" aria-hidden="true" />
            <header className="founder-info-head">
              <span className="founder-info-crown"><Crown size={20} strokeWidth={2.4} /></span>
              <div>
                <h2 id="founder-info-title">Tu beneficio de Tienda Fundadora</h2>
                <p className={details.isExpired ? 'is-expired' : ''}>{details.status}</p>
              </div>
              <button type="button" className="founder-info-close" onClick={() => setOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <div className="founder-info-body">
              {details.sections.map((section) => (
                <div key={section.title} className="founder-info-row">
                  <h3>{section.title}</h3>
                  <p>{section.text}</p>
                </div>
              ))}
              <div className="founder-info-example">
                <h3>Ejemplo: una venta de {details.example.price}</h3>
                <dl>
                  <div><dt>Recibes con el servicio gratis</dt><dd>{details.example.now}</dd></div>
                  <div><dt>Recibirías con la comisión estándar</dt><dd>{details.example.after}</dd></div>
                </dl>
              </div>
              <button type="button" className="founder-info-ok" onClick={() => setOpen(false)}>Entendido</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
