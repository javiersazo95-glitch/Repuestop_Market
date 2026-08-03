import React, { useEffect, useState } from 'react';
import { Store, MapPin, Check, Layers, Star, ArrowRight, Building2, Truck, ShieldCheck, Tag, Package, Zap, Bike, Globe, Clock } from 'lucide-react';
import { NEW_ONBOARDED_STORES } from '../data/liveMarketplaceData';
import { getRecentSellersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function getShippingIconConfig(method) {
  const norm = String(method || '').toLowerCase().trim();

  // 1. Retiro en tienda
  if (norm.includes('retiro') || norm.includes('tienda')) {
    return {
      name: 'Retiro en tienda',
      icon: Building2,
      label: 'Retiro en tienda',
      color: '#7c3aed',
      bg: '#f3f0ff'
    };
  }

  // 2. Envío dentro de la comuna
  if (norm.includes('dentro') || (norm.includes('comuna') && !norm.includes('fuera'))) {
    return {
      name: 'Envío dentro de la comuna',
      icon: Bike,
      label: 'Envío dentro de la comuna',
      color: '#059669',
      bg: '#eafbf1'
    };
  }

  // 3. Envío fuera de la comuna (Camión)
  if (norm.includes('fuera') || norm.includes('region') || norm.includes('región') || norm.includes('nacional') || norm.includes('starken') || norm.includes('chilexpress')) {
    return {
      name: 'Envío fuera de la comuna',
      icon: Truck,
      label: 'Envío fuera de la comuna',
      color: '#0284c7',
      bg: '#e0f2fe'
    };
  }

  return {
    name: method,
    icon: Package,
    label: method,
    color: '#475569',
    bg: '#f1f5f9'
  };
}

export default function NewOnboardedStoresSection({ onOpenSellerModal, onOpenStores, onSelectStore }) {
  const { user } = useAuth();
  const [stores, setStores] = useState(NEW_ONBOARDED_STORES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getRecentSellersApi()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const formattedStores = data.map((item, idx) => ({
            id: item.id || `backend-${idx}`,
            nombre: item.nombre || item.storeName || item.nombreTienda || 'Tienda Vendedora',
            initials: item.initials || getStoreInitials(item.nombre || item.storeName || item.nombreTienda),
            bgColor: item.bgColor || ['#0066ff', '#059669', '#7c3aed', '#d97706'][idx % 4],
            textColor: '#ffffff',
            rut: item.rut || item.taxId || '76.849.210-K',
            tipo: item.tipo || item.giro || 'Casa de Repuestos Multimarca',
            ciudad: item.ciudad || item.comuna || 'Santiago, RM',
            verificadoFecha: item.verificadoFecha || 'Verificada Recientemente',
            totalPublicaciones: item.totalPublicaciones || 1420,
            rating: item.rating || 4.9,
            especialidad: item.especialidad || item.descripcion || 'Toyota, Nissan, Hyundai',
            metodosEnvio: parseShippingMethods(item.metodosEnvio || item.shippingMethods),
            logoUrl: item.logoUrl || item.userProfileUrl || item.imagenUrl,
            userProfileUrl: item.userProfileUrl || item.logoUrl,
            coverUrl: item.coverUrl,
          }));
          setStores(formattedStores);
        }
      })
      .catch((err) => {
        console.warn('Omitiendo fetch de vendedores desde backend (usando dataset local):', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function parseShippingMethods(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw) return ['Retiro en tienda', 'Envío dentro de la comuna', 'Envío fuera de la comuna'];
    return raw
      .split(',')
      .map((method) => method.trim())
      .filter(Boolean);
  }

  function parseSpecialties(raw) {
    if (!raw) return ['Toyota', 'Nissan', 'Hyundai'];
    return String(raw)
      .split(/[,·]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function getStoreInitials(name) {
    if (!name) return 'RT';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2 && words[0][0] && words[1][0]) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  return (
    <section className="new-stores-section container">
      {/* 1. Section Header */}
      <div className="stores-section-header">
        <div className="header-text-group">
          <div className="badge-verified-stores">
            <ShieldCheck size={14} />
            <span>TIENDAS Y DESARMADURÍAS VERIFICADAS</span>
          </div>

          <h2 className="stores-main-title">
            <Building2 size={26} className="inline-icon-building" />
            <span>Últimos Vendedores e Importadores Ingresados</span>
          </h2>

          <p className="stores-description">
            Conoce las tiendas recién integradas a RepuesTop.cl. Verificamos su RUT, documentación comercial y local físico antes de activar su catálogo.
          </p>
        </div>

        <div className="stores-header-actions-group">
          {onOpenStores && (
            <button className="btn-view-directory-blue" onClick={onOpenStores}>
              <span>Ver Directorio Completo →</span>
            </button>
          )}
          <button className="btn-connect-inventory-navy" onClick={onOpenSellerModal}>
            <span>¿Tienes Tienda? Conectar Mi Inventario</span>
          </button>
        </div>
      </div>

      {/* 2. Sellers Grid */}
      <div className="stores-cards-grid">
        {stores.map((store) => {
          const specialties = parseSpecialties(store.especialidad);

          const isCurrentUserStore =
            user &&
            (store.id === user.sellerId ||
             store.id === user.userId ||
             store.id === 'store-tiensoft' ||
             (user.storeName && store.nombre.toLowerCase().includes(user.storeName.toLowerCase())) ||
             (user.userName && store.nombre.toLowerCase().includes(user.userName.toLowerCase())));

          const avatarPhoto = isCurrentUserStore
            ? (user.userProfileUrl || user.logoUrl || store.logoUrl || store.userProfileUrl || store.imagenUrl)
            : (store.logoUrl || store.userProfileUrl || store.imagenUrl);

          const coverPhoto = isCurrentUserStore
            ? (user.coverUrl || store.coverUrl)
            : store.coverUrl;

          return (
            <div key={store.id} className="seller-exact-card seller-horizontal-card">
              {/* Top Banner Accent */}
              <div
                className="seller-card-cover-header"
                style={{
                  backgroundImage: coverPhoto
                    ? `url(${coverPhoto})`
                    : 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0066ff 100%)',
                }}
              >
                <div className="green-onboard-pill store-verified-pill top-right-verified">
                  <ShieldCheck size={13} strokeWidth={2.5} />
                  <span>{store.verificadoFecha}</span>
                </div>
              </div>

              {/* Main Info Row (Avatar + Title + Category) */}
              <div className="seller-card-body-content">
                <div className="seller-avatar-header-row">
                  <div className="seller-avatar-wrapper">
                    {avatarPhoto ? (
                      <div className="seller-avatar-circle seller-photo-avatar">
                        <img src={avatarPhoto} alt={store.nombre} className="seller-avatar-img" />
                      </div>
                    ) : (
                      <div
                        className="seller-avatar-circle seller-gradient-avatar"
                        style={{
                          background: `linear-gradient(135deg, ${store.bgColor || '#0066ff'} 0%, #0f172a 100%)`,
                          color: store.textColor || '#ffffff',
                        }}
                      >
                        <span>{store.initials}</span>
                      </div>
                    )}
                    <div className="seller-avatar-online-dot" title="Tienda Activa en Línea" />
                  </div>

                  <div className="seller-main-title-box">
                    <div className="seller-title-rut-row">
                      <h3 className="seller-name">{store.nombre}</h3>
                      <span className="seller-rut-badge">RUT {store.rut}</span>
                    </div>
                    <span className="seller-type-chip">{store.tipo}</span>
                  </div>
                </div>

                {/* Location & Commercial Address */}
                <div className="seller-type-location-row">
                  <span className="seller-location">
                    <MapPin size={13} className="pin-icon" />
                    <span>{store.ciudad} (Local Físico Verificado)</span>
                  </span>
                </div>

                {/* Specialty Line with Pills */}
                <div className="seller-specialty-pills-row">
                  <span className="spec-label">Especialidad:</span>
                  <div className="specialty-pills-list">
                    {specialties.slice(0, 4).map((spec, i) => (
                      <span key={i} className="specialty-pill">{spec}</span>
                    ))}
                  </div>
                </div>

                {/* Rich 3-Column Metrics Bar */}
                <div className="seller-stats-3col-bar">
                  <div className="stat-col-item">
                    <Package size={14} className="stat-icon-blue" />
                    <div className="stat-text-group">
                      <strong>+{Number(store.totalPublicaciones || 1400).toLocaleString('es-CL')}</strong>
                      <span>Repuestos</span>
                    </div>
                  </div>

                  <div className="stat-col-item">
                    <Star size={14} className="stat-icon-amber" />
                    <div className="stat-text-group">
                      <strong>{store.rating || 4.9} / 5.0</strong>
                      <span>Calificación</span>
                    </div>
                  </div>

                  <div className="stat-col-item">
                    <Clock size={14} className="stat-icon-green" />
                    <div className="stat-text-group">
                      <strong>&lt; 15 min</strong>
                      <span>Respuesta</span>
                    </div>
                  </div>
                </div>

                {/* Shipping Icons Row */}
                <div className="seller-shipping-icons-row">
                  <span className="shipping-label-small">Envíos:</span>
                  <div className="shipping-icons-list">
                    {(store.metodosEnvio || ['Retiro en tienda', 'Envío dentro de la comuna', 'Envío fuera de la comuna']).map((method, i) => {
                      const config = getShippingIconConfig(method);
                      const Icon = config.icon;
                      return (
                        <div
                          key={i}
                          className="shipping-icon-badge"
                          style={{ color: config.color, backgroundColor: config.bg }}
                          title={config.label}
                        >
                          <Icon size={14} />
                          <span className="shipping-tooltip-text">{config.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Full-Width Action Button */}
                <div className="seller-catalog-link-box">
                  <button
                    className="btn-view-catalog-link"
                    onClick={() => onSelectStore?.(store)}
                  >
                    <span>Ver catálogo de tienda</span>
                    <ArrowRight size={14} className="btn-arrow-icon" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
