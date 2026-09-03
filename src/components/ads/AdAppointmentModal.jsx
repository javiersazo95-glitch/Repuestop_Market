import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, Car, CheckCircle2, X, AlertCircle, ShieldCheck, MapPin,
  Loader2, LogIn, Clock, Phone, Mail
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAdOwnership } from './useAdOwnership';
import {
  normalizeAgendaConfig, getUpcomingAgendaDates, getAgendaSlotsForDate,
  getAgendaSummaryText, formatAgendaDateLong
} from '../../data/agendaConfig';
import { blocksAppointmentSlot } from '../../data/automotiveAdsData';
import {
  fetchAdAppointments, createAdAppointment, notifyAppointmentCreated, adErrorMessage
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
export default function AdAppointmentModal({ adOrCompany, onClose, onBooked }) {
  const { user } = useAuth();
  const { isOwn } = useAdOwnership();

  const [step, setStep] = useState('form'); // 'form' | 'success'
  const [selectedServices, setSelectedServices] = useState([]);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [bookedSlots, setBookedSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [userName, setUserName] = useState(user?.userName || user?.nombre || '');
  const [userPhone, setUserPhone] = useState(user?.phone || user?.telefono || '');
  const [vehiclePatent, setVehiclePatent] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);

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

  useEffect(() => {
    if (!appointmentDate && availableDates.length > 0) setAppointmentDate(availableDates[0].iso);
  }, [availableDates, appointmentDate]);

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

  if (!adOrCompany) return null;

  const offeredServices = Array.isArray(adOrCompany.servicesOffered)
    ? adOrCompany.servicesOffered.filter(Boolean)
    : [];
  const servicesLabel = selectedServices.join(' · ');
  const dateLabel = appointmentDate ? formatAgendaDateLong(appointmentDate) : '';

  const toggleService = (service) => {
    setSelectedServices((current) => (current.includes(service)
      ? current.filter((item) => item !== service)
      : [...current, service].slice(0, 8)));
  };

  const canSubmit = isLoggedIn && !isOwnAd && agendaConfig
    && selectedServices.length > 0 && appointmentDate && appointmentTime
    && userName.trim() && userPhone.trim();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const appointment = await createAdAppointment(adId, {
        service: servicesLabel,
        services: selectedServices,
        date: appointmentDate,
        time: appointmentTime,
        customerName: userName.trim(),
        customerPhone: userPhone.trim(),
        customerEmail: user?.email || '',
        vehiclePatent: vehiclePatent.trim(),
        vehicleModel: vehicleModel.trim(),
        notes: notes.trim()
      });

      setConfirmedAppointment(appointment);
      setStep('success');
      // Reagendamiento: quien abrió el modal cancela la hora anterior recién
      // ahora, cuando la nueva ya quedó reservada.
      onBooked?.(appointment);

      // Avisos al taller y al cliente. Van despues de mostrar el exito y sin
      // await: la reserva ya esta guardada y un fallo de correo o de campanita
      // no debe verse como una reserva fallida.
      notifyAppointmentCreated({
        appointment,
        ad: adOrCompany,
        customerUserId: user?.userId ?? user?.id ?? user?.buyerId ?? null,
        dateLabel
      });
    } catch (error) {
      setSubmitError(adErrorMessage(error, 'No se pudo reservar el horario. Elige otro bloque.'));
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

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="booking-modal-card">
        {step === 'form' ? (
          <>
            <div className="booking-modal-header">
              <div>
                <h3>
                  <Calendar className="text-emerald-600" size={22} />
                  Agendar cita en línea
                </h3>
                <p>
                  <strong>{adOrCompany.company || adOrCompany.title}</strong> • {adOrCompany.commune || 'Santiago'}
                </p>
              </div>
              <button
                type="button"
                className="story-close-btn"
                style={{ background: '#f1f5f9', color: '#0f172a' }}
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </div>

            {!isLoggedIn && renderBlockedState(
              <LogIn size={30} />,
              'Necesitas iniciar sesión',
              'La reserva queda a nombre de tu cuenta, así puedes revisarla y cancelarla después desde tu perfil. Inicia sesión y vuelve a intentarlo.'
            )}

            {isLoggedIn && isOwnAd && renderBlockedState(
              <AlertCircle size={30} />,
              'Es tu propio anuncio',
              'No puedes reservar una hora en tu propio anuncio. Para ver las reservas que recibiste, abre la agenda desde Gestión de anuncios en tu perfil.'
            )}

            {isLoggedIn && !isOwnAd && !agendaConfig && renderBlockedState(
              <Clock size={30} />,
              'Este anuncio no tiene horarios publicados',
              'El taller todavía no configuró su agenda en línea. Puedes contactarlo por teléfono o WhatsApp desde la tarjeta del mural.'
            )}

            {isLoggedIn && !isOwnAd && agendaConfig && (
              <form onSubmit={handleSubmit}>
                <div className="booking-agenda-note">
                  <Clock size={14} />
                  <span>Horario de atención: {getAgendaSummaryText(agendaConfig)}</span>
                </div>

                <div className="booking-form-grid">
                  {/* Multi-seleccion: el DTO acepta hasta 8 servicios y el taller
                      recibe la lista completa, no una sola linea de texto. */}
                  <div className="booking-field col-span-2">
                    <label>¿Qué necesitas? Elige uno o más servicios *</label>
                    {offeredServices.length > 0 ? (
                      <div className="ad-tag-picker">
                        {offeredServices.map((service) => (
                          <button
                            type="button"
                            key={service}
                            className={`ad-tag-chip ${selectedServices.includes(service) ? 'active' : ''}`}
                            onClick={() => toggleService(service)}
                          >
                            {selectedServices.includes(service) && <CheckCircle2 size={11} />} {service}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="text"
                        maxLength={120}
                        placeholder="Ej: Mantención preventiva"
                        value={selectedServices[0] || ''}
                        onChange={(e) => setSelectedServices(e.target.value ? [e.target.value] : [])}
                        required
                      />
                    )}
                  </div>

                  <div className="booking-field col-span-2">
                    <label>Día de la cita *</label>
                    {availableDates.length > 0 ? (
                      <div className="booking-date-strip">
                        {availableDates.slice(0, 21).map((date) => (
                          <button
                            type="button"
                            key={date.iso}
                            className={`booking-date-chip ${appointmentDate === date.iso ? 'active' : ''}`}
                            onClick={() => setAppointmentDate(date.iso)}
                          >
                            <span className="booking-date-weekday">{date.shortLabel}</span>
                            <strong>{date.dayNumber}</strong>
                            <span className="booking-date-month">{date.monthShort}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <small className="ad-upload-hint">
                        El taller no tiene días de atención configurados.
                      </small>
                    )}
                  </div>

                  <div className="booking-field col-span-2">
                    <label>
                      Bloque horario * {dateLabel && <span className="booking-date-long">— {dateLabel}</span>}
                    </label>
                    {isLoadingSlots ? (
                      <div className="booking-slots-state">
                        <Loader2 size={16} className="spin-icon" /> Consultando disponibilidad…
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="agenda-slots-grid">
                        {availableSlots.map((slot) => (
                          <button
                            type="button"
                            key={slot.label}
                            className={`agenda-slot-chip ${appointmentTime === slot.label ? 'active' : ''}`}
                            onClick={() => setAppointmentTime(slot.label)}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="booking-slots-state is-empty">
                        No quedan horas libres para este día. Elige otra fecha.
                      </div>
                    )}
                  </div>

                  <div className="booking-field">
                    <label>Tu nombre completo *</label>
                    <input
                      type="text"
                      maxLength={160}
                      placeholder="Ej: Javier Sazo"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="booking-field">
                    <label><Phone size={12} /> Teléfono de contacto *</label>
                    <input
                      type="tel"
                      maxLength={40}
                      placeholder="+56 9 1234 5678"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      required
                    />
                  </div>

                  {/* El correo no se pide: `AnuncioAgendamientoService.crear()`
                      guarda siempre el de la sesion e ignora lo que venga en el
                      request. Un campo editable seria un dato que no se usa. */}
                  <div className="booking-field col-span-2">
                    <label><Mail size={12} /> Correo de confirmación</label>
                    <input type="email" value={user?.email || ''} readOnly disabled />
                    <small className="ad-upload-hint">
                      Es el correo de tu cuenta. Ahí llega el resumen de la cita.
                    </small>
                  </div>

                  <div className="booking-field">
                    <label><Car size={12} /> Patente del vehículo (opcional)</label>
                    <input
                      type="text"
                      maxLength={20}
                      placeholder="Ej: BBCL12"
                      value={vehiclePatent}
                      onChange={(e) => setVehiclePatent(e.target.value.toUpperCase())}
                    />
                  </div>

                  <div className="booking-field">
                    <label>Marca, modelo y año (opcional)</label>
                    <input
                      type="text"
                      maxLength={160}
                      placeholder="Ej: Toyota RAV4 2021"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                    />
                  </div>

                  <div className="booking-field col-span-2">
                    <label>Detalles o síntomas de la falla</label>
                    <textarea
                      rows={2}
                      maxLength={2000}
                      placeholder="Describe brevemente el ruido, la mantención requerida o el detalle del vehículo…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="booking-summary-box">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <ShieldCheck size={16} />
                    La reserva queda pendiente hasta que el taller la confirme
                  </div>
                  <span>
                    {appointmentDate && appointmentTime
                      ? <>Vas a pedir hora para el <strong>{dateLabel}</strong> a las <strong>{appointmentTime}</strong>. Te avisamos por correo cuando el taller responda.</>
                      : 'Elige el día y el bloque horario para continuar.'}
                  </span>
                </div>

                {submitError && (
                  <div className="ad-form-error">
                    <AlertCircle size={16} />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="booking-actions-row">
                  <button type="button" className="btn-ad-phone" onClick={onClose} disabled={isSubmitting}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-ad-booking" disabled={!canSubmit || isSubmitting}>
                    {isSubmitting ? <Loader2 size={16} className="spin-icon" /> : <Calendar size={16} />}
                    {isSubmitting ? 'Reservando…' : 'Confirmar agendamiento'}
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
              ¡Tu hora quedó reservada!
            </h3>

            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              La solicitud llegó a <strong>{adOrCompany.company || adOrCompany.title}</strong>.
              Queda <strong>pendiente</strong> hasta que el taller la confirme, y te avisamos por correo.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-md mx-auto mb-6 space-y-2 text-xs text-slate-700">
              <div><strong>N° de reserva:</strong> <span className="text-emerald-700 font-mono font-bold text-sm">{confirmedAppointment?.id}</span></div>
              <div><strong>Servicio:</strong> {confirmedAppointment?.service}</div>
              <div><strong>Fecha y hora:</strong> {dateLabel} a las {confirmedAppointment?.time}</div>
              <div className="flex items-start gap-1">
                <MapPin size={13} className="mt-0.5 flex-shrink-0" />
                <span>{[adOrCompany.address, adOrCompany.commune].filter(Boolean).join(', ') || 'Dirección no informada'}</span>
              </div>
              <div><strong>Contacto del taller:</strong> {adOrCompany.phone}</div>
              <div><strong>A nombre de:</strong> {confirmedAppointment?.customerName} ({confirmedAppointment?.customerPhone})</div>
            </div>

            <p className="text-[11px] text-slate-500 max-w-md mx-auto mb-4">
              Puedes ver el estado de esta cita y cancelarla desde <strong>Mis reservas</strong>, en tu perfil.
            </p>

            <button type="button" className="btn-ad-booking mx-auto" onClick={onClose}>
              Listo, cerrar
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
