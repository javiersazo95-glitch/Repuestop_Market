import React, { useEffect, useState } from 'react';
import { Check, KeyRound, Loader2, Lock, X } from 'lucide-react';
import { recoverPasswordResetApi, recoverPasswordSendCodeApi, recoverPasswordVerifyCodeApi } from '../services/api';

const MIN_PASSWORD = 8;

/**
 * Cambiar la contraseña con la sesión iniciada. La app lo tiene (`app/change-password.tsx`); en la
 * web solo se podía cerrando sesión y usando "¿Olvidaste tu contraseña?". Usa el mismo flujo
 * seguro de recuperación: código de 6 dígitos al correo de la cuenta, y la nueva clave.
 *
 * El identificador es el correo del comprador o el RUT de la tienda, igual que en la app. Con
 * una cuenta que entra con Google el backend no envía código (manda un correo que lo explica).
 */
export default function ChangePasswordCard({ user, isSeller }) {
  const [step, setStep] = useState('idle'); // idle | code | done
  const [solicitudId, setSolicitudId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const rol = isSeller ? 'PROVEEDOR' : 'CLIENTE';
  const identifier = isSeller ? (user?.taxId || user?.rut || '') : (user?.email || '');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const reset = () => {
    setStep('idle');
    setSolicitudId('');
    setCode('');
    setPassword('');
    setConfirm('');
    setError('');
  };

  const sendCode = async () => {
    if (!identifier) {
      setError(isSeller ? 'No encontramos el RUT de tu tienda.' : 'No encontramos el correo de tu cuenta.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await recoverPasswordSendCodeApi(identifier, rol);
      setSolicitudId(res?.solicitudId || '');
      setStep('code');
      setCooldown(60);
    } catch (err) {
      setError(err.message || 'No se pudo enviar el código. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (code.trim().length !== 6) {
      setError('Ingresa el código de 6 dígitos que enviamos a tu correo.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await recoverPasswordVerifyCodeApi(solicitudId, code, rol);
      await recoverPasswordResetApi(solicitudId, code, password, rol);
      setStep('done');
      setCode('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="change-password-card">
      <div className="form-section-title" style={{ marginTop: '20px' }}>
        <Lock size={15} /> Contraseña
      </div>

      {step === 'idle' && (
        <div className="change-password-row">
          <p>Te enviaremos un código a tu correo para confirmar que eres tú.</p>
          <button type="button" className="btn-auth-secondary" style={{ width: 'auto' }} onClick={sendCode} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin-icon" /> : <KeyRound size={15} />} Cambiar contraseña
          </button>
        </div>
      )}

      {step === 'code' && (
        <form onSubmit={submit} className="change-password-form">
          <small className="form-helper-text">
            Si tu cuenta usa contraseña, enviamos un código de 6 dígitos a tu correo (revisa también spam). Si entras con Google, te enviamos un correo que lo explica.
          </small>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Código de verificación</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
              />
            </div>
            <div className="form-group" />
            <div className="form-group">
              <label>Nueva contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} minLength={MIN_PASSWORD} />
            </div>
            <div className="form-group">
              <label>Repite la nueva contraseña</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la contraseña" />
            </div>
          </div>
          <div className="profile-data-form-actions" style={{ gap: '8px' }}>
            <button type="button" className="btn-auth-secondary" style={{ width: 'auto' }} onClick={reset} disabled={busy}>
              <X size={15} /> Cancelar
            </button>
            <button type="button" className="btn-auth-secondary" style={{ width: 'auto' }} onClick={sendCode} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}
            </button>
            <button type="submit" className="btn-auth-primary" style={{ width: 'auto' }} disabled={busy}>
              {busy ? <Loader2 size={15} className="spin-icon" /> : <Check size={15} />} Guardar contraseña
            </button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <div className="auth-alert alert-success" style={{ margin: '10px 0' }}>
          <Check size={16} /><span>Tu contraseña se actualizó. Úsala la próxima vez que inicies sesión.</span>
        </div>
      )}

      {error && <div className="auth-alert alert-error" style={{ margin: '10px 0' }}><X size={16} /><span>{error}</span></div>}
    </div>
  );
}
