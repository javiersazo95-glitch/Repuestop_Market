import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Award, Check, Info, Loader2, PlusCircle, Search, X } from 'lucide-react';
import VehicleBrandLogo from './VehicleBrandLogo';
import { getVehicleBrandsApi, updateStoreSpecialistBrandsApi } from '../services/api';

export type VehicleBrandOption = {
  id: number;
  nombre: string;
};

export type SpecialistBrandsManagerProps = {
  sellerId?: string;
  initialBrands?: VehicleBrandOption[];
  onBrandsChange?: (brands: VehicleBrandOption[]) => void;
  /** Solo conserva la selección local; el formulario padre la enviará al crear la tienda. */
  selectionOnly?: boolean;
};

const EMPTY_BRANDS: VehicleBrandOption[] = [];

function uniqueSortedBrands(brands: VehicleBrandOption[]): VehicleBrandOption[] {
  return [...new Map(brands.map((brand) => [brand.id, brand])).values()].sort((left, right) =>
    left.nombre.localeCompare(right.nombre, 'es', { sensitivity: 'base' })
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export default function SpecialistBrandsManager({
  sellerId,
  initialBrands = EMPTY_BRANDS,
  onBrandsChange,
  selectionOnly = false,
}: SpecialistBrandsManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedBrands, setSavedBrands] = useState<VehicleBrandOption[]>(() => uniqueSortedBrands(initialBrands));
  const [availableBrands, setAvailableBrands] = useState<VehicleBrandOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSavedBrands(uniqueSortedBrands(initialBrands));
  }, [initialBrands]);

  const brandById = useMemo(() => {
    return new Map(
      uniqueSortedBrands([...savedBrands, ...availableBrands]).map((brand) => [brand.id, brand])
    );
  }, [availableBrands, savedBrands]);

  const selectedBrands = useMemo(
    () =>
      selectedIds
        .map((id) => brandById.get(id))
        .filter((brand): brand is VehicleBrandOption => Boolean(brand)),
    [brandById, selectedIds]
  );

  const filteredBrands = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return availableBrands;
    return availableBrands.filter((brand) => normalizeSearch(brand.nombre).includes(query));
  }, [availableBrands, search]);

  const openManager = async () => {
    setSelectedIds(savedBrands.map((brand) => brand.id));
    setSearch('');
    setLoadError(null);
    setIsOpen(true);

    if (availableBrands.length > 0) return;

    setIsLoading(true);
    try {
      const catalog = await getVehicleBrandsApi();
      const list = Array.isArray(catalog) ? catalog : [];
      setAvailableBrands(uniqueSortedBrands(list));
    } catch (error: any) {
      setLoadError(error?.message || 'No pudimos cargar el listado de marcas.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBrand = (brandId: number) => {
    setSelectedIds((current) =>
      current.includes(brandId)
        ? current.filter((id) => id !== brandId)
        : [...current, brandId]
    );
  };

  const handleSave = async () => {
    if (selectionOnly) {
      const nextBrands = uniqueSortedBrands(selectedBrands);
      setSavedBrands(nextBrands);
      setSelectedIds(nextBrands.map((brand) => brand.id));
      onBrandsChange?.(nextBrands);
      setIsOpen(false);
      return;
    }

    if (!sellerId) {
      alert('No encontramos el identificador de tu tienda.');
      return;
    }

    setIsSaving(true);
    try {
      await updateStoreSpecialistBrandsApi(sellerId, selectedIds);
      const nextBrands = uniqueSortedBrands(selectedBrands);
      setSavedBrands(nextBrands);
      setSelectedIds(nextBrands.map((brand) => brand.id));
      onBrandsChange?.(nextBrands);
      setIsOpen(false);
    } catch (error: any) {
      alert(error?.message || 'No pudimos guardar las marcas especialistas.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="specialist-brands-card">
        <div className="specialist-brands-card-header">
          <div className="specialist-brands-card-title-group">
            <div className="specialist-brands-card-icon" aria-hidden="true">
              <Award size={18} />
            </div>
            <div>
              <h4 className="specialist-brands-card-title">Marcas especialistas</h4>
              <p className="specialist-brands-card-subtitle">
                {savedBrands.length === 0
                  ? (selectionOnly ? 'Sin marcas seleccionadas' : 'Sin marcas registradas')
                  : `${savedBrands.length} ${savedBrands.length === 1
                      ? (selectionOnly ? 'marca seleccionada' : 'marca registrada')
                      : (selectionOnly ? 'marcas seleccionadas' : 'marcas registradas')}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="specialist-brands-card-btn"
            onClick={openManager}
          >
            <PlusCircle size={15} />
            <span>Administrar</span>
          </button>
        </div>

        <div className="specialist-brands-card-infobox">
          <Info size={16} />
          <span>
            Indica las marcas de vehículos en las que tu tienda tiene mayor experiencia, stock o asesoría. Se mostrarán en el directorio para que los compradores puedan encontrarte; no limita las marcas que puedes vender.
          </span>
        </div>

        {savedBrands.length > 0 ? (
          <div className="specialist-brands-preview-chips">
            {savedBrands.slice(0, 8).map((brand) => (
              <span key={brand.id} className="specialist-preview-chip" title={brand.nombre}>
                <VehicleBrandLogo brand={brand.nombre} title={brand.nombre} />
                <span>{brand.nombre}</span>
              </span>
            ))}
            {savedBrands.length > 8 && (
              <span className="specialist-preview-chip-more">
                +{savedBrands.length - 8}
              </span>
            )}
          </div>
        ) : (
          <p className="specialist-brands-card-empty">
            Selecciona tus especialidades para destacarlas en la búsqueda de tiendas.
          </p>
        )}
      </div>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="order-modal-backdrop specialist-brands-backdrop"
            onClick={() => setIsOpen(false)}
            role="presentation"
          >
            <section
              className="specialist-brands-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="specialist-brands-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <header>
                <div>
                  <h2 id="specialist-brands-modal-title">Marcas especialistas</h2>
                  <p>Busca y selecciona todas las marcas que necesites. Puedes agregarlas o quitarlas en cualquier momento.</p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar modal de marcas especialistas"
                  onClick={() => setIsOpen(false)}
                >
                  <X size={19} />
                </button>
              </header>

              <div className="specialist-brands-selected" aria-label="Marcas ya seleccionadas">
                <span>Seleccionadas ({selectedBrands.length}):</span>
                {selectedBrands.length > 0 ? (
                  selectedBrands.map((brand) => (
                    <span key={brand.id} className="specialist-selected-chip" title={brand.nombre}>
                      <VehicleBrandLogo brand={brand.nombre} title={brand.nombre} />
                      <span>{brand.nombre}</span>
                      <button
                        type="button"
                        className="specialist-selected-chip-remove"
                        aria-label={`Quitar ${brand.nombre} de marcas especialistas`}
                        onClick={() => toggleBrand(brand.id)}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))
                ) : (
                  <em>Aún no has seleccionado marcas</em>
                )}
              </div>

              <div className="specialist-brands-search">
                <Search size={17} />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar marca de vehículo..."
                  maxLength={50}
                  aria-label="Buscar marca de vehículo"
                />
                {search && (
                  <button
                    type="button"
                    className="specialist-search-clear"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setSearch('')}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="specialist-brands-options">
                {isLoading ? (
                  <div className="specialist-brands-empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Cargando marcas del catálogo...</span>
                  </div>
                ) : loadError ? (
                  <div className="specialist-brands-empty" style={{ color: '#de350b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={18} />
                      <span>{loadError}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-auth-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => void openManager()}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : filteredBrands.length > 0 ? (
                  filteredBrands.map((brand) => {
                    const isSelected = selectedIds.includes(brand.id);
                    return (
                      <button
                        type="button"
                        key={brand.id}
                        className={`specialist-brand-option ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => toggleBrand(brand.id)}
                        aria-pressed={isSelected}
                      >
                        <VehicleBrandLogo brand={brand.nombre} title={brand.nombre} />
                        <span>{brand.nombre}</span>
                        <span className="specialist-brand-tick" aria-hidden="true">
                          {isSelected && <Check size={14} />}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="specialist-brands-empty">No encontramos marcas con esa búsqueda.</p>
                )}
              </div>

              <footer>
                <span>
                  {selectedIds.length} {selectedIds.length === 1 ? 'marca seleccionada' : 'marcas seleccionadas'}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-auth-secondary"
                    onClick={() => setIsOpen(false)}
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-auth-primary"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    <Check size={16} /> {isSaving ? 'Guardando...' : (selectionOnly ? 'Aplicar selección' : 'Guardar cambios')}
                  </button>
                </div>
              </footer>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
