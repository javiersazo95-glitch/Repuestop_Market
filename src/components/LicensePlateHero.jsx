import React, { useState } from 'react';
import { 
  Car, Search, CheckCircle2, ShieldCheck, Zap, 
  ArrowRight, RefreshCw, AlertCircle, Sparkles, Store, Award, ChevronRight
} from 'lucide-react';
import { searchVehicleByPatente, POPULAR_MARCAS, ANIOS_DISPONIBLES } from '../data/sampleVehicles';

export default function LicensePlateHero({ activeVehicle, onSelectVehicle, onOpenSellerModal }) {
  const [searchTab, setSearchTab] = useState('patente'); // 'patente' | 'manual'
  const [inputPatente, setInputPatente] = useState(activeVehicle ? activeVehicle.patente : '');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Estados para búsqueda manual
  const [selectedMarca, setSelectedMarca] = useState('');
  const [selectedAnio, setSelectedAnio] = useState('');
  const [selectedModelo, setSelectedModelo] = useState('');

  // Patentes sugeridas para prueba rápida
  const samplePatenteChips = [
    { code: 'BB-CL-12', info: 'Toyota RAV4 2021' },
    { code: 'HG-89-21', info: 'Chevrolet Sail 2018' },
    { code: 'AA-123-BB', info: 'Nissan Qashqai 2020' },
    { code: 'DF-77-11', info: 'Ford Ranger 2022' }
  ];

  const handlePatenteSearch = (patenteToUse) => {
    const val = patenteToUse || inputPatente;
    if (!val || val.trim().length < 3) {
      setErrorMsg('Por favor ingresa una patente válida (mínimo 3 caracteres)');
      return;
    }

    setErrorMsg('');
    setIsSearching(true);

    setTimeout(() => {
      const result = searchVehicleByPatente(val);
      if (result) {
        onSelectVehicle(result);
        setInputPatente(result.patente);
      }
      setIsSearching(false);
    }, 400);
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!selectedMarca || !selectedAnio) {
      setErrorMsg('Selecciona al menos Marca y Año para buscar');
      return;
    }
    setErrorMsg('');
    const customVeh = {
      patente: 'GEN-AUTO',
      marca: selectedMarca,
      modelo: selectedModelo || 'Todos los Modelos',
      anio: parseInt(selectedAnio),
      motor: 'Especificación Estándar VVT',
      transmision: 'Automática / Manual',
      vin: 'VIN-MANUAL-SEARCH',
      totalRepuestos: 410,
      imagen: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80'
    };
    onSelectVehicle(customVeh);
  };

  return (
    <section className="license-hero-section">
      <div className="hero-background-decor">
        <div className="glow-circle glow-red"></div>
        <div className="glow-circle glow-purple"></div>
        <div className="grid-overlay"></div>
      </div>

      <div className="container hero-content-grid">
        {/* Left Column: License Plate Search Console */}
        <div className="hero-search-card">
          <div className="hero-badge-top">
            <Sparkles size={14} /> TECNOLOGÍA PATENT-LOOKUP 2.0
          </div>
          
          <h1 className="hero-main-title">
            Ingresa tu <span className="gradient-text">PATENTE</span> y encuentra repuestos exactos para tu auto
          </h1>
          <p className="hero-subtitle">
            Evita devoluciones y compras erróneas. Al ingresar tu patente cargamos las especificaciones de fábrica de tu vehículo de forma instantánea.
          </p>

          {/* Search Tabs */}
          <div className="search-tab-bar">
            <button 
              className={`tab-btn ${searchTab === 'patente' ? 'active' : ''}`}
              onClick={() => setSearchTab('patente')}
            >
              <Car size={16} /> Buscar por Patente (Recomendado)
            </button>
            <button 
              className={`tab-btn ${searchTab === 'manual' ? 'active' : ''}`}
              onClick={() => setSearchTab('manual')}
            >
              <Search size={16} /> Buscar por Marca / Año / Modelo
            </button>
          </div>

          {/* Tab 1: License Plate Input Form */}
          {searchTab === 'patente' ? (
            <div className="patente-form-box">
              <div className="license-plate-display-wrapper">
                <div className="license-plate-frame">
                  <div className="plate-country-badge">
                    <span className="country-flag">🚘</span>
                    <span className="country-code">REPUESTOP</span>
                  </div>
                  <div className="plate-input-container">
                    <input
                      type="text"
                      className="license-plate-input"
                      placeholder="BB · CL · 12"
                      value={inputPatente}
                      onChange={(e) => {
                        setInputPatente(e.target.value.toUpperCase());
                        if (errorMsg) setErrorMsg('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handlePatenteSearch()}
                      maxLength={10}
                    />
                  </div>
                  <div className="plate-rivet top-left"></div>
                  <div className="plate-rivet top-right"></div>
                  <div className="plate-rivet bottom-left"></div>
                  <div className="plate-rivet bottom-right"></div>
                </div>

                <button 
                  className={`search-patente-action-btn ${isSearching ? 'loading' : ''}`}
                  onClick={() => handlePatenteSearch()}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <>
                      <RefreshCw size={20} className="spin-icon" /> Buscando Ficha...
                    </>
                  ) : (
                    <>
                      <span>BUSCAR REPUESTOS</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </div>

              {errorMsg && (
                <div className="hero-error-alert">
                  <AlertCircle size={16} /> {errorMsg}
                </div>
              )}

              {/* Quick Sample Chips */}
              <div className="quick-chips-box">
                <span className="chips-label">Prueba con patentes demo:</span>
                <div className="chips-list">
                  {samplePatenteChips.map((chip, idx) => (
                    <button
                      key={idx}
                      className="sample-plate-chip"
                      onClick={() => handlePatenteSearch(chip.code)}
                    >
                      <span className="chip-code">{chip.code}</span>
                      <span className="chip-info">({chip.info})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: Manual Year Make Model Selectors */
            <form onSubmit={handleManualSearch} className="manual-select-grid">
              <div className="form-group">
                <label>1. Año del Vehículo</label>
                <select 
                  className="hero-select"
                  value={selectedAnio}
                  onChange={(e) => setSelectedAnio(e.target.value)}
                >
                  <option value="">Seleccionar Año</option>
                  {ANIOS_DISPONIBLES.map(anio => (
                    <option key={anio} value={anio}>{anio}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>2. Marca</label>
                <select 
                  className="hero-select"
                  value={selectedMarca}
                  onChange={(e) => setSelectedMarca(e.target.value)}
                >
                  <option value="">Seleccionar Marca</option>
                  {POPULAR_MARCAS.map(marca => (
                    <option key={marca} value={marca}>{marca}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>3. Modelo (Opcional)</label>
                <input 
                  type="text"
                  className="hero-select"
                  placeholder="Ej: RAV4, Corolla, Hilux..."
                  value={selectedModelo}
                  onChange={(e) => setSelectedModelo(e.target.value)}
                />
              </div>

              <button type="submit" className="search-manual-action-btn">
                <Search size={18} /> Filtrar Catálogo
              </button>
            </form>
          )}

          {/* Active Vehicle Status Card */}
          {activeVehicle && (
            <div className="active-vehicle-card">
              <div className="veh-card-header">
                <div className="veh-badge-green">
                  <CheckCircle2 size={16} /> VEHÍCULO SELECCIONADO
                </div>
                <button className="change-veh-link" onClick={() => setSearchTab('patente')}>
                  Cambiar Patente
                </button>
              </div>

              <div className="veh-card-body">
                <div className="veh-image-wrap">
                  <img src={activeVehicle.imagen} alt={activeVehicle.modelo} />
                  <span className="veh-plate-tag">{activeVehicle.patente}</span>
                </div>
                <div className="veh-details-wrap">
                  <h3 className="veh-title">{activeVehicle.marca} {activeVehicle.modelo}</h3>
                  <div className="veh-specs-chips">
                    <span>Year: {activeVehicle.anio}</span>
                    <span>Motor: {activeVehicle.motor}</span>
                    <span>VIN: {activeVehicle.vin}</span>
                  </div>
                  <div className="veh-compatibility-status">
                    <Zap size={14} className="bolt-icon" /> 
                    <span><strong>{activeVehicle.totalRepuestos} repuestos verificados</strong> con 100% de garantía de compatibilidad.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trust Value Badges */}
          <div className="trust-features-row">
            <div className="trust-item">
              <ShieldCheck size={20} className="trust-icon" />
              <div>
                <strong>100% Calce Garantizado</strong>
                <p>Si no calza en tu auto, te devolvemos el dinero.</p>
              </div>
            </div>
            <div className="trust-item">
              <Zap size={20} className="trust-icon" />
              <div>
                <strong>Despacho Express 24h</strong>
                <p>Envíos garantizados a todo el país.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Marketplace Showcase & Seller Promo */}
        <div className="hero-visual-showcase">
          {/* Banner 1: AliExpress Style Seller Recruitment Promo Card */}
          <div className="seller-recruitment-card" onClick={onOpenSellerModal}>
            <div className="recruitment-badge">
              <Store size={14} /> PROGRAMA PARA DISTRIBUIDORES & TIENDAS
            </div>
            <h3 className="recruitment-title">
              ¿Vendes repuestos automotrices o tienes una desarmaduría?
            </h3>
            <p className="recruitment-desc">
              Publica tu inventario en Repuestop y vende a miles de mecánicos y conductores en todo el país.
            </p>
            <div className="recruitment-stats">
              <div className="stat-pill">
                <strong>0%</strong> Comisión primer mes
              </div>
              <div className="stat-pill">
                <strong>+50k</strong> Compradores activos
              </div>
            </div>
            <button className="recruitment-action-btn">
              <span>Registrar Mi Tienda Ahora</span>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Banner 2: Flash Deals Sneak Peek Card */}
          <div className="hero-offer-card">
            <div className="offer-header">
              <span className="flash-tag">⚡ OFERTA DEL DÍA</span>
              <span className="discount-pill">-35% DESC</span>
            </div>
            <div className="offer-product-mini">
              <img 
                src="https://images.unsplash.com/photo-1600793575654-910699b5e4d4?auto=format&fit=crop&w=300&q=80" 
                alt="Pastillas Brembo"
              />
              <div className="offer-info">
                <h4>Pastillas de Freno Cerámicas Brembo Pro</h4>
                <div className="offer-prices">
                  <span className="price-now">$28.990</span>
                  <span className="price-old">$44.990</span>
                </div>
                <div className="stock-meter">
                  <div className="meter-bar" style={{ width: '76%' }}></div>
                </div>
                <span className="stock-text">Quedan solo 12 unidades</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
