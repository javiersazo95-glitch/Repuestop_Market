import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, RotateCcw, SlidersHorizontal, ShieldCheck, Zap, Star,
  Calendar, MessageCircle, AlarmClock, Home
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
  // Solo valores con anuncios publicados: [{ value, count }] y conteos por especialidad y plan.
  communeOptions = [],
  categoryOptions = SERVICE_CATEGORIES.filter((cat) => cat.id !== 'TODAS'),
  categoryCounts = null,
  tierCounts = null,
  specialistBrandOptions = [],
  selectedSpecialistBrand = ALL_BRANDS,
  setSelectedSpecialistBrand,
  onlyBooking,
  setOnlyBooking,
  onlyWhatsapp,
  setOnlyWhatsapp,
  only24Hours,
  setOnly24Hours,
  onlyHomeService,
  setOnlyHomeService,
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

          {/* Junto a urgencias: talleres que van donde está el vehículo (`homeService`). */}
          <label className={`ads-urgent-card ${onlyHomeService ? 'is-active' : ''}`}>
            <span className="ads-urgent-icon is-home"><Home size={16} /></span>
            <span className="ads-urgent-text">
              <strong>Servicio a domicilio</strong>
              <small>Van donde está tu vehículo, dentro de su comuna</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={onlyHomeService}
              onChange={(e) => setOnlyHomeService(e.target.checked)}
              aria-label="Solo servicio a domicilio"
            />
          </label>

          <div className="ads-filter-group">
            <span className="ads-filter-label">Especialidad automotriz</span>
            <div className="ads-filter-chips">
              {[SERVICE_CATEGORIES.find((cat) => cat.id === 'TODAS'), ...categoryOptions].filter(Boolean).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`ads-filter-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <span aria-hidden="true">{cat.emoji}</span> {cat.label}
                  {categoryCounts && cat.id !== 'TODAS' && <span className="filter-option-count"> ({categoryCounts[cat.id] || 0})</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="ads-filter-group">
            <span className="ads-filter-label">Nivel del anuncio</span>
            <div className="ads-filter-chips">
              {TIER_OPTIONS.filter(({ value }) => !tierCounts || value === 'TODOS' || tierCounts[value] > 0 || selectedTier === value)
                .map(({ value, label, Icon, tone }) => (
                <button
                  key={value}
                  type="button"
                  className={`ads-filter-chip ${tone ? `tone-${tone}` : ''} ${selectedTier === value ? 'active' : ''}`}
                  onClick={() => setSelectedTier(value)}
                >
                  {Icon && <Icon size={13} />} {label}
                  {tierCounts && value !== 'TODOS' && <span className="filter-option-count"> ({tierCounts[value] || 0})</span>}
                </button>
              ))}
            </div>
          </div>

          {setSelectedSpecialistBrand && specialistBrandOptions.length > 0 && (
            <div className="ads-filter-group">
              <span className="ads-filter-label">Marca especialista</span>
              <SearchableDropdown
                value={selectedSpecialistBrand}
                options={[{ value: ALL_BRANDS, label: ALL_BRANDS }, ...specialistBrandOptions.map(({ value, count }) => ({ value, label: value, count }))]}
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
              options={[{ value: ALL_COMMUNES, label: ALL_COMMUNES }, ...communeOptions.map(({ value, count }) => ({ value, label: value, count }))]}
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
