import React from 'react';
import { AlertCircle, CalendarClock, Check, ChevronRight, Megaphone, Rocket } from 'lucide-react';

/**
 * "Próximos pasos" del taller recién acreditado: registrar su agenda (para recibir
 * citas en anuncios Empresariales) y crear su primer anuncio. Se muestra mientras
 * falte alguno; lo calcula el backend (`/automotive-services/me/onboarding`).
 * Mismo contenido que `mobile/components/ads/NextStepsBanner.tsx`.
 */
export default function NextStepsBanner({ onboarding, onOpenAgenda, onCreateAd, onOpenHours }) {
  if (!onboarding) return null;
  const agendaDone = onboarding.agendaLista === true;
  const firstAdDone = onboarding.primerAnuncio === true;
  const optionalAgenda = onboarding.agendaOpcional === true;
  const stale24 = Number(onboarding.anuncios24HorasSinRespaldo) || 0;
  const showSteps = !agendaDone || !firstAdDone;
  if (!showSteps && stale24 === 0) return null;
  const requiredPending = (!agendaDone && !optionalAgenda ? 1 : 0) + (firstAdDone ? 0 : 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0' }}>
      {showSteps && (
        <section className="next-steps-card" aria-label="Próximos pasos de tu taller">
          <div className="next-steps-head">
            <Rocket size={18} />
            <div>
              <strong>Próximos pasos de tu taller</strong>
              <small>{requiredPending > 0 ? 'Completa estos pasos para empezar a recibir clientes.' : 'Ya casi: revisa los pasos opcionales.'}</small>
            </div>
          </div>
          <Step
            done={agendaDone}
            optional={optionalAgenda}
            Icon={CalendarClock}
            title="Registra tu agenda"
            description={optionalAgenda
              ? 'Tu taller atiende 24/7. Si algún servicio tiene horario normal, agrégalo para recibir citas.'
              : 'Revisa tu horario principal, la duración de cada cita y la colación. Así recibes citas en tus anuncios empresariales.'}
            actionLabel="Configurar"
            onClick={onOpenAgenda}
          />
          <Step
            done={firstAdDone}
            Icon={Megaphone}
            title="Crea tu primer anuncio"
            description="Publica tu taller en el Mural para que los clientes te encuentren."
            actionLabel="Crear"
            onClick={onCreateAd}
          />
        </section>
      )}

      {stale24 > 0 && (
        <button type="button" className="next-steps-warning" onClick={onOpenHours}>
          <AlertCircle size={17} />
          <span>
            Tienes {stale24} anuncio{stale24 === 1 ? '' : 's'} marcado{stale24 === 1 ? '' : 's'} 24/7, pero tu taller ya no
            declara atención 24/7. Edíta{stale24 === 1 ? 'lo' : 'los'} o vuelve a activar 24/7 en &quot;Horario y urgencias&quot;.
          </span>
        </button>
      )}
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
