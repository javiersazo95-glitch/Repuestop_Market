import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileMinus, FileSearch, FileUp, Loader2, X } from 'lucide-react';
import { getSellerCreditNotesApi, getSellerCreditNoteUrlApi, uploadSellerCreditNoteApi } from '../services/api';
import { validateUpload, FILE_LIMITS } from '../utils/fileValidation';
import { orderDisplayCode } from '../data/orderIdentity';
import PrivateDocumentViewerModal from './PrivateDocumentViewerModal';

/** IVA de la nota: el monto es el total, IVA incluido. */
const IVA = 0.19;

const ESTADO = {
  PENDIENTE: { text: 'Pendiente', tone: 'pending' },
  RECHAZADA: { text: 'Rechazada', tone: 'error' },
  REGISTRADA: { text: 'Registrada', tone: 'ok' },
};

function formatCLP(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString('es-CL')}`;
}

/** "2026-10-09" -> "09-10-2026". */
function fechaVisible(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

function hoyIso() {
  const hoy = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;
}

/** Las notas de credito de la venta; `null` mientras cargan. */
function useSellerCreditNotes(orderId) {
  const [notas, setNotas] = useState(null);
  const recargar = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getSellerCreditNotesApi(orderId);
      setNotas(Array.isArray(data) ? data : []);
    } catch {
      // Sin notas visibles la venta sigue funcionando; el aviso diario le recuerda la nota.
      setNotas([]);
    }
  }, [orderId]);
  useEffect(() => { recargar(); }, [recargar]);
  return { notas, recargar };
}

/**
 * 12-oct: icono discreto en el encabezado del detalle de la venta (paridad con la app). Reemplaza
 * la seccion de notas del cuerpo: solo aparece si la venta tiene notas, con un punto mientras
 * quede alguna por subir o rechazada.
 */
export function CreditNoteHeaderButton({ order }) {
  const { notas, recargar } = useSellerCreditNotes(order?.id);
  const [open, setOpen] = useState(false);
  if (!notas || notas.length === 0) return null;
  const faltan = notas.filter((nota) => nota.estado !== 'REGISTRADA').length;
  const label = faltan > 0 ? `Nota de crédito: ${faltan} por subir` : 'Notas de crédito de la venta';
  return (
    <>
      <button type="button" className={`order-credit-note-icon${faltan > 0 ? ' has-pending' : ''}`}
        onClick={() => setOpen(true)} aria-label={label} title={label}>
        <FileMinus size={18} />
      </button>
      {open && <CreditNoteModal order={order} onClose={() => setOpen(false)} onChanged={recargar} />}
    </>
  );
}

/**
 * 12-oct: popup para que la tienda emita y suba su nota de credito cuando la venta se reembolso.
 * Mismo lenguaje que "Confirmar pedido": arriba los datos para emitirla en el SII y abajo el PDF.
 * Usa el mismo envio que antes la seccion del detalle, asi que llega igual al backoffice.
 */
export default function CreditNoteModal({ order, onClose, onChanged }) {
  const { notas, recargar } = useSellerCreditNotes(order?.id);
  const [seleccionada, setSeleccionada] = useState(null);
  const [viendo, setViendo] = useState(null);

  // Con una sola nota por subir, su formulario se abre de una.
  useEffect(() => {
    const porSubir = (notas || []).filter((nota) => nota.estado !== 'REGISTRADA');
    if (porSubir.length === 1) setSeleccionada(porSubir[0].pagoReembolsoId);
  }, [notas]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const orderCode = orderDisplayCode(order, 'seller');
  const factura = String(order?.tipoDocumentoTributario || order?.tipoDocumento || '').toUpperCase() === 'FACTURA';
  const documento = factura ? 'factura' : 'boleta';
  const buyerName = order?.compradorNombre || order?.buyerName || order?.usuarioNombre || 'Cliente RepuesTop';
  const reembolsados = (order?.items || []).filter((item) => Number(item.montoReembolsado ?? item.refundedAmount ?? 0) > 0
    || (item.estado && String(item.estado).toUpperCase() !== 'ACTIVO'));

  return createPortal(
    <>
    <div className="commission-modal-backdrop order-subdialog-backdrop" onClick={onClose}>
      <div className="commission-modal-card order-subdialog-card order-subdialog-card--wide credit-note-modal" role="dialog" aria-modal="true" aria-label="Nota de crédito" onClick={(e) => e.stopPropagation()}>
        <div className="commission-modal-header">
          <div className="commission-icon-badge credit-note-badge">
            <FileMinus size={22} />
          </div>
          <div className="order-subdialog-heading">
            <h3>Nota de crédito</h3>
            <span>Pedido {orderCode} · anula tu {documento} por lo reembolsado</span>
          </div>
          <button type="button" className="credit-note-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        {notas === null ? (
          <p className="order-subdialog-hint"><Loader2 size={16} className="spin-icon" /> Cargando…</p>
        ) : notas.length === 0 ? (
          <p className="order-subdialog-hint">Esta venta no requiere nota de crédito: no hay reembolsos sobre una {documento} que hayas subido.</p>
        ) : (
          <>
            <div className="order-receipt-data">
              <div className="order-receipt-data-head"><strong>Datos para emitirla en el SII</strong></div>
              <dl className="order-receipt-fields">
                <div><dt>Comprador</dt><dd>{buyerName}</dd></div>
                <div><dt>Anula</dt><dd>{factura ? 'Factura electrónica' : 'Boleta electrónica'}{order?.boletaVentaNombre ? ` · ${order.boletaVentaNombre}` : ''}</dd></div>
                {factura && <>
                  <div><dt>RUT</dt><dd>{order?.facturaRut || 'No informado'}</dd></div>
                  <div><dt>Razón social</dt><dd>{order?.facturaRazonSocial || 'No informado'}</dd></div>
                  <div><dt>Giro</dt><dd>{order?.facturaGiro || 'No informado'}</dd></div>
                </>}
              </dl>
              {reembolsados.length > 0 && (
                <ul className="credit-note-items">
                  {reembolsados.map((item, index) => {
                    const qty = Number(item.cantidad ?? item.quantity ?? 1);
                    const refunded = Number(item.montoReembolsado ?? item.refundedAmount ?? 0);
                    const unit = Number(item.precioUnitario ?? item.precio ?? item.unitPrice ?? 0);
                    return (
                      <li key={item.id ?? index}>
                        <span>{item.nombre || item.productName || item.name || 'Repuesto'}{qty > 1 ? ` ×${qty}` : ''}</span>
                        <strong>{formatCLP(refunded > 0 ? refunded : unit * qty)}</strong>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {notas.map((nota) => (
              <NotaCard
                key={nota.pagoReembolsoId}
                orderId={order.id}
                nota={nota}
                abierta={seleccionada === nota.pagoReembolsoId}
                onToggle={() => setSeleccionada(seleccionada === nota.pagoReembolsoId ? null : nota.pagoReembolsoId)}
                onVer={() => setViendo(nota)}
                onGuardada={() => { setSeleccionada(null); recargar(); onChanged?.(); }}
              />
            ))}
          </>
        )}
      </div>
    </div>
    {/* Fuera del velo: los clics del visor no deben cerrar este popup. */}
    {viendo && <VerNotaModal orderId={order.id} orderCode={orderCode} nota={viendo} onClose={() => setViendo(null)} />}
    </>,
    document.body,
  );
}

function NotaCard({ orderId, nota, abierta, onToggle, onVer, onGuardada }) {
  const estado = ESTADO[nota.estado] || ESTADO.PENDIENTE;
  const propuesto = nota.montoPropuesto != null ? Math.round(nota.montoPropuesto) : null;
  const netoPropuesto = propuesto != null ? Math.round(propuesto / (1 + IVA)) : null;
  return (
    <section className="credit-note-card">
      <header>
        <div>
          <strong>Reembolso {formatCLP(nota.montoReembolso)}</strong>
          <small>{nota.origen}{nota.fechaReembolso ? ` · ${fechaVisible(nota.fechaReembolso)}` : ''}</small>
        </div>
        <em className={`credit-note-chip is-${estado.tone}`}>{estado.text}</em>
      </header>

      {nota.estado === 'REGISTRADA' ? (
        <>
          <p className="order-subdialog-hint">Folio {nota.folio} · {formatCLP(nota.monto)} · emitida el {fechaVisible(nota.fechaEmision)}</p>
          <button type="button" className="btn-auth-secondary credit-note-action" onClick={onVer}>
            <FileSearch size={16} /> Ver nota de crédito
          </button>
        </>
      ) : (
        <>
          <div className="credit-note-amount">
            <span>Monto a acreditar</span>
            <strong>{propuesto != null ? formatCLP(propuesto) : 'Lo reembolsado'}</strong>
          </div>
          {propuesto != null && <small className="order-subdialog-hint">Neto {formatCLP(netoPropuesto)} · IVA {formatCLP(propuesto - netoPropuesto)}</small>}
          <p className={`order-subdialog-hint${nota.vencida ? ' order-credit-note-warning' : ''}`}>
            {nota.vencida
              ? 'Pasaron los 6 meses: súbela igual como respaldo, pero ya no rebaja el IVA de la venta.'
              : `Emítela antes del ${fechaVisible(nota.venceEl)} para recuperar el IVA de la venta.`}
          </p>
          {nota.estado === 'RECHAZADA' && nota.motivoRechazo && (
            <p className="confirm-dialog-error">Motivo del rechazo: {nota.motivoRechazo}</p>
          )}
          {abierta ? (
            <SubirNotaForm orderId={orderId} nota={nota} onSaved={onGuardada} />
          ) : (
            <button type="button" className="btn-auth-secondary credit-note-action" onClick={onToggle}>
              <FileUp size={16} /> {nota.estado === 'RECHAZADA' ? 'Subir de nuevo' : 'Cargar nota de crédito'}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** `loadUrl` estable: el visor vuelve a pedir el documento cada vez que cambia. */
function VerNotaModal({ orderId, orderCode, nota, onClose }) {
  const loadUrl = useCallback(() => getSellerCreditNoteUrlApi(orderId, nota.notaId), [orderId, nota.notaId]);
  return (
    <PrivateDocumentViewerModal
      loadUrl={loadUrl}
      title="Nota de crédito"
      subtitle={`${orderCode ? `Pedido ${orderCode}` : 'Venta'} · folio ${nota.folio}`}
      fileName={`nota-credito-${String(nota.folio || 'venta').replace(/[^\w-]+/g, '')}.pdf`}
      onClose={onClose}
    />
  );
}

function SubirNotaForm({ orderId, nota, onSaved }) {
  const [folio, setFolio] = useState('');
  const [fecha, setFecha] = useState(hoyIso());
  const [monto, setMonto] = useState(nota.montoPropuesto != null ? String(Math.round(nota.montoPropuesto)) : '');
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const montoNumero = monto.trim() ? Number(monto) : null;
  const tope = nota.montoMaximo;
  const superaTope = montoNumero != null && tope != null && montoNumero > tope;
  const distinto = montoNumero != null && nota.montoReembolso != null
    && Math.round(montoNumero) !== Math.round(nota.montoReembolso);
  const neto = montoNumero != null && montoNumero > 0 ? Math.round(montoNumero / (1 + IVA)) : null;
  const listo = folio.trim() && fecha && fecha <= hoyIso() && montoNumero > 0 && !superaTope && archivo;

  const elegirArchivo = (event) => {
    const selected = event.target.files?.[0] || null;
    event.target.value = '';
    if (!selected) return;
    if (selected.type !== 'application/pdf' || !selected.name.toLowerCase().endsWith('.pdf')) {
      setError('La nota de crédito debe ser un archivo PDF.');
      return;
    }
    const invalido = validateUpload(selected, { maxBytes: FILE_LIMITS.DOCUMENT, label: 'La nota de crédito' });
    if (invalido) {
      setError(invalido);
      return;
    }
    setError('');
    setArchivo(selected);
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!listo || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await uploadSellerCreditNoteApi(orderId, {
        pagoReembolsoId: nota.pagoReembolsoId,
        folio: folio.trim(),
        fechaEmision: fecha,
        monto: montoNumero,
      }, archivo);
      onSaved();
    } catch (cause) {
      setError(cause?.message || 'No se pudo subir la nota de crédito.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="credit-note-form" onSubmit={guardar}>
      <label className="order-subdialog-field">
        <span>Folio *</span>
        <input type="text" inputMode="numeric" required placeholder="Número que asignó el SII"
          value={folio} onChange={(e) => setFolio(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label className="order-subdialog-field">
        <span>Fecha de emisión *</span>
        <input type="date" required max={hoyIso()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>
      <label className="order-subdialog-field">
        <span>Monto total (IVA incluido) *</span>
        <input type="text" inputMode="numeric" required value={monto}
          onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))} />
        {neto != null && <small className="order-subdialog-hint">Neto {formatCLP(neto)} · IVA {formatCLP(montoNumero - neto)}</small>}
      </label>
      {superaTope && <p className="confirm-dialog-error">No puede superar lo reembolsado ({formatCLP(tope)}).</p>}
      {distinto && !superaTope && (
        <p className="order-subdialog-hint order-credit-note-warning">El monto es distinto de lo reembolsado. Revisa que coincida con el PDF.</p>
      )}
      <div className="order-subdialog-field">
        <span>PDF de la nota de crédito *</span>
        <div className={`order-subdialog-filedrop${archivo ? ' is-filled' : ''}`}>
          <label>
            <FileUp size={20} />
            <span>{archivo ? archivo.name : 'Adjuntar PDF · máximo 10 MB'}</span>
            <input type="file" accept="application/pdf,.pdf" onChange={elegirArchivo} />
          </label>
          {archivo && (
            <button type="button" className="order-subdialog-fileclear" aria-label="Quitar archivo" title="Quitar archivo" onClick={() => setArchivo(null)}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      {error && <p className="confirm-dialog-error">{error}</p>}
      <button type="submit" className="btn-auth-primary credit-note-action" disabled={!listo || guardando}>
        {guardando && <Loader2 size={16} className="spin-icon" />}
        {guardando ? 'Guardando...' : 'Guardar nota de crédito'}
      </button>
    </form>
  );
}
