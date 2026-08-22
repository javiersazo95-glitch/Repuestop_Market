import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Megaphone, Plus, Zap, Edit3, Trash2, Eye, AlertTriangle, Search,
  Phone, MessageCircle, Calendar, MapPin, Tag, Clock, RefreshCw,
  Layers, Loader2, CheckCircle2, Clock3, XCircle, CalendarClock
} from 'lucide-react';
import {
  fetchMyAds, deleteAd, adErrorMessage, getTokensBalance
} from '../../services/adsStorage';
import {
  AD_TIERS, AD_TIER_ORDER, AD_MODERATION_STATUS, AD_MODERATION_LABELS,
  SERVICE_CATEGORIES, getAdExpiryInfo, getUpgradableTiers
} from '../../data/automotiveAdsData';
import TokensWalletCard from './TokensWalletCard';
import RechargeTokensModal from './RechargeTokensModal';
import UpgradeAdRankModal from './UpgradeAdRankModal';
import EditAdModal from './EditAdModal';
import CreateAdModal from './CreateAdModal';
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
  const [ads, setAds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tokensBalance, setTokensBalanceState] = useState(() => getTokensBalance());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [tierFilter, setTierFilter] = useState('TODOS');

  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [adToUpgrade, setAdToUpgrade] = useState(null);
  const [adToEdit, setAdToEdit] = useState(null);
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

  useEffect(() => {
    const controller = new AbortController();
    loadAds({ signal: controller.signal });
    return () => controller.abort();
  }, [loadAds]);

  useEffect(() => {
    const handleTokensUpdated = (e) => {
      if (typeof e.detail === 'number') setTokensBalanceState(e.detail);
    };
    window.addEventListener('repuestop_tokens_updated', handleTokensUpdated);
    return () => window.removeEventListener('repuestop_tokens_updated', handleTokensUpdated);
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
        <div className="ads-mgmt-titles">
          <h2>
            <Megaphone size={24} className="text-amber-500" />
            Gestión de anuncios y servicios automotrices
          </h2>
          <p>
            Administra tus publicaciones del Mural de Anuncios, revisa en qué estado está cada una y
            mejora su plan con Fichas RepuesTop.
          </p>
        </div>

        <div className="ads-mgmt-actions">
          <button
            type="button"
            className="btn-ad-phone inline-flex items-center gap-2"
            onClick={() => loadAds()}
            disabled={isLoading}
            title="Volver a consultar el estado de moderación"
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

      <TokensWalletCard
        tokensBalance={tokensBalance}
        onOpenRechargeModal={() => setIsRechargeModalOpen(true)}
      />

      {/* Las metricas siguen el estado de moderacion, que es lo que el usuario no
          puede deducir mirando el mural: ahi solo se ve lo aprobado. */}
      <div className="ads-mgmt-stats-grid">
        <div className="mgmt-stat-card">
          <span className="stat-label">Publicados</span>
          <strong className="stat-number">{counts.live}</strong>
          <small className="stat-sub">Visibles en el mural</small>
        </div>

        <div className="mgmt-stat-card stat-pending">
          <span className="stat-label">En revisión</span>
          <strong className="stat-number">{counts.pending}</strong>
          <small className="stat-sub">Esperando moderación</small>
        </div>

        <div className="mgmt-stat-card stat-rejected">
          <span className="stat-label">Rechazados</span>
          <strong className="stat-number">{counts.rejected}</strong>
          <small className="stat-sub">Corrígelos y se revisan de nuevo</small>
        </div>

        <div className="mgmt-stat-card stat-expiring">
          <span className="stat-label">Por vencer</span>
          <strong className="stat-number">{counts.expiring}</strong>
          <small className="stat-sub">Vencen dentro de 7 días</small>
        </div>
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

          return (
            <div key={ad.id} className={`mgmt-ad-item ${tierConfig.cardTheme}`}>
              <div className="mgmt-ad-left">
                <div className="mgmt-ad-thumb">
                  {coverPhoto
                    ? <img src={coverPhoto} alt="" />
                    : <span className="mgmt-ad-thumb-empty"><Megaphone size={20} /></span>}
                  <span className={`ad-tier-pill pill-${ad.tier}`}>{tierConfig.badge}</span>
                </div>

                <div className="mgmt-ad-info">
                  <div className="mgmt-ad-meta-top">
                    <span className={`mgmt-status-pill tone-${status.tone}`}>
                      <StatusIcon size={12} /> {status.label}
                    </span>
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
                      <span className="text-emerald-700 font-bold"><Calendar size={13} /> Agenda activa</span>
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

                  {(ad.moderationStatus === AD_MODERATION_STATUS.PENDIENTE || isWaitingRecheck) && (
                    <div className="mgmt-ad-note tone-warning">
                      <Clock3 size={14} />
                      <div>
                        <strong>Esperando revisión.</strong>
                        <p>No aparece en el Mural de Anuncios hasta que moderación lo apruebe. Te llega una notificación con el resultado.</p>
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
                <button
                  type="button"
                  className="btn-mgmt-upgrade"
                  onClick={() => setAdToUpgrade(ad)}
                  disabled={!canUpgrade}
                  title={canUpgrade ? 'Mejorar el plan con Fichas RepuesTop' : 'Ya está en el plan más alto'}
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
        />
      )}

      {adToEdit && (
        <EditAdModal
          ad={adToEdit}
          isOpen={Boolean(adToEdit)}
          onClose={() => setAdToEdit(null)}
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
