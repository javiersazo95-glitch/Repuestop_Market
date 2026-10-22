import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gavel, Plus, Search, ShieldCheck, Clock, Award, RefreshCw, AlertCircle } from 'lucide-react';
import { getAuctions } from '../services/auctionApi';
import { auctionDetailPath, ROUTES } from '../routes/paths';
import AuctionCard from '../components/AuctionCard';
import CreateAuctionModal from '../components/CreateAuctionModal';
import { useAuth } from '../context/AuthContext';
import '../styles/auctions.css';

export default function AuctionsPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [estadoFilter, setEstadoFilter] = useState('ACTIVA'); // 'ACTIVA' | 'TODAS' | 'FINALIZADA'
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  // Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadAuctions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuctions({
        estado: estadoFilter,
        region: regionFilter || undefined,
        size: 30,
      });
      const list = data?.content || (Array.isArray(data) ? data : []);
      setAuctions(list);
    } catch (err) {
      console.error('Error cargando subastas:', err);
      setError('No pudimos conectar con el servidor de subastas. Verifica tu conexión o reintenta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuctions();
  }, [estadoFilter, regionFilter]);

  const handleOpenAuction = (id) => {
    navigate(auctionDetailPath(id));
  };

  const handleCreatedSuccess = (created) => {
    if (created && created.id) {
      navigate(auctionDetailPath(created.id));
    } else {
      loadAuctions();
    }
  };

  const handleOpenCreateModal = () => {
    if (!isLoggedIn) {
      const shouldLogin = window.confirm('Debes iniciar sesión para publicar una necesidad de compra. ¿Deseas ir a tu cuenta?');
      if (shouldLogin) navigate(ROUTES.profile);
      return;
    }
    setIsCreateModalOpen(true);
  };

  const filteredAuctions = auctions.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const rep = (item.repuestoSolicitado || '').toLowerCase();
    const v = `${item.marca || ''} ${item.modelo || ''} ${item.patenteAnonimizada || ''}`.toLowerCase();
    return rep.includes(q) || v.includes(q);
  });

  return (
    <div className="auctions-page">
      {/* 1. Hero Section */}
      <section className="auctions-hero">
        <div className="auctions-hero-content">
          <div className="auctions-hero-info">
            <div className="auctions-hero-badge">
              <Gavel size={15} />
              <span>Bolsa Pública de Subastas de Repuestos</span>
            </div>

            <h1 className="auctions-hero-title">
              ¿Tu auto te dejó en pana? <br />
              <span className="auctions-hero-title-highlight">
                Subasta tu necesidad y recibe ofertas
              </span>
            </h1>

            <p className="auctions-hero-description">
              Publica el repuesto que buscas con la patente de tu vehículo. Las casas de repuestos verificadas te enviarán sus mejores cotizaciones privadas protegidas.
            </p>

            <div className="auctions-hero-features">
              <div className="auctions-hero-feature">
                <ShieldCheck size={17} />
                <span>Tiendas Verificadas</span>
              </div>
              <div className="auctions-hero-feature">
                <Clock size={17} />
                <span>Respuestas en 24h</span>
              </div>
              <div className="auctions-hero-feature">
                <Award size={17} />
                <span>Compra Protegida RepuesTop</span>
              </div>
            </div>
          </div>

          <div className="auctions-hero-action">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="auctions-btn-publish"
            >
              <Plus size={20} />
              <span>Publicar Necesidad de Repuesto</span>
            </button>
            <span className="auctions-btn-subtext">100% gratuito para compradores</span>
          </div>
        </div>
      </section>

      {/* 2. Barra de Filtros y Búsqueda */}
      <div className="auctions-container">
        <div className="auctions-toolbar-wrapper">
          <div className="auctions-toolbar">
            {/* Pestañas de Estado */}
            <div className="auctions-tabs-group">
              <button
                type="button"
                onClick={() => setEstadoFilter('ACTIVA')}
                className={`auctions-tab-btn ${estadoFilter === 'ACTIVA' ? 'active' : ''}`}
              >
                Subastas Activas
              </button>
              <button
                type="button"
                onClick={() => setEstadoFilter('TODAS')}
                className={`auctions-tab-btn ${estadoFilter === 'TODAS' ? 'active' : ''}`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setEstadoFilter('FINALIZADA')}
                className={`auctions-tab-btn ${estadoFilter === 'FINALIZADA' ? 'active' : ''}`}
              >
                Finalizadas / Adjudicadas
              </button>
            </div>

            {/* Buscador y Refresh */}
            <div className="auctions-search-box">
              <Search size={17} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por repuesto o vehículo..."
                className="auctions-search-input"
              />
            </div>

            <button
              type="button"
              onClick={loadAuctions}
              title="Refrescar lista"
              className="auction-btn-secondary"
              style={{ padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* 3. Listado de Subastas */}
        <main>
          {error ? (
            <div className="auctions-empty-state">
              <div className="auctions-empty-icon" style={{ color: '#dc2626', background: '#fef2f2' }}>
                <AlertCircle size={32} />
              </div>
              <h3 className="auctions-empty-title">Error al cargar las subastas</h3>
              <p className="auctions-empty-desc">{error}</p>
              <button
                type="button"
                onClick={loadAuctions}
                className="auction-btn-primary"
              >
                Reintentar
              </button>
            </div>
          ) : loading ? (
            <div className="auctions-grid">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="auction-card" style={{ height: '360px', opacity: 0.6, background: '#f1f5f9' }} />
              ))}
            </div>
          ) : filteredAuctions.length === 0 ? (
            <div className="auctions-empty-state">
              <div className="auctions-empty-icon">
                <Gavel size={32} />
              </div>
              <h3 className="auctions-empty-title">No hay subastas en esta categoría</h3>
              <p className="auctions-empty-desc">
                Sé el primero en publicar una necesidad de compra o prueba cambiando los filtros de búsqueda.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="auction-btn-primary"
              >
                <Plus size={16} /> Publicar Necesidad de Repuesto
              </button>
            </div>
          ) : (
            <div className="auctions-grid">
              {filteredAuctions.map((auction) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  onOpen={handleOpenAuction}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modal de Publicación */}
      <CreateAuctionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreatedSuccess}
      />
    </div>
  );
}
