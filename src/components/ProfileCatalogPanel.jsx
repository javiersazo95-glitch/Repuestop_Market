import React, { useMemo } from 'react';
import {
  ArrowUpRight, Boxes, CheckCircle, ChevronLeft, ChevronRight, Layers, Plus, Search, X,
} from 'lucide-react';
import CatalogCard from './CatalogCard';
import ProductTopBadge from './ProductTopBadge';
import { EmptyState, LoadingRow, CATALOG_PAGE_SIZE_OPTIONS } from './ProfileDashboard';

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
          <form className="catalog-search-form" onSubmit={onSearchSubmit}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={catalogSearchInput}
              onChange={(e) => setCatalogSearchInput(e.target.value)}
            />
          </form>
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

      {categories.length > 0 && (
        <div className="catalog-category-filter">
          <span className="catalog-category-filter-label"><Layers size={14} /> Categoría:</span>
          <div className="catalog-category-chips">
            <button
              type="button"
              className={`catalog-category-chip ${!catalogCategoryId ? 'active' : ''}`}
              aria-pressed={!catalogCategoryId}
              onClick={() => onCategoryChange(null)}
            >
              Todas <span className="catalog-category-chip-count">{totalTodasCategorias}</span>
            </button>
            {categories.map((category) => {
              const isActive = String(category.categoriaId) === String(catalogCategoryId);
              return (
                <button
                  key={category.categoriaId}
                  type="button"
                  className={`catalog-category-chip ${isActive ? 'active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => onCategoryChange(category.categoriaId)}
                >
                  {category.categoriaNombre}
                  <span className="catalog-category-chip-count">{category.total}</span>
                </button>
              );
            })}
          </div>
        </div>
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
