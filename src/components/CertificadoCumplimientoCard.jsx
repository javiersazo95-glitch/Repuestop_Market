import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileText, Loader2, UploadCloud } from 'lucide-react';
import { getSellerCertificadoCumplimientoApi, uploadSellerCertificadoCumplimientoApi } from '../services/api';

function fechaCorta(iso) {
  const [anio, mes, dia] = String(iso || '').slice(0, 10).split('-');
  return dia ? `${dia}/${mes}/${anio}` : '';
}

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Certificado de cumplimiento tributario del semestre (Res. SII 168 de 2025: la plataforma lo
 * verifica en enero y julio). La tienda lo descarga desde su sitio en sii.cl y lo sube aca; queda
 * en revision del equipo SIN volver la tienda a revision: sigue vendiendo.
 *
 * Paridad con `mobile/components/seller/CertificadoCumplimientoCard.tsx`.
 */
export default function CertificadoCumplimientoCard({ sellerId }) {
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const load = useCallback(async (signal) => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setEstado(await getSellerCertificadoCumplimientoApi(sellerId, { signal }));
    } catch {
      if (!signal?.aborted) setEstado(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const subir = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Sube el PDF que descargas desde sii.cl.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('El certificado no puede superar 10 MB.');
      return;
    }
    setSubiendo(true);
    try {
      setEstado(await uploadSellerCertificadoCumplimientoApi(sellerId, file));
    } catch (err) {
      setError(err?.message || 'No pudimos subir el certificado.');
    } finally {
      setSubiendo(false);
    }
  };

  if (loading) {
    return (
      <div className="details-card-block store-section-card">
        <p className="verification-loading"><Loader2 size={16} className="spin-icon" /> Cargando tu certificado…</p>
      </div>
    );
  }
  if (!estado) return null;

  const ultimo = estado.ultimo;
  const enRevision = ultimo?.estado === 'PENDIENTE' && ultimo.semestre === estado.semestreActual;
  const rechazado = ultimo?.estado === 'RECHAZADO';
  const meta = estado.alDia
    ? { Icon: CheckCircle2, color: '#15803d', titulo: `Al día · semestre ${estado.semestreActual}`,
        texto: 'Tu certificado de cumplimiento está revisado para este semestre. No necesitas hacer nada hasta la próxima revisión de enero o julio.' }
    : enRevision
      ? { Icon: Clock, color: '#b45309', titulo: 'En revisión',
          texto: `Recibimos tu certificado el ${fechaCorta(ultimo.subidoAt)}. Te avisaremos cuando lo revisemos.` }
      : rechazado
        ? { Icon: AlertTriangle, color: '#b91c1c', titulo: 'Sube un certificado nuevo',
            texto: `No pudimos validar el anterior: ${ultimo?.motivoRechazo || 'revisa el archivo'}.` }
        : { Icon: FileText, color: '#b45309', titulo: 'Sube tu certificado actualizado',
            texto: `El SII nos pide verificar en enero y julio que cada tienda esté al día. Descarga tu certificado de cumplimiento desde tu sitio personal en sii.cl y súbelo aquí${estado.mesDeReverificacion ? ` antes del ${fechaCorta(estado.plazoHasta)}` : ''}. No afecta tus ventas.` };
  const { Icon } = meta;

  return (
    <div className="details-card-block store-section-card">
      <div className="details-card-header-row">
        <h3 className="section-subtitle">
          <span className="section-subtitle-icon"><FileText size={16} /></span>
          <span>Certificado de cumplimiento tributario</span>
        </h3>
      </div>
      <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: meta.color, fontWeight: 600, margin: '4px 0' }}>
        <Icon size={16} /> {meta.titulo}
      </p>
      <p style={{ color: '#64748b', margin: '0 0 12px' }}>{meta.texto}</p>
      {(estado.debeSubir || rechazado) && (
        <>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" hidden onChange={subir} />
          <button type="button" className="btn-auth-primary" disabled={subiendo} onClick={() => inputRef.current?.click()}>
            {subiendo ? <Loader2 size={16} className="spin-icon" /> : <UploadCloud size={16} />}
            {subiendo ? ' Subiendo…' : ' Subir certificado (PDF)'}
          </button>
        </>
      )}
      {error && <p className="confirm-dialog-error"><AlertTriangle size={15} /> {error}</p>}
    </div>
  );
}
