import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchMyAds, fetchMyAppointments, fetchPublicAd, APPOINTMENTS_UPDATED_EVENT
} from '../../services/adsStorage';
import { isAppointmentCurrent } from '../../utils/appointmentHistory';
import AppointmentsHistoryModal from './AppointmentsHistoryModal';
import AdAppointmentModal from './AdAppointmentModal';
import './ads-wall.css';

/**
 * "Mis citas": la gestión de citas disponible para cualquier cuenta, sin pasar por Gestión de
 * anuncios. Un cliente que solo reserva horas no tenía dónde verlas (el panel de anuncios es del
 * taller), y es el destino de las notificaciones de cita.
 *
 * Carga por su cuenta las citas de la sesión y los anuncios propios (para saber cuáles son
 * "recibidas"); un fallo al pedir los anuncios no deja sin citas a quien no publica.
 */
export default function MyAppointmentsHub({ onClose, initialSegment, focusAppointmentId = null }) {
  const { user } = useAuth();
  const sessionUserId = user?.userId ?? user?.id ?? user?.buyerId ?? null;
  const [ads, setAds] = useState([]);
  const [adsLoaded, setAdsLoaded] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [rebookState, setRebookState] = useState(null); // { ad, appointmentId }

  const loadAppointments = useCallback(async () => {
    try {
      setAppointments(await fetchMyAppointments());
    } catch {
      /* la vista dice que no hay citas; el botón de la campana vuelve a intentarlo */
    }
  }, []);

  useEffect(() => {
    loadAppointments();
    fetchMyAds()
      .then(setAds)
      .catch(() => setAds([]))
      .finally(() => setAdsLoaded(true));
    window.addEventListener(APPOINTMENTS_UPDATED_EVENT, loadAppointments);
    return () => window.removeEventListener(APPOINTMENTS_UPDATED_EVENT, loadAppointments);
  }, [loadAppointments]);

  const handleRebook = async (appointment) => {
    try {
      const ad = await fetchPublicAd(appointment.adId);
      setRebookState({ ad, appointmentId: isAppointmentCurrent(appointment) ? appointment.id : null });
    } catch {
      window.alert('El anuncio de esta cita ya no está publicado, así que no se puede reservar otra hora.');
    }
  };

  return (
    <>
      <AppointmentsHistoryModal
        ads={ads}
        adsLoaded={adsLoaded}
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
        <AdAppointmentModal
          adOrCompany={rebookState.ad}
          onBooked={loadAppointments}
          onClose={() => setRebookState(null)}
          isRescheduling={Boolean(rebookState.appointmentId)}
          rescheduleFromId={rebookState.appointmentId}
        />
      )}
    </>
  );
}
