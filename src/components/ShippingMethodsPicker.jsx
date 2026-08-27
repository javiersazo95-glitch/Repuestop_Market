import React from 'react';
import { SHIPPING_METHOD_DEFS } from '../data/shippingMethods';

/**
 * Selector de metodos de envio de la tienda.
 *
 * Vivia dentro de `ProfileDashboard`; se extrajo al necesitarlo tambien el registro de
 * tienda fundadora, que es donde la app los pide. Los dos tienen que producir la MISMA
 * cadena: `Tienda.shippingMethods` es un CSV que leen la web, la app y el backoffice.
 *
 * `selections` es `{ [id]: { enabled, price } }`; se arma con
 * `parseShippingSelections()` y se envia con `buildShippingMethodsString()`.
 */
export default function ShippingMethodsPicker({ selections, onChange }) {
  const update = (id, patch) => {
    onChange({ ...selections, [id]: { ...selections[id], ...patch } });
  };

  return (
    <div className="shipping-methods-editor">
      {SHIPPING_METHOD_DEFS.map((def) => {
        const selection = selections[def.id] || { enabled: false, price: '' };
        return (
          <label key={def.id} className={`shipping-method-option ${selection.enabled ? 'checked' : ''}`}>
            <input
              type="checkbox"
              checked={selection.enabled}
              onChange={(e) => update(def.id, { enabled: e.target.checked })}
            />
            <span className="shipping-method-option-label">{def.label}</span>
            {def.hasPrice && selection.enabled && (
              <span className="shipping-method-price-input">
                <span>$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="Gratis"
                  value={selection.price}
                  onChange={(e) => update(def.id, { price: e.target.value.replace(/\D/g, '') })}
                />
              </span>
            )}
            {!def.hasPrice && def.note && selection.enabled && (
              <span className="shipping-method-note-badge">{def.note}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}
