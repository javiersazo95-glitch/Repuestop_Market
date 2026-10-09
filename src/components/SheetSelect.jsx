import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X, XCircle } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

const normalize = (text) => String(text || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

// Un <option> nativo no admite estilo propio: el conteo va como texto "(N)" tras la etiqueta.
const withCount = (option) => (option.count != null ? `${option.label} (${option.count})` : option.label);

/**
 * Desplegable de los filtros avanzados.
 *
 * - En movil es el mismo selector de la app (AppPicker): una hoja que sube desde abajo con el
 *   titulo, la barra de busqueda arriba (con mas de 8 opciones, o `searchable`) y la lista con la
 *   opcion elegida marcada. Un `<select>` nativo con las 262 marcas de vehiculo no se puede
 *   recorrer en el telefono.
 * - En escritorio, con `searchable` o `multiple`, es una lista desplegable bajo el campo con la
 *   busqueda rapida arriba (5-oct): marca y modelo del vehiculo, anio, versiones y marca del
 *   repuesto se encuentran escribiendo, sin recorrer la lista entera.
 * - En escritorio sin busqueda, el `<select>` de siempre.
 *
 * `options`: [{ value, label, count? }] con `value` como string. `count` (cuantas publicaciones
 * tiene esa opcion) se muestra solo en la lista, nunca en el campo cerrado. `placeholder` es la opcion vacia
 * ("Todas las marcas") y lo que se muestra mientras no hay nada elegido.
 *
 * Con `multiple` (las versiones del vehiculo) `value` es una lista separada por comas, cada
 * opcion se marca y desmarca sin cerrar, la opcion vacia limpia la seleccion ("Todas") y
 * "Aceptar" cierra.
 */
export default function SheetSelect({
  label,
  value = '',
  options = [],
  placeholder = 'Selecciona una opción',
  onChange,
  disabled = false,
  searchable,
  multiple = false,
  className = 'sidebar-select-input',
  ariaLabel,
}) {
  const isMobile = useIsMobile();
  const isPopover = !isMobile && (multiple || Boolean(searchable));
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const titleId = useId();
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  // Lista desplegable de escritorio: se cierra al hacer clic fuera y el buscador toma el foco.
  useEffect(() => {
    if (!isOpen || !isPopover) return undefined;
    const closeOnOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    requestAnimationFrame(() => searchRef.current?.focus());
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [isOpen, isPopover]);

  // Si cambia el modo (se achica o agranda la ventana) con la lista abierta, se cierra.
  useEffect(() => {
    setIsOpen(false);
  }, [isMobile]);

  const filtered = useMemo(() => {
    const term = normalize(query);
    return term ? options.filter((option) => normalize(option.label).includes(term)) : options;
  }, [options, query]);

  if (!isMobile && !isPopover) {
    return (
      <select
        className={className}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel || label}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{withCount(option)}</option>
        ))}
      </select>
    );
  }

  const selectedValues = multiple ? String(value || '').split(',').filter(Boolean) : [];
  const isSelected = (optionValue) => (multiple ? selectedValues.includes(optionValue) : optionValue === value);
  const selected = multiple ? null : options.find((option) => option.value === value);
  const selectedLabels = multiple
    ? options.filter((option) => selectedValues.includes(option.value)).map((option) => option.label)
    : [];
  const triggerLabel = multiple
    ? (selectedLabels.length === 0 ? placeholder : selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} seleccionadas`)
    : (selected ? selected.label : placeholder);
  const hasValue = multiple ? selectedLabels.length > 0 : Boolean(selected);
  const showSearch = isPopover ? true : (searchable ?? options.length > 8);
  const choose = (next) => {
    if (multiple) {
      if (next === '') {
        onChange?.('');
        return;
      }
      const nextValues = selectedValues.includes(next)
        ? selectedValues.filter((item) => item !== next)
        : [...selectedValues, next];
      onChange?.(nextValues.join(','));
      return;
    }
    onChange?.(next);
    setIsOpen(false);
  };

  const searchBar = showSearch && (
    <div className="sheet-select-search">
      <Search size={18} aria-hidden="true" />
      <input
        ref={searchRef}
        type="search"
        placeholder="Buscar..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          // Enter elige la primera coincidencia: escribir "toy" + Enter deja Toyota.
          if (event.key === 'Enter' && query && filtered.length > 0) {
            event.preventDefault();
            choose(filtered[0].value);
          }
        }}
        aria-label={`Buscar ${(label || '').toLowerCase()}`}
        autoComplete="off"
      />
      {query && (
        <button type="button" onClick={() => setQuery('')} aria-label="Borrar búsqueda">
          <XCircle size={18} />
        </button>
      )}
    </div>
  );

  const optionList = (
    <ul className="sheet-select-list" role="listbox" aria-labelledby={titleId} aria-multiselectable={multiple || undefined}>
      {query === '' && (
        <li>
          <button
            type="button"
            role="option"
            aria-selected={!hasValue}
            className={!hasValue ? 'sheet-select-option is-selected' : 'sheet-select-option'}
            onClick={() => choose('')}
          >
            <span>{placeholder}</span>
            {!hasValue && <Check size={18} aria-hidden="true" />}
          </button>
        </li>
      )}
      {filtered.length === 0 ? (
        <li className="sheet-select-empty">No se encontraron resultados</li>
      ) : filtered.map((option) => {
        const optionSelected = isSelected(option.value);
        return (
          <li key={option.value}>
            <button
              type="button"
              role="option"
              aria-selected={optionSelected}
              className={optionSelected ? 'sheet-select-option is-selected' : 'sheet-select-option'}
              onClick={() => choose(option.value)}
            >
              <span>
                {option.label}
                {option.count != null && <span className="sheet-select-count"> ({option.count})</span>}
              </span>
              {optionSelected && <Check size={18} aria-hidden="true" />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const acceptFooter = multiple && (
    <div className="sheet-select-footer">
      <button type="button" className="sheet-select-accept" onClick={() => setIsOpen(false)}>
        {selectedValues.length ? `Aceptar (${selectedValues.length})` : 'Aceptar'}
      </button>
    </div>
  );

  const trigger = (
    <button
      type="button"
      className={`${className} sheet-select-trigger`}
      disabled={disabled}
      aria-haspopup={isPopover ? 'listbox' : 'dialog'}
      aria-expanded={isOpen}
      aria-label={`${ariaLabel || label}: ${multiple && selectedLabels.length ? selectedLabels.join(', ') : triggerLabel}`}
      onClick={() => setIsOpen((open) => (isPopover ? !open : true))}
    >
      <span className={hasValue ? 'sheet-select-value' : 'sheet-select-value is-placeholder'}>
        {triggerLabel}
      </span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  );

  if (isPopover) {
    return (
      <div className="sheet-select-popover-wrap" ref={wrapperRef}>
        {trigger}
        {isOpen && (
          <div className="sheet-select-popover" role="dialog" aria-label={label || placeholder}>
            <span id={titleId} className="sheet-select-sr">{label || placeholder}</span>
            {searchBar}
            {optionList}
            {acceptFooter}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {trigger}
      {isOpen && createPortal(
        <div className="sheet-select-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="sheet-select-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-select-header">
              <strong id={titleId}>{label || placeholder}</strong>
              <button type="button" className="sheet-select-close" onClick={() => setIsOpen(false)} aria-label="Cerrar">
                <X size={22} />
              </button>
            </div>
            {searchBar}
            {optionList}
            {acceptFooter}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
