import React from 'react';
import { ChevronRight } from 'lucide-react';
import { CATEGORIES } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';

export default function CategoryGrid({ selectedCategory, onSelectCategory }) {
  return (
    <section className="category-section container">
      <div className="section-header">
        <div>
          <span className="section-subtitle">EXPLORA POR CATEGORÍAS ILUSTRADAS</span>
          <h2 className="section-title">Encuentra piezas por sistema automotriz</h2>
        </div>
        {selectedCategory && (
          <button className="clear-filter-btn" onClick={() => onSelectCategory(null)}>
            Ver Todas las Categorías
          </button>
        )}
      </div>

      <div className="category-grid-rich">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;

          return (
            <div
              key={cat.id}
              className={`category-card-rich ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectCategory(isSelected ? null : cat.id)}
            >
              <div className="cat-card-img-wrap">
                <CategoryIconTile iconName={cat.iconName} color={cat.color} image={cat.image} size={40} />
                {cat.badge && <span className="cat-top-tag">{cat.badge}</span>}
              </div>

              <div className="category-content-body">
                <h3 className="cat-title">{cat.nombre}</h3>
                <span className="cat-count-pill">+{cat.count || '10.000 disponibles'}</span>
                
                <div className="cat-sub-preview">
                  {cat.subcategorias ? cat.subcategorias.slice(0, 2).join(' • ') : ''}
                </div>
              </div>

              <div className="category-action-bar">
                <span>Explorar Repuestos</span>
                <ChevronRight size={14} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
