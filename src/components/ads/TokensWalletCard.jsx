import React from 'react';
import { Coins, Zap, Plus, Sparkles, ShieldCheck, ArrowUpRight, History } from 'lucide-react';

export default function TokensWalletCard({
  tokensBalance,
  onOpenRechargeModal,
  onOpenHistoryModal
}) {
  return (
    <div className="tokens-wallet-card">
      <div className="tokens-wallet-glow" />
      <div className="tokens-wallet-inner">
        <div className="tokens-wallet-left">
          <div className="tokens-wallet-icon-badge">
            <Coins size={26} className="text-amber-300" />
          </div>
          <div>
            <div className="tokens-wallet-label">
              <span>Monedero de Fichas RepuesTop</span>
              <span className="tokens-live-tag">Saldo Activo</span>
            </div>
            <div className="tokens-wallet-amount">
              <strong>{tokensBalance.toLocaleString('es-CL')}</strong>
              <span>Fichas Disponibles</span>
            </div>
            <p className="tokens-wallet-hint">
              Usa tus fichas para clasificar tus avisos en rango <strong>Destacado (50)</strong>, <strong>Premium (120)</strong> o <strong>Empresarial (250)</strong>.
            </p>
          </div>
        </div>

        <div className="tokens-wallet-right">
          <button
            type="button"
            className="btn-recharge-tokens"
            onClick={onOpenRechargeModal}
          >
            <Plus size={18} />
            <span>Recargar Fichas</span>
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
    </div>
  );
}
