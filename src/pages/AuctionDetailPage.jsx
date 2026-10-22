import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Gavel, Clock, MapPin, Package, Truck, ShieldCheck, Trophy, Lock,
  ChevronLeft, Store, Star, AlertCircle, CheckCircle2, Info
} from 'lucide-react';
import { getAuctionDetail, selectWinningQuote } from '../services/auctionApi';
import { ROUTES } from '../routes/paths';
import { resolveMediaUrl } from '../services/api';
import AuctionQuoteModal from '../components/AuctionQuoteModal';
import { useAuth } from '../context/AuthContext';
import '../styles/auctions.css';

function formatCLP(value) {
  if (value == null) return '';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export default function AuctionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Modal para cotizar (vendedor)
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [buyingQuoteId, setBuyingQuoteId] = useState(null);

  const isSeller = String(user?.role || role || '').toUpperCase() === 'SELLER' || Boolean(user?.sellerId);
  const sellerId = user?.sellerId || user?.proveedorId;

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuctionDetail(id);
      setAuction(data);
    } catch (err) {
      console.error('Error cargando detalle subasta:', err);
      setError(err?.message || 'No pudimos cargar los detalles de esta subasta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  const handleSelectWinningQuote = async (quote) => {
    const confirmMessage = `¿Deseas seleccionar la cotización de "${quote.nombreTienda}" por ${formatCLP(quote.precioFinal || quote.precio)} como GANADORA y proceder a la compra?`;
    if (!window.confirm(confirmMessage)) return;

    setBuyingQuoteId(quote.id);
    try {
      await selectWinningQuote(auction.id, quote.id);
      alert('¡Felicitaciones! Has seleccionado la cotización ganadora. Se ha notificado a la tienda.');
      loadDetail();
    } catch (err) {
      alert(err?.message || 'Error al procesar la selección de la cotización.');
    } finally {
      setBuyingQuoteId(null);
    }
  };

  if (loading) {
    return (
      <div className="auctions-page" style={{ paddingTop: '40px' }}>
        <div className="auctions-container">
          <div className="auctions-empty-state">
            <p>Cargando información de la subasta...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="auctions-page" style={{ paddingTop: '60px' }}>
        <div className="auctions-container">
          <div className="auctions-empty-state">
            <div className="auctions-empty-icon" style={{ color: '#dc2626', background: '#fef2f2' }}>
              <AlertCircle size={32} />
            </div>
            <h3 className="auctions-empty-title">Subasta no disponible</h3>
            <p className="auctions-empty-desc">{error || 'La necesidad de compra no existe o fue retirada.'}</p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.auctions)}
              className="auction-btn-primary"
            >
              Volver a Subastas
            </button>
          </div>
        </div>
      </div>
    );
  }

  const {
    patente,
    marca,
    modelo,
    anio,
    version,
    motor,
    chasis,
    repuestoSolicitado,
    descripcion,
    cantidad,
    tiempoMaximoEnvio,
    tipoEnvio,
    presupuestoMaximo,
    region,
    comuna,
    estado,
    fechaLimite,
    segundosRestantes = 0,
    fotos = [],
    cotizaciones = [],
    esCreador,
    miCotizacion,
    cotizacionGanadoraId,
  } = auction;

  const isFinalizada = estado === 'FINALIZADA';
  const isExpirada = estado === 'EXPIRADA' || (!isFinalizada && segundosRestantes <= 0);
  const fallbackPhoto = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80';
  const currentPhoto = fotos[activePhotoIndex] ? resolveMediaUrl(fotos[activePhotoIndex]) : fallbackPhoto;

  return (
    <div className="auctions-page">
      {/* Barra superior de navegación */}
      <div className="auction-detail-header-bar">
        <div className="auctions-container">
          <div className="auction-breadcrumb">
            <button
              type="button"
              onClick={() => navigate(ROUTES.auctions)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--auc-primary)', fontWeight: 700 }}
            >
              <ChevronLeft size={16} /> Volver a Subastas
            </button>
            <span>/</span>
            <span>{marca} {modelo}</span>
            <span>/</span>
            <span style={{ color: 'var(--auc-navy)', fontWeight: 700 }}>{repuestoSolicitado}</span>
          </div>
        </div>
      </div>

      <div className="auctions-container">
        <div className="auction-detail-layout">
          {/* Columna Principal: Galería, Ficha y Cotizaciones */}
          <div>
            {/* Panel Principal */}
            <div className="auction-card-panel">
              {/* Galería */}
              <div className="auction-gallery-main">
                <img
                  src={currentPhoto}
                  alt={repuestoSolicitado}
                  className="auction-gallery-img"
                />
              </div>

              {fotos.length > 1 && (
                <div className="auction-gallery-thumbs">
                  {fotos.map((f, idx) => (
                    <img
                      key={idx}
                      src={resolveMediaUrl(f)}
                      alt={`Thumb ${idx}`}
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`auction-gallery-thumb ${activePhotoIndex === idx ? 'active' : ''}`}
                    />
                  ))}
                </div>
              )}

              {/* Título y Estado */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                  <span className="auction-card-vehicle-tag" style={{ fontSize: '14px' }}>
                    {marca} {modelo} {anio ? `(${anio})` : ''} {version ? `· ${version}` : ''}
                  </span>
                  <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 700 }}>
                    {patente || 'PATENTE'}
                  </span>
                </div>

                <h1 style={{ fontSize: '26px', fontWeight: 850, color: 'var(--auc-navy)', marginBottom: '12px', lineHeight: 1.25 }}>
                  {repuestoSolicitado}
                </h1>

                {descripcion && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px', fontSize: '14px', lineHeight: 1.5 }}>
                    <strong style={{ display: 'block', color: 'var(--auc-navy)', marginBottom: '6px' }}>
                      Descripción de la falla o requerimiento:
                    </strong>
                    <p style={{ color: '#475569', whiteSpace: 'pre-line' }}>{descripcion}</p>
                  </div>
                )}
              </div>

              {/* Ficha Técnica */}
              <h2 className="auction-panel-title">Ficha del Requerimiento</h2>
              <div className="auction-specs-grid">
                <div className="auction-spec-box">
                  <div className="auction-spec-label">Cantidad</div>
                  <div className="auction-spec-val">{cantidad} un.</div>
                </div>
                <div className="auction-spec-box">
                  <div className="auction-spec-label">Plazo Máx. Envío</div>
                  <div className="auction-spec-val">{tiempoMaximoEnvio || 'A coordinar'}</div>
                </div>
                <div className="auction-spec-box">
                  <div className="auction-spec-label">Tipo de Envío</div>
                  <div className="auction-spec-val">{tipoEnvio || 'Cualquiera'}</div>
                </div>
                <div className="auction-spec-box">
                  <div className="auction-spec-label">Presupuesto Tope</div>
                  <div className="auction-spec-val" style={{ color: '#059669' }}>
                    {presupuestoMaximo ? formatCLP(presupuestoMaximo) : 'Sin tope'}
                  </div>
                </div>
                <div className="auction-spec-box">
                  <div className="auction-spec-label">Ubicación</div>
                  <div className="auction-spec-val">{comuna || region || 'Chile'}</div>
                </div>
                <div className="auction-spec-box">
                  <div className="auction-spec-label">Cierre de Ofertas</div>
                  <div className="auction-spec-val" style={{ fontSize: '12.5px' }}>{formatDate(fechaLimite)}</div>
                </div>
              </div>

              {(motor || chasis) && (
                <div style={{ marginTop: '14px', fontSize: '13px', color: '#64748b' }}>
                  {motor && <span style={{ marginRight: '16px' }}>Motor: <strong>{motor}</strong></span>}
                  {chasis && <span>Chasis/VIN: <strong style={{ fontFamily: 'monospace' }}>{chasis}</strong></span>}
                </div>
              )}
            </div>

            {/* Panel de Cotizaciones Recibidas */}
            <div className="auction-card-panel">
              <h2 className="auction-panel-title">
                <span>Cotizaciones y Ofertas ({cotizaciones.length})</span>
                <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--auc-muted)' }}>
                  {esCreador ? 'Vista de Comprador' : 'Vista Confidencial 🔒'}
                </span>
              </h2>

              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                {esCreador
                  ? 'Revisa las propuestas enviadas por las tiendas verificadas. Cuando te decidas por la mejor opción, pulsa "Comprar esta cotización".'
                  : 'Para resguardar la competencia leal, las cotizaciones se muestran protegidas con candado para tiendas y visitantes.'}
              </p>

              {cotizaciones.length === 0 ? (
                <div className="auctions-empty-state" style={{ padding: '36px 20px' }}>
                  <Gavel size={32} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 700, color: 'var(--auc-navy)' }}>Aún no se registran cotizaciones</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    Las casas de repuestos han sido notificadas y enviarán sus ofertas pronto.
                  </div>
                </div>
              ) : (
                <div className="auction-quotes-list">
                  {cotizaciones.map((quote) => {
                    const isWinner = isFinalizada && (quote.esGanadora || quote.id === cotizacionGanadoraId);

                    return (
                      <div
                        key={quote.id}
                        className={`auction-quote-item ${isWinner ? 'winner' : ''}`}
                      >
                        {isWinner && (
                          <div className="auction-winner-ribbon">
                            <Trophy size={14} />
                            <span>🏆 Cotización Ganadora Adjudicada</span>
                          </div>
                        )}

                        {/* VISTA PRIVADA CON CANDADO */}
                        {quote.esPrivada ? (
                          <div className="auction-quote-locked">
                            <div className="auction-quote-locked-icon">
                              <Lock size={20} />
                            </div>
                            <div className="auction-quote-locked-info">
                              <div className="auction-quote-locked-title">
                                {quote.nombreTienda || 'Tienda Verificada'}
                                {quote.tiendaRating && (
                                  <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--auc-gold)' }}>
                                    ★ {quote.tiendaRating}
                                  </span>
                                )}
                              </div>
                              <div className="auction-quote-locked-desc">
                                Oferta confidencial emitida el {formatDate(quote.fechaEnvio)}. Precios y detalles protegidos.
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* VISTA COMPLETA PARA EL COMPRADOR O TIENDA EMISORA */
                          <div className="auction-quote-visible-content">
                            <div className="auction-quote-top">
                              <div className="auction-quote-store">
                                <div className="auction-quote-store-avatar">
                                  <Store size={20} />
                                </div>
                                <div>
                                  <div className="auction-quote-store-name">{quote.nombreTienda}</div>
                                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                                    Enviada: {formatDate(quote.fechaEnvio)}
                                    {quote.tiendaRating && (
                                      <span style={{ marginLeft: '8px', color: 'var(--auc-gold)', fontWeight: 700 }}>
                                        ★ {quote.tiendaRating}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="auction-quote-price-tag">
                                <div className="auction-quote-price-sub">Precio Cotizado</div>
                                <div className="auction-quote-price-val">
                                  {formatCLP(quote.precioFinal || quote.precio)}
                                </div>
                              </div>
                            </div>

                            {/* Repuesto y Términos */}
                            <div className="auction-quote-product-box">
                              <div>
                                <div className="auction-quote-product-title">
                                  {quote.productoTitulo || 'Repuesto cotizado según requerimiento'}
                                </div>
                                <div className="auction-quote-product-warranty">
                                  Garantía: <strong>{quote.garantia || 'Garantía legal'}</strong> · Plazo: <strong>{quote.tiempoEntrega || 'A coordinar'}</strong>
                                </div>
                              </div>
                            </div>

                            {quote.notas && (
                              <div style={{ fontSize: '13px', background: '#fffbeb', border: '1px solid #fef3c7', padding: '10px 14px', borderRadius: '8px', color: '#92400e', fontStyle: 'italic' }}>
                                "{quote.notas}"
                              </div>
                            )}

                            {/* Botón de Adjudicación / Compra para el Comprador */}
                            {esCreador && !isFinalizada && !isExpirada && (
                              <div className="auction-quote-actions-row">
                                <button
                                  type="button"
                                  onClick={() => handleSelectWinningQuote(quote)}
                                  disabled={buyingQuoteId === quote.id}
                                  className="auction-btn-buy-quote"
                                >
                                  <CheckCircle2 size={17} />
                                  <span>{buyingQuoteId === quote.id ? 'Procesando...' : 'Comprar esta cotización'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Columna Lateral (Sidebar) */}
          <div className="auction-summary-card">
            <div className="auction-card-panel">
              <div className="auction-summary-timer">
                <div className="auction-summary-timer-label">
                  {isFinalizada ? 'Estado de la Subasta' : isExpirada ? 'Subasta Cerrada' : 'Tiempo Restante'}
                </div>
                <div className="auction-summary-timer-digits">
                  {isFinalizada ? 'FINALIZADA 🏆' : isExpirada ? 'EXPIRADA' : 'ACTIVA'}
                </div>
              </div>

              {isSeller && !esCreador && !isFinalizada && !isExpirada && (
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(true)}
                  className="auction-summary-quote-btn"
                >
                  <Gavel size={18} />
                  <span>{miCotizacion ? 'Modificar mi Cotización' : 'Emitir Cotización'}</span>
                </button>
              )}

              <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <ShieldCheck size={18} style={{ color: '#059669' }} />
                  <strong>Transacción 100% Segura</strong>
                </div>
                <p>
                  El comprador paga a través de la plataforma y el dinero se retiene de forma protegida hasta la recepción conforme del repuesto.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para emitir cotización */}
      {isSeller && (
        <AuctionQuoteModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          auction={auction}
          myQuote={miCotizacion}
          sellerId={sellerId}
          onSuccess={() => {
            alert('¡Cotización enviada exitosamente!');
            loadDetail();
          }}
        />
      )}
    </div>
  );
}
