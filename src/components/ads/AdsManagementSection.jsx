import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Megaphone, Plus, Zap, Edit3, Trash2, Eye, AlertTriangle, Search,
  Phone, MessageCircle, Calendar, MapPin, Tag, Clock, RefreshCw,
  Layers, Loader2, CheckCircle2, Clock3, XCircle, CalendarClock
} from 'lucide-react';
import {
  fetchMyAds, deleteAd, adErrorMessage,
  getCachedTokensBalance, fetchTokensBalance, TOKENS_UPDATED_EVENT,
  fetchMyAppointments, updateAppointmentStatus
} from '../../services/adsStorage';
import {
  AD_TIERS, AD_TIER_ORDER, AD_MODERATION_STATUS, AD_MODERATION_LABELS,
  SERVICE_CATEGORIES, getAdExpiryInfo, getUpgradableTiers,
  APPOINTMENT_STATUS_META, isClosedAppointment
} from '../../data/automotiveAdsData';
import { formatAgendaDateLong, getTimeUntilLabel, toIsoDate } from '../../data/agendaConfig';
import { useAuth } from '../../context/AuthContext';
import AdAgendaModal from './AdAgendaModal';
import TokensHistoryModal from './TokensHistoryModal';
import TokensWalletCard from './TokensWalletCard';
import RechargeTokensModal from './RechargeTokensModal';
import UpgradeAdRankModal from './UpgradeAdRankModal';
import EditAdModal from './EditAdModal';
import CreateAdModal from './CreateAdModal';
import CapturerContactCard from '../CapturerContactCard';
import './ads-wall.css';

const STATUS_ICONS = {
  APROBADO: CheckCircle2,
  PENDIENTE: Clock3,
  RECHAZADO: XCircle
};

// Un anuncio esta realmente publicado solo si ademas de APROBADO sigue activo:
// cualquier edicion posterior lo apaga hasta la nueva revision.
const isLive = (ad) => ad.moderationStatus === AD_MODERATION_STATUS.APROBADO && ad.activo === true;

const STATUS_FILTERS = [
  { id: 'TODOS', label: 'Todos', match: () => true },
  { id: 'APROBADO', label: 'Publicados', match: isLive },
  { id: 'PENDIENTE', label: 'En revisión', match: (ad) => ad.moderationStatus === AD_MODERATION_STATUS.PENDIENTE },
  { id: 'RECHAZADO', label: 'Rechazados', match: (ad) => ad.moderationStatus === AD_MODERATION_STATUS.RECHAZADO }
];

/**
 * Panel de gestion de los anuncios propios.
 *
 * Lee `GET /anuncios/mios`, que es la unica fuente que devuelve un anuncio en
 * cualquier estado de moderacion: `GET /anuncios` solo trae lo aprobado, vigente
 * y activo, asi que ahi un anuncio en revision o rechazado no existe.
 */
export default function AdsManagementSection({ onNavigateToMural }) {
  const { user } = useAuth();
  const [ads, setAds] = useState([]);
  // `GET /anuncios/agendamientos/mias` devuelve en UNA respuesta las reservas de
  // los dos roles: las que le hicieron a mis anuncios y las que yo pedi como
  // cliente. Se separan por `customerUserId`, que es lo unico del DTO que
  // distingue un rol del otro (y el backend impide reservar en el anuncio
  // propio, asi que una cita nunca cae en las dos listas).
  const [appointments, setAppointments] = useState([]);
  const [appointmentsError, setAppointmentsError] = useState(null);
  const [adForAgenda, setAdForAgenda] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // Arranca con la ultima copia local para no pintar un cero mientras responde
  // la red, pero el saldo real lo trae `fetchTokensBalance()`: desde que el
  // backend cobra, lo que diga el navegador es solo una referencia.
  const [tokensBalance, setTokensBalanceState] = useState(() => getCachedTokensBalance());
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [tierFilter, setTierFilter] = useState('TODOS');

  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [adToUpgrade, setAdToUpgrade] = useState(null);
  const [adToEdit, setAdToEdit] = useState(null);
  // Planes de origen y destino de la ultima mejora, para que el formulario pueda
  // destacar SOLO lo que se acaba de desbloquear.
  const [upgradedFromTier, setUpgradedFromTier] = useState(null);
  const [upgradedToTier, setUpgradedToTier] = useState(null);
  const [adToDelete, setAdToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAds = useCallback(async ({ signal } = {}) => {
    setIsLoading(true);
    try {
      const list = await fetchMyAds({ signal });
      setAds(list);
      setLoadError(null);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Las reservas se cargan aparte de los anuncios a proposito: un fallo aca no
   * puede dejar sin gestion de anuncios a quien nunca uso la agenda, asi que
   * tiene su propio error y su propio estado.
   */
  const loadAppointments = useCallback(async ({ signal } = {}) => {
    try {
      setAppointments(await fetchMyAppointments({ signal }));
      setAppointmentsError(null);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setAppointmentsError(error);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAds({ signal: controller.signal });
    loadAppointments({ signal: controller.signal });
    return () => controller.abort();
  }, [loadAds, loadAppointments]);

  const sessionUserId = user?.userId ?? user?.id ?? user?.buyerId ?? null;

  const { receivedByAd, myAppointments, pendingReceived } = useMemo(() => {
    const mine = [];
    const received = new Map();
    appointments.forEach((appointment) => {
      const isMine = sessionUserId != null
        && String(appointment.customerUserId) === String(sessionUserId);
      if (isMine) { mine.push(appointment); return; }
      const list = received.get(appointment.adId) || [];
      list.push(appointment);
      received.set(appointment.adId, list);
    });
    return {
      receivedByAd: received,
      myAppointments: mine.sort((a, b) => b.date.localeCompare(a.date)),
      pendingReceived: appointments.filter(
        (item) => item.status === 'pending'
          && (sessionUserId == null || String(item.customerUserId) !== String(sessionUserId))
      ).length
    };
  }, [appointments, sessionUserId]);

  const replaceAppointment = (saved) => {
    setAppointments((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  };

  /** Cancelar es exclusivo del cliente: el backend responde 403 al dueño. */
  const handleCancelMyAppointment = async (appointment) => {
    setCancellingId(appointment.id);
    setCancelError('');
    try {
      replaceAppointment(await updateAppointmentStatus(appointment.id, 'cancelled'));
    } catch (error) {
      setCancelError(adErrorMessage(error, 'No se pudo cancelar la reserva.'));
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    const handleTokensUpdated = (e) => {
      if (typeof e.detail === 'number') setTokensBalanceState(e.detail);
    };
    window.addEventListener(TOKENS_UPDATED_EVENT, handleTokensUpdated);
    return () => window.removeEventListener(TOKENS_UPDATED_EVENT, handleTokensUpdated);
  }, []);

  // El saldo se consulta al montar. Ojo: esta lectura tambien es la que gatilla
  // el bono de bienvenida del backend la primera vez que la cuenta entra aca.
  useEffect(() => {
    const controller = new AbortController();
    fetchTokensBalance({ signal: controller.signal })
      .then(setTokensBalanceState)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const replaceAd = (saved) => {
    setAds((current) => current.map((ad) => (ad.id === saved.id ? saved : ad)));
  };

  // No cierra el modal: `CreateAdModal` tiene que poder mostrar su pantalla de
  // "quedó en revisión", que es donde se explica que el anuncio todavia no esta
  // en el mural. Lo cierra el usuario, con su propio `onClose`.
  const handleAdCreated = (created, balance) => {
    setAds((current) => [created, ...current]);
    setTokensBalanceState(balance);
  };

  const handleAdUpdated = (saved) => {
    replaceAd(saved);
  };

  const handleUpgradeSuccess = (saved, balance) => {
    replaceAd(saved);
    setTokensBalanceState(balance);
  };

  /**
   * "Activar mejoras": lleva del modal de mejora al formulario, ya sabiendo que
   * funciones se acaban de desbloquear.
   *
   * El plan anterior lo entrega `UpgradeAdRankModal`, que lo congelo al montarse:
   * para cuando se pulsa este boton, el anuncio de la lista ya quedo con el plan
   * nuevo y la diferencia daria vacia.
   */
  const handleActivateFeatures = (saved, fromTier, toTier) => {
    setUpgradedFromTier(fromTier);
    setUpgradedToTier(toTier);
    setAdToUpgrade(null);
    setAdToEdit(saved);
  };

  const closeEditModal = () => {
    setAdToEdit(null);
    setUpgradedFromTier(null);
    setUpgradedToTier(null);
  };

  const handleDeleteConfirm = async () => {
    if (!adToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteAd(adToDelete.id);
      setAds((current) => current.filter((ad) => ad.id !== adToDelete.id));
      setAdToDelete(null);
    } catch (error) {
      setDeleteError(adErrorMessage(error, 'No se pudo dar de baja el anuncio.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const counts = useMemo(() => ({
    total: ads.length,
    live: ads.filter(isLive).length,
    pending: ads.filter((ad) => ad.moderationStatus === AD_MODERATION_STATUS.PENDIENTE).length,
    rejected: ads.filter((ad) => ad.moderationStatus === AD_MODERATION_STATUS.RECHAZADO).length,
    expiring: ads.filter((ad) => {
      const expiry = getAdExpiryInfo(ad);
      return isLive(ad) && expiry && !expiry.isExpired && expiry.daysLeft <= 7;
    }).length
  }), [ads]);

  const filteredAds = useMemo(() => {
    const status = STATUS_FILTERS.find((item) => item.id === statusFilter) || STATUS_FILTERS[0];
    const q = searchQuery.trim().toLowerCase();
    return ads.filter((ad) => {
      if (!status.match(ad)) return false;
      if (tierFilter !== 'TODOS' && ad.tier !== tierFilter) return false;
      if (!q) return true;
      return [ad.title, ad.company, ad.commune].some(
        (field) => field && field.toLowerCase().includes(q)
      );
    });
  }, [ads, searchQuery, statusFilter, tierFilter]);

  return (
    <div className="profile-panel ads-management-panel">
      <div className="ads-mgmt-header">
        <div className="ads-mgmt-header-main">
          <div className="ads-mgmt-titles">
            <h2>
              <Megaphone size={24} className="text-amber-500" />
              Gestión de anuncios y servicios automotrices
            </h2>
            <p>
              Administra tus publicaciones del Mural de Anuncios, revisa en qué estado está cada una y
              mejora su plan con Monedas RepuesTop.
            </p>
          </div>

          <div className="ads-mgmt-actions">
            <button
              type="button"
              className="btn-ad-phone inline-flex items-center gap-2"
              onClick={() => { loadAds(); loadAppointments(); }}
              disabled={isLoading}
              title="Volver a consultar el estado de moderación y las reservas"
            >
              <RefreshCw size={16} className={isLoading ? 'spin-icon' : ''} />
              <span>Actualizar</span>
            </button>

            {onNavigateToMural && (
              <button
                type="button"
                className="btn-ad-phone inline-flex items-center gap-2"
                onClick={onNavigateToMural}
              >
                <Eye size={16} />
                <span>Ver mural público</span>
              </button>
            )}

            <button
              type="button"
              className="btn-post-ad inline-flex items-center gap-2"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus size={18} />
              <span>Publicar nuevo anuncio</span>
            </button>
          </div>
        </div>

        <CapturerContactCard capturer={user?.captadorPublicidad} context="ads" />
      </div>

      <TokensWalletCard
        tokensBalance={tokensBalance}
        onOpenRechargeModal={() => setIsRechargeModalOpen(true)}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
      />

      {/* Una banda segmentada y no cinco tarjetas: eran cinco bordes de color y
          cinco radios compitiendo, y la etiqueta mas larga se iba a dos lineas,
          asi que los numeros ni siquiera quedaban alineados entre si. */}
      <div className="ads-mgmt-stats">
        {[
          { label: 'Publicados', value: counts.live, hint: 'Visibles en el mural', tone: 'ok' },
          { label: 'En revisión', value: counts.pending, hint: 'Esperando moderación', tone: 'warn' },
          { label: 'Rechazados', value: counts.rejected, hint: 'Corrígelos y se revisan', tone: 'bad' },
          { label: 'Por vencer', value: counts.expiring, hint: 'Dentro de 7 días', tone: 'info' },
          { label: 'Reservas', value: pendingReceived, hint: 'Citas por responder', tone: 'ok' }
        ].map((stat) => (
          <div key={stat.label} className={`mgmt-stat tone-${stat.tone}`}>
            <strong>{stat.value}</strong>
            <span className="mgmt-stat-label">{stat.label}</span>
            <small>{stat.hint}</small>
          </div>
        ))}
      </div>

      <div className="ads-mgmt-toolbar">
        <div className="mgmt-search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar en mis anuncios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="mgmt-filter-tabs">
          {STATUS_FILTERS.map((filter) => {
            const Icon = STATUS_ICONS[filter.id] || Layers;
            const count = filter.id === 'TODOS'
              ? counts.total
              : ads.filter(filter.match).length;
            return (
              <button
                type="button"
                key={filter.id}
                className={`mgmt-filter-tab inline-flex items-center gap-1.5 ${statusFilter === filter.id ? 'active' : ''}`}
                onClick={() => setStatusFilter(filter.id)}
              >
                <Icon size={13} />
                <span>{filter.label} ({count})</span>
              </button>
            );
          })}
        </div>

        <select
          className="mgmt-tier-select"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          aria-label="Filtrar por plan"
        >
          <option value="TODOS">Todos los planes</option>
          {AD_TIER_ORDER.map((tierId) => (
            <option key={tierId} value={tierId}>{AD_TIERS[tierId].name}</option>
          ))}
        </select>
      </div>

      {/* El aviso de moderacion, una sola vez. Antes se repetia dentro de cada
          anuncio pendiente con el mismo texto palabra por palabra. */}
      {counts.pending > 0 && (
        <p className="ads-mgmt-pending-note">
          <Clock3 size={14} />
          <span>
            Los anuncios <strong>en revisión</strong> no aparecen en el Mural hasta que moderación
            los apruebe. Te llega una notificación con el resultado.
          </span>
        </p>
      )}

      <div className="ads-mgmt-list">
        {isLoading && ads.length === 0 && (
          <div className="ads-mgmt-state">
            <Loader2 size={22} className="spin-icon" />
            <p>Cargando tus anuncios…</p>
          </div>
        )}

        {!isLoading && loadError && (
          <div className="ads-mgmt-state is-error">
            <AlertTriangle size={22} />
            <p>{adErrorMessage(loadError, 'No pudimos cargar tus anuncios.')}</p>
            <button type="button" className="btn-ad-phone" onClick={() => loadAds()}>
              <RefreshCw size={14} /> Reintentar
            </button>
          </div>
        )}

        {!isLoading && !loadError && filteredAds.length === 0 && (
          <div className="ads-mgmt-state">
            <Megaphone size={22} />
            <p>
              {ads.length === 0
                ? 'Todavía no tienes anuncios publicados en el mural.'
                : 'Ninguno de tus anuncios coincide con este filtro.'}
            </p>
            {ads.length === 0 && (
              <button type="button" className="btn-post-ad" onClick={() => setIsCreateModalOpen(true)}>
                <Plus size={16} /> Publicar nuevo anuncio
              </button>
            )}
          </div>
        )}

        {filteredAds.map((ad) => {
          const tierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
          // APROBADO pero apagado: lo apago la ultima edicion y espera la nueva
          // revision. Se pinta como pendiente, no como publicado: el sello verde
          // diciendo "en revision" es justo la contradiccion que confunde.
          const isWaitingRecheck = ad.moderationStatus === AD_MODERATION_STATUS.APROBADO && !ad.activo;
          const effectiveStatus = isWaitingRecheck ? AD_MODERATION_STATUS.PENDIENTE : ad.moderationStatus;
          const status = AD_MODERATION_LABELS[effectiveStatus] || AD_MODERATION_LABELS.PENDIENTE;
          const StatusIcon = STATUS_ICONS[effectiveStatus] || Clock3;
          const expiry = getAdExpiryInfo(ad);
          const catObj = SERVICE_CATEGORIES.find((c) => c.id === ad.category);
          const coverPhoto = ad.images?.[0] || null;
          const canUpgrade = getUpgradableTiers(ad.tier).length > 0;
          const adAppointments = receivedByAd.get(ad.id) || [];
          const adPending = adAppointments.filter((item) => item.status === 'pending').length;

          return (
            <div key={ad.id} className={`mgmt-ad-item ${tierConfig.cardTheme}`}>
              <div className="mgmt-ad-left">
                <div className="mgmt-ad-thumb">
                  {coverPhoto
                    ? <img src={coverPhoto} alt="" />
                    : <span className="mgmt-ad-thumb-empty"><Megaphone size={20} /></span>}
                </div>

                <div className="mgmt-ad-info">
                  <div className="mgmt-ad-meta-top">
                    <span className={`mgmt-status-pill tone-${status.tone}`}>
                      <StatusIcon size={12} /> {status.label}
                    </span>
                    {/* El plan va aca y no encima de la miniatura: `badge` esta
                        escrito para la tarjeta del mural ("👑 Empresarial
                        Verificado", 24 caracteres) y sobre una miniatura de 90px
                        se partia en tres lineas tapando la foto. Aca se usa
                        `name`, una palabra, y sin el "Verificado", que es una
                        señal para el comprador y no para el dueño del anuncio. */}
                    <span className={`mgmt-ad-plan plan-${ad.tier}`}>{tierConfig.name}</span>
                    <span className="mgmt-ad-cat">
                      {catObj?.emoji ? `${catObj.emoji} ` : ''}{ad.categoryLabel || catObj?.label || 'Servicio'}
                    </span>
                    {expiry && isLive(ad) && (
                      <span className={`mgmt-ad-expiry ${expiry.isExpired || expiry.daysLeft <= 7 ? 'is-urgent' : ''}`}>
                        <CalendarClock size={12} /> {expiry.label}
                      </span>
                    )}
                  </div>

                  <h4 className="mgmt-ad-title">{ad.title}</h4>

                  <div className="mgmt-ad-icons-row">
                    <span><MapPin size={13} /> {ad.commune}{ad.address ? `, ${ad.address}` : ''}</span>
                    <span><Phone size={13} /> {ad.phone}</span>
                    <span><Tag size={13} /> {ad.priceText}</span>
                    {ad.is24Hours && <span><Clock size={13} /> 24 horas</span>}
                    {ad.hasOnlineBooking && (
                      <span className="text-emerald-700 font-bold">
                        <Calendar size={13} /> {ad.agendaHours || 'Agenda activa'}
                      </span>
                    )}
                    {ad.whatsapp && tierConfig.hasWhatsapp && (
                      <span className="text-green-600 font-bold"><MessageCircle size={13} /> WhatsApp activo</span>
                    )}
                  </div>

                  {ad.moderationStatus === AD_MODERATION_STATUS.RECHAZADO && (
                    <div className="mgmt-ad-note tone-danger">
                      <XCircle size={14} />
                      <div>
                        <strong>Moderación rechazó este anuncio.</strong>
                        <p>{ad.rejectionReason || 'Sin motivo informado.'} Corrige los datos y se vuelve a revisar automáticamente al guardar.</p>
                      </div>
                    </div>
                  )}

                  {expiry?.isExpired && (
                    <div className="mgmt-ad-note tone-danger">
                      <CalendarClock size={14} />
                      <div>
                        <strong>Anuncio vencido.</strong>
                        <p>Los anuncios duran 30 días en el mural. Edítalo y guárdalo para renovar su vigencia.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mgmt-ad-actions">
                {/* Solo tiene sentido con las reservas encendidas: sin agenda no
                    hay nada que mostrar y el boton seria una puerta a un vacio. */}
                {ad.hasOnlineBooking && (
                  <button
                    type="button"
                    className="btn-mgmt-agenda"
                    onClick={() => setAdForAgenda(ad)}
                    title="Ver las reservas de este anuncio"
                  >
                    <CalendarClock size={15} />
                    <span>Agenda{adPending > 0 ? ` (${adPending})` : ''}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn-mgmt-upgrade"
                  onClick={() => setAdToUpgrade(ad)}
                  disabled={!canUpgrade}
                  title={canUpgrade ? 'Mejorar el plan con Monedas RepuesTop' : 'Ya está en el plan más alto'}
                >
                  <Zap size={15} />
                  <span>Mejorar plan</span>
                </button>

                <button
                  type="button"
                  className="btn-mgmt-edit"
                  onClick={() => setAdToEdit(ad)}
                  title="Editar los datos del anuncio"
                >
                  <Edit3 size={15} />
                  <span>Editar</span>
                </button>

                <button
                  type="button"
                  className="btn-mgmt-delete"
                  onClick={() => { setDeleteError(''); setAdToDelete(ad); }}
                  title="Dar de baja el anuncio"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Las citas que uno PIDIO, no las que recibio. Sin esta lista quien
          reserva desde el mural no tiene donde ver el estado ni cancelar, y
          cancelar es exclusivo del cliente: el backend le responde 403 al
          dueño del anuncio. */}
      {(myAppointments.length > 0 || appointmentsError) && (
        <div className="my-appointments-block">
          <div className="ads-mgmt-titles">
            <h3 className="my-appointments-title">
              <CalendarClock size={18} className="text-emerald-600" />
              Mis reservas de hora
            </h3>
            <p>Citas que pediste en anuncios del mural. El taller las confirma o las rechaza.</p>
          </div>

          {appointmentsError && (
            <div className="ads-mgmt-state is-error">
              <AlertTriangle size={20} />
              <p>{adErrorMessage(appointmentsError, 'No pudimos cargar tus reservas.')}</p>
              <button type="button" className="btn-ad-phone" onClick={() => loadAppointments()}>
                <RefreshCw size={14} /> Reintentar
              </button>
            </div>
          )}

          {cancelError && (
            <div className="ad-form-error">
              <AlertTriangle size={15} />
              <span>{cancelError}</span>
            </div>
          )}

          <div className="my-appointments-list">
            {myAppointments.map((appointment) => {
              const meta = APPOINTMENT_STATUS_META[appointment.status] || APPOINTMENT_STATUS_META.pending;
              const isClosed = isClosedAppointment(appointment.status);
              const isPast = appointment.date < toIsoDate(new Date());
              return (
                <div key={appointment.id} className={`my-appointment-item tone-${meta.tone}`}>
                  <div className="my-appointment-main">
                    <div className="agenda-appointment-top">
                      <span className={`mgmt-status-pill tone-${meta.tone}`}>{meta.longLabel}</span>
                      {!isClosed && !isPast && (
                        <span className="agenda-appointment-eta">
                          {getTimeUntilLabel(appointment.date, appointment.time)}
                        </span>
                      )}
                    </div>
                    <h5>{appointment.service}</h5>
                    <div className="agenda-appointment-meta">
                      <span><Megaphone size={12} /> {appointment.adTitle}</span>
                      <span><Calendar size={12} /> {formatAgendaDateLong(appointment.date)}</span>
                      <span><Clock size={12} /> {appointment.time}</span>
                    </div>
                  </div>

                  {/* El backend solo deja cancelar mientras siga pending o
                      accepted (`OCUPADOS`); una cita ya cerrada da 400. */}
                  {!isClosed && !isPast && (
                    <button
                      type="button"
                      className="btn-mgmt-delete"
                      disabled={cancellingId === appointment.id}
                      onClick={() => handleCancelMyAppointment(appointment)}
                      title="Cancelar esta reserva"
                    >
                      {cancellingId === appointment.id
                        ? <Loader2 size={15} className="spin-icon" />
                        : <XCircle size={15} />}
                      <span>Cancelar</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {adForAgenda && (
        <AdAgendaModal
          ad={adForAgenda}
          appointments={receivedByAd.get(adForAgenda.id) || []}
          onClose={() => setAdForAgenda(null)}
          onAppointmentUpdated={replaceAppointment}
        />
      )}

      <TokensHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      <RechargeTokensModal
        isOpen={isRechargeModalOpen}
        onClose={() => setIsRechargeModalOpen(false)}
        onRechargeSuccess={(newBalance) => setTokensBalanceState(newBalance)}
      />

      {adToUpgrade && (
        <UpgradeAdRankModal
          ad={adToUpgrade}
          tokensBalance={tokensBalance}
          onClose={() => setAdToUpgrade(null)}
          onOpenRechargeModal={() => setIsRechargeModalOpen(true)}
          onUpgradeSuccess={handleUpgradeSuccess}
          onActivateFeatures={handleActivateFeatures}
        />
      )}

      {adToEdit && (
        <EditAdModal
          ad={adToEdit}
          isOpen={Boolean(adToEdit)}
          upgradedFromTier={upgradedFromTier}
          upgradedToTier={upgradedToTier}
          onClose={closeEditModal}
          onAdUpdated={handleAdUpdated}
        />
      )}

      <CreateAdModal
        isOpen={isCreateModalOpen}
        tokensBalance={tokensBalance}
        onClose={() => setIsCreateModalOpen(false)}
        onAdCreated={handleAdCreated}
      />

      {adToDelete && createPortal(
        <div className="booking-modal-overlay" role="dialog" aria-modal="true">
          <div className="booking-modal-card max-w-sm text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">¿Dar de baja este anuncio?</h3>
            <p className="text-xs text-slate-600 mb-4">
              "{adToDelete.title}" sale del Mural de Anuncios y deja de aparecer en tu gestión. No se puede
              deshacer desde la web: para volver a publicarlo hay que crearlo de nuevo.
            </p>

            {deleteError && (
              <div className="ad-form-error mb-3">
                <AlertTriangle size={14} />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="btn-ad-phone"
                onClick={() => setAdToDelete(null)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-ad-phone bg-red-600 text-white hover:bg-red-700 border-none"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Dando de baja…' : 'Sí, dar de baja'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
