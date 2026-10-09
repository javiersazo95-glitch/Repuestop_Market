import React from 'react';
import { Car, CheckCircle2, Plus } from 'lucide-react';
import { vehicleLabel } from '../utils/cartDelivery';
import { COMPAT } from '../utils/compatibilityCheck';
import { productPath } from '../routes/paths';
import CompatibilityStatus from './CompatibilityStatus';

/**
 * Lo que es de CADA producto del checkout (igual que la app CartItemDelivery): para qué vehículo
 * es. El envío (método y dirección) es uno por tienda y se elige arriba, en "Envío de la tienda"
 * (CheckoutStoreShipment).
 *
 * `compatibility`: si el repuesto le sirve al vehículo elegido ('loading', COMPATIBLE,
 * NO_COINCIDE, SIN_DATOS, UNIVERSAL o null si no hay nada que decir). Se muestra justo bajo el
 * vehículo; cuando no coincide ofrece revisar la ficha, cambiar el vehículo, preguntar o quitarlo.
 */
export default function CheckoutItemDelivery({
  item, delivery, vehicles, compatibility = null, onChange, onAddVehicle, onEditVehicle, onRemove,
}) {
  const selectedVehicle = vehicles.find((vehicle) => vehicle.key === delivery.vehicleKey) || null;

  // "Cambiar vehículo" abre el formulario para indicar otro vehículo, que queda elegido para este
  // producto al guardarlo (como en la app). Antes sólo movía el foco al selector, que está justo
  // arriba y a la vista, así que el botón parecía no hacer nada.
  // Las fichas se abren en otra pestaña: volver no debe borrar lo que ya se eligió en el checkout.
  const compatActions = [
    { label: 'Ver compatibilidad', to: `${productPath(item)}?abrir=compatibilidad`, newTab: true },
    { label: 'Cambiar vehículo', onClick: onAddVehicle },
    { label: 'Preguntar a la tienda', to: `${productPath(item)}?abrir=preguntas`, newTab: true },
    ...(onRemove ? [{ label: 'Quitar del carrito', onClick: onRemove }] : []),
  ];

  // Para qué vehículo: siempre es de cada producto, aunque el envío sea de la tienda.
  const vehicleStep = (
    <div className="checkout-item-delivery-step">
      <span className="checkout-item-delivery-label">
        <Car size={14} /> Vehículo
        {!item.esUniversal && <em className="checkout-item-required">Obligatorio</em>}
      </span>
      {item.esUniversal ? (
        <CompatibilityStatus status={COMPAT.UNIVERSAL} id={`compat-${item.id}`} />
      ) : (
        <>
          <div className="checkout-item-vehicles" role="radiogroup" aria-label={`Vehículo de ${item.titulo}`}>
            {vehicles.map((vehicle) => {
              const selected = vehicle.key === delivery.vehicleKey;
              return (
                <button
                  key={vehicle.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`checkout-item-vehicle ${selected ? 'is-selected' : ''}`}
                  onClick={() => onChange({ vehicleKey: vehicle.key })}
                >
                  {selected ? <CheckCircle2 size={14} /> : <Car size={14} />}
                  <span>{vehicleLabel(vehicle)}</span>
                </button>
              );
            })}
            <button type="button" className="checkout-item-vehicle is-add" onClick={onAddVehicle}>
              <Plus size={14} /> {vehicles.length === 0 ? 'Agregar vehículo' : 'Otro vehículo'}
            </button>
          </div>
          {selectedVehicle && (
            <CompatibilityStatus
              status={compatibility}
              vehicle={selectedVehicle}
              actions={compatActions}
              id={`compat-${item.id}`}
            />
          )}
          {selectedVehicle ? (
            <button type="button" className="checkout-item-link" onClick={() => onEditVehicle(selectedVehicle)}>Editar este vehículo</button>
          ) : (
            <p className="checkout-item-delivery-error">Elige para qué vehículo es: el vendedor confirma que calce antes de enviarlo.</p>
          )}
        </>
      )}
    </div>
  );

  return <div className="checkout-item-delivery">{vehicleStep}</div>;
}
