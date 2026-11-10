import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Gift, Info, QrCode, X } from 'lucide-react';
import {
  daysLeft, getDiagnosticStatus, getReferralsSummary, prizeProgress, referralsInCycle, referralsProgress,
} from '../../services/workshopApi';
import { ROUTES, profilePath } from '../../routes/paths';
import '../../styles/faults.css';

/**
 * Avance del servicio de agendamiento en Mi taller (web): un icono de informacion que, al tocarlo, muestra las barras de
 * progreso (pedidos por busquedas de repuestos y compradores invitados) que antes vivian en el menu "Servicio de agendamiento".
 */
export default function BookingProgressInfo() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [referrals, setReferrals] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    getDiagnosticStatus().then((data) => { if (active) setStatus(data); }).catch(() => {});
    getReferralsSummary().then((data) => { if (active) setReferrals(data); }).catch(() => {});
    return () => { active = false; };
  }, [open]);

  const days = status ? daysLeft(status) : 0;
  const done = status ? status.necesidadesPorGratis - status.necesidadesParaProximoGratis : 0;

  return (
    <>
      <button type="button" className="ads-mgmt-refresh" onClick={() => setOpen(true)} aria-label="Ver el avance del servicio de agendamiento" title="Avance del servicio de agendamiento">
        <Info size={15} />
      </button>
      {open && (
        <div className="ft-modal-backdrop" role="dialog" aria-modal="true" aria-label="Servicio de agendamiento" onClick={() => setOpen(false)}>
          <div className="ft-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ft-modal-head">
              <h2><CalendarClock size={16} /> Servicio de agendamiento</h2>
              <button type="button" className="ft-icon-btn" aria-label="Cerrar" onClick={() => setOpen(false)}><X size={20} /></button>
            </div>
            {!status ? <p className="ft-sub">Cargando…</p> : (
              <>
                <p className="ft-sub">
                  {status.activo ? `${days === 1 ? 'Te queda 1 día' : `Te quedan ${days} días`} de citas activas.` : 'Servicio apagado: tus clientes aún no pueden agendar contigo.'}
                </p>
                <section>
                  <h3 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><Gift size={16} /> Gratis con búsquedas de repuestos</h3>
                  <div className="ft-progress" role="progressbar" aria-valuemin={0} aria-valuemax={status.necesidadesPorGratis} aria-valuenow={done}><div style={{ width: `${Math.round(prizeProgress(status) * 100)}%` }} /></div>
                  <p className="ft-sub">{done}/{status.necesidadesPorGratis} · te faltan {status.necesidadesParaProximoGratis} · {status.periodosGanados} premios ganados</p>
                </section>
                {referrals && (
                  <section>
                    <h3 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><QrCode size={16} /> Gratis invitando compradores</h3>
                    <div className="ft-progress" role="progressbar" aria-valuemin={0} aria-valuemax={referrals.porPremio} aria-valuenow={referralsInCycle(referrals)}><div style={{ width: `${Math.round(referralsProgress(referrals) * 100)}%` }} /></div>
                    <p className="ft-sub">{referralsInCycle(referrals)}/{referrals.porPremio} · te faltan {referrals.paraProximo} · {referrals.periodosGanados} premios ganados</p>
                  </section>
                )}
                <div className="ft-actions">
                  <Link className="ft-btn ft-btn-outline" to={ROUTES.auctions}>Publicar una búsqueda</Link>
                  <Link className="ft-btn ft-btn-primary" to={profilePath('diagnostico')}>{status.activo ? 'Agregar días' : 'Activar servicio'}</Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
