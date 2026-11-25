import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Copy, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { FILAS_VISIBLES } from './fichaModel';

/** Filas nombre/valor. Con muchas, se ven las primeras y el resto queda a un toque. */
export function Filas({ filas, visibles = FILAS_VISIBLES, columnas = false }) {
  const [todas, setTodas] = useState(false);
  const sobran = filas.length - visibles;
  const mostradas = todas || sobran <= 1 ? filas : filas.slice(0, visibles);
  return (
    <>
      <dl className={`pf-filas${columnas ? ' dos' : ''}`}>
        {mostradas.map((f) => (
          <div key={`${f.nombre}-${f.valor}`}>
            <dt>{f.nombre}</dt>
            <dd>{f.valor}</dd>
          </div>
        ))}
      </dl>
      {sobran > 1 && (
        <button type="button" className="pf-mas" onClick={() => setTodas((v) => !v)}>
          {todas ? 'Ver menos' : `Ver ${sobran} más`}
        </button>
      )}
    </>
  );
}

/** Lo técnico queda plegado: quien no lo necesita no lo ve, y el mecánico lo abre con un toque. */
export function Plegable({ titulo, detalle, children, abierto = false }) {
  return (
    <details className="pf-plegable" open={abierto}>
      <summary>
        <span>{titulo}{detalle && <em>{detalle}</em>}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="pf-plegable-cuerpo">{children}</div>
    </details>
  );
}

/** Un código que se copia con un toque. */
export function CodigoCopiable({ codigo }) {
  const [copiado, setCopiado] = useState(false);
  const reloj = useRef(null);
  useEffect(() => () => clearTimeout(reloj.current), []);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      clearTimeout(reloj.current);
      reloj.current = setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso de portapapeles el código sigue a la vista para copiarlo a mano.
    }
  };
  return (
    <button type="button" className={`pf-codigo${copiado ? ' copiado' : ''}`} onClick={copiar} aria-label={`Copiar el código ${codigo}`}>
      <span>{codigo}</span>
      {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span className="pf-solo-lector" aria-live="polite">{copiado ? 'Copiado' : ''}</span>
    </button>
  );
}

/** Una imagen del catálogo a pantalla completa, con acercamiento (se arrastra con el dedo o la barra de desplazamiento). */
function ImagenCompleta({ src, alt, onCerrar, children }) {
  const [cerca, setCerca] = useState(false);
  const cerrarRef = useRef(null);
  useEffect(() => {
    const anterior = document.activeElement;
    const alTecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    const overflow = document.body.style.overflow;
    window.addEventListener('keydown', alTecla);
    document.body.style.overflow = 'hidden';
    cerrarRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', alTecla);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [onCerrar]);
  return createPortal(
    <div className="pf-completa" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="pf-completa-barra">
        <strong>{alt}</strong>
        <button type="button" onClick={() => setCerca((v) => !v)} aria-label={cerca ? 'Alejar' : 'Acercar'}>
          {cerca ? <ZoomOut size={22} /> : <ZoomIn size={22} />}
        </button>
        <button type="button" ref={cerrarRef} onClick={onCerrar} aria-label="Cerrar"><X size={22} /></button>
      </div>
      <div className="pf-completa-lienzo">
        <div className={`pf-lienzo${cerca ? ' cerca' : ''}`}>
          <img src={src} alt={alt} />
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Plano o diagrama del fabricante. Si la imagen no carga, el bloque desaparece y quedan los datos. */
export function ImagenAmpliable({ src, alt, children, onFalla }) {
  const [abierta, setAbierta] = useState(false);
  const [falla, setFalla] = useState(false);
  if (falla) return null;
  return (
    <figure className="pf-imagen">
      <div className="pf-lienzo">
        <img src={src} alt={alt} loading="lazy" onError={() => { setFalla(true); onFalla?.(); }} />
        {children}
      </div>
      <button type="button" className="pf-ampliar" onClick={() => setAbierta(true)}><Maximize2 size={15} aria-hidden="true" /> Ampliar</button>
      {abierta && <ImagenCompleta src={src} alt={alt} onCerrar={() => setAbierta(false)}>{children}</ImagenCompleta>}
    </figure>
  );
}
