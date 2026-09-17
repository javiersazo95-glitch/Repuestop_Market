import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock3, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import RepuestopCoin from './RepuestopCoin';
import { AD_TIERS, getAdExpiryInfo } from '../../data/automotiveAdsData';
import { UPGRADE_TOKEN_COSTS, renewAd, adErrorMessage } from '../../services/adsStorage';

/**
 * Agrega 30 días de vigencia a un anuncio ya aprobado, cobrando la misma tarifa
 * que publicarlo de nuevo en su plan actual (200 Monedas una Destacada, 400 una
 * Premium, etc.) — así 400 Monedas rinden lo mismo renovando dos veces una
 * Destacada (60 días) que comprando una Premium nueva, y el usuario elige.
 *
 * A diferencia de `UpgradeAdRankModal` no cambia el plan ni el contenido: solo
 * mueve `expiresAt`, así que un anuncio ya aprobado sigue aprobado.
 */
export default function RenewAdModal({ ad, tokensBalance, onClose, onOpenRechargeModal, onRenewSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedAd, setSavedAd] = useState(null);

  if (!ad) return null;

  const tierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
  const cost = UPGRADE_TOKEN_COSTS[ad.tier] || 0;
  const hasEnoughTokens = tokensBalance >= cost;
  const expiry = getAdExpiryInfo(ad);

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!hasEnoughTokens) return;
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const { ad: saved, balance } = await renewAd(ad);
      setSavedAd(saved);
      setIsSuccess(true);
      onRenewSuccess?.(saved, balance);
    } catch (err) {
      setErrorMsg(adErrorMessage(err, 'No se pudo renovar el anuncio.'));
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
                  <Clock3 size={22} style={{ color: '#c47a12' }} />
                  Agregar 30 días
                </h3>
                <p>
                  <strong>"{ad.title}"</strong> — plan actual: <strong>{tierConfig.name}</strong>
                  {expiry && (
                    <> · <span className={expiry.isExpired ? 'is-urgent' : ''}>{expiry.label}</span></>
                  )}
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

            <form onSubmit={handleConfirm}>
              <div className="ad-moderation-warning is-ok">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Se suman 30 días sin volver a revisión.</strong>
                  <p>
                    {expiry?.isExpired
                      ? 'Tu anuncio estaba vencido: al confirmar vuelve a estar visible en el Mural por 30 días desde hoy.'
                      : 'Se suman 30 días a la fecha de vencimiento actual. El contenido y el plan no cambian.'}
                  </p>
                </div>
              </div>

              <div className="upgrade-balance-box">
                <div className="upgrade-balance-row">
                  <span>Tu saldo de Monedas RepuesTop</span>
                  <strong><RepuestopCoin size={16} /> {tokensBalance.toLocaleString('es-CL')}</strong>
                </div>
                <div className="upgrade-balance-row">
                  <span>Costo de agregar 30 días ({tierConfig.name})</span>
                  <strong className="is-cost"><RepuestopCoin size={16} /> {cost}</strong>
                </div>

                {!hasEnoughTokens && (
                  <div className="upgrade-balance-short">
                    <span>Te faltan {cost - tokensBalance} Monedas para renovar.</span>
                    <button
                      type="button"
                      className="upgrade-recharge-btn"
                      onClick={() => { onClose?.(); onOpenRechargeModal?.(); }}
                    >
                      Recargar Monedas
                    </button>
                  </div>
                )}
              </div>

              <div className="upgrade-actions-row">
                <button type="button" className="upgrade-cancel-btn" onClick={onClose} disabled={isProcessing}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="upgrade-confirm-btn"
                  disabled={isProcessing || !hasEnoughTokens}
                >
                  {isProcessing ? <Loader2 size={16} className="spin-icon" /> : <Clock3 size={16} />}
                  {isProcessing ? 'Renovando…' : `Agregar 30 días por ${cost} Monedas`}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="upgrade-success">
            <div className="upgrade-success-icon is-ok">
              <CheckCircle2 size={34} />
            </div>
            <h3>Anuncio renovado</h3>
            <p>
              <strong>"{ad.title}"</strong> suma 30 días más en el Mural
              {savedAd?.expiresAt ? <> — nueva fecha de vencimiento: <strong>{new Date(savedAd.expiresAt).toLocaleDateString('es-CL')}</strong></> : '.'}
            </p>
            <div className="upgrade-actions-row is-centered">
              <button type="button" className="upgrade-confirm-btn" onClick={onClose}>
                Listo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
