import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchMyAppointments, fetchTaller, APPOINTMENTS_UPDATED_EVENT
} from '../../services/talleresStorage';
import { useAutomotiveAccreditation } from '../../hooks/useAutomotiveAccreditation';
import { isAppointmentCurrent } from '../../utils/appointmentHistory';
import AppointmentsHistoryModal from './AppointmentsHistoryModal';
import BookingModal from './BookingModal';
import './ads-wall.css';

/**
 * "Mis citas": la gestión de citas disponible para cualquier cuenta, sin pasar por Mi taller.
 * Un cliente que solo reserva horas no tenía dónde verlas (Mi taller es del taller), y es el
 * destino de las notificaciones de cita.
 *
 * Carga por su cuenta las citas de la sesión y el taller propio (para saber cuáles son
 * "recibidas"); un fallo al pedir el taller no deja sin citas a quien no lo tiene.
 */
export default function MyAppointmentsHub({ onClose, initialSegment, focusAppointmentId = null, inline = false, customerOnly = false }) {
  const { user } = useAuth();
  const sessionUserId = user?.userId ?? user?.id ?? user?.buyerId ?? null;
  const accreditation = useAutomotiveAccreditation(Boolean(user));
  const myTaller = accreditation.isApproved && accreditation.record?.id ? { id: String(accreditation.record.id) } : null;
  const [appointments, setAppointments] = useState([]);
  const [rebookState, setRebookState] = useState(null); // { taller, appointment, appointmentId }

  const loadAppointments = useCallback(async () => {
    try {
      setAppointments(await fetchMyAppointments());
    } catch {
      /* la vista dice que no hay citas; el botón de la campana vuelve a intentarlo */
    }
  }, []);

  useEffect(() => {
    loadAppointments();
    window.addEventListener(APPOINTMENTS_UPDATED_EVENT, loadAppointments);
    return () => window.removeEventListener(APPOINTMENTS_UPDATED_EVENT, loadAppointments);
  }, [loadAppointments]);

  const handleRebook = async (appointment) => {
    try {
      const taller = await fetchTaller(appointment.tallerId);
      setRebookState({ taller, appointment, appointmentId: isAppointmentCurrent(appointment) ? appointment.id : null });
    } catch {
      window.alert('El taller de esta cita ya no está publicado, así que no se puede reservar otra hora.');
    }
  };

  return (
    <>
      <AppointmentsHistoryModal
        inline={inline}
        customerOnly={customerOnly}
        myTaller={myTaller}
        tallerLoaded={!accreditation.isLoading}
        appointments={appointments}
        sessionUserId={sessionUserId}
        userEmail={user?.email || ''}
        initialSegment={initialSegment}
        focusAppointmentId={focusAppointmentId}
        onClose={onClose}
        onAppointmentUpdated={(saved) =>
          setAppointments((current) => current.map((item) => (item.id === saved.id ? saved : item)))}
        onRebook={handleRebook}
      />
      {rebookState && (
        <BookingModal
          taller={rebookState.taller}
          onBooked={loadAppointments}
          onClose={() => setRebookState(null)}
          isRescheduling={Boolean(rebookState.appointmentId)}
          rescheduleFromId={rebookState.appointmentId}
          fromAppointment={rebookState.appointment}
        />
      )}
    </>
  );
}
