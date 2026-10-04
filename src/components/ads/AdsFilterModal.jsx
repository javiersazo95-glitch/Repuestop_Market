import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, RotateCcw, SlidersHorizontal, ShieldCheck, Zap, Star,
  Calendar, MessageCircle, AlarmClock
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../data/automotiveAdsData';
import SearchableDropdown from '../SearchableDropdown';

const ALL_BRANDS = 'Todas las marcas';
const ALL_COMMUNES = 'Todas las comunas';

/*
 * Rediseño del 4-oct: en celular es un panel lateral desde la derecha, como los
 * "Filtros Avanzados" de repuestos (ver ads-wall-mobile.css). El orden ya no vive
 * aqui: tiene su propio boton junto al filtro (y su selector en escritorio).
 * Comuna y Marca especialista son desplegables con buscador: en produccion hay
 * muchas y como chips el panel se volvia interminable.
 */

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
  communeOptions = [],
  specialistBrandOptions = [],
  selectedSpecialistBrand = ALL_BRANDS,
  setSelectedSpecialistBrand,
  onlyBooking,
  setOnlyBooking,
  onlyWhatsapp,
  setOnlyWhatsapp,
  only24Hours,
  setOnly24Hours,
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
          {/* Arriba, como "Solo a cotizar" en repuestos: lo que busca quien tiene una urgencia. */}
          <label className={`ads-urgent-card ${only24Hours ? 'is-active' : ''}`}>
            <span className="ads-urgent-icon"><AlarmClock size={16} /></span>
            <span className="ads-urgent-text">
              <strong>Urgencias 24 horas</strong>
              <small>Servicios que atienden a toda hora</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={only24Hours}
              onChange={(e) => setOnly24Hours(e.target.checked)}
              aria-label="Solo urgencias 24 horas"
            />
          </label>

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

          {setSelectedSpecialistBrand && specialistBrandOptions.length > 0 && (
            <div className="ads-filter-group">
              <span className="ads-filter-label">Marca especialista</span>
              <SearchableDropdown
                value={selectedSpecialistBrand}
                options={[ALL_BRANDS, ...specialistBrandOptions].map((brand) => ({ value: brand, label: brand }))}
                placeholder={ALL_BRANDS}
                onChange={(value) => setSelectedSpecialistBrand(value || ALL_BRANDS)}
                emptyText="No encontramos esa marca."
              />
            </div>
          )}

          <div className="ads-filter-group">
            <span className="ads-filter-label">Comuna</span>
            <SearchableDropdown
              value={selectedCommune}
              options={[ALL_COMMUNES, ...communeOptions].map((commune) => ({ value: commune, label: commune }))}
              placeholder={ALL_COMMUNES}
              onChange={(value) => setSelectedCommune(value || ALL_COMMUNES)}
              emptyText="No hay anuncios en esa comuna."
            />
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
