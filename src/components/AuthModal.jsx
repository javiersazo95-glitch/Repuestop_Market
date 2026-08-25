import React, { useState, useEffect, useRef } from 'react';
import {
  Car, Store, ChevronRight, X, Eye, EyeOff, Lock, Mail,
  ShieldCheck, ArrowLeft, AlertCircle, CheckCircle2, UserPlus, LogIn, Check,
  KeyRound, RefreshCw, AlertTriangle, Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import { decodeGoogleIdToken } from '../utils/googleIdToken';
import { resolverUbicacionPorNombre } from '../services/geoLookup';
import { ROUTES } from '../routes/paths';
import {
  recoverPasswordSendCodeApi,
  recoverPasswordVerifyCodeApi,
  recoverPasswordResetApi,
  checkEmailAvailabilityApi,
} from '../services/api';

// ID de cliente OAuth de RepuesTop en Google Cloud (mismo usado por mobile/backoffice/vendedor_panel
// y configurado en el backend vía repuestop.google.client-id). No es un secreto: los client IDs de
// Google son públicos por diseño, la validación real ocurre en el backend contra el idToken firmado.
const GOOGLE_CLIENT_ID = '117201265366-ao32ed2314d1ncce1qt47biide1ij62r.apps.googleusercontent.com';

// Google Identity Services mantiene una única configuración global por página.
// React puede montar efectos dos veces en desarrollo y el modal puede abrirse muchas
// veces, por lo que initialize() no debe vivir dentro del ciclo de vida del botón.
const googleIdentityState = {
  initialized: false,
  activeCredentialHandler: null,
};

function initializeGoogleIdentity(onCredential) {
  if (!window.google?.accounts?.id) return false;

  googleIdentityState.activeCredentialHandler = onCredential;
  if (!googleIdentityState.initialized) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (response?.credential) {
          googleIdentityState.activeCredentialHandler?.(response.credential);
        }
      },
    });
    googleIdentityState.initialized = true;
  }
  return true;
}

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
  const credentialHandlerRef = useRef(onCredential);

  useEffect(() => {
    credentialHandlerRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (disabled || !containerRef.current) return;

    let cancelled = false;
    const currentContainer = containerRef.current;
    const credentialHandler = (credential) => credentialHandlerRef.current?.(credential);

    const renderButton = () => {
      if (cancelled || !currentContainer.isConnected || !initializeGoogleIdentity(credentialHandler)) return;
      currentContainer.replaceChildren();
      window.google.accounts.id.renderButton(currentContainer, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: currentContainer.offsetWidth || 360,
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
        if (googleIdentityState.activeCredentialHandler === credentialHandler) {
          googleIdentityState.activeCredentialHandler = null;
        }
        currentContainer.replaceChildren();
      };
    }

    return () => {
      cancelled = true;
      if (googleIdentityState.activeCredentialHandler === credentialHandler) {
        googleIdentityState.activeCredentialHandler = null;
      }
      currentContainer.replaceChildren();
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
  /**
   * Cuenta de Google que quiso entrar pero todavia no existe en RepuesTop. Guarda
   * el idToken para reusarlo en el alta —el backend lo verifica y saca el correo
   * de ahi— y el perfil ya decodificado, solo para mostrarlo.
   */
  const [googlePending, setGooglePending] = useState(null);
  const [googleTermsAccepted, setGoogleTermsAccepted] = useState(false);
  // El backend exige direccion (comunaId + calle) y aceptacion de terminos para crear
  // la cuenta: `validarComprador` los valida antes de tocar la base.
  const [buyerStreet, setBuyerStreet] = useState('');
  const [buyerComuna, setBuyerComuna] = useState(null); // { id, nombre, region }
  const [buyerComunaError, setBuyerComunaError] = useState('');
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  
  // Password Recovery State
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverRole, setRecoverRole] = useState('CLIENTE'); // 'CLIENTE' | 'PROVEEDOR'
  const [recoverCode, setRecoverCode] = useState('');
  const [recoverNewPassword, setRecoverNewPassword] = useState('');
  const [recoverConfirmPassword, setRecoverConfirmPassword] = useState('');
  const [showRecoverPassword, setShowRecoverPassword] = useState(false);
  const [recoverCooldown, setRecoverCooldown] = useState(0);
  const [isResendingCode, setIsResendingCode] = useState(false);

  // Email check state (Buyer Register)
  const [emailTakenWarning, setEmailTakenWarning] = useState(null);
  const [, setIsCheckingEmail] = useState(false);

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Countdown timer for resending recovery code
  useEffect(() => {
    if (recoverCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setRecoverCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recoverCooldown]);

  if (!isOpen) return null;

  const resetForm = () => {
    setStep('login_form');
    setSelectedRole('BUYER');
    setIsRegistrationFlow(false);
    setEmail('');
    setPassword('');
    setBuyerName('');
    setBuyerPhone('');
    setBuyerStreet('');
    setBuyerComuna(null);
    setBuyerComunaError('');
    setAcceptsTerms(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowPassword(false);
    setRecoverEmail('');
    setRecoverRole('CLIENTE');
    setRecoverCode('');
    setRecoverNewPassword('');
    setRecoverConfirmPassword('');
    setShowRecoverPassword(false);
    setRecoverCooldown(0);
    setEmailTakenWarning(null);
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

  const handleStartRecovery = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setRecoverRole(selectedRole === 'SELLER' ? 'PROVEEDOR' : 'CLIENTE');
    setRecoverEmail(email ? email.trim() : '');
    setRecoverCode('');
    setRecoverNewPassword('');
    setRecoverConfirmPassword('');
    setStep('recover_email');
  };

  const handleSendRecoveryCode = async (e) => {
    e.preventDefault();
    const cleanEmail = recoverEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage(recoverRole === 'PROVEEDOR'
        ? 'Ingresa el RUT de tu tienda.'
        : 'Ingresa tu correo electrónico registrado.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await recoverPasswordSendCodeApi(cleanEmail, recoverRole);
      if (res?.email) setRecoverEmail(res.email);
      setSuccessMessage('Código de recuperación enviado. Revisa tu bandeja de entrada o spam.');
      setRecoverCooldown(60);
      setStep('recover_code');
    } catch (err) {
      setErrorMessage(err.message || 'No se pudo enviar el código. Verifica el correo e inténtalo nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendRecoveryCode = async () => {
    if (recoverCooldown > 0 || isResendingCode) return;
    const cleanEmail = recoverEmail.trim().toLowerCase();
    if (!cleanEmail) return;
    setIsResendingCode(true);
    setErrorMessage(null);
    try {
      await recoverPasswordSendCodeApi(cleanEmail, recoverRole);
      setSuccessMessage('Nuevo código enviado. Revisa tu correo.');
      setRecoverCooldown(60);
    } catch (err) {
      setErrorMessage(err.message || 'No pudimos reenviar el código.');
    } finally {
      setIsResendingCode(false);
    }
  };

  const handleVerifyRecoveryCode = async (e) => {
    e.preventDefault();
    const cleanCode = recoverCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMessage('Ingresa el código de 6 dígitos que recibiste.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await recoverPasswordVerifyCodeApi(recoverEmail.trim().toLowerCase(), cleanCode, recoverRole);
      setSuccessMessage('Código verificado correctamente.');
      setStep('recover_new_password');
    } catch (err) {
      setErrorMessage(err.message || 'Código inválido o expirado. Revisa tu correo o solicita uno nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!recoverNewPassword || recoverNewPassword.length < 6) {
      setErrorMessage('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (recoverNewPassword !== recoverConfirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await recoverPasswordResetApi(
        recoverEmail.trim().toLowerCase(),
        recoverCode.trim(),
        recoverNewPassword,
        recoverRole
      );
      setSuccessMessage('¡Contraseña restablecida exitosamente! Ya puedes iniciar sesión con tu nueva clave.');
      setEmail(recoverEmail.trim().toLowerCase());
      setPassword('');
      setStep('login_form');
    } catch (err) {
      setErrorMessage(err.message || 'No se pudo restablecer la contraseña. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckEmailAvailability = async (emailToCheck) => {
    const clean = String(emailToCheck || '').trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      setEmailTakenWarning(null);
      return;
    }
    setIsCheckingEmail(true);
    try {
      const res = await checkEmailAvailabilityApi(clean);
      if (res?.exists) {
        setEmailTakenWarning('Este correo ya está registrado en RepuesTop.');
      } else {
        setEmailTakenWarning(null);
      }
    } catch {
      setEmailTakenWarning(null);
    } finally {
      setIsCheckingEmail(false);
    }
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
      return;
    }

    // 404 es "no hay cuenta con este correo", la unica situacion en la que
    // ofrecer crearla tiene sentido. Antes cualquier fallo terminaba en un
    // mensaje que mandaba a la persona a registrarse por su cuenta, escribiendo
    // de nuevo el nombre y el correo que Google ya habia entregado.
    const perfil = result.status === 404 ? decodeGoogleIdToken(idToken) : null;
    if (perfil) {
      setGooglePending({ ...perfil, idToken });
      setGoogleTermsAccepted(false);
      setStep('google_signup');
      return;
    }

    setErrorMessage(result.error || 'No pudimos iniciar sesión con Google. Intenta nuevamente.');
  };

  /**
   * Alta con la cuenta de Google, sin formulario de identidad.
   *
   * Google entrega nombre, correo y foto; el telefono y la direccion no los da y
   * ya eran opcionales en el registro por correo, asi que no se piden aca: la
   * direccion se completa en el checkout, que no deja pagar sin una.
   *
   * Los TERMINOS si se piden con casilla explicita. No se pueden dar por
   * aceptados: quedan registrados en `RT_aceptacion_terminos` con su version, y
   * marcarlos por el usuario seria falsear ese registro.
   */
  const handleGoogleSignup = async () => {
    if (!googlePending || !googleTermsAccepted) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const registro = await registerBuyer({
      email: googlePending.email,
      firstName: googlePending.firstName,
      lastName: googlePending.lastName,
      userProfileUrl: googlePending.picture,
      authProvider: 'GOOGLE',
      idToken: googlePending.idToken,
      acceptsTerms: true,
    });

    if (!registro.success) {
      setIsSubmitting(false);
      setErrorMessage(registro.error || 'No pudimos crear tu cuenta con Google.');
      return;
    }

    // El registro con Google no manda codigo de verificacion (el correo ya lo
    // verifico el proveedor), pero no siempre devuelve sesion iniciada: se entra
    // con el mismo idToken, que sigue vigente.
    const acceso = await loginWithGoogle(googlePending.idToken);
    setIsSubmitting(false);

    if (!acceso.success) {
      setErrorMessage('Creamos tu cuenta, pero no pudimos iniciar sesión. Vuelve a entrar con Google.');
      setGooglePending(null);
      setStep('login_form');
      return;
    }

    setSuccessMessage('¡Listo! Tu cuenta quedó creada con Google.');
    setTimeout(() => {
      handleClose();
      onLoginSuccess?.();
    }, 1200);
  };

  /**
   * El backend guarda la direccion por comunaId. Se resuelve desde el nombre que trae la
   * sugerencia; si el catalogo no tiene esa comuna se avisa en vez de dejar al usuario
   * chocar contra un 400 al enviar.
   */
  const resolverComunaDelRegistro = async ({ comuna, region }) => {
    setBuyerComunaError('');
    const resuelto = await resolverUbicacionPorNombre({ comuna, region });
    if (resuelto.comunaId) {
      setBuyerComuna({ id: resuelto.comunaId, nombre: resuelto.comunaNombre, region: resuelto.regionNombre });
    } else {
      setBuyerComuna(null);
      setBuyerComunaError('No reconocimos esa comuna. Prueba con otra dirección cercana.');
    }
  };

  const handleBuyerRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !buyerName) {
      setErrorMessage('Por favor completa el nombre, correo y contraseña.');
      return;
    }
    if (!buyerStreet.trim() || !buyerComuna?.id) {
      setErrorMessage('Elige tu dirección desde las sugerencias para completar el registro.');
      return;
    }
    if (!acceptsTerms) {
      setErrorMessage('Debes aceptar los Términos y Condiciones para crear tu cuenta.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await registerBuyer({
      email,
      password,
      name: buyerName,
      phone: buyerPhone,
      acceptsTerms,
      direccion: { calleYNumero: buyerStreet.trim(), comunaId: buyerComuna.id },
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

          {step === 'recover_email' && (
            <>
              <div className="selected-role-pill">
                <span className={recoverRole === 'PROVEEDOR' ? 'pill-seller' : 'pill-buyer'}>
                  <KeyRound size={14} /> Recuperar Contraseña ({recoverRole === 'PROVEEDOR' ? 'Tienda' : 'Comprador'})
                </span>
              </div>
              <h2>Recuperar Contraseña</h2>
              <p>{recoverRole === 'PROVEEDOR'
                ? 'Ingresa el RUT de tu tienda y enviaremos un código de seguridad al correo registrado.'
                : 'Ingresa el correo electrónico de tu cuenta para enviarte un código de seguridad.'}</p>
            </>
          )}

          {step === 'recover_code' && (
            <>
              <div className="selected-role-pill">
                <span className="pill-buyer"><ShieldCheck size={14} /> Paso 2 de 3 · Verificación</span>
              </div>
              <h2>Ingresa el Código</h2>
              <p>Enviamos un código de 6 dígitos a <strong>{recoverEmail}</strong>.</p>
            </>
          )}

          {step === 'recover_new_password' && (
            <>
              <div className="selected-role-pill">
                <span className="pill-buyer"><Lock size={14} /> Paso 3 de 3 · Nueva Contraseña</span>
              </div>
              <h2>Crear Nueva Contraseña</h2>
              <p>Ingresa tu nueva clave de acceso de al menos 6 caracteres.</p>
            </>
          )}

          {step === 'register_buyer' && (
            <>
              <h2>Crear Cuenta de Comprador</h2>
              <p>Busca por patente, cotiza repuestos y recibe envíos garantizados a todo Chile.</p>
            </>
          )}

          {step === 'google_signup' && (
            <>
              <h2>Crea tu cuenta con Google</h2>
              <p>Ya tenemos tu nombre y tu correo. Solo falta que aceptes los términos.</p>
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
              <button
                type="button"
                className="forgot-password-link"
                style={{ background: 'none', border: 'none', padding: 0 }}
                onClick={handleStartRecovery}
              >
                ¿Olvidaste tu contraseña?
              </button>
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

        {/* RECOVER PASSWORD STEP 1: EMAIL */}
        {step === 'recover_email' && (
          <form onSubmit={handleSendRecoveryCode} className="auth-modal-body">
            <div className="form-group">
              <label>Tipo de cuenta a recuperar</label>
              <div className="role-recovery-toggle">
                <button
                  type="button"
                  className={`btn-role-tab ${recoverRole === 'CLIENTE' ? 'active' : ''}`}
                  onClick={() => setRecoverRole('CLIENTE')}
                >
                  <Car size={15} />
                  <span>Comprador</span>
                </button>
                <button
                  type="button"
                  className={`btn-role-tab ${recoverRole === 'PROVEEDOR' ? 'active' : ''}`}
                  onClick={() => setRecoverRole('PROVEEDOR')}
                >
                  <Store size={15} />
                  <span>Tienda / Proveedor</span>
                </button>
              </div>
            </div>

            <div className="form-group">
              {/* Con rol PROVEEDOR el backend busca SOLO por RUT (`findByTaxId`), nunca
                  por correo: ofrecer las dos opciones dejaba a la tienda con un
                  "Proveedor no encontrado con el RUT ingresado" tras escribir su email. */}
              <label>
                {recoverRole === 'PROVEEDOR' ? 'RUT de la Tienda *' : 'Correo Electrónico Registrado *'}
              </label>
              <div className="input-with-icon">
                {recoverRole === 'PROVEEDOR'
                  ? <Building2 size={18} className="field-icon" />
                  : <Mail size={18} className="field-icon" />}
                <input
                  type={recoverRole === 'PROVEEDOR' ? 'text' : 'email'}
                  required
                  autoFocus
                  placeholder={recoverRole === 'PROVEEDOR' ? '76.123.456-7' : 'ejemplo@correo.com'}
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="auth-action-row gap-2">
              <button
                type="button"
                className="btn-auth-secondary"
                onClick={() => { setErrorMessage(null); setStep('login_form'); }}
              >
                <ArrowLeft size={16} />
                <span>Volver al Login</span>
              </button>

              <button
                type="submit"
                className="btn-auth-primary"
                disabled={isSubmitting || !recoverEmail.trim()}
              >
                {isSubmitting ? (
                  <span>Enviando código...</span>
                ) : (
                  <>
                    <KeyRound size={18} />
                    <span>Enviar Código</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* RECOVER PASSWORD STEP 2: CODE VERIFICATION */}
        {step === 'recover_code' && (
          <form onSubmit={handleVerifyRecoveryCode} className="auth-modal-body">
            <div className="form-group">
              <label>Código de verificación (6 dígitos) *</label>
              <div className="input-with-icon">
                <ShieldCheck size={18} className="field-icon" />
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  placeholder="000000"
                  value={recoverCode}
                  onChange={(e) => setRecoverCode(e.target.value.replace(/\D/g, ''))}
                  style={{ letterSpacing: '4px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}
                />
              </div>
              <small className="auth-address-hint">Revisa también tu carpeta de spam o promociones.</small>
            </div>

            <div className="form-secondary-actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <button
                type="button"
                className="link-btn"
                onClick={handleResendRecoveryCode}
                disabled={recoverCooldown > 0 || isResendingCode}
              >
                {isResendingCode ? (
                  <><RefreshCw size={12} className="spin-icon" /> Reenviando...</>
                ) : recoverCooldown > 0 ? (
                  `Reenviar código en ${recoverCooldown}s`
                ) : (
                  '¿No recibiste el código? Reenviar'
                )}
              </button>
            </div>

            <div className="auth-action-row gap-2">
              <button
                type="button"
                className="btn-auth-secondary"
                onClick={() => { setErrorMessage(null); setStep('recover_email'); }}
              >
                <ArrowLeft size={16} />
                <span>Cambiar Correo</span>
              </button>

              <button
                type="submit"
                className="btn-auth-primary"
                disabled={isSubmitting || recoverCode.trim().length !== 6}
              >
                {isSubmitting ? (
                  <span>Verificando...</span>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Verificar Código</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* RECOVER PASSWORD STEP 3: NEW PASSWORD */}
        {step === 'recover_new_password' && (
          <form onSubmit={handleResetPasswordSubmit} className="auth-modal-body">
            <div className="form-group">
              <label>Nueva Contraseña (mínimo 6 caracteres) *</label>
              <div className="input-with-icon">
                <Lock size={18} className="field-icon" />
                <input
                  type={showRecoverPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  minLength={6}
                  placeholder="Ingresa tu nueva contraseña"
                  value={recoverNewPassword}
                  onChange={(e) => setRecoverNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-toggle-eye"
                  onClick={() => setShowRecoverPassword(!showRecoverPassword)}
                >
                  {showRecoverPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirmar Nueva Contraseña *</label>
              <div className="input-with-icon">
                <Lock size={18} className="field-icon" />
                <input
                  type={showRecoverPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Repite tu nueva contraseña"
                  value={recoverConfirmPassword}
                  onChange={(e) => setRecoverConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="auth-action-row gap-2">
              <button
                type="button"
                className="btn-auth-secondary"
                onClick={() => { setErrorMessage(null); setStep('login_form'); }}
              >
                <ArrowLeft size={16} />
                <span>Cancelar</span>
              </button>

              <button
                type="submit"
                className="btn-auth-primary"
                disabled={isSubmitting || !recoverNewPassword || !recoverConfirmPassword}
              >
                {isSubmitting ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <Check size={18} />
                    <span>Restablecer Contraseña</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2b: ALTA CON GOOGLE (cuando el correo todavia no tiene cuenta) */}
        {step === 'google_signup' && googlePending && (
          <div className="auth-modal-body">
            <div className="google-account-card">
              {googlePending.picture
                ? <img src={googlePending.picture} alt="" referrerPolicy="no-referrer" />
                : <span className="google-account-initials">{(googlePending.nombre || googlePending.email).charAt(0).toUpperCase()}</span>}
              <div>
                <strong>{googlePending.nombre || 'Cuenta de Google'}</strong>
                <span>{googlePending.email}</span>
              </div>
            </div>

            <p className="google-signup-note">
              No pedimos contraseña: entras siempre con Google. Tu dirección de despacho la
              eliges al momento de comprar.
            </p>

            {/* Aceptacion explicita, igual que en el registro por correo: queda en
                `RT_aceptacion_terminos` con su version, asi que marcarla por el
                usuario seria falsear ese registro. */}
            <label className="auth-terms">
              <input
                type="checkbox"
                checked={googleTermsAccepted}
                onChange={(e) => setGoogleTermsAccepted(e.target.checked)}
              />
              <span>
                He leído y acepto los <a href={ROUTES.terms} target="_blank" rel="noreferrer">Términos y Condiciones</a>
                {' '}y la <a href={ROUTES.privacy} target="_blank" rel="noreferrer">Política de Privacidad</a>.
              </span>
            </label>

            <button
              type="button"
              className="btn-auth-primary"
              disabled={!googleTermsAccepted || isSubmitting}
              onClick={handleGoogleSignup}
            >
              {isSubmitting ? 'Creando tu cuenta...' : 'Crear mi cuenta'}
            </button>

            <button
              type="button"
              className="btn-auth-secondary"
              onClick={() => { setGooglePending(null); setStep('login_form'); }}
            >
              Usar otro correo
            </button>
          </div>
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailTakenWarning) setEmailTakenWarning(null);
                  }}
                  onBlur={() => handleCheckEmailAvailability(email)}
                />
              </div>
              {emailTakenWarning && (
                <div className="auth-alert alert-error" style={{ margin: '6px 0 0', padding: '8px 12px' }}>
                  <AlertTriangle size={15} />
                  <span>
                    {emailTakenWarning}{' '}
                    <button
                      type="button"
                      className="link-btn"
                      style={{ color: '#991b1b', textDecoration: 'underline', fontWeight: 'bold' }}
                      onClick={() => { setErrorMessage(null); setStep('login_form'); }}
                    >
                      Iniciar Sesión
                    </button>
                  </span>
                </div>
              )}
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
              <label>Dirección de despacho *</label>
              <AddressAutocompleteInput
                value={buyerStreet}
                onChange={(valor) => { setBuyerStreet(valor); setBuyerComuna(null); }}
                onSelectLocation={resolverComunaDelRegistro}
                placeholder="Escribe tu calle y elige una sugerencia"
                required
              />
              {buyerComuna
                ? <small className="auth-address-hint is-ok"><Check size={13} /> {buyerComuna.nombre}{buyerComuna.region ? `, ${buyerComuna.region}` : ''}</small>
                : <small className="auth-address-hint">{buyerComunaError || 'Elige una sugerencia para detectar tu comuna.'}</small>}
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

            {/* Aceptacion explicita: el backend la exige (`validarTerminos`) y la guarda
                en `accepts_terms` / `terms_accepted_at`. */}
            <label className="auth-terms">
              <input
                type="checkbox"
                checked={acceptsTerms}
                onChange={(e) => setAcceptsTerms(e.target.checked)}
              />
              <span>
                He leído y acepto los <a href={ROUTES.terms} target="_blank" rel="noreferrer">Términos y Condiciones</a>
                {' '}y la <a href={ROUTES.privacy} target="_blank" rel="noreferrer">Política de Privacidad</a>.
              </span>
            </label>

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
