import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { profilePath } from '../../routes/paths';
import { appointmentClientKey } from '../../utils/workshopClients';
import MyAppointmentsHub from './MyAppointmentsHub';
import './ads-wall.css';

/**
 * «Citas del taller»: las citas vigentes (pestaña Citas) y el Historial de citas, con buscador, filtro avanzado y orden.
 * Se cruza con Mi taller › Clientes: el historial se puede filtrar por un cliente (`?vista=historial&cliente=KEY`, desde
 * la flecha del cliente) y cada cita lleva «Ver perfil» hacia ese cliente. Equivale a `mobile/app/workshop-appointments.tsx`.
 */
export default function WorkshopAppointmentsSection() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientKey, setClientKey] = useState(searchParams.get('cliente'));
  const [initialView] = useState(searchParams.get('vista') === 'historial' || searchParams.get('cliente') ? 'history' : 'current');
  const [focusAppointmentId] = useState(searchParams.get('cita'));

  // Los parámetros del enlace se consumen una sola vez, para que recargar o volver no repita el filtro.
  useEffect(() => {
    if (!searchParams.get('cliente') && !searchParams.get('vista') && !searchParams.get('cita')) return;
    const next = new URLSearchParams(searchParams);
    ['cliente', 'vista', 'cita'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div className="profile-panel ads-management-panel">
      <MyAppointmentsHub
        inline
        tabbed
        initialView={initialView}
        initialSegment="recibidas"
        focusAppointmentId={focusAppointmentId}
        clientKey={clientKey}
        onClearClient={() => setClientKey(null)}
        onOpenClient={(appointment) => navigate(`${profilePath('mi_taller')}?tab=clientes&cliente=${encodeURIComponent(appointmentClientKey(appointment))}`)}
      />
    </div>
  );
}
