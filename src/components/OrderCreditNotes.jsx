import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCheck, FileSearch, FileUp, FileX, Loader2, X } from 'lucide-react';
import { getSellerCreditNotesApi, getSellerCreditNoteUrlApi, uploadSellerCreditNoteApi } from '../services/api';
import { validateUpload, FILE_LIMITS } from '../utils/fileValidation';
import PrivateDocumentViewerModal from './PrivateDocumentViewerModal';

/** IVA de la nota: el monto es el total, IVA incluido. */
const IVA = 0.19;

const ESTADO = {
  PENDIENTE: 'Nota de crédito pendiente',
  RECHAZADA: 'Nota de crédito rechazada',
  REGISTRADA: 'Nota de crédito registrada',
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

/**
 * Nota de credito de la tienda, en el detalle de su venta (9-oct). Si la venta se reembolso y la
 * tienda ya habia subido su boleta, la anula con una nota de credito emitida en el SII y la sube
 * aqui. Queda registrada al instante; si el equipo la rechaza, aqui se ve el motivo.
 * Paridad con la app (components/orders/OrderCreditNotes.tsx).
 */
export default function OrderCreditNotes({ orderId, orderCode }) {
  const [notas, setNotas] = useState([]);
  const [subiendo, setSubiendo] = useState(null);
  const [viendo, setViendo] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const data = await getSellerCreditNotesApi(orderId);
      setNotas(Array.isArray(data) ? data : []);
    } catch {
      // Sin notas visibles la venta sigue funcionando; el aviso diario le recuerda la nota.
      setNotas([]);
    }
  }, [orderId]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!notas.length) return null;

  return (
    <>
      {notas.map((nota) => {
        const registrada = nota.estado === 'REGISTRADA';
        const rechazada = nota.estado === 'RECHAZADA';
        return (
          <div key={nota.pagoReembolsoId}
            className={`order-store-doc order-boleta-row ${registrada ? 'is-ready' : 'is-pending'}`}>
            <span className="order-store-doc-icon">
              {registrada ? <FileCheck size={15} /> : <FileX size={15} />}
            </span>
            <span className="order-store-doc-text is-multiline">
              <strong>{ESTADO[nota.estado] || ESTADO.PENDIENTE}</strong>
              <small>
                {registrada
                  ? `Folio ${nota.folio} · ${formatCLP(nota.monto)} · emitida el ${fechaVisible(nota.fechaEmision)}`
                  : nota.vencida
                    ? `Reembolso ${formatCLP(nota.montoReembolso)} (${nota.origen}). Pasaron los 6 meses: súbela igual como respaldo, ya no rebaja el IVA.`
                    : `Reembolso ${formatCLP(nota.montoReembolso)} (${nota.origen}). Emítela en el SII por ${formatCLP(nota.montoPropuesto ?? nota.montoReembolso)} antes del ${fechaVisible(nota.venceEl)} para recuperar el IVA.`}
              </small>
              {rechazada && nota.motivoRechazo && (
                <small className="order-credit-note-reject">Motivo del rechazo: {nota.motivoRechazo}</small>
              )}
            </span>
            {registrada ? (
              <button type="button" className="order-store-doc-action" onClick={() => setViendo(nota)}
                aria-label="Ver la nota de crédito">
                <FileSearch size={14} />
                Ver
              </button>
            ) : (
              <button type="button" className="order-store-doc-action is-cta" onClick={() => setSubiendo(nota)}>
                <FileUp size={14} />
                {rechazada ? 'Subir de nuevo' : 'Subir'}
              </button>
            )}
          </div>
        );
      })}

      {subiendo && (
        <SubirNotaModal
          orderId={orderId}
          orderCode={orderCode}
          nota={subiendo}
          onClose={() => setSubiendo(null)}
          onSaved={() => { setSubiendo(null); cargar(); }}
        />
      )}

      {viendo && (
        <VerNotaModal orderId={orderId} orderCode={orderCode} nota={viendo} onClose={() => setViendo(null)} />
      )}
    </>
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

function SubirNotaModal({ orderId, orderCode, nota, onClose, onSaved }) {
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

  return createPortal(
    <div className="commission-modal-backdrop order-subdialog-backdrop" onClick={() => !guardando && onClose()}>
      <form className="commission-modal-card order-subdialog-card" onSubmit={guardar} onClick={(e) => e.stopPropagation()}>
        <div className="commission-modal-header">
          <div className="commission-icon-badge">
            <FileUp size={22} />
          </div>
          <div className="order-subdialog-heading">
            <h3>Subir nota de crédito</h3>
            <span>{orderCode ? `Pedido ${orderCode} · ` : ''}Reembolso {formatCLP(nota.montoReembolso)}</span>
          </div>
        </div>

        <p className="order-subdialog-hint">
          Los datos de la nota de crédito electrónica que emitiste en el SII para anular tu boleta.
        </p>

        {error && <p className="confirm-dialog-error">{error}</p>}

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
          {neto != null && (
            <small className="order-subdialog-hint">Neto {formatCLP(neto)} · IVA {formatCLP(montoNumero - neto)}</small>
          )}
        </label>
        {superaTope && (
          <p className="confirm-dialog-error">No puede superar lo reembolsado ({formatCLP(tope)}).</p>
        )}
        {distinto && !superaTope && (
          <p className="order-subdialog-hint order-credit-note-warning">
            El monto es distinto de lo reembolsado. Revisa que coincida con el PDF.
          </p>
        )}

        <div className="order-subdialog-field">
          <span>PDF de la nota de crédito *</span>
          <div className="order-subdialog-filedrop">
            <label>
              <FileUp size={20} />
              <span>{archivo ? archivo.name : 'Adjuntar PDF'}</span>
              <input type="file" accept="application/pdf,.pdf" onChange={elegirArchivo} />
            </label>
            {archivo && (
              <button type="button" className="order-subdialog-fileclear" aria-label="Quitar archivo"
                title="Quitar archivo" onClick={() => setArchivo(null)}>
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="confirm-dialog-actions">
          <button type="button" className="btn-auth-secondary" onClick={onClose} disabled={guardando}>
            Volver
          </button>
          <button type="submit" className="btn-auth-primary" disabled={!listo || guardando}>
            {guardando && <Loader2 size={16} className="spin-icon" />}
            {guardando ? 'Guardando...' : 'Guardar nota'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
