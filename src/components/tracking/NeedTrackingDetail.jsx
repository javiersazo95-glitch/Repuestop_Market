import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { availabilityLabel } from '../../utils/availability';
import { ChevronRight, CircleHelp, Loader2, Tags, XCircle } from 'lucide-react';
import { getAuctionComments, getAuctionDetail, postAuctionComment, rejectAuctionOffer } from '../../services/auctionApi';
import ConfirmDialog from '../ConfirmDialog';
import AuctionAvatar from '../AuctionAvatar';
import StoreProfileLink, { commentStoreId } from '../StoreProfileLink';
import OfferFullDetail, { quoteStatus } from './OfferFullDetail';
import { TrackingCells, TrackingItem, TrackingSection, TrackingTag } from './TrackingDetail';

const formatCLP = (value) => (value == null || Number.isNaN(Number(value)) ? '—' : `$${Math.round(Number(value)).toLocaleString('es-CL')}`);
const formatWhen = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * Detalle de una búsqueda propia (`NeedTrackingDetail.tsx` de la app): las ofertas que llegaron, la más reciente primero y
 * con las nuevas marcadas, para revisarlas o rechazarlas, y las preguntas de las casas de repuestos para responderlas ahí.
 */
export default function NeedTrackingDetail({ auctionId, newOffers, onChanged }) {
  const [auction, setAuction] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [replies, setReplies] = useState({});
  const [rejecting, setRejecting] = useState(null);
  const [actionError, setActionError] = useState('');
  // Oferta abierta a pantalla completa para compararla y aceptarla o rechazarla.
  const [openQuote, setOpenQuote] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [detail, list] = await Promise.all([getAuctionDetail(auctionId), getAuctionComments(auctionId).catch(() => [])]);
      setAuction(detail);
      setComments(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || 'No pudimos cargar el detalle.');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);
  useEffect(() => { load(); }, [load]);

  const quotes = useMemo(
    () => [...(auction?.cotizaciones ?? [])].sort((a, b) => new Date(b.fechaEnvio).getTime() - new Date(a.fechaEnvio).getTime()),
    [auction],
  );
  const pendingQuestions = useMemo(
    () => comments.filter((comment) => comment.respondeAId == null && comment.autorEsTienda && !comments.some((reply) => reply.respondeAId === comment.id)),
    [comments],
  );

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    setActionError('');
    try {
      const updated = await rejectAuctionOffer(auctionId, rejecting.id);
      if (updated?.cotizaciones) setAuction(updated); else await load();
      setRejecting(null);
      onChanged?.();
    } catch (err) {
      setActionError(err?.message || 'No pudimos rechazar la oferta.');
    } finally {
      setBusyId(null);
    }
  };

  const answer = async (question) => {
    const text = (replies[question.id] ?? '').trim();
    if (!text) return;
    setBusyId(question.id);
    setActionError('');
    try {
      const created = await postAuctionComment(auctionId, text, question.id);
      setComments((current) => [...current, created]);
      setReplies((current) => ({ ...current, [question.id]: '' }));
      onChanged?.();
    } catch (err) {
      setActionError(err?.message || 'No pudimos enviar tu respuesta.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="trk-muted"><Loader2 size={16} className="spin-icon" /> Cargando…</div>;
  if (error || !auction) return <p className="trk-error" role="alert">{error || 'No pudimos cargar el detalle.'}</p>;

  const open = auction.estado === 'ACTIVA';

  return (
    <>
      <TrackingSection icon={Tags} title="Ofertas recibidas" count={quotes.length}>
        {quotes.length === 0 ? <p className="trk-muted">Aún no llegan ofertas.</p> : quotes.map((quote, index) => {
          const state = quoteStatus(auction, quote);
          const isNew = index < newOffers;
          return (
            <TrackingItem key={quote.id} highlight={isNew}>
              <div className="trk-head">
                <StoreProfileLink storeId={quote.proveedorId} name={quote.nombreTienda}><AuctionAvatar className="trk-store-avatar" src={quote.tiendaLogoUrl} name={quote.nombreTienda} isStore storeId={quote.proveedorId} /></StoreProfileLink>
                <StoreProfileLink storeId={quote.proveedorId} name={quote.nombreTienda} className="trk-head-name"><strong>{quote.nombreTienda}</strong></StoreProfileLink>
                {isNew && <TrackingTag label="Nueva" tone="info" />}
                <TrackingTag label={state.label} tone={state.tone} />
              </div>
              <TrackingCells cells={[
                { label: 'Total', value: quote.esPrivada ? 'Confidencial' : formatCLP(quote.precioFinal || quote.precio), tone: 'primary' },
                { label: 'Disponible', value: availabilityLabel(quote.disponibilidadDias) || '—' },
                { label: 'Plazo', value: quote.tiempoEntrega || '—' },
                { label: 'Llegó', value: formatWhen(quote.fechaEnvio) },
              ]} />
              <div className="trk-actions">
                {state.actionable
                  ? <button type="button" className="trk-link is-danger" disabled={busyId != null} onClick={() => { setActionError(''); setRejecting(quote); }} aria-label={`Rechazar la oferta de ${quote.nombreTienda}`}><XCircle size={15} /> Rechazar</button>
                  : <span />}
                <button type="button" className="trk-link" onClick={() => setOpenQuote(quote)} aria-label={`Ver la oferta de ${quote.nombreTienda}`}>Ver oferta <ChevronRight size={15} /></button>
              </div>
            </TrackingItem>
          );
        })}
      </TrackingSection>

      {pendingQuestions.length > 0 && (
        <TrackingSection icon={CircleHelp} title="Preguntas por responder" count={pendingQuestions.length}>
          {pendingQuestions.map((question) => (
            <TrackingItem key={question.id} highlight>
              <div className="trk-head"><StoreProfileLink storeId={commentStoreId(question, auction.cotizaciones)} name={question.autor}><AuctionAvatar className="trk-store-avatar" src={question.autorFotoUrl} name={question.autor} isStore storeId={commentStoreId(question, auction.cotizaciones)} /></StoreProfileLink><StoreProfileLink storeId={commentStoreId(question, auction.cotizaciones)} name={question.autor} className="trk-head-name"><strong>{question.autor}</strong></StoreProfileLink><time>{formatWhen(question.createdAt)}</time></div>
              <p>{question.texto}</p>
              {open && (
                <div className="trk-reply">
                  <textarea placeholder="Escribe tu respuesta" value={replies[question.id] ?? ''} maxLength={500} onChange={(event) => setReplies((current) => ({ ...current, [question.id]: event.target.value }))} />
                  <button type="button" disabled={busyId != null || !(replies[question.id] ?? '').trim()} onClick={() => answer(question)}>{busyId === question.id ? 'Enviando…' : 'Responder'}</button>
                </div>
              )}
            </TrackingItem>
          ))}
        </TrackingSection>
      )}
      {actionError && <p className="trk-error" role="alert">{actionError}</p>}

      {openQuote && (
        <OfferFullDetail
          auction={auction}
          quote={auction.cotizaciones?.find((item) => item.id === openQuote.id) || openQuote}
          onClose={() => setOpenQuote(null)}
          onChanged={(updated) => { if (updated?.cotizaciones) setAuction(updated); else load(); onChanged?.(); }}
        />
      )}
      <ConfirmDialog
        isOpen={Boolean(rejecting)}
        title="Rechazar oferta"
        message={rejecting ? `¿Rechazar la oferta de ${rejecting.nombreTienda}? La tienda verá que la rechazaste.` : ''}
        confirmLabel="Rechazar"
        isBusy={busyId != null}
        error={actionError}
        onConfirm={reject}
        onCancel={() => setRejecting(null)}
      />
    </>
  );
}
