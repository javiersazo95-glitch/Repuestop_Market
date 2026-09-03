import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit3, AlertTriangle, Clock3 } from 'lucide-react';
import { AD_TIERS, AD_MODERATION_STATUS } from '../../data/automotiveAdsData';
import { updateAd, adErrorMessage } from '../../services/adsStorage';
import AdForm from './AdForm';

/**
 * Editar un anuncio ya publicado.
 *
 * `AnuncioService.actualizar()` deja el anuncio en `PENDIENTE` y `activo=false`
 * en CADA guardado, asi que corregir un telefono lo saca del mural hasta que
 * moderacion lo vuelva a aprobar. Se advierte antes de guardar: sin el aviso,
 * el vendedor ve desaparecer su anuncio y cree que se borro.
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

            <div className="ad-moderation-warning create-ad-edit-warning">
              <AlertTriangle size={17} />
              <div>
                <strong>Guardar cambios devuelve el anuncio a revisión.</strong>
                <p>
                  {wasPublished
                    ? 'Tu anuncio saldrá temporalmente del Mural hasta que moderación apruebe la nueva versión.'
                    : 'El anuncio vuelve a la cola de revisión con los datos corregidos.'}
                </p>
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
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock3 size={36} />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
              Cambios guardados, en revisión
            </h3>

            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              Guardamos la nueva versión de <strong>"{savedAd.title}"</strong>. Como cada edición se revisa
              antes de publicarse, el anuncio no está visible en el mural en este momento. Te avisamos
              cuando quede aprobado.
            </p>

            <button type="button" className="btn-post-ad mx-auto" onClick={handleClose}>
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
