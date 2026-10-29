import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Gift, Loader2, Stethoscope } from 'lucide-react';
import { activateDiagnostic, coinsToPesos, getDiagnosticStatus, prizeProgress } from '../../services/workshopApi';
import { ROUTES } from '../../routes/paths';
import '../../styles/faults.css';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Servicio Diagnóstico: agenda en los comentarios de fallas, con el horario principal del taller. */
export default function ProfileDiagnosticPanel({ onOpenAds }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setStatus(await getDiagnosticStatus()); } catch (err) { setError(err?.message || 'No pudimos cargar tu servicio Diagnóstico.'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activate = async () => {
    if (!status) return;
    if (status.saldoMonedas < status.costoMonedas) {
      setError(`Necesitas ${status.costoMonedas} monedas y tienes ${status.saldoMonedas}. Recarga tu monedero para continuar.`);
      return;
    }
    if (!window.confirm(`Se descontarán ${status.costoMonedas} monedas (${coinsToPesos(status.costoMonedas)}) por ${status.vigenciaDias} días${status.activo ? ', que se suman a los que ya tienes' : ''}.`)) return;
    setBusy(true);
    setError('');
    try { setStatus(await activateDiagnostic()); } catch (err) { setError(err?.message || 'No pudimos activar el Diagnóstico.'); } finally { setBusy(false); }
  };

  if (error && !status) return <div className="ft-empty" role="alert"><AlertCircle size={20} /><strong>No pudimos cargar el servicio</strong>{error}<br /><button type="button" className="ft-btn ft-btn-outline" style={{ marginTop: 10 }} onClick={load}>Reintentar</button></div>;
  if (!status) return <div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando…</div>;

  return (
    <div className="ft-page" style={{ background: 'transparent', minHeight: 0, paddingBottom: 0 }}>
      <div className="ft-shell" style={{ padding: 0 }}>
        <div className="ft-head"><div><h2>Servicio Diagnóstico</h2><p>Ofrece agendamiento en tus comentarios de fallas, con el horario principal de tu taller.</p></div></div>

        <section className="ft-card">
          <div className="ft-card-top">
            <h3 style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{status.activo ? <CheckCircle2 size={20} color="#0e7038" /> : <Stethoscope size={20} />} {status.activo ? 'Diagnóstico activo' : 'Diagnóstico inactivo'}</h3>
            <span className={`ft-badge ${status.activo ? '' : 'is-closed'}`}>{status.activo ? 'Activo' : 'Inactivo'}</span>
          </div>
          <p className="ft-sub">{status.activo && status.venceEn ? `Vence el ${formatDate(status.venceEn)}` : 'Tus comentarios no ofrecerán agenda desde el Diagnóstico.'}</p>
          <p>{status.vigenciaDias} días por {status.costoMonedas} monedas ({coinsToPesos(status.costoMonedas)}). Tienes {status.saldoMonedas} monedas.</p>
          {!status.agendaConfigurada && <p className="ft-note">Antes de activarlo registra el horario de atención de tu taller: es la agenda de tus citas.{onOpenAds && <> <button type="button" className="ft-btn ft-btn-outline" style={{ marginLeft: 8 }} onClick={onOpenAds}>Registrar mi horario</button></>}</p>}
          {error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
          <div className="ft-actions"><button type="button" className="ft-btn ft-btn-primary" onClick={activate} disabled={busy || !status.agendaConfigurada}>{busy ? 'Procesando…' : (status.activo ? 'Renovar Diagnóstico' : 'Activar Diagnóstico')}</button></div>
        </section>

        <section className="ft-card">
          <h3 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Gift size={20} /> Gratis cada {status.necesidadesPorGratis} necesidades de compra</h3>
          <p className="ft-sub">Registra tus compras de repuestos en Necesidades de compra: por cada {status.necesidadesPorGratis} ganas {status.vigenciaDias} días de Diagnóstico.</p>
          <div className="ft-progress" role="progressbar" aria-valuemin={0} aria-valuemax={status.necesidadesPorGratis} aria-valuenow={status.necesidadesPorGratis - status.necesidadesParaProximoGratis}><div style={{ width: `${Math.round(prizeProgress(status) * 100)}%` }} /></div>
          <p className="ft-sub">Te faltan {status.necesidadesParaProximoGratis} para el próximo premio · {status.necesidadesRegistradas} registradas · {status.periodosGanados} premios ganados</p>
          <div className="ft-actions"><Link className="ft-btn ft-btn-outline" to={ROUTES.auctions}>Publicar una necesidad de compra</Link></div>
        </section>
      </div>
    </div>
  );
}
