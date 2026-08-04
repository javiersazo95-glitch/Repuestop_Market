import React, { useEffect, useState } from 'react';
import {
  Search, CheckCircle2, RefreshCw, AlertCircle, ChevronRight, Store,
  CarFront, Barcode, Tag, Users, Truck, ShieldCheck,
  ArrowLeft, ArrowRight, CircleHelp
} from 'lucide-react';
import { CATEGORY_GRID_ITEMS, SIDEBAR_CATEGORIES } from '../data/categories';
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
const CAROUSEL_PAGE_COUNT = Math.ceil(CATEGORY_GRID_ITEMS.length / CAROUSEL_PAGE_SIZE);

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

  const mode = SEARCH_MODES.find((item) => item.id === searchMode) || SEARCH_MODES[0];
  const samplePatentes = ['BB-CL-12', 'HG-89-21', 'AA-123-BB', 'JJ-TT-45'];

  useEffect(() => {
    let isMounted = true;
    const toCountMap = (items) => (Array.isArray(items) ? items : []).reduce((result, item) => {
      result[normalizeCategoryId(item.categoriaNombre)] = Number(item.total || 0);
      return result;
    }, {});

    const loadFallbackCounts = async () => {
      // Compatibilidad con una API aún sin el resumen agregado: se consulta el
      // total exacto de cada categoría directamente desde el mismo catálogo.
      const availableCategories = await getPartCategoriesApi();
      const backendCategoryByUiId = (Array.isArray(availableCategories) ? availableCategories : [])
        .reduce((result, category) => {
          result[normalizeCategoryId(category.nombre)] = category.id;
          return result;
        }, {});

      const entries = await Promise.all(CATEGORY_GRID_ITEMS.map(async (category) => {
        const categoriaId = backendCategoryByUiId[category.id];
        if (!categoriaId) return [category.id, 0];
        const response = await getPublicProductsApi({ categoriaId, page: 0, size: 1 });
        return [category.id, Number(response?.totalElements || 0)];
      }));
      return Object.fromEntries(entries);
    };

    (async () => {
      try {
        const directCounts = toCountMap(await getPublicCategoryCountsApi());
        // Si el backend todavía no ha sido reiniciado con el endpoint nuevo, o
        // responde un agregado vacío, no mostramos ceros ficticios: usamos el
        // catálogo público como fuente de verdad.
        const hasPublications = Object.values(directCounts).some((total) => total > 0);
        const counts = hasPublications ? directCounts : await loadFallbackCounts();
        if (isMounted) setCategoryCounts(counts);
      } catch {
        try {
          const counts = await loadFallbackCounts();
          if (isMounted) setCategoryCounts(counts);
        } catch {
          // No sustituimos con cifras mock; mantenemos el estado de carga.
          if (isMounted) setCategoryCounts(null);
        }
      }
    })();
    return () => { isMounted = false; };
  }, []);

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
    (_, index) => CATEGORY_GRID_ITEMS[(activeCarouselPage * CAROUSEL_PAGE_SIZE + index) % CATEGORY_GRID_ITEMS.length]
  );

  const moveCategoryCarousel = (direction) => {
    setActiveCarouselPage((page) => (page + direction + CAROUSEL_PAGE_COUNT) % CAROUSEL_PAGE_COUNT);
  };

  return (
    <section className="light-home-hero">
      <div className="container light-home-layout">
        <aside className="light-category-sidebar">
          <h2>Categorías</h2>
          <ul>
            {SIDEBAR_CATEGORIES.map((category) => (
              <li key={category.id}>
                <button
                  className={selectedCategory === category.id ? 'active' : ''}
                  onClick={() => onSelectCategory(category.id)}
                >
                  <CategoryIconTile iconName={category.iconName} color={category.color} size={16} className="light-cat-icon" />
                  <span>{category.nombre.replace('Sistema de ', 'Sistema de ').replace(' y Encendido', '')}</span>
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
                onClick={() => onSelectCategory(category.id)}
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
