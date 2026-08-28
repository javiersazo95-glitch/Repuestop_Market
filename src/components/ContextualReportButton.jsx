import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, X, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { createContextualReportApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Reportar una tienda, un producto o un anuncio.
 *
 * Es la contraparte de `ContextualEntityActions` del movil, que ya usaba
 * `POST /usuarios/{id}/reportes`. En la web el unico reporte que existia era el del chat
 * (`POST /conversaciones/{id}/reportar`), asi que no habia forma de reportar contenido
 * fuera de una conversacion.
 *
 * `tipoObjeto` tiene que ser uno de los tres que acepta `ReporteUsuarioService`: TIENDA,
 * PRODUCTO o ANUNCIO. Cualquier otro valor responde "El tipo de reporte no es valido".
 *
 * Reutiliza las clases `.quote-ws-report-*` del reporte de cotizaciones a proposito: es el
 * mismo dialogo con otro contenido, y duplicar el CSS los dejaria divergiendo.
 */

const REASONS = {
  TIENDA: [
    'Información comercial engañosa',
    'Incumplimientos reiterados',
    'Suplantación o tienda falsa',
    'Trato inapropiado',
    'Otro motivo',
  ],
  PRODUCTO: [
    'Producto no coincide con la descripción',
    'Precio incorrecto o engañoso',
    'Sospecha de falsificación o estafa',
    'Contenido inapropiado',
    'Otro motivo',
  ],
  ANUNCIO: [
    'Anuncio engañoso o spam',
    'Vendedor no responde o sospechoso',
    'Contenido inapropiado o prohibido',
    'Precio no corresponde',
    'Otro motivo',
  ],
};

export default function ContextualReportButton({ tipoObjeto, objetoId, objetoTitulo, className, label }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const reasons = REASONS[tipoObjeto];
  const entityLabel = tipoObjeto === 'TIENDA'
    ? 'tienda'
    : tipoObjeto === 'PRODUCTO'
      ? 'producto'
      : 'anuncio';

  // El backend resuelve al reportado a partir del id, asi que uno invalido solo sirve para
  // gastar un 400. Y sin sesion no hay a quien atribuir el reporte.
  const numericId = Number(objetoId);
  const hasValidId = Number.isFinite(numericId) && numericId > 0;
  const userId = user?.userId ?? user?.id;
  if (!reasons || !hasValidId || !userId) return null;

  const close = () => {
    if (isSubmitting) return;
    setIsOpen(false);
    setErrorMessage('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!reason || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await createContextualReportApi(userId, {
        tipoObjeto,
        objetoId: numericId,
        motivo: reason,
        descripcion: detail.trim() || `Reporte por el motivo: ${reason}`,
      });
      setReason('');
      setDetail('');
      setIsOpen(false);
      setSuccessOpen(true);
    } catch (error) {
      // "No puedes reportar contenido de tu propia cuenta" llega por aca y es un mensaje
      // util tal cual: se muestra el del backend antes que uno generico.
      setErrorMessage(error?.message || 'No se pudo enviar el reporte. Inténtalo nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={className || 'contextual-report-trigger'}
        onClick={() => setIsOpen(true)}
        title={`Reportar ${entityLabel}`}
      >
        <Flag size={15} />
        <span>{label || 'Reportar'}</span>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="quote-ws-dialog-backdrop" onClick={close}>
          <form className="quote-ws-report-dialog" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <Flag size={22} />
                <span>
                  <strong>Reportar {entityLabel}</strong>
                  <small>{objetoTitulo ? `${objetoTitulo} · ` : ''}Tu reporte es confidencial.</small>
                </span>
              </div>
              <button type="button" aria-label="Cerrar reporte" disabled={isSubmitting} onClick={close}>
                <X size={19} />
              </button>
            </header>

            <div className="quote-ws-report-body">
              <fieldset>
                <legend>Motivo del reporte</legend>
                {reasons.map((item) => (
                  <label key={item} className={reason === item ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="contextualReportReason"
                      value={item}
                      checked={reason === item}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <span>{item}</span>
                    <i />
                  </label>
                ))}
              </fieldset>

              <label className="quote-ws-report-detail">
                <span>Detalle adicional (opcional)</span>
                <textarea
                  rows="3"
                  maxLength="500"
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  placeholder="Cuéntanos qué ocurrió..."
                />
                <small>{detail.length}/500</small>
              </label>

              <div className="contextual-report-help-card">
                <ShieldCheck size={18} className="contextual-report-help-icon" />
                <div>
                  <strong>¿Qué sucederá con tu reporte?</strong>
                  <p>
                    Será revisado de forma confidencial por el equipo de soporte y servirá como antecedente e historial en caso de futuras mediaciones.
                  </p>
                </div>
              </div>

              {errorMessage && <p className="contextual-report-error">{errorMessage}</p>}
            </div>

            <footer>
              <button type="button" className="secondary" disabled={isSubmitting} onClick={close}>Cancelar</button>
              <button type="submit" disabled={!reason || isSubmitting}>
                {isSubmitting ? <Loader2 size={17} className="spin-icon" /> : <Flag size={17} />}
                {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
              </button>
            </footer>
          </form>
        </div>,
        document.body
      )}

      {successOpen && typeof document !== 'undefined' && createPortal(
        <div className="quote-ws-dialog-backdrop" onClick={() => setSuccessOpen(false)}>
          <section
            className="quote-ws-report-success"
            role="dialog"
            aria-modal="true"
            aria-label="Reporte enviado"
            onClick={(event) => event.stopPropagation()}
          >
            <span><CheckCircle2 size={34} /></span>
            <h3>Reporte enviado</h3>
            <p>Hemos recibido tu reporte de manera confidencial y lo revisaremos a la brevedad.</p>
            <button type="button" onClick={() => setSuccessOpen(false)}>Entendido</button>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
