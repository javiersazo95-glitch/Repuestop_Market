import React from 'react';
import { Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { storePath } from '../routes/paths';
import CartLineItem from './CartLineItem';

/**
 * Las líneas del carrito agrupadas por tienda. Es el patrón de los marketplaces locales
 * y es lo que hace entendible un carrito multi-tienda: cada vendedor despacha por su
 * cuenta y el backend cobra un costo de envío por proveedor.
 *
 * El método de entrega ya no se elige acá: se pregunta por tienda en el checkout, donde
 * ya se sabe si hace falta pedir dirección.
 */
export default function CartStoreGroup({ group, activeVehicle, onUpdateQuantity, onRemove }) {
  const { proveedorId, vendedor, items } = group;

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
