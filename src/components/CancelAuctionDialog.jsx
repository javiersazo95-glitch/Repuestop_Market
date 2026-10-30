import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Pencil, X, XCircle } from 'lucide-react';
import { cancelAuction } from '../services/auctionApi';
import { CANCEL_DETAIL_MAX, CANCEL_REASONS } from '../data/auctionCancelReasons';

/**
 * Cancelar una búsqueda de repuestos (solo sin ofertas aceptadas; el backend lo valida). Reutiliza el dialogo del
 * reporte (`.quote-ws-report-*`): es la misma forma, un motivo de una lista y un detalle.
 */
export default function CancelAuctionDialog({ auction, pendingOffers = 0, onClose, onCancelled, onEdit }) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsDetail = reason === 'OTRO';
  const canSubmit = Boolean(reason) && (!needsDetail || detail.trim().length > 0) && detail.length <= CANCEL_DETAIL_MAX;

  const close = () => { if (!busy) onClose?.(); };

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    try {
      const updated = await cancelAuction(auction.id, { motivo: reason, detalle: needsDetail ? detail.trim() : '' });
      onCancelled?.(updated);
    } catch (err) {
      setError(err?.message || 'No pudimos cancelar la búsqueda. Inténtalo nuevamente.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="quote-ws-dialog-backdrop" onClick={close}>
      <form className="quote-ws-report-dialog" onSubmit={submit} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cancelar búsqueda">
        <header>
          <div>
            <XCircle size={22} />
            <span>
              <strong>Cancelar búsqueda</strong>
              <small>{auction?.repuestoSolicitado || 'Búsqueda de repuestos'}</small>
            </span>
          </div>
          <button type="button" aria-label="Cerrar" disabled={busy} onClick={close}><X size={19} /></button>
        </header>

        <div className="quote-ws-report-body">
          <p className="cancel-auction-note">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              La búsqueda deja de recibir ofertas y sale del mural.
              {pendingOffers === 1 && <> La <b>oferta</b> que espera respuesta se descarta y avisamos a la tienda con el motivo que elijas.</>}
              {pendingOffers > 1 && <> Las <b>{pendingOffers} ofertas</b> que esperan respuesta se descartan y avisamos a cada tienda con el motivo que elijas.</>}
            </span>
          </p>

          <fieldset>
            <legend>¿Por qué la cancelas?</legend>
            {CANCEL_REASONS.map(([value, label]) => (
              <label key={value} className={reason === value ? 'selected' : ''}>
                <input type="radio" name="cancelAuctionReason" value={value} checked={reason === value} onChange={() => setReason(value)} />
                <span>{label}</span>
                <i />
              </label>
            ))}
          </fieldset>

          {/* Un error en los datos se corrige editando, sin perder las ofertas que siguen sirviendo. */}
          {reason === 'ERROR_DATOS' && auction?.editable !== false && onEdit && (
            <button type="button" className="cancel-auction-edit" onClick={onEdit}>
              <Pencil size={15} /> Mejor edito mi búsqueda
            </button>
          )}

          {needsDetail && (
            <label className="quote-ws-report-detail">
              <span>Cuéntanos el motivo (obligatorio)</span>
              <textarea
                rows="3"
                maxLength={CANCEL_DETAIL_MAX}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="Este detalle es privado: solo lo ve el equipo de RepuesTop."
              />
              <small>{detail.length}/{CANCEL_DETAIL_MAX}</small>
            </label>
          )}

          <p className="cancel-auction-privacy">Las tiendas verán el motivo elegido. {needsDetail ? 'Tu detalle no se les muestra.' : ''}</p>
          {error && <p className="contextual-report-error" role="alert">{error}</p>}
        </div>

        <footer>
          <button type="button" className="secondary" disabled={busy} onClick={close}>Volver</button>
          <button type="submit" disabled={!canSubmit || busy}>
            {busy ? <Loader2 size={17} className="spin-icon" /> : <XCircle size={17} />}
            {busy ? 'Cancelando…' : 'Cancelar búsqueda'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
