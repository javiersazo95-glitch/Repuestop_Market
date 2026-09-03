import React from 'react';
import { createPortal } from 'react-dom';
import { X, GraduationCap, Sparkles, ShieldCheck, Megaphone, Check } from 'lucide-react';

/**
 * Tutorial del Mural de Anuncios: por qué conviene publicar en RepuesTop y los
 * pasos de las dos funcionalidades encadenadas —acreditar el servicio y publicar
 * el anuncio—. Se abre desde el botón "Tutorial" de la cabecera de gestión.
 */

const BENEFITS = [
  'Te encuentran los conductores de tu zona que justo buscan tu servicio.',
  'Contacto directo: te llaman o te escriben por WhatsApp, sin intermediarios.',
  'Tu primer anuncio Básico es gratis por 30 días.',
  'Con el plan Empresarial recibes reservas de hora online desde el Mural.',
  'Tu taller aparece con la insignia "Verificado" una vez acreditado.',
  'Eliges cuánta visibilidad quieres: Básico, Destacado, Premium o Empresarial.'
];

const ACCREDITATION_STEPS = [
  'Abre "Acreditar servicio" y completa los datos de tu negocio (nombre, RUT, región y comuna).',
  'Adjunta los tres documentos: identidad del responsable, inicio de actividades del SII y patente municipal vigente.',
  'Envía el expediente. RepuesTop lo revisa y te avisa por correo si queda aprobado, con observaciones o rechazado.',
  'Con el expediente aprobado se habilitan la compra de Monedas y la publicación de anuncios.'
];

const PUBLISH_STEPS = [
  'Ten tu servicio automotriz acreditado (paso anterior).',
  'Pulsa "Publicar anuncio" y elige un plan: Básica (la primera es gratis por 30 días), Destacada, Premium o Empresarial.',
  'Completa el anuncio: fotos, descripción, contacto, etiquetas y —solo en Empresarial— tu agenda de horas para recibir reservas.',
  'Envíalo. Moderación lo revisa antes de publicarlo; te llega una notificación con el resultado.',
  'Ya publicado, puedes editarlo (vuelve a revisión), mejorar su plan con Monedas o darlo de baja cuando quieras.'
];

function StepList({ steps }) {
  return (
    <ol className="steps-legend">
      {steps.map((step, index) => (
        <li key={step}>
          <span className="steps-legend-num">{index + 1}</span>
          <span className="steps-legend-body"><span>{step}</span></span>
        </li>
      ))}
    </ol>
  );
}

export default function AdsTutorialModal({ onClose }) {
  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="booking-modal-card tutorial-modal-card">
        <div className="booking-modal-header">
          <div>
            <h3><GraduationCap size={22} style={{ color: '#0066ff' }} /> Cómo publicar en el Mural</h3>
            <p>Qué ganas publicando en RepuesTop y los pasos para hacerlo.</p>
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

        <div className="tutorial-benefits">
          <h4><Sparkles size={15} /> Por qué publicar en RepuesTop</h4>
          <ul>
            {BENEFITS.map((benefit) => (
              <li key={benefit}><Check size={14} /> <span>{benefit}</span></li>
            ))}
          </ul>
        </div>

        <div className="tutorial-cols">
          <section>
            <h4><ShieldCheck size={15} /> 1. Acreditar tu servicio automotriz</h4>
            <StepList steps={ACCREDITATION_STEPS} />
          </section>
          <section>
            <h4><Megaphone size={15} /> 2. Publicar en el Mural</h4>
            <StepList steps={PUBLISH_STEPS} />
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
