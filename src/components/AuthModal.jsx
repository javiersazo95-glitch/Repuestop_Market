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

export default function AuthModal({ isOpen, onClose, onOpenSellerRegister, onLoginSuccess }) {
  // El acceso siempre comienza en login. La selección de cuenta sólo aparece
  // al crear una cuenta o cuando el backend confirma que el correo no existe.
  const [step, setStep] = useState('login_form');
  const [selectedRole, setSelectedRole] = useState('BUYER'); // 'BUYER' | 'SELLER'
  const [isRegistrationFlow, setIsRegistrationFlow] = useState(false);
  
  const { login, loginWithGoogle, registerBuyer, verifyRegisterEmail, resendRegisterCode } = useAuth();

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
  // Que campos pedirle al usuario se decide UNA sola vez, con lo que Google entrego
  // en el idToken. Si se recalcula en cada render contra `googlePending.firstName`/
  // `lastName` -que el propio input va llenando-, el campo se autodesmonta apenas se
  // escribe el primer caracter: la condicion que lo mostraba pasa a ser falsa.
  const [googleMissingFields, setGoogleMissingFields] = useState({ firstName: false, lastName: false });
  const [googleTermsAccepted, setGoogleTermsAccepted] = useState(false);
  // El backend exige direccion (comunaId + calle) y aceptacion de terminos para crear
  // la cuenta: `validarComprador` los valida antes de tocar la base.
  const [buyerStreet, setBuyerStreet] = useState('');
  const [buyerComuna, setBuyerComuna] = useState(null); // { id, nombre, region }
  const [buyerComunaError, setBuyerComunaError] = useState('');
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  
  // Password Recovery State
  // `recoverIdentifier` es lo que el usuario ESCRIBE (correo del comprador o RUT de la
  // tienda) y es lo unico que acepta `send-code`; `recoverEmail` es el correo registrado
  // que responde el backend y el unico que aceptan `verify-code` y `reset`. Con rol
  // PROVEEDOR son valores distintos: pisar uno con el otro rompia el reenvio.
  const [recoverIdentifier, setRecoverIdentifier] = useState('');
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
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailIsAvailable, setEmailIsAvailable] = useState(null);
  const [buyerTouched, setBuyerTouched] = useState({
    name: false,
    email: false,
    phone: false,
    password: false,
    address: false,
  });

  // Validaciones reactivas para registro de comprador
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isNameValid = buyerName.trim().split(/\s+/).filter(Boolean).length >= 2;
  const isEmailFormatValid = emailRegex.test(email.trim());
  const isEmailValid = isEmailFormatValid && !emailTakenWarning;
  const isPasswordLengthValid = password.length >= 6 && password.length <= 32;
  const isAddressValid = Boolean(buyerStreet.trim().length > 0 && buyerComuna?.id);

  const getPasswordStrength = (pwd) => {
    if (!pwd || pwd.length < 6) return { score: 1, label: 'Débil', color: '#ef4444' };
    let score = 1;
    const hasLetters = /[a-zA-Z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    if (pwd.length >= 6 && hasLetters && hasNumbers) score = 2;
    if (pwd.length >= 8 && ((hasLetters && hasNumbers && hasSpecial) || pwd.length >= 10)) score = 3;

    if (score === 3) return { score: 3, label: 'Segura', color: '#10b981' };
    if (score === 2) return { score: 2, label: 'Aceptable', color: '#f59e0b' };
    return { score: 1, label: 'Mínimo 6 car.', color: '#ef4444' };
  };
  const passwordStrength = getPasswordStrength(password);

  const isBuyerFormValid = Boolean(
    isNameValid &&
    isEmailValid &&
    isPasswordLengthValid &&
    isAddressValid &&
    acceptsTerms
  );

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Register Email Verification State
  const [registerVerifyCode, setRegisterVerifyCode] = useState('');
  const [registerCooldown, setRegisterCooldown] = useState(0);
  const [isResendingRegisterCode, setIsResendingRegisterCode] = useState(false);

  // Countdown timer for resending recovery code
  useEffect(() => {
    if (recoverCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setRecoverCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recoverCooldown]);

  // Countdown timer for resending registration code
  useEffect(() => {
    if (registerCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setRegisterCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [registerCooldown]);

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
    setGooglePending(null);
    setGoogleMissingFields({ firstName: false, lastName: false });
    setGoogleTermsAccepted(false);
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
    setRecoverIdentifier('');
    setEmailTakenWarning(null);
    setEmailIsAvailable(null);
    setIsCheckingEmail(false);
    setBuyerTouched({ name: false, email: false, phone: false, password: false, address: false });
    setRegisterVerifyCode('');
    setRegisterCooldown(0);
    setIsResendingRegisterCode(false);
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
    const nextRole = selectedRole === 'SELLER' ? 'PROVEEDOR' : 'CLIENTE';
    setRecoverRole(nextRole);
    // Con rol tienda el campo pide el RUT: prellenarlo con el correo del login dejaba
    // un email dentro de un campo de RUT.
    setRecoverIdentifier(nextRole === 'PROVEEDOR' ? '' : (email ? email.trim() : ''));
    setRecoverEmail('');
    setRecoverCode('');
    setRecoverNewPassword('');
    setRecoverConfirmPassword('');
    setStep('recover_email');
  };

  const handleSendRecoveryCode = async (e) => {
    e.preventDefault();
    const cleanIdentifier = recoverIdentifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage(recoverRole === 'PROVEEDOR'
        ? 'Ingresa el RUT de tu tienda.'
        : 'Ingresa tu correo electrónico registrado.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await recoverPasswordSendCodeApi(cleanIdentifier, recoverRole);
      setRecoverEmail(res?.email || cleanIdentifier);
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
    // Se reenvia con el identificador ORIGINAL: con rol PROVEEDOR el backend resuelve
    // por RUT (`findByTaxId`) y el correo registrado le da 404.
    const cleanIdentifier = recoverIdentifier.trim();
    if (!cleanIdentifier) return;
    setIsResendingCode(true);
    setErrorMessage(null);
    try {
      await recoverPasswordSendCodeApi(cleanIdentifier, recoverRole);
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
    if (!clean || !emailRegex.test(clean)) {
      setEmailTakenWarning(null);
      setEmailIsAvailable(null);
      return;
    }
    setIsCheckingEmail(true);
    try {
      const res = await checkEmailAvailabilityApi(clean);
      if (res?.exists) {
        setEmailTakenWarning('Este correo ya está registrado en RepuesTop.');
        setEmailIsAvailable(false);
      } else {
        setEmailTakenWarning(null);
        setEmailIsAvailable(true);
      }
    } catch {
      setEmailTakenWarning(null);
      setEmailIsAvailable(null);
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
      setGoogleMissingFields({ firstName: !perfil.firstName?.trim(), lastName: !perfil.lastName?.trim() });
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
    const firstName = googlePending.firstName?.trim();
    const lastName = googlePending.lastName?.trim();
    if (!firstName || !lastName) {
      setErrorMessage('Para crear tu cuenta necesitamos indicar tu nombre y apellido.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    const registro = await registerBuyer({
      email: googlePending.email,
      firstName,
      lastName,
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
    setBuyerTouched({ name: true, email: true, phone: true, password: true, address: true });

    const cleanName = buyerName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = buyerPhone.trim();
    const cleanPassword = password;

    if (!isBuyerFormValid) {
      if (!cleanName || !cleanEmail || !cleanPassword) {
        setErrorMessage('Por favor completa todos los campos obligatorios.');
      } else if (!isEmailFormatValid) {
        setErrorMessage('Ingresa un correo electrónico válido.');
      } else if (emailTakenWarning) {
        setErrorMessage('Este correo ya está registrado en RepuesTop. Inicia sesión.');
      } else if (!isNameValid) {
        setErrorMessage('Ingresa tu nombre y apellido separados por un espacio.');
      } else if (!isPasswordLengthValid) {
        setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      } else if (!isAddressValid) {
        setErrorMessage('Elige tu dirección desde las sugerencias para detectar tu comuna.');
      } else if (!acceptsTerms) {
        setErrorMessage('Debes aceptar los Términos y Condiciones para crear tu cuenta.');
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await registerBuyer({
      email: cleanEmail,
      password: cleanPassword,
      name: cleanName,
      phone: cleanPhone || undefined,
      acceptsTerms,
      direccion: { calleYNumero: buyerStreet.trim(), comunaId: buyerComuna.id },
    });

    setIsSubmitting(false);

    if (result.success) {
      if (result.data?.pendingEmailVerification) {
        setRegisterVerifyCode('');
        setRegisterCooldown(60);
        setSuccessMessage('¡Cuenta creada! Enviamos un código de 6 dígitos a tu correo para activar tu cuenta.');
        setStep('register_verify_email');
        return;
      }
      setSuccessMessage('¡Cuenta creada exitosamente! Sesión iniciada como Comprador.');
      setTimeout(() => {
        handleClose();
        onLoginSuccess?.();
      }, 1200);
    } else {
      setErrorMessage(result.error || 'Error al registrar la cuenta. Inténtalo nuevamente.');
    }
  };

  const handleVerifyRegisterCode = async (e) => {
    e.preventDefault();
    const cleanCode = registerVerifyCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMessage('Ingresa el código de 6 dígitos que enviamos a tu correo.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await verifyRegisterEmail(email.trim().toLowerCase(), cleanCode);
      if (res.success) {
        setSuccessMessage('¡Correo verificado con éxito! Bienvenido a RepuesTop.');
        setTimeout(() => {
          handleClose();
          onLoginSuccess?.();
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Código incorrecto o expirado. Revisa tu correo o solicita uno nuevo.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'No se pudo verificar el código. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendRegisterCode = async () => {
    if (registerCooldown > 0 || isResendingRegisterCode) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setIsResendingRegisterCode(true);
    setErrorMessage(null);
    try {
      await resendRegisterCode(cleanEmail);
      setSuccessMessage('Nuevo código enviado. Revisa tu bandeja de entrada o spam.');
      setRegisterCooldown(60);
    } catch (err) {
      setErrorMessage(err.message || 'No pudimos reenviar el código. Inténtalo de nuevo.');
    } finally {
      setIsResendingRegisterCode(false);
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

          {step === 'register_verify_email' && (
            <>
              <div className="selected-role-pill">
                <span className="pill-buyer"><ShieldCheck size={14} /> Paso 2 de 2 · Activación de Cuenta</span>
              </div>
              <h2>Verifica tu Correo</h2>
              <p>Enviamos un código de 6 dígitos a <strong>{email}</strong>.</p>
            </>
          )}

          {step === 'google_signup' && (
            <>
              <h2>Crea tu cuenta con Google</h2>
              <p>Confirma tus datos y acepta los términos para crear tu cuenta.</p>
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
                  onClick={() => { setRecoverRole('CLIENTE'); setRecoverIdentifier(''); setErrorMessage(null); }}
                >
                  <Car size={15} />
                  <span>Comprador</span>
                </button>
                <button
                  type="button"
                  className={`btn-role-tab ${recoverRole === 'PROVEEDOR' ? 'active' : ''}`}
                  onClick={() => { setRecoverRole('PROVEEDOR'); setRecoverIdentifier(''); setErrorMessage(null); }}
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
                  value={recoverIdentifier}
                  onChange={(e) => setRecoverIdentifier(e.target.value)}
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
                disabled={isSubmitting || !recoverIdentifier.trim()}
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
                onClick={() => { setErrorMessage(null); setSuccessMessage(null); setStep('recover_email'); }}
              >
                <ArrowLeft size={16} />
                <span>{recoverRole === 'PROVEEDOR' ? 'Cambiar RUT' : 'Cambiar Correo'}</span>
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

            {/* Algunas cuentas de Google no publican `family_name` (por ejemplo,
                perfiles con un solo nombre). El esquema de comprador sí exige ambos
                datos, así que los completamos explícitamente antes de enviar. */}
            {googleMissingFields.firstName && (
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  autoComplete="given-name"
                  placeholder="Ingresa tu nombre"
                  value={googlePending.firstName || ''}
                  onChange={(e) => setGooglePending((pending) => ({ ...pending, firstName: e.target.value }))}
                />
                <small className="auth-address-hint">Google no entregó este dato y es necesario para tu perfil.</small>
              </div>
            )}
            {googleMissingFields.lastName && (
              <div className="form-group">
                <label>Apellido *</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  autoComplete="family-name"
                  placeholder="Ingresa tu apellido"
                  value={googlePending.lastName || ''}
                  onChange={(e) => setGooglePending((pending) => ({ ...pending, lastName: e.target.value }))}
                />
                <small className="auth-address-hint">Google no entregó este dato y es necesario para tu perfil.</small>
              </div>
            )}

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
            <GoogleSignInButton onCredential={handleGoogleCredential} disabled={isSubmitting} />

            <div className="auth-divider">
              <span>o regístrate con tu correo</span>
            </div>

            <div className="form-group">
              <label>Nombre y Apellido *</label>
              <input
                type="text"
                required
                maxLength={80}
                placeholder="Ej: Juan Pérez"
                value={buyerName}
                className={((buyerTouched.name && !buyerName.trim()) || (buyerName.trim().length > 0 && !isNameValid)) ? 'has-error' : (isNameValid ? 'has-success' : '')}
                onChange={(e) => setBuyerName(e.target.value)}
                onBlur={() => setBuyerTouched((prev) => ({ ...prev, name: true }))}
              />
              {buyerTouched.name && !buyerName.trim() && (
                <small className="auth-field-error">
                  <AlertCircle size={13} /> El nombre y apellido son obligatorios.
                </small>
              )}
              {buyerName.trim().length > 0 && !isNameValid && (
                <small className="auth-field-error">
                  <AlertCircle size={13} /> Ingresa tu nombre y apellido separados por un espacio.
                </small>
              )}
              {isNameValid && (
                <small className="auth-field-success">
                  <Check size={13} /> Nombre completo válido
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Correo Electrónico *</label>
              <div className={`input-with-icon ${(buyerTouched.email && !email.trim()) || (email.trim().length > 0 && !isEmailFormatValid) || emailTakenWarning ? 'has-error' : (isEmailValid && emailIsAvailable ? 'has-success' : '')}`}>
                <Mail size={18} className="field-icon" />
                <input
                  type="email"
                  required
                  maxLength={120}
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    if (emailTakenWarning) setEmailTakenWarning(null);
                    setEmailIsAvailable(null);
                    if (emailRegex.test(val.trim())) {
                      handleCheckEmailAvailability(val);
                    }
                  }}
                  onBlur={() => {
                    setBuyerTouched((prev) => ({ ...prev, email: true }));
                    if (email.trim() && emailRegex.test(email.trim())) {
                      handleCheckEmailAvailability(email);
                    }
                  }}
                />
              </div>
              {buyerTouched.email && !email.trim() && (
                <small className="auth-field-error">
                  <AlertCircle size={13} /> El correo electrónico es obligatorio.
                </small>
              )}
              {email.trim().length > 0 && !isEmailFormatValid && (
                <small className="auth-field-error">
                  <AlertCircle size={13} /> Ingresa un correo electrónico válido (ej: nombre@correo.com).
                </small>
              )}
              {isCheckingEmail && (
                <small className="auth-field-hint">
                  <RefreshCw size={12} className="spin-icon" /> Comprobando disponibilidad...
                </small>
              )}
              {isEmailFormatValid && emailIsAvailable && !emailTakenWarning && (
                <small className="auth-field-success">
                  <Check size={13} /> Correo disponible
                </small>
              )}
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
                maxLength={15}
                placeholder="+56 9 1234 5678"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value.replace(/[^\d+ ]/g, ''))}
                onBlur={() => setBuyerTouched((prev) => ({ ...prev, phone: true }))}
              />
              {buyerPhone.trim().length > 0 && buyerPhone.replace(/\D/g, '').length < 8 && (
                <small className="auth-field-warning">
                  <AlertCircle size={13} /> Se recomienda ingresar el número completo (ej: +56 9 1234 5678).
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Dirección de despacho *</label>
              <AddressAutocompleteInput
                value={buyerStreet}
                onChange={(valor) => {
                  setBuyerStreet(valor);
                  setBuyerComuna(null);
                  setBuyerTouched((prev) => ({ ...prev, address: true }));
                }}
                onSelectLocation={resolverComunaDelRegistro}
                placeholder="Escribe tu calle y elige una sugerencia"
                maxLength={160}
                required
              />
              {buyerComuna ? (
                <small className="auth-address-hint is-ok">
                  <Check size={13} /> {buyerComuna.nombre}{buyerComuna.region ? `, ${buyerComuna.region}` : ''}
                </small>
              ) : buyerStreet.trim().length > 0 ? (
                <small className="auth-field-warning">
                  <AlertCircle size={13} /> Elige una sugerencia de la lista para detectar tu comuna de despacho.
                </small>
              ) : (
                <small className="auth-address-hint">
                  {buyerComunaError || 'Escribe tu calle y elige una sugerencia de la lista.'}
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Contraseña *</label>
              <div className={`input-with-icon ${(buyerTouched.password && !password) || (password.length > 0 && !isPasswordLengthValid) ? 'has-error' : (isPasswordLengthValid ? 'has-success' : '')}`}>
                <Lock size={18} className="field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  maxLength={32}
                  placeholder="Crea una contraseña segura (mín. 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setBuyerTouched((prev) => ({ ...prev, password: true }))}
                />
                <button
                  type="button"
                  className="btn-toggle-eye"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {password.length > 0 && (
                <div className="password-strength-container">
                  <div className={`password-strength-meter strength-${passwordStrength.score}`}>
                    <div className="bar" />
                    <div className="bar" />
                    <div className="bar" />
                  </div>
                  <div className="password-strength-meta">
                    <small style={{ color: passwordStrength.color, fontWeight: 600 }}>
                      Seguridad: {passwordStrength.label}
                    </small>
                    <small className="char-counter">
                      {password.length}/6 mín.
                    </small>
                  </div>
                </div>
              )}

              {buyerTouched.password && !password && (
                <small className="auth-field-error">
                  <AlertCircle size={13} /> La contraseña es obligatoria.
                </small>
              )}
              {password.length > 0 && !isPasswordLengthValid && (
                <small className="auth-field-error">
                  <AlertCircle size={13} /> La contraseña debe tener al menos 6 caracteres (llevas {password.length}/6).
                </small>
              )}
              {isPasswordLengthValid && (
                <small className="auth-field-success">
                  <Check size={13} /> Longitud válida
                </small>
              )}
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

            {!isBuyerFormValid && (
              <div className="auth-validation-summary">
                {!isNameValid ? (
                  <span><AlertCircle size={13} /> Falta ingresar nombre y apellido</span>
                ) : !isEmailFormatValid ? (
                  <span><AlertCircle size={13} /> Falta ingresar un correo electrónico válido</span>
                ) : emailTakenWarning ? (
                  <span><AlertCircle size={13} /> El correo ya está registrado en RepuesTop</span>
                ) : !isAddressValid ? (
                  <span><AlertCircle size={13} /> Falta seleccionar tu dirección desde las sugerencias</span>
                ) : !isPasswordLengthValid ? (
                  <span><AlertCircle size={13} /> La contraseña debe tener al menos 6 caracteres ({password.length}/6)</span>
                ) : !acceptsTerms ? (
                  <span><AlertCircle size={13} /> Debes aceptar los Términos y Condiciones</span>
                ) : null}
              </div>
            )}

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
                disabled={isSubmitting || !isBuyerFormValid}
                title={!isBuyerFormValid ? "Completa todos los campos obligatorios para activar este botón" : undefined}
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

        {/* STEP 4: REGISTER EMAIL VERIFICATION */}
        {step === 'register_verify_email' && (
          <form onSubmit={handleVerifyRegisterCode} className="auth-modal-body">
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
                  value={registerVerifyCode}
                  onChange={(e) => setRegisterVerifyCode(e.target.value.replace(/\D/g, ''))}
                  style={{ letterSpacing: '4px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}
                />
              </div>
              <small className="auth-address-hint">Revisa también tu carpeta de spam o promociones.</small>
            </div>

            <div className="form-secondary-actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <button
                type="button"
                className="link-btn"
                onClick={handleResendRegisterCode}
                disabled={registerCooldown > 0 || isResendingRegisterCode}
              >
                {isResendingRegisterCode ? (
                  <><RefreshCw size={12} className="spin-icon" /> Reenviando...</>
                ) : registerCooldown > 0 ? (
                  `Reenviar código en ${registerCooldown}s`
                ) : (
                  '¿No recibiste el código? Reenviar'
                )}
              </button>
            </div>

            <div className="auth-action-row gap-2">
              <button
                type="button"
                className="btn-auth-secondary"
                onClick={() => { setErrorMessage(null); setSuccessMessage(null); setStep('register_buyer'); }}
              >
                <ArrowLeft size={16} />
                <span>Volver a Editar</span>
              </button>

              <button
                type="submit"
                className="btn-auth-primary"
                disabled={isSubmitting || registerVerifyCode.trim().length !== 6}
              >
                {isSubmitting ? (
                  <span>Verificando...</span>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Activar Cuenta</span>
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
