import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAppointmentsSummaryApi } from '../services/api';
import { APPOINTMENTS_UPDATED_EVENT } from '../services/talleresStorage';
import { profilePath } from '../routes/paths';

/**
 * Acceso a las citas en la barra del perfil, junto a la campana, con el contador de citas
 * vigentes (`GET /agendamientos/resumen`: ni pasadas ni canceladas). Si hay
 * solicitudes por responder, el contador las muestra a ellas y en ámbar.
 *
 * 30-oct: las citas viven en una sola página por perfil («Mis citas» del comprador, «Mi taller > Citas» del
 * taller); este botón lleva a ella en vez de abrir una ventana con el mismo contenido. Las notificaciones de
 * cita también aterrizan ahí (`?citas=recibidas|pedidas&cita=ID`).
 */
export default function ProfileAppointmentsButton({ user }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const userId = user?.userId ?? user?.id;

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

  const toAnswer = summary?.taller?.porResponder ?? 0;
  const current = (summary?.taller?.porResponder ?? 0) + (summary?.taller?.aceptadas ?? 0)
    + (summary?.cliente?.pendientes ?? 0) + (summary?.cliente?.aceptadas ?? 0);
  const badge = toAnswer > 0 ? toAnswer : current;
  const label = toAnswer > 0
    ? `Mis citas: ${toAnswer} por responder`
    : current > 0 ? `Mis citas: ${current} vigentes` : 'Mis citas';

  return (
    <button
      type="button"
      className="profile-bell-button profile-appointments-button"
      aria-label={label}
      title={label}
      onClick={() => navigate(`${profilePath('mi_taller')}?citas=abrir`)}
    >
      <CalendarClock size={18} />
      {badge > 0 && (
        <span className={`profile-bell-count ${toAnswer > 0 ? 'is-pending' : 'is-neutral'}`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
