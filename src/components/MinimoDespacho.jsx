import React from 'react';
import { Banknote, CheckCircle2, ChevronRight, PackageSearch, Store, Truck } from 'lucide-react';
import { formatMinimo, minimoVigente, progresoMinimo } from '../utils/minimoDespacho';
import '../styles/minimo-despacho.css';

/**
 * Mínimo de despacho de una tienda (22-nov), como en la app (`components/store/MinimoDespacho.tsx`).
 * `card` para el perfil de la tienda y la ficha del producto; `pill` para espacios compactos.
 * No muestra nada si la tienda no tiene mínimo.
 */
export function MinimoDespachoBadge({ minimo, variant = 'card', className = '' }) {
  const vigente = minimoVigente(minimo);
  if (vigente == null) return null;

  if (variant === 'pill') {
    return (
      <span className={`mdp-pill ${className}`.trim()}>
        <Truck size={13} /> Despacho desde {formatMinimo(vigente)}
      </span>
    );
  }

  return (
    <div className={`mdp-card ${className}`.trim()} data-testid="minimo-despacho-badge">
      <span className="mdp-card-icon" aria-hidden="true"><Truck size={20} /></span>
      <span className="mdp-card-copy">
        <small className="mdp-eyebrow">Mínimo de despacho</small>
        <strong>Despacho desde {formatMinimo(vigente)}</strong>
        <span>Compra mínima en esta tienda para despacho dentro o fuera de la comuna. El retiro en tienda no tiene mínimo.</span>
      </span>
    </div>
  );
}

/**
 * Avance hacia el mínimo de despacho de una tienda: cuánto falta, barra de avance y la invitación a seguir
 * comprando en su perfil. Cuando ya se alcanzó, una confirmación breve. `compact` para el aviso de "agregado".
 */
export function MinimoDespachoProgress({ storeName, minimo, subtotal, onVisitStore, compact = false }) {
  const progreso = progresoMinimo(minimo, subtotal);
  if (!progreso) return null;
  const tienda = String(storeName || '').trim() || 'Esta tienda';

  if (progreso.cumple) {
    return (
      <p className="mdp-ok" role="status">
        <CheckCircle2 size={16} /> Alcanzaste el mínimo de despacho ({formatMinimo(progreso.minimo)})
      </p>
    );
  }

  const porcentaje = Math.max(4, Math.round(progreso.avance * 100));
  return (
    <div className={`mdp-progress${compact ? ' is-compact' : ''}`} role="status" aria-live="polite">
      <div className="mdp-progress-head">
        <span className="mdp-progress-icon" aria-hidden="true"><Truck size={compact ? 16 : 18} /></span>
        <span className="mdp-progress-copy">
          <strong>Te faltan {formatMinimo(progreso.faltante)} para el despacho</strong>
          <span>{tienda} despacha desde {formatMinimo(progreso.minimo)} en productos. También puedes retirar en tienda.</span>
        </span>
      </div>
      <div
        className="mdp-track"
        role="progressbar"
        aria-label="Avance hacia el mínimo de despacho"
        aria-valuemin={0}
        aria-valuemax={progreso.minimo}
        aria-valuenow={progreso.subtotal}
      >
        <span style={{ width: `${porcentaje}%` }} />
      </div>
      <div className="mdp-track-labels">
        <span>Llevas {formatMinimo(progreso.subtotal)}</span>
        <span>Mínimo {formatMinimo(progreso.minimo)}</span>
      </div>
      {onVisitStore && (
        <button type="button" className="mdp-visit" onClick={onVisitStore} aria-label={`Ver más productos de ${tienda}`}>
          <Store size={16} /> Ver más productos de la tienda <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * Ranura «Mínimo de despacho» (22-nov), como en la app (`components/seller/MinimoDespachoSlot.tsx`): interruptor y,
 * al encenderlo, el monto mínimo de compra para despachar dentro o fuera de la comuna. Va bajo los métodos de envío
 * en Configuración → Envíos y en la postulación de tienda. `field` sale de `useMinimoDespachoField`.
 */
export function MinimoDespachoSlot({ field }) {
  const { activo, despacha, texto, setTexto, setEnabled, error } = field;
  return (
    <div className={`mdp-slot${activo ? ' is-active' : ''}${despacha ? '' : ' is-disabled'}`} data-testid="minimo-despacho-slot">
      <div className="mdp-slot-head">
        <span className="mdp-slot-icon" aria-hidden="true"><Banknote size={20} /></span>
        <span className="mdp-slot-copy">
          <strong>Mínimo de despacho</strong>
          <small>{despacha
            ? 'Monto mínimo de compra para despachar dentro o fuera de la comuna.'
            : 'Activa un envío dentro o fuera de la comuna para fijar un mínimo.'}</small>
        </span>
        <label className="mdp-switch">
          <input
            type="checkbox"
            checked={activo}
            disabled={!despacha}
            onChange={(event) => setEnabled(event.target.checked)}
            aria-label="Activar mínimo de despacho"
          />
          <i />
        </label>
      </div>
      {activo && (
        <label className="mdp-field">
          <span>Monto mínimo de compra</span>
          <span className={`mdp-amount${error ? ' is-error' : ''}`}>
            <b>$</b>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 15.000"
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </span>
          {error
            ? <small className="mdp-field-error">{error}</small>
            : <small className="mdp-help">Se muestra en tu perfil, en tus productos y en el carrito. El retiro en tienda no tiene mínimo.</small>}
        </label>
      )}
    </div>
  );
}

/**
 * Ranura «Mínimo para encargo» (28-nov): interruptor y monto desde el que la tienda manda a pedir un repuesto sin
 * stock. Va bajo el mínimo de despacho en Configuración → Envíos. `field` sale de `useMinimoEncargoField`.
 */
export function MinimoEncargoSlot({ field }) {
  const { activo, texto, setTexto, setEnabled, error } = field;
  return (
    <div className={`mdp-slot${activo ? ' is-active' : ''}`} data-testid="minimo-encargo-slot">
      <div className="mdp-slot-head">
        <span className="mdp-slot-icon" aria-hidden="true"><PackageSearch size={20} /></span>
        <span className="mdp-slot-copy">
          <strong>Mínimo para encargo</strong>
          <small>Si un repuesto se queda sin stock y su precio llega a este monto, sigue visible con «Consultar por stock» y puedes encargarlo a tu importadora.</small>
        </span>
        <label className="mdp-switch">
          <input
            type="checkbox"
            checked={activo}
            onChange={(event) => setEnabled(event.target.checked)}
            aria-label="Activar mínimo para encargo"
          />
          <i />
        </label>
      </div>
      {activo && (
        <label className="mdp-field">
          <span>Precio mínimo del repuesto</span>
          <span className={`mdp-amount${error ? ' is-error' : ''}`}>
            <b>$</b>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 40.000"
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </span>
          {error
            ? <small className="mdp-field-error">{error}</small>
            : <small className="mdp-help">Bajo este monto, un repuesto sin stock sigue como hoy. Los repuestos «a cotizar» sin stock siempre se pueden consultar.</small>}
        </label>
      )}
    </div>
  );
}
