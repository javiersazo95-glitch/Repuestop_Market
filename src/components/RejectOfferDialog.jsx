import React, { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { OFFER_REJECT_MAX, OFFER_REJECT_OTHER, OFFER_REJECT_REASONS, resolveRejectReason } from '../utils/offerRejectReasons';

/**
 * Rechazar una oferta: popup con el motivo a elegir de una lista (opcional); con "Otro motivo" se escribe.
 * La tienda ve el motivo y puede mejorar su oferta y reenviarla.
 */
export default function RejectOfferDialog({ isOpen, storeName, isBusy = false, error = '', onConfirm, onCancel }) {
  const [choice, setChoice] = useState('');
  const [other, setOther] = useState('');

  useEffect(() => {
    if (!isOpen) { setChoice(''); setOther(''); }
  }, [isOpen]);

  const needsText = choice === OFFER_REJECT_OTHER;
  const missingText = needsText && !other.trim();

  return (
    <ConfirmDialog
      isOpen={isOpen}
      tone="danger"
      title="Rechazar oferta"
      message={`¿Rechazar la oferta de ${storeName || 'esta tienda'}? La tienda verá que la rechazaste y podrá mejorarla y reenviarla mientras el encargo siga abierto.`}
      confirmLabel="Sí, rechazar oferta"
      cancelLabel="No, volver"
      isBusy={isBusy}
      confirmDisabled={missingText}
      error={error}
      onConfirm={() => onConfirm(resolveRejectReason(choice, other))}
      onCancel={onCancel}
    >
      <label className="reject-dialog-field">
        <span>Motivo (opcional, la tienda lo verá)</span>
        <select value={choice} onChange={(event) => setChoice(event.target.value)}>
          <option value="">Elige un motivo</option>
          {OFFER_REJECT_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
        </select>
      </label>
      {needsText && (
        <label className="reject-dialog-field">
          <span>Cuéntale a la tienda *</span>
          <textarea rows={2} maxLength={OFFER_REJECT_MAX} value={other} onChange={(event) => setOther(event.target.value)} placeholder="Escribe el motivo" autoFocus />
        </label>
      )}
    </ConfirmDialog>
  );
}
