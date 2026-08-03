import React, { useState } from 'react';
import {
  HelpCircle, X, MessageCircle, Phone, Mail, ShieldCheck, Lock, Scale,
  ChevronDown, ChevronUp, Send, CheckCircle2, Headphones, FileText, Search
} from 'lucide-react';

export default function HelpSupportModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('faq'); // 'faq' | 'contact' | 'ticket'
  const [expandedFaq, setExpandedFaq] = useState(0); // index of open FAQ item
  const [searchFaq, setSearchFaq] = useState('');

  // Form ticket state
  const [ticketForm, setTicketForm] = useState({
    nombre: '',
    email: '',
    asunto: 'Consulta de Compatibilidad',
    patenteOPedido: '',
    mensaje: ''
  });
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  if (!isOpen) return null;

  const FAQS = [
    {
      pregunta: '¿Cómo funciona el filtro por Patente y VIN?',
      respuesta: 'Al ingresar la patente chilena de tu vehículo (ej. BBCL12), nuestro sistema consulta la base de homologación oficial para obtener el motor, año, chasis (VIN) y versión exactos. De esta manera, solo se despliegan repuestos 100% compatibles con tu auto.'
    },
    {
      pregunta: '¿En qué consiste el sistema de Pago Protegido en Custodia?',
      respuesta: 'Cuando realizas una compra en RepuesTop.cl, tu dinero se resguarda de forma segura en custodia por nuestra plataforma. El monto solo se transfiere a la tienda vendedora una vez que recibes el paquete y confirmas que el repuesto le hace perfectamente a tu vehículo.'
    },
    {
      pregunta: '¿Cuáles son los 3 métodos de envío disponibles?',
      respuesta: 'Ofrecemos: 1) Retiro en tienda (gratuito directo en el local comercial), 2) Envío dentro de la comuna (despacho expreso local o motorizado en el mismo día), y 3) Envío fuera de la comuna / regiones (despacho nacional mediante couriers como Starken, Chilexpress o Blue Express).'
    },
    {
      pregunta: '¿Qué ocurre si el repuesto no le hace a mi auto o llega defectuoso?',
      respuesta: 'Cuentas con la Garantía de Calce Perfecto de RepuesTop.cl. Si el repuesto no corresponde o presenta alguna falla, puedes solicitar la mediación dentro de los primeros 10 días para realizar el cambio directo o la devolución del 100% de tu dinero sin costo de envío.'
    },
    {
      pregunta: '¿Puedo solicitar Boleta o Factura de empresa?',
      respuesta: 'Sí. Todas las tiendas e importadores en RepuesTop.cl están acreditados tributariamente con RUT verificado. Durante el proceso de pago puedes seleccionar entre Boleta o Factura ingresando los datos de tu empresa (RUT, Razón Social y Giro).'
    },
    {
      pregunta: '¿Cómo me contacto si tengo un problema con una tienda?',
      respuesta: 'Puedes comunicarte directamente con nuestro Centro de Mediación e Impugnación a través de este portal, por correo electrónico a contacto@repuestop.cl o al teléfono +56 2 2938 4000. Un ejecutivo asignado intervendrá para resolver el caso en menos de 24 horas.'
    }
  ];

  const filteredFaqs = FAQS.filter(faq => {
    if (!searchFaq.trim()) return true;
    const q = searchFaq.toLowerCase();
    return faq.pregunta.toLowerCase().includes(q) || faq.respuesta.toLowerCase().includes(q);
  });

  const handleTicketSubmit = (e) => {
    e.preventDefault();
    if (!ticketForm.nombre || !ticketForm.email || !ticketForm.mensaje) return;
    setTicketSubmitted(true);
  };

  const handleResetTicket = () => {
    setTicketSubmitted(false);
    setTicketForm({
      nombre: '',
      email: '',
      asunto: 'Consulta de Compatibilidad',
      patenteOPedido: '',
      mensaje: ''
    });
  };

  return (
    <div className="modal-backdrop help-modal-backdrop" onClick={onClose}>
      <div className="seller-modal-card help-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="help-modal-header">
          <div className="help-header-title-box">
            <div className="help-icon-circle">
              <Headphones size={22} />
            </div>
            <div>
              <h2 className="help-title">Centro de Ayuda y Soporte RepuesTop.cl</h2>
              <p className="help-subtitle">
                Resolución de dudas, garantías de calce, envíos y mediación directa
              </p>
            </div>
          </div>
          <button className="btn-close-modal-clean" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="help-modal-tabs-bar">
          <button
            className={`help-tab-btn ${activeTab === 'faq' ? 'active' : ''}`}
            onClick={() => setActiveTab('faq')}
          >
            <HelpCircle size={15} />
            <span>Preguntas Frecuentes</span>
          </button>

          <button
            className={`help-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
            onClick={() => setActiveTab('contact')}
          >
            <Phone size={15} />
            <span>Canales de Atención</span>
          </button>

          <button
            className={`help-tab-btn ${activeTab === 'ticket' ? 'active' : ''}`}
            onClick={() => setActiveTab('ticket')}
          >
            <FileText size={15} />
            <span>Enviar Consulta</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="help-modal-body">
          {/* TAB 1: FAQ PREGUNTAS FRECUENTES */}
          {activeTab === 'faq' && (
            <div className="faq-tab-content">
              <div className="faq-search-box">
                <Search size={16} className="faq-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar problema o pregunta (ej. patente, pago, envíos)..."
                  value={searchFaq}
                  onChange={(e) => setSearchFaq(e.target.value)}
                  className="faq-search-input"
                />
              </div>

              <div className="faq-accordion-list">
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((faq, idx) => {
                    const isOpen = expandedFaq === idx;
                    return (
                      <div key={idx} className={`faq-item-card ${isOpen ? 'open' : ''}`}>
                        <button
                          className="faq-item-header"
                          onClick={() => setExpandedFaq(isOpen ? null : idx)}
                        >
                          <span className="faq-question-text">{faq.pregunta}</span>
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {isOpen && (
                          <div className="faq-item-body">
                            <p>{faq.respuesta}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="faq-empty-search">
                    <p>No se encontraron resultados para tu búsqueda. Prueba enviando una consulta directa a nuestro soporte.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CANALES DE ATENCIÓN DIRECTA */}
          {activeTab === 'contact' && (
            <div className="contact-tab-content">
              <div className="contact-cards-grid">
                <div className="contact-card-item">
                  <div className="contact-icon-badge bg-emerald-50 text-emerald-600">
                    <MessageCircle size={24} />
                  </div>
                  <h4>WhatsApp Soporte Directo</h4>
                  <p>Atención inmediata para resolver dudas de calce o seguimiento de pedidos.</p>
                  <a
                    href="https://wa.me/56987654321"
                    target="_blank"
                    rel="noreferrer"
                    className="contact-action-link"
                  >
                    <span>+56 9 8765 4321</span>
                  </a>
                </div>

                <div className="contact-card-item">
                  <div className="contact-icon-badge bg-blue-50 text-blue-600">
                    <Mail size={24} />
                  </div>
                  <h4>Correo de Mediación</h4>
                  <p>Envío de comprobantes, facturas o consultas comerciales.</p>
                  <a href="mailto:contacto@repuestop.cl" className="contact-action-link">
                    <span>contacto@repuestop.cl</span>
                  </a>
                </div>

                <div className="contact-card-item">
                  <div className="contact-icon-badge bg-sky-50 text-sky-600">
                    <Phone size={24} />
                  </div>
                  <h4>Mesa Central Telefónica</h4>
                  <p>Asistencia telefónica oficial para tiendas y compradores en todo Chile.</p>
                  <a href="tel:+56229384000" className="contact-action-link">
                    <span>+56 2 2938 4000</span>
                  </a>
                </div>
              </div>

              {/* Security Banner */}
              <div className="help-trust-banner">
                <div className="trust-pill-group">
                  <Lock size={16} className="text-blue-500" />
                  <span><strong>Pago 100% Protegido:</strong> Custodia oficial hasta recibir conforme.</span>
                </div>
                <div className="trust-pill-group">
                  <Scale size={16} className="text-purple-500" />
                  <span><strong>Centro de Mediación:</strong> Asistencia imparcial en caso de cualquier disconformidad.</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ENVIAR CONSULTA O TICKET */}
          {activeTab === 'ticket' && (
            <div className="ticket-tab-content">
              {!ticketSubmitted ? (
                <>
                  <div className="ticket-intro-banner">
                    <FileText size={20} className="text-blue-500" />
                    <div>
                      <h4>Envío de Consulta a Soporte y Mediación</h4>
                      <p>Rellena este formulario y nuestro equipo técnico te responderá al correo en menos de 2 horas.</p>
                    </div>
                  </div>

                  <form onSubmit={handleTicketSubmit} className="ticket-form">
                    <div className="form-grid-2">
                      <div className="form-group-clean">
                        <label>Nombre y Apellido *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Juan Pérez"
                          value={ticketForm.nombre}
                          onChange={(e) => setTicketForm({ ...ticketForm, nombre: e.target.value })}
                          className="modal-form-input"
                        />
                      </div>

                      <div className="form-group-clean">
                        <label>Correo Electrónico *</label>
                        <input
                          type="email"
                          required
                          placeholder="ejemplo@correo.cl"
                          value={ticketForm.email}
                          onChange={(e) => setTicketForm({ ...ticketForm, email: e.target.value })}
                          className="modal-form-input"
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group-clean">
                        <label>Motivo de la Consulta</label>
                        <select
                          value={ticketForm.asunto}
                          onChange={(e) => setTicketForm({ ...ticketForm, asunto: e.target.value })}
                          className="modal-form-select"
                        >
                          <option value="Consulta de Compatibilidad">Consulta de Compatibilidad por Patente</option>
                          <option value="Estado de mi Pedido">Estado de mi Pedido / Despacho</option>
                          <option value="Garantía o Cambio">Garantía o Cambio de Repuesto</option>
                          <option value="Facturación y Boletas">Solicitud de Factura o Boleta</option>
                          <option value="Soporte para Tiendas">Soporte para Tiendas / Vendedores</option>
                        </select>
                      </div>

                      <div className="form-group-clean">
                        <label>Patente o N° de Pedido (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ej. BBCL12 o PED-8941"
                          value={ticketForm.patenteOPedido}
                          onChange={(e) => setTicketForm({ ...ticketForm, patenteOPedido: e.target.value })}
                          className="modal-form-input"
                        />
                      </div>
                    </div>

                    <div className="form-group-clean">
                      <label>Mensaje o Detalle de la Consulta *</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Escribe en detalle tu consulta o requerimiento sobre el repuesto o pedido..."
                        value={ticketForm.mensaje}
                        onChange={(e) => setTicketForm({ ...ticketForm, mensaje: e.target.value })}
                        className="modal-form-textarea"
                      />
                    </div>

                    <button type="submit" className="btn-submit-ticket">
                      <Send size={15} />
                      <span>Enviar Consulta a Soporte</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="ticket-success-screen">
                  <CheckCircle2 size={48} className="text-emerald-500" />
                  <h3>¡Consulta Recibida Exitosamente!</h3>
                  <p>Hemos registrado tu mensaje. Un ejecutivo especializado de RepuesTop.cl revisará tu caso y te responderá al correo <strong>{ticketForm.email}</strong> en menos de 2 horas.</p>
                  <button className="btn-reset-ticket" onClick={handleResetTicket}>
                    <span>Enviar otra consulta</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
