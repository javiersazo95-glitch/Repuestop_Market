import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck, ShieldAlert, Hourglass, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, ArrowRight, Building2, MapPin, Phone
} from 'lucide-react';

/**
 * Estado del expediente de servicio automotriz, compacto, para la cabecera de la
 * gestión de anuncios. Publicar en el Mural exige el expediente APROBADO
 * (`AnuncioService` lo valida en el backend); esta pastilla lo comunica y abre el
 * formulario. Equivale al bloque de `AccreditationStatusCard` de la app, reducido
 * a un chip con panel desplegable.
 */

const STEPS = [
  'Completa los datos de tu negocio (nombre, RUT, región y comuna).',
  'Adjunta identidad del responsable, inicio de actividades del SII y patente municipal vigente.',
  'Envía el expediente. RepuesTop lo revisa y te avisa por correo.',
  'Con el expediente aprobado se habilita publicar en el Mural.'
];

const THEME = {
  APROBADO: { tone: 'ok', Icon: ShieldCheck, label: 'Acreditado', sub: 'Verificado' },
  SIN_SOLICITUD: { tone: 'warn', Icon: ShieldAlert, label: 'Sin acreditar', sub: 'Requerido para publicar', cta: 'Comenzar acreditación' },
  PENDIENTE: { tone: 'info', Icon: Hourglass, label: 'En revisión', sub: 'Acreditación', cta: 'Ver expediente' },
  POR_CORREGIR: { tone: 'warn', Icon: AlertTriangle, label: 'Corrige tu acreditación', sub: 'Observaciones', cta: 'Corregir y reenviar' },
  RECHAZADO: { tone: 'bad', Icon: XCircle, label: 'Acreditación rechazada', sub: 'Revisa y reenvía', cta: 'Revisar y reenviar' }
};

function describe(status, businessName, reviewNotes) {
  if (reviewNotes.trim() && (status === 'POR_CORREGIR' || status === 'RECHAZADO')) return reviewNotes.trim();
  if (status === 'PENDIENTE') {
    return businessName.trim()
      ? `Estamos validando los documentos de ${businessName.trim()}. Te avisaremos por correo.`
      : 'Estamos validando tus documentos. Te avisaremos por correo.';
  }
  return 'Para publicar anuncios en el Mural debemos validar los documentos de tu negocio.';
}

export function AccreditationPill({ status, businessName = '', reviewNotes = '', profile, onOpen }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const theme = THEME[status] || THEME.SIN_SOLICITUD;
  const { Icon } = theme;
  const approved = status === 'APROBADO';

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const location = [profile?.address, profile?.commune, profile?.region].filter(Boolean).join(', ');

  return (
    <div className="acc-pill-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`acc-pill tone-${theme.tone}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <Icon size={15} />
        <span className="acc-pill-txt">
          <strong>{theme.label}</strong>
          <em>{theme.sub}</em>
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="acc-pill-pop">
          {approved ? (
            <>
              <div className="acc-pill-rows">
                <Row Icon={Building2} label="Taller" value={profile?.businessName} />
                <Row Icon={MapPin} label="Ubicación" value={location} />
                <Row Icon={Phone} label="Teléfono publicado" value={profile?.phone} />
              </div>
              <button type="button" className="acc-pill-cta" onClick={() => { setOpen(false); onOpen?.(); }}>
                <span>Ver o editar expediente</span>
                <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <>
              <p className="acc-pill-desc">{describe(status, businessName, reviewNotes)}</p>
              <ol className="steps-legend">
                {STEPS.map((step, index) => (
                  <li key={step}>
                    <span className="steps-legend-num">{index + 1}</span>
                    <span className="steps-legend-body"><span>{step}</span></span>
                  </li>
                ))}
              </ol>
              <button type="button" className={`acc-pill-cta tone-${theme.tone}`} onClick={() => { setOpen(false); onOpen?.(); }}>
                <span>{theme.cta}</span>
                <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ Icon, label, value }) {
  return (
    <div className="acc-pill-row">
      <Icon size={14} />
      <div>
        <span>{label}</span>
        <strong>{(value || '').trim() || 'Sin registrar'}</strong>
      </div>
    </div>
  );
}
