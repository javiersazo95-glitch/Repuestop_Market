import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, CheckCircle2, RefreshCw, AlertCircle, ChevronRight, Store,
  CarFront, Barcode, Tag, Users, Truck, ShieldCheck,
  ArrowLeft, ArrowRight, CircleHelp
} from 'lucide-react';
import { CAROUSEL_CATEGORIES, NAVIGATION_CATEGORIES } from '../data/categories';
import { getPartCategoriesApi, getPublicCategoryCountsApi, getPublicProductsApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptVehicle, normalizeCategoryId } from '../services/adapters';
import CategoryIconTile from './CategoryIconTile';

const SEARCH_MODES = [
  { id: 'patente', label: 'Buscar por patente', icon: CarFront, placeholder: 'Ej: BB-CL-12' },
  { id: 'vin', label: 'Buscar por VIN', icon: Barcode, placeholder: 'Ingresa los 17 caracteres del VIN' },
  { id: 'oem', label: 'Buscar por código OEM', icon: Tag, placeholder: 'Ej: 04465-0D150' },
  { id: 'repuesto', label: 'Buscar por repuesto', icon: Search, placeholder: 'Ej: Pastillas de freno' }
];

const CAROUSEL_PAGE_SIZE = 6;
const CAROUSEL_PAGE_COUNT = Math.ceil(CAROUSEL_CATEGORIES.length / CAROUSEL_PAGE_SIZE);

export default function OfficialPatentHero({
  activeVehicle,
  onSelectVehicle,
  onOpenSellerModal,
  selectedCategory,
  onSelectCategory,
  onOpenCatalog
}) {
  const [searchMode, setSearchMode] = useState('patente');
  const [inputValue, setInputValue] = useState(activeVehicle?.patente || '');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeCarouselPage, setActiveCarouselPage] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState(null);
  const [backendCategories, setBackendCategories] = useState([]);

  const mode = SEARCH_MODES.find((item) => item.id === searchMode) || SEARCH_MODES[0];
  const samplePatentes = ['BB-CL-12', 'HG-89-21', 'AA-123-BB', 'JJ-TT-45'];
  const categoryNameKey = (value) => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  useEffect(() => {
    getPartCategoriesApi()
      .then((items) => setBackendCategories(Array.isArray(items) ? items : []))
      .catch(() => setBackendCategories([]));
  }, []);

  useEffect(() => {
    let isMounted = true;
    const toCountMap = (items) => (Array.isArray(items) ? items : []).reduce((result, item) => {
      const normalized = normalizeCategoryId(item.categoriaNombre);
      const carouselCategory = CAROUSEL_CATEGORIES.find((category) =>
        categoryNameKey(category.nombre) === categoryNameKey(item.categoriaNombre));
      const total = Number(item.total || 0);
      // El carrusel usa IDs técnicos (p. ej. `aceite`) y los filtros usan IDs
      // visuales (`aceites`); guardamos ambos para que nunca se pierda el conteo.
      result[normalized] = total;
      if (carouselCategory) {
        result[carouselCategory.id] = total;
        result[carouselCategory.filterId] = total;
      }
      return result;
    }, {});

    const loadFallbackCounts = async () => {
      // Compatibilidad con una API aún sin el resumen agregado: se consulta el
      // total exacto de cada categoría directamente desde el mismo catálogo.
      const availableCategories = await getPartCategoriesApi();
      if (isMounted) setBackendCategories(Array.isArray(availableCategories) ? availableCategories : []);
      const entries = await Promise.all(CAROUSEL_CATEGORIES.map(async (category) => {
        const categoriaId = (Array.isArray(availableCategories) ? availableCategories : [])
          .find((backendCategory) => categoryNameKey(backendCategory.nombre) === categoryNameKey(category.nombre))?.id;
        if (!categoriaId) return [category.id, 0];
        const response = await getPublicProductsApi({ categoriaId, page: 0, size: 1 });
        return [category.id, Number(response?.totalElements || 0)];
      }));
      return Object.fromEntries(entries);
    };

    (async () => {
      try {
        // La card y la vista filtrada deben compartir exactamente la misma
        // fuente: GET /inventario/productos?categoriaId=... con totalElements.
        // El resumen agregado se conserva como respaldo, pero no decide el
        // número mostrado porque sus IDs visuales pueden agrupar categorías.
        const counts = await loadFallbackCounts();
        if (isMounted) setCategoryCounts(counts);
      } catch {
        try {
          const counts = toCountMap(await getPublicCategoryCountsApi());
          if (isMounted) setCategoryCounts(counts);
        } catch {
          // No sustituimos con cifras mock; mantenemos el estado de carga.
          if (isMounted) setCategoryCounts(null);
        }
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const selectCarouselCategory = (category) => {
    // `filterId` es solo una familia visual (p. ej. Admisión pertenece al
    // estilo "motor"); para filtrar se debe resolver por el nombre exacto de
    // la categoría padre persistida en el backend.
    const backendCategory = backendCategories.find((item) => categoryNameKey(item.nombre) === categoryNameKey(category.nombre));
    onSelectCategory({
      category: category.filterId || category.id,
      categoryId: backendCategory?.id,
      categoryName: category.nombre,
    });
  };

  const handleSearch = async (valueToUse) => {
    const value = (valueToUse || inputValue).trim();
    if (!value) {
      setErrorMsg(searchMode === 'patente' ? 'Ingresa una patente válida (ejemplo: BB-CL-12)' : 'Ingresa un término para buscar.');
      return;
    }

    if (searchMode !== 'patente') {
      onOpenCatalog?.();
      return;
    }

    setErrorMsg('');
    setIsSearching(true);
    try {
      const result = adaptVehicle(await searchVehicleByPatenteApi(value));
      if (result && !result.requiereIngresoManual && result.marca) {
        onSelectVehicle(result);
        setInputValue(result.patente || value);
      } else {
        setErrorMsg(result?.mensaje || 'No encontramos ese vehículo. Verifica la patente e intenta de nuevo.');
      }
    } catch (error) {
      setErrorMsg(error.message || 'No se pudo consultar la patente. Intenta nuevamente.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectMode = (modeId) => {
    setSearchMode(modeId);
    setInputValue(modeId === 'patente' ? (activeVehicle?.patente || '') : '');
    setErrorMsg('');
  };

  const visibleCarouselCategories = Array.from(
    { length: CAROUSEL_PAGE_SIZE },
    (_, index) => CAROUSEL_CATEGORIES[(activeCarouselPage * CAROUSEL_PAGE_SIZE + index) % CAROUSEL_CATEGORIES.length]
  );

  // La barra lateral es un acceso rápido, no un catálogo completo. Se ordena
  // con los totales dinámicos disponibles en el sistema y solo conserva las
  // ocho categorías con mayor actividad; si aún carga, mantiene el orden base.
  const popularNavigationCategories = useMemo(() => NAVIGATION_CATEGORIES
    .map((category, index) => ({
      ...category,
      index,
      popularity: Number(categoryCounts?.[category.filterId] ?? categoryCounts?.[category.id] ?? 0),
    }))
    .sort((left, right) => right.popularity - left.popularity || left.index - right.index)
    .slice(0, 8), [categoryCounts]);

  const moveCategoryCarousel = (direction) => {
    setActiveCarouselPage((page) => (page + direction + CAROUSEL_PAGE_COUNT) % CAROUSEL_PAGE_COUNT);
  };

  return (
    <section className="light-home-hero">
      <div className="container light-home-layout">
        <aside className="light-category-sidebar">
          <div className="light-category-sidebar-heading">
            <h2>Más consultadas</h2>
            <p>Accesos rápidos según las búsquedas de la comunidad</p>
          </div>
          <ul>
            {popularNavigationCategories.map((category) => (
              <li key={category.id}>
                <button
                  className={selectedCategory === category.filterId ? 'active' : ''}
                  onClick={() => selectCarouselCategory(category)}
                >
                  <CategoryIconTile iconName={category.iconName} color={category.color} size={16} className="light-cat-icon" />
                  <span>{category.nombre}</span>
                  <ChevronRight size={15} />
                </button>
              </li>
            ))}
          </ul>
          <button className="light-seller-card" onClick={onOpenSellerModal}>
            <span className="seller-icon-box"><Store size={20} /></span>
            <span>
              <strong>¿Tienes una tienda?</strong>
              <small>Únete a nuestro marketplace<br />y aumenta tus ventas.</small>
              <b>Quiero vender <ArrowRight size={13} /></b>
            </span>
          </button>
        </aside>

        <main className="light-hero-main">
          <div className="light-search-intro">
            <div className="light-intro-copy">
              <h1>Encuentra el<br />repuesto correcto<br /><span>en segundos</span></h1>
              <i aria-hidden="true" />
              <p>Busca por patente, código OEM, VIN o nombre del repuesto y encuentra la mejor opción entre cientos de vendedores.</p>
              <ul>
                <li><CheckCircle2 size={17} /> Repuestos originales y alternativos</li>
                <li><CheckCircle2 size={17} /> Precios competitivos</li>
                <li><CheckCircle2 size={17} /> Vendedores verificados</li>
                <li><CheckCircle2 size={17} /> Compra 100% segura</li>
              </ul>
            </div>

            <div className="light-search-panel">
              <div className="light-search-tabs" role="tablist" aria-label="Tipos de búsqueda">
                {SEARCH_MODES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      role="tab"
                      aria-selected={searchMode === item.id}
                      className={searchMode === item.id ? 'active' : ''}
                      onClick={() => selectMode(item.id)}
                    >
                      <Icon size={20} /> <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="light-search-form">
                <div className="light-input-row">
                  {searchMode === 'patente' && (
                    <button className="country-selector" type="button">
                      <span>🇨🇱</span><strong>CHILE</strong><ChevronRight size={14} />
                    </button>
                  )}
                  <div className="light-query-field">
                    <input
                      type="text"
                      placeholder={mode.placeholder}
                      value={inputValue}
                      onChange={(event) => {
                        setInputValue(searchMode === 'patente' ? event.target.value.toUpperCase() : event.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                    />
                    {searchMode === 'patente' && <button type="button" className="plate-help"><CircleHelp size={14} /> ¿Dónde está mi patente?</button>}
                  </div>
                </div>

                <button className="light-primary-search" onClick={() => handleSearch()} disabled={isSearching}>
                  {isSearching ? <RefreshCw size={21} className="spin-icon" /> : <Search size={22} />}
                  {searchMode === 'patente' ? 'Buscar repuestos' : 'Buscar'}
                </button>

                {errorMsg && <div className="light-search-error"><AlertCircle size={14} /> {errorMsg}</div>}

                <div className="popular-searches">
                  <span>Búsquedas populares:</span>
                  {samplePatentes.map((plate) => <button key={plate} onClick={() => handleSearch(plate)}>{plate}</button>)}
                </div>
              </div>
            </div>
          </div>

          {activeVehicle && (
            <div className="light-active-vehicle"><CheckCircle2 size={17} /> Vehículo activo: <strong>{activeVehicle.marca} {activeVehicle.modelo} ({activeVehicle.patente})</strong></div>
          )}

          <div className="light-trust-row">
            <div><span className="trust-circle blue"><Users size={27} /></span><p><strong>538+ vendedores</strong><small>Tiendas verificadas</small></p></div>
            <div><span className="trust-circle green"><Truck size={27} /></span><p><strong>Envíos a todo Chile</strong><small>Rápido y seguro</small></p></div>
            <div><span className="trust-circle amber"><ShieldCheck size={27} /></span><p><strong>Repuestos originales<br />y alternativos</strong><small>Calidad garantizada</small></p></div>
            <div><span className="trust-circle purple"><ShieldCheck size={27} /></span><p><strong>Compra protegida</strong><small>Tu compra 100% segura</small></p></div>
          </div>
        </main>
      </div>

      <section className="container category-showcase-carousel" aria-label="Explora por categorías">
        <button
          className="category-carousel-arrow previous"
          onClick={() => moveCategoryCarousel(-1)}
          aria-label="Ver categorías anteriores"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="category-carousel-viewport">
          <div className="category-carousel-track" key={activeCarouselPage}>
            {visibleCarouselCategories.map((category, index) => (
              <button
                key={`${activeCarouselPage}-${category.id}-${index}`}
                className="category-showcase-card"
                data-category={category.id}
                onClick={() => selectCarouselCategory(category)}
              >
                <CategoryIconTile iconName={category.iconName} color={category.color} size={24} className="category-showcase-icon" />
                <strong>{category.nombre}</strong>
                <div className="category-showcase-image">
                  <img src={category.image} alt="" />
                </div>
                <div className="category-showcase-footer">
                  <span>{categoryCounts === null
                    ? 'Cargando…'
                    : `${Number(categoryCounts[category.id] || 0).toLocaleString('es-CL')} disponibles`}</span>
                  <i style={{ backgroundColor: category.color }}><ArrowRight size={20} /></i>
                </div>
              </button>
            ))}
          </div>
        </div>
        <button
          className="category-carousel-arrow next"
          onClick={() => moveCategoryCarousel(1)}
          aria-label="Ver más categorías"
        >
          <ChevronRight size={22} />
        </button>
        <div className="category-carousel-dots" role="tablist" aria-label="Páginas de categorías">
          {Array.from({ length: CAROUSEL_PAGE_COUNT }, (_, index) => (
            <button
              key={index}
              className={activeCarouselPage === index ? 'active' : ''}
              onClick={() => setActiveCarouselPage(index)}
              aria-label={`Ir a la página ${index + 1}`}
              aria-selected={activeCarouselPage === index}
              role="tab"
            />
          ))}
        </div>
      </section>

    </section>
  );
}
