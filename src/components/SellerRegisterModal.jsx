import React, { useState } from 'react';
import { 
  Store, CheckCircle2, Building, ShieldCheck, FileText, 
  CreditCard, ArrowRight, X, Sparkles, TrendingUp, Users, PackageCheck, AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatRut } from '../services/adapters';

export default function SellerRegisterModal({ isOpen, onClose }) {
  const { registerSeller } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    nombreTienda: '',
    rutEmpresa: '',
    telefono: '',
    ciudad: '',
    emailContact: '',
    password: '',
    tipoRepuestos: 'nuevos_oem',
    marcasPrincipales: '',
    banco: 'Banco de Chile',
    tipoCuenta: 'Cuenta Corriente',
    numeroCuenta: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNextStep = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (step < 3) {
      setStep(step + 1);
    } else {
      // Step 3 final submit to backend
      if (!formData.emailContact || !formData.password) {
        setErrorMessage('Por favor ingresa un correo de contacto y contraseña para la cuenta de tienda.');
        return;
      }

      setIsSubmitting(true);
      const result = await registerSeller({
        email: formData.emailContact,
        password: formData.password,
        storeName: formData.nombreTienda,
        taxId: formData.rutEmpresa,
        phone: formData.telefono,
        comuna: formData.ciudad,
      });
      setIsSubmitting(false);

      if (result.success) {
        setIsSuccess(true);
      } else {
        setErrorMessage(result.error || 'No se pudo completar el registro de la tienda.');
      }
    }
  };

  const handleResetAndClose = () => {
    setStep(1);
    setIsSuccess(false);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleResetAndClose}>
      <div className="seller-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Close Button */}
        <button className="modal-close-btn" onClick={handleResetAndClose}>
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="seller-modal-header">
          <div className="header-badge">
            <Sparkles size={14} /> PORTAL VENDEDORES & DISTRIBUIDORES
          </div>
          <h2>Únete como Vendedor a Repuestop</h2>
          <p>Conecta tu inventario con más de 50.000 conductores y talleres buscando repuestos compatibles.</p>
          
          {/* Progress Indicator */}
          {!isSuccess && (
            <div className="wizard-progress-bar">
              <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1. Tienda</div>
              <div className="step-line"></div>
              <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2. Inventario</div>
              <div className="step-line"></div>
              <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3. Validación</div>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="auth-alert alert-error" style={{ margin: '0 2rem 1rem 2rem' }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {!isSuccess ? (
          <form onSubmit={handleNextStep} className="seller-modal-body">
            {/* Step 1: datos de la Tienda */}
            {step === 1 && (
              <div className="wizard-step-content">
                <h3><Building size={18} /> Datos de tu Tienda de Repuestos</h3>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Nombre Comercial de la Tienda *</label>
                    <input
                      type="text"
                      name="nombreTienda"
                      required
                      placeholder="Ej: Repuestos & Discos San Antonio"
                      value={formData.nombreTienda}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>RUT / Tax ID de Empresa o Persona *</label>
                    <input
                      type="text"
                      name="rutEmpresa"
                      required
                      placeholder="Ej: 76.543.210-K"
                      value={formData.rutEmpresa}
                      onChange={(e) => setFormData({ ...formData, rutEmpresa: formatRut(e.target.value) })}
                      maxLength={12}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Teléfono de Contacto Comercial *</label>
                    <input
                      type="tel"
                      name="telefono"
                      required
                      placeholder="+56 9 1234 5678"
                      value={formData.telefono}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Ciudad de Despacho *</label>
                    <input
                      type="text"
                      name="ciudad"
                      required
                      placeholder="Ej: Santiago, Concepción, Antofagasta..."
                      value={formData.ciudad}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Especialidad e Inventario */}
            {step === 2 && (
              <div className="wizard-step-content">
                <h3><PackageCheck size={18} /> Especialidad y Credenciales de Acceso</h3>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Correo Electrónico de la Tienda *</label>
                    <input
                      type="email"
                      name="emailContact"
                      required
                      placeholder="tienda@correo.com"
                      value={formData.emailContact}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Contraseña de Acceso *</label>
                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="Crea tu contraseña"
                      value={formData.password}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Categoría Principal de Repuestos *</label>
                  <select
                    name="tipoRepuestos"
                    value={formData.tipoRepuestos}
                    onChange={handleChange}
                    className="full-select"
                  >
                    <option value="nuevos_oem">Repuestos Nuevos Originales OEM</option>
                    <option value="alternativos">Repuestos Alternativos Calidad A1</option>
                    <option value="desarme">Desarmaduría / Repuestos Usados Garantizados</option>
                    <option value="lubricantes">Lubricantes, Filtros y Mantenimiento</option>
                    <option value="multimarca">Distribuidor General Multimarca</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Marcas de Vehículos que comercializas principalmente</label>
                  <input
                    type="text"
                    name="marcasPrincipales"
                    placeholder="Ej: Toyota, Nissan, Chevrolet, Hyundai, Ford..."
                    value={formData.marcasPrincipales}
                    onChange={handleChange}
                  />
                </div>

                <div className="seller-perks-mini">
                  <div className="perk-box"><TrendingUp size={16} /> <strong>Sin comisión fija mensual</strong></div>
                  <div className="perk-box"><ShieldCheck size={16} /> <strong>Garantía de Pago Seguro</strong></div>
                </div>
              </div>
            )}

            {/* Step 3: Datos bancarios & Confirmación */}
            {step === 3 && (
              <div className="wizard-step-content">
                <h3><CreditCard size={18} /> Datos Bancarios para Liquidación de Ventas</h3>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Banco Receptor *</label>
                    <select
                      name="banco"
                      value={formData.banco}
                      onChange={handleChange}
                      className="full-select"
                    >
                      <option value="Banco de Chile">Banco de Chile</option>
                      <option value="BancoEstado">BancoEstado / CuentaRUT</option>
                      <option value="Santander">Banco Santander</option>
                      <option value="BCI">Banco BCI</option>
                      <option value="Scotiabank">Scotiabank</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Número de Cuenta *</label>
                    <input
                      type="text"
                      name="numeroCuenta"
                      required
                      placeholder="123456789"
                      value={formData.numeroCuenta}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="terms-checkbox-box">
                  <input type="checkbox" id="termsCheck" required defaultChecked />
                  <label htmlFor="termsCheck">
                    Acepto los Términos de Servicio de Vendedores de Repuestop y autorizo la verificación de mi tienda.
                  </label>
                </div>
              </div>
            )}

            {/* Wizard Actions */}
            <div className="wizard-actions">
              {step > 1 && (
                <button type="button" className="btn-wizard-back" onClick={() => setStep(step - 1)}>
                  Atrás
                </button>
              )}
              <button type="submit" className="btn-wizard-next" disabled={isSubmitting}>
                {step === 3 ? (
                  <>
                    <span>{isSubmitting ? 'Registrando...' : 'Finalizar Registro de Tienda'}</span>
                    <CheckCircle2 size={18} />
                  </>
                ) : (
                  <>
                    <span>Siguiente Paso</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Success Screen & Seller Dashboard Preview */
          <div className="seller-success-screen">
            <div className="success-icon-wrap">
              <CheckCircle2 size={56} className="success-icon" />
            </div>
            <h3>¡Felicidades, {formData.nombreTienda || 'Tu Tienda'} ha sido registrada con éxito!</h3>
            <p>
              Tu solicitud fue procesada y tu cuenta de tienda está lista en el backend. Ya puedes iniciar sesión en Modo Proveedor y gestionar tu catálogo de repuestos.
            </p>

            <div className="dashboard-preview-card">
              <div className="dash-header">
                <span>PANEL DE CONTROL VENDEDOR</span>
                <span className="live-status">● En Línea</span>
              </div>
              <div className="dash-metrics-grid">
                <div className="metric">
                  <span className="num">0</span>
                  <span className="lbl">Repuestos Publicados</span>
                </div>
                <div className="metric">
                  <span className="num">$0</span>
                  <span className="lbl">Ventas este mes</span>
                </div>
                <div className="metric">
                  <span className="num">100%</span>
                  <span className="lbl">Reputación Vendedor</span>
                </div>
              </div>
            </div>

            <button className="btn-go-dashboard" onClick={handleResetAndClose}>
              Entendido / Ir al Inicio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
