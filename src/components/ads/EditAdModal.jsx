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
export default function EditAdModal({ ad, isOpen, onClose, onAdUpdated }) {
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
            <div className="booking-modal-header">
              <div>
                <h3>
                  <Edit3 className="text-blue-600" size={22} />
                  Editar anuncio
                </h3>
                <p>
                  Plan actual: <strong className="uppercase">{tierConfig.name}</strong>. Para cambiar de plan
                  usa "Mejorar rango".
                </p>
              </div>
              <button
                type="button"
                className="story-close-btn"
                style={{ background: '#f1f5f9', color: '#0f172a' }}
                onClick={handleClose}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ad-moderation-warning">
              <AlertTriangle size={18} />
              <div>
                <strong>Guardar cambios devuelve el anuncio a revisión.</strong>
                <p>
                  {wasPublished
                    ? 'Tu anuncio va a salir del Mural de Anuncios hasta que moderación apruebe la nueva versión. Si es un cambio menor, conviene juntarlo con el resto de las correcciones y guardar una sola vez.'
                    : 'El anuncio vuelve a la cola de revisión con los datos corregidos.'}
                </p>
              </div>
            </div>

            <AdForm
              mode="edit"
              initialAd={ad}
              isSubmitting={isSubmitting}
              submitError={submitError}
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
