import React, { useState } from 'react';
import { 
  Menu, Cpu, Disc, Activity, GitCommit, Zap, Sun, Shield, 
  Wind, Droplet, Sparkles, Wrench, Store, 
  Search, ShieldCheck, CheckCircle2, RefreshCw, AlertCircle, Sparkles as SparklesIcon, Truck, Award, ChevronRight, Check
} from 'lucide-react';
import { NAVIGATION_CATEGORIES } from '../data/categories';
import { searchVehicleByPatenteApi } from '../services/api';
import { adaptVehicle } from '../services/adapters';

export default function HeroWithSidebar({ activeVehicle, onSelectVehicle, onOpenSellerModal, selectedCategory, onSelectCategory }) {
  const [inputPatente, setInputPatente] = useState(activeVehicle ? activeVehicle.patente : '');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const iconMap = {
    Cpu: Cpu,
    Disc: Disc,
    Activity: Activity,
    GitCommit: GitCommit,
    Zap: Zap,
    Sun: Sun,
    Shield: Shield,
    Wind: Wind,
    Droplet: Droplet,
    Sparkles: Sparkles,
    Wrench: Wrench
  };

  const samplePatenteChips = [
    { code: 'BB-CL-12', info: 'Toyota RAV4 2021' },
    { code: 'HG-89-21', info: 'Chevrolet Sail 2018' },
    { code: 'AA-123-BB', info: 'Nissan Qashqai 2020' },
    { code: 'DF-77-11', info: 'Ford Ranger 2022' }
  ];

  // Identificación real por patente: GET /api/v1/vehiculos/patente/{patente}.
  const handlePatenteSearch = async (codeToUse) => {
    const val = codeToUse || inputPatente;
    if (!val || val.trim().length < 3) {
      setErrorMsg('Por favor ingresa una patente válida (ej: BB-CL-12)');
      return;
    }
    setErrorMsg('');
    setIsSearching(true);

    try {
      const result = adaptVehicle(await searchVehicleByPatenteApi(val.trim()));
      if (result && !result.requiereIngresoManual && result.marca) {
        onSelectVehicle(result);
        setInputPatente(result.patente || val.trim());
      } else {
        setErrorMsg(result?.mensaje || 'No encontramos ese vehículo. Verifica la patente e intenta de nuevo.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo consultar la patente. Intenta nuevamente.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="hero-sidebar-section container">
      <div className="layout-grid-hero">
        {/* Left Sidebar Navigation AliExpress Style */}
        <aside className="sidebar-categories-box">
          <div className="sidebar-header">
            <Menu size={18} />
            <span>Todas las categorías</span>
          </div>

          <ul className="sidebar-list">
            {NAVIGATION_CATEGORIES.map(cat => {
              const IconComp = iconMap[cat.iconName] || Cpu;
              const isSelected = selectedCategory === cat.id;

              return (
                <li 
                  key={cat.id} 
                  className={`sidebar-item ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectCategory(isSelected ? null : cat.id)}
                >
                  <div className="item-left">
                    <IconComp size={16} className="cat-sidebar-icon" />
                    <span>{cat.nombre}</span>
                  </div>
                  <ChevronRight size={14} className="cat-arrow" />
                </li>
              );
            })}
          </ul>

          {/* Sidebar Seller Recruitment Box */}
          <div className="sidebar-seller-box" onClick={onOpenSellerModal}>
            <div className="seller-box-icon">
              <Store size={22} />
            </div>
            <div className="seller-box-content">
              <strong>¿Tienes Tienda de Repuestos?</strong>
              <p>Vende a +50.000 compradores en todo Chile</p>
              <span className="seller-box-link">Registrar Mi Tienda →</span>
            </div>
          </div>
        </aside>

        {/* Right Hero Banner Container (Integrated Layout with Clean Car Graphic & Patent Console) */}
        <div className="hero-banner-integrated">
          <div className="hero-grid-2col">
            {/* Left Column: Patent Search Console */}
            <div className="hero-patent-col">
              <div className="hero-pill-light">
                <SparklesIcon size={14} className="icon-sparkle" />
                <span>TECNOLOGÍA DE COMPATIBILIDAD POR PATENTE 2.0</span>
              </div>

              <h1 className="hero-title-main">
                Encuentra el <span className="blue-highlight">repuesto exacto</span> para tu vehículo
              </h1>

              <p className="hero-subtitle-main">
                Ingresa tu patente y accede a miles de repuestos de cientos de vendedores verificados en todo Chile.
              </p>

              {/* PRIMARY FEATURE: LICENSE PLATE SEARCH CONSOLE */}
              <div className="license-search-card-hero">
                <div className="license-white-bar-hero">
                  <div className="chile-flag-badge-large">
                    <span className="flag-icon">🇨🇱</span>
                    <span className="flag-label">CHILE</span>
                  </div>

                  <div className="plate-input-flex-large">
                    <input
                      type="text"
                      className="plate-main-input-large"
                      placeholder="Ej: BB-CL-12"
                      value={inputPatente}
                      onChange={(e) => {
                        setInputPatente(e.target.value.toUpperCase());
                        if (errorMsg) setErrorMsg('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handlePatenteSearch()}
                    />
                    <span className="required-tag-large">OBLIGATORIO</span>
                  </div>

                  <button 
                    className={`search-red-btn-large ${isSearching ? 'loading' : ''}`}
                    onClick={() => handlePatenteSearch()}
                    disabled={isSearching}
                  >
                    {isSearching ? (
                      <RefreshCw size={20} className="spin-icon" />
                    ) : (
                      <>
                        <span>Buscar repuestos</span>
                        <Search size={20} />
                      </>
                    )}
                  </button>
                </div>

                {errorMsg && (
                  <div className="hero-error-banner-light">
                    <AlertCircle size={14} /> {errorMsg}
                  </div>
                )}

                {/* Preset Sample License Plate Chips */}
                <div className="sample-patente-row">
                  <span className="sample-label">Prueba con estas patentes:</span>
                  <div className="sample-chips-flex">
                    {samplePatenteChips.map((chip, idx) => (
                      <button
                        key={idx}
                        className="sample-chip-btn"
                        onClick={() => handlePatenteSearch(chip.code)}
                      >
                        <span className="chip-code-text">{chip.code}</span>
                        <span className="chip-car-text">({chip.info})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="security-micro-badge-light">
                  <ShieldCheck size={16} className="icon-shield" />
                  <span>Búsqueda 100% segura. No almacenamos tu información.</span>
                </div>
              </div>

              {/* Active Vehicle Status Card */}
              {activeVehicle && (
                <div className="active-vehicle-card-hero">
                  <div className="veh-status-left">
                    <CheckCircle2 size={20} className="icon-check" />
                    <div>
                      <strong>Vehículo Activo: {activeVehicle.marca} {activeVehicle.modelo} ({activeVehicle.patente})</strong>
                      <p>Motor: {activeVehicle.motor} • VIN: {activeVehicle.vin}</p>
                    </div>
                  </div>
                  <div className="veh-status-right">
                    <span className="badge-parts-count">+{activeVehicle.totalRepuestos} repuestos verificados</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Clean, Elegant Automotive Graphic Showcase Card (Framed & Neat) */}
            <div className="hero-visual-card-col">
              <div className="framed-automotive-card">
                <div className="framed-img-wrap">
                  <img 
                    src="https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80" 
                    alt="Repuestos Automotrices Garantizados" 
                    className="framed-car-img"
                  />
                  <div className="framed-gradient-overlay"></div>
                </div>

                {/* Integrated Floating Pills inside the card frame */}
                <div className="framed-badge-pill top">
                  <Award size={16} className="text-gold" />
                  <div>
                    <strong>Calce Garantizado 100%</strong>
                    <span>Piezas directas de fábrica</span>
                  </div>
                </div>

                <div className="framed-badge-pill bottom">
                  <Truck size={16} className="text-cyan" />
                  <div>
                    <strong>Envío Express 24h</strong>
                    <span>A todas las regiones</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Hero Trust Row */}
          <div className="hero-footer-trust-row">
            <div className="trust-pill-item">
              <ShieldCheck size={16} className="text-blue" />
              <span>Garantía de Ajuste por Patente</span>
            </div>
            <div className="trust-pill-item">
              <Truck size={16} className="text-purple" />
              <span>Envío Gratis por compras sobre $39.990</span>
            </div>
            <div className="trust-pill-item">
              <Store size={16} className="text-orange" />
              <span>+1.200 Vendedores & Desarmadurías Verificadas</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
