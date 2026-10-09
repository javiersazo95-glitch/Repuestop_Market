import React, { useState } from 'react';
import {
  SlidersHorizontal, RotateCcw, X, ChevronDown, Car, Layers, Wrench, Settings,
  MapPin, Clock, ShieldCheck, Zap, Star, Calendar, MessageCircle, AlarmClock, Home, CheckCircle2
} from 'lucide-react';
import SearchableDropdown from '../SearchableDropdown';
import { getCategoryIcon } from './categoryIcons';
import { formatVehicleLabel } from '../../utils/vehicleLookup';

export const ALL_BRANDS = 'Todas las marcas';
export const ALL_COMMUNES = 'Todas las comunas';
export const ALL_TAGS = 'Todos los servicios';

const TIER_OPTIONS = [
  { value: 'TODOS', label: 'Todos los planes', Icon: null, tone: '' },
  { value: 'empresarial', label: 'Empresarial', Icon: ShieldCheck, tone: 'empresarial' },
  { value: 'premium', label: 'Premium', Icon: Zap, tone: 'premium' },
  { value: 'destacada', label: 'Destacada', Icon: Star, tone: 'destacada' },
  { value: 'basica', label: 'Básica', Icon: null, tone: '' },
];

/*
 * Panel de filtros del Mural, a la izquierda como los "Filtros Avanzados" del
 * catalogo de repuestos (mismas clases de index.css). En celular el mismo panel
 * se abre como cajon lateral (ver ads-wall-mobile.css); ya no hay modal aparte.
 */
function FilterSection({ id, icon: Icon, label, isOpen, onToggle, children }) {
  return (
    <div className={`filter-section-group ${isOpen ? 'is-open' : 'is-collapsed'}`}>
      <button className="filter-group-toggle" type="button" onClick={() => onToggle(id)} aria-expanded={isOpen}>
        <span className="filter-group-label"><Icon size={13} /> {label}</span><ChevronDown size={16} />
      </button>
      {isOpen && <div className="ads-fs-body">{children}</div>}
    </div>
  );
}

function SwitchCard({ icon: Icon, iconClass = '', title, hint, checked, onChange, disabled = false }) {
  return (
    <label className={`ads-urgent-card ads-fs-switch ${checked ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <span className={`ads-urgent-icon ${iconClass}`}><Icon size={15} /></span>
      <span className="ads-urgent-text">
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={title}
      />
    </label>
  );
}

export default function AdsFiltersSidebar({
  isMobileOpen,
  onCloseMobile,
  activeFiltersCount,
  onResetFilters,
  totalResults,
  // Vehiculo por patente
  plateVehicle,
  includeMultibrand,
  setIncludeMultibrand,
  onChangePlate,
  onRemoveVehicle,
  // Categoria
  categoryOptions,
  categoryCounts,
  selectedCategory,
  onSelectCategory,
  // Servicio, marca y comuna (desplegables con buscador)
  serviceTagOptions,
  selectedServiceTag,
  setSelectedServiceTag,
  specialistBrandOptions,
  selectedSpecialistBrand,
  setSelectedSpecialistBrand,
  communeOptions,
  selectedCommune,
  setSelectedCommune,
  isNearbyActive,
  isLocating,
  onToggleNearby,
  // Disponibilidad
  only24Hours,
  setOnly24Hours,
  onlyHomeService,
  setOnlyHomeService,
  onlyBooking,
  setOnlyBooking,
  onlyWhatsapp,
  setOnlyWhatsapp,
  // Plan
  tierCounts,
  selectedTier,
  setSelectedTier,
  children,
}) {
  const [openSections, setOpenSections] = useState({
    vehicle: true,
    category: true,
    service: true,
    brand: true,
    location: true,
    availability: true,
    tier: false,
  });
  const toggleSection = (id) => setOpenSections((current) => ({ ...current, [id]: !current[id] }));

  return (
    <aside
      id="ads-filter-panel"
      className={`ads-sidebar ${isMobileOpen ? 'mobile-filters-open' : ''}`}
      aria-label="Filtros del Mural"
    >
      <div className="catalog-sidebar-filters catalog-advanced-filter-panel ads-filters-panel">
        <button type="button" className="ads-fs-mobile-close" onClick={onCloseMobile}>
          <X size={19} /> Cerrar filtros
        </button>
        <div className="sidebar-filters-header">
          <div className="sidebar-title-group">
            <SlidersHorizontal size={25} />
            <span><strong>Filtros</strong><small>Encuentra el taller o servicio ideal</small></span>
          </div>
          <div className="filter-panel-header-actions">
            <button type="button" className="btn-reset-filters-mini" onClick={onResetFilters} disabled={activeFiltersCount === 0}>
              <RotateCcw size={15} />
              <span>Limpiar</span>
            </button>
          </div>
        </div>

        {plateVehicle && (
          <FilterSection id="vehicle" icon={Car} label="Tu vehículo" isOpen={openSections.vehicle} onToggle={toggleSection}>
            <div className="ads-fs-vehicle">
              <CheckCircle2 size={18} />
              <span>
                <strong>{formatVehicleLabel(plateVehicle)}</strong>
                <small>Patente {plateVehicle.patente}</small>
              </span>
            </div>
            <SwitchCard
              icon={Wrench}
              iconClass="is-home"
              title="Incluir talleres multimarca"
              hint={`Además de los especialistas en ${plateVehicle.marca}`}
              checked={includeMultibrand}
              onChange={setIncludeMultibrand}
            />
            <div className="ads-fs-vehicle-actions">
              <button type="button" onClick={onChangePlate}>Cambiar patente</button>
              <button type="button" onClick={onRemoveVehicle}><X size={13} /> Quitar</button>
            </div>
          </FilterSection>
        )}

        <FilterSection id="category" icon={Layers} label="Categoría" isOpen={openSections.category} onToggle={toggleSection}>
          <div className="filter-options-list ads-fs-categories">
            <button
              type="button"
              className={`filter-option-btn ${selectedCategory === 'TODAS' ? 'active' : ''}`}
              onClick={() => onSelectCategory('TODAS')}
            >
              <span className="ads-fs-cat-icon"><Layers size={14} /></span>
              <span className="filter-option-copy"><strong>Todas las categorías</strong></span>
              {selectedCategory === 'TODAS' && <CheckCircle2 size={18} className="check-active" />}
            </button>
            {categoryOptions.map((cat) => {
              const CatIcon = getCategoryIcon(cat.id);
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`filter-option-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectCategory(isSelected ? 'TODAS' : cat.id)}
                >
                  <span className="ads-fs-cat-icon"><CatIcon size={14} /></span>
                  <span className="filter-option-copy">
                    <strong>{cat.label}<span className="filter-option-count"> ({categoryCounts[cat.id] || 0})</span></strong>
                  </span>
                  {isSelected && <CheckCircle2 size={18} className="check-active" />}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {serviceTagOptions.length > 0 && (
          <FilterSection id="service" icon={Wrench} label="Servicio" isOpen={openSections.service} onToggle={toggleSection}>
            <SearchableDropdown
              value={selectedServiceTag}
              options={[{ value: ALL_TAGS, label: ALL_TAGS }, ...serviceTagOptions.map(({ value, count }) => ({ value, label: value, count }))]}
              placeholder={ALL_TAGS}
              onChange={(value) => setSelectedServiceTag(value || ALL_TAGS)}
              emptyText="No encontramos ese servicio."
            />
          </FilterSection>
        )}

        {specialistBrandOptions.length > 0 && (
          <FilterSection id="brand" icon={Settings} label="Marca especialista" isOpen={openSections.brand} onToggle={toggleSection}>
            <SearchableDropdown
              value={plateVehicle ? plateVehicle.marca : selectedSpecialistBrand}
              options={[{ value: ALL_BRANDS, label: ALL_BRANDS }, ...specialistBrandOptions.map(({ value, count }) => ({ value, label: value, count }))]}
              placeholder={ALL_BRANDS}
              onChange={(value) => setSelectedSpecialistBrand(value || ALL_BRANDS)}
              disabled={Boolean(plateVehicle)}
              emptyText="No encontramos esa marca."
            />
            {plateVehicle && <p className="ads-fs-note">Definida por tu patente.</p>}
          </FilterSection>
        )}

        <FilterSection id="location" icon={MapPin} label="Ubicación" isOpen={openSections.location} onToggle={toggleSection}>
          <SearchableDropdown
            value={selectedCommune}
            options={[{ value: ALL_COMMUNES, label: ALL_COMMUNES }, ...communeOptions.map(({ value, count }) => ({ value, label: value, count }))]}
            placeholder={ALL_COMMUNES}
            onChange={(value) => setSelectedCommune(value || ALL_COMMUNES)}
            emptyText="No hay anuncios en esa comuna."
          />
          <SwitchCard
            icon={MapPin}
            iconClass="is-home"
            title="Cerca de mí"
            hint="Ordena del más cercano al más lejano"
            checked={isNearbyActive}
            disabled={isLocating}
            onChange={onToggleNearby}
          />
        </FilterSection>

        <FilterSection id="availability" icon={Clock} label="Disponibilidad" isOpen={openSections.availability} onToggle={toggleSection}>
          <SwitchCard icon={AlarmClock} title="Urgencias 24 horas" checked={only24Hours} onChange={setOnly24Hours} />
          <SwitchCard icon={Home} iconClass="is-home" title="Servicio a domicilio" checked={onlyHomeService} onChange={setOnlyHomeService} />
          <SwitchCard icon={Calendar} iconClass="is-home" title="Agenda en línea" checked={onlyBooking} onChange={setOnlyBooking} />
          <SwitchCard icon={MessageCircle} iconClass="is-whatsapp" title="Contacto por WhatsApp" checked={onlyWhatsapp} onChange={setOnlyWhatsapp} />
        </FilterSection>

        <FilterSection id="tier" icon={ShieldCheck} label="Nivel del anuncio" isOpen={openSections.tier} onToggle={toggleSection}>
          <div className="ads-filter-chips">
            {TIER_OPTIONS.filter(({ value }) => value === 'TODOS' || tierCounts[value] > 0 || selectedTier === value)
              .map(({ value, label, Icon, tone }) => (
                <button
                  key={value}
                  type="button"
                  className={`ads-filter-chip ${tone ? `tone-${tone}` : ''} ${selectedTier === value ? 'active' : ''}`}
                  onClick={() => setSelectedTier(value)}
                >
                  {Icon && <Icon size={13} />} {label}
                  {value !== 'TODOS' && <span className="filter-option-count"> ({tierCounts[value] || 0})</span>}
                </button>
              ))}
          </div>
        </FilterSection>

        <button type="button" className="ads-fs-mobile-apply" onClick={onCloseMobile}>
          Ver {totalResults} {totalResults === 1 ? 'anuncio' : 'anuncios'}
        </button>
      </div>

      {children}
    </aside>
  );
}
