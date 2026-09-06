import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ReceiptText, Copy, CheckCircle2, FileUp, X, Loader2 } from 'lucide-react';
import { isCancelledItem, orderDisplayCode } from '../data/orderIdentity';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

/**
 * Popup con los datos de la venta para que el vendedor emita la boleta / factura y la
 * adjunte. Se abre al confirmar un pedido recién pagado (obligatorio) tanto desde el detalle
 * del pedido como desde la tarjeta del listado, y en modo `uploadOnly` para cargarla en un
 * pedido ya confirmado.
 *
 * `items` debe venir ya acotado a la tienda del vendedor (las líneas canceladas se filtran
 * aquí). `onSubmit(file)` sube la boleta y — salvo en `uploadOnly` — encadena la confirmación;
 * si resuelve sin lanzar, el modal se cierra.
 */
export default function SaleReceiptModal({
  order,
  items = [],
  shipping = 0,
  uploadOnly = false,
  onSubmit,
  onClose,
}) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!order) return null;

  const orderCode = orderDisplayCode(order, 'seller');
  const buyerName = order.compradorNombre || order.buyerName || order.usuarioNombre || 'Cliente RepuesTop';
  const buyerPhoneRaw = order.compradorTelefono || order.buyerPhone || order.telefono || '';
  const buyerPhone = buyerPhoneRaw && buyerPhoneRaw !== '—' ? buyerPhoneRaw : '';
  const buyerRut = order.facturaRut || order.compradorRut || order.taxId || order.rutEmpresa || '';
  const deliveryAddress = [
    order.compradorDireccion || order.direccionEntrega || order.address,
    order.compradorComuna || order.comuna,
    order.compradorRegion || order.region,
  ].filter(Boolean).join(', ');
  const docType = String(order.tipoDocumentoTributario || order.tipoDocumento || order.documentType || '').toUpperCase() === 'FACTURA'
    ? 'FACTURA' : 'BOLETA';

  const cleanItems = (items || []).filter((it) => !isCancelledItem(it));
  const unitOf = (it) => Number(it.precioUnitario ?? it.precio ?? it.unitPrice ?? 0);
  const qtyOf = (it) => Number(it.cantidad ?? it.quantity ?? 1);
  const productsTotal = cleanItems.reduce((sum, it) => sum + unitOf(it) * qtyOf(it), 0);
  const shippingValue = Number(shipping || 0);
  const totalToDocument = productsTotal + shippingValue;

  const documentLine = docType === 'FACTURA'
    ? `Factura · RUT ${buyerRut || '—'}${order.facturaRazonSocial ? ` · ${order.facturaRazonSocial}` : ''}${order.facturaGiro ? ` · ${order.facturaGiro}` : ''}`
    : 'Boleta electrónica';

  const summaryText = [
    `Pedido ${orderCode}`,
    `Fecha: ${new Date(order.createdAt || order.fecha || Date.now()).toLocaleDateString('es-CL')}`,
    `Cliente: ${buyerName}${buyerPhone ? ` · ${buyerPhone}` : ''}`,
    `Documento: ${documentLine}`,
    deliveryAddress ? `Despacho: ${deliveryAddress}` : null,
    '',
    'Detalle:',
    ...cleanItems.map((it) => {
      const name = it.nombre || it.productName || it.name || 'Repuesto';
      return `- ${name}${it.sku ? ` (SKU ${it.sku})` : ''} x${qtyOf(it)} · ${formatCLP(unitOf(it))} c/u · ${formatCLP(unitOf(it) * qtyOf(it))}`;
    }),
    '',
    `Productos: ${formatCLP(productsTotal)}`,
    shippingValue > 0 ? `Envío: ${formatCLP(shippingValue)}` : null,
    `Total a documentar al comprador: ${formatCLP(totalToDocument)}`,
  ].filter((l) => l !== null).join('\n');

  const copyData = () => {
    navigator.clipboard?.writeText(summaryText).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(file);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'No se pudo registrar la boleta de venta.');
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="commission-modal-backdrop order-subdialog-backdrop" onClick={() => !submitting && onClose?.()}>
      <form className="commission-modal-card order-subdialog-card order-subdialog-card--wide" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <div className="commission-modal-header">
          <div className="commission-icon-badge">
            <ReceiptText size={22} />
          </div>
          <div className="order-subdialog-heading">
            <h3>{uploadOnly ? 'Cargar boleta de venta' : 'Registrar boleta de venta'}</h3>
            <span>
              Pedido {orderCode}
              {!uploadOnly && ' · obligatoria para confirmar'}
            </span>
          </div>
        </div>

        {error && <p className="confirm-dialog-error">{error}</p>}

        <div className="order-receipt-data">
          <div className="order-receipt-data-head">
            <span>Datos de la venta</span>
            <button type="button" className="order-receipt-copy" onClick={copyData}>
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copiado' : 'Copiar datos'}</span>
            </button>
          </div>
          <dl className="order-receipt-fields">
            <div><dt>Cliente</dt><dd>{buyerName}{buyerPhone ? ` · ${buyerPhone}` : ''}</dd></div>
            <div><dt>Documento</dt><dd>{documentLine}</dd></div>
            {deliveryAddress && <div><dt>Despacho</dt><dd>{deliveryAddress}</dd></div>}
          </dl>

          {cleanItems.length > 0 && (
            <table className="order-receipt-items">
              <thead>
                <tr><th>Detalle</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {cleanItems.map((it, i) => (
                  <tr key={it.id || i}>
                    <td>
                      <strong>{it.nombre || it.productName || it.name || 'Repuesto'}</strong>
                      {(it.marca || it.brand || it.sku) && (
                        <small>{[it.marca || it.brand, it.sku ? `SKU ${it.sku}` : null].filter(Boolean).join(' · ')}</small>
                      )}
                    </td>
                    <td>{qtyOf(it)}</td>
                    <td>{formatCLP(unitOf(it))}</td>
                    <td>{formatCLP(unitOf(it) * qtyOf(it))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="order-receipt-totals">
            <span><span>Productos</span><strong>{formatCLP(productsTotal)}</strong></span>
            {shippingValue > 0 && <span><span>Envío</span><strong>{formatCLP(shippingValue)}</strong></span>}
            <span className="order-receipt-total-main">
              <span>Total a documentar al comprador</span>
              <strong>{formatCLP(totalToDocument)}</strong>
            </span>
          </div>
          <p className="order-receipt-hint">
            Emite la boleta o factura por este monto en tu sistema y adjunta el archivo
            (PDF o imagen). La comisión de RepuesTop se descuenta aparte y no va en el documento.
          </p>
        </div>

        <div className="order-subdialog-field">
          <span>Archivo de la boleta *</span>
          <div className="order-subdialog-filedrop">
            <label>
              <FileUp size={20} />
              <span>{file ? file.name : 'Adjuntar PDF o imagen de la boleta'}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
              />
            </label>
            {file && (
              <button
                type="button"
                className="order-subdialog-fileclear"
                aria-label="Quitar archivo"
                title="Quitar archivo"
                onClick={() => setFile(null)}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="confirm-dialog-actions">
          <button type="button" className="btn-auth-secondary" onClick={() => onClose?.()} disabled={submitting}>
            Volver
          </button>
          <button type="submit" className="btn-auth-primary" disabled={submitting || !file}>
            {submitting && <Loader2 size={16} className="spin-icon" />}
            {submitting
              ? (uploadOnly ? 'Guardando...' : 'Confirmando...')
              : (uploadOnly ? 'Guardar boleta' : 'Confirmar pedido con boleta')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
