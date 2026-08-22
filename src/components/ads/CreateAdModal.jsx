import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, ShieldCheck, Clock3 } from 'lucide-react';
import { AD_TIERS } from '../../data/automotiveAdsData';
import { createAd, spendTokensForNewAd, adErrorMessage } from '../../services/adsStorage';
import AdForm from './AdForm';

/**
 * Publicar un anuncio en el Mural.
 *
 * El anuncio NO queda visible al guardar: `AnuncioService.crear()` lo deja
 * `PENDIENTE` y `activo=false` hasta que moderacion lo apruebe. La pantalla de
 * exito lo dice explicitamente; prometer que "ya esta visible" y que el usuario
 * no lo encuentre en el mural es lo que termina en un ticket de soporte.
 */
export default function CreateAdModal({ isOpen, onClose, tokensBalance = 0, onAdCreated }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdAd, setCreatedAd] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (draft) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      // Primero se publica y despues se cobra: un POST fallido no puede dejar al
      // usuario sin Fichas y sin anuncio.
      const created = await createAd(draft);
      let balance = tokensBalance;
      try {
        balance = spendTokensForNewAd(created.tier, created.title);
      } catch (walletError) {
        // El anuncio ya existe en el backend; el cobro es local y no se puede
        // revertir alla. Se avisa, pero no se trata como un fallo de publicacion.
        console.warn('El anuncio se publicó pero no se pudo descontar el saldo:', walletError);
      }
      setCreatedAd(created);
      onAdCreated?.(created, balance);
    } catch (error) {
      setSubmitError(adErrorMessage(error, 'No se pudo publicar el anuncio.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCreatedAd(null);
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
        {!createdAd ? (
          <>
            <div className="booking-modal-header">
              <div>
                <h3>
                  <Plus className="text-amber-500" size={22} />
                  Publicar anuncio en el Mural Automotriz
                </h3>
                <p>
                  Ofrece tus servicios de taller, mecánica, detailing o asistencia a los conductores de la zona.
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

            <div className="ad-moderation-notice">
              <ShieldCheck size={16} />
              <span>
                Todos los anuncios pasan por revisión antes de publicarse. Vas a poder seguir el estado
                desde esta misma pantalla y te avisamos cuando quede aprobado.
              </span>
            </div>

            <AdForm
              mode="create"
              tokensBalance={tokensBalance}
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
              Tu anuncio quedó en revisión
            </h3>

            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              Publicaste <strong>"{createdAd.title}"</strong> en el plan{' '}
              <strong>{(AD_TIERS[createdAd.tier] || AD_TIERS.basica).name}</strong>. Todavía no aparece en
              el Mural de Anuncios: primero lo revisa el equipo de moderación. Cuando quede aprobado te
              llega una notificación y lo vas a ver publicado en tu gestión de anuncios.
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
