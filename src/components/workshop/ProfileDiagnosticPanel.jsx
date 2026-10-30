import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, CheckCircle2, Gift, Loader2 } from 'lucide-react';
import { activateDiagnostic, coinsToPesos, daysLeft, getDiagnosticStatus, prizeProgress } from '../../services/workshopApi';
import { ROUTES } from '../../routes/paths';
import ConfirmDialog from '../ConfirmDialog';
import '../../styles/faults.css';
import '../talleres/taller-profile.css';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Servicio de agendamiento (en el backend, «Diagnóstico»): cuánto cuesta, cómo activarlo paso a paso y cómo conseguirlo
 * gratis con búsquedas de repuestos. Mismo contenido que `mobile/components/workshop/BookingServiceGuide.tsx`.
 */
export default function ProfileDiagnosticPanel({ onOpenAds }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setStatus(await getDiagnosticStatus()); } catch (err) { setError(err?.message || 'No pudimos cargar tu servicio de agendamiento.'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // window.confirm no abre nada en un navegador embebido y dejaba el boton mudo: se confirma con ConfirmDialog.
  // El saldo se vuelve a leer: pudo recargar en el monedero sin salir de esta pantalla.
  const requestActivate = async () => {
    if (!status) return;
    setBusy(true);
    setError('');
    try {
      const fresh = await getDiagnosticStatus();
      setStatus(fresh);
      if (fresh.saldoMonedas < fresh.costoMonedas) {
        setError(`Necesitas ${fresh.costoMonedas} monedas y tienes ${fresh.saldoMonedas}. Recarga tu monedero para continuar.`);
        return;
      }
      setConfirming(true);
    } catch (err) {
      setError(err?.message || 'No pudimos revisar tu saldo.');
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    setBusy(true);
    setError('');
    try { setStatus(await activateDiagnostic()); setConfirming(false); } catch (err) { setError(err?.message || 'No pudimos activar el servicio.'); } finally { setBusy(false); }
  };

  if (error && !status) return <div className="ft-empty" role="alert"><AlertCircle size={20} /><strong>No pudimos cargar el servicio</strong>{error}<br /><button type="button" className="ft-btn ft-btn-outline" style={{ marginTop: 10 }} onClick={load}>Reintentar</button></div>;
  if (!status) return <div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando…</div>;

  const days = daysLeft(status);
  const done = status.necesidadesPorGratis - status.necesidadesParaProximoGratis;
  const price = coinsToPesos(status.costoMonedas);
  const actionLabel = status.activo ? `Agregar ${status.vigenciaDias} días` : 'Activar servicio';

  return (
    <div className="ft-page" style={{ background: 'transparent', minHeight: 0, paddingBottom: 0 }}>
      <div className="ft-shell" style={{ padding: 0 }}>
        <div className="ft-head"><div><h2>Servicio de agendamiento</h2><p>Recibe citas en línea desde tu perfil y ofrece agendar en tus comentarios de fallas, con el horario principal de tu taller.</p></div></div>

        <section className="ft-card">
          <div className="ft-card-top">
            <h3 style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{status.activo ? <CheckCircle2 size={20} color="#0e7038" /> : <CalendarClock size={20} />} {status.activo ? 'Servicio activo' : 'Servicio apagado'}</h3>
            <span className={`ft-badge ${status.activo ? '' : 'is-closed'}`}>{status.activo ? 'Activo' : 'Apagado'}</span>
          </div>
          <p className="ft-sub">
            {status.activo
              ? `${days === 1 ? 'Te queda 1 día' : `Te quedan ${days} días`}${status.venceEn ? ` (vence el ${formatDate(status.venceEn)})` : ''}`
              : 'Tus clientes aún no pueden agendar contigo.'}
          </p>
          <p><strong>{price} por {status.vigenciaDias} días.</strong> Equivale a {status.costoMonedas} monedas (cada moneda vale $50). Tienes {status.saldoMonedas} monedas.</p>

          <div>
            <strong style={{ fontSize: 13 }}>Cómo activarlo</strong>
            <ol className="taller-profile__steps" aria-label="Cómo activarlo">
              <li><span>1</span>Registra tu horario para recibir citas en Mi taller › Atención y citas.</li>
              <li><span>2</span>Ten {status.costoMonedas} monedas en tu saldo: si te faltan, recarga en el monedero, con la moneda de arriba a la derecha.</li>
              <li><span>3</span>Toca «{actionLabel}» y confirma: se descuentan las monedas y se suman {status.vigenciaDias} días.</li>
              <li><span>4</span>En Mi taller marca «Recibir citas en línea»: ahí ves cuántos días te quedan.</li>
            </ol>
          </div>

          {!status.agendaConfigurada && <p className="ft-note">Antes de activarlo registra el horario de tu taller: es la agenda de tus citas.{onOpenAds && <> <button type="button" className="ft-btn ft-btn-outline" style={{ marginLeft: 8 }} onClick={onOpenAds}>Ir a Mi taller</button></>}</p>}
          {error && !confirming && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
          <div className="ft-actions"><button type="button" className="ft-btn ft-btn-primary" onClick={requestActivate} disabled={busy || !status.agendaConfigurada}>{busy ? 'Procesando…' : actionLabel}</button></div>
        </section>

        <section className="ft-card">
          <h3 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Gift size={20} /> O consíguelo gratis</h3>
          <p className="ft-sub">Cuando se completan {status.necesidadesPorGratis} pedidos pagados por búsquedas de repuestos, se agregan {status.vigenciaDias} días a tu contador.</p>
          <div className="ft-progress" role="progressbar" aria-valuemin={0} aria-valuemax={status.necesidadesPorGratis} aria-valuenow={done}><div style={{ width: `${Math.round(prizeProgress(status) * 100)}%` }} /></div>
          <p className="ft-sub">{done}/{status.necesidadesPorGratis} · te faltan {status.necesidadesParaProximoGratis} · {status.periodosGanados} premios ganados</p>
          <div className="ft-actions"><Link className="ft-btn ft-btn-outline" to={ROUTES.auctions}>Publicar una búsqueda de repuestos</Link></div>
        </section>
      </div>
      <ConfirmDialog
        isOpen={confirming}
        tone="primary"
        title={status.activo ? `Agregar ${status.vigenciaDias} días` : 'Activar servicio de agendamiento'}
        message={`Se descontarán ${status.costoMonedas} monedas (${price}) por ${status.vigenciaDias} días${status.activo ? ', que se suman a los que ya tienes' : ''}.`}
        confirmLabel={status.activo ? 'Sí, agregar' : 'Sí, activar'}
        isBusy={busy}
        error={confirming ? error : ''}
        onConfirm={activate}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
