import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Zap, Coins, AlertCircle, AlertTriangle, Loader2, Clock3
} from 'lucide-react';
import {
  AD_TIERS, AD_MODERATION_STATUS, getUpgradableTiers, getTierActivatableFeatures
} from '../../data/automotiveAdsData';
import { UPGRADE_TOKEN_COSTS, spendTokensForAdUpgrade, adErrorMessage } from '../../services/adsStorage';

/**
 * Subir de plan un anuncio.
 *
 * El cambio de plan viaja como un PUT normal (`spendTokensForAdUpgrade`), y todo
 * PUT devuelve el anuncio a `PENDIENTE` con `activo=false`: pagar Fichas por
 * mejorar el rango SACA el anuncio del mural hasta que lo re-aprueben. Se
 * advierte antes de cobrar, porque el cobro de Fichas no se revierte.
 *
 * Los planes se arman con `getUpgradableTiers()`: solo se ofrece lo que esta por
 * encima del plan actual, en vez de las tres tarjetas fijas que habia antes (que
 * dejaban elegir un plan igual o inferior al que ya tenia el anuncio).
 */
export default function UpgradeAdRankModal({
  ad,
  tokensBalance,
  onClose,
  onOpenRechargeModal,
  onUpgradeSuccess
}) {
  const upgradableTiers = getUpgradableTiers(ad?.tier || 'basica');
  const [selectedTargetTier, setSelectedTargetTier] = useState(upgradableTiers[0] || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!ad) return null;

  const currentConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
  const targetCost = UPGRADE_TOKEN_COSTS[selectedTargetTier] || 0;
  const hasEnoughTokens = tokensBalance >= targetCost;
  const wasPublished = ad.moderationStatus === AD_MODERATION_STATUS.APROBADO && ad.activo === true;

  const handleConfirmUpgrade = async (e) => {
    e.preventDefault();
    if (!selectedTargetTier || !hasEnoughTokens) return;

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const { ad: saved, balance } = await spendTokensForAdUpgrade(ad, selectedTargetTier);
      setIsSuccess(true);
      onUpgradeSuccess?.(saved, balance);
    } catch (err) {
      setErrorMsg(adErrorMessage(err, 'No se pudo cambiar el plan del anuncio.'));
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
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
                  Mejorar el plan del anuncio
                </h3>
                <p>
                  <strong>"{ad.title}"</strong> — plan actual:{' '}
                  <span className="font-bold text-slate-900">{currentConfig.name}</span>
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
              <div className="ad-form-error">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {upgradableTiers.length === 0 ? (
              <div className="ad-empty-note">
                <p>
                  Este anuncio ya está en <strong>{currentConfig.name}</strong>, el plan más alto del
                  mural. No hay nada que mejorar.
                </p>
                <button type="button" className="btn-post-ad mx-auto" onClick={onClose}>
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmUpgrade}>
                <div className="ad-moderation-warning">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>El cambio de plan pasa por revisión.</strong>
                    <p>
                      {wasPublished
                        ? 'Cambiar de plan guarda el anuncio de nuevo, así que sale del Mural de Anuncios hasta que moderación apruebe la versión con el plan nuevo. Las Fichas se descuentan igual: no se devuelven si después editas.'
                        : 'El anuncio queda con el plan nuevo y sigue en la cola de revisión. Las Fichas se descuentan al confirmar.'}
                    </p>
                  </div>
                </div>

                <div className="upgrade-tiers-grid">
                  {upgradableTiers.map((tierId) => {
                    const config = AD_TIERS[tierId];
                    const cost = UPGRADE_TOKEN_COSTS[tierId] || 0;
                    return (
                      <button
                        type="button"
                        key={tierId}
                        className={`upgrade-tier-choice ${selectedTargetTier === tierId ? `choice-${tierId} selected` : ''}`}
                        onClick={() => setSelectedTargetTier(tierId)}
                      >
                        <div className="choice-badge" style={{ background: `${config.badgeColor}1a`, color: config.badgeColor }}>
                          {config.badge}
                        </div>
                        <h4 className="choice-title">Plan {config.name}</h4>
                        <div className="choice-cost">
                          <Coins size={15} />
                          <span>{cost} Fichas</span>
                        </div>
                        <ul className="choice-benefits">
                          <li>✓ Hasta {config.maxImages} fotos y {config.maxTags} etiquetas</li>
                          {config.maxStories > 0 && <li>✓ Hasta {config.maxStories} historias</li>}
                          {getTierActivatableFeatures(tierId).map((feature) => (
                            <li key={feature}>✓ {feature}</li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>

                {/* Mejorar el plan da el derecho, no enciende la funcion: WhatsApp,
                    las historias y la agenda se activan editando el anuncio. */}
                {selectedTargetTier && (
                  <p className="ad-upgrade-hint">
                    Después de mejorar el plan tienes que editar el anuncio para activar lo que se
                    desbloquea ({getTierActivatableFeatures(selectedTargetTier).join(', ') || 'las nuevas fotos'}).
                  </p>
                )}

                <div className="upgrade-balance-box">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Tu saldo de Fichas RepuesTop:</span>
                    <strong className="flex items-center gap-1 text-slate-900">
                      <Coins size={16} className="text-amber-500" />
                      {tokensBalance.toLocaleString('es-CL')} Fichas
                    </strong>
                  </div>

                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-slate-600">Costo del cambio de plan:</span>
                    <strong className="text-purple-700">{targetCost} Fichas</strong>
                  </div>

                  {!hasEnoughTokens && (
                    <div className="mt-3 pt-3 border-t border-amber-200 flex items-center justify-between gap-3">
                      <span className="text-xs text-amber-800 font-medium">
                        Te faltan {targetCost - tokensBalance} Fichas para este plan.
                      </span>
                      <button
                        type="button"
                        className="btn-ad-booking text-xs py-1.5 px-3 bg-amber-600 hover:bg-amber-700"
                        onClick={() => { onClose?.(); onOpenRechargeModal?.(); }}
                      >
                        Recargar Fichas
                      </button>
                    </div>
                  )}
                </div>

                <div className="booking-actions-row">
                  <button type="button" className="btn-ad-phone" onClick={onClose} disabled={isProcessing}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-post-ad"
                    disabled={isProcessing || !hasEnoughTokens || !selectedTargetTier}
                  >
                    {isProcessing ? <Loader2 size={16} className="spin-icon" /> : <Zap size={16} />}
                    {isProcessing ? 'Actualizando…' : `Mejorar por ${targetCost} Fichas`}
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock3 size={36} />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
              Plan actualizado, en revisión
            </h3>

            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              <strong>"{ad.title}"</strong> quedó en el plan{' '}
              <strong>{(AD_TIERS[selectedTargetTier] || currentConfig).name}</strong> y volvió a la cola de
              moderación. Cuando lo aprueben vuelve al mural con los beneficios del plan nuevo; recuerda
              editarlo para activar lo que se desbloqueó.
            </p>

            <button type="button" className="btn-post-ad mx-auto" onClick={onClose}>
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
