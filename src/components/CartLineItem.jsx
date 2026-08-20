import React from 'react';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import { CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

/** Una línea del carrito. La cantidad usa el debounce que ya trae `updateCartQuantity`. */
export default function CartLineItem({ item, activeVehicle, onUpdateQuantity, onRemove }) {
  const stock = Number(item.stock || 0);
  const atStockLimit = stock > 0 && item.quantity >= stock;
  const lowStock = stock > 0 && stock <= 3;

  return (
    <article className="cart-line">
      <div className="cart-line-media">
        {item.imagen ? (
          <img src={item.imagen} alt="" loading="lazy" />
        ) : (
          <CategoryIconTile
            iconName={CATEGORY_ICON_BY_ID[item.categoria]}
            color={CATEGORY_COLOR_BY_ID[item.categoria]}
            size={24}
          />
        )}
      </div>

      <div className="cart-line-info">
        <h3>{item.titulo}</h3>
        <p className="cart-line-meta">
          <span className="cart-line-oem">OEM {item.oemCode}</span>
          {item.marca && <span>{item.marca}</span>}
        </p>
        {activeVehicle && (
          <p className="cart-line-fit">Compatible con {activeVehicle.patente}</p>
        )}
        {lowStock && (
          <p className="cart-line-stock">
            <AlertTriangle size={13} />
            {stock === 1 ? 'Última unidad disponible' : `Solo quedan ${stock} unidades`}
          </p>
        )}
      </div>

      <div className="cart-line-qty">
        <button
          type="button"
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          aria-label={`Restar una unidad de ${item.titulo}`}
        >
          <Minus size={14} />
        </button>
        <span aria-live="polite">{item.quantity}</span>
        <button
          type="button"
          disabled={atStockLimit}
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          aria-label={`Sumar una unidad de ${item.titulo}`}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="cart-line-amount">
        <strong>{formatCLP(item.precio * item.quantity)}</strong>
        {item.quantity > 1 && <small>{formatCLP(item.precio)} c/u</small>}
        <button type="button" className="cart-line-remove" onClick={() => onRemove(item.id)}>
          Eliminar
        </button>
      </div>
    </article>
  );
}
