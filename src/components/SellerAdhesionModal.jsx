import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileSignature, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSellerBlocked } from '../hooks/useSellerBlocked';
import { acceptSellerAdhesionApi, getSellerAdhesionPreviewApi, getSellerVerificationStatusApi } from '../services/api';
import { qk } from '../services/queryKeys';

const SELLER_ROLES = ['SELLER', 'PROVIDER', 'PROVEEDOR'];

/**
 * Contrato de adhesión del vendedor: aparece solo, apenas la tienda queda aprobada.
 *
 * Es la paridad de lo que hace la app en `mobile/app/(seller)/_layout.tsx`, donde el modal
 * salta al entrar al área de vendedor. En la web el contrato vivía únicamente dentro de
 * `SellerVerificationCard` (Perfil -> Mi Tienda), o sea que había que ir a buscarlo: una
 * tienda recién aprobada podía operar sin haberlo firmado nunca.
 *
 * Lo decide el BACKEND, no la sesión. La app se apoya en `adhesionAccepted`/`isOpen` del
 * login, pero en la web eso no sirve: `AuthProvider` revalida con `GET /users/perfil` en
 * cada carga y pisa el usuario entero con un `PerfilUsuarioDTO` que no trae esos campos,
 * así que se perderían igual que se perdía la comuna del comprador. La fuente de verdad es
 * `GET /proveedores/{id}/verificacion`: `reviewStatus === 'APPROVED'` (equivale al `isOpen`
 * del móvil) y `adhesionContractDoc` vacío (equivale a `adhesionAccepted === false`).
 *
 * No tiene botón de cerrar, igual que el del móvil y que `TermsReacceptanceModal`: la
 * salida es cerrar sesión. Y el documento es el PDF real que emite el backend, no una copia
 * del texto, así que lo que se lee es exactamente lo que queda firmado.
 */
export default function SellerAdhesionModal() {
  const { user, role, isLoggedIn, logout } = useAuth();
  const { isBlocked } = useSellerBlocked();
  const queryClient = useQueryClient();

  const sellerId = SELLER_ROLES.includes(role) ? (user?.sellerId || user?.proveedorId || null) : null;
  // Una tienda bloqueada no puede operar igual, y el backend le responde 403 a casi todo:
  // taparle la pantalla con un contrato sería ruido sobre un problema mayor.
  const consultar = Boolean(isLoggedIn && sellerId && !isBlocked);

  const { data: verificacion } = useQuery({
    queryKey: qk.sellerVerification(sellerId),
    queryFn: ({ signal }) => getSellerVerificationStatusApi(sellerId, { signal }),
    enabled: consultar,
    staleTime: 5 * 60 * 1000,
    // Si no se puede saber, no se bloquea: el contrato se sigue pudiendo firmar desde
    // Perfil -> Mi Tienda.
    retry: false,
  });

  const pendiente = Boolean(
    consultar
    && verificacion?.reviewStatus === 'APPROVED'
    && !verificacion?.adhesionContractDoc,
  );

  const [pdfUrl, setPdfUrl] = useState('');
  const [aceptado, setAceptado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // El PDF se pide con el token (fetchApi), así que no sirve un `<object data>` apuntando
  // al backend: se trae como Blob y se muestra por objectURL, igual que en
  // SellerVerificationCard. Se revoca al desmontar para no dejarlo colgando.
  useEffect(() => {
    if (!pendiente || !sellerId) return undefined;
    let cancelado = false;
    let objectUrl = '';
    getSellerAdhesionPreviewApi(sellerId)
      .then((blob) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelado) setError(err?.message || 'No pudimos abrir el contrato. Recarga la página.');
      });
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pendiente, sellerId]);

  if (!pendiente) return null;

  const firmar = async () => {
    setEnviando(true);
    setError('');
    try {
      const actualizada = await acceptSellerAdhesionApi(sellerId);
      // Deja el estado nuevo en la cache: el aviso se desmonta solo y la tarjeta del perfil
      // no queda mostrando "Pendiente de aceptación".
      queryClient.setQueryData(qk.sellerVerification(sellerId), actualizada);
      queryClient.invalidateQueries({ queryKey: qk.sellerVerification(sellerId) });
    } catch (err) {
      setError(err?.message || 'No pudimos registrar tu aceptación. Intenta nuevamente.');
      setEnviando(false);
    }
  };

  return (
    <div className="order-modal-backdrop adhesion-modal-backdrop" role="presentation">
      <div className="order-modal-container legal-doc-modal" role="dialog" aria-modal="true" aria-labelledby="adhesion-modal-title">
        <div className="order-modal-header">
          <div className="order-modal-title-group">
            <div className="order-modal-icon-badge"><FileSignature size={20} /></div>
            <div className="order-subdialog-heading">
              <h2 id="adhesion-modal-title">Contrato de Adhesión</h2>
              <span className="order-modal-subtitle">
                Tu tienda quedó aprobada. Firma el contrato para empezar a vender en RepuesTop.
              </span>
            </div>
          </div>
        </div>

        {pdfUrl ? (
          <object className="legal-doc-viewer" data={pdfUrl} type="application/pdf" aria-label="Contrato de adhesión">
            {/* Un navegador sin visor de PDF integrado no renderiza el <object>: se ofrece
                abrirlo aparte en vez de dejar un recuadro en blanco. */}
            <p className="legal-doc-fallback">
              Tu navegador no puede mostrar el PDF aquí.{' '}
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">Ábrelo en una pestaña nueva</a>.
            </p>
          </object>
        ) : (
          <p className="legal-doc-fallback">
            <Loader2 size={16} className="spin-icon" /> Cargando el contrato…
          </p>
        )}

        {error && <p className="confirm-dialog-error"><AlertTriangle size={15} /> {error}</p>}

        <label className="terms-checkbox-box">
          <input type="checkbox" checked={aceptado} onChange={(event) => setAceptado(event.target.checked)} />
          <span>Acepto firmar electrónicamente el Contrato de Adhesión del Vendedor.</span>
        </label>

        <div className="legal-doc-actions">
          <button type="button" className="btn-auth-secondary" onClick={logout} disabled={enviando}>
            Cerrar sesión
          </button>
          <button
            type="button"
            className="btn-auth-primary"
            onClick={firmar}
            disabled={!aceptado || enviando || !pdfUrl}
          >
            {enviando && <Loader2 size={16} className="spin-icon" />}
            {enviando ? 'Registrando…' : 'Aceptar y continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}
