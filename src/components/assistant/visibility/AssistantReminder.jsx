import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Bike, Car, Check, Clock, MessagesSquare, Package, Search, Wrench } from 'lucide-react';
import { loadAssistantVisibility } from '../../../services/assistantApi';
import { missingStepsLabel, STEP_META, STEP_ORDER, STEP_SHORT } from '../../../utils/assistantVisibility';
import { syncAssistantReminder } from '../../../utils/assistantReminder';
import { RepuestinAvatar } from '../AssistantBits';
import { ProgressRing, RecommendationPodium } from './VisibilityParts';

export const STEP_ICONS = { REPUESTOS: Wrench, MARCAS: Car, CONSIGUE: Package, ENVIOS: Bike };

/**
 * Tarjeta "Que Repuestín te recomiende" del inicio del vendedor (`AssistantVisibilityCard.tsx`): colorida y arriba de
 * todo mientras el perfil esté incompleto, con el avance, los pasos y un botón directo. Al 100% desaparece.
 */
export function AssistantVisibilityCard({ sellerId, onOpen }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!sellerId) return undefined;
    let active = true;
    loadAssistantVisibility(sellerId)
      .then((next) => {
        syncAssistantReminder(sellerId, next);
        if (active) setData(next);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [sellerId]);
  if (!data || data.avance >= 100) return null;
  const missing = data.pasos.filter((step) => !step.completo).length;
  const done = new Set(data.pasos.filter((step) => step.completo).map((step) => step.clave));
  return (
    <button
      type="button"
      className="rv-home-card"
      onClick={onOpen}
      aria-label={`Que Repuestín te recomiende. ${missingStepsLabel(missing)} para recibir preguntas de compradores. Completar ahora.`}
    >
      <span className="rv-home-top">
        <span className="rv-home-copy">
          <span className="rv-eyebrow"><RepuestinAvatar size={20} /> Que Repuestín te recomiende</span>
          <strong>{missingStepsLabel(missing)} para recibir preguntas de compradores</strong>
          <small>
            {data.busquedasPerdidas > 0
              ? (data.busquedasPerdidas === 1 ? 'Esta semana 1 comprador buscó repuestos con Repuestín y no te llegó.' : `Esta semana ${data.busquedasPerdidas} compradores buscaron repuestos con Repuestín y no te llegaron.`)
              : data.tiendaNueva ? `Eres tienda nueva: completa tu perfil y Repuestín te impulsa ${data.diasImpulso} días más.` : 'Cuéntale qué trabajas y Repuestín te enviará compradores que buscan justo eso.'}
          </small>
        </span>
        <ProgressRing value={data.avance} size={76} stroke={8} track="rgba(255,255,255,.25)" />
      </span>
      <span className="rv-home-steps">
        {STEP_ORDER.map((key) => {
          const complete = done.has(key);
          const Icon = complete ? Check : STEP_ICONS[key];
          return (
            <span key={key} className={`rv-home-step${complete ? ' is-done' : ''}`} aria-label={`${STEP_META[key].title}: ${complete ? 'listo' : 'falta'}`}>
              <span className="rv-home-step-icon" style={{ background: complete ? '#18A957' : STEP_META[key].main }}><Icon size={12} /></span>
              <span>{STEP_SHORT[key]}</span>
            </span>
          );
        })}
      </span>
      <span className="rv-home-cta">Completar ahora <ArrowRight size={18} /></span>
    </button>
  );
}

const POINTS = [
  { Icon: Search, text: 'Cuando un comprador no encuentra un repuesto, Repuestín le recomienda las 3 casas con más probabilidad de tenerlo.' },
  { Icon: Wrench, text: 'Elige solo entre las tiendas que le contaron qué repuestos trabajan, aunque no los tengan publicados.' },
  { Icon: MessagesSquare, text: 'El comprador te escribe directo: es una venta que hoy se lleva otra tienda.' },
];

/**
 * Aviso a la tienda que aún no registró qué repuestos trabaja: está perdiendo clientes de Repuestín
 * (`AssistantMissingPopup.tsx`). "Registrar ahora" abre la pantalla; "Salir" deja el ícono junto a la campana.
 */
export function AssistantMissingPopup({ open, storeName, storePhoto, onRegister, onExit }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onExit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onExit]);
  if (!open) return null;
  return (
    <div className="rv-popup-root">
      <div className="rv-popup" role="dialog" aria-modal="true" aria-label="Estás perdiendo clientes">
        <div className="rv-popup-hero">
          <span className="rv-popup-badge"><AlertTriangle size={14} /> Advertencia</span>
          <span className="rv-popup-avatar"><RepuestinAvatar size={64} /></span>
          <h2>Estás perdiendo clientes</h2>
          <p>Aún no le cuentas a Repuestín qué repuestos trabajas, así que no puede recomendarte.</p>
          <RecommendationPodium storePlace={null} storeName={storeName || 'Tu tienda'} storePhoto={storePhoto} compact />
        </div>
        <div className="rv-popup-body">
          <span className="rv-overline">¿De qué se trata «Que Repuestín te recomiende»?</span>
          {POINTS.map(({ Icon, text }) => (
            <div key={text} className="rv-popup-point"><span><Icon size={16} /></span><p>{text}</p></div>
          ))}
          <span className="rv-popup-time"><Clock size={14} /> Lo completas en menos de 2 minutos</span>
          <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={onRegister}>Registrar ahora <ArrowRight size={18} /></button>
          <button type="button" className="ra-btn ra-btn-ghost ra-btn-block" onClick={onExit}>Salir</button>
          <p className="rv-caption rv-center">Si sales, te dejamos un recordatorio <AlertTriangle size={12} className="rv-warn" /> arriba, junto a tus notificaciones.</p>
        </div>
      </div>
    </div>
  );
}

/** Ícono de advertencia junto a la campana mientras la tienda no registre qué trabaja. */
export function AssistantReminderIcon({ onPress }) {
  return (
    <button type="button" className="rv-reminder-icon" onClick={onPress} aria-label="Que Repuestín te recomiende: aún no registras qué repuestos trabajas" title="Que Repuestín te recomiende">
      <AlertTriangle size={18} />
    </button>
  );
}
