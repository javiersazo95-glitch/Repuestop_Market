import React from 'react';
import { Coins, Plus, History } from 'lucide-react';

/**
 * Saldo del Monedero de Fichas.
 *
 * Es una barra plana con el oscuro de la casa (`#0f172a`), no una tarjeta con
 * degradado: la version anterior tenia un `linear-gradient` diagonal, un
 * `radial-gradient` de 220px como brillo y un badge con `backdrop-filter`, tres
 * recursos que no aparecen en ninguna otra vista del perfil. Destacaba, pero
 * como una isla pegada de otra plataforma.
 */
export default function TokensWalletCard({
  tokensBalance,
  onOpenRechargeModal,
  onOpenHistoryModal
}) {
  return (
    <div className="tokens-wallet-bar">
      <div className="tokens-wallet-identity">
        <span className="tokens-wallet-icon">
          <Coins size={20} />
        </span>
        <div>
          <span className="tokens-wallet-label">Monedero de Fichas RepuesTop</span>
          <div className="tokens-wallet-amount">
            <strong>{tokensBalance.toLocaleString('es-CL')}</strong>
            <span>Fichas disponibles</span>
          </div>
        </div>
      </div>

      {/* El tarifario vive aca porque es la referencia que el socio necesita
          justo antes de decidir si recarga. */}
      <p className="tokens-wallet-rates">
        Destacado <b>50</b> · Premium <b>120</b> · Empresarial <b>250</b>
      </p>

      <div className="tokens-wallet-actions">
        <button type="button" className="btn-recharge-tokens" onClick={onOpenRechargeModal}>
          <Plus size={16} />
          <span>Recargar</span>
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
    </div>
  );
}
