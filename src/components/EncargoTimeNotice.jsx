import React from 'react';
import { AlertTriangle, CalendarClock, PackageSearch, RotateCcw } from 'lucide-react';
import { encargoFecha } from '../utils/inquiry';

const DIA_MS = 86400000;
const MARGEN_POR_DEFECTO = 3;

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * Tiempo de encargo destacado (28-nov), con lo que significa y lo que pasa si la tienda no lo cumple.
 *
 * - `stage="quote"`: antes de pagar (chat, detalle de la cotización, pago). La fecha se estima desde hoy.
 * - `stage="order"`: venta ya pagada. Usa la fecha estimada y "cancelable desde" del backend, y avisa si se atrasó.
 *
 * @param {{ dias: number, margen?: number, fechaEstimada?: string, cancelableDesde?: string,
 *           mode?: 'buyer'|'seller', stage?: 'quote'|'order', estado?: string, compact?: boolean }} props
 */
export default function EncargoTimeNotice({
  dias, margen, fechaEstimada, cancelableDesde, mode = 'buyer', stage = 'quote', estado = '', compact = false,
}) {
  const diasNum = Number(dias);
  if (!Number.isFinite(diasNum) || diasNum <= 0) return null;
  const margenNum = Number.isFinite(Number(margen)) && Number(margen) >= 0 ? Number(margen) : MARGEN_POR_DEFECTO;
  const isSeller = mode === 'seller';
  const now = Date.now();

  const estimada = fechaEstimada ? new Date(fechaEstimada).getTime() : now + diasNum * DIA_MS;
  const cancelable = cancelableDesde ? new Date(cancelableDesde).getTime() : estimada + margenNum * DIA_MS;
  const fechaTexto = encargoFecha(estimada);
  const cancelableTexto = encargoFecha(cancelable);
  const estadoNorm = String(estado || '').toUpperCase();
  const pendienteDeLlegar = stage === 'order' && ['PAGADO', 'EN_PREPARACION'].includes(estadoNorm);
  const atrasado = pendienteDeLlegar && now >= estimada && now < cancelable;
  const vencido = pendienteDeLlegar && now >= cancelable;

  const significado = isSeller
    ? `Es el plazo que te comprometes a cumplir para tener la pieza en tu tienda, contado desde que el comprador paga la reserva.`
    : `Es el plazo que la tienda se compromete a cumplir para tener tu pieza, contado desde que pagas la reserva. Con el pago la pieza queda reservada y la tienda la manda a pedir a su proveedor.`;
  const siNoCumple = isSeller
    ? `Si la pieza no llega en ese plazo, el comprador espera ${plural(margenNum, 'día', 'días')} más y después puede cancelar la reserva con reembolso total.`
    : `Si la pieza no llega en ese plazo, hay ${plural(margenNum, 'día', 'días')} de margen. Después${stage === 'order' && cancelableTexto ? `, desde el ${cancelableTexto},` : ''} puedes cancelar la reserva y te devolvemos todo lo que pagaste.`;

  return (
    <div className={`encargo-time${compact ? ' is-compact' : ''}${atrasado ? ' is-late' : ''}${vencido ? ' is-overdue' : ''}`} data-testid="encargo-time">
      <div className="encargo-time-head">
        <span className="encargo-time-icon" aria-hidden="true"><PackageSearch size={20} /></span>
        <div className="encargo-time-main">
          <small>Tiempo de encargo</small>
          <strong>{plural(diasNum, 'día', 'días')}</strong>
        </div>
        {fechaTexto && (
          <div className="encargo-time-date">
            <small><CalendarClock size={12} /> Llega aprox.</small>
            <strong>{fechaTexto}</strong>
          </div>
        )}
      </div>
      {atrasado && (
        <p className="encargo-time-alert">
          <AlertTriangle size={15} />
          <span>{isSeller
            ? `La pieza ya debió llegar. Si no la despachas o dejas lista antes del ${cancelableTexto}, el comprador podrá cancelar con reembolso.`
            : `La pieza se atrasó. Si no llega antes del ${cancelableTexto}, podrás cancelar la reserva con reembolso total.`}</span>
        </p>
      )}
      {vencido && (
        <p className="encargo-time-alert">
          <RotateCcw size={15} />
          <span>{isSeller
            ? 'El plazo y el margen ya vencieron: el comprador puede cancelar la reserva y se le devuelve todo.'
            : 'El plazo y el margen ya vencieron: puedes cancelar la reserva y te devolvemos todo lo que pagaste.'}</span>
        </p>
      )}
      {!compact && (
        <dl className="encargo-time-explain">
          <div><dt>¿Qué significa?</dt><dd>{significado}</dd></div>
          <div><dt>¿Y si no se cumple?</dt><dd>{siNoCumple}</dd></div>
        </dl>
      )}
    </div>
  );
}
