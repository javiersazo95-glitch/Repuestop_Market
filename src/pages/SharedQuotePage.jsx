import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Download, Eye, FileText, Loader2, Store } from 'lucide-react';
import { getSharedQuoteApi, getStoreProfileApi } from '../services/api';
import { adaptStore } from '../services/adapters';
import { buildQuotePdfBlob, quoteDocumentFilename } from '../utils/quoteDocument';
import { isQuoteExpired, quoteChargeBase } from '../utils/quoteFlow';
import { useDocumentTitle } from '../routes/useDocumentTitle';

const formatCLP = (value) => `$${Math.round(Number(value || 0)).toLocaleString('es-CL')}`;

/**
 * Cotizacion compartida (5-oct): "Compartir cotizacion" en la app o en el Market envia este enlace.
 * Quien lo abre, con o sin sesion, ve el resumen y puede ver o descargar el PDF: el mismo documento
 * que se genera dentro del chat. No muestra la patente ni el chasis del comprador.
 */
export default function SharedQuotePage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [store, setStore] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useDocumentTitle(data?.productoNombre ? `Cotización · ${data.productoNombre}` : 'Cotización compartida');

  useEffect(() => {
    let active = true;
    getSharedQuoteApi(token)
      .then(async (shared) => {
        if (!active) return;
        setData(shared);
        if (shared?.proveedorId) {
          const raw = await getStoreProfileApi(shared.proveedorId).catch(() => null);
          if (active && raw) setStore(adaptStore(raw));
        }
      })
      .catch((err) => {
        if (active) setError(err?.message || 'No pudimos abrir esta cotización.');
      });
    return () => { active = false; };
  }, [token]);

  const createBlob = () => buildQuotePdfBlob({
    conversationId: data.conversacionId,
    quote: data.cotizacion,
    productName: data.productoNombre || 'Producto cotizado',
    storeName: store?.nombre || data.tiendaNombre || 'Tienda RepuesTop',
    storeTaxId: store?.rut || store?.taxId || '',
    storeGiro: store?.tipo || store?.giro || store?.especialidad || '',
    storeAddress: store?.direccion || store?.address || '',
    storeCity: store?.ciudad || [store?.comuna, store?.region].filter(Boolean).join(', ') || '',
    storePhone: store?.telefono || store?.phone || '',
    storeEmail: store?.email || '',
    storeHours: store?.horario || store?.hours || '',
    buyerName: data.compradorNombre || 'Comprador RepuesTop',
    // El enlace se puede reenviar: el PDF compartido no lleva la patente ni el chasis.
    vehicleConsulted: '',
    storeLogoUrl: store?.logoUrl || '',
  });

  const viewPdf = async () => {
    const preview = window.open('', '_blank');
    setBusy('view');
    try {
      const url = URL.createObjectURL(await createBlob());
      if (preview) preview.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      preview?.close();
      setError('No se pudo generar el PDF de la cotización.');
    } finally {
      setBusy('');
    }
  };

  const downloadPdf = async () => {
    setBusy('download');
    try {
      const url = URL.createObjectURL(await createBlob());
      const link = document.createElement('a');
      link.href = url;
      link.download = quoteDocumentFilename(data.conversacionId);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError('No se pudo generar el PDF de la cotización.');
    } finally {
      setBusy('');
    }
  };

  if (error && !data) {
    return (
      <main className="container shared-quote-page">
        <section className="shared-quote-card is-error">
          <AlertCircle size={36} />
          <h1>No pudimos abrir la cotización</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container shared-quote-page">
        <section className="shared-quote-card is-loading"><Loader2 size={28} className="spin-icon" /> Cargando cotización…</section>
      </main>
    );
  }

  const quote = data.cotizacion || {};
  const expired = isQuoteExpired(quote);
  const notPayable = !data.vigente || expired;

  return (
    <main className="container shared-quote-page">
      <section className="shared-quote-card">
        <header>
          <span className="shared-quote-icon"><FileText size={26} /></span>
          <div>
            <small>Cotización compartida</small>
            <h1>{data.productoNombre || 'Producto cotizado'}</h1>
            <p><Store size={14} /> {store?.nombre || data.tiendaNombre || 'Tienda RepuesTop'}</p>
          </div>
        </header>

        {notPayable && (
          <p className="shared-quote-warning">
            <AlertCircle size={16} />
            {!data.vigente
              ? 'La tienda reemplazó o retiró esta cotización. El documento queda como referencia.'
              : 'Esta cotización ya venció. El documento queda como referencia.'}
          </p>
        )}

        <dl className="shared-quote-facts">
          <div><dt>Total cotizado</dt><dd>{formatCLP(quoteChargeBase(quote))}</dd></div>
          {quote.cantidad && <div><dt>Cantidad</dt><dd>{quote.cantidad}</dd></div>}
          {quote.condicionesEntrega && <div><dt>Entrega</dt><dd>{quote.condicionesEntrega}</dd></div>}
          {quote.vigencia && <div><dt>Vigencia</dt><dd>{quote.vigencia}</dd></div>}
        </dl>

        <div className="shared-quote-actions">
          <button type="button" className="primary" onClick={viewPdf} disabled={Boolean(busy)}>
            {busy === 'view' ? <Loader2 size={17} className="spin-icon" /> : <Eye size={17} />} Ver PDF
          </button>
          <button type="button" onClick={downloadPdf} disabled={Boolean(busy)}>
            {busy === 'download' ? <Loader2 size={17} className="spin-icon" /> : <Download size={17} />} Descargar PDF
          </button>
        </div>
        {error && <p className="shared-quote-error">{error}</p>}
        <small className="shared-quote-note">
          Para pagar, el comprador lo hace desde su chat de la cotización en RepuesTop, con la compra protegida.
        </small>
      </section>
    </main>
  );
}
