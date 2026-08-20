import React from 'react';
import { Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolveShippingService, shippingMethodPrice } from '../data/shippingMethods';
import { storePath } from '../routes/paths';
import CartLineItem from './CartLineItem';

/**
 * Las líneas del carrito agrupadas por tienda. Es el patrón de los marketplaces locales
 * y es lo que hace entendible un carrito multi-tienda: cada vendedor despacha por su
 * cuenta y el backend cobra un costo de envío por proveedor.
 */
export default function CartStoreGroup({ group, activeVehicle, onUpdateQuantity, onRemove, onChangeShipping }) {
  const { proveedorId, vendedor, items, shippingMethod } = group;
  const service = shippingMethod ? resolveShippingService(shippingMethod) : null;
  const ShippingIcon = service?.icon;
  const price = shippingMethod ? shippingMethodPrice(shippingMethod) : null;

  return (
    <section className="cart-store-group" aria-label={`Productos de ${vendedor || 'la tienda'}`}>
      <header className="cart-store-head">
        <div className="cart-store-id">
          <span className="cart-store-avatar"><Store size={15} /></span>
          {proveedorId ? (
            <Link to={storePath({ id: proveedorId, nombre: vendedor })}>{vendedor || 'Tienda RepuesTop'}</Link>
          ) : (
            <strong>{vendedor || 'Tienda RepuesTop'}</strong>
          )}
        </div>

        <div className={`cart-store-shipping ${shippingMethod ? '' : 'is-missing'}`}>
          {shippingMethod ? (
            <span className="cart-store-shipping-value" style={{ '--shipping-color': service.color }}>
              <ShippingIcon size={15} />
              {service.label}
              {price && <em>{price}</em>}
            </span>
          ) : (
            <span className="cart-store-shipping-value">Elige cómo recibirlo</span>
          )}
          <button type="button" onClick={() => onChangeShipping(group)}>
            {shippingMethod ? 'Cambiar' : 'Elegir entrega'}
          </button>
        </div>
      </header>

      <div className="cart-store-lines">
        {items.map((item) => (
          <CartLineItem
            key={item.id}
            item={item}
            activeVehicle={activeVehicle}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}
