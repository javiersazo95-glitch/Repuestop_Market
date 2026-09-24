import { useCallback, useRef, useState } from 'react';
import { AlertCircle, Check, RefreshCw, Users } from 'lucide-react';
import { validateReferral } from './founderApi';
import { CAPTADOR_CODE_MAX_LENGTH, normalizeCaptadorCode } from '../utils/captadorReferral';

/**
 * Estado del codigo de captador opcional del registro de comprador (manual y Google).
 * `codeForSubmit` valida si hace falta y devuelve `{ ok, code }`: un codigo invalido no se
 * envia -- el comprador lo corrige o lo deja vacio --, igual que en la app movil.
 */
export function useCaptadorCode(initialCode = '') {
  const [code, setCodeState] = useState(() => normalizeCaptadorCode(initialCode));
  const [status, setStatus] = useState('idle'); // idle | checking | valid | invalid | error
  const [alias, setAlias] = useState(null);
  const lastChecked = useRef(null);

  const setCode = useCallback((value) => {
    setCodeState(normalizeCaptadorCode(value));
    setStatus('idle');
    setAlias(null);
    lastChecked.current = null;
  }, []);

  const validate = useCallback(async () => {
    const current = normalizeCaptadorCode(code);
    if (!current) {
      setStatus('idle');
      return true;
    }
    if (lastChecked.current === current && (status === 'valid' || status === 'invalid')) {
      return status === 'valid';
    }
    setStatus('checking');
    try {
      const result = await validateReferral(current);
      lastChecked.current = current;
      const valid = result?.valido === true;
      setStatus(valid ? 'valid' : 'invalid');
      setAlias(valid ? result.captadorAlias ?? null : null);
      return valid;
    } catch {
      setStatus('error');
      return false;
    }
  }, [code, status]);

  const codeForSubmit = useCallback(async () => {
    const current = normalizeCaptadorCode(code);
    if (!current) return { ok: true };
    const ok = await validate();
    return ok ? { ok: true, code: current } : { ok: false };
  }, [code, validate]);

  const reset = useCallback((value = '') => {
    setCodeState(normalizeCaptadorCode(value));
    setStatus('idle');
    setAlias(null);
    lastChecked.current = null;
  }, []);

  return { code, status, alias, setCode, validate, codeForSubmit, reset };
}

export default function CaptadorCodeField({ referral, disabled = false }) {
  const { code, status, alias, setCode, validate } = referral;
  const hasError = status === 'invalid' || status === 'error';

  return (
    <div className="form-group">
      <label htmlFor="captador-code">Código de captador (opcional)</label>
      <div className={`input-with-icon ${hasError ? 'has-error' : status === 'valid' ? 'has-success' : ''}`}>
        <Users size={18} className="field-icon" />
        <input
          id="captador-code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={CAPTADOR_CODE_MAX_LENGTH}
          placeholder="Ej: RT-JUAN-00012"
          value={code}
          disabled={disabled}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => { void validate(); }}
        />
      </div>
      {status === 'idle' && (
        <small className="auth-field-hint">¿Alguien te invitó a RepuesTop? Ingresa su código.</small>
      )}
      {status === 'checking' && (
        <small className="auth-field-hint">
          <RefreshCw size={12} className="spin-icon" /> Validando código...
        </small>
      )}
      {status === 'valid' && (
        <small className="auth-field-success">
          <Check size={13} /> Código válido{alias ? ` · captador @${alias}` : ''}
        </small>
      )}
      {status === 'invalid' && (
        <small className="auth-field-error">
          <AlertCircle size={13} /> Este código no existe o no está activo. Corrígelo o déjalo vacío.
        </small>
      )}
      {status === 'error' && (
        <small className="auth-field-error">
          <AlertCircle size={13} /> No pudimos validar el código. Revisa tu conexión e inténtalo de nuevo.
        </small>
      )}
    </div>
  );
}
