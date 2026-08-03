import React, { useState } from 'react';
import {
  X, MessageSquare, Send, CheckCircle2, ShieldCheck, Car, Building2, Phone, Mail, FileText
} from 'lucide-react';

export default function QuotationRequestModal({ product, activeVehicle, isOpen, onClose }) {
  if (!isOpen || !product) return null;

  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    patente: activeVehicle ? activeVehicle.patente : '',
    metodoContacto: 'whatsapp',
    mensaje: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [ticketNum, setTicketNum] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTicketNum(`COT-${Math.floor(100000 + Math.random() * 900000)}`);
    }, 600);
  };

  const handleReset = () => {
    setIsSuccess(false);
    setFormData({
      nombre: '',
      telefono: '',
      email: '',
      patente: activeVehicle ? activeVehicle.patente : '',
      metodoContacto: 'whatsapp',
      mensaje: ''
    });
    onClose();
  };

  const sellerName = typeof product.vendedor === 'object'
    ? (product.vendedor.nombre || 'Tienda Verificada')
    : (product.vendedor || 'Tienda Verificada');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="seller-modal-card" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="seller-modal-header" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #0066ff 100%)' }}>
          <div className="header-badge">
            <MessageSquare size={12} /> SOLICITUD DE COTIZACIÓN EN TIEMPO REAL
          </div>
          <h2>Cotizar Repuesto Directo con el Vendedor</h2>
          <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '4px 0 0' }}>
            Recibe precio final, costo de envío y opciones de pago directamente de <strong>{sellerName}</strong>.
          </p>
        </div>

        <div style={{ padding: '24px' }}>
          {!isSuccess ? (
            <>
              {/* Product Summary Box */}
              <div className="quote-product-summary-box">
                <div className="summary-left-info">
                  <span className="oem-code-tag">OEM: {product.oemCode || 'OEM-REF-100'}</span>
                  <h4 className="quote-item-title">{product.titulo}</h4>
                  <div className="quote-store-line">
                    <Building2 size={13} className="text-blue-500" />
                    <span>Tienda: <strong>{sellerName}</strong></span>
                  </div>
                </div>
              </div>

              {/* Quotation Form */}
              <form onSubmit={handleSubmit} className="ticket-form" style={{ marginTop: '16px' }}>
                <div className="form-grid-2">
                  <div className="form-group-clean">
                    <label>Nombre y Apellido *</label>
                    <input
                      type="text"
                      name="nombre"
                      required
                      placeholder="Ej. Carlos Mendoza"
                      value={formData.nombre}
                      onChange={handleChange}
                      className="modal-form-input"
                    />
                  </div>

                  <div className="form-group-clean">
                    <label>WhatsApp / Teléfono *</label>
                    <input
                      type="tel"
                      name="telefono"
                      required
                      placeholder="Ej. +56 9 8765 4321"
                      value={formData.telefono}
                      onChange={handleChange}
                      className="modal-form-input"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group-clean">
                    <label>Correo Electrónico *</label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="ejemplo@correo.cl"
                      value={formData.email}
                      onChange={handleChange}
                      className="modal-form-input"
                    />
                  </div>

                  <div className="form-group-clean">
                    <label>Patente o VIN (Opcional)</label>
                    <input
                      type="text"
                      name="patente"
                      placeholder="Ej. BBCL12 para validar calce"
                      value={formData.patente}
                      onChange={handleChange}
                      className="modal-form-input"
                    />
                  </div>
                </div>

                <div className="form-group-clean">
                  <label>Preferencia de Respuesta</label>
                  <select
                    name="metodoContacto"
                    value={formData.metodoContacto}
                    onChange={handleChange}
                    className="modal-form-select"
                  >
                    <option value="whatsapp">📱 WhatsApp (Respuesta rápida en 15 min)</option>
                    <option value="email">✉️ Correo Electrónico con Cotización Formal PDF</option>
                    <option value="llamada">📞 Llamada Telefónica</option>
                  </select>
                </div>

                <div className="form-group-clean">
                  <label>Observaciones o Requerimientos Específicos</label>
                  <textarea
                    name="mensaje"
                    rows="3"
                    placeholder="Indica si necesitas despacho a región, factura a nombre de empresa o kit completo..."
                    value={formData.mensaje}
                    onChange={handleChange}
                    className="modal-form-textarea"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-submit-ticket"
                  style={{ background: '#0066ff' }}
                >
                  <Send size={16} />
                  <span>{isSubmitting ? 'Enviando Solicitud...' : 'Enviar Solicitud de Cotización'}</span>
                </button>
              </form>
            </>
          ) : (
            /* Success Confirmation Screen */
            <div className="ticket-success-screen">
              <CheckCircle2 size={56} style={{ color: '#059669' }} />
              <h3>¡Solicitud de Cotización Enviada con Éxito!</h3>
              <div className="quote-ticket-badge" style={{ background: '#eff6ff', color: '#0066ff', padding: '6px 16px', borderRadius: '20px', fontWeight: '800', fontSize: '14px' }}>
                N° de Referencia: {ticketNum}
              </div>
              <p style={{ marginTop: '8px', fontSize: '13.5px', color: '#475569' }}>
                Tu solicitud ha sido entregada a la tienda <strong>{sellerName}</strong>. Te contactarán vía {formData.metodoContacto === 'whatsapp' ? 'WhatsApp' : 'correo electrónico'} en un plazo máximo de 30 minutos.
              </p>
              <button className="btn-reset-ticket" onClick={handleReset}>
                Entendido / Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
