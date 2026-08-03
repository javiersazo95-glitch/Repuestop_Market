import React, { useState } from 'react';
import {
  Menu, Store,
  Search, CheckCircle2, RefreshCw, AlertCircle,
  Award, Lock, ArrowRight, Check, Star, Building2
} from 'lucide-react';
import { SIDEBAR_CATEGORIES } from '../data/categories';
import { searchVehicleByPatenteApi } from '../services/api';
import { adaptVehicle } from '../services/adapters';
import CategoryIconTile from './CategoryIconTile';

export default function OfficialPatentHero({ activeVehicle, onSelectVehicle, onOpenSellerModal, selectedCategory, onSelectCategory }) {
  const [inputPatente, setInputPatente] = useState(activeVehicle ? activeVehicle.patente : '');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const samplePatentes = [
    { code: 'BB-CL-12', label: 'Toyota RAV4 2021 LE 4WD' },
    { code: 'HG-89-21', label: 'Chevrolet Sail 2018 LT' },
    { code: 'AA-123-BB', label: 'Nissan Qashqai 2020 CVT' }
  ];

  // Identificación real por patente: GET /api/v1/vehiculos/patente/{patente}.
  const handleSearch = async (codeToUse) => {
    const val = codeToUse || inputPatente;
    if (!val || val.trim().length < 3) {
      setErrorMsg('Ingresa una patente válida (ejemplo: BB-CL-12)');
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
              const isSelected = selectedCategory === cat.id;

              return (
                <li
                  key={cat.id}
                  className={`cat-list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectCategory(isSelected ? null : cat.id)}
                >
                  <div className="item-inner">
                    <CategoryIconTile iconName={cat.iconName} color={cat.color} size={14} className="cat-icon-tile" />
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

        {/* HERO CARD — engine photo treated in a sober gray duotone */}
        <div className="hero-parts-shop-card">
          <div className="shop-bg-modern">
            <img
              src="/repuestos_hero_bg.jpg"
              alt="Motor y repuestos automotrices"
              className="shop-bg-photo"
            />
            <div className="shop-bg-duotone-overlay"></div>
            <div className="shop-bg-legibility-overlay"></div>
          </div>

          {/* Foreground Content Focused on Inventory Lookup */}
          <div className="shop-hero-foreground">
            {/* Minimal live-status indicator */}
            <div className="shop-live-tag">
              <span className="live-pulse-dot"></span>
              <span>Búsqueda en tiempo real en la red de vendedores</span>
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
                <span className="preset-label-shop">Probar con:</span>
                <div className="preset-chips-shop">
                  {samplePatentes.map((sample, idx) => (
                    <button
                      key={idx}
                      className="sample-chip-btn-shop"
                      onClick={() => handleSearch(sample.code)}
                      title={sample.label}
                    >
                      {sample.code}
                    </button>
                  ))}
                </div>
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
