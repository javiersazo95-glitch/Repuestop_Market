import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Zap, Star, ShieldCheck, AlertCircle, AlertTriangle, Loader2, Sparkles, Clock3, CheckCircle2
} from 'lucide-react';
import RepuestopCoin from './RepuestopCoin';
import {
  AD_TIERS, AD_MODERATION_STATUS, getUpgradableTiers,
  getNewlyUnlockedFeatures
} from '../../data/automotiveAdsData';
import { AD_TIER_PRICES_CLP, UPGRADE_TOKEN_COSTS, spendTokensForAdUpgrade, adErrorMessage } from '../../services/adsStorage';

/** Contenido de cada plan destino (1:1 con mobile/components/ads/UpgradeAdRankModal.tsx). */
const TIER_OPTIONS = {
  destacada: {
    label: 'Destacada', planName: 'Plan Destacado', Icon: Star,
    accent: '#b45309', tagBg: '#fef3c7', includesFrom: 'Básica',
    highlight: 'WhatsApp directo',
    rest: ['Tarjeta amarillo suave con etiqueta ⭐ Destacado', 'Mayor posicionamiento'],
  },
  premium: {
    label: 'Premium', planName: 'Plan Premium', Icon: Zap,
    accent: '#7c3aed', tagBg: '#ede9fe', includesFrom: 'Destacada',
    highlight: 'Imágenes en Carrusel de Historias',
    rest: ['Tarjeta morada destacada', 'Hasta 4 fotos en galería'],
  },
  empresarial: {
    label: 'Empresarial', planName: 'Plan Empresarial', Icon: ShieldCheck,
    accent: '#059669', tagBg: '#d1fae5', includesFrom: 'Premium',
    highlight: 'Agendamiento de citas en línea',
    rest: ['Sello Taller Verificado', 'Carrusel de Historias ampliado (hasta 4 fotos)'],
  },
};

/**
 * Subir de plan un anuncio.
 *
 * El cambio de plan viaja como un PUT normal (`spendTokensForAdUpgrade`), y todo
 * PUT devuelve el anuncio a `PENDIENTE` con `activo=false`: pagar Monedas por
 * mejorar el rango SACA el anuncio del mural hasta que lo re-aprueben. Se
 * advierte antes de confirmar.
 *
 * El cobro lo hace el backend dentro de ese mismo PUT, asi que ya no hace falta
 * revertir nada si falla: sin saldo responde 422 y el anuncio se queda en el plan
 * viejo. `hasEnoughTokens` es solo para no dejar intentar algo que va a fallar;
 * la decision real la toma el servidor.
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
  onUpgradeSuccess,
  onActivateFeatures
}) {
  const upgradableTiers = getUpgradableTiers(ad?.tier || 'basica');
  const [selectedTargetTier, setSelectedTargetTier] = useState(upgradableTiers[0] || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  /**
   * Anuncio guardado por el PUT, para poder abrir el formulario con la version
   * que quedo en el servidor y no con la que este modal recibio.
   */
  const [savedAd, setSavedAd] = useState(null);
  /**
   * Plan que tenia el anuncio ANTES de la mejora. Se congela al montar el modal:
   * es el ultimo momento en que existe con certeza, porque `onUpgradeSuccess`
   * reemplaza el anuncio en la lista del panel. Leerlo despues devolveria el
   * plan nuevo, la diferencia daria vacia y el formulario se abriria sin avisar
   * nada.
   */
  const [previousTier] = useState(ad?.tier || 'basica');

  if (!ad) return null;

  const currentConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
  const targetCost = UPGRADE_TOKEN_COSTS[selectedTargetTier] || 0;
  const hasEnoughTokens = tokensBalance >= targetCost;
  const wasPublished = ad.moderationStatus === AD_MODERATION_STATUS.APROBADO && ad.activo === true;
  // Lo que se gana con ESTA mejora, no todo lo que trae el plan nuevo: quien
  // sube de Destacada a Premium ya tenia WhatsApp.
  const unlockedFeatures = selectedTargetTier
    ? getNewlyUnlockedFeatures(previousTier, selectedTargetTier)
    : [];

  const handleConfirmUpgrade = async (e) => {
    e.preventDefault();
    if (!selectedTargetTier || !hasEnoughTokens) return;

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const { ad: saved, balance } = await spendTokensForAdUpgrade(ad, selectedTargetTier);
      setSavedAd(saved);
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
                  <Zap size={22} style={{ color: '#7c3aed' }} />
                  Mejorar el plan del anuncio
                </h3>
                <p>
                  <strong>"{ad.title}"</strong> — plan actual: <strong>{currentConfig.name}</strong>
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
                <button type="button" className="upgrade-confirm-btn" onClick={onClose}>
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmUpgrade}>
                <div className={`ad-moderation-warning ${wasPublished ? 'is-ok' : ''}`}>
                  {wasPublished ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <div>
                    {wasPublished ? (
                      <>
                        <strong>El plan nuevo se aplica al instante.</strong>
                        <p>Tu anuncio ya está aprobado: al confirmar, se publica con el plan nuevo sin volver a revisión. Las Monedas se descuentan al confirmar.</p>
                      </>
                    ) : (
                      <>
                        <strong>El anuncio sigue en la cola de revisión.</strong>
                        <p>Aún no pasó su primera aprobación; queda con el plan nuevo y se revisa. Las Monedas se descuentan al confirmar.</p>
                      </>
                    )}
                  </div>
                </div>

                <p className="upgrade-section-label">Selecciona el nuevo rango para tu anuncio:</p>

                <div className="upgrade-tiers-grid">
                  {upgradableTiers.map((tierId) => {
                    const opt = TIER_OPTIONS[tierId] || TIER_OPTIONS.destacada;
                    const cost = UPGRADE_TOKEN_COSTS[tierId] || 0;
                    const isSelected = selectedTargetTier === tierId;
                    const OptIcon = opt.Icon;
                    return (
                      <button
                        type="button"
                        key={tierId}
                        className={`upgrade-tier-choice ${isSelected ? 'selected' : ''}`}
                        style={isSelected ? { borderColor: opt.accent, background: `${opt.tagBg}66` } : undefined}
                        onClick={() => setSelectedTargetTier(tierId)}
                      >
                        <div className="upgrade-choice-head">
                          <span className="upgrade-choice-tag" style={{ background: opt.tagBg, color: opt.accent }}>
                            <OptIcon size={11} /> {opt.label}
                          </span>
                          <span className="upgrade-choice-cost">
                            <RepuestopCoin size={14} /> {cost} Monedas
                          </span>
                        </div>
                        <h4 className="choice-title">{opt.planName}</h4>
                        <p className="upgrade-choice-price" style={{ color: opt.accent }}>
                          ${(AD_TIER_PRICES_CLP[tierId] || cost * 50).toLocaleString('es-CL')} CLP por 30 días
                        </p>
                        <p className="upgrade-choice-includes">Incluye todo lo de {opt.includesFrom}, y además:</p>
                        <ul className="choice-benefits">
                          <li>
                            <strong style={{ color: opt.accent }}>{opt.highlight}</strong>
                          </li>
                          {opt.rest.map((line) => <li key={line}>{line}</li>)}
                        </ul>
                      </button>
                    );
                  })}
                </div>

                {/* Mejorar el plan da el derecho, no enciende la funcion: WhatsApp,
                    las historias y la agenda se activan editando el anuncio.

                    Va `unlockedFeatures` (la DIFERENCIA entre los dos planes) y no
                    todo lo que trae el plan destino: quien sube de Destacada a
                    Premium ya tenia WhatsApp, y anunciarselo como novedad lo manda
                    a encender algo que ya estaba encendido. Ademas es lo mismo que
                    listan la pantalla de exito y el formulario, que ya usaban este
                    calculo: antes el modal se contradecia a si mismo antes y
                    despues de confirmar. */}
                {selectedTargetTier && (
                  <p className="ad-upgrade-hint">
                    <Sparkles size={14} /> Después de mejorar el plan tienes que editar el anuncio para
                    activar lo que se desbloquea ({unlockedFeatures.join(', ') || 'las nuevas fotos'}).
                  </p>
                )}

                <div className="upgrade-balance-box">
                  <div className="upgrade-balance-row">
                    <span>Tu saldo de Monedas RepuesTop</span>
                    <strong><RepuestopCoin size={16} /> {tokensBalance.toLocaleString('es-CL')}</strong>
                  </div>
                  <div className="upgrade-balance-row">
                    <span>Costo del cambio de plan</span>
                    <strong className="is-cost"><RepuestopCoin size={16} /> {targetCost}</strong>
                  </div>

                  {!hasEnoughTokens && (
                    <div className="upgrade-balance-short">
                      <span>Te faltan {targetCost - tokensBalance} Monedas para este plan.</span>
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
                    disabled={isProcessing || !hasEnoughTokens || !selectedTargetTier}
                  >
                    {isProcessing ? <Loader2 size={16} className="spin-icon" /> : <Zap size={16} />}
                    {isProcessing ? 'Actualizando…' : `Mejorar por ${targetCost} Monedas`}
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (() => {
          const savedPublished = savedAd
            ? savedAd.moderationStatus === AD_MODERATION_STATUS.APROBADO && savedAd.activo === true
            : wasPublished;
          const targetName = (AD_TIERS[selectedTargetTier] || currentConfig).name;
          return (
          <div className="upgrade-success">
            <div className={`upgrade-success-icon ${savedPublished ? 'is-ok' : ''}`}>
              {savedPublished ? <CheckCircle2 size={34} /> : <Clock3 size={34} />}
            </div>

            <h3>{savedPublished ? 'Plan actualizado' : 'Plan actualizado, en revisión'}</h3>

            <p>
              <strong>"{ad.title}"</strong> quedó en el plan <strong>{targetName}</strong>.{' '}
              {savedPublished
                ? 'La nueva versión ya está visible en el Mural con los beneficios del plan nuevo.'
                : 'Como aún no pasa su primera aprobación, vuelve al Mural cuando lo revisen.'}
            </p>

            {unlockedFeatures.length > 0 && (
              <div className="upgrade-unlocked-box">
                <strong>
                  {unlockedFeatures.length === 1
                    ? 'Función nueva que tienes que encender:'
                    : `${unlockedFeatures.length} funciones nuevas que tienes que encender:`}
                </strong>
                <ul>
                  {unlockedFeatures.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                {onActivateFeatures && (
                  <p className="upgrade-unlocked-cta">
                    "Activar mejoras" te lleva directo a la etapa <b>Beneficios del plan</b> del
                    formulario, con {unlockedFeatures.length === 1 ? 'esa función' : 'esas funciones'} marcada
                    {unlockedFeatures.length === 1 ? '' : 's'} como <span className="ad-nuevo-tag">NUEVO</span>.
                  </p>
                )}
              </div>
            )}

            <div className="upgrade-actions-row is-centered">
              <button type="button" className="upgrade-cancel-btn" onClick={onClose}>
                Más tarde
              </button>
              {unlockedFeatures.length > 0 && onActivateFeatures && (
                <button
                  type="button"
                  className="upgrade-confirm-btn"
                  onClick={() => onActivateFeatures(savedAd, previousTier, selectedTargetTier)}
                >
                  <Sparkles size={16} /> Activar mejoras
                </button>
              )}
            </div>
          </div>
          );
        })()}
      </div>
    </div>,
    document.body
  );
}
