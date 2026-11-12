import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2, Pencil, Search } from 'lucide-react';
import SearchableDropdown from '../SearchableDropdown';
import { getVehicleBrandsApi, getVehicleModelsApi } from '../../services/api';
import { filterSubcategories, groupSubcategories } from '../../utils/partAssistant';

/**
 * Desplegable de "lo que anda buscando" (`components/assistant/SubcategoryPicker.tsx`): todas las subcategorías
 * agrupadas por categoría con un buscador arriba. Cubre el cuerpo del chat sin tapar la cabecera ni el pie.
 */
export function SubcategoryPicker({ options, loading, error, selectedId, onSelect, onUseText, onClose, onRetry }) {
  const [query, setQuery] = useState('');
  const sections = useMemo(() => groupSubcategories(filterSubcategories(options, query)), [options, query]);
  const trimmed = query.trim();
  return (
    <div className="ra-picker" role="dialog" aria-label="¿Qué repuesto buscas?">
      <div className="ra-picker-head">
        <strong>¿Qué repuesto buscas?</strong>
        <button type="button" className="ra-icon-btn" onClick={onClose} aria-label="Cerrar lista"><ChevronDown size={22} /></button>
      </div>
      <div className="ra-picker-search">
        <Search size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar: frenos, filtro, amortiguador…"
          aria-label="Buscar tipo de repuesto"
          autoFocus
        />
      </div>
      {loading && <div className="ra-loader"><Loader2 size={22} className="ra-spin" /></div>}
      {!loading && error && (
        <div className="ra-picker-error">
          <span className="ra-error-text">{error}</span>
          {onRetry && <button type="button" className="ra-link" onClick={onRetry}>Reintentar</button>}
        </div>
      )}
      <div className="ra-picker-list">
        {trimmed && (
          <button type="button" className="ra-picker-row is-free" onClick={() => onUseText(trimmed)} aria-label={`Buscar «${trimmed}» tal como lo escribí`}>
            <Pencil size={16} /> <span>Buscar «{trimmed}»</span>
          </button>
        )}
        {!loading && !error && sections.length === 0 && (
          <p className="ra-caption ra-center ra-picker-empty">No hay una categoría con ese nombre. Usa «Buscar» con lo que escribiste y lo ubicamos igual.</p>
        )}
        {sections.map((section) => (
          <div key={section.title} className="ra-picker-section">
            <div className="ra-picker-section-title">{String(section.title || '').toUpperCase()}</div>
            {section.data.map((item) => {
              const selected = String(item.id) === String(selectedId);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`ra-picker-row${selected ? ' is-selected' : ''}`}
                  onClick={() => onSelect(item)}
                  aria-pressed={selected}
                  aria-label={`${item.nombre}, ${item.categoriaNombre}`}
                >
                  <span>{item.nombre}</span>
                  {selected && <CheckCircle2 size={20} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const CUSTOM_MODEL = '__modelo_propio__';
const FIRST_YEAR = 1980;
const nameOf = (item) => item?.nombre || item?.name || '';
const same = (a, b) => String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' }) === 0;

/**
 * Vehículo por marca, modelo y año en desplegables del catálogo (`components/assistant/VehicleCatalogPicker.tsx`).
 * El modelo se habilita al elegir la marca; si no está, "Mi modelo no aparece" lo recibe escrito.
 */
export function VehicleCatalogPicker({ initial, onChange }) {
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [typingModel, setTypingModel] = useState(false);
  const [anio, setAnio] = useState(initial?.anio || '');
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState('');
  const pendingBrand = useRef(initial?.marca || '');
  const pendingModel = useRef(initial?.modelo || '');
  const years = useMemo(() => {
    const last = new Date().getFullYear() + 1;
    return Array.from({ length: last - FIRST_YEAR + 1 }, (_, index) => ({ value: String(last - index), label: String(last - index) }));
  }, []);

  useEffect(() => {
    let active = true;
    getVehicleBrandsApi()
      .then((list) => {
        if (!active) return;
        const options = (Array.isArray(list) ? list : []).map((item) => ({ value: String(item.id), label: nameOf(item) })).filter((option) => option.label);
        setBrands(options);
        if (pendingBrand.current) {
          const match = options.find((option) => same(option.label, pendingBrand.current));
          pendingBrand.current = '';
          if (match) setBrandId(match.value);
        }
      })
      .catch(() => { if (active) setError('No pudimos cargar las marcas. Revisa tu conexión e inténtalo de nuevo.'); })
      .finally(() => { if (active) setLoadingBrands(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setModels([]);
    if (!brandId) return undefined;
    let active = true;
    setLoadingModels(true);
    setError('');
    getVehicleModelsApi(brandId)
      .then((list) => {
        if (!active) return;
        const options = (Array.isArray(list) ? list : []).map((item) => ({ value: String(item.id), label: nameOf(item) })).filter((option) => option.label);
        setModels(options);
        if (pendingModel.current) {
          const match = options.find((option) => same(option.label, pendingModel.current));
          if (match) setModelId(match.value);
          else { setCustomModel(pendingModel.current); setModelId(CUSTOM_MODEL); }
          pendingModel.current = '';
        }
      })
      .catch(() => { if (active) setError('No pudimos cargar los modelos de esa marca. Inténtalo de nuevo.'); })
      .finally(() => { if (active) setLoadingModels(false); });
    return () => { active = false; };
  }, [brandId]);

  const marca = brands.find((option) => option.value === brandId)?.label ?? '';
  const modelo = modelId === CUSTOM_MODEL ? customModel : models.find((option) => option.value === modelId)?.label ?? '';
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => { onChangeRef.current({ marca, modelo, anio }); }, [marca, modelo, anio]);

  const modelOptions = [
    ...(modelId === CUSTOM_MODEL && customModel ? [{ value: CUSTOM_MODEL, label: customModel }] : []),
    ...models,
  ];

  return (
    <div className="ra-vehicle-picker">
      {error && <small className="ra-error-text">{error}</small>}
      <label className="ra-label">Marca</label>
      <SearchableDropdown
        value={brandId}
        options={brands}
        placeholder={loadingBrands ? 'Cargando marcas…' : 'Busca y elige la marca'}
        disabled={loadingBrands && brands.length === 0}
        onChange={(value) => { setBrandId(String(value)); setModelId(''); setCustomModel(''); setTypingModel(false); }}
      />
      <label className="ra-label">Modelo</label>
      {typingModel ? (
        <form className="ra-composer" onSubmit={(event) => { event.preventDefault(); if (customModel.trim()) { setModelId(CUSTOM_MODEL); setTypingModel(false); } }}>
          <input className="ra-input" value={customModel} maxLength={120} autoFocus placeholder="Escribe el modelo" onChange={(event) => setCustomModel(event.target.value)} aria-label="Modelo del vehículo" />
          <button type="submit" className="ra-btn ra-btn-primary" disabled={!customModel.trim()}>Usar</button>
        </form>
      ) : (
        <SearchableDropdown
          value={modelId}
          options={modelOptions}
          placeholder={!brandId ? 'Primero elige la marca' : loadingModels ? 'Cargando modelos…' : 'Busca y elige el modelo'}
          disabled={!brandId || (loadingModels && models.length === 0)}
          customOptionLabel={brandId ? 'Mi modelo no aparece' : undefined}
          onCustomOption={() => { setTypingModel(true); setModelId(''); }}
          onChange={(value) => setModelId(String(value))}
        />
      )}
      <label className="ra-label">Año (opcional)</label>
      <SearchableDropdown value={anio} options={years} placeholder="Elige el año" onChange={(value) => setAnio(String(value))} />
    </div>
  );
}
