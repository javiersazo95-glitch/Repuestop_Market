import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown, ArrowUpRight, Boxes, CheckCircle, ChevronLeft, ChevronRight, Plus, RotateCcw, Search, SlidersHorizontal, X,
} from 'lucide-react';
import CatalogCard from './CatalogCard';
import ProductTopBadge from './ProductTopBadge';
import { EmptyState, LoadingRow, CATALOG_PAGE_SIZE_OPTIONS } from './ProfileDashboard';

const STATUS_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'paused', label: 'Pausados' },
  { key: 'low', label: 'Stock bajo' },
  { key: 'out', label: 'Sin stock' },
];

/**
 * Pestaña "Catálogo Publicado" (productos) del panel de perfil. Extraccion
 * SOLO presentacional, a diferencia del resto de las piezas del refactor: el
 * estado del catalogo (pagina, busqueda, query) y el modal de "Agregar
 * producto" siguen en ProfileDashboard porque el checklist y las acciones
 * rapidas de Resumen TAMBIEN los disparan (setShowNewProductModal se llama
 * desde ahi), asi que no se pueden mover sin romper esa integracion. Aun asi
 * saca ~110 lineas de JSX del archivo principal.
 */
export default function ProfileCatalogPanel({
  sellerProducts,
  catalogTotalElements,
  catalogTotalPages,
  isCatalogLoading,
  catalogError,
  catalogTopFeedback,
  catalogSearchInput,
  setCatalogSearchInput,
  catalogSearchTerm,
  catalogCategories,
  catalogTotalInventory,
  catalogCategoryId,
  onCategoryChange,
  onSearchSubmit,
  catalogPage,
  setCatalogPage,
  catalogPageSize,
  onPageSizeChange,
  inventoryPanelUrl,
  questionCountForProduct,
  onSelectProduct,
  onOpenQuestionsForProduct,
  onAddProduct,
  onToggleTop,
  updatingTopProductId,
  onTogglePause,
  updatingPauseProductId,
  onDeleteProduct,
  deletingProductId,
  catalogStatusFilter = 'all',
  onStatusFilterChange,
  catalogSort = 'default',
  onSortChange,
  catalogPartBrand = '',
  onPartBrandChange,
  catalogPartBrands = [],
  catalogVehicleBrand = '',
  onVehicleBrandChange,
  catalogVehicleBrands = [],
  catalogYear = '',
  onYearChange,
  catalogYears = [],
  onClearFilters,
}) {
  const categories = Array.isArray(catalogCategories) ? catalogCategories : [];
  const activeCategory = categories.find(
    (category) => String(category.categoriaId) === String(catalogCategoryId)
  );
  // El contador de "Todas" es el inventario completo, NO `catalogTotalElements`: ese ya viene
  // acotado por el filtro activo, asi que al elegir una categoria "Todas" mostraba el mismo
  // numero que la categoria elegida. Si el resumen aun no llego, se suma lo de las fichas.
  const totalTodasCategorias = catalogTotalInventory
    ?? categories.reduce((total, category) => total + Number(category.total || 0), 0);
  const hasActiveFilters = Boolean(
    catalogSearchTerm || catalogCategoryId || catalogPartBrand || catalogVehicleBrand || catalogYear
    || catalogStatusFilter !== 'all' || catalogSort !== 'default'
  );

  // Filtros avanzados: viven en una barra lateral y aquí se resumen como etiquetas removibles.
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setFiltersOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [filtersOpen]);

  const activeFilterTags = [
    activeCategory && { key: 'category', label: `Categoría: ${activeCategory.categoriaNombre}`, onRemove: () => onCategoryChange(null) },
    catalogPartBrand && { key: 'part', label: `Marca: ${catalogPartBrand}`, onRemove: () => onPartBrandChange?.('') },
    catalogVehicleBrand && { key: 'vehicle', label: `Vehículo: ${catalogVehicleBrand}`, onRemove: () => onVehicleBrandChange?.('') },
    catalogYear && { key: 'year', label: `Año: ${catalogYear}`, onRemove: () => onYearChange?.('') },
    catalogStatusFilter !== 'all' && {
      key: 'status',
      label: `Estado: ${STATUS_OPTIONS.find((option) => option.key === catalogStatusFilter)?.label || catalogStatusFilter}`,
      onRemove: () => onStatusFilterChange?.('all'),
    },
  ].filter(Boolean);
  const advancedCount = activeFilterTags.length;
  const clearAdvanced = () => activeFilterTags.forEach((tag) => tag.onRemove());

  /**
   * Productos de la pagina agrupados por categoria, en secciones.
   *
   * El backend ya ordena el inventario por nombre de categoria, asi que cada grupo sale
   * contiguo y no hay que reordenar nada aca: basta con recorrer la pagina en orden y abrir
   * una seccion cada vez que cambia la categoria. Los productos sin categoria van al final,
   * juntos, en vez de repartirse en secciones sueltas.
   */
  const productSections = useMemo(() => {
    const sections = [];
    const byKey = new Map();

    (sellerProducts || []).forEach((product) => {
      const id = product.categoriaId ?? null;
      const key = id === null ? 'sin-categoria' : String(id);
      let section = byKey.get(key);
      if (!section) {
        section = {
          key,
          categoriaId: id,
          nombre: product.categoria || 'Sin categoria asignada',
          products: [],
        };
        byKey.set(key, section);
        sections.push(section);
      }
      section.products.push(product);
    });

    return sections;
  }, [sellerProducts]);

  return (
    <div className="profile-panel">
      <div className="profile-panel-header-row">
        <h2 className="profile-panel-title">
          Catálogo Publicado {catalogTotalElements > 0 && <span className="catalog-total-badge">{catalogTotalElements}</span>}
        </h2>
        <div className="catalog-header-actions">
          <button type="button" className="catalog-add-product-button" onClick={onAddProduct}>
            <Plus size={16} /> Agregar producto
          </button>
        </div>
      </div>

      <div className="catalog-bulk-inventory-notice">
        <div className="catalog-bulk-inventory-icon"><Boxes size={19} /></div>
        <p><strong>¿Necesitas cargar o editar muchos productos?</strong><span>Para cargas masivas y ediciones masivas de tu inventario, ingresa al Panel de inventario.</span></p>
        <a href={inventoryPanelUrl} target="_blank" rel="noreferrer">Ir al panel <ArrowUpRight size={15} /></a>
      </div>

      <div className="catalog-top-info">
        <ProductTopBadge compact className="catalog-top-info-badge" />
        <p><strong>Destaca tus productos Top Ventas</strong><span>Las primeras 2 activaciones son gratis. Puedes mantener hasta 10 productos Top; la insignia y la prioridad duran 30 días y luego puedes renovarlas con Monedas.</span></p>
      </div>

      {catalogTopFeedback && (
        <div className="catalog-top-feedback"><CheckCircle size={15} /> {catalogTopFeedback}</div>
      )}

      {/* Escritorio: buscador y desplegables en una fila, como el inventario del Panel de vendedor.
          Celular: buscador, orden y "Filtros avanzados", que abre los mismos filtros en una barra
          lateral para no llenar la pantalla de desplegables. */}
      <div className="inventory-filter-bar">
        <form className="catalog-control-search" onSubmit={onSearchSubmit} role="search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={catalogSearchInput}
            onChange={(e) => setCatalogSearchInput(e.target.value)}
            aria-label="Buscar en el inventario"
          />
        </form>

        <select
          className="catalog-control-select catalog-control-desktop"
          value={catalogCategoryId ?? ''}
          onChange={(event) => onCategoryChange(event.target.value || null)}
          aria-label="Filtrar por categoría"
        >
          <option value="">Categoría: Todas ({totalTodasCategorias})</option>
          {categories.map((category) => (
            <option key={category.categoriaId} value={category.categoriaId}>
              {category.categoriaNombre} ({category.total})
            </option>
          ))}
        </select>
        <select
          className="catalog-control-select catalog-control-desktop"
          value={catalogPartBrand}
          onChange={(event) => onPartBrandChange?.(event.target.value)}
          aria-label="Filtrar por marca del repuesto"
        >
          <option value="">Marca: Todas</option>
          {catalogPartBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
        </select>
        <select
          className="catalog-control-select catalog-control-desktop"
          value={catalogVehicleBrand}
          onChange={(event) => onVehicleBrandChange?.(event.target.value)}
          aria-label="Filtrar por marca del vehículo"
        >
          <option value="">Vehículo: Todos</option>
          {catalogVehicleBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
        </select>
        <select
          className="catalog-control-select catalog-control-desktop"
          value={catalogYear}
          onChange={(event) => onYearChange?.(event.target.value)}
          aria-label="Filtrar por año del vehículo"
        >
          <option value="">Año: Todos</option>
          {catalogYears.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        {onStatusFilterChange && (
          <select
            className="catalog-control-select catalog-control-desktop"
            value={catalogStatusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            aria-label="Filtrar por estado"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.key === 'all' ? 'Estado: Todos' : option.label}</option>
            ))}
          </select>
        )}

        {onSortChange && (
          // En celular es un botón con ícono (el desplegable nativo va encima, invisible) para
          // que buscador, orden y filtros quepan en una sola fila.
          <label className={`catalog-control-sort ${catalogSort !== 'default' ? 'is-active' : ''}`} title="Ordenar productos">
            <ArrowUpDown size={17} aria-hidden="true" />
            <select
              className="catalog-control-select"
              value={catalogSort}
              onChange={(event) => onSortChange(event.target.value)}
              aria-label="Ordenar productos"
            >
              <option value="default">Orden: por categoría</option>
              <option value="name">Nombre (A-Z)</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="stock-asc">Stock: menor primero</option>
            </select>
          </label>
        )}

        <button
          type="button"
          className={`catalog-control-advanced ${advancedCount > 0 ? 'has-filters' : ''}`}
          onClick={() => setFiltersOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          aria-label="Filtros avanzados"
          title="Filtros avanzados"
        >
          <SlidersHorizontal size={17} /> <span className="catalog-control-advanced-text">Filtros avanzados</span>
          {advancedCount > 0 && <span className="catalog-control-count">{advancedCount}</span>}
        </button>

        {hasActiveFilters && (
          <button type="button" className="catalog-control-clear" onClick={onClearFilters} title="Limpiar filtros">
            <RotateCcw size={14} /> Limpiar
          </button>
        )}
      </div>

      {activeFilterTags.length > 0 && (
        <div className="catalog-active-filters" aria-label="Filtros aplicados">
          {activeFilterTags.map((tag) => (
            <button key={tag.key} type="button" onClick={tag.onRemove} title={`Quitar filtro ${tag.label}`}>
              {tag.label} <X size={12} />
            </button>
          ))}
        </div>
      )}

      {filtersOpen && createPortal(
        <div className="catalog-filter-backdrop" onClick={() => setFiltersOpen(false)}>
          <aside
            className="catalog-filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Filtros avanzados del inventario"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div><SlidersHorizontal size={18} /><strong>Filtros avanzados</strong></div>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros"><X size={18} /></button>
            </header>

            <div className="catalog-filter-body">
              <label>
                <span>Categoría</span>
                <select value={catalogCategoryId ?? ''} onChange={(event) => onCategoryChange(event.target.value || null)}>
                  <option value="">Todas ({totalTodasCategorias})</option>
                  {categories.map((category) => (
                    <option key={category.categoriaId} value={category.categoriaId}>
                      {category.categoriaNombre} ({category.total})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Marca del repuesto</span>
                <select value={catalogPartBrand} onChange={(event) => onPartBrandChange?.(event.target.value)}>
                  <option value="">Todas</option>
                  {catalogPartBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </label>
              <label>
                <span>Marca del vehículo</span>
                <select value={catalogVehicleBrand} onChange={(event) => onVehicleBrandChange?.(event.target.value)}>
                  <option value="">Todas</option>
                  {catalogVehicleBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </label>
              <label>
                <span>Año del vehículo</span>
                <select value={catalogYear} onChange={(event) => onYearChange?.(event.target.value)}>
                  <option value="">Todos</option>
                  {catalogYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              {onStatusFilterChange && (
                <label>
                  <span>Estado</span>
                  <select value={catalogStatusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
                    {STATUS_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </label>
              )}
            </div>

            <footer>
              <button type="button" className="secondary" onClick={clearAdvanced} disabled={advancedCount === 0}>
                <RotateCcw size={14} /> Limpiar
              </button>
              <button type="button" onClick={() => setFiltersOpen(false)}>
                Ver {catalogTotalElements} {catalogTotalElements === 1 ? 'producto' : 'productos'}
              </button>
            </footer>
          </aside>
        </div>,
        document.body
      )}

      <div className="catalog-range-filter">
        <span>Mostrar por página:</span>
        {CATALOG_PAGE_SIZE_OPTIONS.map((size) => (
          <button
            key={size}
            type="button"
            className={`catalog-range-pill ${catalogPageSize === size ? 'active' : ''}`}
            onClick={() => onPageSizeChange(size)}
          >
            {size}
          </button>
        ))}
      </div>

      {catalogError && (
        <div className="auth-alert alert-error" style={{ margin: '0 0 16px' }}>
          <X size={16} />
          <span>{catalogError}</span>
        </div>
      )}

      {isCatalogLoading ? (
        <LoadingRow />
      ) : (sellerProducts || []).length === 0 ? (
        <EmptyState label={
          catalogSearchTerm
            ? `Sin resultados para "${catalogSearchTerm}"${activeCategory ? ` en ${activeCategory.categoriaNombre}` : ''}.`
            : activeCategory
              ? `No tienes productos en ${activeCategory.categoriaNombre}.`
              : 'Aún no has publicado productos en tu catálogo.'
        } />
      ) : (
        <>
          {productSections.map((section) => (
            <section className="catalog-category-section" key={section.key}>
              <header className="catalog-category-section-header">
                <h3>{section.nombre}</h3>
                <span className="catalog-category-section-count">
                  {section.products.length} {section.products.length === 1 ? 'producto' : 'productos'}
                </span>
              </header>

              <div className="profile-orders-cards-grid seller-catalog-grid">
                {section.products.map((p) => (
                  <CatalogCard
                    key={p.id}
                    product={p}
                    questionCount={questionCountForProduct(p)}
                    onSelectProduct={onSelectProduct}
                    onQuickEditStock={onSelectProduct}
                    onOpenQuestions={(item) => onOpenQuestionsForProduct(item.id)}
                    onToggleTop={onToggleTop}
                    isUpdatingTop={updatingTopProductId === p.id}
                    onTogglePause={onTogglePause}
                    isUpdatingPause={updatingPauseProductId === p.id}
                    onDelete={onDeleteProduct}
                    isDeleting={deletingProductId === p.id}
                  />
                ))}
              </div>
            </section>
          ))}

          {catalogTotalPages > 1 && (
            <div className="catalog-pagination">
              <button
                type="button"
                className="catalog-page-btn"
                disabled={catalogPage === 0}
                onClick={() => setCatalogPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <span className="catalog-page-indicator">
                Página {catalogPage + 1} de {catalogTotalPages}
              </span>
              <button
                type="button"
                className="catalog-page-btn"
                disabled={catalogPage >= catalogTotalPages - 1}
                onClick={() => setCatalogPage((p) => Math.min(catalogTotalPages - 1, p + 1))}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
