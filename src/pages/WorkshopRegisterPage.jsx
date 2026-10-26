import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import { resolverUbicacionPorNombre } from '../services/geoLookup';
import { formatRut, isValidRut } from '../services/adapters';
import { ROUTES } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import '../styles/faults.css';

/**
 * `/taller/registro`: crea la cuenta de un taller automotriz (rol propio). Pide los datos del responsable y del taller;
 * los documentos de acreditación se suben después desde el perfil. El correo se verifica con un código, como el resto.
 */
export default function WorkshopRegisterPage() {
  useDocumentTitle('Registra tu taller');
  const navigate = useNavigate();
  const { isLoggedIn, registerWorkshop, verifyRegisterEmail, resendRegisterCode } = useAuth();
  const [form, setForm] = useState({ responsibleName: '', workshopName: '', taxId: '', email: '', phone: '', password: '', address: '' });
  const [place, setPlace] = useState(null);
  const [accepts, setAccepts] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (isLoggedIn && !done) return <Navigate to={`${ROUTES.profile}/resumen`} replace />;

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const pickLocation = async ({ comuna, region }) => {
    const resolved = await resolverUbicacionPorNombre({ comuna, region });
    setPlace(resolved.comunaId ? { comunaId: resolved.comunaId, comuna, region: region || '' } : null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.responsibleName.trim() || !form.workshopName.trim()) return setError('Indica tu nombre y el nombre del taller.');
    if (!isValidRut(form.taxId)) return setError('Ingresa un RUT válido (con dígito verificador).');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Ingresa un correo válido.');
    if (!/^9\d{8}$/.test(form.phone.replace(/\D/g, ''))) return setError('Ingresa un celular chileno de 9 dígitos que empiece con 9.');
    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (!form.address.trim() || !/\d/.test(form.address) || !place) return setError('Escribe la dirección del taller con su número y elige una de las sugerencias para ubicar la comuna.');
    if (!accepts) return setError('Debes aceptar los Términos y Condiciones para crear tu cuenta.');
    setBusy(true);
    const result = await registerWorkshop({
      ...form,
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

  if (done) {
    return (
      <div className="ft-page"><div className="ft-shell">
        <div className="ft-card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <CheckCircle2 size={40} color="#0e7038" />
          <h1 style={{ fontSize: 22 }}>Taller creado</h1>
          <p className="ft-sub">Tu cuenta quedó lista. Falta acreditar tu negocio para publicar anuncios y comentar fallas: sube tu identidad, inicio de actividades y patente municipal.</p>
          <button type="button" className="ft-btn ft-btn-primary" onClick={() => navigate(`${ROUTES.profile}/resumen`, { replace: true })}>Ir a mi perfil</button>
        </div>
      </div></div>
    );
  }

  return (
    <div className="ft-page"><div className="ft-shell" style={{ maxWidth: 640 }}>
      <nav className="ft-sub" aria-label="Ruta"><Link to={ROUTES.home}>Inicio</Link> / <span aria-current="page">Registra tu taller</span></nav>
      <div className="ft-head"><div><h1>Crear cuenta de taller</h1><p>Registra tu taller automotriz para ofrecer tus servicios, comentar fallas y recibir citas.</p></div></div>

      {pendingEmail ? (
        <form className="ft-card ft-form" onSubmit={verify}>
          <h2>Verifica tu correo</h2>
          <p className="ft-sub">Te enviamos un código de 6 dígitos a {pendingEmail}.</p>
          <label className="ft-field"><span>Código de verificación</span><input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>
          {error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
          <div className="ft-actions">
            <button type="submit" className="ft-btn ft-btn-primary" disabled={busy || code.length < 6}>{busy ? 'Verificando…' : 'Verificar código'}</button>
            <button type="button" className="ft-btn ft-btn-outline" disabled={busy} onClick={async () => { const r = await resendRegisterCode(pendingEmail); setError(r?.success === false ? (r.error || 'No pudimos reenviar el código.') : ''); }}>Reenviar código</button>
          </div>
        </form>
      ) : (
        <form className="ft-card ft-form" onSubmit={submit}>
          <label className="ft-field"><span>Nombre del responsable</span><input value={form.responsibleName} maxLength={80} onChange={set('responsibleName')} /></label>
          <label className="ft-field"><span>Nombre del taller</span><input value={form.workshopName} maxLength={120} onChange={set('workshopName')} /></label>
          <label className="ft-field"><span>RUT empresa o persona</span><input value={form.taxId} maxLength={12} placeholder="12.345.678-9" onChange={(e) => setForm((c) => ({ ...c, taxId: formatRut(e.target.value) }))} /></label>
          <div className="ft-row">
            <label className="ft-field"><span>Correo</span><input type="email" value={form.email} maxLength={120} autoComplete="email" onChange={set('email')} /></label>
            <label className="ft-field"><span>Celular</span><input inputMode="numeric" value={form.phone} maxLength={9} placeholder="912345678" onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value.replace(/\D/g, '') }))} /></label>
          </div>
          <label className="ft-field"><span>Contraseña</span><input type="password" value={form.password} maxLength={32} autoComplete="new-password" onChange={set('password')} /><small>Mínimo 8 caracteres.</small></label>
          <div className="ft-field">
            <span>Dirección del taller</span>
            <AddressAutocompleteInput value={form.address} onChange={(value) => { setForm((c) => ({ ...c, address: value })); setPlace(null); }} onSelectLocation={pickLocation} requireComuna={false} placeholder="Calle y número, comuna (Ej: Av. Italia 1234, Ñuñoa)" />
            {place && <small>Comuna: <strong>{[place.comuna, place.region].filter(Boolean).join(', ')}</strong></small>}
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
            <input type="checkbox" checked={accepts} onChange={(e) => setAccepts(e.target.checked)} />
            <span>Acepto los <Link to={ROUTES.terms} target="_blank">Términos y Condiciones</Link> y la <Link to={ROUTES.privacy} target="_blank">Política de Privacidad</Link>.</span>
          </label>
          {error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
          <button type="submit" className="ft-btn ft-btn-primary" disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear cuenta de taller'}</button>
          <p className="ft-sub">¿Ya tienes cuenta? Inicia sesión desde el menú superior.</p>
        </form>
      )}
    </div></div>
  );
}
