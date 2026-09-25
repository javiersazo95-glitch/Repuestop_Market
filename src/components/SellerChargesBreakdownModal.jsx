import React from 'react';
import { createPortal } from 'react-dom';
import { Info, Receipt, Percent, Landmark, CreditCard, RotateCcw, Wallet } from 'lucide-react';

function formatCLP(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString('es-CL')}`;
}

const IVA = 0.19;

/**
 * Popup del ícono "i" junto a "Neto a recibir": desglosa, como un estado de cuenta, la venta,
 * cada cobro que se descuenta y el neto. La comisión llega con IVA incluido (`commissionSeller`),
 * así que acá se separa en neto + IVA para que el vendedor vea las dos líneas por separado.
 *
 * `netAmount` es el neto que manda el backend (`totalVendedor`): se muestra tal cual en vez de
 * recalcularlo, porque es el monto que efectivamente se liquida.
 */
export default function SellerChargesBreakdownModal({
  orderCode,
  subtotal = 0,
  shippingFee = 0,
  discount = 0,
  commissionBase = 0,
  commissionRate = 8,
  commissionWithIva = 0,
  paymentProcessingFee = 0,
  refundAmount = 0,
  refundCharge = 0,
  fullyRefunded = false,
  netAmount = 0,
  onClose,
}) {
  const saleTotal = Math.max(0, subtotal + shippingFee - discount);
  const commissionNet = Math.round(commissionWithIva / (1 + IVA));
  const commissionIva = commissionWithIva - commissionNet;
  const rateLabel = Number.isInteger(commissionRate) ? commissionRate : Number(commissionRate).toFixed(1);

  const charges = [
    {
      key: 'comision',
      icon: Percent,
      label: 'Comisión RepuesTop',
      detail: `${rateLabel}% sobre ${formatCLP(commissionBase)}`,
      amount: commissionNet,
    },
    {
      key: 'iva',
      icon: Landmark,
      label: 'IVA de la comisión',
      detail: '19% sobre la comisión',
      amount: commissionIva,
    },
    {
      key: 'pasarela',
      icon: CreditCard,
      label: 'Procesador de pago',
      detail: 'Costo de la pasarela que cobró al comprador',
      amount: paymentProcessingFee,
    },
    {
      key: 'reembolso',
      icon: RotateCcw,
      label: 'Reembolso al comprador',
      detail: 'Por productos cancelados o mediación',
      amount: refundAmount,
    },
    // O65 (pruebas de lanzamiento, 25-sep): Flow cobra un cargo fijo por cada reembolso de un
    // veredicto y no lo devuelve; lo asume la tienda (O28). Viene del backend.
    {
      key: 'cargo-reembolso',
      icon: CreditCard,
      label: 'Cargo de Flow por el reembolso',
      detail: 'Costo fijo de la pasarela por devolver el pago',
      amount: refundCharge,
    },
  ].filter((charge) => charge.amount > 0);

  const totalCharges = charges.reduce((sum, charge) => sum + charge.amount, 0);
  // O65: en una venta devuelta entera lo que importa es lo que la tienda asume de verdad (sin
  // comision de RepuesTop; solo el costo de la pasarela, si lo hubo), no el reembolso en si.
  const assumedCost = commissionWithIva + paymentProcessingFee + refundCharge;

  return createPortal(
    <div className="commission-modal-backdrop order-subdialog-backdrop" onClick={onClose}>
      <div
        className="commission-modal-card charges-breakdown-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="charges-breakdown-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="commission-modal-header">
          <div className="commission-icon-badge">
            <Info size={22} />
          </div>
          <div className="order-subdialog-heading">
            <h3 id="charges-breakdown-title">Desglose de cobros</h3>
            <span>{orderCode ? `Pedido ${orderCode} · ` : ''}lo que se descuenta de esta venta</span>
          </div>
        </div>

        <section className="charges-breakdown-section">
          <h4><Receipt size={14} />Venta</h4>
          <dl className="charges-breakdown-rows">
            <div><dt>Productos</dt><dd>{formatCLP(subtotal)}</dd></div>
            {shippingFee > 0 && <div><dt>Envío</dt><dd>{formatCLP(shippingFee)}</dd></div>}
            {discount > 0 && <div><dt>Descuento</dt><dd className="is-negative">-{formatCLP(discount)}</dd></div>}
            <div className="charges-breakdown-subtotal"><dt>Total de la venta</dt><dd>{formatCLP(saleTotal)}</dd></div>
          </dl>
        </section>

        <section className="charges-breakdown-section">
          <h4><Wallet size={14} />Cobros descontados</h4>
          {charges.length === 0 ? (
            <p className="charges-breakdown-empty">Este pedido no tiene cobros.</p>
          ) : (
            <ol className="charges-breakdown-list">
              {charges.map(({ key, icon: Icono, label, detail, amount }, index) => (
                <li key={key}>
                  <span className="charges-breakdown-index">{index + 1}</span>
                  <span className="charges-breakdown-icon"><Icono size={15} /></span>
                  <span className="charges-breakdown-label">
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                  <span className="charges-breakdown-amount">-{formatCLP(amount)}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="charges-breakdown-total">
            <span>Total descontado</span>
            <strong>-{formatCLP(totalCharges)}</strong>
          </div>
        </section>

        <div className="charges-breakdown-net">
          <span>
            <strong>Neto a recibir</strong>
            <small>Total de la venta menos los cobros</small>
          </span>
          <strong>{formatCLP(netAmount)}</strong>
        </div>

        {fullyRefunded && (
          <p className="commission-footer-note">
            {assumedCost > 0
              ? `Venta reembolsada: RepuesTop no cobra comisión y tu tienda asume solo el costo de la pasarela (${formatCLP(assumedCost)}).`
              : 'Venta reembolsada: no hay descuentos para tu tienda.'}
          </p>
        )}

        <p className="commission-footer-note">
          El porcentaje estándar de RepuesTop es 8% + IVA sobre cada venta, sin tramos ni tope
          (5% + IVA para Tiendas Fundadoras durante sus primeros 3 meses).
        </p>

        <button type="button" className="btn-auth-primary" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>,
    document.body,
  );
}
