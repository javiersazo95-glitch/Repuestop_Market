import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCheck, Download, ExternalLink, Loader2, RotateCcw } from 'lucide-react';

/**
 * Visor de un documento PDF servido por un enlace privado de UN SOLO USO.
 *
 * Es el motor que estaba dentro de `SaleReceiptViewerModal` y que ahora usan tambien los
 * documentos tributarios de las recargas de Monedas. Lo unico que cambia entre un caso y otro
 * es de donde sale la URL, asi que eso entra por `loadUrl` y el resto es identico.
 *
 * Se descarga el PDF a un blob y desde ahi se previsualiza y se guarda, en vez de mandar al
 * navegador a la URL del backend, por tres razones concretas:
 *
 *  1. El enlace del backend dura 5 minutos y, en cuanto se abre por primera vez, un minuto
 *     mas. Con el blob un solo enlace sirve para ver Y para guardar sin depender de esa
 *     ventana, y sin pedirle el archivo al backend una vez por cada cosa que el usuario haga.
 *  2. `window.open` despues de un `await` queda fuera del gesto del usuario y los bloqueadores
 *     de popup lo matan sin aviso -- en Safari e iOS casi siempre. Abrir un modal no.
 *  3. El backend responde `Content-Disposition: inline` sin extension: el navegador guardaba un
 *     archivo sin `.pdf`. Aca el nombre lo pone el `download` del enlace.
 *
 * La previsualizacion va en un `<object>` y no en un `<iframe>` a proposito: cuando el
 * navegador no sabe dibujar un PDF embebido -- Safari de iOS y Chrome de Android -- el iframe
 * queda en blanco y el `<object>` pinta su contenido de respaldo, que son los mismos botones
 * de descargar y abrir en pestana nueva.
 */
export default function PrivateDocumentViewerModal({
  loadUrl,
  title = 'Documento',
  subtitle = '',
  fileName = 'documento.pdf',
  onClose,
}) {
  const [state, setState] = useState({ status: 'loading', url: null, error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    setState({ status: 'loading', url: null, error: '' });

    (async () => {
      try {
        const { url } = (await loadUrl()) || {};
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
          error: error?.message || 'No pudimos abrir el documento. Inténtalo de nuevo.',
        });
      }
    })();

    return () => {
      cancelled = true;
      // Sin esto el PDF queda retenido en memoria mientras viva la pestana.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `attempt` fuerza un token nuevo al reintentar: el anterior ya se gasto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUrl, attempt]);

  return createPortal(
    <div
      className="commission-modal-backdrop order-subdialog-backdrop private-document-viewer-backdrop"
      onClick={() => onClose?.()}
    >
      <div
        className="commission-modal-card order-subdialog-card order-receipt-viewer-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="commission-modal-header">
          <div className="commission-icon-badge">
            <FileCheck size={22} />
          </div>
          <div className="order-subdialog-heading">
            <h3>{title}</h3>
            <span>{subtitle}</span>
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
            <object data={state.url} type="application/pdf" aria-label={title}>
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
