import React from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, CalendarClock } from 'lucide-react';
import AutomotiveServiceAccreditation from '../AutomotiveServiceAccreditation';

/**
 * Acreditación del servicio automotriz dentro de Mi taller. Antes era una pestaña
 * propia del perfil; vive acá para que el requisito esté junto a lo que habilita
 * (aparecer en el buscador de talleres), como en la app móvil.
 *
 * El expediente es INDEPENDIENTE de la verificación de la tienda: lo revisa otro
 * equipo sobre `/automotive-services/me` y exige de nuevo los tres documentos.
 */

const STEPS = [
  {
    title: 'Sube el logo y los datos de tu negocio',
    detail: 'El logo de tu empresa aparece en tu tarjeta del buscador y en tu perfil. Luego: nombre, RUT, giro, responsable y la región/comuna donde atiendes.'
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
    title: 'Completa tu perfil',
    detail: 'Con el expediente aprobado puedes publicar tus servicios con precio desde, fotos, marcas y horario, y recibir citas en línea. El logo se puede cambiar cuando quieras desde este mismo apartado.'
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
            <p>Requisito para aparecer en el buscador de talleres. Nuestro equipo revisa tus documentos.</p>
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

        <div className="acc-agenda-hint">
          <CalendarClock size={16} />
          <span>
            ¿Quieres recibir citas en línea? Necesitas tener tu
            <strong> horario configurado</strong>. Lo registras al acreditarte o después en
            <strong> Mi taller → Gestión de citas → Agenda</strong>.
          </span>
        </div>

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
