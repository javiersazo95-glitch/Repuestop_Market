import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, History, ArrowDownLeft, ArrowUpRight, Loader2, AlertTriangle, Coins
} from 'lucide-react';
import { fetchTokenTransactions, adErrorMessage } from '../../services/adsStorage';

/**
 * Historial de movimientos del Monedero de Fichas.
 *
 * `TokensWalletCard` ya tenia el boton de "Historial", pero nadie le pasaba el
 * handler y no habia a donde llevarlo: el historial vivia en `localStorage` y
 * ninguna vista lo leia. Ahora lo sirve el backend
 * (`GET /fichas/movimientos`), que es la misma fuente que da el saldo.
 *
 * Se lee al abrir y no se cachea: el saldo del encabezado tiene que ser el que
 * respondio el servidor junto con las filas que se estan mostrando, o el usuario
 * ve un total que no cuadra con la lista.
 */
export default function TokensHistoryModal({ isOpen, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    setIsLoading(true);
    fetchTokenTransactions({ signal: controller.signal })
      .then((list) => { setTransactions(list); setLoadError(null); })
      .catch((error) => { if (error?.name !== 'AbortError') setLoadError(error); })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="booking-modal-card tokens-history-card">
        <div className="booking-modal-header">
          <div>
            <h3><History className="text-amber-500" size={22} /> Historial de Fichas</h3>
            <p>Cada recarga y cada cobro de tus anuncios, del más reciente al más antiguo.</p>
          </div>
          <button
            type="button"
            className="story-close-btn"
            style={{ background: '#f1f5f9', color: '#0f172a' }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {isLoading && (
          <div className="ads-mgmt-state">
            <Loader2 size={22} className="spin-icon" />
            <p>Cargando tus movimientos…</p>
          </div>
        )}

        {!isLoading && loadError && (
          <div className="ads-mgmt-state is-error">
            <AlertTriangle size={22} />
            <p>{adErrorMessage(loadError, 'No pudimos cargar tu historial de Fichas.')}</p>
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
              <div key={tx.id} className={`tokens-history-item is-${tx.type}`}>
                <span className="tokens-history-icon">
                  {tx.type === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </span>
                <div className="tokens-history-body">
                  <strong>{tx.description}</strong>
                  <span>{new Date(tx.date).toLocaleDateString('es-CL', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}</span>
                </div>
                <span className="tokens-history-amount">
                  {tx.type === 'credit' ? '+' : '−'}{tx.amount.toLocaleString('es-CL')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
