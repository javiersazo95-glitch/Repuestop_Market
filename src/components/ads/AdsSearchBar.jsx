import React, { useEffect, useRef, useState } from 'react';
import { Search, Car, X, MapPin, RefreshCw, Loader2, Settings, History } from 'lucide-react';
import { formatVehicleLabel } from '../../utils/vehicleLookup';

const SUGGESTION_META = {
  servicio: { Icon: Search, hint: 'Servicio' },
  taller: { Icon: Search, hint: 'Taller' },
  categoria: { Icon: Settings, hint: 'Categoría' },
  comuna: { Icon: MapPin, hint: 'Comuna' },
};

/*
 * Barra unica del Mural: lupa (servicio) y auto (patente) sobre el mismo campo.
 * La patente no es un modo fijo: al identificarla, la barra vuelve a servicio y el
 * vehiculo queda como chip adentro, asi el texto busca DENTRO de los talleres de
 * esa marca ("frenos" entre los especialistas Toyota) en vez de reemplazarlos.
 */
export default function AdsSearchBar({
  mode,
  onModeChange,
  searchInput,
  onSearchInputChange,
  onSubmitSearch,
  onClearSearch,
  suggestions,
  onSelectSuggestion,
  plateQuery,
  onPlateQueryChange,
  onSubmitPlate,
  isPlateSearching,
  plateVehicle,
  onRemoveVehicle,
  recentPlates,
  onPickRecentPlate,
  isNearbyActive,
  isLocating,
  onToggleNearby,
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const isPlateMode = mode === 'plate';

  useEffect(() => {
    const onClickOutside = (e) => {
      if (!rootRef.current?.contains(e.target)) setIsFocused(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Al cambiar de modo el foco queda en el campo para escribir de inmediato.
  const switchMode = (next) => {
    onModeChange(next);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = () => {
    setIsFocused(false);
    if (isPlateMode) onSubmitPlate();
    else onSubmitSearch();
  };

  const visibleRecentPlates = recentPlates.filter((plate) => plate !== plateVehicle?.patente);
  const showServiceSuggestions = !isPlateMode && isFocused && suggestions.length > 0;
  const showRecentPlates = isPlateMode && isFocused && !plateQuery && visibleRecentPlates.length > 0;

  return (
    <div className={`ads-sb ${isPlateMode ? 'is-plate' : ''}`} ref={rootRef}>
      <div className="ads-sb-field">
        {isPlateMode ? (
          <span className="ads-sb-plate-flag" aria-hidden="true">CL</span>
        ) : plateVehicle ? (
          <span className="ads-sb-vehicle">
            <button
              type="button"
              className="ads-sb-vehicle-label"
              onClick={() => switchMode('plate')}
              title="Cambiar patente"
            >
              <Car size={14} />
              <span>{formatVehicleLabel(plateVehicle)}</span>
            </button>
            <button
              type="button"
              className="ads-sb-vehicle-remove"
              onClick={onRemoveVehicle}
              aria-label="Quitar vehículo"
            >
              <X size={13} />
            </button>
          </span>
        ) : (
          <Search size={17} className="ads-sb-lead-icon" aria-hidden="true" />
        )}

        {isPlateMode ? (
          <input
            ref={inputRef}
            type="text"
            className="ads-sb-input ads-sb-input--plate"
            placeholder="Ingresa tu patente · Ej: ABCD12"
            value={plateQuery}
            maxLength={8}
            aria-label="Patente"
            onChange={(e) => onPlateQueryChange(e.target.value.toUpperCase())}
            onFocus={() => setIsFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') switchMode('service');
            }}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            className="ads-sb-input"
            placeholder={plateVehicle ? '¿Qué servicio necesitas para tu vehículo?' : '¿Qué servicio o taller necesitas?'}
            value={searchInput}
            aria-label="Buscar servicio"
            onChange={(e) => onSearchInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        )}

        {!isPlateMode && searchInput && (
          <button type="button" className="ads-sb-icon-btn" onClick={onClearSearch} aria-label="Limpiar búsqueda">
            <X size={15} />
          </button>
        )}
        {isPlateMode && (
          <button type="button" className="ads-sb-icon-btn" onClick={() => switchMode('service')} aria-label="Volver a buscar servicios">
            <X size={15} />
          </button>
        )}
        {!isPlateMode && (
          <button
            type="button"
            className={`ads-sb-icon-btn ads-sb-nearby ${isNearbyActive ? 'active' : ''}`}
            onClick={onToggleNearby}
            disabled={isLocating}
            aria-pressed={isNearbyActive}
            aria-label={isNearbyActive ? 'Quitar el orden por cercanía' : 'Ver los avisos más cercanos a mi ubicación'}
            title={isNearbyActive ? 'Quitar el orden por cercanía' : 'Cerca de mí'}
          >
            {isLocating ? <RefreshCw size={15} className="spin-icon" /> : <MapPin size={16} />}
          </button>
        )}

        {showServiceSuggestions && (
          <div className="ads-suggestions">
            {suggestions.map((s) => {
              const meta = SUGGESTION_META[s.type] || SUGGESTION_META.servicio;
              const MetaIcon = meta.Icon;
              return (
                <button
                  key={`${s.type}-${s.label}`}
                  type="button"
                  className="ads-suggestion-row"
                  onClick={() => { setIsFocused(false); onSelectSuggestion(s.label); }}
                >
                  <MetaIcon size={15} />
                  <span className="ads-suggestion-text">{s.label}</span>
                  <span className="ads-suggestion-hint">{meta.hint}</span>
                </button>
              );
            })}
          </div>
        )}
        {showRecentPlates && (
          <div className="ads-suggestions">
            {visibleRecentPlates.map((plate) => (
              <button
                key={plate}
                type="button"
                className="ads-suggestion-row"
                onClick={() => { setIsFocused(false); onPickRecentPlate(plate); }}
              >
                <History size={15} />
                <span className="ads-suggestion-text ads-sb-plate-text">{plate}</span>
                <span className="ads-suggestion-hint">Reciente</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="ads-sb-action ads-sb-action--primary"
        onClick={submit}
        disabled={isPlateMode && isPlateSearching}
        aria-label={isPlateMode ? 'Identificar patente' : 'Buscar'}
        title={isPlateMode ? 'Identificar patente' : 'Buscar'}
      >
        {isPlateMode && isPlateSearching ? <Loader2 size={18} className="spin-icon" /> : <Search size={18} />}
      </button>
      <button
        type="button"
        className={`ads-sb-action ads-sb-action--plate ${isPlateMode || plateVehicle ? 'active' : ''}`}
        onClick={() => switchMode(isPlateMode ? 'service' : 'plate')}
        aria-pressed={isPlateMode}
        aria-label={isPlateMode ? 'Volver a buscar servicios' : 'Buscar por patente'}
        title={isPlateMode ? 'Volver a buscar servicios' : 'Buscar por patente'}
      >
        <Car size={18} />
      </button>
    </div>
  );
}
