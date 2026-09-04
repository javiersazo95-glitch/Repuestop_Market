import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit3, CheckCircle2, AlertTriangle, Clock3 } from 'lucide-react';
import { AD_TIERS, AD_MODERATION_STATUS } from '../../data/automotiveAdsData';
import { updateAd, adErrorMessage } from '../../services/adsStorage';
import AdForm from './AdForm';

/**
 * Editar un anuncio ya publicado.
 *
 * La moderación es solo para la primera publicación: `AnuncioService.actualizar()`
 * mantiene APROBADO/activo un aviso ya aprobado que su dueño edita, así que los
 * cambios entran directo al Mural. Solo los avisos que todavía no pasaron
 * revisión (PENDIENTE / rechazados) siguen en la cola tras editarlos.
 */
export default function EditAdModal({
  ad, isOpen, onClose, onAdUpdated, upgradedFromTier, upgradedToTier
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savedAd, setSavedAd] = useState(null);

  if (!isOpen || !ad) return null;

  const tierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
  const wasPublished = ad.moderationStatus === AD_MODERATION_STATUS.APROBADO && ad.activo === true;

  const handleSubmit = async (draft) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const saved = await updateAd(ad.id, draft);
      setSavedAd(saved);
      onAdUpdated?.(saved);
    } catch (error) {
      setSubmitError(adErrorMessage(error, 'No se pudieron guardar los cambios.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSavedAd(null);
    setSubmitError('');
    onClose?.();
  };

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="create-ad-modal-card">
        {!savedAd ? (
          <>
            <div className="create-ad-modal-header">
              <div className="create-ad-header-main">
                <span className="create-ad-modal-icon edit-mode-icon"><Edit3 size={18} /></span>
                <div className="create-ad-header-text">
                  <div className="create-ad-header-topline">
                    <span className="create-ad-modal-eyebrow">Mural Automotriz</span>
                    <span className="create-ad-header-badge plan-badge">Plan {tierConfig.name}</span>
                  </div>
                  <h3>Editar anuncio publicado</h3>
                  <p>
                    Modifica los datos de tu aviso. Para cambiar de categoría de visibilidad usa "Mejorar rango".
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="create-ad-close-btn"
                onClick={handleClose}
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className={`ad-moderation-warning create-ad-edit-warning ${wasPublished ? 'is-ok' : ''}`}>
              {wasPublished ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
              <div>
                {wasPublished ? (
                  <>
                    <strong>Los cambios se publican al instante.</strong>
                    <p>Tu anuncio ya está aprobado: al guardar, la nueva versión queda visible en el Mural sin pasar de nuevo por revisión.</p>
                  </>
                ) : (
                  <>
                    <strong>El anuncio sigue en la cola de revisión.</strong>
                    <p>Todavía no pasó su primera aprobación; se revisa con los datos corregidos y luego queda visible.</p>
                  </>
                )}
              </div>
            </div>

            <AdForm
              mode="edit"
              initialAd={ad}
              isSubmitting={isSubmitting}
              submitError={submitError}
              upgradedFromTier={upgradedFromTier}
              upgradedToTier={upgradedToTier}
              onSubmit={handleSubmit}
              onCancel={handleClose}
            />
          </>
        ) : (() => {
          const savedPublished = savedAd.moderationStatus === AD_MODERATION_STATUS.APROBADO && savedAd.activo === true;
          return (
            <div className="upgrade-success">
              <div className={`upgrade-success-icon ${savedPublished ? 'is-ok' : ''}`}>
                {savedPublished ? <CheckCircle2 size={34} /> : <Clock3 size={34} />}
              </div>

              <h3>{savedPublished ? 'Cambios publicados' : 'Cambios guardados, en revisión'}</h3>

              <p>
                {savedPublished
                  ? <>Actualizamos <strong>"{savedAd.title}"</strong> en el Mural. La nueva versión ya está visible para los clientes.</>
                  : <>Guardamos la nueva versión de <strong>"{savedAd.title}"</strong>. Como todavía no pasó su primera aprobación, te avisamos cuando quede publicado.</>}
              </p>

              <div className="upgrade-actions-row is-centered">
                <button type="button" className="upgrade-confirm-btn" onClick={handleClose}>
                  Entendido
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>,
    document.body
  );
}
