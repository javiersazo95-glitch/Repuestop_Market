import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Megaphone, Plus, Zap, Edit3, Trash2, Eye, AlertTriangle, Search,
  RefreshCw,
  Loader2, CheckCircle2, Clock3, XCircle, CalendarClock, Lock, ChevronRight, PackageOpen,
  GraduationCap
} from 'lucide-react';
import {
  fetchMyAds, deleteAd, adErrorMessage,
  getCachedTokensBalance, fetchTokensBalance, TOKENS_UPDATED_EVENT,
  fetchMyAppointments, updateAppointmentStatus, fetchPublicAd
} from '../../services/adsStorage';
import {
  AD_TIERS, AD_TIER_ORDER, AD_MODERATION_STATUS, AD_MODERATION_LABELS,
  SERVICE_CATEGORIES, getAdExpiryInfo, getUpgradableTiers,
} from '../../data/automotiveAdsData';
import { groupAppointmentsByTime } from '../../utils/appointmentHistory';
import { useAuth } from '../../context/AuthContext';
import { useAutomotiveAccreditation } from '../../hooks/useAutomotiveAccreditation';
import { AccreditationPill } from './AccreditationPill';
import AccreditationModal from './AccreditationModal';
import AdsTutorialModal from './AdsTutorialModal';
import AdAgendaModal from './AdAgendaModal';
import AppointmentsHistoryModal from './AppointmentsHistoryModal';
import AdAppointmentModal from './AdAppointmentModal';
import TokensHistoryModal from './TokensHistoryModal';
import RechargeTokensModal from './RechargeTokensModal';
import UpgradeAdRankModal from './UpgradeAdRankModal';
import EditAdModal from './EditAdModal';
import CreateAdModal from './CreateAdModal';
import CapturerContactCard from '../CapturerContactCard';
import './ads-wall.css';

// Mensaje del gate de publicación según el estado del expediente de servicio
// automotriz. Publicar un anuncio exige el expediente APROBADO (lo valida
// `AnuncioService` en el backend); acá solo se explica y se evita el intento.
const ACCREDITATION_GATE_MESSAGE = {
  SIN_SOLICITUD: 'Acredita tu servicio automotriz para publicar anuncios en el Mural.',
  PENDIENTE: 'Tu acreditación está en revisión. Podrás publicar cuando quede aprobada.',
  POR_CORREGIR: 'Tu acreditación tiene observaciones. Corrígelas para poder publicar.',
  RECHAZADO: 'Tu acreditación fue rechazada. Revisa las observaciones y vuelve a enviarla.'
};

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
  const accreditation = useAutomotiveAccreditation(Boolean(user));
  const [isAccreditationOpen, setIsAccreditationOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [ads, setAds] = useState([]);
  // `GET /anuncios/agendamientos/mias` devuelve en UNA respuesta las reservas de
  // los dos roles: las que le hicieron a mis anuncios y las que yo pedi como
  // cliente. Se separan por `customerUserId`, que es lo unico del DTO que
  // distingue un rol del otro (y el backend impide reservar en el anuncio
  // propio, asi que una cita nunca cae en las dos listas).
  const [appointments, setAppointments] = useState([]);
  const [adForAgenda, setAdForAgenda] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // Reagendar: se abre `AdAppointmentModal` con el anuncio de la cita a mover y,
  // al confirmar la nueva hora, la anterior queda `cancelled`.
  const [rebookState, setRebookState] = useState(null); // { ad, appointmentId } | 'loading'
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
   * puede dejar sin gestion de anuncios a quien nunca uso la agenda.
   */
  const loadAppointments = useCallback(async ({ signal } = {}) => {
    try {
      setAppointments(await fetchMyAppointments({ signal }));
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAds({ signal: controller.signal });
    loadAppointments({ signal: controller.signal });
    return () => controller.abort();
  }, [loadAds, loadAppointments]);

  const sessionUserId = user?.userId ?? user?.id ?? user?.buyerId ?? null;

  const { receivedByAd, pendingReceived } = useMemo(() => {
    const received = new Map();
    appointments.forEach((appointment) => {
      const isMine = sessionUserId != null
        && String(appointment.customerUserId) === String(sessionUserId);
      if (isMine) return;
      const list = received.get(appointment.adId) || [];
      list.push(appointment);
      received.set(appointment.adId, list);
    });
    return {
      receivedByAd: received,
      pendingReceived: appointments.filter(
        (item) => item.status === 'pending'
          && (sessionUserId == null || String(item.customerUserId) !== String(sessionUserId))
      ).length
    };
  }, [appointments, sessionUserId]);

  const replaceAppointment = (saved) => {
    setAppointments((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  };

  // Próximas citas (recibidas + pedidas) para el distintivo del botón "Historial
  // de citas". No cerradas y con fecha/bloque aún por venir.
  const upcomingAppointmentsCount = useMemo(
    () => groupAppointmentsByTime(appointments).upcoming.length,
    [appointments]
  );

  // El gate de publicación: sin expediente aprobado no se abre el formulario.
  // Mientras carga la acreditación se deja pasar para no bloquear en falso; el
  // backend sigue siendo la autoridad final.
  const isAccredited = accreditation.isLoading || accreditation.isApproved;
  const gateMessage = ACCREDITATION_GATE_MESSAGE[accreditation.status]
    || ACCREDITATION_GATE_MESSAGE.SIN_SOLICITUD;
  // La primera Básica de la cuenta no cobra Monedas (lo decide el backend). Si ya
  // hay una Básica publicada, el período gratis ya se usó.
  const hasUsedBasicFreePeriod = useMemo(
    () => ads.some((ad) => ad.tier === 'basica'),
    [ads]
  );

  const handleOpenCreate = () => {
    if (accreditation.isLoading || accreditation.isApproved) {
      setIsCreateModalOpen(true);
      return;
    }
    setIsAccreditationOpen(true);
  };

  const handleRebook = async (appointment) => {
    setRebookState('loading');
    try {
      const ad = await fetchPublicAd(appointment.adId);
      setRebookState({ ad, appointmentId: appointment.id });
    } catch {
      setRebookState(null);
    }
  };

  const handleRebooked = async () => {
    const previousId = rebookState?.appointmentId;
    // La hora anterior se cancela recién cuando la nueva quedó reservada.
    if (previousId) {
      try {
        await updateAppointmentStatus(previousId, 'cancelled');
      } catch {
        // Si la cancelación falla se refleja igual al recargar la lista.
      }
    }
    loadAppointments();
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
          <div className="ads-mgmt-titles-row">
            <div className="ads-mgmt-titles">
              <h2>
                <span className="ads-mgmt-h2-ic"><Megaphone size={20} /></span>
                Gestión de anuncios
              </h2>
              <p>
                Publica servicios automotrices en el Mural, responde las reservas de hora que te
                hacen y administra tus Monedas RepuesTop, todo desde un solo lugar.
              </p>
            </div>

            <div className="ads-mgmt-titles-actions">
              <div className="ads-mgmt-actions-row">
                <button
                  type="button"
                  className="ads-mgmt-refresh"
                  onClick={() => { loadAds(); loadAppointments(); }}
                  disabled={isLoading}
                  title="Volver a consultar el estado de moderación y las reservas"
                >
                  <RefreshCw size={15} className={isLoading ? 'spin-icon' : ''} />
                  <span>Actualizar</span>
                </button>

                {/* Estado del expediente de servicio automotriz, compacto. Es el
                    requisito para publicar: abre el formulario o muestra los datos
                    ya validados. */}
                {!accreditation.isLoading && (
                  <AccreditationPill
                    status={accreditation.status}
                    businessName={accreditation.businessName}
                    reviewNotes={accreditation.reviewNotes}
                    profile={accreditation.profile}
                    onOpen={() => setIsAccreditationOpen(true)}
                  />
                )}
              </div>

              {/* Tutorial: pasos para acreditar y publicar + beneficios del Mural. */}
              <button
                type="button"
                className="ads-mgmt-tutorial"
                onClick={() => setIsTutorialOpen(true)}
              >
                <GraduationCap size={15} />
                <span>Tutorial: cómo publicar y sus beneficios</span>
              </button>
            </div>
          </div>
        </div>

        <CapturerContactCard capturer={user?.captadorPublicidad} context="ads" />
      </div>

      {/* Accesos rápidos a lo ancho, equivalente web de las "action tiles" de
          la app. Van en su propia fila —no dentro de la cabecera— para que no
          compitan por el ancho con la tarjeta del captador. */}
      <div className="ads-mgmt-tiles">
        {onNavigateToMural && (
          <button type="button" className="ads-tile" onClick={onNavigateToMural}>
            <span className="ads-tile-ic"><Eye size={18} /></span>
            <span className="ads-tile-body">
              <strong>Mural público</strong>
              <em>Ver cómo te ven los clientes</em>
            </span>
            <ChevronRight size={15} className="ads-tile-arrow" />
          </button>
        )}

        <button type="button" className="ads-tile" onClick={() => setIsHistoryOpen(true)}>
          <span className="ads-tile-ic">
            <CalendarClock size={18} />
            {upcomingAppointmentsCount > 0 && <i className="ads-tile-badge">{upcomingAppointmentsCount}</i>}
          </span>
          <span className="ads-tile-body">
            <strong>Historial de citas</strong>
            <em>Revisa todas tus reservas</em>
          </span>
          <ChevronRight size={15} className="ads-tile-arrow" />
        </button>

        <button type="button" className="ads-tile" onClick={() => setIsHistoryModalOpen(true)}>
          <span className="ads-tile-ic"><Clock3 size={18} /></span>
          <span className="ads-tile-body">
            <strong>Historial de Monedas</strong>
            <em>Consulta tus movimientos</em>
          </span>
          <ChevronRight size={15} className="ads-tile-arrow" />
        </button>

        <button
          type="button"
          className={`ads-tile ${isAccredited ? 'is-primary' : 'is-locked'}`}
          onClick={handleOpenCreate}
          title={isAccredited ? undefined : gateMessage}
        >
          <span className="ads-tile-ic">{isAccredited ? <Plus size={18} /> : <Lock size={16} />}</span>
          <span className="ads-tile-body">
            <strong>{isAccredited ? 'Publicar anuncio' : 'Acreditar para publicar'}</strong>
            <em>{isAccredited ? 'Crea un nuevo anuncio rápidamente' : 'Acredita tu servicio para el Mural'}</em>
          </span>
          <ChevronRight size={15} className="ads-tile-arrow" />
        </button>
      </div>

      {/* Banda de métricas: 5 segmentos con la marca de color sobre el número. */}
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
            const count = filter.id === 'TODOS'
              ? counts.total
              : ads.filter(filter.match).length;
            return (
              <button
                type="button"
                key={filter.id}
                className={`mgmt-filter-tab ${statusFilter === filter.id ? 'active' : ''}`}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label} ({count})
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

      <div className="ads-mgmt-table-wrap">
        <table className="ads-mgmt-table">
          <thead>
            <tr>
              <th>Anuncio</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Publicado el</th>
              <th>Vence el</th>
              <th>Reservas</th>
              <th className="col-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && ads.length === 0 && (
              <tr className="mgmt-table-msg">
                <td colSpan={7}>
                  <div className="ads-mgmt-state">
                    <Loader2 size={22} className="spin-icon" />
                    <p>Cargando tus anuncios…</p>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && loadError && (
              <tr className="mgmt-table-msg">
                <td colSpan={7}>
                  <div className="ads-mgmt-state is-error">
                    <AlertTriangle size={22} />
                    <p>{adErrorMessage(loadError, 'No pudimos cargar tus anuncios.')}</p>
                    <button type="button" className="btn-ad-phone" onClick={() => loadAds()}>
                      <RefreshCw size={14} /> Reintentar
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && !loadError && filteredAds.length === 0 && (
              <tr className="mgmt-table-msg">
                <td colSpan={7}>
                  <div className="ads-mgmt-state">
                    <span className="ads-mgmt-empty-art"><PackageOpen size={26} /></span>
                    <strong>
                      {ads.length === 0
                        ? 'Aún no tienes anuncios'
                        : 'Ningún anuncio coincide con este filtro'}
                    </strong>
                    <p>
                      {ads.length === 0
                        ? 'Comienza publicando tu primer anuncio y llega a más clientes.'
                        : 'Prueba con otro estado o plan.'}
                    </p>
                    {ads.length === 0 && (
                      <button type="button" className="btn-post-ad" onClick={handleOpenCreate}>
                        {isAccredited ? <Plus size={16} /> : <Lock size={14} />}
                        <span>{isAccredited ? 'Publicar mi primer anuncio' : 'Acreditar para publicar'}</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {filteredAds.map((ad) => {
              const tierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
              // APROBADO pero apagado: lo apago la ultima edicion y espera la
              // nueva revision. Se pinta como pendiente, no como publicado.
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
              const isRejected = ad.moderationStatus === AD_MODERATION_STATUS.RECHAZADO;

              return (
                <React.Fragment key={ad.id}>
                  <tr className="mgmt-ad-row">
                    <td className="col-ad">
                      <div className="mgmt-ad-cell">
                        <span className="mgmt-ad-thumb">
                          {coverPhoto
                            ? <img src={coverPhoto} alt="" />
                            : <span className="mgmt-ad-thumb-empty"><Megaphone size={16} /></span>}
                        </span>
                        <span className="mgmt-ad-cell-txt">
                          <strong>{ad.title}</strong>
                          <small>
                            {catObj?.emoji ? `${catObj.emoji} ` : ''}
                            {ad.categoryLabel || catObj?.label || 'Servicio'} · {ad.commune}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td><span className={`mgmt-ad-plan plan-${ad.tier}`}>{tierConfig.name}</span></td>
                    <td>
                      <span
                        className={`mgmt-status-pill tone-${status.tone}`}
                        title={isRejected ? (ad.rejectionReason || 'Sin motivo informado.') : undefined}
                      >
                        <StatusIcon size={11} /> {status.label}
                      </span>
                    </td>
                    <td className="col-date">{ad.publishedAt || '—'}</td>
                    <td className="col-date">
                      {expiry
                        ? <span className={expiry.isExpired || expiry.daysLeft <= 7 ? 'is-urgent' : ''}>{expiry.label}</span>
                        : '—'}
                    </td>
                    <td className="col-bookings">
                      {ad.hasOnlineBooking ? (
                        <button type="button" className="mgmt-bookings-link" onClick={() => setAdForAgenda(ad)}>
                          {adAppointments.length}{adPending > 0 ? ` · ${adPending} pend.` : ''}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="col-actions">
                      <div className="mgmt-ad-actions">
                        <button
                          type="button"
                          className="btn-mgmt-icon"
                          onClick={() => setAdToUpgrade(ad)}
                          disabled={!canUpgrade}
                          title={canUpgrade ? 'Mejorar el plan con Monedas RepuesTop' : 'Ya está en el plan más alto'}
                        >
                          <Zap size={15} />
                        </button>
                        {ad.hasOnlineBooking && (
                          <button
                            type="button"
                            className="btn-mgmt-icon"
                            onClick={() => setAdForAgenda(ad)}
                            title="Ver las reservas de este anuncio"
                          >
                            <CalendarClock size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-mgmt-icon"
                          onClick={() => setAdToEdit(ad)}
                          title={isRejected ? 'Corregir y reenviar' : 'Editar el anuncio'}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-mgmt-icon is-danger"
                          onClick={() => { setDeleteError(''); setAdToDelete(ad); }}
                          title="Dar de baja el anuncio"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {(isRejected || expiry?.isExpired) && (
                    <tr className="mgmt-ad-note-row">
                      <td colSpan={7}>
                        <div className="mgmt-ad-note tone-danger">
                          {isRejected ? <XCircle size={14} /> : <CalendarClock size={14} />}
                          <div>
                            <strong>{isRejected ? 'Moderación rechazó este anuncio.' : 'Anuncio vencido.'}</strong>
                            <p>
                              {isRejected
                                ? `${ad.rejectionReason || 'Sin motivo informado.'} Corrige los datos y se vuelve a revisar automáticamente al guardar.`
                                : 'Los anuncios duran 30 días en el mural. Edítalo y guárdalo para renovar su vigencia.'}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

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
        accreditationProfile={accreditation.profile}
        hasUsedBasicFreePeriod={hasUsedBasicFreePeriod}
        onClose={() => setIsCreateModalOpen(false)}
        onAdCreated={handleAdCreated}
      />

      {isTutorialOpen && <AdsTutorialModal onClose={() => setIsTutorialOpen(false)} />}

      {isAccreditationOpen && (
        <AccreditationModal
          user={user}
          onSaved={() => accreditation.refresh()}
          onClose={() => { setIsAccreditationOpen(false); accreditation.refresh(); }}
        />
      )}

      {isHistoryOpen && (
        <AppointmentsHistoryModal
          ads={ads}
          appointments={appointments}
          sessionUserId={sessionUserId}
          userEmail={user?.email || ''}
          onClose={() => setIsHistoryOpen(false)}
          onAppointmentUpdated={replaceAppointment}
          onRebook={handleRebook}
        />
      )}

      {rebookState && rebookState !== 'loading' && (
        <AdAppointmentModal
          adOrCompany={rebookState.ad}
          onBooked={handleRebooked}
          onClose={() => setRebookState(null)}
        />
      )}

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
