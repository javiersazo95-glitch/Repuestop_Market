import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Zap, Crown, Star, ShieldCheck, Coins, ArrowRight,
  CheckCircle2, AlertCircle, Sparkles, MessageCircle, Calendar
} from 'lucide-react';
import { AD_TIERS } from '../../data/automotiveAdsData';
import { UPGRADE_TOKEN_COSTS, spendTokensForAdUpgrade } from '../../services/adsStorage';

export default function UpgradeAdRankModal({
  ad,
  tokensBalance,
  onClose,
  onOpenRechargeModal,
  onUpgradeSuccess
}) {
  const [selectedTargetTier, setSelectedTargetTier] = useState(
    ad?.tier === 'basica' ? 'destacada' : ad?.tier === 'destacada' ? 'premium' : 'empresarial'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!ad) return null;

  const currentTier = ad.tier || 'basica';
  const targetCost = UPGRADE_TOKEN_COSTS[selectedTargetTier] || 0;
  const hasEnoughTokens = tokensBalance >= targetCost;

  const handleConfirmUpgrade = (e) => {
    e.preventDefault();
    if (!hasEnoughTokens) {
      setErrorMsg(`Saldo insuficiente: tienes ${tokensBalance} fichas y necesitas ${targetCost} fichas.`);
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      const newBalance = spendTokensForAdUpgrade(ad.id, ad.title, selectedTargetTier);
      setIsProcessing(false);
      setIsSuccess(true);
      onUpgradeSuccess?.(ad.id, selectedTargetTier, newBalance);
    } catch (err) {
      setIsProcessing(false);
      setErrorMsg(err.message || 'Error al procesar el cambio de rango.');
    }
  };

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="upgrade-rank-modal-card">
        {!isSuccess ? (
          <>
            <div className="booking-modal-header">
              <div>
                <h3>
                  <Zap className="text-purple-600" size={24} />
                  Mejorar Clasificación y Rango del Aviso
                </h3>
                <p>
                  Aviso: <strong>"{ad.title}"</strong> (Rango actual: <span className="font-bold text-slate-900 uppercase">{currentTier}</span>)
                </p>
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

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2 mb-4">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleConfirmUpgrade}>
              {/* Opciones de Rango */}
              <div className="upgrade-tiers-grid">
                
                {/* 1. Destacada */}
                <div
                  className={`upgrade-tier-choice ${selectedTargetTier === 'destacada' ? 'choice-destacada selected' : ''} ${currentTier === 'destacada' ? 'is-current' : ''}`}
                  onClick={() => setSelectedTargetTier('destacada')}
                >
                  <div className="choice-badge bg-amber-100 text-amber-800">
                    <Star size={12} /> Destacada
                  </div>
                  <h4 className="choice-title">Plan Destacado</h4>
                  <div className="choice-cost">
                    <Coins size={15} />
                    <span>50 Fichas</span>
                  </div>
                  <ul className="choice-benefits">
                    <li>✓ Tarjeta amarillo suave</li>
                    <li>✓ Etiqueta visible ⭐ Destacado</li>
                    <li>✓ Mayor posicionamiento sobre básicas</li>
                  </ul>
                </div>

                {/* 2. Premium */}
                <div
                  className={`upgrade-tier-choice ${selectedTargetTier === 'premium' ? 'choice-premium selected' : ''} ${currentTier === 'premium' ? 'is-current' : ''}`}
                  onClick={() => setSelectedTargetTier('premium')}
                >
                  <div className="choice-badge bg-purple-100 text-purple-800">
                    <Zap size={12} /> Premium
                  </div>
                  <h4 className="choice-title">Plan Premium</h4>
                  <div className="choice-cost">
                    <Coins size={15} />
                    <span>120 Fichas</span>
                  </div>
                  <ul className="choice-benefits">
                    <li>✓ Tarjeta morada de alta atracción</li>
                    <li>✓ <strong>Botón directo WhatsApp activo</strong></li>
                    <li>✓ Hasta 4 fotos en galería</li>
                  </ul>
                </div>

                {/* 3. Empresarial */}
                <div
                  className={`upgrade-tier-choice ${selectedTargetTier === 'empresarial' ? 'choice-empresarial selected' : ''} ${currentTier === 'empresarial' ? 'is-current' : ''}`}
                  onClick={() => setSelectedTargetTier('empresarial')}
                >
                  <div className="choice-badge bg-emerald-100 text-emerald-800">
                    <Crown size={12} /> Empresarial
                  </div>
                  <h4 className="choice-title">Plan Empresarial</h4>
                  <div className="choice-cost">
                    <Coins size={15} />
                    <span>250 Fichas</span>
                  </div>
                  <ul className="choice-benefits">
                    <li>✓ <strong>Agendamiento de citas en línea</strong></li>
                    <li>✓ WhatsApp directo + Galería completa</li>
                    <li>✓ Sello oficial de Taller Verificado</li>
                  </ul>
                </div>

              </div>

              {/* Saldo y Validación */}
              <div className="upgrade-balance-box">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Tu saldo de Fichas RepuesTop:</span>
                  <strong className="flex items-center gap-1 text-slate-900">
                    <Coins size={16} className="text-amber-500" />
                    {tokensBalance.toLocaleString('es-CL')} Fichas
                  </strong>
                </div>

                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-slate-600">Costo del cambio de rango:</span>
                  <strong className="text-purple-700">{targetCost} Fichas</strong>
                </div>

                {!hasEnoughTokens && (
                  <div className="mt-3 pt-3 border-t border-amber-200 flex items-center justify-between">
                    <span className="text-xs text-amber-800 font-medium">
                      Te faltan {targetCost - tokensBalance} fichas para este rango.
                    </span>
                    <button
                      type="button"
                      className="btn-ad-booking text-xs py-1.5 px-3 bg-amber-600 hover:bg-amber-700"
                      onClick={() => {
                        onClose?.();
                        onOpenRechargeModal?.();
                      }}
                    >
                      Recargar Fichas Ahora
                    </button>
                  </div>
                )}
              </div>

              <div className="booking-actions-row">
                <button
                  type="button"
                  className="btn-ad-phone"
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-post-ad"
                  disabled={isProcessing || !hasEnoughTokens}
                >
                  <Zap size={16} />
                  {isProcessing ? 'Actualizando...' : `Mejorar Rango por ${targetCost} Fichas`}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Éxito */
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
              ¡Rango Mejorado Exitosamente!
            </h3>

            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              Tu aviso <strong>"{ad.title}"</strong> ha sido actualizado al rango <strong>{selectedTargetTier.toUpperCase()}</strong> y ya se encuentra visible en el Mural de Anuncios con todas las funciones desbloqueadas.
            </p>

            <button
              type="button"
              className="btn-post-ad mx-auto"
              onClick={onClose}
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
