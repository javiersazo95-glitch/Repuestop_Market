import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, Car, CheckCircle2, X, AlertCircle, MapPin, Loader2, LogIn, Clock, Phone, Mail,
  ChevronLeft, ChevronRight, Check, Lock, Info, User, Tag, LifeBuoy,
  Home, MessageCircle, StickyNote, Wrench } from 'lucide-react';
import { confirmWhatsappContact } from '../../utils/whatsappContact';
import { useAuth } from '../../context/AuthContext';
import AddressAutocompleteInput from '../AddressAutocompleteInput';
import { useTallerOwnership } from './useTallerOwnership';
import {
  normalizeAgendaConfig, getUpcomingAgendaDates, getAgendaSlotsForDate,
  getAgendaSummaryText, formatAgendaDateLong, formatAgendaMonthLabel, parseIsoDate, toIsoDate,
  weekdayIndexFromDate, WEEKDAYS
} from '../../data/agendaConfig';
import { blocksAppointmentSlot } from '../../data/talleresData';
import { getAppointmentChangeDeadline } from '../../utils/appointmentHistory';
import { searchVehicleByPatenteApi } from '../../services/api';
import { isValidPlate, normalizePlate } from '../../utils/quoteFlow';

const WIZARD_STEPS = ['Fecha', 'Hora', 'Datos'];

/** "Toyota Yaris 2020", listo para el campo de marca, modelo y año. */
function vehicleLabel(vehicle) {
  return [vehicle?.marca, vehicle?.modelo, vehicle?.anio > 0 ? String(vehicle.anio) : '']
    .filter(Boolean).join(' ').trim();
}
import {
  fetchTallerAppointments, createTallerAppointment, rescheduleAppointment, notifyAppointmentCreated
} from '../../services/talleresStorage';
import { apiErrorMessage } from '../../services/walletStorage';

/**
 * Reserva de hora en un taller con agenda en línea.
 *
 * Hasta la fase B este formulario no llamaba a nada: inventaba un codigo de
 * reserva con `Math.random()` y mostraba la pantalla de exito. Ahora escribe
 * contra `POST /agendamientos/talleres/{id}`.
 *
 * Tres reglas del backend que la UI tiene que respetar ANTES de enviar, porque
 * todas terminan en un 400 despues de llenar el formulario entero:
 *
 * 1. hay que tener sesion iniciada: la cita se guarda a nombre del usuario del
 *    token y el correo del cliente se toma de ahi, no del formulario.
 * 2. no se puede reservar en el propio taller.
 * 3. el bloque tiene que pertenecer al horario publicado y estar libre. Los
 *    bloques se calculan con la misma logica que `validarBloque()`
 *    (`src/data/agendaConfig.js`) y los ocupados se leen del backend.
 */
/**
 * `rescheduleFromId`: cita vigente que se está cambiando de hora. Con ella el backend cancela
 * la anterior y crea la nueva en una sola operación (antes eran dos llamadas desde aquí, y si
 * la cancelación fallaba quedaban las dos).
 *
 * `fromAppointment`: la cita de la que se parte al reagendar o reservar otra hora. Precarga el
 * servicio, el teléfono, el vehículo y la descripción: "Cambia la hora de tu cita" pedía todo
 * de nuevo y, si no se reescribía, la cita nueva perdía la descripción (pruebas E2E, 5-oct).
 */
const HOME_SERVICE_PREFIX = 'Servicio a domicilio. Dirección del servicio: ';
/** Largo del comentario "¿Qué necesitas?" (el backend acepta más, pero un motivo corto se lee de un vistazo). */
const MAX_REASON_LENGTH = 300;

export default function BookingModal({ taller, onClose, onBooked, isRescheduling = false, rescheduleFromId = null, fromAppointment: fromAppointmentProp = null, fallaContext = null, initialService = null }) {
  const { user, role } = useAuth();
  // Las citas las piden los compradores: una cuenta de taller las recibe, pero no las solicita.
  const isWorkshopAccount = role === 'WORKSHOP';
  // Desde el diagnostico de una falla la cita parte con el vehiculo y el motivo ya cargados: se reusa
  // el mismo precargado que "reservar otra hora" (el servicio es el diagnostico de esa falla).
  const fromAppointment = fromAppointmentProp || (fallaContext ? {
    vehiclePatent: fallaContext.patente || '',
    vehicleModel: fallaContext.vehiculo || '',
  } : null);
  const { isOwn } = useTallerOwnership();
  const previousNoteLines = String(fromAppointment?.notes || '').split('\n');
  // Citas antiguas guardaban la dirección dentro de las notas; las nuevas traen campos propios.
  const previousHomeLine = previousNoteLines.find((line) => line.startsWith(HOME_SERVICE_PREFIX)) || '';
  const previousHomeAddress = fromAppointment?.homeService
    ? (fromAppointment.homeAddress || '')
    : previousHomeLine.slice(HOME_SERVICE_PREFIX.length);
  // La ranura "a domicilio" solo existe si el taller lo ofrece (`homeService`).
  const offersHomeService = taller?.homeService === true;

  const [step, setStep] = useState('form'); // 'form' | 'confirm' | 'success'
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [dataConfirmed, setDataConfirmed] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [bookedSlots, setBookedSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [userName, setUserName] = useState(fromAppointment?.customerName || user?.userName || user?.nombre || '');
  const [userPhone, setUserPhone] = useState(fromAppointment?.customerPhone || user?.phone || user?.telefono || '');
  const [vehiclePatent, setVehiclePatent] = useState(fromAppointment?.vehiclePatent || '');
  const [vehicleModel, setVehicleModel] = useState(fromAppointment?.vehicleModel || '');
  // "¿Qué necesitas?": servicios del catálogo del taller (el backend rechaza uno ajeno) y un comentario
  // libre. Ambos opcionales; sin ellos la cita llega al taller como "Cita general". Al reagendar o llegar
  // desde la fila de un servicio parten precargados.
  const offeredServices = useMemo(
    () => (taller?.services || []).map((service) => service?.name).filter(Boolean),
    [taller?.services]
  );
  const [selectedServices, setSelectedServices] = useState(() => {
    const wanted = [...(fromAppointment?.services || []), initialService].filter(Boolean);
    return offeredServices.filter((name) => wanted.some((item) => String(item).toLowerCase() === name.toLowerCase()));
  });
  const [reason, setReason] = useState(() => previousNoteLines
    .filter((line) => line.trim() && !line.startsWith(HOME_SERVICE_PREFIX) && !line.startsWith('Falla: '))
    .join('\n').slice(0, MAX_REASON_LENGTH));
  const toggleService = (name) => setSelectedServices((current) => (
    current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  // Detección por patente, igual que en la app: 'idle' | 'searching' | 'found' | 'not-found'.
  const [plateLookup, setPlateLookup] = useState('idle');
  // Con patente y vehículo precargados no se vuelve a consultar la patente (cada consulta nueva cuesta).
  const [detectedPlate, setDetectedPlate] = useState(() => (
    fromAppointment?.vehiclePatent && fromAppointment?.vehicleModel ? normalizePlate(fromAppointment.vehiclePatent) : ''));
  // Último texto que puso la detección: se reemplaza si cambia la patente, pero no lo que
  // haya escrito el usuario.
  const autoFilledVehicle = useRef('');
  // Solo hace falta si el taller va donde está el vehículo (igual que en la app).
  const [serviceAddress, setServiceAddress] = useState(previousHomeAddress);
  // Ranura "Servicio a domicilio" (igual que la app): apagada por defecto; al activarla se pide la dirección.
  const [atHomeChoice, setAtHome] = useState(Boolean(fromAppointment?.homeService || previousHomeLine));
  const atHome = offersHomeService && atHomeChoice;
  const homeAddress = atHome ? serviceAddress.trim() : '';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);

  /**
   * Al escribir una patente válida se consulta el vehículo (mismo endpoint que el buscador por
   * patente) y se completa "Marca, modelo y año". Si no se encuentra, el campo queda para
   * llenarlo a mano.
   */
  useEffect(() => {
    const plate = normalizePlate(vehiclePatent);
    if (!isValidPlate(plate)) {
      setPlateLookup('idle');
      return undefined;
    }
    if (plate === detectedPlate) {
      setPlateLookup('found');
      return undefined;
    }

    let active = true;
    setPlateLookup('searching');
    const timer = window.setTimeout(() => {
      searchVehicleByPatenteApi(plate)
        .then((vehicle) => {
          if (!active) return;
          const label = vehicleLabel(vehicle);
          if (!vehicle?.marca || !label) {
            setPlateLookup('not-found');
            return;
          }
          setDetectedPlate(plate);
          setPlateLookup('found');
          setVehicleModel((current) => (
            !current.trim() || current === autoFilledVehicle.current ? label : current
          ));
          autoFilledVehicle.current = label;
        })
        .catch(() => { if (active) setPlateLookup('not-found'); });
    }, 600);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [vehiclePatent, detectedPlate]);

  const tallerId = taller?.id;
  const isOwnTaller = taller ? isOwn(taller) : false;
  const isLoggedIn = Boolean(user);

  const agendaConfig = useMemo(
    () => normalizeAgendaConfig(taller?.agendaConfig),
    [taller?.agendaConfig]
  );

  // Dias con atencion, desde mañana. Si el taller no trae agenda no se ofrece
  // ninguna fecha: sin configuracion el backend rechaza cualquier reserva con
  // "El taller no tiene una agenda configurada", asi que inventar bloques de
  // relleno solo llevaria al usuario a un error garantizado.
  const availableDates = useMemo(
    () => (agendaConfig ? getUpcomingAgendaDates(agendaConfig) : []),
    [agendaConfig]
  );

  // Igual que la app: no se elige un día por el usuario; el calendario abre en el mes de la
  // primera fecha con atención y los horarios aparecen al tocar un día.
  const availableDateSet = useMemo(() => new Set(availableDates.map((date) => date.iso)), [availableDates]);
  useEffect(() => {
    if (availableDates.length === 0) return;
    const first = parseIsoDate(availableDates[0].iso);
    if (first) setMonthCursor(new Date(first.getFullYear(), first.getMonth(), 1));
  }, [availableDates]);

  const monthCells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const leading = weekdayIndexFromDate(new Date(year, month, 1));
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array.from({ length: leading }, () => null);
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const iso = toIsoDate(new Date(year, month, dayNumber));
      cells.push({ iso, dayNumber, isOpen: availableDateSet.has(iso) });
    }
    return cells;
  }, [monthCursor, availableDateSet]);

  /**
   * Bloques ya tomados del dia elegido.
   *
   * La misma ruta que el dueño usa para su agenda devuelve, a un visitante, solo
   * las reservas futuras vigentes y con los datos personales censurados. Un
   * `rejected` o `cancelled` libera el horario, igual que en el backend
   * (`OCUPADOS` de `AgendamientoService`).
   */
  const loadBookedSlots = useCallback(async ({ signal } = {}) => {
    if (!tallerId || !appointmentDate) { setBookedSlots([]); return; }
    setIsLoadingSlots(true);
    try {
      const list = await fetchTallerAppointments(tallerId, { signal });
      setBookedSlots(
        list
          .filter((item) => item.date === appointmentDate && blocksAppointmentSlot(item.status))
          .map((item) => item.time)
      );
    } catch (error) {
      if (error?.name === 'AbortError') return;
      // Sin disponibilidad confirmada se muestran todos los bloques: el backend
      // vuelve a chequear al confirmar y responde 409 si el bloque ya se tomo.
      setBookedSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [tallerId, appointmentDate]);

  useEffect(() => {
    const controller = new AbortController();
    loadBookedSlots({ signal: controller.signal });
    return () => controller.abort();
  }, [loadBookedSlots]);

  const availableSlots = useMemo(() => {
    if (!appointmentDate || !agendaConfig) return [];
    return getAgendaSlotsForDate(agendaConfig, appointmentDate)
      .filter((slot) => !bookedSlots.includes(slot.label));
  }, [agendaConfig, appointmentDate, bookedSlots]);

  // Cambiar de dia invalida el bloque elegido para el dia anterior.
  useEffect(() => {
    setAppointmentTime((current) =>
      availableSlots.some((slot) => slot.label === current) ? current : '');
  }, [availableSlots]);

  // Limpia el aviso de campos faltantes apenas el usuario empieza a corregirlo,
  // para que no quede un mensaje obsoleto mientras completa el formulario.
  //
  // Va aca arriba y no despues del `return null`: ahi quedaba condicionado a que
  // hubiera taller, y el render sin taller registraba un hook menos que el resto
  // ("Rendered fewer hooks than expected", que revienta la pantalla entera). Solo
  // depende de estado local, asi que subirlo no cambia cuando corre.
  useEffect(() => {
    setSubmitError('');
  }, [appointmentDate, appointmentTime, userName, userPhone, vehicleModel, dataConfirmed, atHome, serviceAddress]);

  if (!taller) return null;

  const originLabel = fallaContext ? 'Diagnóstico en fallas automotrices' : 'Perfil del taller';
  const accountEmail = user?.email || '';
  const currentStep = !appointmentDate ? 1 : (!appointmentTime ? 2 : 3);
  const shiftMonth = (delta) =>
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const dateLabel = appointmentDate ? formatAgendaDateLong(appointmentDate) : '';
  // Una hora a menos de 24 horas queda fija apenas se reserva (regla del 13-oct).
  const changeDeadline = appointmentDate && appointmentTime ? getAppointmentChangeDeadline({ date: appointmentDate, time: appointmentTime }) : null;
  const slotWithinChangeLock = Boolean(changeDeadline && changeDeadline.getTime() <= Date.now());

  // Lista de campos obligatorios del formulario aun sin completar, en el orden
  // en que aparecen. Se usa para decirle al usuario exactamente que falta en
  // vez de solo deshabilitar el boton sin explicacion.
  const getMissingFieldLabels = () => {
    const missing = [];
    if (!appointmentDate) missing.push('el día de la cita');
    if (!appointmentTime) missing.push('el bloque horario');
    if (!userName.trim()) missing.push('tu nombre completo');
    if (!userPhone.trim()) missing.push('tu teléfono de contacto');
    if (!vehicleModel.trim()) missing.push('la marca y el modelo de tu vehículo');
    if (atHome && !serviceAddress.trim()) missing.push('la dirección del servicio a domicilio');
    if (!dataConfirmed) missing.push('confirmar que tus datos son correctos');
    return missing;
  };

  const canSubmit = isLoggedIn && !isOwnTaller && !isWorkshopAccount && agendaConfig
    && appointmentDate && appointmentTime
    && userName.trim() && userPhone.trim() && vehicleModel.trim() && dataConfirmed
    && (!atHome || serviceAddress.trim());

  /** Valida el formulario y abre el resumen previo a confirmar, como en la app. */
  const handleReview = (event) => {
    event.preventDefault();
    if (!canSubmit) {
      const missing = getMissingFieldLabels();
      setSubmitError(
        missing.length > 0
          ? `Antes de continuar, completa: ${missing.join(', ')}.`
          : 'Revisa el formulario.'
      );
      return;
    }
    setSubmitError('');
    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!canSubmit) {
      const missing = getMissingFieldLabels();
      setSubmitError(
        missing.length > 0
          ? `Antes de ${isRescheduling ? 'reagendar' : 'confirmar'}, completa: ${missing.join(', ')}.`
          : `No se pudo ${isRescheduling ? 'reagendar' : 'confirmar'} la cita. Revisa el formulario.`
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const form = {
        service: 'Cita general',
        services: selectedServices,
        date: appointmentDate,
        time: appointmentTime,
        customerName: userName.trim(),
        customerPhone: userPhone.trim(),
        customerEmail: accountEmail,
        vehiclePatent: vehiclePatent.trim(),
        vehicleModel: vehicleModel.trim(),
        notes: reason.trim(),
        // Campos propios (igual que la app): el backend valida que el taller ofrezca
        // domicilio y exige la dirección.
        homeService: atHome,
        homeAddress,
        fallaId: fallaContext?.id ?? null
      };
      const appointment = rescheduleFromId
        ? await rescheduleAppointment(rescheduleFromId, form)
        : await createTallerAppointment(tallerId, form);

      setConfirmedAppointment(appointment);
      setStep('success');
      onBooked?.(appointment);

      // Correo de resumen para ambos, sin await: la reserva ya esta guardada. La notificacion
      // dentro de la plataforma la crea el backend junto con la reserva.
      notifyAppointmentCreated({ appointment, taller, dateLabel });
    } catch (error) {
      setSubmitError(apiErrorMessage(error, 'No se pudo reservar el horario. Elige otro bloque.'));
      setStep('form');
      // El bloque pudo haberse tomado mientras se llenaba el formulario (409):
      // se recarga la disponibilidad para que el elegido desaparezca de la lista.
      loadBookedSlots();
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBlockedState = (icon, title, message) => (
    <div className="booking-blocked-state">
      {icon}
      <h4>{title}</h4>
      <p>{message}</p>
      <button type="button" className="btn-ad-phone" onClick={onClose}>Entendido</button>
    </div>
  );

  const headerTitle = step === 'confirm'
    ? (isRescheduling ? 'Confirma el cambio' : 'Confirma tu cita')
    : (isRescheduling ? 'Cambia la hora de tu cita' : 'Agenda tu cita');

  const VoucherRow = ({ label, value, mono = false }) => (
    <div className="bk-voucher-row">
      <span>{label}</span>
      <strong className={mono ? 'mono' : ''}>{value}</strong>
    </div>
  );

  return createPortal(
    <div
      className="booking-modal-overlay bk-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
    >
      {/* Mismo diseño que el modal de reserva de la app (BookingModal.tsx): hoja inferior en
          celular, tarjeta centrada en escritorio. */}
      <div className="bk-sheet">
        {step !== 'success' && (
          <div className="bk-header">
            {step === 'confirm' ? (
              <button type="button" className="bk-icon-btn" onClick={() => setStep('form')} aria-label="Volver al formulario">
                <ChevronLeft size={20} />
              </button>
            ) : <span className="bk-icon-placeholder" />}
            <h3>{headerTitle}</h3>
            <button type="button" className="bk-icon-btn is-muted" onClick={onClose} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
        )}

        <div className="bk-body">
          {step === 'form' && (
            <>
              {!isLoggedIn && renderBlockedState(
                <LogIn size={30} />,
                'Necesitas iniciar sesión',
                'La reserva queda a nombre de tu cuenta, así puedes revisarla y cancelarla después desde tu perfil. Inicia sesión y vuelve a intentarlo.'
              )}

              {isLoggedIn && isOwnTaller && renderBlockedState(
                <AlertCircle size={30} />,
                'Es tu propio taller',
                'No puedes reservar una hora en tu propio taller. Para ver las reservas que recibiste, abre Mis citas en tu perfil.'
              )}

              {isLoggedIn && !isOwnTaller && isWorkshopAccount && renderBlockedState(
                <AlertCircle size={30} />,
                'Las citas las agendan los compradores',
                'Con una cuenta de taller recibes citas, pero no las solicitas. Para reservar una hora en otro taller, usa una cuenta de comprador.'
              )}

              {isLoggedIn && !isOwnTaller && !isWorkshopAccount && !agendaConfig && renderBlockedState(
                <Clock size={30} />,
                'Este taller no tiene horarios publicados',
                'El taller todavía no configuró su agenda en línea. Vuelve a revisar más adelante.'
              )}

              {isLoggedIn && !isOwnTaller && !isWorkshopAccount && agendaConfig && (
                <form onSubmit={handleReview} className="bk-form">
                  {/* Taller al que se le agenda */}
                  <div className="bk-card bk-provider">
                    <h4>{taller.name}</h4>
                    <span className="bk-provider-row"><MapPin size={14} /> {taller.commune || 'Santiago'}</span>
                  </div>

                  <div className="bk-agenda-hint">
                    <Info size={16} />
                    <span>
                      <small>Origen del agendamiento</small>
                      <span className="bk-origin-options">
                        {['Perfil del taller', 'Diagnóstico en fallas automotrices'].map((option) => (
                          <span key={option} className={`bk-origin-option ${originLabel === option ? 'is-selected' : ''}`}>
                            <span aria-hidden="true">{originLabel === option ? '●' : '○'}</span> {option}
                          </span>
                        ))}
                      </span>
                      {fallaContext?.titulo && <small>{fallaContext.titulo}</small>}
                    </span>
                  </div>

                  {/* Progreso: fecha, luego hora y finalmente datos. */}
                  <div className="bk-card bk-stepper" aria-hidden="true">
                    {WIZARD_STEPS.map((label, index) => {
                      const stepNumber = index + 1;
                      const isDone = currentStep > stepNumber;
                      const isActive = currentStep === stepNumber;
                      return (
                        <React.Fragment key={label}>
                          {index > 0 && <span className={`bk-stepper-line ${currentStep > index ? 'is-done' : ''}`} />}
                          <span className={`bk-stepper-item ${isActive || isDone ? 'is-active' : ''}`}>
                            <span className="bk-stepper-circle">{isDone ? <Check size={13} /> : stepNumber}</span>
                            <span className="bk-stepper-label">{label}</span>
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* 1. Fecha y 2. hora */}
                  <section className="bk-card">
                    <h5 className="bk-section-title"><Calendar size={17} /> Primero elige la fecha</h5>
                    <div className="bk-agenda-hint"><Info size={14} /> {getAgendaSummaryText(agendaConfig)}</div>

                    {availableDates.length === 0 ? (
                      <div className="bk-warn"><AlertCircle size={15} /> Este taller no tiene días disponibles en las próximas semanas.</div>
                    ) : (
                      <>
                        <div className="bk-month">
                          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={17} /></button>
                          <strong>{formatAgendaMonthLabel(monthCursor)}</strong>
                          <button type="button" onClick={() => shiftMonth(1)} aria-label="Mes siguiente"><ChevronRight size={17} /></button>
                        </div>
                        <div className="bk-week">
                          {WEEKDAYS.map((weekday) => <span key={weekday.id}>{weekday.short.charAt(0)}</span>)}
                        </div>
                        <div className="bk-days">
                          {monthCells.map((cell, index) => (cell ? (
                            <button
                              type="button"
                              key={cell.iso}
                              className={`bk-day ${cell.iso === appointmentDate ? 'is-selected' : ''}`}
                              disabled={!cell.isOpen}
                              aria-pressed={cell.iso === appointmentDate}
                              aria-label={formatAgendaDateLong(cell.iso)}
                              onClick={() => setAppointmentDate(cell.iso)}
                            >
                              {cell.dayNumber}
                            </button>
                          ) : <span key={`empty-${index}`} className="bk-day is-empty" />))}
                        </div>

                        <strong className="bk-slots-title">Horarios disponibles</strong>
                        {!appointmentDate ? (
                          <div className="bk-locked-box"><Lock size={15} /> Elige primero el día y aquí aparecerán los horarios disponibles.</div>
                        ) : isLoadingSlots ? (
                          <div className="bk-locked-box"><Loader2 size={15} className="spin-icon" /> Consultando disponibilidad…</div>
                        ) : availableSlots.length === 0 ? (
                          <div className="bk-warn"><AlertCircle size={15} /> No quedan horarios libres para el {dateLabel}. Prueba con otro día.</div>
                        ) : (
                          <div className="bk-slots">
                            {availableSlots.map((slot) => (
                              <button
                                type="button"
                                key={slot.label}
                                className={`bk-slot ${appointmentTime === slot.label ? 'is-selected' : ''}`}
                                aria-pressed={appointmentTime === slot.label}
                                aria-label={slot.label}
                                onClick={() => setAppointmentTime(slot.label)}
                              >
                                {slot.start}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>

                  {/* 3. Datos del cliente */}
                  <section className="bk-card">
                    <h5 className="bk-section-title"><User size={18} /> Completa tus datos</h5>
                    <span className="bk-required"><em aria-hidden="true">*</em> Los campos marcados con asterisco son obligatorios</span>

                    <div className="bk-group">
                      <span className="bk-label">Nombre completo <em aria-hidden="true">*</em></span>
                      <label className="bk-field">
                        <User size={18} />
                        <input type="text" maxLength={160} placeholder="Ej: Camila Prueba" aria-required="true" value={userName} onChange={(e) => setUserName(e.target.value)} />
                      </label>
                    </div>
                    <div className="bk-group">
                      <span className="bk-label">Teléfono de contacto <em aria-hidden="true">*</em></span>
                      <label className="bk-field">
                        <Phone size={18} />
                        <input type="tel" maxLength={40} placeholder="Ej: +56 9 1234 5678" aria-required="true" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} />
                      </label>
                    </div>
                    {/* El correo es el de la cuenta y no se edita: `AgendamientoService.crear()`
                        guarda siempre el de la sesión e ignora lo que venga en el request. */}
                    <div className="bk-group">
                      <span className="bk-label">Correo</span>
                      <label className="bk-field is-locked">
                        <Mail size={18} />
                        <input type="email" value={accountEmail} readOnly disabled aria-label="Correo de tu cuenta" />
                        <Lock size={15} />
                      </label>
                      <small className="bk-helper">Es el correo de tu cuenta. Ahí llega el resumen de la cita.</small>
                    </div>
                    <div className="bk-group">
                    <span className="bk-label">Patente del vehículo <small>Opcional</small></span>
                    <label className="bk-field">
                      <Tag size={18} />
                      <input type="text" maxLength={20} placeholder="Ej: ABCD12" value={vehiclePatent} onChange={(e) => setVehiclePatent(e.target.value.toUpperCase())} />
                      {plateLookup === 'searching' && <Loader2 size={17} className="spin-icon" />}
                      {plateLookup === 'found' && <CheckCircle2 size={17} className="bk-ok" />}
                    </label>
                    </div>
                    {plateLookup === 'searching' && <small className="bk-muted">Buscando el vehículo de esa patente…</small>}
                    {plateLookup === 'found' && vehicleModel.trim() && <div className="bk-plate-found"><Car size={16} /> Vehículo detectado: {vehicleModel}</div>}
                    {plateLookup === 'not-found' && <small className="bk-muted">No pudimos detectar el vehículo de esa patente. Escribe la marca y el modelo.</small>}
                    <div className="bk-group">
                      <span className="bk-label">Marca y modelo del vehículo <em aria-hidden="true">*</em></span>
                      <label className="bk-field">
                        <Car size={18} />
                        <input type="text" maxLength={160} placeholder="Ej: Toyota Yaris 2018" aria-required="true" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
                      </label>
                      <small className="bk-helper">El taller lo usa para confirmar si trabaja con la marca de tu vehículo.</small>
                    </div>
                    {/* "¿Qué necesitas?": sin esto la cita llega como "Cita general" y el taller no sabe de qué se trata. */}
                    {offeredServices.length > 0 && (
                      <div className="bk-group">
                        <span className="bk-label">¿Qué servicio necesitas? <small>Opcional</small></span>
                        <div className="bk-service-chips" role="group" aria-label="Servicios del taller">
                          {offeredServices.map((name) => (
                            <button
                              type="button"
                              key={name}
                              className={`bk-service-chip ${selectedServices.includes(name) ? 'is-selected' : ''}`}
                              aria-pressed={selectedServices.includes(name)}
                              onClick={() => toggleService(name)}
                            >
                              {selectedServices.includes(name) ? <Check size={13} /> : <Wrench size={13} />} {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bk-group">
                      <span className="bk-label">Cuéntale al taller qué necesitas <small>Opcional</small></span>
                      <label className="bk-field is-multiline">
                        <StickyNote size={18} />
                        <textarea
                          rows={3}
                          maxLength={MAX_REASON_LENGTH}
                          placeholder="Ej: Ruido al frenar, quiero una revisión"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <small className="bk-helper">{reason.length}/{MAX_REASON_LENGTH} · El taller lo ve antes de aceptar tu cita.</small>
                    </div>
                    {/* Ranura "Servicio a domicilio": solo en talleres que lo ofrecen. Apagada por
                        defecto; al activarla se despliega la dirección donde está el vehículo, que
                        pasa a ser obligatoria. */}
                    {offersHomeService && (
                    <label className={`bk-home-toggle ${atHome ? 'is-active' : ''}`}>
                      <span className="bk-home-icon"><Home size={17} /></span>
                      <span className="bk-home-text">
                        <strong>¿Quieres el servicio a domicilio?</strong>
                        <small>{atHome
                          ? 'El taller irá a la dirección que indiques.'
                          : `Este taller va donde está tu vehículo${taller?.commune ? ` dentro de ${taller.commune}` : ' dentro de su comuna'}.`}</small>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={atHome}
                        onChange={(e) => setAtHome(e.target.checked)}
                        aria-label="Servicio a domicilio"
                      />
                    </label>
                    )}
                    {atHome && (
                      <div className="bk-group bk-address">
                        <span className="bk-label">Dirección del servicio <em aria-hidden="true">*</em></span>
                        <AddressAutocompleteInput
                          value={serviceAddress}
                          onChange={setServiceAddress}
                          comuna={taller?.commune}
                          region={taller?.region}
                          requireComuna={false}
                          placeholder="Calle y número donde está el vehículo"
                          maxLength={200}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      className={`bk-confirm-check ${dataConfirmed ? 'is-checked' : ''}`}
                      role="checkbox"
                      aria-checked={dataConfirmed}
                      aria-label="Confirmo que los datos ingresados son correctos"
                      onClick={() => setDataConfirmed((current) => !current)}
                    >
                      <span className="bk-checkbox">{dataConfirmed && <Check size={13} />}</span>
                      <span>
                        <strong>Confirmo que los datos ingresados son correctos.</strong>
                        <small>Al continuar, acepto los términos y condiciones del servicio.</small>
                      </span>
                    </button>
                  </section>

                  {submitError && (
                    <div className="ad-form-error">
                      <AlertCircle size={16} />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button type="submit" className={`bk-primary ${!canSubmit ? 'is-incomplete' : ''}`} aria-disabled={!canSubmit}>
                    <Calendar size={18} /> {isRescheduling ? 'Cambiar la hora' : 'Agendar cita'}
                  </button>
                  <p className="bk-footer-note"><Mail size={14} /> Recibirás la confirmación por correo y por notificación</p>
                </form>
              )}
            </>
          )}

          {step === 'confirm' && (
            <div className="bk-form">
              <div className="bk-confirm-intro"><LifeBuoy size={20} /> Revisa que todo esté correcto antes de enviar tu reserva al taller.</div>
              <div className="bk-voucher">
                <VoucherRow label="Origen:" value={originLabel} />
                {selectedServices.length > 0 && <VoucherRow label="Servicio:" value={selectedServices.join(', ')} />}
                {reason.trim() && <VoucherRow label="Detalle:" value={reason.trim()} />}
                <VoucherRow label="Día:" value={dateLabel} />
                <VoucherRow label="Hora:" value={appointmentTime} />
                <VoucherRow label="Lugar:" value={homeAddress ? `A domicilio · ${homeAddress}` : 'En el taller'} />
                <VoucherRow label="Vehículo:" value={vehicleModel.trim()} />
                {vehiclePatent.trim() && <VoucherRow label="Patente:" value={vehiclePatent.trim()} />}
                <VoucherRow label="Nombre:" value={userName.trim()} />
                <VoucherRow label="Correo:" value={accountEmail} />
              </div>
              {/* Regla del 13-oct: dentro de las 24 horas previas la cita confirmada queda fija para ambos. */}
              <div className="bk-confirm-intro bk-change-rule">
                <Lock size={18} />
                {slotWithinChangeLock
                  ? ' Falta menos de 24 horas para esta hora: una vez enviada, ni tú ni el taller podrán cancelarla ni cambiarla de hora.'
                  : ' Podrás cancelar o reagendar tu cita hasta 24 horas antes. Dentro de esas 24 horas ni tú ni el taller podrán cancelarla ni cambiarla de hora.'}
              </div>
              {submitError && (
                <div className="ad-form-error"><AlertCircle size={16} /><span>{submitError}</span></div>
              )}
              <div className="bk-actions">
                <button type="button" className="bk-outline" onClick={() => setStep('form')} disabled={isSubmitting}>Cambiar</button>
                <button type="button" className="bk-primary" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={16} className="spin-icon" /> : <Check size={16} />} Aceptar
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="bk-success">
              <span className="bk-success-icon"><CheckCircle2 size={48} /></span>
              <h3>{isRescheduling ? '¡Cambio de hora solicitado!' : '¡Solicitud de cita enviada!'}</h3>
              <p>
                Avisamos a <strong>{taller.name}</strong>. Tu cita queda pendiente hasta que
                el taller la confirme: te avisaremos con una notificación.
                {rescheduleFromId ? ' La hora anterior quedó liberada.' : ''} La encuentras en <strong>Mis citas</strong>, en tu perfil.
              </p>
              <div className="bk-voucher">
                <VoucherRow label="Código de reserva:" value={confirmedAppointment?.id} mono />
                <VoucherRow label="Origen:" value={originLabel} />
                {selectedServices.length > 0 && <VoucherRow label="Servicio:" value={selectedServices.join(', ')} />}
                {reason.trim() && <VoucherRow label="Detalle:" value={reason.trim()} />}
                <VoucherRow label="Fecha y hora:" value={`${dateLabel} a las ${confirmedAppointment?.time || appointmentTime}`} />
                <VoucherRow label="Dirección taller:" value={[taller.address, taller.commune].filter(Boolean).join(', ') || 'Por confirmar con el taller'} />
                <VoucherRow label="Vehículo:" value={vehicleModel.trim()} />
                <VoucherRow label="Cliente:" value={`${userName.trim()} (${accountEmail})`} />
              </div>
              {(confirmedAppointment?.workshopPhone || confirmedAppointment?.workshopWhatsapp) && (
                <div className="bk-contact">
                  <p>Mientras el taller responde, escríbele desde <strong>Mis citas</strong> o contáctalo directo.</p>
                  <div>
                    {confirmedAppointment.workshopPhone && (
                      <a className="bk-outline" href={`tel:${confirmedAppointment.workshopPhone.replace(/\s+/g, '')}`}><Phone size={17} /> Llamar</a>
                    )}
                    {confirmedAppointment.workshopWhatsapp && (
                      <a
                        className="bk-outline"
                        href={`https://wa.me/${confirmedAppointment.workshopWhatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => { if (!confirmWhatsappContact(taller.name, confirmedAppointment.workshopWhatsapp)) event.preventDefault(); }}
                      >
                        <MessageCircle size={17} /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )}
              <button type="button" className="bk-primary" onClick={onClose}>Listo, cerrar</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
