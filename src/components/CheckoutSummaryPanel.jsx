import React from 'react';
import { ArrowRight, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import MobileStickyBar from './MobileStickyBar';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

/**
 * Resumen de la compra. Vive aparte porque lo comparten /carrito y /checkout: si cada
 * vista armara el suyo, tarde o temprano mostrarían totales distintos.
 *
 * Los montos llegan calculados desde `cartTotals` (MarketplaceContext). El despacho se
 * cobra al comprador y forma parte de la base de las comisiones del vendedor.
 *
 * `beforeCta`: lo que tiene que verse antes del botón (p. ej. el aviso de compatibilidad y la
 * casilla "Entiendo y quiero comprarlo igual" que lo habilita).
 *
 * `stickyAviso` ({ texto, onIr }): en el celular la barra fija tapa el resumen y la casilla queda
 * fuera de la vista; con un aviso pendiente, la barra lo dice y su botón lleva a la casilla en vez
 * de quedar deshabilitado sin explicación.
 */
export default function CheckoutSummaryPanel({
  itemCount, subtotal, costoEnvio, total, shippingLabel,
  ctaLabel, onCta, ctaDisabled = false, ctaLoading = false, warning, beforeCta, stickyAviso, children,
}) {
  return (
    <aside className="checkout-summary" aria-label="Resumen de la compra">
      <h2 className="checkout-summary-title">Resumen de la compra</h2>

      <dl className="checkout-summary-rows">
        <div className="checkout-summary-row">
          <dt>Productos ({itemCount})</dt>
          <dd>{formatCLP(subtotal)}</dd>
        </div>
        <div className="checkout-summary-row">
          <dt>Despacho</dt>
          <dd className={costoEnvio > 0 ? '' : 'is-text'}>
            {costoEnvio > 0 ? formatCLP(costoEnvio) : shippingLabel}
          </dd>
        </div>
      </dl>

      <div className="checkout-summary-total">
        <span>Total</span>
        <strong>{formatCLP(total)}</strong>
      </div>

      {beforeCta}

      {warning && <p className="checkout-summary-warning">{warning}</p>}

      {/* Solo movil: el resumen se renderiza despues de todos los grupos de la compra. */}
      {onCta && (
        <MobileStickyBar label={`Total · ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`} value={formatCLP(total)} hint={stickyAviso?.texto} watchSelector=".checkout-summary-cta" ariaLabel="Continuar la compra">
          {stickyAviso ? (
            <button type="button" className="mobile-sticky-bar__btn" onClick={stickyAviso.onIr}>
              <span>Revisar aviso</span>
            </button>
          ) : (
            <button type="button" className="mobile-sticky-bar__btn" onClick={onCta} disabled={ctaDisabled || ctaLoading}>
              {ctaLoading ? <Loader2 size={18} className="spin-icon" /> : null}
              <span>{ctaLabel}</span>
            </button>
          )}
        </MobileStickyBar>
      )}

      {onCta && (
        <button
          type="button"
          className="checkout-summary-cta"
          onClick={onCta}
          disabled={ctaDisabled || ctaLoading}
        >
          <span>{ctaLabel}</span>
          {ctaLoading ? <Loader2 size={17} className="spin-icon" /> : <ArrowRight size={17} />}
        </button>
      )}

      {children}

      <p className="checkout-summary-trust"><ShieldCheck size={15} /> Compra protegida por RepuesTop</p>
      <div className="checkout-summary-payments">
        <span><CreditCard size={14} /> Pagos procesados por Flow</span>
      </div>
    </aside>
  );
}
