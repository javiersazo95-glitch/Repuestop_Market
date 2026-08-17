import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, Clock, Car, User, Phone, Mail,
  CheckCircle2, X, AlertCircle, ShieldCheck, MapPin
} from 'lucide-react';

const TIME_SLOTS = [
  '09:00 - 10:00',
  '10:30 - 11:30',
  '12:00 - 13:00',
  '14:30 - 15:30',
  '16:00 - 17:00',
  '17:30 - 18:30'
];

export default function AdAppointmentModal({
  adOrCompany,
  onClose
}) {
  const [step, setStep] = useState('form'); // 'form' | 'success'
  const [serviceSelected, setServiceSelected] = useState(
    adOrCompany?.servicesOffered?.[0] || 'Mantención general'
  );
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [appointmentTime, setAppointmentTime] = useState(TIME_SLOTS[0]);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [vehiclePatent, setVehiclePatent] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingId, setBookingId] = useState('');

  if (!adOrCompany) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const generatedId = `AG-${Math.floor(100000 + Math.random() * 900000)}`;
    setBookingId(generatedId);
    setStep('success');
  };

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
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
                  Agendar Cita en Línea
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

            <form onSubmit={handleSubmit}>
              <div className="booking-form-grid">
                
                {/* Selección del Servicio */}
                <div className="booking-field col-span-2">
                  <label>Servicio requerido *</label>
                  <select
                    value={serviceSelected}
                    onChange={(e) => setServiceSelected(e.target.value)}
                    required
                  >
                    {adOrCompany.servicesOffered?.map((srv, idx) => (
                      <option key={idx} value={srv}>
                        {srv}
                      </option>
                    )) || (
                      <>
                        <option value="Mantención preventiva por kilometraje">Mantención preventiva por kilometraje</option>
                        <option value="Diagnóstico computarizado / Escáner">Diagnóstico computarizado / Escáner</option>
                        <option value="Revisión de frenos y suspensión">Revisión de frenos y suspensión</option>
                        <option value="Presupuesto y cotización en taller">Presupuesto y cotización en taller</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Fecha de la cita */}
                <div className="booking-field">
                  <label>Fecha deseada *</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    required
                  />
                </div>

                {/* Horario de atención */}
                <div className="booking-field">
                  <label>Bloque horario *</label>
                  <select
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    required
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Datos del Cliente */}
                <div className="booking-field">
                  <label>Tu nombre completo *</label>
                  <input
                    type="text"
                    placeholder="Ej: Javier Sazo"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>Teléfono de contacto *</label>
                  <input
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>Email para confirmación *</label>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.cl"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                  />
                </div>

                {/* Datos del Vehículo */}
                <div className="booking-field">
                  <label>Patente del vehículo (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: BB-CL-12"
                    value={vehiclePatent}
                    onChange={(e) => setVehiclePatent(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="booking-field col-span-2">
                  <label>Marca, Modelo y Año (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Toyota RAV4 2021"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                  />
                </div>

                <div className="booking-field col-span-2">
                  <label>Detalles o síntomas de la falla</label>
                  <textarea
                    rows={2}
                    placeholder="Describe brevemente el ruido, mantención requerida o detalle del vehículo..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

              </div>

              <div className="booking-summary-box">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <ShieldCheck size={16} />
                  Agendamiento Directo Garantizado
                </div>
                <span>
                  El taller recibirá tu solicitud y reservará tu turno para el día <strong>{appointmentDate}</strong> a las <strong>{appointmentTime}</strong>.
                </span>
              </div>

              <div className="booking-actions-row">
                <button
                  type="button"
                  className="btn-ad-phone"
                  onClick={onClose}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-ad-booking"
                >
                  Confirmar Agendamiento
                </button>
              </div>
            </form>
          </>
        ) : (
          /* PANTALLA DE CONFIRMACIÓN EXITOSA */
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
              ¡Cita Agendada con Éxito!
            </h3>

            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              Tu reserva ha sido enviada directamente al taller <strong>{adOrCompany.company || adOrCompany.title}</strong>.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-md mx-auto mb-6 space-y-2 text-xs text-slate-700">
              <div><strong>Código de Reserva:</strong> <span className="text-emerald-700 font-mono font-bold text-sm">{bookingId}</span></div>
              <div><strong>Servicio:</strong> {serviceSelected}</div>
              <div><strong>Fecha y Hora:</strong> {appointmentDate} a las {appointmentTime}</div>
              <div><strong>Dirección Taller:</strong> {adOrCompany.address || 'Av. Vitacura 4120, Vitacura'}</div>
              <div><strong>Contacto Taller:</strong> {adOrCompany.phone}</div>
              <div><strong>Cliente:</strong> {userName} ({userPhone})</div>
            </div>

            <button
              type="button"
              className="btn-ad-booking mx-auto"
              onClick={onClose}
            >
              Listo, Cerrar
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
