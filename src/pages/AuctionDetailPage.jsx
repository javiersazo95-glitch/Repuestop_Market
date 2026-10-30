import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, CalendarDays, Car, ChevronRight, Clock, Gavel,
  Bookmark, BookmarkCheck, ChevronDown, Star, HelpCircle, Pencil, RotateCcw, XCircle, Home, ListTree, Lock, Maximize2, X, MapPin, Package, PackageCheck, ShieldCheck, ShoppingCart, Trophy,
} from 'lucide-react';
import { auctionTrackingCode, getAuctionDetail, setAuctionSaved } from '../services/auctionApi';
import { ROUTES, auctionDetailPath, helpCategoryPath, profileOrderPath, profilePurchasePath } from '../routes/paths';
import { resolveMediaUrl } from '../services/api';
import ContextualReportButton from '../components/ContextualReportButton';
import AuctionQuoteModal from '../components/AuctionQuoteModal';
import AuctionBuyerCard from '../components/AuctionBuyerCard';
import AuctionCommentsPanel from '../components/AuctionCommentsPanel';
import AuctionOffersModal from '../components/AuctionOffersModal';
import AuctionPurchaseModal from '../components/AuctionPurchaseModal';
import AuctionItemsCard from '../components/AuctionItemsCard';
import AuctionInfoTip from '../components/AuctionInfoTip';
import AuctionImageViewer from '../components/AuctionImageViewer';
import CreateAuctionModal from '../components/CreateAuctionModal';
import CancelAuctionDialog from '../components/CancelAuctionDialog';
import MobileStickyBar from '../components/MobileStickyBar';
import AuctionDetailMobile from '../components/AuctionDetailMobile';
import { useIsMobile } from '../hooks/useIsMobile';
import '../styles/auction-mobile.css';
import ShareLinkButton from '../components/ShareLinkButton';
import AuctionAvatar from '../components/AuctionAvatar';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import '../styles/auctions.css';
import '../styles/auction-social.css';
import '../styles/auction-detail.css';

const HOUR = 60 * 60 * 1000;

function formatCLP(value) {
  if (value == null) return '';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoStr;
  }
}

/** "1 día 04 h 23 min" / "04 h 23 min" / "23 min": mismo formato que el listado de subastas. */
function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} ${days === 1 ? 'día' : 'días'} ${String(hours).padStart(2, '0')} h ${String(minutes).padStart(2, '0')} min`;
  if (hours > 0) return `${String(hours).padStart(2, '0')} h ${String(minutes).padStart(2, '0')} min`;
  return `${minutes} min`;
}

function ratingText(rating) {
  return rating ? `Evaluación ${Number(rating).toFixed(1)} de 5` : 'Sin evaluaciones aún';
}

/** Avatar de la tienda; si tiene foto se puede tocar para verla en grande. */
function StoreAvatar({ quote, onViewPhoto }) {
  const avatar = <AuctionAvatar className="av-offer-avatar" src={quote.tiendaLogoUrl} name={quote.nombreTienda} isStore />;
  if (!quote.tiendaLogoUrl) return avatar;
  return (
    <button
      type="button"
      className="av-offer-avatar-btn"
      onClick={() => onViewPhoto(resolveMediaUrl(quote.tiendaLogoUrl), quote.nombreTienda)}
      aria-label={`Ver foto de ${quote.nombreTienda || 'la tienda'}`}
    >
      {avatar}
    </button>
  );
}

function QuoteMeta({ quote }) {
  return (
    <span className="av-offer-meta">
      <span><Star size={12} className={quote.tiendaRating ? 'is-rated' : ''} /> {ratingText(quote.tiendaRating)}</span>
      {quote.fechaEnvio && <span><CalendarDays size={12} /> Oferta enviada {formatDate(quote.fechaEnvio)}</span>}
    </span>
  );
}

function QuoteRow({ quote, index, onViewPhoto }) {
  if (quote.esPrivada) {
    return (
      <li className={`av-offer is-locked ${quote.aceptada ? 'is-accepted' : ''}`}>
        <span className="av-offer-rank">{index + 1}</span>
        <StoreAvatar quote={quote} onViewPhoto={onViewPhoto} />
        <div className="av-offer-info">
          <strong>{quote.nombreTienda || 'Tienda verificada'}</strong>
          <QuoteMeta quote={quote} />
          <small>{quote.aceptada ? <><Trophy size={11} /> Oferta aceptada</> : <><Lock size={11} /> Oferta confidencial</>}</small>
        </div>
      </li>
    );
  }

  const lineas = quote.lineas || [];
  const valid = lineas.filter((line) => line.vigente);
  const missing = quote.itemsFaltantes || [];
  return (
    <li className={`av-offer is-open ${quote.aceptada ? 'is-winner' : ''}`}>
      {quote.aceptada && <span className="av-offer-ribbon"><Trophy size={13} /> Oferta aceptada</span>}
      {!quote.aceptada && quote.estado === 'RECHAZADA' && <span className="av-offer-ribbon is-rejected">Oferta rechazada{quote.motivoRechazo ? `: ${quote.motivoRechazo}` : ''}</span>}
      <div className="av-offer-top">
        <StoreAvatar quote={quote} onViewPhoto={onViewPhoto} />
        <div className="av-offer-info">
          <strong>{quote.nombreTienda}</strong>
          <QuoteMeta quote={quote} />
        </div>
        <span className="av-offer-price">{formatCLP(valid.length ? valid.reduce((sum, line) => sum + Number(line.precioTotal || 0), 0) : (quote.precioFinal || quote.precio))}</span>
      </div>
      {lineas.length > 0 ? (
        <ul className="av-offer-lines">
          {lineas.map((line) => (
            <li key={line.itemId} className={line.vigente ? '' : 'is-void'}>
              <span>{line.repuesto} <small>× {line.cantidad}</small></span>
              <b>{formatCLP(line.precioTotal)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="av-offer-product">{quote.productoTitulo || 'Repuesto cotizado según requerimiento'}</p>
      )}
      {missing.length > 0 && <p className="av-offer-missing">Faltan en esta oferta: {missing.join(', ')}</p>}
      <small className="av-offer-terms">
        Garantía: <strong>{quote.garantia || 'Garantía legal'}</strong> · Plazo: <strong>{quote.tiempoEntrega || 'A coordinar'}</strong>
      </small>
      {quote.notas && <p className="av-offer-notes">“{quote.notas}”</p>}
    </li>
  );
}

export default function AuctionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isMobile = useIsMobile();

  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isOffersOpen, setIsOffersOpen] = useState(false);
  const [isAllOffersOpen, setIsAllOffersOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [storePhoto, setStorePhoto] = useState(null); // { url, name }
  const openStorePhoto = (url, name) => setStorePhoto({ url, name });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRepublishOpen, setIsRepublishOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [openFolds, setOpenFolds] = useState({ comments: true });
  const toggleFold = (key) => setOpenFolds((current) => ({ ...current, [key]: !current[key] }));
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);

  useDocumentTitle(auction?.repuestoSolicitado ? `${auction.repuestoSolicitado} · Búsqueda de repuestos` : 'Detalle de búsqueda de repuestos');

  const isSeller = String(user?.role || role || '').toUpperCase() === 'SELLER' || Boolean(user?.sellerId);
  const sellerId = user?.sellerId || user?.proveedorId;

  const flashSaveNotice = (text) => {
    setSaveNotice(text);
    setTimeout(() => setSaveNotice(''), 2600);
  };

  const toggleSaved = async () => {
    if (!user) { flashSaveNotice('Inicia sesión para guardar esta solicitud.'); return; }
    setSaveBusy(true);
    try {
      await setAuctionSaved(id, !saved);
      setSaved(!saved);
      flashSaveNotice(!saved ? 'Solicitud guardada. La verás en Seguimiento de propuestas.' : 'Solicitud quitada de guardadas.');
    } catch (err) {
      flashSaveNotice(err?.message || 'No pudimos guardar la solicitud.');
    } finally {
      setSaveBusy(false);
    }
  };

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getAuctionDetail(id);
      setAuction(detail);
      setSaved(Boolean(detail?.guardada));
    } catch (err) {
      console.error('Error cargando detalle subasta:', err);
      setError(err?.message || 'No pudimos cargar los detalles de esta búsqueda de repuestos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  // Cuenta regresiva en vivo.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !auction) {
    return (
      <main className="av-page">
        <div className="container av-shell"><div className="as-card av-state"><p className="as-muted">Cargando información de la búsqueda de repuestos…</p></div></div>
      </main>
    );
  }

  if (error || !auction) {
    return (
      <main className="av-page">
        <div className="container av-shell">
          <div className="as-card av-state">
            <span className="av-state-icon"><AlertCircle size={30} /></span>
            <h1>Búsqueda de repuestos no disponible</h1>
            <p className="as-muted">{error || 'La búsqueda de repuestos no existe o fue retirada.'}</p>
            <button type="button" className="as-btn-primary" style={{ maxWidth: 220 }} onClick={() => navigate(ROUTES.auctions)}>
              Volver a Búsqueda de repuestos
            </button>
          </div>
        </div>
      </main>
    );
  }

  const {
    patenteAnonimizada, marca, modelo, anio, version, motor, chasis, repuestoSolicitado, cantidad,
    tiempoMaximoEnvio, tipoEnvio, presupuestoMaximo, region, comuna, estado, fechaLimite,
    createdAt, categoria, pedidoId, fotos = [], cotizaciones = [], esCreador, miCotizacion, items = [], itemsPendientes = 0,
  } = auction;

  const remainingMs = new Date(fechaLimite).getTime() - now;
  const isFinalizada = estado === 'FINALIZADA';
  const isExpirada = estado === 'EXPIRADA' || estado === 'CANCELADA' || (!isFinalizada && remainingMs <= 0);
  const isOpen = !isFinalizada && !isExpirada;
  const isUrgent = isOpen && remainingMs < HOUR;
  const statusKey = isFinalizada || isExpirada ? 'finalizada' : isUrgent ? 'por-finalizar' : 'activa';
  const statusLabel = isFinalizada ? 'Finalizada' : estado === 'CANCELADA' ? 'Cancelada' : isExpirada ? 'Expirada' : isUrgent ? 'Por finalizar' : 'Activa';

  const photos = fotos.map((url) => resolveMediaUrl(url));
  const currentPhoto = photos[activePhotoIndex] || null;
  const location = [comuna, region].filter(Boolean).join(', ');
  const canQuote = isSeller && !esCreador && isOpen && itemsPendientes > 0 && !miCotizacion?.aceptada;
  const acceptedCount = cotizaciones.filter((quote) => quote.aceptada).length;
  // Vencio o se cancelo sin aceptar ninguna oferta: ya no se edita, pero se vuelve a publicar con los mismos datos.
  const canRepublish = Boolean(esCreador) && isExpirada && acceptedCount === 0;
  // Se cancela mientras siga abierta y sin ofertas aceptadas (el backend lo vuelve a validar).
  const canCancel = Boolean(esCreador) && isOpen && acceptedCount === 0;
  const pendingOffersCount = cotizaciones.filter((quote) => !quote.aceptada && quote.estado === 'ENVIADA').length;
  const totalUnits = items.reduce((sum, item) => sum + item.cantidad, 0) || cantidad;

  return (
    <main className="av-page">
      {isMobile ? (
        <AuctionDetailMobile
          auction={auction}
          now={now}
          isSeller={isSeller}
          canQuote={canQuote}
          acceptedCount={acceptedCount}
          isOpen={isOpen}
          isFinalizada={isFinalizada}
          isLoggedIn={Boolean(user)}
          onBack={() => navigate(ROUTES.auctions)}
          onOffer={() => setIsQuoteModalOpen(true)}
          onCompare={() => setIsOffersOpen(true)}
          onOpenPurchase={() => setIsPurchaseOpen(true)}
          saved={saved}
          saveBusy={saveBusy}
          saveNotice={saveNotice}
          onToggleSaved={toggleSaved}
          onEdit={() => (auction.editable === false
            ? flashSaveNotice(auction.motivoNoEditable || 'Esta búsqueda de repuestos ya no se puede editar.')
            : setIsEditOpen(true))}
          canRepublish={canRepublish}
          onRepublish={() => setIsRepublishOpen(true)}
          canCancel={canCancel}
          onCancel={() => setIsCancelOpen(true)}
        />
      ) : (
      <div className="container av-shell">
        <nav className="av-breadcrumb" aria-label="Ruta de navegación">
          <Link to={ROUTES.home} aria-label="Inicio"><Home size={16} /></Link>
          <ChevronRight size={14} />
          <Link to={ROUTES.auctions}>Subastas</Link>
          <ChevronRight size={14} />
          <span aria-current="page">Detalle de búsqueda de repuestos</span>
        </nav>

        <div className="av-layout">
          <div className="av-main">
            <div className="av-panel">
              <div className="as-card av-gallery">
                <div className="av-gallery-main">
                  {currentPhoto ? <img src={currentPhoto} alt={repuestoSolicitado} /> : <Package size={56} />}
                  {currentPhoto && (
                    <button type="button" className="av-view-image" onClick={() => setViewerOpen(true)} aria-label="Ver imagen en grande">
                      <Maximize2 size={15} /> Ver imagen
                    </button>
                  )}
                </div>
                <div className="av-gallery-track" onScroll={(event) => {
                  const track = event.currentTarget;
                  const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
                  if (index !== activePhotoIndex && index >= 0 && index < photos.length) setActivePhotoIndex(index);
                }}>
                  {photos.length === 0 ? <span className="av-gallery-empty"><Package size={44} /></span> : photos.map((url, index) => (
                    <button key={url} type="button" className="av-gallery-slide" onClick={() => { setActivePhotoIndex(index); setViewerOpen(true); }} aria-label={`Ver foto ${index + 1} en grande`}>
                      <img src={url} alt={index === 0 ? repuestoSolicitado : ''} loading={index === 0 ? 'eager' : 'lazy'} />
                    </button>
                  ))}
                  {photos.length > 1 && <span className="av-gallery-counter" aria-hidden="true">{activePhotoIndex + 1} / {photos.length}</span>}
                </div>
                {photos.length > 1 && (
                  <div className="av-gallery-thumbs">
                    {photos.map((url, index) => (
                      <button
                        key={url}
                        type="button"
                        className={index === activePhotoIndex ? 'active' : ''}
                        onClick={() => setActivePhotoIndex(index)}
                        aria-label={`Ver foto ${index + 1}`}
                      >
                        <img src={url} alt="" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="av-how-mini">
                  <HelpCircle size={18} />
                  <p><strong>¿Cómo funcionan las búsquedas de repuestos?</strong> Las tiendas ofertan en privado, el comprador elige y paga por la plataforma.</p>
                  <AuctionInfoTip label="Cómo funciona una búsqueda de repuestos" align="right">
                    <ol className="av-how-steps">
                      <li><b>El comprador publica su pedido.</b> Indica la patente, los repuestos, su tope de presupuesto y el plazo.</li>
                      <li><b>Las tiendas ofertan en privado.</b> Las casas de repuestos verificadas ofrecen lo que tienen; pueden cubrir solo una parte.</li>
                      <li><b>El comprador compara y acepta.</b> Puede elegir una o varias ofertas; lo que quede pendiente sigue abierto para otras tiendas.</li>
                      <li><b>Paga una sola vez.</b> El pago se hace en la plataforma y el dinero queda retenido.</li>
                      <li><b>Cada tienda despacha su parte.</b> Al recibir conforme el repuesto, se libera el pago a la tienda.</li>
                    </ol>
                    <Link to={helpCategoryPath('necesidades')} className="av-how-link">Ver guía rápida <ArrowRight size={14} /></Link>
                  </AuctionInfoTip>
                </div>
              </div>

              <div className="av-content">
                <div className="as-card av-top-info">
                  <div className="av-top-meta">
                    <span className={`av-badge is-${statusKey}`}>{statusLabel}</span>
                    {estado === 'CANCELADA' && auction.motivoCancelacion && (
                      <span className="av-cancel-reason"><XCircle size={14} aria-hidden="true" /> Cancelada por el comprador: {auction.motivoCancelacion}</span>
                    )}
                    {isOpen && (
                      <span className={`av-meta-time ${isUrgent ? 'is-urgent' : ''}`}>
                        <Clock size={24} />
                        <span><small>Tiempo restante</small><strong>{formatRemaining(remainingMs)}</strong></span>
                      </span>
                    )}
                    {createdAt && (
                      <span className="av-meta-item"><CalendarDays size={22} /><span><small>Publicado</small><strong>{formatDate(createdAt)}</strong></span></span>
                    )}
                    <span className="av-meta-item"><MapPin size={22} /><strong>{location || 'Ubicación no indicada'}</strong></span>
                  </div>

                  <div className="av-title-row">
                    <h1>{repuestoSolicitado}</h1>
                    <div className="av-title-side">
                      {canQuote && (
                        <button type="button" className="av-send-offer-btn" onClick={() => setIsQuoteModalOpen(true)}>
                          {miCotizacion ? <Pencil size={16} /> : <Gavel size={16} />} {miCotizacion ? 'Modificar oferta' : 'Enviar oferta'}
                        </button>
                      )}
                      <p className="av-code">Código: <strong>{auctionTrackingCode(auction.id)}</strong></p>
                    </div>
                    <div className="av-title-actions">
                      <ShareLinkButton
                        className="av-action-btn"
                        url={`/subastas/${auction.id}`}
                        title={`${repuestoSolicitado} · Solicitud de compra en RepuesTop`}
                        text="Mira esta solicitud de compra en RepuesTop"
                        label="Compartir"
                        iconSize={15}
                        stopPropagation={false}
                      />
                      {canCancel && (
                        <button type="button" className="av-action-btn av-cancel-btn" onClick={() => setIsCancelOpen(true)}>
                          <XCircle size={15} /> Cancelar
                        </button>
                      )}
                      {canRepublish && (
                        <button type="button" className="av-action-btn av-edit-btn" onClick={() => setIsRepublishOpen(true)}>
                          <RotateCcw size={15} /> Publicar de nuevo
                        </button>
                      )}
                      {esCreador && !canRepublish && (
                        <button
                          type="button"
                          className={`av-action-btn av-edit-btn ${auction.editable === false ? 'is-locked' : ''}`}
                          aria-disabled={auction.editable === false}
                          onClick={() => (auction.editable === false
                            ? flashSaveNotice(auction.motivoNoEditable || 'Esta búsqueda de repuestos ya no se puede editar.')
                            : setIsEditOpen(true))}
                        >
                          {auction.editable === false ? <Lock size={15} /> : <Pencil size={15} />} Editar
                        </button>
                      )}
                      <button type="button" className={`av-action-btn ${saved ? 'is-saved' : ''}`} onClick={toggleSaved} disabled={saveBusy} aria-pressed={saved}>
                        {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />} {saved ? 'Guardada' : 'Guardar'}
                      </button>
                      {!esCreador && <ContextualReportButton tipoObjeto="NECESIDAD_COMPRA" objetoId={auction.id} objetoTitulo={repuestoSolicitado} className="av-action-btn" />}
                    </div>
                  </div>
                  {saveNotice && <p className="av-save-notice" role="status">{saveNotice}</p>}

                  <div className="av-chips">
                    {categoria && <span>Categoría: <strong>{categoria}</strong></span>}
                    <span>{items.length > 1 ? 'Repuestos' : 'Cantidad'}: <strong>{items.length > 1 ? `${items.length} (${totalUnits} unidades)` : `${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'}`}</strong></span>
                    <span>Plazo máx. de envío: <strong>{tiempoMaximoEnvio || 'A coordinar'}</strong></span>
                    <span>Tipo de envío: <strong>{tipoEnvio || 'Cualquiera'}</strong></span>
                    <span className="is-budget">Presupuesto tope: <strong>{presupuestoMaximo ? formatCLP(presupuestoMaximo) : 'Sin tope'}</strong></span>
                  </div>
                </div>

                <div className="av-two">
                  <AuctionItemsCard
                    items={items}
                    isOpen={isOpen}
                    canOffer={canQuote}
                    onOffer={() => setIsQuoteModalOpen(true)}
                    vehicle={{ label: [marca, modelo, anio].filter(Boolean).join(' '), chasis, plate: patenteAnonimizada }}
                  />

                  <div className="as-card av-block">
                    <h2 className="as-title"><span><Car size={17} /> Detalles del vehículo</span></h2>
                    <dl className="av-details">
                      {[
                        ['Marca', marca], ['Modelo', modelo], ['Versión', version], ['Año', anio], ['Motor', motor],
                        ['Patente', patenteAnonimizada], ['Chasis / VIN', chasis],
                      ].filter(([, value]) => value).map(([label, value]) => (
                        <div key={label}><dt>{label}</dt><dd className={label === 'Patente' || label === 'Chasis / VIN' ? 'is-mono' : ''}>{value}</dd></div>
                      ))}
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className={`av-fold av-fold-comments ${openFolds.comments ? 'is-open' : ''}`}>
              <button type="button" className="av-fold-toggle" onClick={() => toggleFold('comments')} aria-expanded={Boolean(openFolds.comments)} aria-label="Mostrar u ocultar los comentarios"><ChevronDown size={18} /></button>
              <AuctionCommentsPanel auctionId={auction.id} isOpen={isOpen} canComment={isSeller || esCreador} isCreator={Boolean(esCreador)} />
            </div>
          </div>

          <aside className="av-side">
            <div className={`av-fold av-fold-buyer ${openFolds.buyer ? 'is-open' : ''}`}>
              <button type="button" className="av-fold-toggle" onClick={() => toggleFold('buyer')} aria-expanded={Boolean(openFolds.buyer)} aria-label="Mostrar u ocultar los datos del comprador"><ChevronDown size={18} /></button>
              <AuctionBuyerCard auctionId={auction.id} vehicle={[marca, modelo].filter(Boolean).join(' ')} region={region} />
            </div>

            <section className="as-card av-offers" aria-label="Ofertas recibidas">
              <header className="av-offers-banner">
                <span className="av-offers-count" aria-hidden="true">{cotizaciones.length}</span>
                <div className="av-offers-banner-text">
                  <h2>{cotizaciones.length === 1 ? 'Oferta recibida' : 'Ofertas recibidas'}</h2>
                  <small>
                    {cotizaciones.length === 0
                      ? 'Las casas de repuestos ya fueron notificadas'
                      : `${cotizaciones.length === 1 ? 'Una tienda verificada ya cotizó' : 'Tiendas verificadas ya cotizaron'} esta búsqueda`}
                  </small>
                </div>
                {canQuote && (
                  <button
                    type="button"
                    className="av-offers-expand is-edit"
                    onClick={() => setIsQuoteModalOpen(true)}
                    aria-label={miCotizacion ? 'Modificar mi oferta' : 'Enviar oferta'}
                    title={miCotizacion ? 'Modificar mi oferta' : 'Enviar oferta'}
                  >
                    {miCotizacion ? <Pencil size={16} /> : <Gavel size={16} />}
                  </button>
                )}
                {cotizaciones.length > 1 && (
                  <button type="button" className="av-offers-expand" onClick={() => setIsAllOffersOpen(true)} aria-label="Ver todas las solicitudes de oferta" title="Ver todas las ofertas">
                    <ListTree size={16} />
                  </button>
                )}
                {cotizaciones.length > 0 && (
                  <span className="av-offers-stack" aria-hidden="true">
                    {cotizaciones.slice(0, 4).map((quote) => (
                      <AuctionAvatar key={quote.id} className="av-offers-stack-avatar" src={quote.tiendaLogoUrl} name={quote.nombreTienda} isStore />
                    ))}
                  </span>
                )}
              </header>

              {cotizaciones.length === 0 ? (
                <div className="av-offers-empty">
                  <Gavel size={30} />
                  <strong>{isSeller && !esCreador ? 'Sé la primera tienda en ofertar' : 'Aún no hay ofertas'}</strong>
                  <p>{isSeller && !esCreador ? 'Quien cotiza primero tiene más posibilidades de ser elegido.' : 'Te avisaremos apenas llegue la primera.'}</p>
                </div>
              ) : (
                <>
                  <p className="av-offers-note">
                    <ShieldCheck size={15} />
                    {esCreador ? 'Compáralas y elige la que más te convenga.' : 'Los precios y condiciones son confidenciales: solo los ve el comprador y la tienda que ofertó.'}
                  </p>
                  <ul className="av-offer-list">
                    {cotizaciones.map((quote, index) => (
                      <QuoteRow
                        key={quote.id}
                        quote={quote}
                        index={index}
                        onViewPhoto={openStorePhoto}
                      />
                    ))}
                  </ul>
                </>
              )}

              {esCreador && isOpen && cotizaciones.length > 0 && (
                <button type="button" className="as-btn-primary av-offers-compare" onClick={() => setIsOffersOpen(true)}>
                  <Gavel size={16} /> Comparar y aceptar ofertas
                </button>
              )}

              {esCreador && acceptedCount > 0 && (
                <div className="av-offers-cta">
                  <span className="av-offers-cta-icon"><PackageCheck size={22} /></span>
                  <p>
                    <strong>{pedidoId && isFinalizada ? 'Pedido pagado' : `Tu pedido: ${acceptedCount} ${acceptedCount === 1 ? 'tienda' : 'tiendas'}`}</strong>
                    <small>
                      {itemsPendientes > 0
                        ? `Te faltan ${itemsPendientes} ${itemsPendientes === 1 ? 'repuesto' : 'repuestos'} por adjudicar. Puedes pagar lo aceptado ahora.`
                        : 'Ya adjudicaste todos tus repuestos. Revisa la composición y paga.'}
                    </small>
                  </p>
                  <button type="button" className="as-btn-primary" onClick={() => setIsPurchaseOpen(true)}>
                    <ShoppingCart size={15} /> Ver mi pedido y pagar
                  </button>
                  {pedidoId && (
                    <button
                      type="button"
                      className="as-btn-outline"
                      onClick={() => navigate(String(user?.role || role || '').toUpperCase() === 'SELLER' ? profilePurchasePath(pedidoId) : profileOrderPath(pedidoId))}
                    >
                      <PackageCheck size={15} /> Seguir compra
                    </button>
                  )}
                </div>
              )}

              {isSeller && !esCreador && miCotizacion?.aceptada && (
                <div className="av-offers-cta">
                  <span className="av-offers-cta-icon"><Trophy size={22} /></span>
                  <p><strong>El comprador aceptó tu oferta</strong><small>Recibirás el pedido cuando el comprador pague.</small></p>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
      )}

      {!isMobile && (canQuote || (esCreador && isOpen && (cotizaciones.length > 0 || acceptedCount > 0))) && (
        <MobileStickyBar label={isOpen ? 'Tiempo restante' : 'Búsqueda'} value={isOpen ? formatRemaining(remainingMs) : statusLabel} hint={`${cotizaciones.length} ${cotizaciones.length === 1 ? 'oferta' : 'ofertas'}`} ariaLabel="Acciones de la búsqueda de repuestos">
          {canQuote && (
            <button type="button" className="mobile-sticky-bar__btn" onClick={() => setIsQuoteModalOpen(true)}>
              {miCotizacion ? <Pencil size={17} /> : <Gavel size={17} />} {miCotizacion ? 'Modificar oferta' : 'Enviar oferta'}
            </button>
          )}
          {esCreador && acceptedCount > 0 && (
            <button type="button" className="mobile-sticky-bar__btn" onClick={() => setIsPurchaseOpen(true)}>
              <ShoppingCart size={17} /> Ver mi pedido y pagar
            </button>
          )}
          {esCreador && acceptedCount === 0 && cotizaciones.length > 0 && (
            <button type="button" className="mobile-sticky-bar__btn" onClick={() => setIsOffersOpen(true)}>
              <Gavel size={17} /> Comparar ofertas
            </button>
          )}
        </MobileStickyBar>
      )}

      {esCreador && isEditOpen && (
        <CreateAuctionModal isOpen auction={auction} onClose={() => setIsEditOpen(false)} onSuccess={() => { setIsEditOpen(false); loadDetail(); }} />
      )}
      {canCancel && isCancelOpen && (
        <CancelAuctionDialog
          auction={auction}
          pendingOffers={pendingOffersCount}
          onClose={() => setIsCancelOpen(false)}
          onEdit={() => { setIsCancelOpen(false); setIsEditOpen(true); }}
          onCancelled={() => { setIsCancelOpen(false); loadDetail(); }}
        />
      )}
      {canRepublish && isRepublishOpen && (
        <CreateAuctionModal
          isOpen
          template={auction}
          onClose={() => setIsRepublishOpen(false)}
          onSuccess={(created) => { setIsRepublishOpen(false); if (created?.id) navigate(auctionDetailPath(created.id)); }}
        />
      )}

      {storePhoto && (
        <AuctionImageViewer photos={[storePhoto.url]} title={storePhoto.name} onClose={() => setStorePhoto(null)} className="is-top" />
      )}

      {viewerOpen && photos.length > 0 && (
        <AuctionImageViewer photos={photos} startIndex={activePhotoIndex} title={repuestoSolicitado} onClose={() => setViewerOpen(false)} />
      )}

      {isAllOffersOpen && (
        <div className="aim-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAllOffersOpen(false); }}>
          <div className="aim-modal" role="dialog" aria-modal="true" aria-label="Ofertas recibidas">
            <header className="aim-head">
              <span className="aim-head-icon"><Gavel size={18} /></span>
              <div>
                <h2>Ofertas recibidas</h2>
                <small>{cotizaciones.length} {cotizaciones.length === 1 ? 'oferta' : 'ofertas'} · {esCreador ? 'compáralas y elige la mejor' : 'precios y condiciones confidenciales'}</small>
              </div>
              <button type="button" className="aim-close" onClick={() => setIsAllOffersOpen(false)} aria-label="Cerrar"><X size={18} /></button>
            </header>
            <ul className="av-offer-list av-offer-list-modal">
              {cotizaciones.map((quote, index) => <QuoteRow key={quote.id} quote={quote} index={index} onViewPhoto={openStorePhoto} />)}
            </ul>
          </div>
        </div>
      )}

      {esCreador && (
        <AuctionOffersModal
          isOpen={isOffersOpen}
          auctionId={auction.id}
          onClose={() => setIsOffersOpen(false)}
          onChanged={loadDetail}
          onOpenPurchase={() => setIsPurchaseOpen(true)}
        />
      )}

      {esCreador && (
        <AuctionPurchaseModal
          isOpen={isPurchaseOpen}
          auctionId={auction.id}
          onClose={() => setIsPurchaseOpen(false)}
          onSeeOffers={() => setIsOffersOpen(true)}
        />
      )}

      {isSeller && (
        <AuctionQuoteModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          auction={auction}
          myQuote={miCotizacion}
          sellerId={sellerId}
          onSuccess={loadDetail}
        />
      )}
    </main>
  );
}
