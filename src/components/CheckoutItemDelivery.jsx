import React from 'react';
import { Bike, Car, CheckCircle2, Circle, CircleDot, MapPin, Package, Plus, Store, Truck } from 'lucide-react';
import { deliveryKind, isDispatch, localDeliveryCost, methodsForItem, vehicleLabel } from '../utils/cartDelivery';

const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const KIND_ICON = { pickup: Store, local: Bike, courier: Truck, other: Package };

/** "Envío dentro de la comuna ($3.000)" -> "Envío dentro de la comuna". */
const methodTitle = (method) => method.replace(/\s*\(.*\)\s*$/, '').trim() || method;

function methodPrice(method, sharedWithPrevious) {
  const kind = deliveryKind(method);
  if (kind === 'pickup') return 'Gratis';
  if (kind === 'courier') return 'Por pagar';
  const cost = localDeliveryCost(method);
  if (cost <= 0) return 'Gratis';
  return sharedWithPrevious ? 'Incluido' : formatCLP(cost);
}

/**
 * Entrega de UN producto del checkout, igual que la app (CartItemDelivery): cómo lo recibe, a
 * dónde va (o dónde se retira) y para qué vehículo es. Cada producto puede ir a otra dirección
 * y ser para otro auto (el propio y el de un familiar).
 */
export default function CheckoutItemDelivery({
  item, delivery, addresses, vehicles, sharesShipment,
  onChange, onAddVehicle, onEditVehicle, onManageAddresses,
}) {
  const address = addresses.find((entry) => String(entry.id) === String(delivery.addressId)) || null;
  const allowed = methodsForItem(item, address);
  // El método con que se agregó al carro nunca desaparece de la lista: el carro lo confirma. Si la
  // dirección elegida no le sirve, se avisa para cambiar la dirección (o el método, si quiere).
  const methodMismatch = Boolean(delivery.method) && !allowed.includes(delivery.method);
  const methods = methodMismatch ? [delivery.method, ...allowed] : allowed;
  const dispatch = isDispatch(delivery.method);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.key === delivery.vehicleKey) || null;
  const radioName = `entrega-${item.id}`;

  return (
    <div className="checkout-item-delivery">
      <div className="checkout-item-delivery-step">
        <span className="checkout-item-delivery-label"><Truck size={14} /> Entrega</span>
        {methods.length === 0 ? (
          <p className="checkout-item-delivery-error">Esta tienda no despacha a la comuna elegida. Cambia la dirección o elige retiro.</p>
        ) : (
          <div className="checkout-item-methods" role="radiogroup" aria-label={`Entrega de ${item.titulo}`}>
            {methods.map((method) => {
              const selected = delivery.method === method;
              const Icon = KIND_ICON[deliveryKind(method)];
              return (
                <label key={method} className={`checkout-item-method ${selected ? 'is-selected' : ''}`}>
                  <input type="radio" name={radioName} checked={selected} onChange={() => onChange({ method })} />
                  {selected ? <CircleDot size={16} /> : <Circle size={16} />}
                  <Icon size={15} />
                  <span className="checkout-item-method-title">{methodTitle(method)}</span>
                  <em>{methodPrice(method, selected && sharesShipment)}</em>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {dispatch ? (
        <div className="checkout-item-delivery-step">
          <span className="checkout-item-delivery-label">
            <MapPin size={14} /> Enviar a
            <button type="button" className="checkout-item-link" onClick={onManageAddresses}>
              {addresses.length === 0 ? 'Agregar dirección' : 'Otra dirección'}
            </button>
          </span>
          {addresses.length > 0 ? (
            <select
              className="checkout-item-select"
              value={delivery.addressId || ''}
              onChange={(event) => onChange({ addressId: event.target.value || null })}
              aria-label={`Dirección de envío de ${item.titulo}`}
            >
              <option value="" disabled>Elige la dirección</option>
              {addresses.map((entry) => (
                <option key={entry.id} value={String(entry.id)}>
                  {entry.calleYNumero}, {entry.comunaNombre}{entry.esPrincipal ? ' (principal)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="checkout-item-delivery-error">Agrega una dirección para recibir este producto.</p>
          )}
          {methodMismatch && address && (
            <p className="checkout-item-delivery-error">
              {deliveryKind(delivery.method) === 'local'
                ? `${methodTitle(delivery.method)} solo llega a ${item.storeComuna || 'la comuna de la tienda'}: elige una dirección de esa comuna.`
                : `${methodTitle(delivery.method)} no aplica en ${address.comunaNombre || 'esa comuna'}: elige una dirección de otra comuna.`}
            </p>
          )}
          {sharesShipment && <small className="checkout-item-delivery-note">Va en el mismo despacho que otro producto de esta tienda.</small>}
        </div>
      ) : delivery.method && deliveryKind(delivery.method) === 'pickup' ? (
        <p className="checkout-item-pickup">
          <Store size={14} />
          <span>
            <strong>Retiras en {item.storeAddress ? `${item.storeAddress}${item.storeComuna ? `, ${item.storeComuna}` : ''}` : 'la tienda'}</strong>
            {item.storeHours && <small>{item.storeHours}</small>}
          </span>
        </p>
      ) : null}

      <div className="checkout-item-delivery-step">
        <span className="checkout-item-delivery-label">
          <Car size={14} /> Vehículo
          {!item.esUniversal && <em className="checkout-item-required">Obligatorio</em>}
        </span>
        {item.esUniversal ? (
          <small className="checkout-item-delivery-note">Repuesto universal: sirve para cualquier vehículo.</small>
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
            {selectedVehicle ? (
              <button type="button" className="checkout-item-link" onClick={() => onEditVehicle(selectedVehicle)}>Editar este vehículo</button>
            ) : (
              <p className="checkout-item-delivery-error">Elige para qué vehículo es: el vendedor confirma que calce antes de enviarlo.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
