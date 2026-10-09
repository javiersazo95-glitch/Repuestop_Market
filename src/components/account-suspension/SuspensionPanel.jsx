import React, { useState } from 'react';
import {
  CalendarDays, CheckCircle2, ChevronRight, Clock, FileText, Headphones, Hourglass, Lock, LogOut,
} from 'lucide-react';
import {
  allowedActions, blockedActionsLine, formatChileDate, levelLabel, suspensionTitle,
} from '../../utils/accountSuspension';
import { useSuspensionCountdown } from './useSuspensionCountdown';

const MOTIVO_CORTO = 220;
const UNIDADES = [
  { key: 'days', label: 'días' },
  { key: 'hours', label: 'horas' },
  { key: 'minutes', label: 'min' },
  { key: 'seconds', label: 'seg' },
];

/**
 * Cuenta suspendida o bloqueada (pruebas en dev, 2026-10-09): reemplaza al Resumen del panel
 * mientras dure. Estado y contador arriba, despues el motivo y lo que puede seguir haciendo; en
 * el celular las acciones van fijas abajo, sobre la zona segura del navegador.
 */
export default function SuspensionPanel({
  role, suspension, onPrimary, onSecondary, onLogout, onAppeal, onRefresh, onHelp,
}) {
  const countdown = useSuspensionCountdown(suspension);
  const [motivoCompleto, setMotivoCompleto] = useState(false);
  if (!suspension) return null;

  const esComprador = role === 'BUYER';
  const motivo = suspension.reason || 'Tu cuenta fue suspendida por el equipo de RepuesTop.';
  const motivoLargo = motivo.length > MOTIVO_CORTO;
  const fecha = formatChileDate(suspension.endsAt);

  return (
    <section className="suspension-panel" aria-labelledby="suspension-title">
      <div className="suspension-card suspension-status">
        <div className="suspension-status-icon" aria-hidden="true">
          {suspension.kind === 'SUSPENSION' ? <Clock size={22} /> : <Lock size={22} />}
        </div>
        <div className="suspension-status-text">
          <h2 id="suspension-title">{suspensionTitle(suspension)}</h2>
          <div className="suspension-status-meta">
            <span className="suspension-pill">{levelLabel(suspension)}</span>
            {suspension.caseReference ? <span>Caso {suspension.caseReference}</span> : null}
          </div>
        </div>
        <button type="button" className="suspension-logout" onClick={onLogout}>
          <LogOut size={16} />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {countdown ? (
        countdown.expired ? (
          <div className="suspension-card suspension-done">
            <strong><CheckCircle2 size={18} /> Plazo cumplido</strong>
            <p>
              Tu suspensión terminó{fecha ? ` el ${fecha}` : ''}. Actualiza el estado para volver a usar tu cuenta; si
              sigue apareciendo, cierra sesión e ingresa de nuevo.
            </p>
            <button type="button" className="suspension-btn suspension-btn-secondary" onClick={onRefresh}>Actualizar estado</button>
          </div>
        ) : (
          <div
            className="suspension-card"
            role="timer"
            aria-label={`Tiempo restante: ${countdown.days} días, ${countdown.hours} horas y ${countdown.minutes} minutos`}
          >
            <span className="suspension-overline">Tiempo restante</span>
            <div className="suspension-units">
              {UNIDADES.map(({ key, label }) => (
                <div key={key} className="suspension-unit">
                  <strong>{String(countdown[key]).padStart(2, '0')}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {countdown.progress !== null ? (
              <div className="suspension-track" aria-hidden="true">
                <div className="suspension-fill" style={{ width: `${Math.round(countdown.progress * 100)}%` }} />
              </div>
            ) : null}
            {fecha ? (
              <p className="suspension-date"><CalendarDays size={15} /> Se reactiva el {fecha} (hora de Chile)</p>
            ) : null}
          </div>
        )
      ) : null}

      <div className="suspension-card">
        <span className="suspension-overline">Motivo</span>
        <p className="suspension-reason">
          {motivoLargo && !motivoCompleto ? `${motivo.slice(0, MOTIVO_CORTO).trimEnd()}…` : motivo}
        </p>
        {motivoLargo ? (
          <button type="button" className="suspension-link" onClick={() => setMotivoCompleto((v) => !v)}>
            {motivoCompleto ? 'Ver menos' : 'Ver más'}
          </button>
        ) : null}
      </div>

      <div className="suspension-card">
        <span className="suspension-overline">Puedes seguir</span>
        <ul className="suspension-actions-list">
          {allowedActions(role, suspension).map((accion) => (
            <li key={accion}><CheckCircle2 size={18} aria-hidden="true" /> {accion}</li>
          ))}
        </ul>
        <hr />
        <p className="suspension-muted">{blockedActionsLine(role)}</p>
      </div>

      {suspension.reviewRequested ? (
        <div className="suspension-card suspension-row">
          <Hourglass size={20} className="suspension-row-icon is-warning" aria-hidden="true" />
          <div>
            <strong>Revisión en curso</strong>
            <p className="suspension-muted">Te responderemos por correo electrónico.</p>
          </div>
        </div>
      ) : suspension.canAppeal ? (
        <button type="button" className="suspension-card suspension-row suspension-row-button" onClick={onAppeal}>
          <FileText size={20} className="suspension-row-icon" aria-hidden="true" />
          <div>
            <strong>Solicitar revisión</strong>
            <p className="suspension-muted">Si crees que hubo un error, pide que revisemos tu caso.</p>
          </div>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ) : null}

      <button type="button" className="suspension-help" onClick={onHelp}>
        <Headphones size={16} aria-hidden="true" />
        <span>¿Tienes dudas? Escríbenos a soporte</span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>

      <div className="suspension-footer">
        <button type="button" className="suspension-btn suspension-btn-primary" onClick={onPrimary}>
          {esComprador ? 'Ver mis pedidos' : 'Ver mis ventas'}
        </button>
        {!esComprador ? (
          <button type="button" className="suspension-btn suspension-btn-secondary" onClick={onSecondary}>
            {suspension.level === 'FRAUDE' ? 'Ver mi saldo' : 'Retirar saldo'}
          </button>
        ) : null}
      </div>
    </section>
  );
}
