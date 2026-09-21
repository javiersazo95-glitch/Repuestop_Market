import type { ReactNode } from 'react';

/**
 * Marco de navegador. Envuelve una captura real para que se lea como software
 * que existe antes de que nadie lea una palabra.
 */
export function BrowserFrame({ url = 'repuestop.cl', children }: { url?: string; children: ReactNode }) {
  return (
    <figure className="rt-browser">
      <div className="rt-browser__bar" aria-hidden="true">
        <span className="rt-browser__dots"><i /><i /><i /></span>
        <span className="rt-browser__url">{url}</span>
      </div>
      {children}
    </figure>
  );
}

/** Bisel de telefono. Tapa la barra de estado que dibuja la app en web. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <figure className="rt-phone">
      <span className="rt-phone__notch" aria-hidden="true" />
      {children}
    </figure>
  );
}
