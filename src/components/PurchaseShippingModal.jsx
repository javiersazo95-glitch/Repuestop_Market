import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, ShoppingCart, Truck, X } from 'lucide-react';
import { parseShippingMethods, resolveShippingService, shippingMethodCost, shippingMethodPrice } from '../data/shippingMethods';

export default function PurchaseShippingModal({ product, intent, onClose, onConfirm }) {
  const availableMethods = useMemo(() => {
    const methods = parseShippingMethods(product?.metodosEnvio);
    return methods.length > 0 ? methods : ['Despacho a coordinar con la tienda'];
  }, [product?.metodosEnvio]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedMethod(availableMethods.length === 1 ? availableMethods[0] : '');
    setError('');
  }, [availableMethods, product?.id, intent]);

  if (!product || !intent) return null;

  const submit = async () => {
    if (!selectedMethod) {
      setError('Selecciona cómo quieres recibir este producto.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm({
        shippingMethod: selectedMethod,
        shippingFee: shippingMethodCost(selectedMethod),
      });
    } catch (submitError) {
      setError(submitError.message || 'No pudimos agregar el producto. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="purchase-shipping-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="purchase-shipping-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-shipping-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <span><Truck /></span>
          <div>
            <h2 id="purchase-shipping-title">¿Cómo quieres recibir tu compra?</h2>
            <p>Selecciona el método de entrega antes de continuar.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar selección de envío"><X /></button>
        </header>

        <div className="purchase-shipping-product">
          <strong>{product.titulo}</strong>
          <span>${Number(product.precio || 0).toLocaleString('es-CL')}</span>
        </div>

        <div className="purchase-shipping-options" role="radiogroup" aria-label="Métodos de entrega disponibles">
          {availableMethods.map((method) => {
            const config = resolveShippingService(method);
            const MethodIcon = config.icon;
            const price = shippingMethodPrice(method);
            const checked = selectedMethod === method;
            return (
              <label key={method} className={checked ? 'selected' : ''}>
                <input type="radio" name="shipping-method" value={method} checked={checked} onChange={() => setSelectedMethod(method)} />
                <span className="purchase-shipping-icon" style={{ '--shipping-color': config.color, '--shipping-bg': config.bg }}><MethodIcon /></span>
                <span className="purchase-shipping-copy"><strong>{config.label}</strong><small>{price ? `Costo: ${price}` : config.name === 'Retiro en tienda' ? 'Sin costo de despacho' : 'Costo por coordinar con la tienda'}</small></span>
                <span className="purchase-shipping-check"><Check /></span>
              </label>
            );
          })}
        </div>

        {error && <div className="purchase-shipping-error"><AlertTriangle /> {error}</div>}

        <footer>
          <button type="button" className="purchase-shipping-cancel" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="purchase-shipping-confirm"
            onClick={submit}
            disabled={submitting || !selectedMethod}
          >
            {intent === 'buy' ? <ShoppingCart /> : <Check />}
            {submitting ? 'Agregando…' : intent === 'buy' ? 'Continuar al carrito' : 'Añadir al carro'}
            {!submitting && <ArrowRight />}
          </button>
        </footer>
      </section>
    </div>
  );
}
