import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Lightbulb, Megaphone, ArrowRight } from 'lucide-react';
import RepuestopCoin from './RepuestopCoin';
import TokensWalletCard from './TokensWalletCard';
import RechargeTokensModal from './RechargeTokensModal';
import TokensHistoryModal from './TokensHistoryModal';
import { AD_TIERS, AD_TIER_ORDER } from '../../data/automotiveAdsData';
import { UPGRADE_TOKEN_COSTS } from '../../services/adsStorage';
import { profilePath } from '../../routes/paths';
import ProductTopBadge from '../ProductTopBadge';

/**
 * Monedero de Monedas RepuesTop, global. Se abre desde el indicador de la moneda
 * en la cabecera (sitio público y panel de perfil), igual que en la app móvil el
 * saldo del `TopAppBar` abre la pantalla de monedas (`mobile/app/wallet.tsx`).
 *
 * Antes este contenido vivía como tarjeta azul dentro de "Gestión de anuncios";
 * se sacó de ahí porque el monedero dejó de ser propio de esa vista.
 */

const PUBLISH_STEPS = [
  'Acredita tu servicio automotriz (una sola vez).',
  'Entra a Gestión de anuncios y pulsa "Publicar anuncio".',
  'Elige el plan Básico, Destacado, Premium o Empresarial.',
  'Revisa el valor y confirma. Si falta saldo, recargas desde acá.'
];

const TOP_SALES_STEPS = [
  'Abre "Mi catálogo" desde tu perfil.',
  'Ubica el repuesto que quieres destacar.',
  'Pulsa "Marcar como Top" en su tarjeta y revisa la vigencia de la insignia Top Ventas.',
  'Confirma. La insignia y la prioridad duran 30 días; si corresponde canje, se descuentan las Monedas.'
];

function StepList({ steps }) {
  return (
    <ol className="steps-legend">
      {steps.map((step, index) => (
        <li key={step}>
          <span className="steps-legend-num">{index + 1}</span>
          <span className="steps-legend-body"><span>{step}</span></span>
        </li>
      ))}
    </ol>
  );
}

export default function WalletModal({ balance = 0, isSeller = false, onClose }) {
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="booking-modal-card wallet-modal-card">
        <div className="booking-modal-header">
          <div>
            <h3><RepuestopCoin size={24} face="front" /> Monedas RepuesTop</h3>
            <p>Recarga Monedas y revisa tus compras y canjes.</p>
          </div>
          <button
            type="button"
            className="story-close-btn"
            style={{ background: '#f1f5f9', color: '#0f172a' }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <TokensWalletCard
          tokensBalance={balance}
          onOpenRechargeModal={() => setIsRechargeOpen(true)}
          onOpenHistoryModal={() => setIsHistoryOpen(true)}
        />

        <div className="wallet-modal-note">
          <span className="wallet-modal-note-ic"><Lightbulb size={18} /></span>
          <p>
            <strong>¿Para qué sirven tus Monedas?</strong><br />
            Cada Moneda vale $50 CLP. Se usan para dar más visibilidad a tus anuncios en el Mural
            y <b>nunca se descuentan sin tu confirmación</b>.
          </p>
        </div>

        {isSeller && (
          <div className="wallet-modal-guide is-top-sales">
            <h4><ProductTopBadge compact className="wallet-top-sales-badge" /> Destaca uno de tus repuestos</h4>
            <p className="wallet-modal-guide-lead">
              La insignia <strong>Top Ventas</strong> posiciona el repuesto primero en las búsquedas
              y filtros de tu tienda y de la portada.
            </p>
            <div className="wallet-modal-value-banner">
              <strong>Tus 2 primeros productos Top son gratis</strong>
              <span>Del 3.º al 10.º: 200 Monedas ($10.000 CLP) por cada período de 30 días.</span>
            </div>
            <StepList steps={TOP_SALES_STEPS} />
            <a className="wallet-modal-cta" href={profilePath('productos')}>
              <span>Ir a mi catálogo</span>
              <ArrowRight size={15} />
            </a>
          </div>
        )}

        <div className="wallet-modal-guide">
          <h4><Megaphone size={15} /> Publica y potencia tus anuncios</h4>

          <div className="wallet-modal-prices">
            {AD_TIER_ORDER.map((tierId) => {
              const cost = UPGRADE_TOKEN_COSTS[tierId] || 0;
              return (
                <div className="wallet-modal-price-row" key={tierId}>
                  <span>
                    Plan {AD_TIERS[tierId].name}
                    {tierId === 'basica' && <em> · primera gratis 30 días</em>}
                  </span>
                  <strong>{cost} Monedas</strong>
                </div>
              );
            })}
          </div>

          <StepList steps={PUBLISH_STEPS} />

          <a className="wallet-modal-cta" href={profilePath('anuncios')}>
            <span>Ir a Gestión de anuncios</span>
            <ArrowRight size={15} />
          </a>
        </div>
      </div>

      <RechargeTokensModal
        isOpen={isRechargeOpen}
        onClose={() => setIsRechargeOpen(false)}
      />
      <TokensHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
    </div>,
    document.body
  );
}
