import React from 'react';
import { Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { storePath } from '../routes/paths';
import CartLineItem from './CartLineItem';
import '../styles/auction-purchase.css';

const formatCLP = (value) => `$${Number(value || 0).toLocaleString('es-CL')}`;

/**
 * Las líneas del carrito agrupadas por tienda. Es el patrón de los marketplaces locales
 * y es lo que hace entendible un carrito multi-tienda: cada vendedor despacha por su
 * cuenta y el backend cobra un costo de envío por proveedor.
 *
 * El método de entrega ya no se elige acá: se pregunta por tienda en el checkout, donde
 * ya se sabe si hace falta pedir dirección.
 */
export default function CartStoreGroup({ group, activeVehicle, compatStatusOf = null, onUpdateQuantity, onRemove }) {
  const { proveedorId, vendedor, items } = group;

  const storeName = vendedor || 'Tienda RepuesTop';
  const comuna = items[0]?.storeComuna;
  const subtotal = items.reduce((sum, item) => sum + item.precio * item.quantity, 0);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <article className="ap-store cart-store-card" aria-label={`Productos de ${storeName}`}>
      <header className="ap-store-head">
        <span className="ap-store-icon" aria-hidden="true"><Store size={18} /></span>
        <div>
          {proveedorId ? (
            <Link to={storePath({ id: proveedorId, nombre: vendedor })}><strong>{storeName}</strong></Link>
          ) : (
            <strong>{storeName}</strong>
          )}
          <small>{units} {units === 1 ? 'producto' : 'productos'}</small>
          {comuna && <small>Tienda en {comuna}</small>}
        </div>
        <strong className="ap-store-total">{formatCLP(subtotal)}</strong>
      </header>

      <div className="cart-store-lines">
        {items.map((item) => (
          <CartLineItem
            key={item.id}
            item={item}
            activeVehicle={activeVehicle}
            compatibility={compatStatusOf ? compatStatusOf(item) : null}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
          />
        ))}
      </div>
    </article>
  );
}
