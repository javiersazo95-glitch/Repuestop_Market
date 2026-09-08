import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, History, ArrowDownLeft, ArrowUpRight, Loader2, AlertTriangle, Coins, ChevronRight, FileText
} from 'lucide-react';
import { fetchTokenTransactions, adErrorMessage } from '../../services/adsStorage';
import { getRechargeReceiptUrlApi } from '../../services/api';
import PrivateDocumentViewerModal from '../PrivateDocumentViewerModal';

/**
 * Historial de movimientos del Monedero de Monedas.
 *
 * Lo sirve el backend (`GET /fichas/movimientos`), que es la misma fuente que da
 * el saldo. Se lee al abrir y no se cachea: el resumen del encabezado tiene que
 * cuadrar con las filas que se estan mostrando, o el usuario ve un total que no
 * corresponde a la lista.
 *
 * Cada fila abre su detalle (port de `TokensHistoryModal` del monorepo
 * `fae41ed`): en la lista la descripcion y la fecha se recortan a una linea para
 * que el historial se lea de un vistazo, y el detalle es donde se ven completas.
 *
 * El detalle de una recarga es ademas donde el comprador ve y descarga su boleta o factura
 * (documento #3: lo emite RepuesTop, que en la compra de Monedas es vendedor directo). Va aca y
 * no en una pantalla aparte porque este es el lugar al que vuelve a buscarla, y porque el
 * vinculo movimiento -> compra ya existia en la base.
 *
 * QUE NO SE MUESTRA, Y POR QUE: la app tiene ademas una fila "Monto pagado" y un
 * resumen "Total pagado", pero `MovimientoFichaDTO` no trae el monto en pesos.
 * Alla salen de un campo opcional que quedo del monedero local y que hoy nadie
 * llena, asi que muestran $0 siempre. Aca se omiten en vez de portar una fila que
 * no se puede llenar; si algun dia el DTO expone el monto, se agregan.
 */

function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha no informada';
  return date.toLocaleString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha no informada';
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function TokensHistoryModal({ isOpen, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  /** Movimiento abierto en el detalle. */
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setSelected(null);
      return undefined;
    }
    const controller = new AbortController();
    setIsLoading(true);
    fetchTokenTransactions({ signal: controller.signal })
      .then((list) => { setTransactions(list); setLoadError(null); })
      .catch((error) => { if (error?.name !== 'AbortError') setLoadError(error); })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [isOpen]);

  const totals = useMemo(() => {
    const credits = transactions.filter((item) => item.type === 'credit');
    return {
      recharges: credits.length,
      tokensIn: credits.reduce((acc, item) => acc + item.amount, 0),
      spent: transactions
        .filter((item) => item.type === 'debit')
        .reduce((acc, item) => acc + item.amount, 0)
    };
  }, [transactions]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="booking-modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        role="dialog"
        aria-modal="true"
      >
        <div className="booking-modal-card tokens-history-card">
          <div className="booking-modal-header">
            <div>
              <h3><History className="text-amber-500" size={22} /> Historial de Monedas</h3>
              <p>Cada recarga y cada cobro de tus anuncios, del más reciente al más antiguo.</p>
            </div>
            <button
              type="button"
              className="story-close-btn"
              style={{ background: '#f1f5f9', color: '#0f172a' }}
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          {!isLoading && !loadError && transactions.length > 0 && (
            <div className="tokens-history-summary">
              <div><b>{totals.recharges}</b><span>Recargas</span></div>
              <div><b>{totals.tokensIn.toLocaleString('es-CL')}</b><span>Monedas cargadas</span></div>
              <div><b>{totals.spent.toLocaleString('es-CL')}</b><span>Monedas usadas</span></div>
            </div>
          )}

          {isLoading && (
            <div className="ads-mgmt-state">
              <Loader2 size={22} className="spin-icon" />
              <p>Cargando tus movimientos…</p>
            </div>
          )}

          {!isLoading && loadError && (
            <div className="ads-mgmt-state is-error">
              <AlertTriangle size={22} />
              <p>{adErrorMessage(loadError, 'No pudimos cargar tu historial de Monedas.')}</p>
            </div>
          )}

          {!isLoading && !loadError && transactions.length === 0 && (
            <div className="ads-mgmt-state">
              <Coins size={22} />
              <p>Todavía no hay movimientos en tu monedero.</p>
            </div>
          )}

          {!isLoading && !loadError && transactions.length > 0 && (
            <div className="tokens-history-list">
              {transactions.map((tx) => (
                <button
                  type="button"
                  key={tx.id}
                  className={`tokens-history-item is-${tx.type}`}
                  onClick={() => setSelected(tx)}
                  aria-label={`Ver el detalle de ${tx.description}`}
                >
                  <span className="tokens-history-icon">
                    {tx.type === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </span>
                  <span className="tokens-history-body">
                    <strong>{tx.description}</strong>
                    <span>{formatDate(tx.date)}</span>
                  </span>
                  <span className="tokens-history-amount">
                    {tx.type === 'credit' ? '+' : '−'}{tx.amount.toLocaleString('es-CL')}
                  </span>
                  <ChevronRight size={17} className="tokens-history-chevron" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <TransactionDetail transaction={selected} onClose={() => setSelected(null)} />
    </>,
    document.body
  );
}

/**
 * Detalle de un movimiento, en su propia hoja: en la fila la descripcion y la
 * fecha se recortan a una linea, y aca se muestran completas junto con el resto
 * de los datos del registro.
 */
function TransactionDetail({ transaction, onClose }) {
  /** Guarda la compra y no el movimiento: el visor sobrevive a que se cierre el detalle. */
  const [receiptFor, setReceiptFor] = useState(null);

  const loadReceiptUrl = useCallback(
    () => getRechargeReceiptUrlApi(receiptFor?.purchaseId),
    [receiptFor],
  );

  if (!transaction) return null;
  const isCredit = transaction.type === 'credit';
  const receipt = transaction.receipt;
  // Sin `purchaseId` no hay a que pedirle el documento, por mas que el backend lo marque.
  const canOpenReceipt = Boolean(receipt && transaction.purchaseId);
  const receiptLabel = receipt?.type === 'FACTURA' ? 'factura' : 'boleta';

  return (
    <div
      className="booking-modal-overlay tokens-detail-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="booking-modal-card tokens-detail-card">
        <div className="booking-modal-header">
          <div className="tokens-detail-head">
            <span className={`tokens-history-icon ${isCredit ? 'is-credit-icon' : 'is-debit-icon'}`}>
              {isCredit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
            </span>
            <div>
              <h3>{isCredit ? 'Recarga de monedas' : 'Uso de monedas'}</h3>
              <p>{formatDateTime(transaction.date)}</p>
            </div>
          </div>
          <button
            type="button"
            className="story-close-btn"
            style={{ background: '#f1f5f9', color: '#0f172a' }}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`tokens-detail-amount is-${transaction.type}`}>
          <strong>
            {isCredit ? '+' : '−'}{transaction.amount.toLocaleString('es-CL')}
          </strong>
          <span>{transaction.amount === 1 ? 'Moneda RepuesTop' : 'Monedas RepuesTop'}</span>
        </div>

        <DetailRow label="Descripción" value={transaction.description} />
        <DetailRow label="Fecha y hora" value={formatDateTime(transaction.date)} />
        <DetailRow label="Movimiento" value={isCredit ? 'Ingreso al monedero' : 'Descuento del monedero'} />
        {transaction.adId && <DetailRow label="Aviso asociado" value={`#${transaction.adId}`} />}
        <DetailRow label="N.º de registro" value={transaction.id} />

        {receipt && (
          <>
            <DetailRow
              label="Documento tributario"
              value={`${receipt.type === 'FACTURA' ? 'Factura' : 'Boleta'}${receipt.folio ? ` N.º ${receipt.folio}` : ''}`}
            />
            {receipt.date && <DetailRow label="Emitido el" value={formatDate(receipt.date)} />}
          </>
        )}

        {canOpenReceipt && (
          <div className="tokens-detail-actions">
            <button
              type="button"
              className="btn-auth-primary"
              onClick={() => setReceiptFor({ purchaseId: transaction.purchaseId, label: receiptLabel })}
            >
              <FileText size={15} />
              <span>Ver mi {receiptLabel}</span>
            </button>
          </div>
        )}
      </div>

      {receiptFor && (
        <PrivateDocumentViewerModal
          loadUrl={loadReceiptUrl}
          title={receiptFor.label === 'factura' ? 'Factura de tu recarga' : 'Boleta de tu recarga'}
          subtitle="Compra de Monedas RepuesTop"
          fileName={`${receiptFor.label}-recarga-${receiptFor.purchaseId}.pdf`}
          onClose={() => setReceiptFor(null)}
        />
      )}
    </div>
  );
}

/** Fila etiqueta/valor del detalle. El valor nunca se recorta. */
function DetailRow({ label, value }) {
  return (
    <div className="tokens-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
