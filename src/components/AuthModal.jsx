import React, { useState, useEffect, useRef } from 'react';
import {
  Car, Store, ChevronRight, X, Eye, EyeOff, Lock, Mail,
  ShieldCheck, ArrowLeft, AlertCircle, CheckCircle2, UserPlus, LogIn, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ID de cliente OAuth de RepuesTop en Google Cloud (mismo usado por mobile/backoffice/vendedor_panel
// y configurado en el backend vía repuestop.google.client-id). No es un secreto: los client IDs de
// Google son públicos por diseño, la validación real ocurre en el backend contra el idToken firmado.
const GOOGLE_CLIENT_ID = '117201265366-ao32ed2314d1ncce1qt47biide1ij62r.apps.googleusercontent.com';

const BUYER_FEATURES = [
  'Busca repuestos compatibles por patente',
  'Cotiza en tiempo real con varias tiendas',
  'Pagos protegidos hasta recibir tu pedido',
  'Sigue tus envíos y compras en un solo lugar',
];

const SELLER_FEATURES = [
  'Publica tu catálogo e inventario en minutos',
  'Recibe solicitudes de cotización de compradores',
  'Administra pedidos, pagos y despachos',
  'Aparece como tienda verificada en la vitrina',
];

function GoogleSignInButton({ onCredential, disabled }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (disabled || !containerRef.current) return;

    let cancelled = false;

    const renderButton = () => {
      if (cancelled || !window.google?.accounts?.id || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      containerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: containerRef.current.offsetWidth || 360,
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      // El script de Google Identity Services carga async; reintentamos hasta que esté listo.
      const intervalId = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(intervalId);
          renderButton();
        }
      }, 200);
      return () => {
        cancelled = true;
        clearInterval(intervalId);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [disabled]);

  if (disabled) {
    return (
      <button type="button" className="btn-auth-google" disabled title="Conectando...">
        <span>Cargando Google Sign-In...</span>
      </button>
    );
  }

  return <div ref={containerRef} className="google-signin-container" />;
}

function GoogleButton({ label }) {
  return (
    <button type="button" className="btn-auth-google" title="Próximamente disponible">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"/>
        <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"/>
      </svg>
      <span>{label}</span>
      <span className="google-badge-soon">Próximamente</span>
    </button>
  );
}

export default function AuthModal({ isOpen, onClose, onOpenSellerRegister, onLoginSuccess }) {
  // El acceso siempre comienza en login. La selección de cuenta sólo aparece
  // al crear una cuenta o cuando el backend confirma que el correo no existe.
  const [step, setStep] = useState('login_form');
  const [selectedRole, setSelectedRole] = useState('BUYER'); // 'BUYER' | 'SELLER'
  const [isRegistrationFlow, setIsRegistrationFlow] = useState(false);
  
  const { login, loginWithGoogle, registerBuyer } = useAuth();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Buyer Register Extra State
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  
  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setStep('login_form');
    setSelectedRole('BUYER');
    setIsRegistrationFlow(false);
    setEmail('');
    setPassword('');
    setBuyerName('');
    setBuyerPhone('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectRole = (role) => {
    setSelectedRole(role);
  };

  const handleContinueFromRole = () => {
    setErrorMessage(null);
    if (isRegistrationFlow) {
      if (selectedRole === 'SELLER') {
        handleClose();
        onOpenSellerRegister();
      } else {
        setStep('register_buyer');
      }
      return;
    }
    setStep('login_form');
  };

  const isAccountNotFound = (result) => {
    if (result?.status === 404) return true;
    return /(?:usuario|correo|cuenta|account|user).{0,40}(?:no existe|no encontrada|not found)/i.test(result?.error || '');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Por favor completa todos los campos.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await login({
      email,
      password,
      preferredRole: selectedRole,
    });

    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage(`¡Bienvenido de nuevo! Has iniciado sesión como ${selectedRole === 'SELLER' ? 'Vendedor' : 'Comprador'}.`);
      setTimeout(() => {
        handleClose();
        onLoginSuccess?.();
      }, 1200);
    } else if (isAccountNotFound(result)) {
      setIsRegistrationFlow(true);
      setErrorMessage('No encontramos una cuenta con este correo. Elige cómo quieres crearla.');
      setStep('select_role');
    } else {
      setErrorMessage(result.error || 'Credenciales inválidas. Verifica tu correo y contraseña.');
    }
  };

  const handleGoogleCredential = async (idToken) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await loginWithGoogle(idToken);

    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage('¡Bienvenido! Has iniciado sesión con Google.');
      setTimeout(() => {
        handleClose();
        onLoginSuccess?.();
      }, 1200);
    } else {
      setErrorMessage(result.error || 'No pudimos iniciar sesión con Google. Verifica que ya tengas una cuenta creada con este correo.');
    }
  };

  const handleBuyerRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !buyerName) {
      setErrorMessage('Por favor completa el nombre, correo y contraseña.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await registerBuyer({
      email,
      password,
      name: buyerName,
      phone: buyerPhone,
    });

    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage('¡Cuenta creada exitosamente! Sesión iniciada como Comprador.');
      setTimeout(() => {
        handleClose();
      }, 1200);
    } else {
      setErrorMessage(result.error || 'Error al registrar la cuenta. Inténtalo nuevamente.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className={`auth-modal-card ${step === 'select_role' ? 'auth-modal-card--wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button className="modal-close-btn" onClick={handleClose}>
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="auth-modal-header">
          <div className="auth-brand-badge">
            <ShieldCheck size={14} /> PORTAL REPUESTOP ACCOUNTS
          </div>
          
          {step === 'select_role' && (
            <>
              <h2>{isRegistrationFlow ? 'Crea tu cuenta' : 'Elige el tipo de cuenta'}</h2>
              <p>{isRegistrationFlow
                ? 'Selecciona el tipo de cuenta que quieres crear en Repuestop.'
                : 'Selecciona cómo deseas ingresar a Repuestop para personalizar tu experiencia.'}
              </p>
            </>
          )}

          {step === 'login_form' && (
            <>
              <div className="selected-role-pill">
                {selectedRole === 'BUYER' ? (
                  <span className="pill-buyer"><Car size={14} /> Modo Comprador</span>
                ) : (
                  <span className="pill-seller"><Store size={14} /> Modo Proveedor / Vendedor</span>
                )}
              </div>
              <h2>Iniciar Sesión</h2>
              <p>Ingresa tus credenciales para acceder a tu panel de {selectedRole === 'BUYER' ? 'compras' : 'ventas'}.</p>
            </>
          )}

          {step === 'register_buyer' && (
            <>
              <h2>Crear Cuenta de Comprador</h2>
              <p>Busca por patente, cotiza repuestos y recibe envíos garantizados a todo Chile.</p>
            </>
          )}
        </div>

        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="auth-alert alert-error">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="auth-alert alert-success">
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* STEP 1: ROLE SELECTION (COMPRADOR VS VENDEDOR) */}
        {step === 'select_role' && (
          <div className="auth-modal-body">
            <div className="role-selection-grid">
              {/* Buyer Card */}
              <div
                className={`role-option-card buyer-card ${selectedRole === 'BUYER' ? 'selected' : ''}`}
                onClick={() => handleSelectRole('BUYER')}
              >
                <div className="role-card-header">
                  <div className="role-icon-box buyer-icon">
                    <Car size={30} />
                  </div>
                  <div className="role-radio">
                    <div className={`radio-dot ${selectedRole === 'BUYER' ? 'active' : ''}`} />
                  </div>
                </div>
                <div className="role-card-content">
                  <h3>Modo Comprador</h3>
                  <p>Busca por patente, cotiza repuestos compatibles y compra de forma segura para tu vehículo.</p>
                </div>
                <ul className="role-feature-list">
                  {BUYER_FEATURES.map((feature) => (
                    <li key={feature}>
                      <Check size={13} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="role-badge-tag">Para Conductores y Talleres</div>
              </div>

              {/* Seller Card */}
              <div
                className={`role-option-card seller-card ${selectedRole === 'SELLER' ? 'selected' : ''}`}
                onClick={() => handleSelectRole('SELLER')}
              >
                <div className="role-card-header">
                  <div className="role-icon-box seller-icon">
                    <Store size={30} />
                  </div>
                  <div className="role-radio">
                    <div className={`radio-dot ${selectedRole === 'SELLER' ? 'active' : ''}`} />
                  </div>
                </div>
                <div className="role-card-content">
                  <h3>Modo Proveedor</h3>
                  <p>Publica productos, recibe solicitudes de cotizaciones y vende directamente desde tu tienda.</p>
                </div>
                <ul className="role-feature-list seller-feature-list">
                  {SELLER_FEATURES.map((feature) => (
                    <li key={feature}>
                      <Check size={13} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="role-badge-tag seller-tag">Para Tiendas y Desarmadurías</div>
              </div>
            </div>

            <div className="auth-action-row">
              <button 
                type="button" 
                className="btn-auth-primary"
                onClick={handleContinueFromRole}
              >
                <span>{isRegistrationFlow ? 'Continuar a crear cuenta' : 'Continuar a Iniciar Sesión'}</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LOGIN FORM */}
        {step === 'login_form' && (
          <form onSubmit={handleLoginSubmit} className="auth-modal-body">
            <GoogleSignInButton onCredential={handleGoogleCredential} disabled={isSubmitting} />

            <div className="auth-divider">
              <span>o ingresa con tu correo</span>
            </div>

            <div className="form-group">
              <label>Correo Electrónico *</label>
              <div className="input-with-icon">
                <Mail size={18} className="field-icon" />
                <input
                  type="email"
                  required
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Contraseña *</label>
              <div className="input-with-icon">
                <Lock size={18} className="field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-toggle-eye"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-secondary-actions">
              <span className="forgot-password-link">¿Olvidaste tu contraseña?</span>
            </div>

            <div className="auth-action-row gap-2">
              <button
                type="button"
                className="btn-auth-secondary"
                onClick={() => {
                  setIsRegistrationFlow(false);
                  setErrorMessage(null);
                  setStep('select_role');
                }}
              >
                <ArrowLeft size={16} />
                <span>Cambiar Rol</span>
              </button>

              <button
                type="submit"
                className="btn-auth-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>Conectando...</span>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>Iniciar Sesión</span>
                  </>
                )}
              </button>
            </div>

            <div className="auth-footer-switch">
              {selectedRole === 'BUYER' ? (
                <p>
                  ¿No tienes cuenta de comprador?{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setErrorMessage(null);
                      setIsRegistrationFlow(true);
                      setStep('select_role');
                    }}
                  >
                    Crear cuenta rápida
                  </button>
                </p>
              ) : (
                <p>
                  ¿Quieres registrar tu tienda o desarmaduría?{' '}
                  <button
                    type="button"
                    className="link-btn highlight"
                    onClick={() => {
                      setIsRegistrationFlow(true);
                      setSelectedRole('SELLER');
                      setErrorMessage(null);
                      setStep('select_role');
                    }}
                  >
                    Postular mi Tienda Vendedora
                  </button>
                </p>
              )}
            </div>
          </form>
        )}

        {/* STEP 3: BUYER REGISTER FORM */}
        {step === 'register_buyer' && (
          <form onSubmit={handleBuyerRegisterSubmit} className="auth-modal-body">
            <GoogleButton label="Registrarme con Google" />

            <div className="auth-divider">
              <span>o regístrate con tu correo</span>
            </div>

            <div className="form-group">
              <label>Nombre y Apellido *</label>
              <input
                type="text"
                required
                placeholder="Ej: Juan Pérez"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Correo Electrónico *</label>
              <div className="input-with-icon">
                <Mail size={18} className="field-icon" />
                <input
                  type="email"
                  required
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Teléfono (opcional para envíos)</label>
              <input
                type="tel"
                placeholder="+56 9 1234 5678"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Contraseña *</label>
              <div className="input-with-icon">
                <Lock size={18} className="field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Crea una contraseña segura"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-toggle-eye"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="auth-action-row gap-2">
              <button
                type="button"
                className="btn-auth-secondary"
                onClick={() => setStep('login_form')}
              >
                <ArrowLeft size={16} />
                <span>Volver al Login</span>
              </button>

              <button
                type="submit"
                className="btn-auth-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>Registrando...</span>
                ) : (
                  <>
                    <UserPlus size={18} />
                    <span>Crear Mi Cuenta</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
