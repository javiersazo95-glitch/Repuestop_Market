import React from 'react';
import { Bike, Circle, CircleDot, MapPin, Navigation, Package, Store, Truck } from 'lucide-react';
import {
  addressesForMethod, deliveryKind, isDispatch, localDeliveryCost, offeredMethodsForItem, outsideComunaDelivery,
} from '../utils/cartDelivery';

const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const KIND_ICON = { pickup: Store, local: Bike, courier: Truck, other: Package };

/** "Envío dentro de la comuna ($3.000)" -> "Envío dentro de la comuna". */
const methodTitle = (method) => method.replace(/\s*\(.*\)\s*$/, '').trim() || method;

function methodPrice(method) {
  const kind = deliveryKind(method);
  if (kind === 'pickup') return 'Gratis';
  if (kind === 'courier') return 'Por pagar';
  const cost = localDeliveryCost(method);
  return cost > 0 ? formatCLP(cost) : 'Gratis';
}

/**
 * El envío de UNA tienda del checkout (8-oct, igual que la app CartStoreShipment): un método y una
 * dirección para todos sus productos, elegidos una sola vez bajo el nombre de la tienda. El
 * desplegable solo ofrece direcciones que ese envío alcanza: las de la comuna de la tienda para
 * "dentro de la comuna" y las de otras comunas para "fuera de la comuna". El vehículo se sigue
 * eligiendo en cada producto.
 */
export default function CheckoutStoreShipment({
  item, productCount, delivery, addresses, onChange, onManageAddresses,
  onUseStoreAddress, usingStoreAddress = false, storeAddressError = '',
}) {
  // El retiro y el despacho que se eligió en la ficha: no los tres.
  const methods = offeredMethodsForItem(item, addresses);
  const kind = deliveryKind(delivery.method);
  const dispatch = isDispatch(delivery.method);
  const storeComuna = item.storeComuna || 'la comuna de la tienda';
  const options = addressesForMethod(item, delivery.method, addresses);
  const address = options.find((entry) => String(entry.id) === String(delivery.addressId)) || null;
  const outside = outsideComunaDelivery(item, delivery.method, address);
  const zone = kind === 'local' ? `en ${storeComuna}` : `fuera de ${storeComuna}`;
  const radioName = `envio-tienda-${item.proveedorId || item.id}`;

  return (
    <div className="checkout-store-shipment">
      <div className="checkout-store-shipment-head">
        <Package size={15} />
        <strong>Envío de la tienda</strong>
        <small>{productCount === 1 ? '1 producto' : `Para sus ${productCount} productos`}</small>
      </div>

      <div className="checkout-item-methods" role="radiogroup" aria-label={`Envío de ${item.storeName || 'la tienda'}`}>
        {methods.map((method) => {
          const selected = delivery.method === method;
          const Icon = KIND_ICON[deliveryKind(method)];
          return (
            <label key={method} className={`checkout-item-method ${selected ? 'is-selected' : ''}`}>
              <input type="radio" name={radioName} checked={selected} onChange={() => onChange({ method })} />
              {selected ? <CircleDot size={16} /> : <Circle size={16} />}
              <Icon size={15} />
              <span className="checkout-item-method-title">{methodTitle(method)}</span>
              <em>{methodPrice(method)}</em>
            </label>
          );
        })}
      </div>

      {dispatch ? (
        <div className="checkout-item-delivery-step">
          <span className="checkout-item-delivery-label">
            <MapPin size={14} /> Enviar a
            <button type="button" className="checkout-item-link" onClick={onManageAddresses}>Agregar dirección</button>
          </span>
          {options.length > 0 ? (
            <select
              className="checkout-item-select"
              value={delivery.addressId || ''}
              onChange={(event) => onChange({ addressId: event.target.value || null })}
              aria-label={`Tus direcciones ${zone}`}
            >
              <option value="" disabled>Tus direcciones {zone}</option>
              {options.map((entry) => (
                <option key={entry.id} value={String(entry.id)}>
                  {entry.calleYNumero}, {entry.comunaNombre}{entry.esPrincipal ? ' (principal)' : ''}
                </option>
              ))}
            </select>
          ) : (addresses || []).length === 0 && onUseStoreAddress ? (
            // La tienda que compra sin direcciones usa la de su tienda con un clic.
            <div className="checkout-store-address">
              <small>Aún no tienes direcciones de entrega. Puedes recibirlo en tu tienda o agregar otra dirección.</small>
              <button type="button" className="checkout-store-address-btn" onClick={onUseStoreAddress} disabled={usingStoreAddress}>
                <Store size={14} /> {usingStoreAddress ? 'Guardando la dirección de tu tienda…' : 'Usar la dirección de mi tienda'}
              </button>
              {storeAddressError && <p className="checkout-item-delivery-error">{storeAddressError}</p>}
            </div>
          ) : (
            <p className="checkout-item-delivery-error">No tienes direcciones {zone}. Agrega una o elige otro envío.</p>
          )}
          {/* A otra comuna: sale por courier y el envío se paga al recibir. */}
          {outside && (
            <div className="checkout-item-outside" role="status">
              <Navigation size={15} />
              <span>
                <strong>Va a otra comuna: {outside.destinationComuna}</strong>
                <small>
                  {item.storeName || item.vendedor || 'La tienda'}{outside.storeComuna ? ` está en ${outside.storeComuna}` : ' está en otra comuna'}: el
                  envío sale por courier y lo pagas al recibirlo.
                </small>
              </span>
            </div>
          )}
        </div>
      ) : kind === 'pickup' ? (
        <p className="checkout-item-pickup">
          <Store size={14} />
          <span>
            <strong>Retiras en {item.storeAddress ? `${item.storeAddress}${item.storeComuna ? `, ${item.storeComuna}` : ''}` : 'la tienda'}</strong>
            {item.storeHours && <small>{item.storeHours}</small>}
          </span>
        </p>
      ) : null}
    </div>
  );
}
