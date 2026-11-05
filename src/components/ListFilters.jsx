import React from 'react';
import { ChevronDown } from 'lucide-react';
import '../styles/auctions-list.css';

/** Cuenta cuántas veces aparece cada valor (sin vacíos), de mayor a menor. Solo trae valores con datos. */
export function countBy(rows, pick) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = pick(row);
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value), 'es'));
}

/** Grupo plegable del panel de filtros (el mismo en Encargos y en Fallas). */
export function FilterSection({ id, label, isOpen, onToggle, children }) {
  return (
    <div className={`filter-section-group ${isOpen ? 'is-open' : 'is-collapsed'}`}>
      <button className="filter-group-toggle" type="button" onClick={() => onToggle(id)} aria-expanded={isOpen}>
        <span className="filter-group-label">{label}</span>
        <ChevronDown size={16} />
      </button>
      {isOpen && <div className="aw-filter-body">{children}</div>}
    </div>
  );
}

/** Casilla con conteo del panel de filtros. */
export function CheckRow({ checked, onChange, label, count }) {
  return (
    <label className={`aw-check ${checked ? 'is-checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="aw-check-label">{label}</span>
      {count != null && <span className="aw-check-count">{count}</span>}
    </label>
  );
}
