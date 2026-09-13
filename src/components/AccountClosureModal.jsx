import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getAccountClosureSummaryApi, requestAccountClosureApi, reactivateAccountApi } from '../services/api';

/**
 * Flujo de "Eliminar cuenta" del sidebar del perfil (retener / motivo / resumen de
 * operaciones pendientes / decision desactivar-o-eliminar / hecho). Extraido de
 * ProfileDashboard: no comparte estado con ninguna pestana, solo necesita saber si
 * la cuenta es de vendedor o comprador para armar el `closureProfile` que espera
 * el backend.
 */
export default function AccountClosureModal({ isOpen, onClose, isSeller }) {
  const [step, setStep] = useState('retain');
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);

  // Cada apertura desde el boton del sidebar arranca del primer paso, igual que
  // hacia ProfileDashboard antes de poner showDeleteAccountModal en true.
  useEffect(() => {
    if (isOpen) {
      setStep('retain');
      setReason('');
      setSummary(null);
      setIsBusy(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const closureProfile = isSeller ? 'PROVEEDOR' : 'COMPRADOR';

  const handleClosureSummary = async () => {
    setIsBusy(true);
    setError(null);
    try {
      setSummary(await getAccountClosureSummaryApi(closureProfile));
      setStep('summary');
    } catch (err) {
      setError(err.message || 'No pudimos revisar tus operaciones.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAccountClosure = async (action) => {
    setIsBusy(true);
    setError(null);
    try {
      const result = await requestAccountClosureApi({ perfil: closureProfile, action, reason });
      setSummary(result);
      setStep('done');
    } catch (err) {
      setError(err.message || 'No pudimos guardar tu solicitud.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReactivateAccount = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await reactivateAccountApi(closureProfile);
      onClose();
    } catch (err) {
      setError(err.message || 'No pudimos reactivar tu cuenta.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="order-modal-backdrop delete-account-backdrop"
      onClick={() => !isBusy && onClose()}
    >
      <section
        className="delete-account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="delete-account-icon" aria-hidden="true"><AlertTriangle size={25} /></div>
        <h2 id="delete-account-title">{step === 'retain' ? 'Antes de irte' : step === 'reason' ? 'Cuéntanos el motivo' : step === 'summary' ? 'Revisa tus operaciones' : step === 'decision' ? 'Elige qué hacer' : 'Solicitud registrada'}</h2>
        {error && (
          <div className="auth-alert alert-error"><span>{error}</span></div>
        )}
        {step === 'retain' && <>
          <p>Conserva tu historial de pedidos, comprobantes y favoritos. Estamos mejorando cobertura y despachos, y siempre puedes desactivar sin perder tu información.</p>
          <div className="delete-account-actions"><button type="button" className="btn-auth-secondary" onClick={onClose}>Conservar mi cuenta</button><button type="button" className="btn-delete-account-confirm" onClick={() => setStep('reason')}>Continuar con el cierre</button></div>
        </>}
        {step === 'reason' && <>
          <p>Selecciona un motivo para continuar.</p>
          <div className="account-closure-reasons">{['No uso la cuenta', 'No encontré lo que buscaba', 'Tuve una mala experiencia', 'Privacidad', 'Otro'].map(r => <label key={r}><input type="radio" name="account-closure-reason" checked={reason === r} onChange={() => setReason(r)} /> {r}</label>)}</div>
          <div className="delete-account-actions"><button type="button" className="btn-auth-secondary" onClick={() => setStep('retain')}>Volver</button><button type="button" className="btn-delete-account-confirm" disabled={!reason || isBusy} onClick={handleClosureSummary}>{isBusy ? 'Revisando...' : 'Ver mis operaciones'}</button></div>
        </>}
        {step === 'summary' && summary && <>
          <p>Estas son las operaciones que requieren seguimiento antes del cierre.</p>
          {summary.items?.length ? <div className="account-closure-items">{summary.items.map(item => <div className={item.blocking ? 'account-closure-item is-blocking' : 'account-closure-item'} key={item.id}><strong>{item.type} · {item.status}</strong><span>{item.detail}</span></div>)}</div> : <p className="account-closure-empty">No tienes operaciones pendientes.</p>}
          {summary.deletionBlocked && <div className="auth-alert alert-error"><span>{summary.blockingMessage}</span></div>}
          <div className="delete-account-actions"><button type="button" className="btn-auth-secondary" onClick={() => setStep('reason')}>Volver</button>{!summary.deletionBlocked && <button type="button" className="btn-delete-account-confirm" onClick={() => setStep('decision')}>Continuar</button>}</div>
        </>}
        {step === 'decision' && <div className="account-closure-decisions"><section><h3>Desactivar</h3><p>Deja de operar, conserva tus datos y podrás reactivarla.</p><button type="button" className="btn-auth-secondary" disabled={isBusy} onClick={() => handleAccountClosure('DEACTIVATE')}>Desactivar cuenta</button></section><section><h3>Eliminar</h3><p>Queda desactivada 30 días. Puedes reactivarla durante ese plazo; luego se anonimiza definitivamente.</p><button type="button" className="btn-delete-account-confirm" disabled={isBusy} onClick={() => handleAccountClosure('SCHEDULE_DELETION')}>{isBusy ? 'Guardando...' : 'Programar eliminación'}</button></section></div>}
        {step === 'done' && <><p>{summary?.status === 'DELETION_SCHEDULED' ? 'La eliminación quedó programada para dentro de 30 días.' : 'Tu cuenta quedó desactivada y sus datos se conservaron.'}</p><div className="delete-account-actions"><button type="button" className="btn-auth-secondary" disabled={isBusy} onClick={handleReactivateAccount}>Reactivar ahora</button><button type="button" className="btn-delete-account-confirm" onClick={onClose}>Entendido</button></div></>}
      </section>
    </div>
  );
}
