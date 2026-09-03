import React from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck } from 'lucide-react';
import AutomotiveServiceAccreditation from '../AutomotiveServiceAccreditation';

/**
 * Acreditación del servicio automotriz dentro de la gestión de anuncios. Antes
 * era una pestaña propia del perfil; se movió acá para que el requisito viva
 * junto a la acción que habilita (publicar en el Mural), como en la app móvil.
 *
 * El expediente es INDEPENDIENTE de la verificación de la tienda: lo revisa otro
 * equipo sobre `/automotive-services/me` y exige de nuevo los tres documentos.
 */

const STEPS = [
  {
    title: 'Completa los datos de tu negocio',
    detail: 'Nombre, RUT, giro, responsable y la región/comuna donde atiendes.'
  },
  {
    title: 'Adjunta los tres documentos',
    detail: 'Identidad o RUT del responsable, inicio de actividades del SII y patente municipal vigente (PDF o foto).'
  },
  {
    title: 'Envía el expediente a validación',
    detail: 'Un equipo de RepuesTop lo revisa. Te avisamos por correo cuando haya respuesta (aprobado, con observaciones o rechazado).'
  },
  {
    title: 'Publica en el Mural',
    detail: 'Con el expediente aprobado quedan habilitadas la compra de Monedas y la publicación de anuncios.'
  }
];

export default function AccreditationModal({ user, onClose, onSaved }) {
  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="booking-modal-card acc-modal-card">
        <div className="booking-modal-header">
          <div>
            <h3><ShieldCheck size={22} style={{ color: '#2563eb' }} /> Acreditar servicio automotriz</h3>
            <p>Requisito para publicar en el Mural. Es independiente de los documentos de tu tienda.</p>
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

        <ol className="steps-legend">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="steps-legend-num">{index + 1}</span>
              <span className="steps-legend-body">
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <AutomotiveServiceAccreditation
          user={user}
          embedded
          onSaved={(saved) => onSaved?.(saved)}
        />
      </div>
    </div>,
    document.body
  );
}
