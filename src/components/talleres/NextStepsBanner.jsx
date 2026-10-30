import React from 'react';
import { CalendarClock, Check, ChevronRight, Rocket, Wrench } from 'lucide-react';

/**
 * "Próximos pasos" del taller recién acreditado: registrar su agenda (para recibir citas en
 * línea) y completar su perfil con servicios y precios (sin servicios el taller no aparece en el
 * buscador). Se muestra mientras falte alguno; lo calcula el backend
 * (`/automotive-services/me/onboarding`). Mismo contenido que `mobile/components/talleres/NextStepsBanner.tsx`.
 */
export default function NextStepsBanner({ onboarding, onOpenAgenda, onOpenProfile }) {
  if (!onboarding) return null;
  const agendaDone = onboarding.agendaLista === true;
  const profileDone = onboarding.perfilPublicado === true;
  const optionalAgenda = onboarding.agendaOpcional === true;
  if (agendaDone && profileDone) return null;
  const requiredPending = (!agendaDone && !optionalAgenda ? 1 : 0) + (profileDone ? 0 : 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0' }}>
      <section className="next-steps-card" aria-label="Próximos pasos de tu taller">
        <div className="next-steps-head">
          <Rocket size={18} />
          <div>
            <strong>Próximos pasos de tu taller</strong>
            <small>{requiredPending > 0 ? 'Completa estos pasos para empezar a recibir clientes.' : 'Ya casi: revisa los pasos opcionales.'}</small>
          </div>
        </div>
        <Step
          done={profileDone}
          Icon={Wrench}
          title="Completa tu perfil"
          description="Agrega tus servicios con su precio y las marcas en que eres especialista. Sin servicios publicados tu taller no aparece en el buscador."
          actionLabel="Agregar servicios"
          onClick={onOpenProfile}
        />
        <Step
          done={agendaDone}
          optional={optionalAgenda}
          Icon={CalendarClock}
          title="Registra tu agenda"
          description={optionalAgenda
            ? 'Tu taller atiende 24/7. Si algún servicio tiene horario normal, agrégalo para recibir citas.'
            : 'Revisa tu horario principal, la duración de cada cita y la colación. Así recibes citas en línea desde tu perfil.'}
          actionLabel="Configurar"
          onClick={onOpenAgenda}
        />
      </section>
    </div>
  );
}

function Step({ done, optional = false, Icon, title, description, actionLabel, onClick }) {
  return (
    <button
      type="button"
      className={`next-steps-item ${done ? 'is-done' : ''}`}
      onClick={done ? undefined : onClick}
      aria-disabled={done}
    >
      <span className="next-steps-icon">{done ? <Check size={16} /> : <Icon size={16} />}</span>
      <span className="next-steps-copy">
        <strong>
          {title}
          {optional && !done && <span className="next-steps-optional">Opcional</span>}
        </strong>
        {!done && <small>{description}</small>}
      </span>
      {!done && <span className="next-steps-action">{actionLabel} <ChevronRight size={14} /></span>}
    </button>
  );
}
