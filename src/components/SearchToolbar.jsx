import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Check, Search, SlidersHorizontal, X } from 'lucide-react';
import '../styles/appointments-redesign.css';

/**
 * Buscador en una sola fila: barra de búsqueda, filtro avanzado y orden (como el de la app). Los dos paneles se
 * abren debajo de la fila. Es genérico: cada lista (historial de citas, clientes) le pasa sus secciones de filtro y
 * sus opciones de orden.
 *
 * filterSections: [{ key, label, options: [{ key, label }], value, onPick }]. `activeFilters` es el número del botón.
 */
export default function SearchToolbar({
  text, onTextChange, placeholder, ariaLabel,
  filterSections, activeFilters = 0, onClearFilters,
  sortOptions, sortValue, defaultSort, onSort,
  resultLabel,
}) {
  const [panel, setPanel] = useState(null); // 'filters' | 'sort' | null
  const rootRef = useRef(null);

  useEffect(() => {
    if (!panel) return undefined;
    const onDown = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setPanel(null); };
    const onKey = (event) => { if (event.key === 'Escape') setPanel(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [panel]);

  const toggle = (name) => setPanel((current) => (current === name ? null : name));

  return (
    <div className="stb" ref={rootRef}>
      <div className="stb-row">
        <label className="stb-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel || placeholder}
            autoComplete="off"
          />
          {text && (
            <button type="button" className="stb-clear" onClick={() => onTextChange('')} aria-label="Borrar búsqueda"><X size={15} /></button>
          )}
        </label>
        <button
          type="button"
          className={`stb-btn ${activeFilters > 0 ? 'is-active' : ''}`}
          onClick={() => toggle('filters')}
          aria-expanded={panel === 'filters'}
          aria-label={activeFilters > 0 ? `Filtro avanzado, ${activeFilters} activos` : 'Filtro avanzado'}
          title="Filtro avanzado"
        >
          <SlidersHorizontal size={18} />
          {activeFilters > 0 && <b>{activeFilters}</b>}
        </button>
        <button
          type="button"
          className={`stb-btn ${sortValue !== defaultSort ? 'is-active' : ''}`}
          onClick={() => toggle('sort')}
          aria-expanded={panel === 'sort'}
          aria-label="Ordenar"
          title="Ordenar"
        >
          <ArrowUpDown size={18} />
        </button>
      </div>
      {resultLabel && <small className="stb-count">{resultLabel}</small>}

      {panel === 'filters' && (
        <div className="stb-panel" role="dialog" aria-label="Filtro avanzado">
          {filterSections.map((section) => (
            <div key={section.key} className="stb-section">
              <span>{section.label}</span>
              <div className="stb-chips">
                {section.options.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={section.value === option.key ? 'is-on' : ''}
                    aria-pressed={section.value === option.key}
                    onClick={() => section.onPick(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="stb-actions">
            <button type="button" className="stb-ghost" onClick={onClearFilters}>Limpiar</button>
            <button type="button" className="stb-primary" onClick={() => setPanel(null)}>Listo</button>
          </div>
        </div>
      )}

      {panel === 'sort' && (
        <div className="stb-panel is-sort" role="dialog" aria-label="Ordenar">
          {sortOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={sortValue === option.key ? 'is-on' : ''}
              onClick={() => { onSort(option.key); setPanel(null); }}
            >
              <span>{option.label}</span>
              {sortValue === option.key && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
