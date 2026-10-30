import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { resolverUbicacionPorNombre } from '../services/geoLookup';
import { decodeGoogleIdToken, tomarGoogleParaTaller } from '../utils/googleIdToken';
import { formatRut, isValidRut } from '../services/adapters';
import { ROUTES } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';

/**
 * `/taller/registro`: crea la cuenta de un taller automotriz (rol propio). Pide los datos del responsable y del taller;
 * los documentos de acreditación se suben después desde el perfil. El correo se verifica con un código, como el resto;
 * con Google no hace falta código ni contraseña, igual que en la app (`useRegisterWorkshopScreen`).
 */
// Giro comercial (el backend lo exige: AuthService.registrarTaller). Las mismas opciones que la app
// (`mobile/app/(auth)/register-workshop.tsx`); "Otro" pide escribirlo, hasta 180 caracteres.
const WORKSHOP_GIROS = [
  'Mantenimiento y reparación de vehículos automotores',
  'Diagnóstico automotriz',
  'Electricidad y electrónica automotriz',
  'Frenos, suspensión y dirección',
  'Desabolladura y pintura automotriz',
  'Neumáticos, alineación y balanceo',
  'Mantención y reparación de motocicletas',
  'Servicio automotriz a domicilio',
  'Venta e instalación de repuestos y accesorios',
];
const OTHER_GIRO = 'other';

export default function WorkshopRegisterPage() {
  useDocumentTitle('Registra tu taller');
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, loginWithGoogle, registerWorkshop, verifyRegisterEmail, resendRegisterCode } = useAuth();
  const [form, setForm] = useState({ responsibleName: '', workshopName: '', taxId: '', giro: '', giroOtro: '', email: location.state?.email || '', phone: '', password: '', address: '' });
  const [place, setPlace] = useState(null);
  const [accepts, setAccepts] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Cuenta de Google elegida aqui o en el modal de acceso: { idToken, email, nombre, picture }.
  const [google, setGoogle] = useState(() => tomarGoogleParaTaller());
  // Google ya entrega el nombre: queda escrito y se puede corregir.
  useEffect(() => {
    if (google?.nombre) setForm((current) => (current.responsibleName ? current : { ...current, responsibleName: google.nombre }));
  }, [google]);
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (isLoggedIn && !done) return <Navigate to={`${ROUTES.profile}/resumen`} replace />;

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  // Si ese Google ya tiene cuenta entra directo; si no, sigue aqui sin pedir correo ni contraseña.
  const handleGoogleCredential = async (idToken) => {
    setError('');
    setBusy(true);
    const result = await loginWithGoogle(idToken);
    setBusy(false);
    if (result.success) return;
    const perfil = result.status === 404 || result.requiresRegistration ? decodeGoogleIdToken(idToken) : null;
    if (!perfil) { setError(result.error || 'No pudimos verificar tu cuenta de Google.'); return; }
    setGoogle({ ...perfil, idToken });
  };

  const pickLocation = async ({ comuna, region }) => {
    const resolved = await resolverUbicacionPorNombre({ comuna, region });
    setPlace(resolved.comunaId ? { comunaId: resolved.comunaId, comuna, region: region || '' } : null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const responsibleName = form.responsibleName.trim();
    if (!responsibleName || !form.workshopName.trim()) return setError('Indica tu nombre y el nombre del taller.');
    if (!isValidRut(form.taxId)) return setError('Ingresa un RUT válido (con dígito verificador).');
    const giro = (form.giro === OTHER_GIRO ? form.giroOtro : form.giro).trim();
    if (!giro) return setError(form.giro === OTHER_GIRO ? 'Describe el giro de tu taller.' : 'Selecciona el giro comercial de tu taller.');
    if (!google && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Ingresa un correo válido.');
    if (!/^9\d{8}$/.test(form.phone.replace(/\D/g, ''))) return setError('Ingresa un celular chileno de 9 dígitos que empiece con 9.');
    if (!google && form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (!form.address.trim() || !/\d/.test(form.address) || !place) return setError('Escribe la dirección del taller con su número y elige una de las sugerencias para ubicar la comuna.');
    if (!accepts) return setError('Debes aceptar los Términos y Condiciones para crear tu cuenta.');
    setBusy(true);
    const { giroOtro: _giroOtro, ...fields } = form;
    const result = await registerWorkshop({
      ...fields,
      responsibleName,
      email: google ? google.email : fields.email,
      idToken: google?.idToken,
      userProfileUrl: google?.picture,
      giro,
      phone: form.phone.replace(/\D/g, ''),
      acceptsTerms: true,
      direccion: { comunaId: place.comunaId, calleYNumero: form.address.trim() },
    });
    setBusy(false);
    if (!result.success) return setError(result.error || 'No pudimos crear la cuenta del taller.');
    if (result.data?.pendingEmailVerification) setPendingEmail(result.data.email || form.email.trim().toLowerCase());
    else setDone(true);
  };

  const verify = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const result = await verifyRegisterEmail(pendingEmail, code);
    setBusy(false);
    if (!result.success) return setError(result.error || 'El código no es válido.');
    setPendingEmail('');
    setDone(true);
  };

  const shell = (title, subtitle, body) => (
    <div className="taller-register-page">
      <div className="auth-modal-card" style={{ maxHeight: 'none', overflow: 'visible' }}>
        <div className="auth-modal-header">
          <div className="auth-brand-badge"><ShieldCheck size={14} /> PORTAL REPUESTOP ACCOUNTS</div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {body}
      </div>
    </div>
  );

  const errorBox = error && <div className="auth-alert alert-error" role="alert"><AlertCircle size={16} /> <span>{error}</span></div>;

  if (done) {
    return shell('Taller creado', 'Tu cuenta quedó lista. Falta acreditar tu negocio para aparecer en el buscador y comentar fallas: sube tu identidad, inicio de actividades y patente municipal.', (
      <div className="auth-modal-body">
        <button type="button" className="btn-auth-primary" onClick={() => navigate(`${ROUTES.profile}/resumen`, { replace: true })}><CheckCircle2 size={18} /> <span>Ir a mi perfil</span></button>
      </div>
    ));
  }

  if (pendingEmail) {
    return shell('Verifica tu correo', `Te enviamos un código de 6 dígitos a ${pendingEmail}.`, (
      <form className="auth-modal-body" onSubmit={verify}>
        {errorBox}
        <div className="form-group">
          <label htmlFor="workshop-code">Código de verificación *</label>
          <input id="workshop-code" type="text" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="auth-action-row gap-2">
          <button type="button" className="btn-auth-secondary" disabled={busy} onClick={async () => { const r = await resendRegisterCode(pendingEmail); setError(r?.success === false ? (r.error || 'No pudimos reenviar el código.') : ''); }}>Reenviar código</button>
          <button type="submit" className="btn-auth-primary" disabled={busy || code.length < 6}>{busy ? 'Verificando…' : 'Verificar código'}</button>
        </div>
      </form>
    ));
  }

  return shell('Crear cuenta de taller', 'Ofrece tus servicios, comenta fallas y recibe citas. Los documentos de acreditación se suben después, desde tu perfil.', (
    <form className="auth-modal-body" onSubmit={submit}>
      {errorBox}
      {google ? (
        <div className="google-account-card">
          {google.picture
            ? <img src={google.picture} alt="" referrerPolicy="no-referrer" />
            : <span className="google-account-initials">{(google.nombre || google.email).charAt(0).toUpperCase()}</span>}
          <div>
            <strong>{google.nombre || 'Cuenta de Google'}</strong>
            <span>{google.email}</span>
          </div>
        </div>
      ) : (
        <>
          <GoogleSignInButton onCredential={handleGoogleCredential} disabled={busy} />
          <div className="auth-divider"><span>o regístrate con tu correo</span></div>
        </>
      )}

      <h3 className="taller-register-title">Tus datos</h3>
      <div className="form-group">
        <label htmlFor="workshop-responsible">Nombre del responsable *</label>
        <input id="workshop-responsible" type="text" value={form.responsibleName} maxLength={80} placeholder="Ej: Juan Pérez" autoComplete="name" onChange={set('responsibleName')} />
      </div>
      {!google && (
      <div className="form-group">
        <label htmlFor="workshop-email">Correo Electrónico *</label>
        <div className="input-with-icon">
          <Mail size={18} className="field-icon" />
          <input id="workshop-email" type="email" value={form.email} maxLength={120} placeholder="ejemplo@correo.com" autoComplete="email" onChange={set('email')} />
        </div>
      </div>
      )}
      <div className="form-group">
        <label htmlFor="workshop-phone">Celular *</label>
        <input id="workshop-phone" type="tel" inputMode="numeric" value={form.phone} maxLength={9} placeholder="912345678" autoComplete="tel" onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value.replace(/\D/g, '') }))} />
      </div>
      {!google && (
      <div className="form-group">
        <label htmlFor="workshop-password">Contraseña *</label>
        <div className="input-with-icon">
          <Lock size={18} className="field-icon" />
          <input id="workshop-password" type={showPassword ? 'text' : 'password'} value={form.password} maxLength={32} placeholder="Mínimo 8 caracteres" autoComplete="new-password" onChange={set('password')} />
          <button type="button" className="btn-toggle-eye" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      )}

      <h3 className="taller-register-title">Tu taller</h3>
      <div className="form-group">
        <label htmlFor="workshop-name">Nombre del taller *</label>
        <input id="workshop-name" type="text" value={form.workshopName} maxLength={120} onChange={set('workshopName')} />
      </div>
      <div className="form-group">
        <label htmlFor="workshop-rut">RUT empresa o persona *</label>
        <input id="workshop-rut" type="text" value={form.taxId} maxLength={12} placeholder="12.345.678-9" onChange={(e) => setForm((c) => ({ ...c, taxId: formatRut(e.target.value) }))} />
      </div>
      <div className="form-group">
        <label htmlFor="workshop-giro">Giro comercial *</label>
        <select id="workshop-giro" value={form.giro} onChange={(e) => setForm((c) => ({ ...c, giro: e.target.value, giroOtro: e.target.value === OTHER_GIRO ? c.giroOtro : '' }))}>
          <option value="">Selecciona el giro de tu taller</option>
          {WORKSHOP_GIROS.map((item) => <option key={item} value={item}>{item}</option>)}
          <option value={OTHER_GIRO}>Otro</option>
        </select>
      </div>
      {form.giro === OTHER_GIRO && (
        <div className="form-group">
          <label htmlFor="workshop-giro-other">Especifica el giro de tu taller *</label>
          <input id="workshop-giro-other" type="text" value={form.giroOtro} maxLength={180} placeholder="Describe el giro de tu taller" onChange={set('giroOtro')} />
        </div>
      )}
      <div className="form-group">
        <label>Dirección del taller *</label>
        <AddressAutocompleteInput value={form.address} onChange={(value) => { setForm((c) => ({ ...c, address: value })); setPlace(null); }} onSelectLocation={pickLocation} requireComuna={false} placeholder="Calle y número, comuna (Ej: Av. Italia 1234, Ñuñoa)" />
        {place && <small className="auth-field-success"><Check size={13} /> Comuna: {[place.comuna, place.region].filter(Boolean).join(', ')}</small>}
      </div>

      <label className="auth-terms">
        <input type="checkbox" checked={accepts} onChange={(e) => setAccepts(e.target.checked)} />
        <span>He leído y acepto los <a href={ROUTES.terms} target="_blank" rel="noreferrer">Términos y Condiciones</a> y la <a href={ROUTES.privacy} target="_blank" rel="noreferrer">Política de Privacidad</a>.</span>
      </label>

      <div className="auth-action-row gap-2">
        <button type="button" className="btn-auth-secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> <span>Volver</span></button>
        <button type="submit" className="btn-auth-primary" disabled={busy}><UserPlus size={18} /> <span>{busy ? 'Creando cuenta…' : 'Crear cuenta de taller'}</span></button>
      </div>
    </form>
  ));
}
