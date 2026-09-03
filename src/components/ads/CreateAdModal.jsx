import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, ShieldCheck, Clock3 } from 'lucide-react';
import { AD_TIERS } from '../../data/automotiveAdsData';
import { createAd, fetchTokensBalance, adErrorMessage } from '../../services/adsStorage';
import AdForm from './AdForm';
import RechargeTokensModal from './RechargeTokensModal';

/**
 * Publicar un anuncio en el Mural.
 *
 * El anuncio NO queda visible al guardar: `AnuncioService.crear()` lo deja
 * `PENDIENTE` y `activo=false` hasta que moderacion lo apruebe. La pantalla de
 * exito lo dice explicitamente; prometer que "ya esta visible" y que el usuario
 * no lo encuentre en el mural es lo que termina en un ticket de soporte.
 */
export default function CreateAdModal({
  isOpen,
  onClose,
  tokensBalance = 0,
  accreditationProfile = null,
  hasUsedBasicFreePeriod = false,
  onAdCreated
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdAd, setCreatedAd] = useState(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(tokensBalance);

  useEffect(() => {
    if (isOpen) setCurrentBalance(tokensBalance);
  }, [isOpen, tokensBalance]);

  if (!isOpen) return null;

  const handleSubmit = async (draft) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      // El cobro ya no se hace aca: `AnuncioService.crear()` descuenta las Monedas
      // del plan en la misma transaccion que el anuncio. Si el saldo no alcanza
      // responde 422 y el anuncio no llega a existir, asi que ese error entra por
      // el mismo `catch` y se muestra en el formulario. Antes se cobraba en el
      // navegador despues del POST, y ese descuento no significaba nada.
      const created = await createAd(draft);
      setCreatedAd(created);
      onAdCreated?.(created, await fetchTokensBalance());
    } catch (error) {
      setSubmitError(adErrorMessage(error, 'No se pudo publicar el anuncio.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCreatedAd(null);
    setSubmitError('');
    setRechargeOpen(false);
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
            <div className="create-ad-modal-header">
              <div className="create-ad-header-main">
                <span className="create-ad-modal-icon"><Plus size={18} /></span>
                <div className="create-ad-header-text">
                  <div className="create-ad-header-topline">
                    <span className="create-ad-modal-eyebrow">Mural Automotriz</span>
                    <span className="create-ad-header-badge">Nuevo Anuncio</span>
                  </div>
                  <h3>Publicar anuncio de servicio</h3>
                  <p>
                    Ofrece tus servicios de taller, mecánica, detailing o asistencia a conductores de tu zona.
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

            <div className="ad-moderation-notice create-ad-review-note">
              <ShieldCheck size={16} />
              <span>
                Todos los anuncios pasan por revisión antes de publicarse en el Mural. Te notificaremos cuando esté activo.
              </span>
            </div>

            <AdForm
              mode="create"
              tokensBalance={currentBalance}
              accreditationProfile={accreditationProfile}
              hasUsedBasicFreePeriod={hasUsedBasicFreePeriod}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              onOpenRecharge={() => setRechargeOpen(true)}
            />
          </>
        ) : (
          <div className="create-ad-success">
            <button type="button" className="create-ad-success-close" onClick={handleClose} aria-label="Cerrar">
              <X size={18} />
            </button>

            <div className="create-ad-success-visual">
              <span className="create-ad-success-rings" aria-hidden="true" />
              <span className="create-ad-success-icon"><Clock3 size={34} /></span>
            </div>

            <span className="create-ad-success-status">PENDIENTE DE VALIDACIÓN</span>
            <h3>Tu anuncio quedó en revisión</h3>
            <p>
              Publicaste <strong>“{createdAd.title}”</strong> en el plan{' '}
              <strong>{(AD_TIERS[createdAd.tier] || AD_TIERS.basica).name}</strong>. Nuestro equipo lo revisará antes de mostrarlo en el Mural.
            </p>

            <div className="create-ad-success-summary">
              <div><span>Publicación</span><strong>{createdAd.title}</strong></div>
              <div><span>Plan seleccionado</span><strong>{(AD_TIERS[createdAd.tier] || AD_TIERS.basica).name}</strong></div>
            </div>

            <div className="create-ad-success-flow" aria-label="Proceso de publicación">
              <div className="is-done"><i>1</i><span><strong>Enviado</strong><small>Recibimos tu anuncio</small></span></div>
              <b />
              <div className="is-current"><i>2</i><span><strong>En revisión</strong><small>Validación del equipo</small></span></div>
              <b />
              <div><i>3</i><span><strong>Publicado</strong><small>Visible en el Mural</small></span></div>
            </div>

            <div className="create-ad-success-note">
              Te enviaremos una notificación cuando sea aprobado o si necesitas realizar alguna corrección.
            </div>

            <button type="button" className="create-ad-success-action" onClick={handleClose}>
              Entendido, volver a Gestión de Anuncios
            </button>
          </div>
        )}
      </div>
      <RechargeTokensModal
        isOpen={rechargeOpen}
        origin="ANUNCIOS"
        onClose={() => setRechargeOpen(false)}
        onRechargeSuccess={setCurrentBalance}
      />
    </div>,
    document.body
  );
}
