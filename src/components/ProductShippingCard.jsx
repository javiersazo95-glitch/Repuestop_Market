import React, { forwardRef } from 'react';
import { AlertTriangle, Circle, CircleDot, Info, Truck } from 'lucide-react';
import { resolveShippingService } from '../data/shippingMethods';
import { shippingMethodMeta, shippingMethodMessage } from '../utils/cartDelivery';

/**
 * "Opciones de entrega" de la ficha en escritorio, la misma card que la app: hay que elegir una
 * antes de comprar o añadir al carro, y el carro solo la confirma. `focused` la resalta cuando
 * se intentó comprar sin elegir.
 */
const ProductShippingCard = forwardRef(function ProductShippingCard({ methods, selected, onSelect, hours, focused }, ref) {
  return (
    <section ref={ref} className={`product-shipping-card${focused ? ' is-focused' : ''}`} aria-labelledby="product-shipping-card-title">
      <h2 id="product-shipping-card-title"><Truck size={19} /> Opciones de entrega</h2>
      <div className="product-shipping-card-options" role="radiogroup" aria-label="Cómo quieres recibir este repuesto">
        {methods.map((method) => {
          const isSelected = method === selected;
          const meta = shippingMethodMeta(method, hours);
          const { icon: MethodIcon } = resolveShippingService(method);
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`product-shipping-card-option${isSelected ? ' is-selected' : ''}`}
              onClick={() => onSelect(method)}
            >
              {isSelected ? <CircleDot size={20} className="product-shipping-card-radio" /> : <Circle size={20} className="product-shipping-card-radio" />}
              <span className="product-shipping-card-icon"><MethodIcon size={18} /></span>
              <span className="product-shipping-card-copy">
                <strong>{meta.title}</strong>
                <small>{meta.subtitle}</small>
              </span>
              <em className={meta.free ? 'is-free' : ''}>{meta.price}</em>
            </button>
          );
        })}
      </div>
      {selected ? (
        <p className="product-shipping-card-info"><Info size={16} /> {shippingMethodMessage(selected, hours)}</p>
      ) : (
        <p className={`product-shipping-card-info${focused ? ' is-warning' : ''}`}>
          {focused ? <AlertTriangle size={16} /> : <Info size={16} />}
          {focused
            ? 'Elige cómo quieres recibir este repuesto antes de comprar o añadirlo al carro.'
            : 'Selecciona una opción de entrega para continuar.'}
        </p>
      )}
    </section>
  );
});

export default ProductShippingCard;
