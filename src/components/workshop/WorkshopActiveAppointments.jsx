import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { APPOINTMENTS_UPDATED_EVENT, fetchMyAppointments } from '../../services/talleresStorage';
import { AppointmentResultForm } from '../talleres/AppointmentResult';
import '../../styles/workshop-active-appointments.css';

const when = (appointment) => {
  const date = new Date(`${appointment.date}T12:00:00`);
  const day = Number.isNaN(date.getTime()) ? appointment.date : new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(date);
  return `${day} · ${appointment.time}`;
};

/**
 * Lo que el taller tiene entre manos en su dashboard: la cita en curso (se finaliza ahí mismo) y las terminadas sin
 * resultado. Se queda a la vista hasta registrar el resultado, para que no se olvide el diagnóstico.
 */
export default function WorkshopActiveAppointments({ onOpenAppointments }) {
  const { user } = useAuth();
  const myId = String(user?.userId ?? user?.id ?? '');
  const [appointments, setAppointments] = useState([]);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try { setAppointments(await fetchMyAppointments()); } catch { /* sin red se conserva lo último */ }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(APPOINTMENTS_UPDATED_EVENT, load);
    // "En curso" y "terminada" cambian solo con la hora: se revisa cada minuto.
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => { window.removeEventListener(APPOINTMENTS_UPDATED_EVENT, load); window.clearInterval(timer); };
  }, [load]);

  const items = useMemo(
    () => appointments
      .filter((item) => (item.canFinish || item.resultPending) && String(item.ownerUserId || '') === myId)
      .sort((a, b) => Number(Boolean(b.canFinish)) - Number(Boolean(a.canFinish)) || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [appointments, myId],
  );

  if (items.length === 0) return null;

  return (
    <div className="wac" aria-live="polite">
      {items.map((item) => {
        const live = Boolean(item.canFinish);
        const open = openId === item.id;
        return (
          <section key={item.id} className={`wac-card ${live ? 'is-live' : 'is-pending'}`}>
            <div className="wac-head">
              <span className="wac-icon">{live ? <Radio size={22} /> : <ClipboardList size={22} />}</span>
              <div className="wac-copy">
                <span className="wac-kicker">{live ? 'Cita en curso' : 'Resultado pendiente'}</span>
                <strong>{item.customerName || 'Cliente'}</strong>
                <small>{`${when(item)} · ${item.services?.length ? item.services.join(', ') : item.service}`}</small>
                <p>{live ? 'Cuando termines, finaliza la cita y registra el resultado del diagnóstico.' : 'La cita ya terminó: registra el resultado del diagnóstico para cerrarla.'}</p>
              </div>
              <div className="wac-actions">
                <button type="button" className="wac-cta" aria-expanded={open} onClick={() => setOpenId(open ? null : item.id)}>
                  {open ? 'Cerrar' : live ? 'Finalizar cita' : 'Registrar resultado'} {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {onOpenAppointments && <button type="button" className="wac-link" onClick={onOpenAppointments}>Ver en mis citas</button>}
              </div>
            </div>
            {open && <div className="wac-body"><AppointmentResultForm appointment={item} onDone={() => { setOpenId(null); load(); }} /></div>}
          </section>
        );
      })}
    </div>
  );
}
