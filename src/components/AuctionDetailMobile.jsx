import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { helpCategoryPath } from '../routes/paths';
import {
  ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Bus, CalendarDays, Car, ChevronRight, Clock, Gavel, Info, ListChecks, Lock, MapPin,
  Hash, MessageCircle, Package, PackageCheck, Pencil, RotateCcw, Send, XCircle, ShoppingCart, Star, Tag, Trophy, User, Wallet, X,
} from 'lucide-react';
import { auctionTrackingCode, getAuctionBuyerProfile, getAuctionComments, postAuctionComment } from '../services/auctionApi';
import { resolveMediaUrl } from '../services/api';
import AuctionAvatar from './AuctionAvatar';
import AuctionImageViewer from './AuctionImageViewer';
import ShareLinkButton from './ShareLinkButton';
import '../styles/auction-app-mobile.css';

const HOUR = 60 * 60 * 1000;

const PROCESS_STEPS = [
  { title: 'Publicación', Icon: Pencil, text: 'El comprador detalla el vehículo, los repuestos que necesita, el plazo de envío y un presupuesto sugerido (solo referencial).' },
  { title: 'Ofertas privadas', Icon: Lock, text: 'Las casas de repuestos verificadas reciben el aviso y envían su oferta mientras la búsqueda está activa. Cada tienda ve solo la suya.' },
  { title: 'Elección de la oferta', Icon: ListChecks, text: 'Al cerrar el plazo, el comprador compara las ofertas y elige la que más le conviene: precio, garantía, despacho y reputación.' },
  { title: 'Pago seguro', Icon: Wallet, text: 'El comprador paga la oferta ganadora por la plataforma y la tienda es notificada para preparar el pedido.' },
  { title: 'Entrega y calificación', Icon: Package, text: 'La tienda despacha o entrega el repuesto. Luego ambas partes pueden calificarse, lo que construye la confianza de la comunidad.' },
];

function formatCLP(value) {
  if (value == null) return '';
  return `$${new Intl.NumberFormat('es-CL').format(value)}`;
}

function formatPublished(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatMemberSince(iso) {
  return new Date(iso).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
}

function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return days > 0 ? `${days} ${days === 1 ? 'día' : 'días'} ${pad(hours)} h` : `${pad(hours)} h ${pad(minutes)} min`;
}

/** Patente semi censurada: "ABCD11" -> "AB**11". */
function maskPlate(plate) {
  const clean = String(plate || '').replace(/[-\s·]/g, '').toUpperCase();
  if (!clean) return '';
  if (clean.includes('*') || clean.length < 5) return clean;
  return `${clean.slice(0, 2)}${'*'.repeat(clean.length - 4)}${clean.slice(-2)}`;
}

const itemVehicle = (item) => [item.marca, item.modelo, item.anio].filter(Boolean).join(' ');

/** Ventana centrada con fondo oscuro, como los paneles de la app. */
function CenterModal({ title, Icon, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [onClose]);

  return (
    <div className="am-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="am-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="am-modal-head">
          <span className="am-modal-title"><Icon size={20} /> {title}</span>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={22} /></button>
        </header>
        <div className="am-modal-body">{children}</div>
        {footer}
      </div>
    </div>
  );
}

function FactCell({ Icon, label, accent, action, children }) {
  return (
    <div className="am-fact">
      <div className="am-fact-head">
        <Icon size={16} className={accent ? 'is-accent' : ''} />
        <span>{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function VehicleRow({ label, value, full }) {
  return (
    <div className={`am-vrow ${full ? 'is-full' : ''}`}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

/**
 * Detalle de la búsqueda de repuestos para el celular: idéntico al de la app (resumen con fotos y estado,
 * datos separados por líneas, perfil del comprador y ofertas, repuestos, vehículo, comentarios y paneles
 * centrados de desglose, ofertas y explicación del proceso / presupuesto).
 */
export default function AuctionDetailMobile({
  auction,
  now,
  isSeller,
  canQuote,
  acceptedCount,
  isOpen,
  isFinalizada,
  isLoggedIn,
  onBack,
  onOffer,
  onCompare,
  onOpenPurchase,
  saved,
  saveBusy,
  saveNotice,
  onToggleSaved,
  onEdit,
  canRepublish = false,
  onRepublish,
  canCancel = false,
  onCancel,
}) {
  const [profile, setProfile] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  // Visor a pantalla completa: fotos de la búsqueda o la foto de una tienda que ofertó.
  const [viewer, setViewer] = useState(null); // { photos, index, title }
  const [modal, setModal] = useState(null); // 'breakdown' | 'offers' | 'budget' | 'process'
  const [budgetNoteOpen, setBudgetNoteOpen] = useState(false);

  const {
    id, patenteAnonimizada, patente, marca, modelo, anio, version, motor, chasis, repuestoSolicitado, cantidad,
    tiempoMaximoEnvio, tipoEnvio, presupuestoMaximo, region, comuna, estado, fechaLimite, createdAt, categoria,
    fotos = [], cotizaciones = [], esCreador, miCotizacion, items = [],
  } = auction;

  useEffect(() => {
    let active = true;
    getAuctionBuyerProfile(id).then((data) => { if (active) setProfile(data); }).catch(() => {});
    getAuctionComments(id).then((data) => { if (active) setComments(Array.isArray(data) ? data : []); }).catch(() => {});
    return () => { active = false; };
  }, [id]);

  const remainingMs = new Date(fechaLimite).getTime() - now;
  const isClosed = !isOpen;
  const isUrgent = isOpen && remainingMs < HOUR;
  const statusLabel = estado === 'FINALIZADA' ? 'Finalizada' : estado === 'CANCELADA' ? 'Cancelada' : isClosed ? 'Expirada' : isUrgent ? 'Por finalizar' : 'Activa';
  const tone = isClosed ? 'closed' : isUrgent ? 'warn' : 'info';

  const photos = fotos.map((url) => resolveMediaUrl(url));
  const location = [comuna, region].filter(Boolean).join(', ');
  const itemsList = items.length
    ? items
    : [{ repuesto: repuestoSolicitado, categoria, cantidad: cantidad || 1, pendiente: !isFinalizada }];
  const totalUnits = itemsList.reduce((sum, item) => sum + (item.cantidad || 0), 0);
  const mainVehicle = { marca, modelo, anio, version, patente: maskPlate(patenteAnonimizada || patente) };
  const vehicleKey = (v) => [v.marca, v.modelo, v.anio, v.version].map((part) => String(part ?? '').trim().toLowerCase()).join('|');
  const groups = [];
  itemsList.forEach((item) => {
    const own = Boolean(item.marca || item.modelo);
    const vehicle = own
      ? { marca: item.marca, modelo: item.modelo, anio: item.anio, version: item.version, patente: maskPlate(item.patenteAnonimizada || item.patente) }
      : mainVehicle;
    const key = vehicleKey(vehicle);
    const found = groups.find((group) => group.key === key);
    if (found) found.items.push(item); else groups.push({ key, vehicle, items: [item] });
  });
  const mainKey = vehicleKey(mainVehicle);
  groups.sort((a, b) => Number(b.key === mainKey) - Number(a.key === mainKey));
  const sortedQuotes = [...cotizaciones].sort((a, b) => new Date(a.fechaEnvio).getTime() - new Date(b.fechaEnvio).getTime());

  const submitComment = async (event) => {
    event.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    if (!isLoggedIn) { setCommentError('Inicia sesión para comentar.'); return; }
    setPosting(true);
    setCommentError('');
    try {
      const created = await postAuctionComment(id, text);
      setComments((current) => [...current, created]);
      setCommentText('');
    } catch (err) {
      setCommentError(err?.message || 'No pudimos publicar tu comentario.');
    } finally {
      setPosting(false);
    }
  };

  const close = () => setModal(null);

  return (
    <main className="am-page am-detail">
      <button type="button" className="am-back" onClick={onBack}><ArrowLeft size={16} /> Volver a búsquedas</button>
      <div className="am-title-row">
        <h1>Detalle de búsqueda de repuestos</h1>
        <button type="button" className="am-info-btn" onClick={() => setModal('process')} aria-label="Qué es una búsqueda de repuestos y sus etapas">
          <Info size={22} />
        </button>
      </div>

      {/* Editar (solo el comprador), compartir y guardar */}
      <div className="am-actions" role="group" aria-label="Acciones de la búsqueda">
        {canCancel && (
          <button type="button" className="am-action is-danger" onClick={onCancel}>
            <XCircle size={16} /> Cancelar
          </button>
        )}
        {canRepublish && (
          <button type="button" className="am-action" onClick={onRepublish}>
            <RotateCcw size={16} /> Publicar de nuevo
          </button>
        )}
        {esCreador && !canRepublish && (
          <button type="button" className={`am-action ${auction.editable === false ? 'is-locked' : ''}`} onClick={onEdit} aria-disabled={auction.editable === false}>
            {auction.editable === false ? <Lock size={16} /> : <Pencil size={16} />} Editar
          </button>
        )}
        <ShareLinkButton
          className="am-action"
          url={`/subastas/${id}`}
          title={`${repuestoSolicitado} · Solicitud de compra en RepuesTop`}
          text="Mira esta solicitud de compra en RepuesTop"
          label="Compartir"
          iconSize={16}
          stopPropagation={false}
        />
        <button type="button" className={`am-action ${saved ? 'is-saved' : ''}`} onClick={onToggleSaved} disabled={saveBusy} aria-pressed={saved}>
          {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {saved ? 'Guardada' : 'Guardar'}
        </button>
      </div>
      {saveNotice && <p className="am-save-notice" role="status">{saveNotice}</p>}

      {/* Resumen */}
      <section className="am-card am-summary">
        <div className="am-summary-top">
          {photos[photoIndex] ? (
            <button type="button" className="am-summary-photo is-zoomable" onClick={() => setViewer({ photos, index: photoIndex, title: repuestoSolicitado })} aria-label="Ampliar foto">
              <img src={photos[photoIndex]} alt={repuestoSolicitado} />
            </button>
          ) : (
            <div className="am-summary-photo"><Package size={34} /></div>
          )}
          <div className="am-summary-info">
            <div className="am-pills">
              <span className={`am-pill is-${tone}`}>{statusLabel}</span>
              {estado === 'CANCELADA' && auction.motivoCancelacion && <span className="am-pill is-closed"><XCircle size={14} /> {auction.motivoCancelacion}</span>}
              {isOpen && <span className={`am-pill is-${tone}`}><Clock size={14} /> {formatRemaining(remainingMs)}</span>}
            </div>
            <h2>{repuestoSolicitado}</h2>
            <p className="am-meta am-tracking"><Hash size={14} /><span>Código: <strong>{auctionTrackingCode(id)}</strong></span></p>
            {createdAt && <p className="am-meta"><CalendarDays size={14} /><span>Publicado {formatPublished(createdAt)}</span></p>}
            {location && <p className="am-meta"><MapPin size={14} /><span>{location}</span></p>}
          </div>
        </div>
        {photos.length > 1 && (
          <div className="am-photos">
            {photos.map((url, index) => (
              <button key={url} type="button" className={index === photoIndex ? 'is-active' : ''} onClick={() => setPhotoIndex(index)} aria-label={`Ver foto ${index + 1}`}>
                <img src={url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        <hr className="am-divider" />
        <div className="am-columns">
          <div className="am-column">
            <FactCell Icon={Tag} label="Categoría"><strong>{categoria || itemsList.find((item) => item.categoria)?.categoria || '—'}</strong></FactCell>
            <hr className="am-divider" />
            <FactCell Icon={Package} label="Repuestos"><strong>{itemsList.length} ({totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'})</strong></FactCell>
            <hr className="am-divider" />
            <FactCell Icon={Bus} label="Plazo máx. de envío"><strong>{tiempoMaximoEnvio || 'A convenir'}</strong></FactCell>
          </div>
          <span className="am-vline" />
          <div className="am-column">
            <FactCell Icon={Send} label="Tipo de envío" accent><strong>{tipoEnvio || 'A convenir'}</strong></FactCell>
            <hr className="am-divider" />
            <FactCell
              Icon={Wallet}
              label="Presupuesto sugerido"
              accent
              action={<button type="button" className="am-i" onClick={() => setModal('budget')} aria-label="Información sobre el presupuesto sugerido"><Info size={20} /></button>}
            >
              <strong className={presupuestoMaximo ? 'am-budget' : ''}>{presupuestoMaximo ? formatCLP(presupuestoMaximo) : 'No definido'}</strong>
            </FactCell>
          </div>
        </div>
      </section>

      {/* Perfil del comprador y ofertas */}
      <div className="am-pair">
        <section className="am-card am-pair-card">
          <div className="am-pair-head">
            <span className="am-pair-icon">
              {profile?.fotoUrl ? <img src={resolveMediaUrl(profile.fotoUrl)} alt="" /> : <User size={14} />}
            </span>
            <strong>Perfil comprador</strong>
          </div>
          <span className="am-pair-name">{profile?.nombre || 'Comprador'}</span>
          {profile?.miembroDesde && <small>Miembro desde {formatMemberSince(profile.miembroDesde)}</small>}
          <hr className="am-divider" />
          <span className="am-rating">
            <Star size={15} className={profile?.totalCalificaciones ? 'is-on' : ''} />
            {profile?.totalCalificaciones && profile.calificacionPromedio != null
              ? `${Number(profile.calificacionPromedio).toFixed(1)} · ${profile.totalCalificaciones} ${profile.totalCalificaciones === 1 ? 'calificación' : 'calificaciones'}`
              : 'Sin calificaciones aún'}
          </span>
        </section>
        <button type="button" className="am-card am-pair-card am-offers-card" onClick={() => setModal('offers')} aria-label="Ver ofertas recibidas">
          <div className="am-pair-head">
            <span className="am-pair-icon"><Gavel size={14} /></span>
            <strong>Ofertas recibidas</strong>
          </div>
          <div className="am-offers-center">
            <span className="am-offers-count">{cotizaciones.length}</span>
            <span className="am-offers-see">Ver ofertas <ChevronRight size={15} /></span>
          </div>
        </button>
      </div>

      {/* Repuestos solicitados */}
      <section className="am-card">
        <h3 className="am-section-title"><Package size={20} /> Repuestos solicitados</h3>
        <small className="am-muted">{itemsList.length} {itemsList.length === 1 ? 'repuesto' : 'repuestos'} · {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}</small>
        <hr className="am-divider" />
        {itemsList.slice(0, 3).map((item, index) => {
          const done = item.pendiente === false;
          return (
            <div key={item.id ?? index} className="am-item">
              <span className="am-item-n">{index + 1}</span>
              <div className="am-item-text">
                <strong>{item.repuesto} <small>× {item.cantidad}</small></strong>
                {[item.categoria, itemVehicle(item)].some(Boolean) && <small>{[item.categoria, itemVehicle(item)].filter(Boolean).join(' · ')}</small>}
              </div>
              <span className={`am-pill ${done ? 'is-done' : 'is-info'}`}>
                {done ? <Trophy size={13} /> : <Clock size={13} />} {done ? 'Adjudicado' : 'Disponible'}
              </span>
            </div>
          );
        })}
        {itemsList.length > 3 && <small className="am-muted">y {itemsList.length - 3} más...</small>}
        <button type="button" className="am-link" onClick={() => setModal('breakdown')}>Ver desglose completo <ChevronRight size={16} /></button>
      </section>

      {/* Detalles del vehículo */}
      <section className="am-card">
        <h3 className="am-section-title"><Car size={20} /> Detalles del vehículo</h3>
        <hr className="am-divider" />
        <div className="am-columns">
          <div className="am-column">
            <VehicleRow label="Marca" value={marca} />
            <VehicleRow label="Modelo" value={modelo} />
            <VehicleRow label="Año" value={anio ? String(anio) : ''} />
          </div>
          <span className="am-vline" />
          <div className="am-column">
            <VehicleRow label="Motor" value={motor} />
            <VehicleRow label="Patente" value={maskPlate(patenteAnonimizada || patente)} />
            <VehicleRow label="Versión" value={version} />
          </div>
        </div>
        <hr className="am-divider" />
        <VehicleRow label="Chasis / VIN" value={chasis} full />
      </section>

      {/* Acciones */}
      {canQuote && (
        <button type="button" className="am-btn" onClick={onOffer}>
          {miCotizacion ? <Pencil size={18} /> : <Gavel size={18} />} {miCotizacion ? 'Modificar mi oferta' : 'Ofertar ahora'}
        </button>
      )}
      {esCreador && acceptedCount > 0 && (
        <button type="button" className="am-btn" onClick={onOpenPurchase}><ShoppingCart size={18} /> Ver mi pedido y pagar</button>
      )}
      {esCreador && isOpen && acceptedCount === 0 && cotizaciones.length > 0 && (
        <button type="button" className="am-btn" onClick={onCompare}><Gavel size={18} /> Comparar y aceptar ofertas</button>
      )}
      {isSeller && !esCreador && miCotizacion?.aceptada && (
        <p className="am-note"><PackageCheck size={16} /> El comprador aceptó tu oferta. Recibirás el pedido cuando pague.</p>
      )}

      {/* Comentarios */}
      <section className="am-card" id="am-comments">
        <h3 className="am-section-title"><MessageCircle size={20} /> Comentarios de usuarios <span className="am-muted">({comments.length})</span></h3>
        {comments.map((comment) => (
          <div key={comment.id} className="am-comment">
            <AuctionAvatar className="am-comment-avatar" src={comment.autorFotoUrl} name={comment.autor || ''} isStore={Boolean(comment.autorEsTienda)} />
            <div>
              <strong>
                {comment.autor}
                {comment.autorEsComprador && <em> · Comprador</em>}
                {comment.autorEsTienda && <em> · Tienda</em>}
              </strong>
              <p>{comment.texto}</p>
            </div>
          </div>
        ))}
        {(isSeller || esCreador) && isOpen ? (
          <form className="am-comment-form" onSubmit={submitComment}>
            <Pencil size={18} />
            <input
              type="text"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Escribe un comentario o pregunta para afinar tu cotización..."
              maxLength={1000}
              aria-label="Escribe un comentario"
            />
            <button type="submit" disabled={posting || !commentText.trim()} aria-label="Publicar comentario"><Send size={20} /></button>
          </form>
        ) : null}
        {commentError && <p className="am-error" role="alert">{commentError}</p>}
      </section>

      {/* Desglose */}
      {modal === 'breakdown' && (
        <CenterModal title="Desglose de la búsqueda" Icon={ListChecks} onClose={close}>
          <p className="am-muted">
            Esto es lo que necesita el comprador{[marca, modelo, anio].filter(Boolean).length ? ` para su ${[marca, modelo, anio].filter(Boolean).join(' ')}` : ''}.
          </p>
          {groups.map((group, groupIndex) => (
            <div key={group.key || groupIndex} className="am-group">
              <div className="am-vehicle-card">
                <span><Car size={16} /> {groups.length > 1 ? `Vehículo ${groupIndex + 1}` : 'Vehículo'}</span>
                <p>{[[group.vehicle.marca, group.vehicle.modelo, group.vehicle.anio].filter(Boolean).join(' '), group.vehicle.version, group.vehicle.patente].filter(Boolean).join(' · ')}</p>
              </div>
              {group.items.map((item, index) => (
                <div key={item.id ?? index} className={`am-line ${index > 0 ? 'is-divided' : ''}`}>
                  <div>
                    <strong>{item.repuesto}</strong>
                    {item.categoria && <small>{item.categoria}</small>}
                    {item.descripcion && <small className="is-subtle">{item.descripcion}</small>}
                  </div>
                  <b>x{item.cantidad}</b>
                </div>
              ))}
            </div>
          ))}
          <div className="am-receipt">
            <div><span>Total de repuestos</span><strong>{itemsList.length} · {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}</strong></div>
            <div>
              <span>
                Presupuesto sugerido (estimado)
                <button type="button" className="am-i" onClick={() => setBudgetNoteOpen((open) => !open)} aria-expanded={budgetNoteOpen} aria-label="Más información sobre el presupuesto sugerido"><Info size={20} /></button>
              </span>
              <strong className="am-budget">{presupuestoMaximo ? formatCLP(presupuestoMaximo) : 'No definido'}</strong>
            </div>
            {budgetNoteOpen && <small className="am-muted">Es solo un valor referencial estimado por el comprador. Tu casa de repuestos puede ofertar por sobre o bajo este precio.</small>}
          </div>
        </CenterModal>
      )}

      {/* Ofertas */}
      {modal === 'offers' && (
        <CenterModal title={`Ofertas recibidas (${cotizaciones.length})`} Icon={Gavel} onClose={close}>
          <p className="am-lock-note"><Lock size={15} /> Subasta privada: cada casa de repuestos ve solo su propia oferta. Los montos no se comparten entre tiendas.</p>
          {sortedQuotes.length === 0 ? (
            <div className="am-empty-inline"><Gavel size={28} /><span>Aún no se registran ofertas.</span></div>
          ) : sortedQuotes.map((quote, index) => {
            const winner = Boolean(quote.aceptada || quote.esGanadora);
            return (
              <div key={quote.id} className={`am-offer ${winner ? 'is-winner' : ''}`}>
                <span className="am-offer-n">{index + 1}</span>
                {quote.tiendaLogoUrl ? (
                  <button
                    type="button"
                    className="am-offer-avatar-btn"
                    onClick={() => setViewer({ photos: [resolveMediaUrl(quote.tiendaLogoUrl)], index: 0, title: quote.nombreTienda })}
                    aria-label={`Ver foto de ${quote.nombreTienda || 'la tienda'}`}
                  >
                    <AuctionAvatar className="am-offer-avatar" src={quote.tiendaLogoUrl} name={quote.nombreTienda} isStore />
                  </button>
                ) : (
                  <AuctionAvatar className="am-offer-avatar" src={quote.tiendaLogoUrl} name={quote.nombreTienda} isStore />
                )}
                <div className="am-offer-text">
                  <strong>{quote.nombreTienda || 'Tienda verificada'}</strong>
                  <span className="am-offer-meta">
                    <Star size={12} className={quote.tiendaRating ? 'is-rated' : ''} />
                    {quote.tiendaRating ? `Evaluación ${Number(quote.tiendaRating).toFixed(1)} de 5` : 'Sin evaluaciones aún'}
                  </span>
                  <small>
                    {quote.esPrivada
                      ? 'Oferta confidencial'
                      : `${formatCLP(quote.precioFinal || quote.precio)}${quote.tiempoEntrega ? ` · ${quote.tiempoEntrega}` : ''}`}
                  </small>
                  {quote.fechaEnvio && (
                    <span className="am-offer-meta"><CalendarDays size={12} />Oferta enviada {formatPublished(quote.fechaEnvio)}</span>
                  )}
                  {winner && <em>Oferta ganadora</em>}
                </div>
                <span className="am-offer-lock">{winner ? <Trophy size={15} /> : <Lock size={15} />}</span>
              </div>
            );
          })}
          {esCreador && isOpen && cotizaciones.length > 0 && (
            <button type="button" className="am-btn" onClick={() => { close(); onCompare(); }}><Gavel size={18} /> Comparar y aceptar ofertas</button>
          )}
        </CenterModal>
      )}

      {/* Presupuesto sugerido */}
      {modal === 'budget' && (
        <CenterModal title="Sobre el presupuesto sugerido" Icon={Info} onClose={close} footer={<button type="button" className="am-btn" onClick={close}>Entendido</button>}>
          <p className="am-point"><Wallet size={16} /><span>Es un valor <b>estimado y referencial</b> que el comprador indicó para orientar a las tiendas. No es un precio fijo ni obligatorio.</span></p>
          <p className="am-point"><ArrowRight size={16} /><span>Tu casa de repuestos puede ofertar <b>por sobre o bajo</b> este valor, según disponibilidad, calidad, garantía y despacho.</span></p>
          <p className="am-point"><Lock size={16} /><span>Las ofertas son privadas: ninguna tienda ve el precio de las demás.</span></p>
          <div className="am-budget-box"><small>Presupuesto sugerido de esta búsqueda</small><strong>{presupuestoMaximo ? formatCLP(presupuestoMaximo) : 'No definido'}</strong></div>
        </CenterModal>
      )}

      {/* Proceso */}
      {modal === 'process' && (
        <CenterModal title="¿Qué es una búsqueda de repuestos?" Icon={Info} onClose={close} footer={<button type="button" className="am-btn" onClick={close}>Entendido</button>}>
          <p className="am-muted">
            Es una solicitud que publica un comprador cuando busca un repuesto: indica qué necesita, para qué vehículo y un presupuesto de referencia. Las casas de repuestos verificadas la ven y le envían su mejor oferta.
          </p>
          <ol className="am-steps">
            {PROCESS_STEPS.map(({ title, Icon, text }, index) => (
              <li key={title}>
                <span className="am-step-n">{index + 1}</span>
                <div><strong><Icon size={15} /> {title}</strong><small>{text}</small></div>
              </li>
            ))}
          </ol>
          <Link to={helpCategoryPath('necesidades')} className="am-help-link">Ver preguntas frecuentes <ArrowRight size={14} /></Link>
        </CenterModal>
      )}
      {viewer && (
        <AuctionImageViewer photos={viewer.photos} startIndex={viewer.index} title={viewer.title} onClose={() => setViewer(null)} className="is-top" />
      )}
    </main>
  );
}
