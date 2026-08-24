import React, { useState } from 'react';
import { Star, Gem, Building2, ChevronRight, History, Info } from 'lucide-react';
import RepuestopCoin from './RepuestopCoin';
import CoinInfoModal from './CoinInfoModal';

/**
 * Saldo del Monedero de Monedas RepuesTop.
 *
 * Port de `mobile/components/ads/TokensWalletCard.tsx` (monorepo `fae41ed`).
 *
 * El fondo lleva el azul de la marca con el MISMO barrido diagonal que el anillo
 * de la moneda (`#1d5fc4 → #0f4aa8 → #06285c`): la tarjeta y la moneda tienen que
 * leerse como una sola pieza. En el movil el azul oscuro anterior (`#0b1730`) no
 * salia de la paleta de RepuesTop y desentonaba con el logo.
 *
 * ESTO REVIERTE A PROPOSITO el aplanado del handoff §4.15, donde el monedero de
 * la web se dejo como una barra plana `#0f172a` para que no destacara como isla
 * de otra plataforma. La decision se cambio el 2026-08-24: ahora prima que el
 * monedero se vea igual en la web y en la app. Si alguien vuelve a leer esa
 * seccion del handoff, quedo superada por esta.
 *
 * Lo unico que la web tiene de mas es el boton de Historial: en el movil el
 * historial se abre desde un mosaico del encabezado de la pantalla, que aca no
 * existe. Va como accion secundaria al lado de la recarga.
 */

const BENEFITS = [
  { Icon: Star, label: 'Destacadas', cost: 50, color: '#fbbf24' },
  { Icon: Gem, label: 'Premium', cost: 120, color: '#ddd6fe' },
  { Icon: Building2, label: 'Empresariales', cost: 250, color: '#6ee7b7' }
];

export default function TokensWalletCard({
  tokensBalance,
  onOpenRechargeModal,
  onOpenHistoryModal
}) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <div className="tokens-wallet-card">
      <div className="tokens-wallet-top">
        {/* Del tamaño del badge depende que se distingan las leyendas y el
            emblema del troquel: mas chica, la moneda se lee como un punto
            cualquiera y deja de ser reconocible. */}
        <span className="tokens-wallet-coin">
          <RepuestopCoin size={74} face="front" />
        </span>

        <div className="tokens-wallet-top-copy">
          <div className="tokens-wallet-label-row">
            <span className="tokens-wallet-label">Monedero de Monedas RepuesTop</span>
            <span className="tokens-wallet-active">
              <i className="tokens-wallet-active-dot" />
              Saldo activo
            </span>
          </div>

          <div className="tokens-wallet-amount">
            <strong>{tokensBalance.toLocaleString('es-CL')}</strong>
            <span>Monedas disponibles</span>
            <button
              type="button"
              className="tokens-wallet-info-btn"
              onClick={() => setIsInfoOpen(true)}
              aria-label="Qué es la Moneda RepuesTop"
              title="Qué es la Moneda RepuesTop"
            >
              <Info size={13} />
            </button>
          </div>
        </div>
      </div>

      <p className="tokens-wallet-hint">
        Usa tus monedas para potenciar la visibilidad de tus avisos.
      </p>

      {/* Tarifario: es la referencia que el socio necesita justo antes de decidir
          si recarga. */}
      <div className="tokens-wallet-benefits">
        {BENEFITS.map(({ Icon, label, cost, color }) => (
          <div className="tokens-wallet-benefit" key={label}>
            <Icon size={19} color={color} />
            <span>
              <b style={{ color }}>{label}</b>
              <small>{cost} monedas</small>
            </span>
          </div>
        ))}
      </div>

      <div className="tokens-wallet-actions">
        {/* El boton lleva el metal de la moneda, no el ambar de antes: ese dorado
            venia de cuando la moneda era dorada y sobre el azul era el unico
            elemento fuera de la paleta. En plata sigue siendo lo mas claro de la
            tarjeta, asi que no pierde fuerza como accion. */}
        <button type="button" className="btn-recharge-tokens" onClick={onOpenRechargeModal}>
          <RepuestopCoin size={30} face="front" />
          <span>Recargar monedas</span>
          <ChevronRight size={18} className="btn-recharge-chevron" />
        </button>

        {onOpenHistoryModal && (
          <button
            type="button"
            className="btn-token-history"
            onClick={onOpenHistoryModal}
            title="Ver historial de movimientos"
          >
            <History size={15} />
            <span>Historial</span>
          </button>
        )}
      </div>

      <CoinInfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </div>
  );
}
