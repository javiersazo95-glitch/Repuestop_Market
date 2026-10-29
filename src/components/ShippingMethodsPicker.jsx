import React from 'react';
import { SHIPPING_METHOD_DEFS_FALLBACK, useShippingMethodDefs } from '../data/shippingMethods';

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
  // Metodos activos del mantenedor (`METODO_ENVIO`). Uno que el dueno oculto se sigue mostrando
  // mientras la tienda lo tenga marcado, para que pueda verlo y desmarcarlo a conciencia.
  const activeDefs = useShippingMethodDefs();
  const activeIds = new Set(activeDefs.map((def) => def.id));
  const defs = [
    ...activeDefs,
    ...SHIPPING_METHOD_DEFS_FALLBACK.filter((def) => !activeIds.has(def.id) && selections[def.id]?.enabled),
  ];
  const update = (id, patch) => {
    onChange({ ...selections, [id]: { ...selections[id], ...patch } });
  };

  return (
    <div className="shipping-methods-editor">
      {defs.map((def) => {
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
