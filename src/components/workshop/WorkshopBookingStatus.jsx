import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarCheck, CalendarClock } from 'lucide-react';
import { fetchMiTaller } from '../../services/talleresStorage';
import { daysLeft, getDiagnosticStatus } from '../../services/workshopApi';
import '../talleres/ads-wall.css';

/**
 * Estado del agendamiento en el resumen del taller: «Recibir citas en línea» de Mi taller manda y los días son lo que queda
 * del servicio. Apagado con días vigentes es el caso a avisar: nadie puede agendar y los días se están gastando.
 * Contraparte del encabezado de `mobile/app/(workshop)/index.tsx`. Sin taller aprobado no muestra nada.
 */
export default function WorkshopBookingStatus({ onOpenWorkshop, onOpenService }) {
  const [state, setState] = useState(null); // { enabled, days }

  useEffect(() => {
    let active = true;
    Promise.all([fetchMiTaller(), getDiagnosticStatus()])
      .then(([taller, status]) => { if (active) setState({ enabled: taller?.hasOnlineBooking === true, days: daysLeft(status) }); })
      .catch(() => { /* taller aun sin aprobar: no hay agendamiento que informar */ });
    return () => { active = false; };
  }, []);

  if (!state) return null;
  const { enabled, days } = state;
  const daysText = days === 1 ? '1 día' : `${days} días`;
  const idleWithDays = !enabled && days > 0;

  let Icon = CalendarClock;
  let title = 'Agendamiento apagado';
  let detail = 'Actívalo para recibir citas en línea.';
  let action = onOpenService;
  if (enabled) {
    Icon = CalendarCheck;
    title = 'Agendamiento encendido';
    detail = days > 0 ? `${days === 1 ? 'Te queda' : 'Te quedan'} ${daysText} de citas activas.` : 'Sin días activos: renueva el servicio.';
    action = days > 0 ? onOpenWorkshop : onOpenService;
  } else if (idleWithDays) {
    Icon = AlertTriangle;
    title = 'No se puede agendar contigo';
    detail = `Tienes ${daysText} activos, pero el agendamiento está apagado. Enciéndelo en Mi taller.`;
    action = onOpenWorkshop;
  }

  return (
    <div className="agenda-cfg-row" style={{ marginBottom: 14, background: '#fff' }} role={idleWithDays ? 'alert' : 'status'}>
      <span className="agenda-cfg-row-ic" style={idleWithDays ? { background: '#fff4e0', color: '#b45309' } : undefined}><Icon size={19} /></span>
      <button type="button" className="agenda-cfg-row-main" onClick={action}>
        <span className="agenda-cfg-row-title" style={idleWithDays ? { color: '#b45309' } : enabled ? { color: '#059669' } : undefined}>{title}</span>
        <span className="agenda-cfg-row-summary">{detail}</span>
      </button>
    </div>
  );
}
