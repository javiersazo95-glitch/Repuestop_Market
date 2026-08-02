import React, { useState } from 'react';
import { 
  Store, CheckCircle2, Building, ShieldCheck, FileText, 
  CreditCard, ArrowRight, X, Sparkles, TrendingUp, Users, PackageCheck 
} from 'lucide-react';

export default function SellerRegisterModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    nombreTienda: '',
    rutEmpresa: '',
    telefono: '',
    ciudad: '',
    tipoRepuestos: 'nuevos_oem',
    marcasPrincipales: '',
    emailContact: '',
    banco: 'Banco de Chile',
    tipoCuenta: 'Cuenta Corriente',
    numeroCuenta: ''
  });

  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      setIsSuccess(true);
    }
  };

  const handleResetAndClose = () => {
    setStep(1);
    setIsSuccess(false);
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
                      onChange={handleChange}
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
                <h3><PackageCheck size={18} /> Especialidad y Tipo de Repuestos</h3>

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
              <button type="submit" className="btn-wizard-next">
                {step === 3 ? (
                  <>
                    <span>Finalizar Registro de Tienda</span>
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
              Tu solicitud fue aprobada automáticamente. Ya puedes comenzar a subir tu catálogo de repuestos con código OEM y vincular tu inventario a patentes de vehículos.
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
