import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Megaphone, Plus, Coins, Zap, Star, Crown, Edit3, Trash2,
  Eye, CheckCircle2, AlertTriangle, ArrowUpRight, Search,
  Phone, MessageCircle, Calendar, MapPin, Tag, Clock, RefreshCw,
  Layers, ShieldAlert
} from 'lucide-react';
import {
  getStoredAds, deleteAdInStorage, getTokensBalance,
  setTokensBalance, createAdInStorage, updateAdInStorage
} from '../../services/adsStorage';
import { AD_TIERS, SERVICE_CATEGORIES } from '../../data/automotiveAdsData';
import TokensWalletCard from './TokensWalletCard';
import RechargeTokensModal from './RechargeTokensModal';
import UpgradeAdRankModal from './UpgradeAdRankModal';
import EditAdModal from './EditAdModal';
import CreateAdModal from './CreateAdModal';
import './ads-wall.css';

export default function AdsManagementSection({
  onNavigateToMural,
  user
}) {
  const [ads, setAds] = useState(() => getStoredAds());
  const [tokensBalance, setTokensBalanceState] = useState(() => getTokensBalance());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState('TODOS');

  // Modales
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [adToUpgrade, setAdToUpgrade] = useState(null);
  const [adToEdit, setAdToEdit] = useState(null);
  const [adToDelete, setAdToDelete] = useState(null);

  // Escuchar eventos globales de sincronización
  useEffect(() => {
    const handleAdsUpdated = (e) => {
      if (e.detail) setAds(e.detail);
    };
    const handleTokensUpdated = (e) => {
      if (typeof e.detail === 'number') setTokensBalanceState(e.detail);
    };

    window.addEventListener('repuestop_ads_updated', handleAdsUpdated);
    window.addEventListener('repuestop_tokens_updated', handleTokensUpdated);

    return () => {
      window.removeEventListener('repuestop_ads_updated', handleAdsUpdated);
      window.removeEventListener('repuestop_tokens_updated', handleTokensUpdated);
    };
  }, []);

  const handleRechargeSuccess = (newBalance) => {
    setTokensBalanceState(newBalance);
  };

  const handleUpgradeSuccess = (adId, newTier, newBalance) => {
    setTokensBalanceState(newBalance);
    const updated = ads.map((ad) => (ad.id === adId ? { ...ad, tier: newTier, hasOnlineBooking: newTier === 'empresarial' } : ad));
    setAds(updated);
    setAdToUpgrade(null);
  };

  const handleAdCreated = (newAd) => {
    const updated = createAdInStorage(newAd);
    setAds(updated);
    setIsCreateModalOpen(false);
  };

  const handleAdUpdated = (adId, updatedFields) => {
    const updated = ads.map((ad) => (ad.id === adId ? { ...ad, ...updatedFields } : ad));
    setAds(updated);
    setAdToEdit(null);
  };

  const handleDeleteConfirm = () => {
    if (!adToDelete) return;
    const updated = deleteAdInStorage(adToDelete.id);
    setAds(updated);
    setAdToDelete(null);
  };

  const filteredAds = useMemo(() => {
    let list = [...ads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((ad) =>
        (ad.title && ad.title.toLowerCase().includes(q)) ||
        (ad.company && ad.company.toLowerCase().includes(q)) ||
        (ad.commune && ad.commune.toLowerCase().includes(q))
      );
    }
    if (selectedTierFilter !== 'TODOS') {
      list = list.filter((ad) => ad.tier === selectedTierFilter);
    }
    return list;
  }, [ads, searchQuery, selectedTierFilter]);

  // Métricas
  const totalAds = ads.length;
  const activeEmpresariales = ads.filter((a) => a.tier === 'empresarial').length;
  const activePremiums = ads.filter((a) => a.tier === 'premium').length;
  const activeDestacados = ads.filter((a) => a.tier === 'destacada').length;

  return (
    <div className="profile-panel ads-management-panel">
      {/* 1. Header del Panel de Gestión */}
      <div className="ads-mgmt-header">
        <div className="ads-mgmt-titles">
          <h2>
            <Megaphone size={24} className="text-amber-500" />
            Gestión de Anuncios y Servicios Automotrices
          </h2>
          <p>
            Administra tus publicaciones en el Mural de Anuncios, actualiza contactos, recarga Fichas RepuesTop y mejora el rango de tus avisos.
          </p>
        </div>

        <div className="ads-mgmt-actions">
          {onNavigateToMural && (
            <button
              type="button"
              className="btn-ad-phone inline-flex items-center gap-2"
              onClick={onNavigateToMural}
            >
              <Eye size={16} />
              <span>Ver Mural Público</span>
            </button>
          )}

          <button
            type="button"
            className="btn-post-ad inline-flex items-center gap-2"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={18} />
            <span>Publicar Nuevo Anuncio</span>
          </button>
        </div>
      </div>

      {/* 2. Monedero de Fichas RepuesTop */}
      <TokensWalletCard
        tokensBalance={tokensBalance}
        onOpenRechargeModal={() => setIsRechargeModalOpen(true)}
      />

      {/* 3. Métricas Rápidas */}
      <div className="ads-mgmt-stats-grid">
        <div className="mgmt-stat-card">
          <span className="stat-label">Total Publicaciones</span>
          <strong className="stat-number">{totalAds}</strong>
          <small className="stat-sub">Anuncios en el mural</small>
        </div>

        <div className="mgmt-stat-card stat-empresarial">
          <span className="stat-label">Rango Empresarial</span>
          <strong className="stat-number">{activeEmpresariales}</strong>
          <small className="stat-sub">Con agendamiento activo</small>
        </div>

        <div className="mgmt-stat-card stat-premium">
          <span className="stat-label">Rango Premium</span>
          <strong className="stat-number">{activePremiums}</strong>
          <small className="stat-sub">Con WhatsApp directo</small>
        </div>

        <div className="mgmt-stat-card stat-destacada">
          <span className="stat-label">Rango Destacado</span>
          <strong className="stat-number">{activeDestacados}</strong>
          <small className="stat-sub">Visibilidad destacada</small>
        </div>
      </div>

      {/* 4. Barra de Búsqueda y Filtros */}
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
          <button
            type="button"
            className={`mgmt-filter-tab inline-flex items-center gap-1.5 ${selectedTierFilter === 'TODOS' ? 'active' : ''}`}
            onClick={() => setSelectedTierFilter('TODOS')}
          >
            <Layers size={13} />
            <span>Todos ({totalAds})</span>
          </button>
          <button
            type="button"
            className={`mgmt-filter-tab inline-flex items-center gap-1.5 ${selectedTierFilter === 'empresarial' ? 'active' : ''}`}
            onClick={() => setSelectedTierFilter('empresarial')}
          >
            <Crown size={13} className="text-emerald-500" />
            <span>Empresariales ({activeEmpresariales})</span>
          </button>
          <button
            type="button"
            className={`mgmt-filter-tab inline-flex items-center gap-1.5 ${selectedTierFilter === 'premium' ? 'active' : ''}`}
            onClick={() => setSelectedTierFilter('premium')}
          >
            <Zap size={13} className="text-purple-500" />
            <span>Premium ({activePremiums})</span>
          </button>
          <button
            type="button"
            className={`mgmt-filter-tab inline-flex items-center gap-1.5 ${selectedTierFilter === 'destacada' ? 'active' : ''}`}
            onClick={() => setSelectedTierFilter('destacada')}
          >
            <Star size={13} className="text-amber-500" />
            <span>Destacadas ({activeDestacados})</span>
          </button>
          <button
            type="button"
            className={`mgmt-filter-tab inline-flex items-center gap-1.5 ${selectedTierFilter === 'basica' ? 'active' : ''}`}
            onClick={() => setSelectedTierFilter('basica')}
          >
            <ShieldAlert size={13} className="text-slate-400" />
            <span>Básicas ({ads.filter((a) => a.tier === 'basica').length})</span>
          </button>
        </div>
      </div>

      {/* 5. Listado de Anuncios en Gestión */}
      <div className="ads-mgmt-list">
        {filteredAds.length > 0 ? (
          filteredAds.map((ad) => {
            const tierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;
            const coverPhoto = ad.images?.[0] || 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=400&auto=format&fit=crop&q=80';
            const catObj = SERVICE_CATEGORIES.find((c) => c.id === ad.category);

            return (
              <div key={ad.id} className={`mgmt-ad-item ${tierConfig.cardTheme}`}>
                <div className="mgmt-ad-left">
                  <div className="mgmt-ad-thumb">
                    <img src={coverPhoto} alt="" />
                    <span className={`ad-tier-pill pill-${ad.tier}`}>
                      {tierConfig.badge}
                    </span>
                  </div>

                  <div className="mgmt-ad-info">
                    <div className="mgmt-ad-meta-top">
                      <span className="mgmt-ad-cat">
                        {catObj?.emoji ? `${catObj.emoji} ` : ''}{ad.categoryLabel || catObj?.label || 'Mecánica'}
                      </span>
                      <span className="mgmt-ad-date">Publicado: {ad.publishedAt || 'Reciente'}</span>
                    </div>

                    <h4 className="mgmt-ad-title">{ad.title}</h4>

                    <div className="mgmt-ad-icons-row">
                      <span><MapPin size={13} /> {ad.commune}, {ad.address}</span>
                      <span><Phone size={13} /> {ad.phone}</span>
                      <span><Tag size={13} /> {ad.priceText}</span>
                      {ad.hasOnlineBooking && (
                        <span className="text-emerald-700 font-bold"><Calendar size={13} /> Agendamiento Activo</span>
                      )}
                      {ad.whatsapp && (ad.tier === 'premium' || ad.tier === 'empresarial') && (
                        <span className="text-green-600 font-bold"><MessageCircle size={13} /> WhatsApp Activo</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mgmt-ad-actions">
                  <button
                    type="button"
                    className="btn-mgmt-upgrade"
                    onClick={() => setAdToUpgrade(ad)}
                    title="Mejorar rango con Fichas RepuesTop"
                  >
                    <Zap size={15} />
                    <span>Mejorar Rango</span>
                  </button>

                  <button
                    type="button"
                    className="btn-mgmt-edit"
                    onClick={() => setAdToEdit(ad)}
                    title="Editar datos del anuncio"
                  >
                    <Edit3 size={15} />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    className="btn-mgmt-delete"
                    onClick={() => setAdToDelete(ad)}
                    title="Eliminar anuncio"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center my-4">
            <p className="text-slate-500 text-sm mb-4">No tienes anuncios que coincidan con la búsqueda.</p>
            <button
              type="button"
              className="btn-post-ad mx-auto"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus size={16} /> Publicar Nuevo Anuncio
            </button>
          </div>
        )}
      </div>

      {/* MODAL: Recargar Fichas */}
      <RechargeTokensModal
        isOpen={isRechargeModalOpen}
        onClose={() => setIsRechargeModalOpen(false)}
        onRechargeSuccess={handleRechargeSuccess}
      />

      {/* MODAL: Mejorar Rango de Anuncio */}
      {adToUpgrade && (
        <UpgradeAdRankModal
          ad={adToUpgrade}
          tokensBalance={tokensBalance}
          onClose={() => setAdToUpgrade(null)}
          onOpenRechargeModal={() => setIsRechargeModalOpen(true)}
          onUpgradeSuccess={handleUpgradeSuccess}
        />
      )}

      {/* MODAL: Editar Anuncio */}
      {adToEdit && (
        <EditAdModal
          ad={adToEdit}
          isOpen={Boolean(adToEdit)}
          onClose={() => setAdToEdit(null)}
          onAdUpdated={handleAdUpdated}
        />
      )}

      {/* MODAL: Publicar Anuncio */}
      <CreateAdModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAdCreated={handleAdCreated}
      />

      {/* MODAL: Confirmar Eliminación */}
      {adToDelete && createPortal(
        <div className="booking-modal-overlay" role="dialog" aria-modal="true">
          <div className="booking-modal-card max-w-sm text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">¿Eliminar este anuncio?</h3>
            <p className="text-xs text-slate-600 mb-6">
              "{adToDelete.title}" será removido definitivamente del Mural de Anuncios.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="btn-ad-phone"
                onClick={() => setAdToDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-ad-phone bg-red-600 text-white hover:bg-red-700 border-none"
                onClick={handleDeleteConfirm}
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
