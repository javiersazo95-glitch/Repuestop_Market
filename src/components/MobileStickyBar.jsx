import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Barra fija inferior de compra o contacto, solo en el celular (public-mobile.css la oculta
 * en >=769px). La usan la ficha del repuesto, el detalle del anuncio y el resumen del
 * carrito/checkout: en movil sus botones principales quedaban a dos pantallazos de distancia.
 *
 * - Va por portal a `document.body`: un ancestro con `transform` volveria relativo su `fixed`.
 * - `watchSelector` apunta al boton original de la pagina. Mientras ese boton esta en pantalla
 *   la barra se esconde (no hay dos "Comprar" a la vista); al salir de pantalla vuelve.
 * - Marca `body.has-mobile-cta` para que el contenido final, el aviso de cookies y el toast del
 *   carrito se corran hacia arriba, y `body.mobile-cta-hidden` mientras esta escondida.
 */
export default function MobileStickyBar({ label, value, hint, watchSelector, ariaLabel = 'Acciones principales', children }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    document.body.classList.add('has-mobile-cta');
    return () => document.body.classList.remove('has-mobile-cta', 'mobile-cta-hidden');
  }, []);

  useEffect(() => {
    document.body.classList.toggle('mobile-cta-hidden', hidden);
  }, [hidden]);

  useEffect(() => {
    if (!watchSelector || typeof IntersectionObserver === 'undefined') return undefined;
    let observed = null;
    let io = null;
    let frame = 0;
    // El boton observado puede montarse tarde (datos que cargan) o cambiar (paso del checkout).
    const attach = () => {
      frame = 0;
      const element = document.querySelector(watchSelector);
      if (element === observed) return;
      io?.disconnect();
      observed = element;
      if (!element) { setHidden(false); return; }
      io = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { threshold: 0.6 });
      io.observe(element);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(attach); };
    attach();
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      io?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [watchSelector]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`mobile-sticky-bar ${hidden ? 'is-hidden' : ''}`}
      role="region"
      aria-label={ariaLabel}
      inert={hidden || undefined}
    >
      {(label || value) && (
        <div className="mobile-sticky-bar__info">
          {label && <small>{label}</small>}
          {value && <strong>{value}</strong>}
          {hint && <span>{hint}</span>}
        </div>
      )}
      <div className="mobile-sticky-bar__actions">{children}</div>
    </div>,
    document.body,
  );
}
