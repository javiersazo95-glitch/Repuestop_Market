import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';

/**
 * Desplegable con buscador arriba de la lista. Nacio en el modal de productos
 * (NewCatalogProductModal) y se comparte con los filtros del Mural, donde las
 * comunas y marcas registradas en produccion no caben como chips.
 * Cada opcion puede traer `count` (cuantos hay publicados): se ve solo en la lista.
 */
export default function SearchableDropdown({ value, options, placeholder, onChange, disabled = false, emptyText = 'No hay resultados.', allowCustom = false, customOptionLabel, onCustomOption }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const filtered = options.filter((option) => option.label.toLocaleLowerCase('es').includes(normalizedQuery));
  const selected = options.find((option) => String(option.value) === String(value));

  useEffect(() => {
    const closeOnOutside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

  return <div className={`catalog-search-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
    <button type="button" className="catalog-search-select-trigger" disabled={disabled} onClick={() => { setOpen((current) => !current); setQuery(''); }}>
      <span className={selected || value ? '' : 'catalog-search-select-placeholder'}>{selected?.label || value || placeholder}</span><ChevronDown size={16} />
    </button>
    {open && <div className="catalog-search-select-menu">
      <div className="catalog-search-select-search"><Search size={15} /><input autoFocus value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." /></div>
      <div className="catalog-search-select-options">
        {filtered.map((option) => <button type="button" key={option.value} className={String(option.value) === String(value) ? 'selected' : ''} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}{option.count != null && <span className="catalog-search-select-count"> ({option.count})</span>}</span>{String(option.value) === String(value) && <Check size={15} />}</button>)}
        {allowCustom && query.trim() && !options.some((option) => option.label.toLocaleLowerCase('es') === normalizedQuery) && <button type="button" className="catalog-search-select-custom" onClick={() => { onChange(query.trim().slice(0, 40)); setOpen(false); }}><span>Usar “{query.trim().slice(0, 40)}”</span><Plus size={15} /></button>}
        {customOptionLabel && <button type="button" className="catalog-search-select-custom" onClick={() => { onCustomOption?.(); setOpen(false); }}><span>{customOptionLabel}</span><Plus size={15} /></button>}
        {!filtered.length && !(allowCustom && query.trim()) && <p>{emptyText}</p>}
      </div>
    </div>}
  </div>;
}
