import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, Car, CheckCircle2, X, AlertCircle, MapPin, Loader2, LogIn, Clock, Phone, Mail,
  ChevronLeft, ChevronRight, Check, Lock, Info, User, FileText, Tag, LifeBuoy,
  Wrench, Gauge, Disc, Droplet, BatteryCharging, Settings, Sparkles, Thermometer, Zap,
  ScanLine, Snowflake, CircleDot, Hammer, PaintBucket, ShieldCheck, Home
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AddressAutocompleteInput from '../AddressAutocompleteInput';
import { useAdOwnership } from './useAdOwnership';
import {
  normalizeAgendaConfig, getUpcomingAgendaDates, getAgendaSlotsForDate,
  getAgendaSummaryText, formatAgendaDateLong, formatAgendaMonthLabel, parseIsoDate, toIsoDate,
  weekdayIndexFromDate, WEEKDAYS
} from '../../data/agendaConfig';
import { blocksAppointmentSlot } from '../../data/automotiveAdsData';
import { searchVehicleByPatenteApi } from '../../services/api';
import { isValidPlate, normalizePlate } from '../../utils/quoteFlow';

const WIZARD_STEPS = ['Servicios', 'Fecha y hora', 'Tus datos'];

// Un ícono por servicio, buscado por palabra clave, como `constants/service-icons.ts` de la app.
const SERVICE_ICON_RULES = [
  [/escaner|escáner|diagn/i, ScanLine], [/freno/i, Disc], [/aceite|lubric|filtro/i, Droplet],
  [/bater/i, BatteryCharging], [/electr/i, Zap], [/suspens|amortig/i, Gauge], [/neum|rueda|alinea|balance/i, CircleDot],
  [/aire|climat|a\/c/i, Snowflake], [/motor|afinam|mantenc|kilomet/i, Settings], [/pintur|desaboll|carroc/i, PaintBucket],
  [/lavad|estétic|estetic|pulid/i, Sparkles], [/temperat|radiador|refriger/i, Thermometer], [/garant/i, ShieldCheck],
  [/presupuesto|cotiza/i, FileText], [/desarm|soldad/i, Hammer]
];
const FALLBACK_SERVICE_ICONS = [Wrench, Settings, Gauge, Car, Sparkles, Zap, Disc, Droplet];

function serviceIcons(services) {
  const used = new Set();
  return services.map((service, index) => {
    let Icon = SERVICE_ICON_RULES.find(([pattern]) => pattern.test(service))?.[1];
    if (!Icon || used.has(Icon)) Icon = FALLBACK_SERVICE_ICONS.find((candidate) => !used.has(candidate)) || FALLBACK_SERVICE_ICONS[index % FALLBACK_SERVICE_ICONS.length];
    used.add(Icon);
    return Icon;
  });
}

/** "Toyota Yaris 2020", listo para el campo de marca, modelo y año. */
function vehicleLabel(vehicle) {
  return [vehicle?.marca, vehicle?.modelo, vehicle?.anio > 0 ? String(vehicle.anio) : '']
    .filter(Boolean).join(' ').trim();
}
import {
  fetchAdAppointments, createAdAppointment, rescheduleAdAppointment, notifyAppointmentCreated, adErrorMessage
} from '../../services/adsStorage';

/**
 * Reserva de hora en un anuncio del plan Empresarial.
 *
 * Hasta la fase B este formulario no llamaba a nada: inventaba un codigo de
 * reserva con `Math.random()` y mostraba la pantalla de exito. Ahora escribe
 * contra `POST /anuncios/agendamientos/anuncios/{id}`.
 *
 * Tres reglas del backend que la UI tiene que respetar ANTES de enviar, porque
 * todas terminan en un 400 despues de llenar el formulario entero:
 *
 * 1. hay que tener sesion iniciada: la cita se guarda a nombre del usuario del
 *    token y el correo del cliente se toma de ahi, no del formulario.
 * 2. no se puede reservar en el propio anuncio.
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

export default function AdAppointmentModal({ adOrCompany, onClose, onBooked, isRescheduling = false, rescheduleFromId = null, fromAppointment = null }) {
  const { user } = useAuth();
  const { isOwn } = useAdOwnership();
  const previousNoteLines = String(fromAppointment?.notes || '').split('\n');
  // Citas antiguas guardaban la dirección dentro de las notas; las nuevas traen campos propios.
  const previousHomeLine = previousNoteLines.find((line) => line.startsWith(HOME_SERVICE_PREFIX)) || '';
  const previousHomeAddress = fromAppointment?.homeService
    ? (fromAppointment.homeAddress || '')
    : previousHomeLine.slice(HOME_SERVICE_PREFIX.length);
  // La ranura "a domicilio" solo existe si el anuncio lo ofrece (`homeService`, lo declara el taller).
  const offersHomeService = adOrCompany?.homeService === true;

  const [step, setStep] = useState('form'); // 'form' | 'confirm' | 'success'
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [dataConfirmed, setDataConfirmed] = useState(false);
  const [selectedServices, setSelectedServices] = useState(() => (fromAppointment
    ? (fromAppointment.services?.length ? fromAppointment.services : [fromAppointment.service]).filter(Boolean)
    : []));
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [bookedSlots, setBookedSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [userName, setUserName] = useState(fromAppointment?.customerName || user?.userName || user?.nombre || '');
  const [userPhone, setUserPhone] = useState(fromAppointment?.customerPhone || user?.phone || user?.telefono || '');
  const [vehiclePatent, setVehiclePatent] = useState(fromAppointment?.vehiclePatent || '');
  const [vehicleModel, setVehicleModel] = useState(fromAppointment?.vehicleModel || '');
  // Detección por patente, igual que en la app: 'idle' | 'searching' | 'found' | 'not-found'.
  const [plateLookup, setPlateLookup] = useState('idle');
  // Con patente y vehículo precargados no se vuelve a consultar la patente (cada consulta nueva cuesta).
  const [detectedPlate, setDetectedPlate] = useState(() => (
    fromAppointment?.vehiclePatent && fromAppointment?.vehicleModel ? normalizePlate(fromAppointment.vehiclePatent) : ''));
  // Último texto que puso la detección: se reemplaza si cambia la patente, pero no lo que
  // haya escrito el usuario.
  const autoFilledVehicle = useRef('');
  const [notes, setNotes] = useState(() => previousNoteLines.filter((line) => line !== previousHomeLine).join('\n').trim());
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

  const adId = adOrCompany?.id;
  const isOwnAd = adOrCompany ? isOwn(adOrCompany) : false;
  const isLoggedIn = Boolean(user);

  const agendaConfig = useMemo(
    () => normalizeAgendaConfig(adOrCompany?.agendaConfig),
    [adOrCompany?.agendaConfig]
  );

  // Dias con atencion, desde mañana. Si el anuncio no trae agenda no se ofrece
  // ninguna fecha: sin configuracion el backend rechaza cualquier reserva con
  // "El anuncio no tiene una agenda configurada", asi que inventar bloques de
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
   * (`OCUPADOS` de `AnuncioAgendamientoService`).
   */
  const loadBookedSlots = useCallback(async ({ signal } = {}) => {
    if (!adId || !appointmentDate) { setBookedSlots([]); return; }
    setIsLoadingSlots(true);
    try {
      const list = await fetchAdAppointments(adId, { signal });
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
  }, [adId, appointmentDate]);

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
  // hubiera anuncio, y el render sin anuncio registraba un hook menos que el resto
  // ("Rendered fewer hooks than expected", que revienta la pantalla entera). Solo
  // depende de estado local, asi que subirlo no cambia cuando corre.
  useEffect(() => {
    setSubmitError('');
  }, [selectedServices, appointmentDate, appointmentTime, userName, userPhone, dataConfirmed, atHome, serviceAddress]);

  if (!adOrCompany) return null;

  // Mismo origen que la app: las etiquetas del aviso (`features`) y, en avisos antiguos, `servicesOffered`.
  const offeredServices = (
    (Array.isArray(adOrCompany.features) && adOrCompany.features.filter(Boolean).length > 0)
      ? adOrCompany.features
      : (Array.isArray(adOrCompany.servicesOffered) ? adOrCompany.servicesOffered : [])
  ).filter(Boolean).slice(0, 8);
  const offeredIcons = serviceIcons(offeredServices);
  const servicesLabel = selectedServices.join(', ');
  const accountEmail = user?.email || '';
  const currentStep = selectedServices.length === 0 ? 1 : (!appointmentDate || !appointmentTime ? 2 : 3);
  const shiftMonth = (delta) =>
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const dateLabel = appointmentDate ? formatAgendaDateLong(appointmentDate) : '';

  const toggleService = (service) => {
    setSelectedServices((current) => (current.includes(service)
      ? current.filter((item) => item !== service)
      : [...current, service].slice(0, 8)));
  };

  // Lista de campos obligatorios del formulario aun sin completar, en el orden
  // en que aparecen. Se usa para decirle al usuario exactamente que falta en
  // vez de solo deshabilitar el boton sin explicacion.
  const getMissingFieldLabels = () => {
    const missing = [];
    if (selectedServices.length === 0) missing.push('el servicio que necesitas');
    if (!appointmentDate) missing.push('el día de la cita');
    if (!appointmentTime) missing.push('el bloque horario');
    if (!userName.trim()) missing.push('tu nombre completo');
    if (!userPhone.trim()) missing.push('tu teléfono de contacto');
    if (atHome && !serviceAddress.trim()) missing.push('la dirección del servicio a domicilio');
    if (!dataConfirmed) missing.push('confirmar que tus datos son correctos');
    return missing;
  };

  const canSubmit = isLoggedIn && !isOwnAd && agendaConfig
    && selectedServices.length > 0 && appointmentDate && appointmentTime
    && userName.trim() && userPhone.trim() && dataConfirmed
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
        service: servicesLabel,
        services: selectedServices,
        date: appointmentDate,
        time: appointmentTime,
        customerName: userName.trim(),
        customerPhone: userPhone.trim(),
        customerEmail: accountEmail,
        vehiclePatent: vehiclePatent.trim(),
        vehicleModel: vehicleModel.trim(),
        notes: notes.trim(),
        // Campos propios (igual que la app): el backend valida que el anuncio ofrezca
        // domicilio y exige la dirección.
        homeService: atHome,
        homeAddress
      };
      const appointment = rescheduleFromId
        ? await rescheduleAdAppointment(rescheduleFromId, form)
        : await createAdAppointment(adId, form);

      setConfirmedAppointment(appointment);
      setStep('success');
      onBooked?.(appointment);

      // Correo de resumen para ambos, sin await: la reserva ya esta guardada. La notificacion
      // dentro de la plataforma la crea el backend junto con la reserva.
      notifyAppointmentCreated({ appointment, ad: adOrCompany, dateLabel });
    } catch (error) {
      setSubmitError(adErrorMessage(error, 'No se pudo reservar el horario. Elige otro bloque.'));
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
      {/* Mismo diseño que el modal de reserva de la app (AdAppointmentModal.tsx): hoja inferior en
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

              {isLoggedIn && isOwnAd && renderBlockedState(
                <AlertCircle size={30} />,
                'Es tu propio anuncio',
                'No puedes reservar una hora en tu propio anuncio. Para ver las reservas que recibiste, abre Mis citas en tu perfil.'
              )}

              {isLoggedIn && !isOwnAd && !agendaConfig && renderBlockedState(
                <Clock size={30} />,
                'Este anuncio no tiene horarios publicados',
                'El taller todavía no configuró su agenda en línea. Puedes contactarlo por teléfono o WhatsApp desde la tarjeta del mural.'
              )}

              {isLoggedIn && !isOwnAd && agendaConfig && (
                <form onSubmit={handleReview} className="bk-form">
                  {/* Taller al que se le agenda */}
                  <div className="bk-card bk-provider">
                    <h4>{adOrCompany.company || adOrCompany.title}</h4>
                    <span className="bk-provider-row"><MapPin size={14} /> {adOrCompany.commune || 'Santiago'}</span>
                    <span className="bk-provider-badge"><CheckCircle2 size={13} /> Servicio registrado</span>
                  </div>

                  {/* Progreso: Servicios · Fecha y hora · Tus datos */}
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

                  {/* 1. Servicios */}
                  <section className="bk-card">
                    <h5 className="bk-section-title"><Wrench size={17} /> Selecciona el servicio</h5>
                    {offeredServices.length > 0 ? (
                      <>
                        <div className="bk-services">
                          {offeredServices.map((service, index) => {
                            const Icon = offeredIcons[index];
                            const isSelected = selectedServices.includes(service);
                            return (
                              <button
                                type="button"
                                key={service}
                                className={`bk-service ${isSelected ? 'is-selected' : ''}`}
                                aria-pressed={isSelected}
                                onClick={() => toggleService(service)}
                              >
                                <Icon size={22} />
                                <span>{service}</span>
                              </button>
                            );
                          })}
                        </div>
                        {selectedServices.length > 0 && (
                          <small className="bk-muted">{selectedServices.length} de {offeredServices.length} servicios seleccionados</small>
                        )}
                      </>
                    ) : (
                      <label className="bk-field">
                        <Wrench size={18} />
                        <input
                          type="text"
                          maxLength={120}
                          placeholder="¿Qué servicio necesitas? *"
                          value={selectedServices[0] || ''}
                          onChange={(e) => setSelectedServices(e.target.value ? [e.target.value] : [])}
                        />
                      </label>
                    )}
                  </section>

                  {/* 2. Día y horario */}
                  <section className="bk-card">
                    <h5 className="bk-section-title"><Calendar size={17} /> Elige día y horario</h5>
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
                    <span className="bk-required"><AlertCircle size={13} /> Los campos con * son obligatorios para agendar</span>

                    <label className="bk-field">
                      <User size={18} />
                      <input type="text" maxLength={160} placeholder="Nombre completo *" value={userName} onChange={(e) => setUserName(e.target.value)} />
                    </label>
                    <label className="bk-field">
                      <Phone size={18} />
                      <input type="tel" maxLength={40} placeholder="Teléfono de contacto *" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} />
                    </label>
                    {/* El correo es el de la cuenta y no se edita: `AnuncioAgendamientoService.crear()`
                        guarda siempre el de la sesión e ignora lo que venga en el request. */}
                    <div>
                      <label className="bk-field is-locked">
                        <Mail size={18} />
                        <input type="email" value={accountEmail} readOnly disabled aria-label="Correo de tu cuenta" />
                        <Lock size={15} />
                      </label>
                      <small className="bk-helper">Es el correo de tu cuenta. Ahí llega el resumen de la cita.</small>
                    </div>
                    <label className="bk-field">
                      <Tag size={18} />
                      <input type="text" maxLength={20} placeholder="Patente del vehículo (opcional)" value={vehiclePatent} onChange={(e) => setVehiclePatent(e.target.value.toUpperCase())} />
                      {plateLookup === 'searching' && <Loader2 size={17} className="spin-icon" />}
                      {plateLookup === 'found' && <CheckCircle2 size={17} className="bk-ok" />}
                    </label>
                    {plateLookup === 'searching' && <small className="bk-muted">Buscando el vehículo de esa patente…</small>}
                    {plateLookup === 'found' && <div className="bk-plate-found"><Car size={16} /> Vehículo detectado: {vehicleModel}</div>}
                    {plateLookup === 'not-found' && <small className="bk-muted">No pudimos detectar el vehículo de esa patente. Escribe la marca y el modelo.</small>}
                    <label className="bk-field">
                      <Car size={18} />
                      <input type="text" maxLength={160} placeholder="Marca y modelo del vehículo (opcional)" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
                    </label>
                    {/* Ranura "Servicio a domicilio": solo en anuncios que lo ofrecen. Apagada por
                        defecto; al activarla se despliega la dirección donde está el vehículo, que
                        pasa a ser obligatoria. */}
                    {offersHomeService && (
                    <label className={`bk-home-toggle ${atHome ? 'is-active' : ''}`}>
                      <span className="bk-home-icon"><Home size={17} /></span>
                      <span className="bk-home-text">
                        <strong>¿Quieres el servicio a domicilio?</strong>
                        <small>{atHome
                          ? 'El taller irá a la dirección que indiques.'
                          : `Este taller va donde está tu vehículo${adOrCompany?.commune ? ` dentro de ${adOrCompany.commune}` : ' dentro de su comuna'}.`}</small>
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
                      <div className="bk-address">
                        <AddressAutocompleteInput
                          value={serviceAddress}
                          onChange={setServiceAddress}
                          comuna={adOrCompany?.commune}
                          region={adOrCompany?.region}
                          requireComuna={false}
                          placeholder="Dirección del servicio *"
                          maxLength={200}
                        />
                      </div>
                    )}
                    <label className="bk-field is-multiline">
                      <FileText size={18} />
                      <textarea rows={3} maxLength={2000} placeholder="Descripción breve del servicio solicitado" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </label>

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
                <VoucherRow label="Servicio:" value={servicesLabel} />
                <VoucherRow label="Día:" value={dateLabel} />
                <VoucherRow label="Hora:" value={appointmentTime} />
                <VoucherRow label="Lugar:" value={homeAddress ? `A domicilio · ${homeAddress}` : 'En el taller'} />
                <VoucherRow label="Nombre:" value={userName.trim()} />
                <VoucherRow label="Correo:" value={accountEmail} />
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
                Avisamos a <strong>{adOrCompany.company || adOrCompany.title}</strong>. Tu cita queda pendiente hasta que
                el taller la confirme: te avisaremos con una notificación.
                {rescheduleFromId ? ' La hora anterior quedó liberada.' : ''} La encuentras en <strong>Mis citas</strong>, en tu perfil.
              </p>
              <div className="bk-voucher">
                <VoucherRow label="Código de reserva:" value={confirmedAppointment?.id} mono />
                <VoucherRow label="Servicio:" value={confirmedAppointment?.service || servicesLabel} />
                <VoucherRow label="Fecha y hora:" value={`${dateLabel} a las ${confirmedAppointment?.time || appointmentTime}`} />
                <VoucherRow label="Dirección taller:" value={[adOrCompany.address, adOrCompany.commune].filter(Boolean).join(', ') || 'Por confirmar con el taller'} />
                <VoucherRow label="Cliente:" value={`${userName.trim()} (${accountEmail})`} />
              </div>
              <button type="button" className="bk-primary" onClick={onClose}>Listo, cerrar</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
