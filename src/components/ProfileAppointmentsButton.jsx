import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getAppointmentsSummaryApi } from '../services/api';
import { APPOINTMENTS_UPDATED_EVENT } from '../services/adsStorage';
import MyAppointmentsHub from './ads/MyAppointmentsHub';

/**
 * Acceso a "Mis citas" en la barra del perfil, junto a la campana, con el contador de citas
 * vigentes (`GET /anuncios/agendamientos/resumen`: ni pasadas ni canceladas). Si hay
 * solicitudes por responder, el contador las muestra a ellas y en ámbar.
 *
 * También atiende el enlace de las notificaciones de cita: `?citas=recibidas|pedidas&cita=ID`
 * abre la gestión en esa bandeja con la cita resaltada.
 */
export default function ProfileAppointmentsButton({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState(null);
  const userId = user?.userId ?? user?.id;

  const segmentParam = searchParams.get('citas');
  const focusId = searchParams.get('cita');
  const isOpen = Boolean(segmentParam);

  const loadSummary = useCallback(async () => {
    if (!userId) return;
    try { setSummary(await getAppointmentsSummaryApi()); } catch { /* el botón sigue funcionando sin contador */ }
  }, [userId]);

  useEffect(() => {
    loadSummary();
    // El backend cuenta solo citas vigentes; consultarlo cada minuto (y al volver a la pestaña)
    // hace que el contador baje solo cuando una cita pasa, vence sin respuesta o se cancela.
    const interval = window.setInterval(loadSummary, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') loadSummary(); };
    window.addEventListener(APPOINTMENTS_UPDATED_EVENT, loadSummary);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(APPOINTMENTS_UPDATED_EVENT, loadSummary);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadSummary]);

  const setOpen = (open) => {
    const next = new URLSearchParams(searchParams);
    next.delete('cita');
    if (open) next.set('citas', 'abrir'); else next.delete('citas');
    setSearchParams(next, { replace: true });
  };

  const toAnswer = summary?.taller?.porResponder ?? 0;
  const current = (summary?.taller?.porResponder ?? 0) + (summary?.taller?.aceptadas ?? 0)
    + (summary?.cliente?.pendientes ?? 0) + (summary?.cliente?.aceptadas ?? 0);
  const badge = toAnswer > 0 ? toAnswer : current;
  const label = toAnswer > 0
    ? `Mis citas: ${toAnswer} por responder`
    : current > 0 ? `Mis citas: ${current} vigentes` : 'Mis citas';

  return (
    <>
      <button
        type="button"
        className="profile-bell-button profile-appointments-button"
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
      >
        <CalendarClock size={18} />
        {badge > 0 && (
          <span className={`profile-bell-count ${toAnswer > 0 ? 'is-pending' : 'is-neutral'}`}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
      {isOpen && (
        <MyAppointmentsHub
          initialSegment={segmentParam === 'recibidas' ? 'recibidas' : segmentParam === 'pedidas' ? 'pedidas' : undefined}
          focusAppointmentId={focusId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
