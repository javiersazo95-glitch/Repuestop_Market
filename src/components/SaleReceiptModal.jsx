import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ReceiptText, Copy, CheckCircle2, FileUp, X, Loader2 } from 'lucide-react';
import { isCancelledItem, orderDisplayCode } from '../data/orderIdentity';
import SellerConfirmationChecklist from './SellerConfirmationChecklist';
import { validateUpload, FILE_LIMITS } from '../utils/fileValidation';

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
 * si resuelve sin lanzar, muestra la confirmación al vendedor. `file` llega null cuando la boleta
 * ya estaba cargada y el vendedor confirma sin reemplazarla.
 */
export default function SaleReceiptModal({
  order,
  items = [],
  shipping = 0,
  discount = 0,
  uploadOnly = false,
  sellerChecklist = null,
  isStorePickup = false,
  onConfirmStock,
  onConfirmCompatibility,
  onOpenBuyerChat,
  onSubmit,
  onClose,
}) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!order) return null;

  // Pasos 1 y 2 del checklist del vendedor, cuando el modal se abrió desde "Confirmar pedido"
  // (no en `uploadOnly`, que es recargar la boleta de un pedido ya confirmado). Gatillan la
  // sección de la boleta: sin esto, subir el archivo antes de revisar stock/compatibilidad
  // dejaba la boleta emitida antes de descubrir una incompatibilidad -- justo lo que este
  // orden de pasos existe para evitar.
  const stockListo = sellerChecklist ? Boolean(sellerChecklist.stockEntregaConfirmadaAt) : true;
  const compatibilidadLista = sellerChecklist ? Boolean(sellerChecklist.compatibilidadConfirmadaAt) : true;
  const checklistCompleto = stockListo && compatibilidadLista;
  // La boleta pudo cargarse antes (pedidos confirmados a medias, o desde otro dispositivo):
  // entonces el paso 3 no obliga a subirla de nuevo, solo permite reemplazarla.
  const boletaYaCargada = !uploadOnly && Boolean(order.boletaVentaDisponible);

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
  const discountValue = Number(discount || 0);
  const totalToDocument = Math.max(0, productsTotal + shippingValue - discountValue);

  const documentLine = docType === 'FACTURA' ? 'Factura electrónica' : 'Boleta electrónica';

  const summaryText = [
    `Pedido ${orderCode}`,
    `Fecha: ${new Date(order.createdAt || order.fecha || Date.now()).toLocaleDateString('es-CL')}`,
    `Cliente: ${buyerName}${buyerPhone ? ` · ${buyerPhone}` : ''}`,
    `Documento: ${documentLine}`,
    docType === 'FACTURA' ? `RUT: ${buyerRut || '—'}` : null,
    docType === 'FACTURA' && order.facturaRazonSocial ? `Razón social: ${order.facturaRazonSocial}` : null,
    docType === 'FACTURA' && order.facturaGiro ? `Giro: ${order.facturaGiro}` : null,
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
    discountValue > 0 ? `Descuento: -${formatCLP(discountValue)}` : null,
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
    if ((!file && !boletaYaCargada) || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(file);
      if (uploadOnly) {
        onClose?.();
        return;
      }
      setConfirmed(true);
      setSubmitting(false);
    } catch (err) {
      setError(err?.message || 'No se pudo registrar la boleta de venta.');
      setSubmitting(false);
    }
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf' || !selected.name.toLowerCase().endsWith('.pdf')) {
      setFile(null);
      setError('La boleta debe ser un archivo PDF.');
      event.target.value = '';
      return;
    }
    // El tamano no se comprobaba: un PDF escaneado de decenas de MB se subia entero y
    // fallaba al final, con un error del servidor que no explicaba nada.
    const excedeTamano = validateUpload(selected, { maxBytes: FILE_LIMITS.DOCUMENT, label: 'La boleta' });
    if (excedeTamano) {
      setFile(null);
      setError(excedeTamano);
      event.target.value = '';
      return;
    }
    setError('');
    setFile(selected);
  };

  return createPortal(
    <div className="commission-modal-backdrop order-subdialog-backdrop" onClick={() => !submitting && onClose?.()}>
      <form className="commission-modal-card order-subdialog-card order-subdialog-card--wide" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <div className="commission-modal-header">
          <div className="commission-icon-badge">
            <ReceiptText size={22} />
          </div>
          <div className="order-subdialog-heading">
            <h3>{sellerChecklist ? 'Confirmar pedido' : uploadOnly ? 'Cargar boleta de venta' : 'Registrar boleta de venta'}</h3>
            <span>
              Pedido {orderCode}
              {!uploadOnly && ' · obligatoria para confirmar'}
            </span>
          </div>
        </div>

        {sellerChecklist && !confirmed && (
          <>
            <p className="order-receipt-hint">
              Estos pasos son solo para ti: el comprador no los ve. Revisar la compatibilidad
              antes de emitir la boleta evita devoluciones y notas de crédito.
            </p>
            <SellerConfirmationChecklist
              order={order}
              isStorePickup={isStorePickup}
              onConfirmStock={onConfirmStock}
              onConfirmCompatibility={onConfirmCompatibility}
              onOpenBuyerChat={onOpenBuyerChat}
            />
          </>
        )}

        {error && <p className="confirm-dialog-error">{error}</p>}

        {confirmed ? (
          <div className="order-receipt-data">
            <div className="order-receipt-data-head">
              <span>Pedido confirmado</span>
            </div>
            <p className="order-receipt-hint">
              ¡Gracias por enviar la boleta o factura! El comprador fue notificado por correo y ya puedes procesar el pedido.
            </p>
          </div>
        ) : <>
        {sellerChecklist && !checklistCompleto ? (
          <div className="seller-checklist-step is-locked">
            <div className="seller-checklist-step-head">
              <span className="seller-checklist-step-num">3</span>
              <strong>Boleta o factura</strong>
            </div>
          </div>
        ) : <>
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
            {docType === 'FACTURA' && <div><dt>RUT</dt><dd>{buyerRut || '—'}</dd></div>}
            {docType === 'FACTURA' && order.facturaRazonSocial && <div><dt>Razón social</dt><dd>{order.facturaRazonSocial}</dd></div>}
            {docType === 'FACTURA' && order.facturaGiro && <div><dt>Giro</dt><dd>{order.facturaGiro}</dd></div>}
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
            {discountValue > 0 && <span><span>Descuento</span><strong className="order-receipt-discount">-{formatCLP(discountValue)}</strong></span>}
            <span className="order-receipt-total-main">
              <span>Total a documentar al comprador</span>
              <strong>{formatCLP(totalToDocument)}</strong>
            </span>
          </div>
          <p className="order-receipt-hint">
            Emite la boleta o factura por este monto en tu sistema y adjunta el archivo
            en PDF. La comisión de RepuesTop se descuenta aparte y no va en el documento.
          </p>
        </div>

        {boletaYaCargada && (
          <p className="order-receipt-hint">
            Ya cargaste la boleta de este pedido. Puedes confirmar así o adjuntar otra para reemplazarla.
          </p>
        )}
        <div className="order-subdialog-field">
          <span>{boletaYaCargada ? 'Reemplazar boleta (opcional)' : 'Archivo de la boleta *'}</span>
          <div className="order-subdialog-filedrop">
            <label>
              <FileUp size={20} />
              <span>{file ? file.name : 'Adjuntar PDF de la boleta'}</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
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
        </>}
        </>}

        <div className="confirm-dialog-actions">
          {confirmed ? (
            <button type="button" className="btn-auth-primary" onClick={() => onClose?.()}>
              Entendido
            </button>
          ) : <>
            <button type="button" className="btn-auth-secondary" onClick={() => onClose?.()} disabled={submitting}>
              Volver
            </button>
            {sellerChecklist && !checklistCompleto ? (
              <button type="button" className="btn-auth-primary" disabled>
                {!stockListo ? 'Completa el paso 1 para seguir' : 'Completa el paso 2 para seguir'}
              </button>
            ) : (
              <button type="submit" className="btn-auth-primary" disabled={submitting || (!file && !boletaYaCargada)}>
                {submitting && <Loader2 size={16} className="spin-icon" />}
                {submitting
                  ? (uploadOnly ? 'Guardando...' : 'Confirmando...')
                  : (uploadOnly ? 'Guardar boleta' : 'Confirmar y preparar pedido')}
              </button>
            )}
          </>}
        </div>
      </form>
    </div>,
    document.body,
  );
}
