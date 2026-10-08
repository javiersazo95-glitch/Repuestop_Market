import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, ReceiptText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSellerBlocked } from '../hooks/useSellerBlocked';
import { declareSellerIvaApi, getSellerVerificationStatusApi } from '../services/api';
import { qk } from '../services/queryKeys';
import { DECLARACION_IVA_TEXTO } from '../data/legalTexts';

const SELLER_ROLES = ['SELLER', 'PROVIDER', 'PROVEEDOR'];

/**
 * Declaracion de contribuyente de IVA para las tiendas ya aprobadas que no la hicieron al enviar
 * sus documentos (pendiente A de la revision contable, 2026-10-09). Sin esta constancia, el IVA de
 * las ventas de la tienda lo paga RepuesTop (art. 3° bis LIVS, Circular SII 39 de 2025).
 *
 * Paridad con `mobile/components/seller/declaracion-iva-prompt.tsx`. Usa la misma consulta que
 * `SellerAdhesionModal` (`GET /proveedores/{id}/verificacion`) y aparece despues del contrato,
 * nunca encima de el. El servidor guarda la fecha, la IP y la version del texto.
 */
export default function DeclaracionIvaPrompt() {
  const { user, role, isLoggedIn } = useAuth();
  const { isBlocked } = useSellerBlocked();
  const queryClient = useQueryClient();

  const sellerId = SELLER_ROLES.includes(role) ? (user?.sellerId || user?.proveedorId || null) : null;
  const consultar = Boolean(isLoggedIn && sellerId && !isBlocked);

  const { data: verificacion } = useQuery({
    queryKey: qk.sellerVerification(sellerId),
    queryFn: ({ signal }) => getSellerVerificationStatusApi(sellerId, { signal }),
    enabled: consultar,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const pendiente = Boolean(
    consultar
    && (verificacion?.tiendaAprobada ?? verificacion?.reviewStatus === 'APPROVED')
    && verificacion?.adhesionContractDoc
    && !verificacion?.declaracionIvaAt,
  );

  const [declara, setDeclara] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  if (!pendiente) return null;

  const declarar = async () => {
    setEnviando(true);
    setError('');
    try {
      const actualizada = await declareSellerIvaApi(sellerId);
      if (actualizada) queryClient.setQueryData(qk.sellerVerification(sellerId), actualizada);
      queryClient.invalidateQueries({ queryKey: qk.sellerVerification(sellerId) });
    } catch (err) {
      setError(err?.message || 'No pudimos guardar tu declaración. Intenta nuevamente.');
      setEnviando(false);
    }
  };

  return (
    <div className="order-modal-backdrop adhesion-modal-backdrop" role="presentation">
      <div className="order-modal-container" role="dialog" aria-modal="true" aria-labelledby="declaracion-iva-title">
        <div className="order-modal-header">
          <div className="order-modal-title-group">
            <div className="order-modal-icon-badge"><ReceiptText size={20} /></div>
            <div className="order-subdialog-heading">
              <h2 id="declaracion-iva-title">Declaración de IVA</h2>
              <span className="order-modal-subtitle">
                El SII exige que cada tienda informe a la plataforma si es contribuyente de IVA. Necesitamos tu
                declaración para que sigas vendiendo en RepuesTop.
              </span>
            </div>
          </div>
        </div>

        {error && <p className="confirm-dialog-error"><AlertTriangle size={15} /> {error}</p>}

        <label className="terms-checkbox-box">
          <input type="checkbox" checked={declara} onChange={(event) => setDeclara(event.target.checked)} />
          <span>{DECLARACION_IVA_TEXTO}</span>
        </label>

        <div className="legal-doc-actions">
          <button type="button" className="btn-auth-primary" onClick={declarar} disabled={!declara || enviando}>
            {enviando && <Loader2 size={16} className="spin-icon" />}
            {enviando ? 'Registrando…' : 'Declarar y continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}
