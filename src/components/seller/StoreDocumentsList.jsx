import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Briefcase, CheckCircle2, Clock, Eye, FilePen, FileText, Loader2, Receipt, ShieldCheck, ShieldAlert, Award, UserRound } from 'lucide-react';
import { getSellerVerificationStatusApi, getStoreDocumentUrlApi, getStoreDocumentsApi } from '../../services/api';

const ICONS = {
  REPRESENTANTE: UserRound,
  INICIO_ACTIVIDADES: Briefcase,
  PATENTE: Award,
  BOLETA_FACTURA: Receipt,
  CONTRATO_ADHESION: FilePen,
};

const STATUS_META = {
  PENDING: { label: 'En revisión', hint: 'Recibimos tus documentos. Te avisaremos cuando el equipo termine de revisarlos.', icon: Clock, tone: 'warn' },
  APPROVED: { label: 'Tienda verificada', hint: 'Tu documentación está aprobada. No necesitas hacer nada más.', icon: ShieldCheck, tone: 'ok' },
  REJECTED: { label: 'Rechazada', hint: 'La solicitud fue rechazada. Escríbenos desde Ayuda si quieres apelar.', icon: ShieldAlert, tone: 'bad' },
  NEEDS_CORRECTION: { label: 'Por corregir', hint: 'Falta corregir algo en tu documentación. Si tienes dudas, escríbenos desde Ayuda.', icon: AlertCircle, tone: 'warn' },
};

function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

/** «Verificación comercial» (como `SellerVerificationSummary.tsx`): el estado de la revisión de la tienda. */
export function SellerVerificationSummary({ sellerId, onStatus }) {
  const [state, setState] = useState({ loading: true, error: '', status: '' });
  useEffect(() => {
    if (!sellerId) return undefined;
    let active = true;
    getSellerVerificationStatusApi(sellerId)
      .then((data) => {
        if (!active) return;
        const status = data?.reviewStatus ? String(data.reviewStatus) : '';
        setState({ loading: false, error: '', status });
        onStatus?.(status);
      })
      .catch(() => { if (active) setState({ loading: false, error: 'No pudimos cargar tu verificación.', status: '' }); });
    return () => { active = false; };
  }, [sellerId, onStatus]);
  const meta = STATUS_META[state.status];
  const Icon = meta?.icon;
  return (
    <div className="sdl-verify">
      <div className="sdl-verify-head"><Award size={20} /> <strong>Verificación comercial</strong></div>
      {state.loading ? <Loader2 size={18} className="spin-icon" />
        : state.error ? <p className="sdl-error">{state.error}</p>
          : !meta ? <p className="sdl-muted">Aún no hay una solicitud de verificación registrada.</p>
            : (
              <div className={`sdl-status is-${meta.tone}`}>
                <Icon size={18} />
                <span><strong>{meta.label}</strong><small>{meta.hint}</small></span>
              </div>
            )}
    </div>
  );
}

/**
 * Todos los documentos cargados de la tienda, numerados en orden (`StoreDocumentsList.tsx` de la app): los del registro y,
 * al final, el contrato de adhesión firmado, cada uno con su vista previa. Lo que aún no existe se ve como pendiente.
 */
export default function StoreDocumentsList({ sellerId }) {
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState('');
  const [openingType, setOpeningType] = useState(null);
  const [previewError, setPreviewError] = useState('');

  const load = useCallback(async () => {
    if (!sellerId) return;
    setError('');
    try {
      setDocuments(await getStoreDocumentsApi(sellerId));
    } catch (err) {
      setError(err?.message || 'No pudimos cargar tus documentos.');
    }
  }, [sellerId]);
  useEffect(() => { load(); }, [load]);

  // El archivo es privado: el backend da un enlace de un solo uso que se abre en otra pestaña (visor de PDF o imagen
  // del navegador). La pestaña se abre antes de pedir el enlace para que el navegador no la bloquee.
  const preview = async (document) => {
    if (openingType) return;
    setOpeningType(document.tipo);
    setPreviewError('');
    const tab = window.open('', '_blank');
    try {
      const data = await getStoreDocumentUrlApi(sellerId, document.tipo);
      if (!data?.url) throw new Error('No se recibió un enlace para el documento.');
      if (tab) { tab.opener = null; tab.location.href = data.url; } else { window.location.assign(data.url); }
    } catch (err) {
      tab?.close();
      setPreviewError(err?.message || 'No pudimos abrir el documento. Inténtalo de nuevo.');
    } finally {
      setOpeningType(null);
    }
  };

  if (!sellerId) return null;
  if (error) {
    return (
      <div className="sdl-card sdl-pad">
        <p className="sdl-error">{error}</p>
        <button type="button" className="sdl-retry" onClick={load}>Reintentar</button>
      </div>
    );
  }
  if (!documents) return <div className="sdl-card sdl-pad sdl-center"><Loader2 size={20} className="spin-icon" /></div>;

  return (
    <>
      <div className="sdl-card" aria-label="Documentos cargados">
        {documents.map((document, index) => {
          const Icon = ICONS[document.tipo] || FileText;
          const date = formatDate(document.fecha);
          const isContract = document.tipo === 'CONTRATO_ADHESION';
          const meta = document.disponible
            ? [isContract ? (date ? `Firmado el ${date}` : 'Firmado') : (date ? `Enviado el ${date}` : 'Cargado'), document.detalle].filter(Boolean).join(' · ')
            : isContract ? 'Aún no lo firmas' : 'Sin cargar';
          return (
            <div key={document.tipo} className={`sdl-row ${document.disponible ? '' : 'is-pending'}`}>
              <span className="sdl-order">{index + 1}</span>
              <span className="sdl-icon"><Icon size={18} /></span>
              <span className="sdl-copy">
                <strong>{document.titulo}</strong>
                {document.descripcion && <small>{document.descripcion}</small>}
                <em>{document.disponible ? <CheckCircle2 size={13} /> : <Clock size={13} />} {meta}</em>
              </span>
              {document.disponible && (
                <button type="button" className="sdl-eye" onClick={() => preview(document)} disabled={Boolean(openingType)} aria-label={`Vista previa de ${document.titulo}`}>
                  {openingType === document.tipo ? <Loader2 size={18} className="spin-icon" /> : <Eye size={18} />}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {previewError && <p className="sdl-error" role="alert">{previewError}</p>}
    </>
  );
}
