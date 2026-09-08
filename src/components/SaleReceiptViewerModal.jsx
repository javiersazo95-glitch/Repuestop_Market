import React, { useCallback } from 'react';
import { getSaleReceiptUrlApi } from '../services/api';
import PrivateDocumentViewerModal from './PrivateDocumentViewerModal';

/**
 * Visor de la boleta / factura de una suborden. Lo usan las DOS partes: el vendedor que la
 * emitio y el comprador que tiene derecho a ella.
 *
 * Toda la mecanica -- blob, token de un solo uso, `<object>` en vez de `<iframe>` -- vive en
 * `PrivateDocumentViewerModal`, que comparte con el documento tributario de las recargas de
 * Monedas. Aca solo queda de donde sale la URL y como se llama el archivo.
 */
export default function SaleReceiptViewerModal({
  orderId,
  proveedorId = null,
  orderCode,
  storeName,
  onClose,
}) {
  const loadUrl = useCallback(
    () => getSaleReceiptUrlApi(orderId, proveedorId != null ? { proveedorId } : {}),
    [orderId, proveedorId],
  );

  return (
    <PrivateDocumentViewerModal
      loadUrl={loadUrl}
      title="Boleta de venta"
      subtitle={`${orderCode ? `Pedido ${orderCode}` : 'Documento de la venta'}${storeName ? ` · ${storeName}` : ''}`}
      fileName={`boleta-${String(orderCode || orderId || 'venta').replace(/[^\w-]+/g, '')}.pdf`}
      onClose={onClose}
    />
  );
}
