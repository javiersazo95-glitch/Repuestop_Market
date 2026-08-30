import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import {
  Search, CheckCircle2, RefreshCw, AlertCircle, ChevronRight, Store,
  CarFront, Tag, Users, Truck, ShieldCheck, Car,
  ArrowLeft, ArrowRight, CircleHelp, Wrench, PenLine, RotateCcw
} from 'lucide-react';
import { CAROUSEL_CATEGORIES, NAVIGATION_CATEGORIES } from '../data/categories';
import { ANIOS_DISPONIBLES } from '../data/sampleVehicles';
import {
  getPartCategoriesApi,
  getPublicCategoryCountsApi,
  getVehicleBrandsApi,
  getVehicleModelsApi,
  getVehicleVersionsApi,
  searchVehicleByPatenteApi,
  createManualVehicleApi
} from '../services/api';
import { adaptVehicle } from '../services/adapters';
import { normalizePlate, sanitizePlateInput, isValidPlate } from '../utils/vehicleLookup';
import CategoryIconTile from './CategoryIconTile';

const SEARCH_MODES = [
  { id: 'patente', label: 'Buscar por patente', icon: CarFront, placeholder: 'Ingresa tu patente (ej: ABCD11)' },
  { id: 'manual', label: 'Búsqueda manual', icon: Wrench, placeholder: 'Seleccionar marca y modelo' },
  { id: 'oem', label: 'Buscar por código OEM', icon: Tag, placeholder: 'Ej: 04465-0D150' },
  { id: 'repuesto', label: 'Buscar por repuesto', icon: Search, placeholder: 'Ej: Pastillas de freno' }
];

const CAROUSEL_PAGE_SIZE = 6;
const CAROUSEL_PAGE_COUNT = Math.ceil(CAROUSEL_CATEGORIES.length / CAROUSEL_PAGE_SIZE);

const COMBUSTIBLES_DISPONIBLES = [
  'Bencina',
  'Diésel',
  'Eléctrico',
  'Híbrido Sin Recarga Exterior',
  'Híbrido Recarga Exterior',
  'Gas (GLP / GNC)'
];

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

  // Manual vehicle search cascading state (identical 1:1 to mobile app)
  const [manualPlate, setManualPlate] = useState('');
  const [manualMarcaId, setManualMarcaId] = useState('');
  const [manualMarcaNombre, setManualMarcaNombre] = useState('');
  const [manualModeloId, setManualModeloId] = useState('');
  const [manualModeloNombre, setManualModeloNombre] = useState('');
  const [manualAnio, setManualAnio] = useState('');
  const [manualVersion, setManualVersion] = useState('');
  const [manualFuel, setManualFuel] = useState('');
  const [manualChassis, setManualChassis] = useState('');

  const mode = SEARCH_MODES.find((item) => item.id === searchMode) || SEARCH_MODES[0];
  const POPULAR_SEARCH_TERMS = ['Pastillas de freno', 'Filtro de aceite', 'Amortiguadores', 'Bujías', 'Baterías'];
  const SAMPLE_PATENTES = ['ABCD11', 'BB-CL-12', 'HG-89-21'];

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

  // Vehicle brands from catalog
  const { data: vehicleBrands = [], isLoading: isLoadingBrands } = useQuery({
    queryKey: qk.vehicleBrands(),
    queryFn: async ({ signal }) => {
      try {
        const items = await getVehicleBrandsApi({ signal });
        return Array.isArray(items) ? items : [];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  // Vehicle models for manual search
  const { data: vehicleModels = [], isLoading: isLoadingModels } = useQuery({
    queryKey: qk.vehicleModels(manualMarcaId || manualMarcaNombre),
    queryFn: async () => {
      if (!manualMarcaId) return [];
      try {
        const items = await getVehicleModelsApi(manualMarcaId);
        return Array.isArray(items) ? items : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(manualMarcaId),
    staleTime: 1000 * 60 * 30,
  });

  // Vehicle versions for manual search
  const { data: vehicleVersions = [], isLoading: isLoadingVersions } = useQuery({
    queryKey: qk.vehicleVersions(manualMarcaNombre, manualModeloNombre, manualAnio),
    queryFn: async () => {
      if (!manualMarcaNombre || !manualModeloNombre || !manualAnio) return [];
      try {
        const items = await getVehicleVersionsApi({
          marca: manualMarcaNombre,
          modelo: manualModeloNombre,
          anioDesde: manualAnio,
          anioHasta: manualAnio
        });
        return Array.isArray(items) ? items : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(manualMarcaNombre && manualModeloNombre && manualAnio),
    staleTime: 1000 * 60 * 30,
  });

  // If brand is loaded and we have a manualMarcaNombre without manualMarcaId, match it
  useEffect(() => {
    if (manualMarcaNombre && !manualMarcaId && vehicleBrands.length > 0) {
      const match = vehicleBrands.find(
        (b) => (b.nombre || b.name || '').toLowerCase() === manualMarcaNombre.toLowerCase()
      );
      if (match) {
        setManualMarcaId(String(match.id));
      }
    }
  }, [manualMarcaNombre, manualMarcaId, vehicleBrands]);

  const selectCarouselCategory = (category) => {
    const backendCategory = backendCategories.find((item) => categoryNameKey(item.nombre) === categoryNameKey(category.nombre));
    onSelectCategory({
      category: category.id,
      categoryId: backendCategory?.id,
      categoryName: category.nombre,
    });
  };

  // Manual search brand change
  const handleBrandChange = (e) => {
    const brandId = e.target.value;
    const selected = vehicleBrands.find((b) => String(b.id) === String(brandId));
    setManualMarcaId(brandId);
    setManualMarcaNombre(selected ? (selected.nombre || selected.name || '') : '');
    setManualModeloId('');
    setManualModeloNombre('');
    setManualVersion('');
    setErrorMsg('');
  };

  // Manual search model change
  const handleModelChange = (e) => {
    const modelId = e.target.value;
    const selected = vehicleModels.find((m) => String(m.id || m.nombre) === String(modelId));
    setManualModeloId(modelId);
    setManualModeloNombre(selected ? (selected.nombre || selected.name || modelId) : modelId);
    setManualVersion('');
    setErrorMsg('');
  };

  // Manual search year change
  const handleYearChange = (e) => {
    setManualAnio(e.target.value);
    setManualVersion('');
    setErrorMsg('');
  };

  // Submit manual search
  const handleManualSearchSubmit = async () => {
    if (!manualMarcaNombre) {
      setErrorMsg('Por favor selecciona la marca del vehículo.');
      return;
    }
    if (!manualModeloNombre) {
      setErrorMsg('Por favor selecciona el modelo del vehículo.');
      return;
    }
    if (!manualAnio) {
      setErrorMsg('Por favor selecciona el año del vehículo.');
      return;
    }

    const hasPlate = Boolean(manualPlate.trim());

    if (hasPlate) {
      const normalized = normalizePlate(manualPlate);
      if (!isValidPlate(normalized)) {
        setErrorMsg('Patente no válida. Formato: ABCD12 o BB-CL-12');
        return;
      }
    }

    setErrorMsg('');
    setIsSearching(true);

    try {
      if (hasPlate) {
        // Caso 1: Con patente -> Guarda en la BD (vehiculo_consultado) para futuras búsquedas
        const payload = {
          patente: normalizePlate(manualPlate),
          marca: manualMarcaNombre.trim(),
          modelo: manualModeloNombre.trim(),
          anio: Number(manualAnio),
          version: manualVersion.trim() || 'Sin versión informada',
          tipoCombustible: manualFuel.trim() || undefined,
          chasis: manualChassis.trim() || undefined,
        };

        const result = adaptVehicle(await createManualVehicleApi(payload));
        if (result && result.marca) {
          onSelectVehicle(result);
          setErrorMsg('');
        } else {
          setErrorMsg('No se pudo identificar el vehículo con esos datos. Intenta nuevamente.');
        }
      } else {
        // Caso 2: Sin patente -> Identifica en sesión para ver repuestos sin ensuciar la BD
        const matchedVersionObj = vehicleVersions.find(
          (v) => (v.nombre || v.name || '').toLowerCase() === (manualVersion || '').toLowerCase()
        );
        const sessionVehicle = {
          vehiculoConsultadoId: null,
          catalogoId: matchedVersionObj?.id || matchedVersionObj?.catalogoId || null,
          patente: null,
          marca: manualMarcaNombre.trim(),
          modelo: manualModeloNombre.trim(),
          anio: Number(manualAnio),
          version: manualVersion.trim() || 'Estándar',
          motor: matchedVersionObj?.motor || matchedVersionObj?.cilindrada || 'No informado',
          combustible: manualFuel.trim() || 'Bencina',
          chasis: manualChassis.trim() || null,
          esManualSinPatente: true,
        };
        onSelectVehicle(sessionVehicle);
        setErrorMsg('');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al identificar el vehículo.');
    } finally {
      setIsSearching(false);
    }
  };

  // Search by patent / OEM / term
  const handleSearch = async (valueToUse) => {
    const value = (valueToUse || inputValue).trim();

    if (searchMode === 'manual') {
      await handleManualSearchSubmit();
      return;
    }

    if (!value) {
      if (searchMode === 'patente' && activeVehicle?.patente) {
        setErrorMsg('');
        onOpenCatalog?.();
        return;
      }
      setErrorMsg(searchMode === 'patente' ? 'Ingresa una patente válida (ejemplo: ABCD11)' : 'Ingresa un término para buscar.');
      return;
    }

    if (searchMode === 'oem' || searchMode === 'repuesto') {
      setErrorMsg('');
      onOpenCatalog?.(null, { q: value });
      return;
    }

    if (searchMode === 'patente') {
      const normalized = normalizePlate(value);
      if (!isValidPlate(normalized)) {
        setErrorMsg('Patente no válida. Formato chileno: ABCD11 o BB-CL-12');
        return;
      }

      setErrorMsg('');
      setIsSearching(true);

      try {
        const result = adaptVehicle(await searchVehicleByPatenteApi(normalized));
        if (result && !result.requiereIngresoManual && result.marca) {
          onSelectVehicle(result);
          setInputValue('');
          setErrorMsg('');
        } else {
          setErrorMsg(result?.mensaje || 'No encontramos ese vehículo. Verifica la patente o usa búsqueda manual.');
        }
      } catch (error) {
        setErrorMsg(error.message || 'No se pudo consultar la patente. Intenta nuevamente.');
      } finally {
        setIsSearching(false);
      }
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

  const handleSamplePlateClick = (plate) => {
    setInputValue(plate);
    setErrorMsg('');
    handleSearch(plate);
  };

  // Switch in-place to Manual Search tab with current vehicle data prefilled
  const handleEditVehicleInPlace = () => {
    if (!activeVehicle) return;

    const brandName = activeVehicle.marca || '';
    const matchedBrand = vehicleBrands.find(
      (b) => (b.nombre || b.name || '').toLowerCase() === brandName.toLowerCase()
    );

    const mapFuelToSii = (fuel) => {
      if (!fuel) return '';
      const lower = fuel.toLowerCase();
      if (lower.includes('gasolina') || lower.includes('bencina')) return 'Bencina';
      if (lower.includes('diesel') || lower.includes('diésel')) return 'Diésel';
      if (lower.includes('eléctrico') || lower.includes('electrico')) return 'Eléctrico';
      if (lower.includes('hibrido') || lower.includes('híbrido')) {
        if (lower.includes('recarga') || lower.includes('enchufable') || lower.includes('phev')) return 'Híbrido Recarga Exterior';
        return 'Híbrido Sin Recarga Exterior';
      }
      if (lower.includes('gas') || lower.includes('glp') || lower.includes('gnc')) return 'Gas (GLP / GNC)';
      return fuel;
    };

    setManualPlate(activeVehicle.patente && activeVehicle.patente !== 'SELECCION-MANUAL' ? activeVehicle.patente : '');
    setManualMarcaId(matchedBrand ? String(matchedBrand.id) : '');
    setManualMarcaNombre(brandName);
    setManualModeloId('');
    setManualModeloNombre(activeVehicle.modelo || '');
    setManualAnio(activeVehicle.anio ? String(activeVehicle.anio) : '');
    setManualVersion(activeVehicle.version || '');
    setManualFuel(mapFuelToSii(activeVehicle.combustible));
    setManualChassis(activeVehicle.chasis || '');
    setErrorMsg('');
    setSearchMode('manual');
    onSelectVehicle(null);
  };

  // Reset to empty patent search
  const handleResetVehicleSearch = () => {
    onSelectVehicle(null);
    setSearchMode('patente');
    setInputValue('');
    setManualPlate('');
    setManualMarcaId('');
    setManualMarcaNombre('');
    setManualModeloId('');
    setManualModeloNombre('');
    setManualAnio('');
    setManualVersion('');
    setManualFuel('');
    setManualChassis('');
    setErrorMsg('');
  };

  const visibleCarouselCategories = Array.from(
    { length: CAROUSEL_PAGE_SIZE },
    (_, index) => CAROUSEL_CATEGORIES[(activeCarouselPage * CAROUSEL_PAGE_SIZE + index) % CAROUSEL_CATEGORIES.length]
  );

  const DEFAULT_CATEGORY_PRIORITY = [
    'frenos', 'motor', 'aceite', 'filtros', 'suspension',
    'electrico', 'iluminacion', 'carroceria', 'embrague',
    'direccion', 'distribucion', 'refrigeracion', 'accesorios'
  ];

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
        {/* Left Category Sidebar */}
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

        {/* Main Hero Cockpit */}
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

            {/* Right Search Cockpit Panel */}
            <div className="light-search-panel">
              {activeVehicle ? (
                /* 1. Official Vehicle Specification Card */
                <div className="hero-vehicle-spec-card">
                  <div className="hero-vehicle-header">
                    <div className="hero-vehicle-title-group">
                      <span className="hero-vehicle-verified-badge">
                        <CheckCircle2 size={14} /> Vehículo Identificado Oficial
                      </span>
                      <h2 className="hero-vehicle-main-title">
                        {activeVehicle.marca} {activeVehicle.modelo} {activeVehicle.version ? `• ${activeVehicle.version}` : ''}
                      </h2>
                    </div>
                    {activeVehicle.patente && activeVehicle.patente !== 'SELECCION-MANUAL' && activeVehicle.patente !== 'MANUAL' && (
                      <div className="hero-vehicle-plate-pill">
                        <Car size={16} />
                        <span>{activeVehicle.patente}</span>
                      </div>
                    )}
                  </div>

                  <div className="hero-vehicle-spec-grid">
                    <div className="hero-vehicle-spec-item">
                      <span className="hero-vehicle-spec-label">Marca</span>
                      <span className="hero-vehicle-spec-value">{activeVehicle.marca || '—'}</span>
                    </div>
                    <div className="hero-vehicle-spec-item">
                      <span className="hero-vehicle-spec-label">Modelo</span>
                      <span className="hero-vehicle-spec-value">{activeVehicle.modelo || '—'}</span>
                    </div>
                    <div className="hero-vehicle-spec-item">
                      <span className="hero-vehicle-spec-label">Año</span>
                      <span className="hero-vehicle-spec-value">{activeVehicle.anio || '—'}</span>
                    </div>
                    <div className="hero-vehicle-spec-item">
                      <span className="hero-vehicle-spec-label">Versión</span>
                      <span className="hero-vehicle-spec-value" title={activeVehicle.version}>{activeVehicle.version || 'Estándar'}</span>
                    </div>
                    <div className="hero-vehicle-spec-item">
                      <span className="hero-vehicle-spec-label">Motor</span>
                      <span className="hero-vehicle-spec-value" title={activeVehicle.motor}>{activeVehicle.motor || 'No informado'}</span>
                    </div>
                    <div className="hero-vehicle-spec-item">
                      <span className="hero-vehicle-spec-label">Combustible</span>
                      <span className="hero-vehicle-spec-value">{activeVehicle.combustible || 'Gasolina / Diésel'}</span>
                    </div>
                  </div>

                  <div className="hero-vehicle-action-bar">
                    <button
                      type="button"
                      className="btn-hero-view-parts"
                      onClick={() => onOpenCatalog?.()}
                    >
                      <Search size={18} />
                      <span>Ver repuestos disponibles para este vehículo</span>
                      <ArrowRight size={18} />
                    </button>

                    <div className="hero-vehicle-sub-actions">
                      <button
                        type="button"
                        className="btn-hero-edit-vehicle"
                        onClick={handleEditVehicleInPlace}
                      >
                        <PenLine size={14} />
                        <span>Editar o corregir datos</span>
                      </button>

                      <button
                        type="button"
                        className="btn-hero-reset-vehicle"
                        onClick={handleResetVehicleSearch}
                      >
                        <RotateCcw size={14} />
                        <span>Consultar otro vehículo</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* 2. Normal Search Panel with Tabs */
                <>
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
                          <Icon size={18} /> <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className={`light-search-form ${searchMode !== 'patente' ? 'mode-no-country' : ''}`}>
                    {searchMode === 'manual' ? (
                      /* Cascading Manual Search Form 1:1 with Mobile App */
                      <div className="hero-manual-form">
                        <div className="hero-manual-grid">
                          {/* Row 1: Patente + Marca */}
                          <div className="hero-manual-field">
                            <div className="field-label-with-tooltip">
                              <label>Patente (opcional)</label>
                              <span className="field-tooltip-trigger" tabIndex={0} aria-label="Información sobre patente opcional">
                                <CircleHelp size={13} />
                                <span className="field-tooltip-box">
                                  Si ingresas tu patente, quedará registrada para que puedas consultar repuestos directamente por patente en el futuro.
                                </span>
                              </span>
                            </div>
                            <div className="plate-input-with-counter">
                              <input
                                type="text"
                                className="hero-manual-input"
                                placeholder="Ej: ABCD-12"
                                value={manualPlate}
                                onChange={(e) => setManualPlate(sanitizePlateInput(e.target.value))}
                                maxLength={8}
                              />
                              <span className="plate-char-counter">{manualPlate.length}/8</span>
                            </div>
                          </div>

                          <div className="hero-manual-field">
                            <label>Marca</label>
                            <select
                              className="hero-manual-select"
                              value={manualMarcaId}
                              onChange={handleBrandChange}
                            >
                              <option value="">{isLoadingBrands ? 'Cargando...' : 'Seleccionar'}</option>
                              {vehicleBrands.map((b) => (
                                <option key={b.id} value={b.id}>{b.nombre || b.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Row 2: Modelo + Año */}
                          <div className="hero-manual-field">
                            <label>Modelo</label>
                            <select
                              className="hero-manual-select"
                              value={manualModeloId || (vehicleModels.find((m) => (m.nombre || m.name || '').toLowerCase() === (manualModeloNombre || '').toLowerCase())?.id || '')}
                              onChange={handleModelChange}
                              disabled={!manualMarcaId || isLoadingModels}
                            >
                              <option value="">
                                {!manualMarcaId ? 'Seleccionar' : isLoadingModels ? 'Cargando...' : 'Seleccionar'}
                              </option>
                              {vehicleModels.map((m, idx) => (
                                <option key={m.id || `${m.nombre}-${idx}`} value={m.id || m.nombre}>{m.nombre || m.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="hero-manual-field">
                            <label>Año</label>
                            <select
                              className="hero-manual-select"
                              value={manualAnio}
                              onChange={handleYearChange}
                              disabled={!manualModeloId && !manualModeloNombre}
                            >
                              <option value="">Seleccionar</option>
                              {ANIOS_DISPONIBLES.map((anio) => (
                                <option key={anio} value={anio}>{anio}</option>
                              ))}
                            </select>
                          </div>

                          {/* Row 3: Versión + Combustible */}
                          <div className="hero-manual-field">
                            <label>Versión</label>
                            <select
                              className="hero-manual-select"
                              value={manualVersion}
                              onChange={(e) => setManualVersion(e.target.value)}
                              disabled={!manualModeloNombre || !manualAnio || isLoadingVersions}
                            >
                              <option value="">
                                {!manualModeloNombre || !manualAnio ? 'Seleccionar' : isLoadingVersions ? 'Cargando...' : 'Seleccionar'}
                              </option>
                              {vehicleVersions.map((v, idx) => (
                                <option key={v.id || idx} value={v.nombre || v.name}>{v.nombre || v.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="hero-manual-field">
                            <label>Combustible</label>
                            <select
                              className="hero-manual-select"
                              value={manualFuel}
                              onChange={(e) => setManualFuel(e.target.value)}
                            >
                              <option value="">Seleccionar</option>
                              {COMBUSTIBLES_DISPONIBLES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>

                          {/* Row 4: Nro Chasis (opcional) Full Width */}
                          <div className="hero-manual-field full-width">
                            <div className="field-label-with-tooltip">
                              <label>Nro Chasis (opcional)</label>
                              <span className="field-tooltip-trigger" tabIndex={0} aria-label="Información sobre número de chasis">
                                <CircleHelp size={13} />
                                <span className="field-tooltip-box">
                                  Con este dato los vendedores de repuestos podrán validar con mayor precisión la compatibilidad exacta de tu vehículo.
                                </span>
                              </span>
                            </div>
                            <input
                              type="text"
                              className="hero-manual-input"
                              placeholder="Ej: Número de chasis (VIN)"
                              value={manualChassis}
                              onChange={(e) => setManualChassis(e.target.value.toUpperCase())}
                              maxLength={30}
                            />
                            <span className="field-help-text">
                              Permite a las tiendas confirmar la compatibilidad técnica exacta antes del despacho.
                            </span>
                          </div>
                        </div>

                        {errorMsg && (
                          <div className="light-search-error" style={{ margin: '4px 0 0', width: '100%' }}>
                            <AlertCircle size={15} /> {errorMsg}
                          </div>
                        )}

                        <button
                          type="button"
                          className="btn-hero-manual-submit"
                          onClick={handleManualSearchSubmit}
                          disabled={isSearching || !manualMarcaNombre || !manualModeloNombre || !manualAnio}
                        >
                          {isSearching ? <RefreshCw size={18} className="spin-icon" /> : <Search size={18} />}
                          <span>Buscar repuestos</span>
                        </button>
                      </div>
                    ) : (
                      /* Patent / OEM / Text Search Form */
                      <>
                        <div className="light-input-row">
                          {searchMode === 'patente' && (
                            <div className="country-selector-badge">
                              <ShieldCheck size={18} />
                              <strong>CHILE</strong>
                            </div>
                          )}
                          <div className="light-query-field">
                            <input
                              type="text"
                              placeholder={mode.placeholder}
                              value={inputValue}
                              onChange={(event) => {
                                const val = searchMode === 'patente' ? sanitizePlateInput(event.target.value) : event.target.value;
                                setInputValue(val);
                                if (errorMsg) setErrorMsg('');
                              }}
                              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                              maxLength={searchMode === 'patente' ? 8 : 100}
                            />
                            {searchMode === 'patente' && (
                              <button type="button" className="plate-help">
                                <CircleHelp size={14} /> ¿Dónde está mi patente?
                              </button>
                            )}
                          </div>
                        </div>

                        {errorMsg && (
                          <div className="light-search-error">
                            <AlertCircle size={15} /> {errorMsg}
                          </div>
                        )}

                        <button className="light-primary-search" onClick={() => handleSearch()} disabled={isSearching}>
                          {isSearching ? <RefreshCw size={20} className="spin-icon" /> : <Search size={20} />}
                          <span>{searchMode === 'patente' ? 'Buscar repuestos' : 'Buscar'}</span>
                        </button>
                      </>
                    )}

                    {searchMode === 'patente' && (
                      <div className="popular-searches">
                        <span>Patentes de prueba:</span>
                        {SAMPLE_PATENTES.map((plate) => (
                          <button key={plate} type="button" onClick={() => handleSamplePlateClick(plate)}>
                            {plate}
                          </button>
                        ))}
                      </div>
                    )}

                    {(searchMode === 'oem' || searchMode === 'repuesto') && (
                      <div className="popular-searches">
                        <span>Búsquedas populares:</span>
                        {POPULAR_SEARCH_TERMS.map((term) => (
                          <button key={term} type="button" onClick={() => handlePopularTermClick(term)}>
                            {term}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Trust Guarantees Bar */}
          <div className="light-trust-row">
            <div><span className="trust-circle blue"><Users size={27} /></span><p><strong>Tiendas verificadas</strong><small>Documentos revisados por soporte</small></p></div>
            <div><span className="trust-circle green"><Truck size={27} /></span><p><strong>Envíos a todo Chile</strong><small>Rápido y seguro</small></p></div>
            <div><span className="trust-circle amber"><ShieldCheck size={27} /></span><p><strong>Repuestos originales<br />y alternativos</strong><small>Calidad garantizada</small></p></div>
            <div><span className="trust-circle purple"><ShieldCheck size={27} /></span><p><strong>Compra protegida</strong><small>Tu compra 100% segura</small></p></div>
          </div>
        </main>
      </div>

      {/* Category Showcase Carousel */}
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
          aria-label="Ver categorías siguientes"
        >
          <ArrowRight size={22} />
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
