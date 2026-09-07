import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCheck, Download, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { getSaleReceiptUrlApi } from '../services/api';

/**
 * Visor de la boleta / factura de una suborden. Lo usan las DOS partes: el vendedor que la
 * emitio y el comprador que tiene derecho a ella.
 *
 * Se descarga el PDF a un blob y desde ahi se previsualiza y se guarda, en vez de mandar al
 * navegador a la URL del backend, por tres razones concretas:
 *
 *  1. El token de `/pedidos/{id}/boleta-venta-url` es de UN SOLO USO y dura 5 minutos
 *     (`PedidoController.descargarBoletaVenta` hace `remove` del token). Con un `window.open`
 *     el token se gasta en la vista y "descargar" desde el visor del navegador ya no puede
 *     volver a pedir el archivo. Con el blob, un token sirve para ver Y para guardar.
 *  2. `window.open` despues de un `await` queda fuera del gesto del usuario y los bloqueadores
 *     de popup lo matan sin aviso -- en Safari e iOS casi siempre. Abrir un modal no.
 *  3. El backend responde `Content-Disposition: inline; filename="boleta-venta"`, sin
 *     extension: el navegador guardaba un archivo sin `.pdf`. Aca el nombre lo pone el
 *     `download` del enlace.
 *
 * La previsualizacion va en un `<object>` y no en un `<iframe>` a proposito: cuando el
 * navegador no sabe dibujar un PDF embebido -- Safari de iOS y Chrome de Android -- el iframe
 * queda en blanco y el `<object>` pinta su contenido de respaldo, que son los mismos botones
 * de descargar y abrir en pestana nueva.
 */
export default function SaleReceiptViewerModal({
  orderId,
  proveedorId = null,
  orderCode,
  storeName,
  onClose,
}) {
  const [state, setState] = useState({ status: 'loading', url: null, error: '' });
  const [attempt, setAttempt] = useState(0);

  const fileName = `boleta-${String(orderCode || orderId || 'venta').replace(/[^\w-]+/g, '')}.pdf`;

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    setState({ status: 'loading', url: null, error: '' });

    (async () => {
      try {
        const { url } = await getSaleReceiptUrlApi(
          orderId,
          proveedorId != null ? { proveedorId } : {},
        );
        if (!url) throw new Error('No se pudo obtener el documento.');
        const response = await fetch(url);
        if (!response.ok) throw new Error('El enlace del documento expiró. Vuelve a intentarlo.');
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: 'ready', url: objectUrl, error: '' });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: 'error',
          url: null,
          error: error?.message || 'No pudimos abrir la boleta. Inténtalo de nuevo.',
        });
      }
    })();

    return () => {
      cancelled = true;
      // Sin esto el PDF queda retenido en memoria mientras viva la pestana.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `attempt` fuerza un token nuevo al reintentar: el anterior ya se gasto.
  }, [orderId, proveedorId, attempt]);

  return createPortal(
    <div className="commission-modal-backdrop order-subdialog-backdrop" onClick={() => onClose?.()}>
      <div
        className="commission-modal-card order-subdialog-card order-receipt-viewer-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="commission-modal-header">
          <div className="commission-icon-badge">
            <FileCheck size={22} />
          </div>
          <div className="order-subdialog-heading">
            <h3>Boleta de venta</h3>
            <span>
              {orderCode ? `Pedido ${orderCode}` : 'Documento de la venta'}
              {storeName ? ` · ${storeName}` : ''}
            </span>
          </div>
        </div>

        <div className="order-receipt-viewer-frame">
          {state.status === 'loading' && (
            <div className="order-receipt-viewer-state">
              <Loader2 size={22} className="spin-icon" />
              <span>Abriendo el documento…</span>
            </div>
          )}

          {state.status === 'error' && (
            <div className="order-receipt-viewer-state">
              <p className="confirm-dialog-error">{state.error}</p>
              <button type="button" className="btn-auth-secondary" onClick={() => setAttempt((n) => n + 1)}>
                <RotateCcw size={15} />
                <span>Reintentar</span>
              </button>
            </div>
          )}

          {state.status === 'ready' && (
            <object data={state.url} type="application/pdf" aria-label="Boleta de venta">
              <div className="order-receipt-viewer-state">
                <span>Tu navegador no puede mostrar el PDF aquí. Descárgalo o ábrelo en una pestaña nueva.</span>
              </div>
            </object>
          )}
        </div>

        <div className="confirm-dialog-actions order-receipt-viewer-actions">
          <button type="button" className="btn-auth-secondary" onClick={() => onClose?.()}>
            Cerrar
          </button>
          {state.status === 'ready' && (
            <>
              {/* Va sobre el blob, asi que abrir la pestana es el gesto del usuario y no lo
                  bloquea nadie; ademas no gasta un token nuevo. */}
              <button
                type="button"
                className="btn-auth-secondary"
                onClick={() => window.open(state.url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink size={15} />
                <span>Abrir en pestaña</span>
              </button>
              <a className="btn-auth-primary order-receipt-viewer-download" href={state.url} download={fileName}>
                <Download size={15} />
                <span>Descargar</span>
              </a>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
