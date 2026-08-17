import React from 'react';
import {
  SlidersHorizontal, Search, RotateCcw, Wrench, Sparkles,
  Cpu, Disc, Snowflake, Shield, CircleDot, Truck, Key, Cog, Flame,
  CheckCircle2, Crown, Zap, Star, ShieldAlert, Layers, MapPin, Calendar,
  MessageCircle, Clock, Sparkle
} from 'lucide-react';
import { SERVICE_CATEGORIES, AD_TIERS, CHILE_COMMUNES } from '../../data/automotiveAdsData';

export default function AdsFilterSidebar({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedTier,
  setSelectedTier,
  selectedCommune,
  setSelectedCommune,
  onlyBooking,
  setOnlyBooking,
  onlyWhatsapp,
  setOnlyWhatsapp,
  only24Hours,
  setOnly24Hours,
  onResetFilters,
  totalResults
}) {
  return (
    <aside className="ads-filter-sidebar" aria-label="Filtros de Anuncios">
      <div className="ads-filter-header">
        <h3>
          <SlidersHorizontal size={18} />
          Filtros de Búsqueda
        </h3>
        <button
          type="button"
          className="btn-reset-filters"
          onClick={onResetFilters}
          title="Restablecer todos los filtros"
        >
          <RotateCcw size={13} />
          Limpiar
        </button>
      </div>

      {/* Buscador de texto */}
      <div className="filter-group">
        <div className="filter-group-title">
          <Search size={14} className="text-slate-500" />
          <span>Buscar Servicio</span>
        </div>
        <div className="filter-search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder="Ej: Pintura, Escáner, Bosch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filtro de Especialidad Automotriz */}
      <div className="filter-group">
        <div className="filter-group-title">
          <Wrench size={14} className="text-slate-500" />
          <span>Especialidad Automotriz</span>
        </div>
        <div className="filter-category-list">
          {SERVICE_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`filter-category-btn ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm leading-none" role="img" aria-hidden="true">{cat.emoji || '🔧'}</span>
                  <span>{cat.label}</span>
                </span>
                <span className="category-pill-count">{cat.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtro por Categoría / Plan del Anuncio */}
      <div className="filter-group">
        <div className="filter-group-title">
          <Layers size={14} className="text-slate-500" />
          <span>Nivel del Anuncio</span>
        </div>
        <div className="filter-tier-options">
          <div
            className={`tier-filter-chip ${selectedTier === 'TODOS' ? 'active' : ''}`}
            onClick={() => setSelectedTier('TODOS')}
          >
            <Layers size={14} />
            <span>Todos los planes</span>
          </div>

          <div
            className={`tier-filter-chip chip-empresarial ${selectedTier === 'empresarial' ? 'active' : ''}`}
            onClick={() => setSelectedTier('empresarial')}
          >
            <Crown size={15} className="text-emerald-600" />
            <span>Empresarial (Agendamiento)</span>
          </div>

          <div
            className={`tier-filter-chip chip-premium ${selectedTier === 'premium' ? 'active' : ''}`}
            onClick={() => setSelectedTier('premium')}
          >
            <Zap size={15} className="text-purple-600" />
            <span>Premium (WhatsApp directo)</span>
          </div>

          <div
            className={`tier-filter-chip chip-destacada ${selectedTier === 'destacada' ? 'active' : ''}`}
            onClick={() => setSelectedTier('destacada')}
          >
            <Star size={15} className="text-amber-500" />
            <span>Destacada</span>
          </div>

          <div
            className={`tier-filter-chip ${selectedTier === 'basica' ? 'active' : ''}`}
            onClick={() => setSelectedTier('basica')}
          >
            <ShieldAlert size={14} className="text-slate-400" />
            <span>Básica (Gratuita)</span>
          </div>
        </div>
      </div>

      {/* Filtro por Comuna / Ubicación */}
      <div className="filter-group">
        <div className="filter-group-title">
          <MapPin size={14} className="text-slate-500" />
          <span>Comuna / Ubicación</span>
        </div>
        <select
          className="filter-select"
          value={selectedCommune}
          onChange={(e) => setSelectedCommune(e.target.value)}
        >
          {CHILE_COMMUNES.map((comuna) => (
            <option key={comuna} value={comuna}>
              {comuna}
            </option>
          ))}
        </select>
      </div>

      {/* Filtros Especiales / Características */}
      <div className="filter-group">
        <div className="filter-group-title">
          <Sparkles size={14} className="text-slate-500" />
          <span>Características</span>
        </div>

        <label className="filter-checkbox-item">
          <input
            type="checkbox"
            checked={onlyBooking}
            onChange={(e) => setOnlyBooking(e.target.checked)}
          />
          <Calendar size={15} className="text-emerald-600 flex-shrink-0" />
          <span>Permite Agendar Cita en Línea</span>
        </label>

        <label className="filter-checkbox-item">
          <input
            type="checkbox"
            checked={onlyWhatsapp}
            onChange={(e) => setOnlyWhatsapp(e.target.checked)}
          />
          <MessageCircle size={15} className="text-green-600 flex-shrink-0" />
          <span>Contacto rápido por WhatsApp</span>
        </label>

        <label className="filter-checkbox-item">
          <input
            type="checkbox"
            checked={only24Hours}
            onChange={(e) => setOnly24Hours(e.target.checked)}
          />
          <Clock size={15} className="text-blue-600 flex-shrink-0" />
          <span>Atención 24 Horas / Urgencias</span>
        </label>
      </div>
    </aside>
  );
}
