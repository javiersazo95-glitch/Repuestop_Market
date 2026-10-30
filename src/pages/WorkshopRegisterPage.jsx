import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import { checkEmailAvailabilityApi, getComunasApi, getPaisesApi, getRegionesApi } from '../services/api';
import { tomarGoogleParaTaller } from '../utils/googleIdToken';
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
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Misma regla y barra de seguridad que el registro de comprador. */
function passwordStrength(password) {
  if (password.length < 8) return { score: 1, label: 'Débil', color: '#ef4444' };
  const letters = /[a-zA-Z]/.test(password);
  const numbers = /\d/.test(password);
  const special = /[^a-zA-Z0-9]/.test(password);
  if ((letters && numbers && special) || password.length >= 10) return { score: 3, label: 'Segura', color: '#10b981' };
  if (letters && numbers) return { score: 2, label: 'Aceptable', color: '#f59e0b' };
  return { score: 1, label: 'Débil', color: '#ef4444' };
}

/** Aviso bajo un campo: en rojo si hay error, en verde si esta correcto. */
function FieldHint({ error, success }) {
  if (error) return <small className="auth-field-error"><AlertCircle size={13} /> {error}</small>;
  if (success) return <small className="auth-field-success"><Check size={13} /> {success}</small>;
  return null;
}

export default function WorkshopRegisterPage() {
  useDocumentTitle('Registra tu taller');
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, registerWorkshop, verifyRegisterEmail, resendRegisterCode } = useAuth();
  const [form, setForm] = useState({ responsibleName: '', workshopName: '', taxId: '', giro: '', giroOtro: '', email: location.state?.email || '', phone: '', password: '', address: '' });
  // Region y comuna antes de la direccion, como el comprador y la app: sin comuna las sugerencias se equivocaban
  // ("Irarrázaval 2401" salia en Santiago y no en Ñuñoa) y el taller quedaba mal ubicado en el buscador.
  const [regiones, setRegiones] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [comunaId, setComunaId] = useState('');
  const [accepts, setAccepts] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Validacion reactiva, como el comprador: un campo vacio solo marca error despues de tocarlo.
  const [touched, setTouched] = useState({});
  const [emailStatus, setEmailStatus] = useState({ checking: false, available: null });
  // Cuenta de Google elegida en el modal de acceso, que es donde se pide: { idToken, email, nombre, picture }.
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

  useEffect(() => {
    let active = true;
    getPaisesApi()
      .then((paises) => {
        const lista = Array.isArray(paises) ? paises : [];
        const chile = lista.find((pais) => /chile/i.test(pais.nombre)) || lista[0];
        return chile ? getRegionesApi(chile.id) : [];
      })
      .then((data) => { if (active) setRegiones(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setError('No pudimos cargar las regiones. Revisa tu conexión.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!regionId) { setComunas([]); return undefined; }
    let active = true;
    getComunasApi(regionId)
      .then((data) => { if (active) setComunas(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setError('No pudimos cargar las comunas. Revisa tu conexión.'); });
    return () => { active = false; };
  }, [regionId]);

  const checkEmail = async (value) => {
    const clean = value.trim().toLowerCase();
    if (!EMAIL_REGEX.test(clean)) { setEmailStatus({ checking: false, available: null }); return; }
    setEmailStatus({ checking: true, available: null });
    try {
      const res = await checkEmailAvailabilityApi(clean);
      setEmailStatus({ checking: false, available: !res?.exists });
    } catch {
      setEmailStatus({ checking: false, available: null });
    }
  };

  if (isLoggedIn && !done) return <Navigate to={`${ROUTES.profile}/resumen`} replace />;

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

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
    if (!regionId || !comunaId) return setError('Elige la región y la comuna del taller.');
    if (!form.address.trim() || !/\d/.test(form.address)) return setError('Escribe la dirección del taller con calle y número.');
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
      direccion: { comunaId: Number(comunaId), calleYNumero: form.address.trim() },
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

  const touch = (key) => () => setTouched((current) => ({ ...current, [key]: true }));

  // Cada campo: su error (si lo hay) y su mensaje de correcto.
  const nameValue = form.responsibleName.trim();
  const phoneDigits = form.phone.replace(/\D/g, '');
  const giroValue = (form.giro === OTHER_GIRO ? form.giroOtro : form.giro).trim();
  const emailValue = form.email.trim();
  const required = (key, value, message) => (touched[key] && !value ? message : null);
  const errors = {
    responsibleName: required('responsibleName', nameValue, 'El nombre del responsable es obligatorio.')
      || (nameValue && nameValue.split(/\s+/).length < 2 ? 'Ingresa nombre y apellido separados por un espacio.' : null),
    email: google ? null : required('email', emailValue, 'El correo electrónico es obligatorio.')
      || (emailValue && !EMAIL_REGEX.test(emailValue) ? 'Ingresa un correo electrónico válido (ej: nombre@correo.com).' : null)
      || (emailStatus.available === false ? 'Este correo ya está registrado en RepuesTop.' : null),
    phone: required('phone', phoneDigits, 'El celular es obligatorio.')
      || (phoneDigits && !/^9\d{8}$/.test(phoneDigits) ? 'Ingresa un celular de 9 dígitos que empiece con 9.' : null),
    password: google ? null : required('password', form.password, 'La contraseña es obligatoria.')
      || (form.password && form.password.length < 8 ? `La contraseña debe tener al menos 8 caracteres (llevas ${form.password.length}/8).` : null),
    workshopName: required('workshopName', form.workshopName.trim(), 'El nombre del taller es obligatorio.'),
    taxId: required('taxId', form.taxId.trim(), 'El RUT es obligatorio.')
      || (form.taxId.trim().length >= 9 && !isValidRut(form.taxId) ? 'El RUT no es válido: revisa el dígito verificador.' : null)
      || (touched.taxId && form.taxId.trim() && !isValidRut(form.taxId) ? 'El RUT no es válido: revisa el dígito verificador.' : null),
    giro: required('giro', giroValue, form.giro === OTHER_GIRO ? 'Describe el giro de tu taller.' : 'Selecciona el giro de tu taller.'),
    region: required('region', regionId, 'Selecciona la región.'),
    comuna: required('comuna', comunaId, 'Selecciona la comuna.'),
    address: required('address', form.address.trim(), 'La dirección es obligatoria.')
      || (touched.address && form.address.trim() && !/\d/.test(form.address) ? 'Incluye el número de la calle.' : null),
  };
  const valid = {
    responsibleName: nameValue.split(/\s+/).length >= 2,
    email: google || (EMAIL_REGEX.test(emailValue) && emailStatus.available === true),
    phone: /^9\d{8}$/.test(phoneDigits),
    password: google || (form.password.length >= 8 && form.password.length <= 32),
    workshopName: Boolean(form.workshopName.trim()),
    taxId: isValidRut(form.taxId),
    giro: Boolean(giroValue),
    region: Boolean(regionId),
    comuna: Boolean(comunaId),
    address: Boolean(form.address.trim()) && /\d/.test(form.address),
  };
  const missing = !valid.responsibleName ? 'Falta el nombre y apellido del responsable'
    : !valid.email ? (emailStatus.checking ? 'Comprobando el correo…' : emailStatus.available === false ? 'El correo ya está registrado en RepuesTop' : 'Falta un correo electrónico válido')
      : !valid.phone ? 'Falta un celular válido'
        : !valid.password ? 'La contraseña debe tener al menos 8 caracteres'
          : !valid.workshopName ? 'Falta el nombre del taller'
            : !valid.taxId ? 'Falta un RUT válido'
              : !valid.giro ? 'Falta el giro comercial'
                : !valid.region || !valid.comuna ? 'Falta la región o la comuna'
                  : !valid.address ? 'Falta la dirección con calle y número'
                    : !accepts ? 'Debes aceptar los Términos y Condiciones' : null;
  const stateClass = (key) => (errors[key] ? 'has-error' : valid[key] ? 'has-success' : '');
  const strength = passwordStrength(form.password);

  return shell('Crear cuenta de taller', 'Ofrece tus servicios, comenta fallas y recibe citas. Los documentos de acreditación se suben después, desde tu perfil.', (
    <form className="auth-modal-body" onSubmit={submit}>
      {errorBox}
      {google && (
        <div className="google-account-card">
          {google.picture
            ? <img src={google.picture} alt="" referrerPolicy="no-referrer" />
            : <span className="google-account-initials">{(google.nombre || google.email).charAt(0).toUpperCase()}</span>}
          <div>
            <strong>{google.nombre || 'Cuenta de Google'}</strong>
            <span>{google.email}</span>
          </div>
          <button type="button" className="link-btn" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => setGoogle(null)}>Cambiar método</button>
        </div>
      )}

      <h3 className="taller-register-title">Tus datos</h3>
      <div className="form-group">
        <label htmlFor="workshop-responsible">Nombre del responsable *</label>
        <input id="workshop-responsible" type="text" className={stateClass('responsibleName')} value={form.responsibleName} maxLength={80} placeholder="Ej: Juan Pérez" autoComplete="name" onChange={set('responsibleName')} onBlur={touch('responsibleName')} />
        <FieldHint error={errors.responsibleName} success={valid.responsibleName && 'Nombre completo válido'} />
      </div>
      {!google && (
      <div className="form-group">
        <label htmlFor="workshop-email">Correo Electrónico *</label>
        <div className={`input-with-icon ${stateClass('email')}`}>
          <Mail size={18} className="field-icon" />
          <input
            id="workshop-email"
            type="email"
            value={form.email}
            maxLength={120}
            placeholder="ejemplo@correo.com"
            autoComplete="email"
            onChange={(e) => { setForm((c) => ({ ...c, email: e.target.value })); checkEmail(e.target.value); }}
            onBlur={touch('email')}
          />
        </div>
        {emailStatus.checking
          ? <small className="auth-field-hint">Comprobando disponibilidad...</small>
          : <FieldHint error={errors.email} success={valid.email && 'Correo disponible'} />}
      </div>
      )}
      <div className="form-group">
        <label htmlFor="workshop-phone">Celular *</label>
        <input id="workshop-phone" type="tel" inputMode="numeric" className={stateClass('phone')} value={form.phone} maxLength={9} placeholder="912345678" autoComplete="tel" onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value.replace(/\D/g, '') }))} onBlur={touch('phone')} />
        <FieldHint error={errors.phone} success={valid.phone && 'Celular válido'} />
      </div>
      {!google && (
      <div className="form-group">
        <label htmlFor="workshop-password">Contraseña *</label>
        <div className={`input-with-icon ${stateClass('password')}`}>
          <Lock size={18} className="field-icon" />
          <input id="workshop-password" type={showPassword ? 'text' : 'password'} value={form.password} maxLength={32} placeholder="Mínimo 8 caracteres" autoComplete="new-password" onChange={set('password')} onBlur={touch('password')} />
          <button type="button" className="btn-toggle-eye" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {form.password.length > 0 && (
          <div className="password-strength-container">
            <div className={`password-strength-meter strength-${strength.score}`}>
              <div className="bar" />
              <div className="bar" />
              <div className="bar" />
            </div>
            <div className="password-strength-meta">
              <small style={{ color: strength.color, fontWeight: 600 }}>Seguridad: {strength.label}</small>
              <small className="char-counter">{form.password.length}/8 mín.</small>
            </div>
          </div>
        )}
        <FieldHint error={errors.password} success={valid.password && 'Longitud válida'} />
      </div>
      )}

      <h3 className="taller-register-title">Tu taller</h3>
      <div className="form-group">
        <label htmlFor="workshop-name">Nombre del taller *</label>
        <input id="workshop-name" type="text" className={stateClass('workshopName')} value={form.workshopName} maxLength={120} onChange={set('workshopName')} onBlur={touch('workshopName')} />
        <FieldHint error={errors.workshopName} />
      </div>
      <div className="form-group">
        <label htmlFor="workshop-rut">RUT empresa o persona *</label>
        <input id="workshop-rut" type="text" className={stateClass('taxId')} value={form.taxId} maxLength={12} placeholder="12.345.678-9" onChange={(e) => setForm((c) => ({ ...c, taxId: formatRut(e.target.value) }))} onBlur={touch('taxId')} />
        <FieldHint error={errors.taxId} success={valid.taxId && 'RUT válido'} />
      </div>
      <div className="form-group">
        <label htmlFor="workshop-giro">Giro comercial *</label>
        <select id="workshop-giro" className={form.giro === OTHER_GIRO ? '' : stateClass('giro')} value={form.giro} onBlur={touch('giro')} onChange={(e) => setForm((c) => ({ ...c, giro: e.target.value, giroOtro: e.target.value === OTHER_GIRO ? c.giroOtro : '' }))}>
          <option value="">Selecciona el giro de tu taller</option>
          {WORKSHOP_GIROS.map((item) => <option key={item} value={item}>{item}</option>)}
          <option value={OTHER_GIRO}>Otro</option>
        </select>
        {form.giro !== OTHER_GIRO && <FieldHint error={errors.giro} />}
      </div>
      {form.giro === OTHER_GIRO && (
        <div className="form-group">
          <label htmlFor="workshop-giro-other">Especifica el giro de tu taller *</label>
          <input id="workshop-giro-other" type="text" className={stateClass('giro')} value={form.giroOtro} maxLength={180} placeholder="Describe el giro de tu taller" onChange={set('giroOtro')} onBlur={touch('giro')} />
          <FieldHint error={errors.giro} />
        </div>
      )}
      <div className="form-grid-2">
        <div className="form-group">
          <label htmlFor="workshop-region">Región *</label>
          <select id="workshop-region" className={stateClass('region')} value={regionId} onBlur={touch('region')} onChange={(e) => { setRegionId(e.target.value); setComunaId(''); }}>
            <option value="">{regiones.length ? 'Selecciona la región' : 'Cargando regiones...'}</option>
            {regiones.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
          <FieldHint error={errors.region} />
        </div>
        <div className="form-group">
          <label htmlFor="workshop-comuna">Comuna *</label>
          <select id="workshop-comuna" className={stateClass('comuna')} value={comunaId} disabled={!regionId} onBlur={touch('comuna')} onChange={(e) => setComunaId(e.target.value)}>
            <option value="">{regionId ? 'Selecciona la comuna' : 'Elige región primero'}</option>
            {comunas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
          <FieldHint error={errors.comuna} />
        </div>
      </div>
      <div className="form-group">
        <label>Dirección del taller *</label>
        <div className={`taller-register-address ${stateClass('address')}`} onBlur={touch('address')}>
          <AddressAutocompleteInput
            value={form.address}
            onChange={(value) => setForm((c) => ({ ...c, address: value }))}
            comuna={comunas.find((item) => String(item.id) === String(comunaId))?.nombre || ''}
            region={regiones.find((item) => String(item.id) === String(regionId))?.nombre || ''}
            placeholder="Calle y número"
            maxLength={160}
          />
        </div>
        <FieldHint error={errors.address} success={valid.address && comunaId && `${comunas.find((item) => String(item.id) === String(comunaId))?.nombre || ''}, ${regiones.find((item) => String(item.id) === String(regionId))?.nombre || ''}`} />
      </div>

      <label className="auth-terms">
        <input type="checkbox" checked={accepts} onChange={(e) => setAccepts(e.target.checked)} />
        <span>He leído y acepto los <a href={ROUTES.terms} target="_blank" rel="noreferrer">Términos y Condiciones</a> y la <a href={ROUTES.privacy} target="_blank" rel="noreferrer">Política de Privacidad</a>.</span>
      </label>

      {missing && <div className="auth-validation-summary"><span><AlertCircle size={13} /> {missing}</span></div>}

      <div className="auth-action-row gap-2">
        <button type="button" className="btn-auth-secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> <span>Volver</span></button>
        <button type="submit" className="btn-auth-primary" disabled={busy || Boolean(missing)} title={missing ? 'Completa todos los campos obligatorios para activar este botón' : undefined}><UserPlus size={18} /> <span>{busy ? 'Creando cuenta…' : 'Crear cuenta de taller'}</span></button>
      </div>
    </form>
  ));
}
