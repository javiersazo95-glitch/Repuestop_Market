import React, { useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import {
  ShieldCheck, MapPin, Star, Package, Clock,
  ArrowLeft, X, CheckCircle2, Truck,
  Heart, Share2, PenLine, Tag, Store as StoreIcon,
  MessageCircle, Send, Mail, Link2, MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ContextualReportButton from './ContextualReportButton';
import { parseShippingMethods } from '../data/shippingMethods';
import { getStoreProfileApi } from '../services/api';
import { adaptStore } from '../services/adapters';
import { useSavedMarketplaceItems } from '../hooks/useSavedMarketplaceItems';
import { useMarketplace } from '../context/MarketplaceContext';
import PartsCatalogView from './PartsCatalogView';
import { useCatalogUrlState } from '../routes/useCatalogUrlState';
import { useIsMobile } from '../hooks/useIsMobile';
import SocialIcon from './SocialIcon';
import { storeSocialLinks } from '../utils/socialLinks';
import '../styles/social-links.css';

export default function StorePublicProfileView({
  store,
  onBackToStores,
  // Volver a donde se abrio la tienda; sin el, vuelve al directorio.
  onBack,
  backLabel = 'Volver a Casas de repuestos',
  onQuickView,
  onOpenQuote,
  activeVehicle: initialActiveVehicle,
  onVehicleChange,
  onEditStore
}) {
  const { user } = useAuth();
  const { openAuthModal } = useMarketplace();
  const initialStoreId = typeof store === 'string' ? null : store?.id;

  const [logoError, setLogoError] = useState(false);
  // Filtros y pagina del inventario en la URL de la tienda: al abrir un repuesto y volver, el
  // catalogo queda igual. La tienda ya va en la ruta, asi que no se repite como filtro.
  const catalogUrl = useCatalogUrlState();
  const { syncUrl: syncCatalogUrl } = catalogUrl;
  const syncStoreCatalogUrl = useCallback(
    (state) => syncCatalogUrl({ ...state, advanced: { ...(state.advanced || {}), storeId: null } }),
    [syncCatalogUrl]
  );
  const [coverError, setCoverError] = useState(false);




  const [shareFeedback, setShareFeedback] = useState('');
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  // Movil (5-oct): la portada queda limpia (imagen y logo); guardar, compartir, reportar y
  // editar viven en una hoja que abre un solo icono sobre la portada.
  const isMobile = useIsMobile();
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const shareMenuRef = useRef(null);
  const { isStoreSaved, toggleStore } = useSavedMarketplaceItems(user?.userId ?? user?.id);


  // Ficha pública de la tienda con TanStack Query
  // El error NO se traga: si `GET /tiendas/{id}` falla hay que decirlo, no inventar una
  // tienda. Antes devolvia null y el componente caia en un objeto de demostracion, asi
  // que una tienda inexistente -o bloqueada, que ahora responde 404- se veia como una
  // ficha normal con nombre y RUT de otra empresa.
  const { data: fetchedStore, isLoading: storeLoading, isError: storeError } = useQuery({
    queryKey: qk.store(initialStoreId),
    queryFn: async ({ signal }) => adaptStore(await getStoreProfileApi(initialStoreId, { signal })),
    enabled: Boolean(initialStoreId),
    retry: false,
  });

  // Normaliza lo que llega por `state` desde el directorio para pintar la cabecera
  // mientras viaja la ficha completa. NO inventa valores: un dato que el backend no
  // mando se muestra vacio, no con el de una tienda de ejemplo.
  const resolveStore = (inputStore) => {
    if (!inputStore || typeof inputStore === 'string' || !inputStore.nombre) return null;
    return {
      id: inputStore.id,
      nombre: inputStore.nombre,
      rut: inputStore.rut || '',
      tipo: inputStore.tipo || '',
      ciudad: inputStore.ciudad || '',
      totalPublicaciones: inputStore.totalPublicaciones ?? 0,
      rating: inputStore.rating ?? 0,
      reviewCount: inputStore.reviewCount ?? 0,
      responseRate: inputStore.responseRate ?? null,
      responseTimeLabel: inputStore.responseTimeLabel || '',
      verificadoFecha: inputStore.verificadoFecha || '',
      marcasEspecialistas: Array.isArray(inputStore.marcasEspecialistas) ? inputStore.marcasEspecialistas : [],
      marcasVehiculoDisponibles: Array.isArray(inputStore.marcasVehiculoDisponibles) ? inputStore.marcasVehiculoDisponibles : [],
      metodosEnvio: Array.isArray(inputStore.metodosEnvio) ? inputStore.metodosEnvio : [],
      logoUrl: inputStore.logoUrl || null,
      coverUrl: inputStore.coverUrl || null,
      instagramUrl: inputStore.instagramUrl || null,
      facebookUrl: inputStore.facebookUrl || null,
      tiktokUrl: inputStore.tiktokUrl || null,
      descripcion: inputStore.descripcion || '',
      direccion: inputStore.direccion || '',
      telefono: inputStore.telefono || '',
      email: inputStore.email || '',
      esOficial: !!inputStore.esOficial,
    };
  };

  // Mientras viaja la ficha se usa lo precargado del directorio, que son datos reales.
  const previewStore = resolveStore(store);
  // Si la ficha fallo, la precarga NO sirve de reemplazo: llegar desde un directorio ya
  // cargado en otra pestana mostraria igual una tienda que el backend acaba de dejar de
  // publicar. El 404 manda sobre lo que traiamos en la mano.
  const currentStore = storeError ? null : (fetchedStore || previewStore);
  // Sin ficha y sin precarga no hay nada que mostrar: o no existe, o dejo de ser
  // publica (suspendida o bloqueada por mediacion, que responden 404).
  const storeUnavailable = storeError || (!currentStore && !storeLoading);
  const storeId = currentStore?.id;
  const rating = Number(currentStore?.rating ?? 0);
  const reviewCount = Number(currentStore?.reviewCount ?? 0);
  const responseRate = currentStore?.responseRate != null ? Number(currentStore.responseRate) : null;
  const shippingMethods = parseShippingMethods(currentStore?.metodosEnvio);
  const specialistBrands = (currentStore?.marcasEspecialistas || [])
    .map((brand) => typeof brand === 'string' ? brand : (brand?.nombre || brand?.name || ''))
    .filter(Boolean);
  const hasSpecialistBrands = specialistBrands.length > 0;
  const socialLinks = storeSocialLinks(currentStore);
  // Solo las redes con enlace; abren el perfil de la tienda en otra pestaña.
  const renderSocialLinks = (variant) => socialLinks.length > 0 && (
    <div className={`store-social-links ${variant}`}>
      <span className="store-social-links-label">Redes sociales</span>
      {socialLinks.map((social) => (
        <a
          key={social.key}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="store-social-link"
          aria-label={`${social.label} de ${currentStore.nombre}`}
          title={social.label}
        >
          <SocialIcon network={social.key} size={variant === 'is-mobile' ? 14 : 15} />
        </a>
      ))}
    </div>
  );
  const isVerified = currentStore?.esOficial || rating >= 4.5;
  const isOwnStore = Boolean(
    onEditStore ||
    (user?.sellerId && (String(user.sellerId) === String(storeId) || String(user.sellerId) === String(currentStore?.proveedorId))) ||
    (user?.storeId && (String(user.storeId) === String(storeId) || String(user.storeId) === String(currentStore?.proveedorId))) ||
    (user?.tiendaId && (String(user.tiendaId) === String(storeId) || String(user.tiendaId) === String(currentStore?.proveedorId))) ||
    (user?.proveedorId && (String(user.proveedorId) === String(storeId) || String(user.proveedorId) === String(currentStore?.proveedorId))) ||
    (user?.userId && String(user.userId) === String(currentStore?.proveedorId || currentStore?.id)) ||
    (user?.id && String(user.id) === String(currentStore?.proveedorId || currentStore?.id)) ||
    (user?.storeName && currentStore?.nombre && user.storeName.toLowerCase().trim() === currentStore.nombre.toLowerCase().trim()) ||
    (user?.nombreTienda && currentStore?.nombre && user.nombreTienda.toLowerCase().trim() === currentStore.nombre.toLowerCase().trim())
  );

  // Total que informa el catálogo de abajo: con patente, la métrica de la cabecera habla de los
  // compatibles (el mismo universo que la grilla) y no del inventario completo.
  const [catalogResults, setCatalogResults] = useState({ total: 0, vehicleActive: false });
  const vehicleFilterActive = catalogResults.vehicleActive;

  // Cierra el menú de compartir al hacer clic fuera, mismo patrón que los demás
  // dropdowns del header.
  useEffect(() => {
    if (!isShareMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setIsShareMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isShareMenuOpen]);

  const shareText = `Mira los repuestos de ${currentStore?.nombre || 'esta tienda'} en RepuesTop`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const closeShareMenuAnd = (action) => {
    setIsShareMenuOpen(false);
    setMobileActionsOpen(false);
    action();
  };

  const shareViaWhatsapp = () => closeShareMenuAnd(() => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, '_blank', 'noopener,noreferrer');
  });

  const shareViaMessenger = () => closeShareMenuAnd(() => {
    // Deep link nativo: abre la app de Messenger en el celular. En escritorio, sin un
    // app_id de Meta registrado, no hay un dialogo web equivalente que funcione siempre.
    window.open(`fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer');
  });

  const shareViaEmail = () => closeShareMenuAnd(() => {
    window.location.href = `mailto:?subject=${encodeURIComponent(currentStore?.nombre || 'RepuesTop')}&body=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
  });

  // En el celular: la hoja nativa (WhatsApp, Instagram, correo, lo que tenga la persona).
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareNative = () => closeShareMenuAnd(() => {
    navigator.share({ title: currentStore?.nombre || 'RepuesTop', text: shareText, url: shareUrl }).catch(() => {});
  });

  const handleCopyLink = () => closeShareMenuAnd(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback('Enlace copiado');
    } catch {
      setShareFeedback('No se pudo copiar el enlace');
    }
    setTimeout(() => setShareFeedback(''), 2500);
  });

  useEffect(() => {
    if (!mobileActionsOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setMobileActionsOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileActionsOpen]);

  const toggleSavedStore = () => {
    if (!user) { openAuthModal(); return; }
    toggleStore(currentStore);
  };

  if (storeUnavailable || !currentStore) {
    return (
      <div className="store-public-profile-wrapper">
        <div className="store-unavailable-panel">
          {storeUnavailable ? (
            <>
              <span className="store-unavailable-icon"><StoreIcon size={30} /></span>
              <h2>Esta tienda no está disponible</h2>
              <p>
                Puede que haya dejado de publicar en RepuesTop o que el enlace no
                corresponda a ninguna tienda. Revisa el directorio para encontrar otras
                tiendas con el repuesto que buscas.
              </p>
              <button type="button" className="btn-auth-primary" onClick={onBackToStores}>
                Ver todas las tiendas
              </button>
            </>
          ) : (
            <p className="store-unavailable-loading">Cargando la tienda…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="store-public-profile-wrapper">
      {/* 1. Header Banner & Store Info */}
      <div className="store-header-banner">
        <div className="store-cover-image">
          {currentStore.coverUrl && !coverError ? (
            <img
              src={currentStore.coverUrl}
              alt={`Portada de ${currentStore.nombre}`}
              className="store-cover-backdrop-img"
              onError={() => setCoverError(true)}
            />
          ) : (
            <div className="store-cover-placeholder" />
          )}
          <div className="store-cover-overlay" />

          {isMobile ? (
            <div className="store-mobile-cover-bar">
              <button className="store-cover-icon-button" onClick={onBack || onBackToStores} type="button" aria-label={backLabel}>
                <ArrowLeft size={18} />
              </button>
              <button
                className="store-cover-icon-button"
                onClick={() => setMobileActionsOpen(true)}
                type="button"
                aria-label="Guardar, compartir y más opciones de la tienda"
                aria-haspopup="dialog"
                aria-expanded={mobileActionsOpen}
              >
                <MoreHorizontal size={19} />
              </button>
            </div>
          ) : (
          <div className="container store-header-actions-bar">
            <button className="btn-back-stores" onClick={onBack || onBackToStores} type="button">
              <ArrowLeft size={16} />
              <span>{backLabel}</span>
            </button>
            {onEditStore && (
              <button className="btn-edit-store-profile" onClick={onEditStore} type="button" title="Editar mi tienda">
                <PenLine size={15} />
                <span>Editar tienda</span>
              </button>
            )}
          </div>
          )}

          {!isMobile && (
          <div className="container store-hero-inner-container">
            <div className="store-hero-left">
              <div className="store-avatar-box">
                {currentStore.logoUrl && !logoError ? (
                  <img
                    src={currentStore.logoUrl}
                    alt={currentStore.nombre}
                    className="store-avatar-img"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="store-avatar-fallback" style={{ backgroundColor: currentStore.bgColor || '#0066ff' }}>
                    <span>{currentStore.initials || 'RT'}</span>
                  </div>
                )}
              </div>

              <div className="store-info-details">
                <div className="store-title-badge-row">
                  <h1>{currentStore.nombre}</h1>
                  {isVerified && <span className="badge-official-store">Tienda verificada</span>}
                </div>

                {currentStore.descripcion && (
                  <p className="store-description-text">{currentStore.descripcion}</p>
                )}

                <p className="store-subtitle-meta">
                  <span className="meta-item"><MapPin size={14} /> {currentStore.ciudad}</span>
                </p>

                {renderSocialLinks('on-cover')}

                <div className="store-action-buttons">
                  <button
                    className={`btn-follow-store ${isStoreSaved(currentStore.id) ? 'following' : ''}`}
                    onClick={() => {
                      if (!user) { openAuthModal(); return; }
                      toggleStore(currentStore);
                    }}
                    type="button"
                    title={isStoreSaved(currentStore.id) ? 'Quitar tienda de favoritos' : 'Guardar tienda en favoritos'}
                  >
                    <Heart size={16} className={isStoreSaved(currentStore.id) ? 'fill-current' : ''} />
                    <span>{isStoreSaved(currentStore.id) ? 'Tienda guardada' : 'Guardar tienda'}</span>
                  </button>

                  <div className="store-share-wrap" ref={shareMenuRef}>
                    <button
                      className="btn-share-store"
                      onClick={() => setIsShareMenuOpen((open) => !open)}
                      type="button"
                      title="Compartir enlace de la tienda"
                      aria-haspopup="menu"
                      aria-expanded={isShareMenuOpen}
                    >
                      <Share2 size={16} />
                      <span>Compartir</span>
                    </button>

                    {isShareMenuOpen && (
                      <ul className="store-share-menu" role="menu">
                        {canNativeShare && (
                          <li role="none">
                            <button type="button" role="menuitem" className="store-share-option native" onClick={shareNative}>
                              <Share2 size={16} /> Compartir con…
                            </button>
                          </li>
                        )}
                        <li role="none">
                          <button type="button" role="menuitem" className="store-share-option whatsapp" onClick={shareViaWhatsapp}>
                            <MessageCircle size={16} /> WhatsApp
                          </button>
                        </li>
                        <li role="none">
                          <button type="button" role="menuitem" className="store-share-option messenger" onClick={shareViaMessenger}>
                            <Send size={16} /> Messenger
                          </button>
                        </li>
                        <li role="none">
                          <button type="button" role="menuitem" className="store-share-option email" onClick={shareViaEmail}>
                            <Mail size={16} /> Email
                          </button>
                        </li>
                        <li role="none">
                          <button type="button" role="menuitem" className="store-share-option copy" onClick={handleCopyLink}>
                            <Link2 size={16} /> Copiar enlace
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>

                  {!isOwnStore && (
                    <ContextualReportButton
                      tipoObjeto="TIENDA"
                      objetoId={storeId}
                      objetoTitulo={currentStore.nombre}
                      className="btn-report-store"
                    />
                  )}
                </div>

                {shareFeedback && (
                  <div className="store-action-toast-banner" role="status">
                    <CheckCircle2 size={14} />
                    <span>{shareFeedback}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="store-hero-right">
              <div className="store-rating-card">
                <span className="rating-card-label">Calificación de la tienda</span>
                <div className="rating-card-score-row">
                  <span className="rating-score-num">{rating.toFixed(1)}</span>
                  <div className="rating-stars-box">
                    <div className="stars-row" aria-label={`${rating.toFixed(1)} de 5 estrellas`}>
                      {Array.from({ length: 5 }, (_, index) => (
                        // .stars-row .star-icon fuerza el relleno azul (!important):
                        // las vacias NO llevan esa clase o se verian llenas igual.
                        <Star key={index} size={16} className={index < Math.round(rating) ? 'star-icon' : 'star-icon-empty'} />
                      ))}
                    </div>
                    <small className="rating-opinions-count">
                      {reviewCount > 0 ? `(${reviewCount.toLocaleString('es-CL')} opiniones)` : 'Sin evaluaciones'}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {isMobile && (
          <div className="store-mobile-identity">
            <div className="store-avatar-box">
              {currentStore.logoUrl && !logoError ? (
                <img
                  src={currentStore.logoUrl}
                  alt={currentStore.nombre}
                  className="store-avatar-img"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="store-avatar-fallback" style={{ backgroundColor: currentStore.bgColor || '#0066ff' }}>
                  <span>{currentStore.initials || 'RT'}</span>
                </div>
              )}
            </div>
            <div className="store-mobile-identity-copy">
              <h1>{currentStore.nombre}</h1>
              {isVerified && <span className="badge-official-store">Tienda verificada</span>}
              {currentStore.descripcion && <p>{currentStore.descripcion}</p>}
              <span className="store-mobile-identity-location"><MapPin size={13} /> {currentStore.ciudad}</span>
              {/* Debajo de la portada, nunca sobre ella: en el celular la imagen queda limpia. */}
              {renderSocialLinks('is-mobile')}
            </div>
            {shareFeedback && (
              <div className="store-action-toast-banner" role="status">
                <CheckCircle2 size={14} />
                <span>{shareFeedback}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {isMobile && mobileActionsOpen && typeof document !== 'undefined' && createPortal(
        <div className="store-actions-backdrop" onClick={() => setMobileActionsOpen(false)}>
          <div
            className="store-actions-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Opciones de la tienda"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <strong>{currentStore.nombre}</strong>
              <button type="button" onClick={() => setMobileActionsOpen(false)} aria-label="Cerrar">
                <X size={20} />
              </button>
            </header>
            <div className="store-actions-list">
              <button
                type="button"
                className={`store-actions-option ${isStoreSaved(currentStore.id) ? 'is-saved' : ''}`}
                onClick={() => { setMobileActionsOpen(false); toggleSavedStore(); }}
              >
                <Heart size={18} className={isStoreSaved(currentStore.id) ? 'fill-current' : ''} />
                <span>{isStoreSaved(currentStore.id) ? 'Quitar de tiendas guardadas' : 'Guardar tienda'}</span>
              </button>
              <small className="store-actions-group-label">Compartir</small>
              {canNativeShare && (
                <button type="button" className="store-actions-option" onClick={shareNative}>
                  <Share2 size={18} /> <span>Compartir con…</span>
                </button>
              )}
              <button type="button" className="store-actions-option" onClick={shareViaWhatsapp}>
                <MessageCircle size={18} /> <span>WhatsApp</span>
              </button>
              <button type="button" className="store-actions-option" onClick={shareViaMessenger}>
                <Send size={18} /> <span>Messenger</span>
              </button>
              <button type="button" className="store-actions-option" onClick={shareViaEmail}>
                <Mail size={18} /> <span>Email</span>
              </button>
              <button type="button" className="store-actions-option" onClick={handleCopyLink}>
                <Link2 size={18} /> <span>Copiar enlace</span>
              </button>
              {/* Reportar exige sesion (ContextualReportButton no se pinta sin usuario). */}
              {(onEditStore || (!isOwnStore && user)) && <small className="store-actions-group-label">Más</small>}
              {onEditStore && (
                <button type="button" className="store-actions-option" onClick={() => { setMobileActionsOpen(false); onEditStore(); }}>
                  <PenLine size={18} /> <span>Editar tienda</span>
                </button>
              )}
              {!isOwnStore && (
                <ContextualReportButton
                  tipoObjeto="TIENDA"
                  objetoId={storeId}
                  objetoTitulo={currentStore.nombre}
                  className="store-actions-option is-danger"
                  label="Reportar tienda"
                />
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Bottom Metrics Card Strip */}
      <div className="container store-metrics-strip-container">
        <div className="store-metrics-strip-card">
            {isMobile && (
              <div className="metric-strip-item">
                <span className="metric-icon-box is-rating"><Star size={22} /></span>
                <div className="metric-text-box">
                  <small>{reviewCount > 0 ? `${reviewCount.toLocaleString('es-CL')} evaluaciones` : 'Calificación de la tienda'}</small>
                  <strong>{rating > 0 ? rating.toFixed(1) : '—'}</strong>
                </div>
              </div>
            )}
            <div className="metric-strip-item">
              <span className="metric-icon-box"><Package size={22} /></span>
              {/* Con una patente activa esta metrica tiene que hablar del mismo universo que
                  la grilla. Mostrar el inventario completo mientras abajo se listan 9
                  repuestos compatibles se lee como que el filtro esta roto. */}
              <div className="metric-text-box">
                <small>{vehicleFilterActive ? 'Compatibles con tu vehículo' : 'Productos publicados'}</small>
                <strong>{(vehicleFilterActive ? catalogResults.total : Number(currentStore.totalPublicaciones ?? 0)).toLocaleString('es-CL')}</strong>
              </div>
            </div>

            <div className="metric-strip-item">
              <span className="metric-icon-box"><Truck size={22} /></span>
              <div className="metric-text-box">
                <small>Envíos a todo Chile</small>
                <strong>{shippingMethods.length ? `${shippingMethods.length} opciones` : 'Sin métodos declarados'}</strong>
              </div>
            </div>

            {currentStore.responseTimeLabel && (
              <div className="metric-strip-item">
                <span className="metric-icon-box"><Clock size={22} /></span>
                <div className="metric-text-box">
                  <small>Tiempo de respuesta</small>
                  <strong>{currentStore.responseTimeLabel}</strong>
                </div>
              </div>
            )}

            {hasSpecialistBrands && (
              <div className="metric-strip-item">
                <span className="metric-icon-box"><Tag size={22} /></span>
                <div className="metric-text-box">
                  <small>Marcas especialistas</small>
                  {/* Carrusel horizontal: con muchas marcas, unirlas en un solo texto
                      (join) envolvía a varias líneas y deformaba la franja blanca.
                      Ahora cada marca es un chip en una fila que se desliza. */}
                  <div className="specialist-brands-track" title={specialistBrands.join(', ')}>
                    {specialistBrands.map((brand, index) => (
                      <span key={`${brand}-${index}`} className="specialist-brand-chip">{brand}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* En movil no va (5-oct): la franja queda con lo que sirve para decidir la compra. */}
            {!isMobile && currentStore.verificadoFecha && (
              <div className="metric-strip-item">
                <span className="metric-icon-box"><ShieldCheck size={22} /></span>
                <div className="metric-text-box">
                  <small>{isVerified ? 'Tienda registrada' : 'Tienda acreditada'}</small>
                  <strong>{currentStore.verificadoFecha}</strong>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Inventario de la tienda: el MISMO catálogo de /repuestos (filtros en el servidor, paginado
          real) con la tienda fija. Antes era un panel propio con 4 filtros que filtraba en el
          navegador sobre los primeros 100 productos. */}
      <PartsCatalogView
        lockedStoreId={storeId}
        storeName={currentStore.nombre}
        activeVehicle={initialActiveVehicle}
        onVehicleChange={onVehicleChange}
        onQuickView={onQuickView}
        onOpenQuote={onOpenQuote}
        onResultsChange={setCatalogResults}
        initialCatalogFilter={catalogUrl.filter}
        initialSearchQuery={catalogUrl.query}
        initialPage={catalogUrl.page}
        initialShowAll={catalogUrl.showAll}
        initialAdvancedFilters={catalogUrl.advanced}
        onNavigationStateChange={syncStoreCatalogUrl}
      />
    </div>
  );
}
