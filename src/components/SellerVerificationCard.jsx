import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck, ShieldAlert, ShieldQuestion, Clock, FileUp, X,
  Loader2, CheckCircle2, AlertTriangle, FileSignature, Eye, ScrollText,
} from 'lucide-react';
import {
  getSellerVerificationStatusApi,
  submitSellerVerificationApi,
  updateSellerVerificationApi,
  appealSellerVerificationApi,
  acceptSellerAdhesionApi,
  getSellerAdhesionPreviewApi,
  resolveMediaUrl,
} from '../services/api';
import { VENDEDOR_TERMS, PRIVACIDAD_POLICY, LEGAL_VERSION } from '../data/legalTexts';

/**
 * Verificación comercial y contrato de adhesión del vendedor (A7 y A12).
 *
 * Antes esto era una tarjeta con dos líneas fijas que decían "Tienda Verificada" y
 * "Términos y condiciones aceptados" pase lo que pase: `TiendaResponseDTO` no trae el
 * estado de verificación, así que el `||` de respaldo se aplicaba SIEMPRE. Un vendedor
 * rechazado veía un visto verde. Ahora el estado sale de
 * `GET /proveedores/{id}/verificacion` y, si no hay solicitud, se dice que no la hay.
 *
 * Los cuatro documentos son los mismos que pide el backoffice en su bandeja de
 * validaciones, con sus mismas etiquetas: si acá se llaman distinto, el vendedor no
 * entiende qué le están rechazando.
 */
const DOCUMENTS = [
  { field: 'inicioActividadesDoc', label: 'Certificado de inicio de actividades', responseField: 'inicioActividadesDoc' },
  { field: 'patenteDoc', label: 'Patente comercial actualizada', responseField: 'patenteDoc' },
  { field: 'boletaFacturaDoc', label: 'Factura de venta o boleta electrónica', responseField: 'boletaFacturaDoc' },
  { field: 'representativeDocument', label: 'Declaración de representante legal', responseField: 'representativeDocument' },
];

// `EstadoRevisionVerificacion` del backend. Las etiquetas son las del backoffice.
const STATUS_META = {
  PENDING: { label: 'En revisión', tone: 'pending', icon: Clock, hint: 'Recibimos tus documentos. Te avisaremos cuando el equipo termine de revisarlos.' },
  APPROVED: { label: 'Tienda verificada', tone: 'approved', icon: ShieldCheck, hint: 'Tu documentación está aprobada. No necesitas hacer nada más.' },
  REJECTED: { label: 'Rechazada', tone: 'rejected', icon: ShieldAlert, hint: 'La solicitud fue rechazada. Puedes apelar explicando tu caso al equipo de revisión.' },
  NEEDS_CORRECTION: { label: 'Por corregir', tone: 'correction', icon: AlertTriangle, hint: 'Falta corregir algo en tu documentación. Vuelve a subir los archivos indicados.' },
};

const NOT_SUBMITTED = {
  label: 'Sin enviar',
  tone: 'none',
  icon: ShieldQuestion,
  hint: 'Todavía no envías tu documentación. Verificar tu tienda mejora la confianza de los compradores.',
};

export default function SellerVerificationCard({ sellerId }) {
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [files, setFiles] = useState({});
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [appealText, setAppealText] = useState('');
  const [showAppeal, setShowAppeal] = useState(false);
  const [isAppealing, setIsAppealing] = useState(false);

  const [isAcceptingAdhesion, setIsAcceptingAdhesion] = useState(false);
  // Lectura del contrato antes de aceptarlo, y de los textos legales despues.
  const [adhesionPreviewUrl, setAdhesionPreviewUrl] = useState('');
  const [isLoadingAdhesion, setIsLoadingAdhesion] = useState(false);
  const [adhesionError, setAdhesionError] = useState('');
  const [legalDoc, setLegalDoc] = useState(null); // 'terms' | 'privacy'

  const load = useCallback(async (signal) => {
    if (!sellerId) return;
    setLoading(true);
    setLoadError('');
    try {
      const data = await getSellerVerificationStatusApi(sellerId, { signal });
      setVerification(data);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setLoadError(err?.message || 'No pudimos cargar el estado de tu verificación.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const status = verification?.reviewStatus || null;
  const meta = status ? (STATUS_META[status] || NOT_SUBMITTED) : NOT_SUBMITTED;
  const StatusIcon = meta.icon;

  // El PUT es para corregir una solicitud que ya existe; el POST la crea.
  const isCorrection = Boolean(verification?.verificationId);
  const canSubmit = !status || status === 'NEEDS_CORRECTION' || status === 'REJECTED';
  const adhesionAccepted = Boolean(verification?.adhesionContractDoc);

  const pickFile = (field, file) => {
    setFormError('');
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setFormError('Cada documento debe pesar menos de 10 MB.');
      return;
    }
    setFiles((previous) => ({ ...previous, [field]: file }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const chosen = DOCUMENTS.filter((doc) => files[doc.field]);
    if (chosen.length === 0) {
      setFormError('Adjunta al menos un documento para enviar tu solicitud.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      const payload = new FormData();
      chosen.forEach((doc) => payload.append(doc.field, files[doc.field]));
      if (websiteUrl.trim()) payload.append('websiteOrSocialUrl', websiteUrl.trim());

      const updated = isCorrection
        ? await updateSellerVerificationApi(sellerId, payload)
        : await submitSellerVerificationApi(sellerId, payload);

      setVerification(updated);
      setFiles({});
      setShowForm(false);
      setSuccessMessage(isCorrection
        ? 'Documentos actualizados. Tu solicitud vuelve a la cola de revisión.'
        : 'Solicitud enviada. Te avisaremos cuando el equipo la revise.');
    } catch (err) {
      setFormError(err?.message || 'No se pudo enviar la documentación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppeal = async (event) => {
    event.preventDefault();
    if (isAppealing || !appealText.trim()) return;
    setIsAppealing(true);
    setFormError('');
    try {
      const updated = await appealSellerVerificationApi(sellerId, appealText.trim());
      setVerification(updated);
      setAppealText('');
      setShowAppeal(false);
      setSuccessMessage('Apelación enviada. El equipo revisará tu caso nuevamente.');
    } catch (err) {
      setFormError(err?.message || 'No se pudo enviar la apelación.');
    } finally {
      setIsAppealing(false);
    }
  };

  // El PDF se pide con el token (fetchApi), asi que no sirve un <iframe src>: se trae
  // como Blob y se muestra por objectURL. Se revoca al cerrar para no dejarlo colgando.
  const openAdhesionPreview = async () => {
    if (isLoadingAdhesion) return;
    setIsLoadingAdhesion(true);
    setAdhesionError('');
    try {
      const blob = await getSellerAdhesionPreviewApi(sellerId);
      setAdhesionPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setAdhesionError(err?.message || 'No pudimos abrir el contrato. Inténtalo nuevamente.');
    } finally {
      setIsLoadingAdhesion(false);
    }
  };

  const closeAdhesionPreview = () => {
    if (adhesionPreviewUrl) URL.revokeObjectURL(adhesionPreviewUrl);
    setAdhesionPreviewUrl('');
    setAdhesionError('');
  };

  const handleAcceptAdhesion = async () => {
    if (isAcceptingAdhesion) return;
    setIsAcceptingAdhesion(true);
    setFormError('');
    try {
      const updated = await acceptSellerAdhesionApi(sellerId);
      setVerification(updated);
      setSuccessMessage('Contrato de adhesión aceptado.');
      closeAdhesionPreview();
    } catch (err) {
      setFormError(err?.message || 'No se pudo registrar la aceptación del contrato.');
    } finally {
      setIsAcceptingAdhesion(false);
    }
  };

  return (
    <div className="details-card-block store-section-card">
      <div className="details-card-header-row">
        <h3 className="section-subtitle">
          <span className="section-subtitle-icon"><ShieldCheck size={16} /></span>
          <span>Verificación comercial y adhesión</span>
        </h3>
      </div>

      {loading ? (
        <p className="verification-loading"><Loader2 size={16} className="spin-icon" /> Cargando tu estado…</p>
      ) : loadError ? (
        <p className="confirm-dialog-error">{loadError}</p>
      ) : (
        <div className="verification-body">
          <div className={`verification-status verification-status--${meta.tone}`}>
            <StatusIcon size={20} />
            <div>
              <strong>{meta.label}</strong>
              <span>{meta.hint}</span>
            </div>
          </div>

          {verification?.reviewNotes && (
            <div className="verification-notes">
              <span className="verification-notes-label">Comentario del equipo de revisión</span>
              <p>{verification.reviewNotes}</p>
            </div>
          )}

          {successMessage && <p className="verification-success"><CheckCircle2 size={15} /> {successMessage}</p>}
          {formError && <p className="confirm-dialog-error">{formError}</p>}

          {/* Documentos ya enviados */}
          {isCorrection && (
            <ul className="verification-doc-list">
              {DOCUMENTS.map((doc) => {
                const sent = verification?.[doc.responseField];
                return (
                  <li key={doc.field}>
                    {sent ? <CheckCircle2 size={14} className="doc-ok" /> : <X size={14} className="doc-missing" />}
                    <span>{doc.label}</span>
                    <small>{sent ? 'Enviado' : 'No enviado'}</small>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Formulario de envío o corrección */}
          {canSubmit && !showForm && (
            <button type="button" className="btn-auth-primary verification-cta" onClick={() => { setShowForm(true); setSuccessMessage(''); }}>
              <FileUp size={16} />
              <span>{isCorrection ? 'Corregir documentación' : 'Enviar documentación'}</span>
            </button>
          )}

          {canSubmit && showForm && (
            <form className="verification-form" onSubmit={handleSubmit}>
              {DOCUMENTS.map((doc) => (
                <div className="order-subdialog-field" key={doc.field}>
                  <span>{doc.label}</span>
                  <div className="order-subdialog-filedrop">
                    <label>
                      <FileUp size={18} />
                      <span>{files[doc.field]?.name || 'Adjuntar PDF o imagen'}</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => pickFile(doc.field, e.target.files?.[0])}
                      />
                    </label>
                    {files[doc.field] && (
                      <button
                        type="button"
                        className="order-subdialog-fileclear"
                        aria-label="Quitar archivo"
                        onClick={() => setFiles((previous) => {
                          const next = { ...previous };
                          delete next[doc.field];
                          return next;
                        })}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <label className="order-subdialog-field">
                <span>Sitio web o red social (opcional)</span>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="https://instagram.com/tutienda"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </label>

              <div className="confirm-dialog-actions">
                <button type="button" className="btn-auth-secondary" onClick={() => { setShowForm(false); setFormError(''); }} disabled={isSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-auth-primary" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 size={16} className="spin-icon" />}
                  {isSubmitting ? 'Enviando…' : 'Enviar documentación'}
                </button>
              </div>
            </form>
          )}

          {/* Apelación: solo tiene sentido sobre un rechazo */}
          {status === 'REJECTED' && !showAppeal && (
            <button type="button" className="btn-auth-secondary verification-cta" onClick={() => setShowAppeal(true)}>
              Apelar el rechazo
            </button>
          )}

          {status === 'REJECTED' && showAppeal && (
            <form className="verification-form" onSubmit={handleAppeal}>
              <label className="order-subdialog-field">
                <span>Explica por qué debería revisarse de nuevo *</span>
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  placeholder="Cuenta al equipo qué información adicional respalda tu solicitud…"
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                />
              </label>
              <div className="confirm-dialog-actions">
                <button type="button" className="btn-auth-secondary" onClick={() => setShowAppeal(false)} disabled={isAppealing}>
                  Cancelar
                </button>
                <button type="submit" className="btn-auth-primary" disabled={isAppealing || !appealText.trim()}>
                  {isAppealing && <Loader2 size={16} className="spin-icon" />}
                  {isAppealing ? 'Enviando…' : 'Enviar apelación'}
                </button>
              </div>
            </form>
          )}

          {/* Contrato de adhesión */}
          <div className="verification-adhesion">
            <div>
              <FileSignature size={17} />
              <div>
                <strong>Contrato de adhesión</strong>
                <span>{adhesionAccepted ? 'Aceptado' : 'Pendiente de aceptación'}</span>
              </div>
            </div>
            {/* Antes el unico boton era "Aceptar contrato" y aceptaba de inmediato: se
                firmaba un documento que no habia forma de leer. Ahora primero se abre. */}
            {adhesionAccepted ? (
              <a
                className="btn-auth-secondary"
                href={resolveMediaUrl(verification?.adhesionContractDoc) || '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye size={16} /> Ver contrato firmado
              </a>
            ) : (
              <button type="button" className="btn-auth-secondary" onClick={openAdhesionPreview} disabled={isLoadingAdhesion}>
                {isLoadingAdhesion ? <Loader2 size={16} className="spin-icon" /> : <Eye size={16} />}
                {isLoadingAdhesion ? 'Abriendo…' : 'Leer y aceptar contrato'}
              </button>
            )}
          </div>

          {adhesionError && (
            <div className="auth-alert alert-error" style={{ marginTop: '10px' }}>
              <AlertTriangle size={15} />
              <span>{adhesionError}</span>
            </div>
          )}

          {/* Los documentos legales quedaban sin acceso desde el panel: se aceptan en el
              registro y despues no habia donde releerlos. */}
          <div className="verification-legal-links">
            <ScrollText size={15} />
            <span>Documentos legales vigentes ({LEGAL_VERSION}):</span>
            <button type="button" className="link-btn" onClick={() => setLegalDoc('terms')}>
              Términos del vendedor
            </button>
            <button type="button" className="link-btn" onClick={() => setLegalDoc('privacy')}>
              Política de privacidad
            </button>
          </div>
        </div>
      )}

      {/* Los dos dialogos salen por portal: la tarjeta vive dentro del panel, que tiene
          sus propios contenedores con overflow, y ahi el overlay quedaria recortado. */}
      {adhesionPreviewUrl && createPortal(
        <div className="order-modal-backdrop" onClick={closeAdhesionPreview}>
          <div className="order-modal-container legal-doc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <div className="order-modal-title-group">
                <div className="order-modal-icon-badge"><FileSignature size={20} /></div>
                <div className="order-subdialog-heading">
                  <h2>Contrato de adhesión</h2>
                  <span className="order-modal-subtitle">
                    Léelo completo antes de aceptar. Es el mismo documento que quedará firmado.
                  </span>
                </div>
              </div>
              <button type="button" className="btn-close-modal" onClick={closeAdhesionPreview} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <object className="legal-doc-viewer" data={adhesionPreviewUrl} type="application/pdf">
              {/* Un navegador sin visor de PDF integrado no renderiza el <object>: se
                  ofrece abrirlo aparte en vez de dejar un recuadro en blanco. */}
              <p className="legal-doc-fallback">
                Tu navegador no puede mostrar el PDF aquí.{' '}
                <a href={adhesionPreviewUrl} target="_blank" rel="noopener noreferrer">Ábrelo en una pestaña nueva</a>.
              </p>
            </object>

            <div className="legal-doc-actions">
              <button type="button" className="btn-auth-secondary" onClick={closeAdhesionPreview}>
                Cerrar
              </button>
              <button type="button" className="btn-auth-primary" onClick={handleAcceptAdhesion} disabled={isAcceptingAdhesion}>
                {isAcceptingAdhesion && <Loader2 size={16} className="spin-icon" />}
                {isAcceptingAdhesion ? 'Registrando…' : 'Acepto el contrato'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {legalDoc && createPortal(
        <div className="order-modal-backdrop" onClick={() => setLegalDoc(null)}>
          <div className="order-modal-container legal-doc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <div className="order-modal-title-group">
                <div className="order-modal-icon-badge"><ScrollText size={20} /></div>
                <div className="order-subdialog-heading">
                  <h2>{legalDoc === 'privacy' ? 'Política de privacidad' : 'Términos y condiciones del vendedor'}</h2>
                  <span className="order-modal-subtitle">Versión vigente: {LEGAL_VERSION}</span>
                </div>
              </div>
              <button type="button" className="btn-close-modal" onClick={() => setLegalDoc(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="legal-doc-text">
              {(legalDoc === 'privacy' ? PRIVACIDAD_POLICY : VENDEDOR_TERMS)
                .split('\n\n')
                .map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>

            <div className="legal-doc-actions">
              <button type="button" className="btn-auth-secondary" onClick={() => setLegalDoc(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
