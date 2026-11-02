import React, { useState } from 'react';
import { Loader2, Lock, Star } from 'lucide-react';
import TrackingDetail, { TrackingCells, TrackingItem, TrackingTag } from '../tracking/TrackingDetail';
import { registerAppointmentResult } from '../../services/talleresStorage';
import { apiErrorMessage } from '../../services/walletStorage';
import '../../styles/appointment-result.css';

export const OUTCOMES = [
  { value: 'REALIZADA', label: 'Servicio realizado', hint: 'Se hizo el trabajo o la revisión.' },
  { value: 'NO_ASISTIO', label: 'El cliente no asistió', hint: 'No llegó a la hora de la cita.' },
  { value: 'NO_REALIZADA', label: 'No se pudo realizar', hint: 'Algo impidió hacer el trabajo.' },
];

const outcomeLabel = (outcome) => OUTCOMES.find((item) => item.value === outcome)?.label || outcome;
const outcomeTone = (outcome) => (outcome === 'REALIZADA' ? 'ok' : outcome === 'NO_ASISTIO' ? 'warn' : 'lost');
const formatCLP = (value) => (value == null ? 'Sin costo registrado' : `$${Math.round(value).toLocaleString('es-CL')}`);
const formatWhen = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

/** Lo que registró el taller, como se ve en el historial de la cita. */
export function AppointmentResultDetail({ result }) {
  return (
    <TrackingItem>
      <div className="trk-head"><strong>Resultado de la cita</strong><TrackingTag label={outcomeLabel(result.outcome)} tone={outcomeTone(result.outcome)} /></div>
      <p>{result.detail}</p>
      <TrackingCells cells={[
        { label: 'Costo final', value: result.outcome === 'REALIZADA' ? formatCLP(result.finalCost) : '—', tone: 'primary' },
        { label: 'Registrado', value: formatWhen(result.registeredAt) },
      ]} />
    </TrackingItem>
  );
}

/** Formulario del taller: qué pasó, el detalle y, si el servicio se hizo, el costo final. */
export function AppointmentResultForm({ appointment, onDone }) {
  const finishing = Boolean(appointment.canFinish);
  const [outcome, setOutcome] = useState(null);
  const [detail, setDetail] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!outcome || busy) return;
    if (detail.trim().length < 10) { setError('Cuenta en al menos 10 caracteres qué pasó en la cita.'); return; }
    const amount = parseInt(cost.replace(/\D/g, ''), 10);
    setBusy(true);
    setError('');
    try {
      await registerAppointmentResult(appointment.id, { outcome, detail, cost: outcome === 'REALIZADA' && Number.isFinite(amount) ? amount : null });
      onDone?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'No pudimos registrar el resultado de la cita.'));
      setBusy(false);
    }
  };

  return (
    <form className="apr-form" onSubmit={submit}>
      <label className="apr-field"><span>¿Qué pasó con la cita?</span>
        <select value={outcome || ''} onChange={(e) => setOutcome(e.target.value || null)}>
          <option value="">Elige el motivo</option>
          {OUTCOMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {outcome && <small className="apr-hint">{OUTCOMES.find((item) => item.value === outcome)?.hint}</small>}
      <label className="apr-field"><span>Detalle del resultado</span>
        <textarea rows={3} value={detail} maxLength={1000} onChange={(event) => setDetail(event.target.value)}
          placeholder={outcome === 'REALIZADA' ? 'Qué se revisó o se hizo, y qué recomiendas' : 'Cuenta brevemente qué ocurrió'} />
      </label>
      {outcome === 'REALIZADA' && (
        <label className="apr-field"><span>Costo final <small>Opcional</small></span>
          <input inputMode="numeric" maxLength={9} value={cost} onChange={(event) => setCost(event.target.value.replace(/\D/g, ''))} placeholder="45000" />
        </label>
      )}
      <small className="apr-hint">Queda en el historial de la cita y se avisa al cliente. Él lo verá cuando evalúe su experiencia con tu taller, y esa evaluación es pública en tu perfil.</small>
      {error && <p className="trk-error" role="alert">{error}</p>}
      <button type="submit" className="apr-submit" disabled={busy || !outcome || detail.trim().length === 0}>{busy ? <Loader2 size={16} className="spin-icon" /> : (finishing ? 'Finalizar cita y registrar resultado' : 'Registrar resultado')}</button>
    </form>
  );
}

/**
 * Desplegable "Resultado" de una cita, igual que el "Detalle" de las ofertas y diagnósticos: el taller registra o ve lo que
 * registró; el cliente se entera de que está disponible y lo ve después de evaluar al taller.
 */
export default function AppointmentResultToggle({ appointment, asProvider, onEvaluate, openSignal }) {
  const { result, resultAvailable, resultPending, canFinish } = appointment;
  if (asProvider && !resultPending && !canFinish && !result) return null;
  if (!asProvider && !resultAvailable) return null;
  const label = result ? `Resultado: ${outcomeLabel(result.outcome)}` : '';
  const news = asProvider
    ? (resultPending || canFinish
      ? { hasNews: true, hasRecords: true, summary: canFinish ? 'La cita está en curso: finalízala y registra el resultado' : 'Falta registrar el resultado de esta cita', history: '' }
      : { hasNews: false, hasRecords: true, summary: '', history: label })
    : (result
      ? { hasNews: false, hasRecords: true, summary: '', history: label }
      : { hasNews: true, hasRecords: true, summary: 'Resultado disponible: evalúa al taller para verlo', history: '' });

  return (
    <TrackingDetail news={news} openSignal={openSignal}>
      {asProvider
        ? (result ? <AppointmentResultDetail result={result} /> : <AppointmentResultForm appointment={appointment} />)
        : (result ? <AppointmentResultDetail result={result} /> : (
          <div className="apr-locked">
            <Lock size={22} aria-hidden="true" />
            <p>{`${appointment.tallerName || 'El taller'} ya registró el resultado de tu cita. Para verlo, cuéntanos cómo fue tu experiencia y califica al taller.`}</p>
            <button type="button" className="apr-submit" onClick={onEvaluate}><Star size={16} /> Evaluar y ver resultado</button>
          </div>
        ))}
    </TrackingDetail>
  );
}
