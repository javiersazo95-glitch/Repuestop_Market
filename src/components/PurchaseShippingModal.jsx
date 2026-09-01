import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, ShoppingCart, Truck, X } from 'lucide-react';
import { parseShippingMethods, resolveShippingService, shippingMethodCost, shippingMethodPrice } from '../data/shippingMethods';
import { useAuth } from '../context/AuthContext';

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
export default function PurchaseShippingModal({ product, intent, initialMethod = '', onClose, onConfirm }) {
  // El usuario se lee aca y no se recibe por props: el modal lo montan la ficha del producto
  // y el carrito, y la regla de la comuna tiene que ser la misma en los dos.
  const { user } = useAuth();
  const availableMethods = useMemo(() => {
    const methods = parseShippingMethods(product?.metodosEnvio);
    const disponibles = methods.length > 0 ? methods : ['Despacho a coordinar con la tienda'];
    // El "Envío dentro de la comuna" es una tarifa intracomunal: la tienda la reparte ella
    // misma dentro de SU comuna. Ofrecerla a un comprador de otra comuna le cobra $4.000 por
    // un despacho que no existe -- y el vendedor queda obligado a un envío que no presta.
    // A ese comprador le quedan el retiro en tienda y el envío fuera de la comuna.
    //
    // Solo se descarta cuando SE SABE que la comuna es distinta. Sin comuna del comprador
    // -invitado, o cuenta sin dirección cargada- se deja visible: esconderla ahí le quita
    // una opción legitima a quien sí vive en la comuna y todavía no completó su perfil.
    const comunaComprador = normalizarComuna(user?.comuna);
    const comunaVendedor = normalizarComuna(product?.ciudadVendedor);
    if (!comunaComprador || !comunaVendedor || comunaComprador === comunaVendedor) {
      return disponibles;
    }
    const soloFuera = disponibles.filter(
      (method) => resolveShippingService(method).name !== 'Envío dentro de la comuna',
    );
    // Si la tienda no ofreciera nada mas, se deja la lista original: dejar al comprador sin
    // ninguna forma de recibir el producto es peor que ofrecerle una que habra que coordinar.
    return soloFuera.length > 0 ? soloFuera : disponibles;
  }, [product?.metodosEnvio, product?.ciudadVendedor, user?.comuna]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialMethod && availableMethods.includes(initialMethod)) setSelectedMethod(initialMethod);
    else setSelectedMethod(availableMethods.length === 1 ? availableMethods[0] : '');
    setError('');
  }, [availableMethods, product?.id, intent, initialMethod]);

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
