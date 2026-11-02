import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import '../styles/catalog-browser-web.css';

/**
 * Explorador de categorías del catálogo en escritorio. Es el de la versión móvil (`CategoryBrowserMobile`) con las fotos
 * circulares de cada categoría a la izquierda (lo que antes era la barra superior) y, a la derecha, todas las subcategorías
 * de la elegida con cuántos repuestos tienen. Elegir una categoría solo cambia el panel derecho (no consulta nada): el
 * catálogo se pide cuando se elige una subcategoría o "Ver todo", así no se cargan resultados que nadie pidió.
 *
 * `counts` trae lo publicado por categoría y subcategoría; con patente llega acotado al vehículo, y por eso los contadores
 * bajan. Una subcategoría sin repuestos conserva su color, pero no se puede abrir.
 */
export default function CategoryBrowserWeb({ categories, onPick, counts = {}, normalizeKey = (value) => String(value), vehicleLabel = '' }) {
  const [activeId, setActiveId] = useState(categories[0]?.id);
  const active = categories.find((category) => category.id === activeId) || categories[0];
  if (!active) return null;

  // Cargados los contadores, lo que no aparece tiene 0; mientras cargan (`loaded` falso) no se sabe y nada se apaga.
  const countOf = (category, subcategory) => (counts[category.id]?.loaded ? (counts[category.id].subs?.[normalizeKey(subcategory)] ?? 0) : undefined);
  const totalOf = (category) => (counts[category.id]?.loaded ? (counts[category.id].count ?? 0) : undefined);
  const total = totalOf(active);
  const plural = (n) => `${n} ${n === 1 ? 'repuesto' : 'repuestos'}`;

  return (
    <section className="cbw" aria-label="Explora por categorías">
      <nav className="cbw-left" aria-label="Categorías de repuestos">
        {categories.map((category) => {
          const count = totalOf(category);
          const empty = count === 0;
          return (
            <button
              key={category.id}
              type="button"
              className={`cbw-cat ${category.id === active.id ? 'is-active' : ''} ${empty ? 'is-empty' : ''}`}
              aria-current={category.id === active.id ? 'true' : undefined}
              onClick={() => setActiveId(category.id)}
            >
              <span className="cbw-cat-img"><img src={category.image} alt="" loading="lazy" /></span>
              <span className="cbw-cat-copy">
                <strong>{category.nombre}</strong>
                {count !== undefined && <small>{plural(count)}</small>}
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          );
        })}
      </nav>

      <div className="cbw-right">
        <header className="cbw-head">
          <div>
            <h2>{active.nombre}</h2>
            <p>{vehicleLabel ? `Lo que hay para tu ${vehicleLabel}. Elige una subcategoría.` : 'Elige una subcategoría para ver los repuestos.'}</p>
          </div>
          <button
            type="button"
            className="cbw-all"
            disabled={total === 0}
            onClick={() => onPick({ category: active, subcategory: null })}
            aria-label={`Ver todos los repuestos de ${active.nombre}`}
          >
            {total !== undefined ? `Ver todo (${total})` : 'Ver todo'} <ChevronRight size={15} aria-hidden="true" />
          </button>
        </header>
        <div className="cbw-grid">
          {active.subcategories.map((subcategory) => {
            const count = countOf(active, subcategory);
            const empty = count === 0;
            return (
              <button
                key={subcategory}
                type="button"
                className={`cbw-sub ${empty ? 'is-empty' : ''}`}
                disabled={empty}
                onClick={() => onPick({ category: active, subcategory })}
              >
                <span className="cbw-sub-img"><img src={active.subcategoryImages?.[subcategory] || active.image} alt="" loading="lazy" /></span>
                <span className="cbw-sub-name">{subcategory}</span>
                <span className="cbw-sub-count">{plural(count ?? 0)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
