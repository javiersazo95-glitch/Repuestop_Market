import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/** Campo de texto con sugerencias locales para las cabeceras de catálogo. */
export default function TextSearchWithSuggestions({ value, onChange, suggestions = [], placeholder = 'Buscar repuestos' }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const query = String(value || '').trim().toLocaleLowerCase('es-CL');
  const matches = query
    ? suggestions.filter((item) => item.label.toLocaleLowerCase('es-CL').includes(query)).slice(0, 6)
    : [];

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!ref.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  return (
    <div className="catalog-text-search" ref={ref}>
      <Search size={17} aria-hidden="true" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => { onChange(event.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        aria-label="Buscar repuestos por texto"
        aria-autocomplete="list"
        aria-expanded={isOpen && matches.length > 0}
      />
      {value && <button type="button" onClick={() => { onChange(''); setIsOpen(false); }} aria-label="Limpiar búsqueda"><X size={14} /></button>}
      {isOpen && matches.length > 0 && (
        <ul className="catalog-text-search-suggestions" role="listbox">
          {matches.map((item, index) => (
            <li key={`${item.type || 'resultado'}-${item.label}-${index}`}>
              <button type="button" onClick={() => { onChange(item.label); setIsOpen(false); }}>
                <span>{item.type === 'category' ? 'Categoría' : 'Repuesto'}</span>
                <strong>{item.label}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
