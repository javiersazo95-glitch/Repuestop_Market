import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, RotateCcw, SlidersHorizontal, ShieldCheck, Zap, Star,
  Calendar, MessageCircle, Clock
} from 'lucide-react';
import { SERVICE_CATEGORIES, CHILE_COMMUNES } from '../../data/automotiveAdsData';

const SORT_OPTIONS = [
  { label: 'Relevancia (Planes destacados)', value: 'relevancia' },
  { label: 'Más recientes', value: 'recientes' },
  { label: 'Menor precio / tarifa', value: 'precio-menor' },
  { label: 'Mayor precio / tarifa', value: 'precio-mayor' },
];

const TIER_OPTIONS = [
  { value: 'TODOS', label: 'Todos los planes', Icon: null, tone: '' },
  { value: 'empresarial', label: 'Empresarial', Icon: ShieldCheck, tone: 'empresarial' },
  { value: 'premium', label: 'Premium', Icon: Zap, tone: 'premium' },
  { value: 'destacada', label: 'Destacada', Icon: Star, tone: 'destacada' },
  { value: 'basica', label: 'Básica', Icon: null, tone: '' },
];

export default function AdsFilterModal({
  isOpen,
  onClose,
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
  sortBy,
  setSortBy,
  onResetFilters,
  activeFiltersCount = 0,
  totalResults,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="ads-filter-overlay" onClick={onClose}>
      <div
        className="ads-filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Filtros del Mural"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ads-filter-sheet-header">
          <h3><SlidersHorizontal size={20} /> Filtros del Mural</h3>
          <div className="ads-filter-sheet-header-actions">
            <button
              type="button"
              className="ads-filter-reset"
              disabled={activeFiltersCount === 0}
              onClick={() => { onResetFilters(); onClose(); }}
            >
              <RotateCcw size={14} /> Limpiar
            </button>
            <button type="button" className="ads-filter-close" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="ads-filter-sheet-body">
          <div className="ads-filter-group">
            <span className="ads-filter-label">Ordenar por</span>
            <div className="ads-filter-chips">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`ads-filter-chip ${sortBy === opt.value ? 'active' : ''}`}
                  onClick={() => setSortBy(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ads-filter-group">
            <span className="ads-filter-label">Especialidad automotriz</span>
            <div className="ads-filter-chips">
              {SERVICE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`ads-filter-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <span aria-hidden="true">{cat.emoji}</span> {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ads-filter-group">
            <span className="ads-filter-label">Nivel del anuncio</span>
            <div className="ads-filter-chips">
              {TIER_OPTIONS.map(({ value, label, Icon, tone }) => (
                <button
                  key={value}
                  type="button"
                  className={`ads-filter-chip ${tone ? `tone-${tone}` : ''} ${selectedTier === value ? 'active' : ''}`}
                  onClick={() => setSelectedTier(value)}
                >
                  {Icon && <Icon size={13} />} {label}
                </button>
              ))}
            </div>
          </div>

          <div className="ads-filter-group">
            <span className="ads-filter-label">Comuna / Ubicación</span>
            <select
              className="ads-filter-select"
              value={selectedCommune}
              onChange={(e) => setSelectedCommune(e.target.value)}
            >
              {CHILE_COMMUNES.map((commune) => (
                <option key={commune} value={commune}>{commune}</option>
              ))}
            </select>
          </div>

          <div className="ads-filter-group">
            <span className="ads-filter-label">Características especiales</span>
            <label className="ads-filter-toggle">
              <span><Calendar size={16} /> Permite agendar cita en línea</span>
              <input type="checkbox" checked={onlyBooking} onChange={(e) => setOnlyBooking(e.target.checked)} />
            </label>
            <label className="ads-filter-toggle">
              <span><MessageCircle size={16} /> Contacto rápido por WhatsApp</span>
              <input type="checkbox" checked={onlyWhatsapp} onChange={(e) => setOnlyWhatsapp(e.target.checked)} />
            </label>
            <label className="ads-filter-toggle">
              <span><Clock size={16} /> Atención 24 horas / urgencias</span>
              <input type="checkbox" checked={only24Hours} onChange={(e) => setOnly24Hours(e.target.checked)} />
            </label>
          </div>
        </div>

        <div className="ads-filter-sheet-footer">
          <button type="button" className="ads-filter-apply" onClick={onClose}>
            Ver {totalResults} {totalResults === 1 ? 'anuncio' : 'anuncios'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
