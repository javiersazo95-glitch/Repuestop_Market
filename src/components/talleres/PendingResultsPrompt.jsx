import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { APPOINTMENTS_UPDATED_EVENT, fetchMyAppointments } from '../../services/talleresStorage';
import { AppointmentResultForm } from './AppointmentResult';
import '../../styles/appointment-result.css';

const when = (appointment) => {
  const date = new Date(`${appointment.date}T12:00:00`);
  const day = Number.isNaN(date.getTime()) ? appointment.date : new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(date);
  return `${day} · ${appointment.time}`;
};

/**
 * Aviso al centro de la pantalla cuando el taller entra y tiene citas terminadas sin resultado. Resume cada una y deja
 * registrar el resultado ahí mismo (se despliega); lo mismo se puede hacer desde la cita en "Citas del taller".
 */
export default function PendingResultsPrompt() {
  const { user, role, isLoggedIn } = useAuth();
  const enabled = isLoggedIn && role === 'WORKSHOP';
  const myId = String(user?.userId ?? user?.id ?? '');
  const [appointments, setAppointments] = useState([]);
  const [dismissed, setDismissed] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try { setAppointments(await fetchMyAppointments()); } catch { /* sin red no se avisa: se reintenta en el próximo ciclo */ }
  }, []);

  useEffect(() => {
    if (!enabled) { setAppointments([]); return undefined; }
    load();
    window.addEventListener(APPOINTMENTS_UPDATED_EVENT, load);
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => { window.removeEventListener(APPOINTMENTS_UPDATED_EVENT, load); window.clearInterval(timer); };
  }, [enabled, load]);

  const pending = useMemo(() => appointments.filter((item) => item.resultPending && String(item.ownerUserId || '') === myId), [appointments, myId]);
  const signature = pending.map((item) => item.id).sort().join(',');
  if (!enabled || pending.length === 0 || dismissed === signature) return null;

  return createPortal(
    <div className="prp-backdrop" role="dialog" aria-modal="true" aria-label="Citas por cerrar">
      <div className="prp">
        <div className="prp-head">
          <span><ClipboardList size={22} /></span>
          <div>
            <h2>{pending.length === 1 ? 'Tienes una cita por cerrar' : `Tienes ${pending.length} citas por cerrar`}</h2>
            <p>Registra el resultado: queda en el historial y el cliente podrá evaluar tu atención.</p>
          </div>
        </div>
        <div className="prp-list">
          {pending.map((item) => {
            const open = openId === item.id;
            return (
              <div key={item.id} className="prp-item">
                <button type="button" className="prp-item-head" aria-expanded={open} onClick={() => setOpenId(open ? null : item.id)}>
                  <span>
                    <strong>{item.customerName || 'Cliente'}</strong>
                    <small>{`${when(item)} · ${item.services?.length ? item.services.join(', ') : item.service}`}</small>
                  </span>
                  <em>{open ? 'Cerrar' : 'Registrar'}</em>
                  {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {open && <div className="prp-item-body"><AppointmentResultForm appointment={item} onDone={() => { setOpenId(null); load(); }} /></div>}
              </div>
            );
          })}
        </div>
        <button type="button" className="prp-later" onClick={() => setDismissed(signature)}>Más tarde</button>
      </div>
    </div>,
    document.body,
  );
}
