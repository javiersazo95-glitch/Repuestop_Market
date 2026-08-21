import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import {
  Search, CheckCircle2, RefreshCw, AlertCircle, ChevronRight, Store,
  CarFront, Barcode, Tag, Users, Truck, ShieldCheck, Car,
  ArrowLeft, ArrowRight, CircleHelp
} from 'lucide-react';
import { CAROUSEL_CATEGORIES, NAVIGATION_CATEGORIES } from '../data/categories';
import { POPULAR_MARCAS, ANIOS_DISPONIBLES } from '../data/sampleVehicles';
import { getPartCategoriesApi, getPublicCategoryCountsApi, getPublicProductsApi, getVehicleBrandsApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptVehicle } from '../services/adapters';
import CategoryIconTile from './CategoryIconTile';

const SEARCH_MODES = [
  { id: 'patente', label: 'Buscar por patente', icon: CarFront, placeholder: 'Ej: BB-CL-12' },
  { id: 'oem', label: 'Buscar por código OEM', icon: Tag, placeholder: 'Ej: 04465-0D150' },
  { id: 'repuesto', label: 'Buscar por repuesto', icon: Search, placeholder: 'Ej: Pastillas de freno' },
  { id: 'vehiculo', label: 'Por vehículo (Año / Marca)', icon: Car, placeholder: 'Seleccionar vehículo' }
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
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeCarouselPage, setActiveCarouselPage] = useState(0);

  const mode = SEARCH_MODES.find((item) => item.id === searchMode) || SEARCH_MODES[0];
  const POPULAR_SEARCH_TERMS = ['Pastillas de freno', 'Filtro de aceite', 'Amortiguadores', 'Bujías', 'Baterías'];
  const categoryNameKey = (value) => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const { data: backendCategories = [] } = useQuery({
    queryKey: qk.categories(),
    queryFn: async () => {
      try {
        const items = await getPartCategoriesApi();
        return Array.isArray(items) ? items : [];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  const { data: categoryCounts = {}, isLoading: isCountsLoading } = useQuery({
    queryKey: qk.categoryCounts(),
    queryFn: async () => {
      try {
        const items = await getPublicCategoryCountsApi();
        const list = Array.isArray(items) ? items : [];
        const byId = {};
        list.forEach((item) => {
          const matchedCategory = CAROUSEL_CATEGORIES.find((category) =>
            categoryNameKey(category.nombre) === categoryNameKey(item.categoriaNombre));
          if (matchedCategory) {
            byId[matchedCategory.id] = Number(item.total || 0);
          }
        });
        return byId;
      } catch {
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const selectCarouselCategory = (category) => {
    const backendCategory = backendCategories.find((item) => categoryNameKey(item.nombre) === categoryNameKey(category.nombre));
    onSelectCategory({
      category: category.id,
      categoryId: backendCategory?.id,
      categoryName: category.nombre,
    });
  };

  // Fetch real vehicle brands from backend with fallbacks
  const { data: remoteVehicleBrands = [] } = useQuery({
    queryKey: qk.brands('vehicle'),
    queryFn: async ({ signal }) => {
      try {
        const items = await getVehicleBrandsApi({ signal });
        return Array.isArray(items) ? items.map((b) => b.nombre || b.name || b).filter(Boolean) : [];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  const availableBrands = remoteVehicleBrands.length ? remoteVehicleBrands : POPULAR_MARCAS;
  const [selectedMarca, setSelectedMarca] = useState('');
  const [selectedAnio, setSelectedAnio] = useState('');
  const [selectedModelo, setSelectedModelo] = useState('');

  const handleSearch = async (valueToUse) => {
    const value = (valueToUse || inputValue).trim();

    if (searchMode === 'vehiculo') {
      if (!selectedMarca) {
        setErrorMsg('Selecciona al menos la marca de tu vehículo.');
        return;
      }
      setErrorMsg('');
      const customVeh = {
        patente: 'SELECCION-MANUAL',
        marca: selectedMarca,
        modelo: selectedModelo || 'Todos los Modelos',
        anio: selectedAnio ? parseInt(selectedAnio) : 2020,
        motor: 'Especificación Estándar VVT',
      };
      onSelectVehicle?.(customVeh);
      onOpenCatalog?.(null, { q: `${selectedMarca} ${selectedModelo}`.trim() });
      return;
    }

    if (!value) {
      if (searchMode === 'patente' && activeVehicle?.patente) {
        setErrorMsg('');
        onOpenCatalog?.();
        return;
      }
      setErrorMsg(searchMode === 'patente' ? 'Ingresa una patente válida (ejemplo: BB-CL-12)' : 'Ingresa un término para buscar.');
      return;
    }

    if (searchMode === 'oem' || searchMode === 'repuesto') {
      setErrorMsg('');
      onOpenCatalog?.(null, { q: value });
      return;
    }

    if (searchMode === 'patente' && activeVehicle && (activeVehicle.patente || '').toUpperCase() === value.toUpperCase()) {
      setErrorMsg('');
      onOpenCatalog?.();
      return;
    }

    setErrorMsg('');
    setIsSearching(true);
    try {
      const result = adaptVehicle(await searchVehicleByPatenteApi(value));
      if (result && !result.requiereIngresoManual && result.marca) {
        onSelectVehicle(result);
        setInputValue('');
        onOpenCatalog?.();
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
    setInputValue('');
    setErrorMsg('');
  };

  const handlePopularTermClick = (term) => {
    setErrorMsg('');
    onOpenCatalog?.(null, { q: term });
  };

  const visibleCarouselCategories = Array.from(
    { length: CAROUSEL_PAGE_SIZE },
    (_, index) => CAROUSEL_CATEGORIES[(activeCarouselPage * CAROUSEL_PAGE_SIZE + index) % CAROUSEL_CATEGORIES.length]
  );

const DEFAULT_CATEGORY_PRIORITY = [
  'frenos',
  'motor',
  'aceite',
  'filtros',
  'suspension',
  'electrico',
  'iluminacion',
  'carroceria',
  'embrague',
  'direccion',
  'distribucion',
  'refrigeracion',
  'accesorios'
];

  // La barra lateral es un acceso rápido, no un catálogo completo. Se ordena
  // con los totales dinámicos de inventario disponibles en el sistema y solo conserva las
  // ocho categorías con mayor actividad; si aún no hay stock o está cargando,
  // utiliza un orden comercial automotriz relevante por defecto.
  const popularNavigationCategories = useMemo(() => {
    const getFallbackOrder = (id) => {
      const idx = DEFAULT_CATEGORY_PRIORITY.indexOf(id);
      return idx === -1 ? 999 : idx;
    };

    return NAVIGATION_CATEGORIES
      .map((category, index) => ({
        ...category,
        index,
        fallbackOrder: getFallbackOrder(category.id),
        popularity: Number(categoryCounts?.[category.id] ?? 0),
      }))
      .sort((left, right) => {
        if (right.popularity !== left.popularity) {
          return right.popularity - left.popularity;
        }
        return left.fallbackOrder - right.fallbackOrder || left.index - right.index;
      })
      .slice(0, 8);
  }, [categoryCounts]);

  const moveCategoryCarousel = (direction) => {
    setActiveCarouselPage((page) => (page + direction + CAROUSEL_PAGE_COUNT) % CAROUSEL_PAGE_COUNT);
  };

  return (
    <section className="light-home-hero">
      <div className="container light-home-layout">
        <aside className="light-category-sidebar">
          <div className="light-category-sidebar-heading">
            <h2>Más consultadas</h2>
            <p>Accesos rápidos con mayor disponibilidad de repuestos</p>
          </div>
          <ul>
            {popularNavigationCategories.map((category) => (
              <li key={category.id}>
                <button
                  className={selectedCategory === category.id ? 'active' : ''}
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
              <p>Busca por patente, código OEM o nombre del repuesto y compara opciones de tiendas verificadas, con el pago protegido hasta que recibas.</p>
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
                {searchMode === 'vehiculo' ? (
                  <div className="flex flex-wrap gap-3 mb-4 w-full">
                    <select
                      className="flex-1 min-w-[140px] px-3 py-2 border rounded-lg bg-white text-sm"
                      value={selectedAnio}
                      onChange={(e) => setSelectedAnio(e.target.value)}
                    >
                      <option value="">Año (Ej: 2021)</option>
                      {ANIOS_DISPONIBLES.map((anio) => (
                        <option key={anio} value={anio}>{anio}</option>
                      ))}
                    </select>

                    <select
                      className="flex-1 min-w-[160px] px-3 py-2 border rounded-lg bg-white text-sm"
                      value={selectedMarca}
                      onChange={(e) => setSelectedMarca(e.target.value)}
                    >
                      <option value="">Marca del Auto</option>
                      {availableBrands.map((marca) => (
                        <option key={marca} value={marca}>{marca}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Modelo (Ej: RAV4)"
                      className="flex-1 min-w-[160px] px-3 py-2 border rounded-lg bg-white text-sm"
                      value={selectedModelo}
                      onChange={(e) => setSelectedModelo(e.target.value)}
                    />
                  </div>
                ) : (
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
                )}

                <button className="light-primary-search" onClick={() => handleSearch()} disabled={isSearching}>
                  {isSearching ? <RefreshCw size={21} className="spin-icon" /> : <Search size={22} />}
                  {searchMode === 'patente' ? 'Buscar repuestos' : searchMode === 'vehiculo' ? 'Buscar por vehículo' : 'Buscar'}
                </button>

                {errorMsg && <div className="light-search-error"><AlertCircle size={14} /> {errorMsg}</div>}

                <div className="popular-searches">
                  <span>Búsquedas populares:</span>
                  {POPULAR_SEARCH_TERMS.map((term) => (
                    <button key={term} type="button" onClick={() => handlePopularTermClick(term)}>
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {activeVehicle && (
            <div className="light-active-vehicle">
              <CheckCircle2 size={17} />
              <span>Vehículo activo: <strong>{activeVehicle.marca} {activeVehicle.modelo} ({activeVehicle.patente})</strong></span>
              <button
                type="button"
                onClick={() => onSelectVehicle?.(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline', padding: '2px 4px' }}
                title="Quitar vehículo activo"
              >
                Cambiar / Quitar
              </button>
            </div>
          )}

          <div className="light-trust-row">
            <div><span className="trust-circle blue"><Users size={27} /></span><p><strong>Tiendas verificadas</strong><small>Documentos revisados por soporte</small></p></div>
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
                  <span>{isCountsLoading
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
