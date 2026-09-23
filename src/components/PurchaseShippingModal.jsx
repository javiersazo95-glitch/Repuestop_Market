import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, ShoppingCart, Truck, X } from 'lucide-react';
import { parseShippingMethods, resolveShippingService, shippingMethodCost, shippingMethodPrice, shippingMethodsForLocation } from '../data/shippingMethods';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { profilePath } from '../routes/paths';

/** Sin tildes ni mayúsculas: el catálogo de geografía viene sin tildes y las direcciones con ellas. */
function normalizarComuna(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

/**
 * `intent`: 'buy' (comprar ahora) | 'add' (añadir al carro) | 'update' (cambiar la
 * entrega de una tienda ya en el carrito, desde /carrito). Solo cambia el copy del CTA.
 */
export default function PurchaseShippingModal({ product, intent, initialMethod = '', buyerCommune: buyerCommuneProp, onClose, onConfirm }) {
  // El usuario se lee aca y no se recibe por props: el modal lo montan la ficha del producto
  // y el carrito, y la regla de la comuna tiene que ser la misma en los dos.
  const { user } = useAuth();
  const navigate = useNavigate();
  // En el checkout manda la comuna de la DIRECCION ELEGIDA, no la del perfil: se despacha a esa
  // direccion, y la regla dentro/fuera de la comuna la vuelve a validar el backend (EnvioComunaRegla).
  const buyerCommune = normalizarComuna(buyerCommuneProp || user?.comuna);
  const sellerCommune = normalizarComuna(product?.ciudadVendedor || product?.comunaVendedor);
  const availableMethods = useMemo(() => {
    const methods = parseShippingMethods(product?.metodosEnvio);
    const disponibles = methods.length > 0 ? methods : ['Despacho a coordinar con la tienda'];
    return shippingMethodsForLocation(disponibles, buyerCommune, sellerCommune);
  }, [product?.metodosEnvio, buyerCommune, sellerCommune]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialMethod && availableMethods.includes(initialMethod)) setSelectedMethod(initialMethod);
    else setSelectedMethod(availableMethods.length === 1 ? availableMethods[0] : '');
    setError('');
  }, [availableMethods, product?.id, intent, initialMethod]);

  if (!product || !intent) return null;

  if (!buyerCommune) return (
    <div className="purchase-shipping-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="purchase-shipping-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header><span><Truck /></span><div><h2>Registra tu dirección para continuar</h2><p>Necesitamos tu comuna para mostrarte métodos de despacho válidos.</p></div></header>
        <div className="purchase-shipping-product"><strong>Sin comuna registrada</strong><span>La disponibilidad depende de tu ubicación.</span></div>
        <footer><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="purchase-shipping-confirm" onClick={() => navigate(profilePath('datos'))}>Registrar dirección</button></footer>
      </section>
    </div>
  );

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
            {submitting
              ? (intent === 'update' ? 'Guardando…' : 'Agregando…')
              : intent === 'buy' ? 'Continuar al carrito' : intent === 'update' ? 'Guardar entrega' : 'Añadir al carro'}
            {!submitting && <ArrowRight />}
          </button>
        </footer>
      </section>
    </div>
  );
}
