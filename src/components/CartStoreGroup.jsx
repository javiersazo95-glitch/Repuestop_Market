import React from 'react';
import { Store } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { storePath } from '../routes/paths';
import CartLineItem from './CartLineItem';
import { MinimoDespachoProgress } from './MinimoDespacho';
import { isPickupMethod } from '../utils/minimoDespacho';
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
  const navigate = useNavigate();
  // Mínimo de despacho (22-nov): no aplica si ya se eligió retiro en tienda para todo lo de esta tienda.
  const minimo = items.find((item) => item.minimoDespacho)?.minimoDespacho ?? null;
  const todoRetiro = items.length > 0 && items.every((item) => item.shippingMethod && isPickupMethod(item.shippingMethod));

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

      {minimo && !todoRetiro && (
        <div className="cart-store-minimo">
          <MinimoDespachoProgress
            storeName={storeName}
            minimo={minimo}
            subtotal={subtotal}
            onVisitStore={proveedorId ? () => navigate(storePath({ id: proveedorId, nombre: vendedor })) : undefined}
          />
        </div>
      )}

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
