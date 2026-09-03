import React from 'react';
import { createPortal } from 'react-dom';
import { X, Server, ShieldCheck, Rocket, BarChart3 } from 'lucide-react';
import RepuestopCoin from './RepuestopCoin';

/**
 * Qué es la Moneda RepuesTop y para qué sirve, mostrando sus dos caras.
 *
 * Port de `mobile/components/ads/CoinInfoModal.tsx` (monorepo `fae41ed`). Es la
 * version en componentes de la lamina de la moneda: mismo contenido, pero
 * dibujado de verdad para que escale, se pueda leer con lector de pantalla y no
 * dependa de una imagen que habria que reexportar cada vez que cambia un texto.
 *
 * Se abre desde el boton de informacion del monedero (`TokensWalletCard`).
 */

const VENTAJAS = [
  { Icon: Server, title: 'Moneda exclusiva', detail: 'de RepuesTop' },
  { Icon: ShieldCheck, title: 'Úsala para destacar', detail: 'tus anuncios' },
  { Icon: Rocket, title: 'Más visibilidad,', detail: 'más oportunidades' },
  { Icon: BarChart3, title: 'Impulsa tu negocio', detail: 'con RepuesTop' }
];

export default function CoinInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Moneda RepuesTop"
    >
      <div className="booking-modal-card coin-info-card">
        <div className="booking-modal-header">
          <div>
            <h3>Moneda RepuesTop</h3>
            <p>La moneda oficial para anuncios y productos Top · 1 moneda = $50 CLP.</p>
          </div>
          <button
            type="button"
            className="story-close-btn"
            style={{ background: '#f1f5f9', color: '#0f172a' }}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="coin-info-faces">
          <div className="coin-info-face">
            <span className="coin-info-face-tag">PARTE DELANTERA</span>
            <RepuestopCoin size={122} face="front" />
          </div>
          <div className="coin-info-face">
            <span className="coin-info-face-tag">PARTE TRASERA</span>
            <RepuestopCoin size={122} face="back" />
          </div>
        </div>

        {/* Las cuatro ventajas van en UNA sola fila, como en la lamina. */}
        <div className="coin-info-perks">
          {VENTAJAS.map(({ Icon, title, detail }) => (
            <div className="coin-info-perk" key={title}>
              <Icon size={18} />
              <b>{title}</b>
              <small>{detail}</small>
            </div>
          ))}
        </div>

        <div className="coin-info-block">
          <span className="coin-info-block-icon"><Server size={18} /></span>
          <div>
            <strong>¿Qué es la Moneda RepuesTop?</strong>
            <p>
              Es la moneda oficial de RepuesTop que te permite mejorar la visibilidad de tus
              publicaciones en el mural de avisos y llegar a más clientes.
            </p>
          </div>
        </div>

        <div className="coin-info-block">
          <span className="coin-info-block-icon"><ShieldCheck size={18} /></span>
          <div>
            <strong>Segura y confiable</strong>
            <p>Transacciones seguras y respaldo total de la plataforma RepuesTop.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
