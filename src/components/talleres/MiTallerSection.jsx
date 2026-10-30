import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Wrench, Eye, CalendarClock, RefreshCw, ChevronRight, Lock, ShieldCheck
} from 'lucide-react';
import { fetchMyAppointments, APPOINTMENTS_UPDATED_EVENT } from '../../services/talleresStorage';
import {
  isAppointmentCurrent, summarizeAppointmentsByRole
} from '../../utils/appointmentHistory';
import { useAuth } from '../../context/AuthContext';
import { profilePath, tallerPath } from '../../routes/paths';
import ShareLinkButton from '../ShareLinkButton';
import { useAutomotiveAccreditation } from '../../hooks/useAutomotiveAccreditation';
import { AccreditationPill } from './AccreditationPill';
import AccreditationModal from './AccreditationModal';
import AppointmentsHistoryModal from './AppointmentsHistoryModal';
import BookingModal from './BookingModal';
import CapturerContactCard from '../CapturerContactCard';
import NextStepsBanner from './NextStepsBanner';
import AgendaConfigModal from './AgendaConfigModal';
import MyAppointmentsHub from './MyAppointmentsHub';
import TallerProfileEditor from './TallerProfileEditor';
import { fetchTaller } from '../../services/talleresStorage';
import { getAgendaConfigs } from '../../services/agendaConfigsStorage';
import { createDefaultAgendaConfig, PRINCIPAL_AGENDA_ID, PRINCIPAL_AGENDA_NAME } from '../../data/agendaConfig';
import './ads-wall.css';

// Mensaje del gate segun el estado del expediente de servicio automotriz: el perfil publico
// exige el expediente APROBADO (lo valida `TallerPerfilService` en el backend).
const ACCREDITATION_GATE_MESSAGE = {
  SIN_SOLICITUD: 'Acredita tu servicio automotriz para aparecer en el buscador de talleres.',
  PENDIENTE: 'Tu acreditación está en revisión. Podrás completar tu perfil cuando quede aprobada.',
  POR_CORREGIR: 'Tu acreditación tiene observaciones. Corrígelas para poder publicar tu perfil.',
  RECHAZADO: 'Tu acreditación fue rechazada. Revisa las observaciones y vuelve a enviarla.'
};

/**
 * "Mi taller": el panel del taller. Reúne su acreditación, el perfil que ven los clientes (el que
 * reemplazó al anuncio), su horario y la gestión de citas.
 */
/**
 * La pestaña `mi_taller` segun la cuenta. El comprador no acredita talleres (el backend solo lo permite a la cuenta Taller):
 * ve «Mis citas», las horas que agendo, igual que `mobile/app/my-workshop.tsx`.
 */
export default function MiTallerSection() {
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  if (role === 'BUYER') {
    return (
      <div className="profile-panel ads-management-panel">
        {/* `?cita=ID` (desde una notificacion) resalta esa cita en la lista. */}
        <MyAppointmentsHub inline customerOnly initialSegment="pedidas" focusAppointmentId={searchParams.get('cita')} />
      </div>
    );
  }
  return <WorkshopSection />;
}

function WorkshopSection() {
  const { user } = useAuth();
  const accreditation = useAutomotiveAccreditation(Boolean(user));
  const [isAccreditationOpen, setIsAccreditationOpen] = useState(false);
  const [principalAgenda, setPrincipalAgenda] = useState(null); // { config, exists } | null
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState('perfil'); // 'perfil' | 'citas'
  const [rebookState, setRebookState] = useState(null); // { taller, appointment, appointmentId } | null
  const [isLoading, setIsLoading] = useState(true);
  const [profileKey, setProfileKey] = useState(0);

  const tallerId = accreditation.isApproved && accreditation.record?.id ? String(accreditation.record.id) : null;
  const myTaller = tallerId ? { id: tallerId } : null;

  const loadAppointments = useCallback(async ({ signal } = {}) => {
    try {
      setAppointments(await fetchMyAppointments({ signal }));
    } catch (error) {
      if (error?.name === 'AbortError') return;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAppointments({ signal: controller.signal });
    return () => controller.abort();
  }, [loadAppointments]);

  // Una accion sobre una cita o una notificacion de cita recargan la lista.
  useEffect(() => {
    const reload = () => loadAppointments();
    window.addEventListener(APPOINTMENTS_UPDATED_EVENT, reload);
    return () => window.removeEventListener(APPOINTMENTS_UPDATED_EVENT, reload);
  }, [loadAppointments]);

  const sessionUserId = user?.userId ?? user?.id ?? user?.buyerId ?? null;

  // Se recalcula cada minuto: una cita que empieza sin respuesta, termina o se cancela deja de
  // contar sin tener que pulsar Actualizar.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const appointmentSummary = useMemo(
    () => summarizeAppointmentsByRole(appointments, sessionUserId, now),
    [appointments, sessionUserId, now]
  );
  const pendingReceived = appointmentSummary.provider.pending;
  const upcomingAppointmentsCount = appointmentSummary.provider.current + appointmentSummary.customer.current;

  const replaceAppointment = (saved) => {
    setAppointments((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  };

  const gateMessage = ACCREDITATION_GATE_MESSAGE[accreditation.status] || ACCREDITATION_GATE_MESSAGE.SIN_SOLICITUD;

  const openPrincipalAgenda = useCallback(async () => {
    const configs = await getAgendaConfigs().catch(() => []);
    const existing = configs.find((config) => config.id === PRINCIPAL_AGENDA_ID);
    setPrincipalAgenda({
      config: existing || { ...createDefaultAgendaConfig(), id: PRINCIPAL_AGENDA_ID, name: PRINCIPAL_AGENDA_NAME },
      exists: Boolean(existing),
    });
  }, []);

  // Enlaces del correo / notificacion de aprobacion (`?seccion=agenda`). Se consumen una sola vez.
  useEffect(() => {
    const seccion = searchParams.get('seccion');
    if (!seccion) return;
    if (accreditation.isLoading) return;
    if (seccion === 'agenda' && accreditation.onboarding && !accreditation.onboarding.agendaLista) openPrincipalAgenda();
    const next = new URLSearchParams(searchParams);
    next.delete('seccion');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, accreditation.isLoading, accreditation.onboarding, openPrincipalAgenda]);

  // Enlaces de las citas (boton del calendario y notificaciones): `?citas=abrir|recibidas|pedidas&cita=ID` abre la
  // pestaña Citas, en esa bandeja y con la cita resaltada. Se consumen una sola vez.
  const [focusCitaId, setFocusCitaId] = useState(null);
  const [citasSegment, setCitasSegment] = useState(undefined);
  useEffect(() => {
    const citas = searchParams.get('citas');
    if (!citas) return;
    setActiveTab('citas');
    setFocusCitaId(searchParams.get('cita'));
    setCitasSegment(citas === 'recibidas' || citas === 'pedidas' ? citas : undefined);
    const next = new URLSearchParams(searchParams);
    next.delete('citas');
    next.delete('cita');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleRebook = async (appointment) => {
    try {
      const taller = await fetchTaller(appointment.tallerId);
      // Solo una cita vigente se cambia de hora; desde una cancelada o pasada es una reserva nueva.
      setRebookState({ taller, appointment, appointmentId: isAppointmentCurrent(appointment) ? appointment.id : null });
    } catch {
      setRebookState(null);
      window.alert('El taller de esta cita ya no está publicado, así que no se puede reservar otra hora.');
    }
  };

  const hasAgenda = Boolean(accreditation.onboarding?.agendaLista);
  // Los servicios tienen su propia vista, con vuelta a Mi taller. `isNew` la abre con el formulario de uno nuevo.
  const openServices = (isNew = false) => navigate(`${profilePath('servicios_taller')}${isNew === true ? '?nuevo=1' : ''}`);
  const publicProfile = tallerId && accreditation.onboarding?.perfilPublicado
    ? tallerPath({ id: tallerId, name: accreditation.businessName })
    : null;

  return (
    <div className="profile-panel ads-management-panel">
      <div className="ads-mgmt-header">
        <div className="ads-mgmt-header-main">
          <div className="ads-mgmt-titles-row">
            <div className="ads-mgmt-titles">
              <h2>
                <span className="ads-mgmt-h2-ic"><Wrench size={20} /></span>
                Mi taller
              </h2>
              <p>
                Muestra tus servicios con precio, recibe reservas de hora y responde a tus
                clientes, todo desde un solo lugar.
              </p>
            </div>

            <div className="ads-mgmt-titles-actions">
              <div className="ads-mgmt-actions-row">
                <button
                  type="button"
                  className="ads-mgmt-refresh"
                  onClick={() => { loadAppointments(); accreditation.refresh(); }}
                  disabled={isLoading}
                  title="Volver a consultar el estado de la acreditación y las reservas"
                >
                  <RefreshCw size={15} className={isLoading ? 'spin-icon' : ''} />
                  <span>Actualizar</span>
                </button>

                {/* Estado del expediente de servicio automotriz, compacto: es el requisito para
                    aparecer en el buscador. */}
                {!accreditation.isLoading && (
                  <AccreditationPill
                    status={accreditation.status}
                    businessName={accreditation.businessName}
                    reviewNotes={accreditation.reviewNotes}
                    profile={accreditation.profile}
                    onOpen={() => setIsAccreditationOpen(true)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <CapturerContactCard capturer={user?.captadorPublicidad} context="ads" />
      </div>

      {accreditation.isApproved && (
        <NextStepsBanner
          onboarding={accreditation.onboarding}
          onOpenAgenda={openPrincipalAgenda}
          onOpenProfile={() => openServices()}
        />
      )}

      {/* Accesos rápidos, equivalente web de las "action tiles" de la app. */}
      <div className="ads-mgmt-tiles is-compact">
        {publicProfile ? (
          <Link className="ads-tile" to={publicProfile}>
            <span className="ads-tile-ic"><Eye size={18} /></span>
            <span className="ads-tile-body">
              <strong>Ver mi perfil público</strong>
              <em>Así te ven los clientes</em>
            </span>
            <ChevronRight size={15} className="ads-tile-arrow" />
          </Link>
        ) : (
          <button type="button" className="ads-tile is-locked" disabled title="Publica al menos un servicio para aparecer en el buscador">
            <span className="ads-tile-ic"><Lock size={16} /></span>
            <span className="ads-tile-body">
              <strong>Mi perfil público</strong>
              <em>{accreditation.isApproved ? 'Publica un servicio para activarlo' : 'Acredita tu servicio primero'}</em>
            </span>
          </button>
        )}

        {publicProfile && (
          <ShareLinkButton
            className="ads-tile"
            url={publicProfile}
            title={accreditation.businessName}
            text={`${accreditation.businessName} · Talleres RepuesTop`}
            label="Compartir mi perfil"
          />
        )}
      </div>

      {activeTab === 'perfil' && !accreditation.isLoading && !accreditation.isApproved && (
        <div className="ads-mgmt-state is-locked-note">
          <ShieldCheck size={22} />
          <p>{gateMessage}</p>
          <button type="button" className="btn-post-ad" onClick={() => setIsAccreditationOpen(true)}>
            <Lock size={14} /> Acreditar mi servicio
          </button>
        </div>
      )}

      {/* Mi perfil y Citas, como las pestañas de la app. */}
      <div className="taller-editor__tabs" role="tablist" aria-label="Mi taller">
        <button type="button" role="tab" aria-selected={activeTab === 'perfil'} className={activeTab === 'perfil' ? 'is-active' : ''} onClick={() => setActiveTab('perfil')}>
          <Wrench size={15} /> Mi perfil
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'citas'} className={activeTab === 'citas' ? 'is-active' : ''} onClick={() => setActiveTab('citas')}>
          <CalendarClock size={15} /> Citas
          {pendingReceived > 0 ? <i aria-label={`${pendingReceived} por responder`}>{pendingReceived}</i> : upcomingAppointmentsCount > 0 ? <i>{upcomingAppointmentsCount}</i> : null}
        </button>
      </div>

      {activeTab === 'citas' && (
        <AppointmentsHistoryModal
          inline
          myTaller={myTaller}
          tallerLoaded={!accreditation.isLoading}
          appointments={appointments}
          sessionUserId={sessionUserId}
          userEmail={user?.email || ''}
          initialSegment={citasSegment}
          focusAppointmentId={focusCitaId}
          onClose={() => setActiveTab('perfil')}
          onAppointmentUpdated={replaceAppointment}
          onRebook={handleRebook}
        />
      )}

      {activeTab === 'perfil' && accreditation.isApproved && (
        <>
          <TallerProfileEditor
            key={profileKey}
            record={accreditation.record}
            businessName={accreditation.businessName}
            hasAgenda={hasAgenda}
            onOpenServices={openServices}
            only24Hours={Boolean(accreditation.onboarding?.solo24Horas)}
            onOpenAgenda={openPrincipalAgenda}
            onSaved={() => accreditation.refresh()}
          />
        </>
      )}

      {/* Horario principal desde "Próximos pasos": guardarlo cierra el paso de agenda. */}
      <AgendaConfigModal
        isOpen={Boolean(principalAgenda)}
        title="Tu agenda de citas"
        configToEdit={principalAgenda?.config || null}
        allowDelete={false}
        onClose={() => setPrincipalAgenda(null)}
        onSaved={() => { accreditation.refresh(); setProfileKey((key) => key + 1); }}
      />

      {isAccreditationOpen && (
        <AccreditationModal
          user={user}
          onSaved={() => accreditation.refresh()}
          onClose={() => { setIsAccreditationOpen(false); accreditation.refresh(); }}
        />
      )}

      {rebookState && (
        <BookingModal
          taller={rebookState.taller}
          onBooked={() => loadAppointments()}
          onClose={() => setRebookState(null)}
          isRescheduling={Boolean(rebookState.appointmentId)}
          rescheduleFromId={rebookState.appointmentId}
          fromAppointment={rebookState.appointment}
        />
      )}
    </div>
  );
}
