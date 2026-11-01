import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import CategoryIconTile from './CategoryIconTile';
import '../styles/catalog-app-mobile.css';

/**
 * Explorador de categorías del celular, el de la pestaña Repuestos de la app (`CategoryBrowser.tsx`): a la izquierda
 * las categorías con su icono y color, una línea divisoria y a la derecha las subcategorías de la elegida como círculos
 * con su foto, 3 por fila. Elegir una subcategoría (o "Ver todo") filtra el catálogo.
 */
export default function CategoryBrowserMobile({ categories, visuals, onPick, counts = {}, normalizeKey = (value) => String(value) }) {
  const [activeId, setActiveId] = useState(categories[0]?.id);
  const active = categories.find((category) => category.id === activeId) || categories[0];
  if (!active) return null;
  const total = counts[active.id]?.count;

  return (
    <div className="cbm" aria-label="Explora por categorías">
      <div className="cbm-left" role="tablist" aria-orientation="vertical">
        {categories.map((category) => {
          const visual = visuals[category.id];
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={category.id === active.id}
              className={category.id === active.id ? 'is-active' : ''}
              onClick={() => setActiveId(category.id)}
            >
              <CategoryIconTile iconName={visual?.iconName} iconUrl={visual?.iconUrl} color={visual?.color} size={18} />
              <span>{category.nombre}</span>
            </button>
          );
        })}
      </div>
      <div className="cbm-right">
        <div className="cbm-head">
          <h3>{active.nombre}</h3>
          <button type="button" className="cbm-all" onClick={() => onPick({ category: active, subcategory: null })} aria-label={`Ver todos los repuestos de ${active.nombre}`}>
            {total !== undefined ? `Ver todo (${total})` : 'Ver todo'} <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="cbm-grid">
          {active.subcategories.map((subcategory) => (
            <button key={subcategory} type="button" className="cbm-sub" onClick={() => onPick({ category: active, subcategory })}>
              <span className="cbm-circle"><img src={active.subcategoryImages?.[subcategory] || active.image} alt="" loading="lazy" /></span>
              <span className="cbm-name">{subcategory}</span>
              <span className="cbm-count">{(counts[active.id]?.subs?.[normalizeKey(subcategory)] ?? 0)} {(counts[active.id]?.subs?.[normalizeKey(subcategory)] ?? 0) === 1 ? 'repuesto' : 'repuestos'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
