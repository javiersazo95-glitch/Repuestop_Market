import React, { useState } from 'react';
import { 
  Menu, Cpu, Disc, Activity, GitCommit, Zap, Sun, Shield, 
  Wind, Droplet, Sparkles, Wrench, Store, 
  Search, ShieldCheck, CheckCircle2, RefreshCw, AlertCircle, 
  Truck, Award, Lock, ArrowRight, Check, Star, Building2, Layers, Database
} from 'lucide-react';
import { SIDEBAR_CATEGORIES } from '../data/categories';
import { searchVehicleByPatente } from '../data/sampleVehicles';

export default function OfficialPatentHero({ activeVehicle, onSelectVehicle, onOpenSellerModal, selectedCategory, onSelectCategory }) {
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

  const samplePatentes = [
    { code: 'BB-CL-12', label: 'Toyota RAV4 2021 LE 4WD' },
    { code: 'HG-89-21', label: 'Chevrolet Sail 2018 LT' },
    { code: 'AA-123-BB', label: 'Nissan Qashqai 2020 CVT' },
    { code: 'DF-77-11', label: 'Ford Ranger 2022 XLT 4x4' }
  ];

  const handleSearch = (codeToUse) => {
    const val = codeToUse || inputPatente;
    if (!val || val.trim().length < 3) {
      setErrorMsg('Ingresa una patente válida (ejemplo: BB-CL-12)');
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
    }, 300);
  };

  return (
    <section className="official-hero-section container">
      <div className="hero-layout-grid">
        {/* Left Sidebar Navigation */}
        <aside className="sidebar-categories-card">
          <div className="sidebar-title-header">
            <Menu size={18} />
            <span>Categorías de Repuestos</span>
          </div>

          <ul className="sidebar-categories-list">
            {SIDEBAR_CATEGORIES.map(cat => {
              const IconComp = iconMap[cat.iconName] || Cpu;
              const isSelected = selectedCategory === cat.id;

              return (
                <li 
                  key={cat.id} 
                  className={`cat-list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectCategory(isSelected ? null : cat.id)}
                >
                  <div className="item-inner">
                    <span className="cat-emoji">{cat.emoji}</span>
                    <span>{cat.nombre}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="sidebar-seller-cta" onClick={onOpenSellerModal}>
            <Store size={22} className="seller-cta-icon" />
            <div>
              <strong>¿Vendes repuestos en Chile?</strong>
              <p>Conecta tu sistema de inventario y vende más.</p>
              <span className="seller-link">Conectar Mi Inventario →</span>
            </div>
          </div>
        </aside>

        {/* HERO CARD WITH EXACT USER-PROVIDED AUTO PARTS WAREHOUSE BACKGROUND */}
        <div className="hero-parts-shop-card">
          {/* User-Provided Real Auto Parts Warehouse Shelves Background Image */}
          <div className="shop-bg-image-container">
            <img 
              src="/repuestos_warehouse_bg.jpg" 
              alt="Bodega de Repuestos Automotrices Chile" 
              className="shop-main-bg-img"
            />
            <div className="inventory-vivid-overlay"></div>
          </div>

          {/* Foreground Content Focused on Inventory Lookup */}
          <div className="shop-hero-foreground">
            {/* Top Live Inventory System Header */}
            <div className="shop-badge-header-row">
              <div className="shop-live-tag">
                <Database size={16} className="text-yellow" />
                <span>SISTEMA DE INVENTARIO CONECTADO EN TIEMPO REAL CON VENDEDORES</span>
              </div>

              <div className="shop-stock-tag">
                <Layers size={14} /> +450.000 Repuestos en Stock Digital
              </div>
            </div>

            {/* Clear Title Focused on Inventory System & Vendors */}
            <h1 className="shop-hero-title">
              Busca en el <span className="yellow-highlight-text">inventario de vendedores</span> <br />
              con la patente de tu vehículo
            </h1>

            <p className="shop-hero-subtitle">
              Al ingresar tu patente, nuestro sistema consulta en vivo las bodegas e inventarios digitales de las mejores casas de repuestos de Chile.
            </p>

            {/* FLOATING INVENTORY SEARCH CONSOLE CARD */}
            <div className="shop-patent-floating-card">
              <div className="license-plate-white-frame-shop">
                <div className="chile-flag-badge-shop">
                  <span className="flag">🇨🇱</span>
                  <span className="country">CHILE</span>
                </div>

                <div className="plate-input-group-shop">
                  <input
                    type="text"
                    className="input-patente-shop"
                    placeholder="Ej: BB-CL-12"
                    value={inputPatente}
                    onChange={(e) => {
                      setInputPatente(e.target.value.toUpperCase());
                      if (errorMsg) setErrorMsg('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <span className="req-tag-shop">OBLIGATORIO</span>
                </div>

                <button 
                  className={`btn-search-red-shop ${isSearching ? 'loading' : ''}`}
                  onClick={() => handleSearch()}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <RefreshCw size={18} className="spin-icon" />
                  ) : (
                    <>
                      <span>CONSULTAR INVENTARIO</span>
                      <Search size={18} />
                    </>
                  )}
                </button>
              </div>

              {errorMsg && (
                <div className="patent-error-msg-shop">
                  <AlertCircle size={14} /> {errorMsg}
                </div>
              )}

              {/* Quick Patente Presets */}
              <div className="preset-patentes-bar-shop">
                <span className="preset-label-shop">Probar patentes en el inventario:</span>
                <div className="preset-chips-shop">
                  {samplePatentes.map((sample, idx) => (
                    <button
                      key={idx}
                      className="sample-chip-btn-shop"
                      onClick={() => handleSearch(sample.code)}
                    >
                      <strong className="code">🚘 {sample.code}</strong>
                      <span className="desc">({sample.label})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Connected Stores Inventory Micro Badges */}
            <div className="shop-stores-footer-row">
              <div className="store-footer-pill">
                <Database size={14} className="text-cyan" />
                <span>Inventario Autopartes San Cristóbal (Stock Sincronizado)</span>
              </div>
              <div className="store-footer-pill">
                <ShieldCheck size={14} className="text-green" />
                <span>Bodega Desarmaduría San Antonio (RUT Verificado)</span>
              </div>
              <div className="store-footer-pill">
                <Truck size={14} className="text-yellow" />
                <span>Tienda Valparaíso (Envíos 24h a Regiones)</span>
              </div>
            </div>

            {/* Active Vehicle Status Pill */}
            {activeVehicle && (
              <div className="active-vehicle-card-shop">
                <CheckCircle2 size={18} className="check-icon" />
                <span>Ficha de Inventario Cargada: <strong>{activeVehicle.marca} {activeVehicle.modelo} ({activeVehicle.patente})</strong> • +{activeVehicle.totalRepuestos} repuestos detectados en stock</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
