import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, CircleDollarSign, ClipboardList, Image as ImageIcon, Images, ListChecks, Loader2, PackagePlus, Plus, Search, Tag, Trash2, Upload, X } from 'lucide-react';
import CommissionSummaryCard from './CommissionSummaryCard';
import {
  createSellerInventoryProductApi,
  getPartBrandsApi,
  getPartCategoriesApi,
  getPartSubcategoriesApi,
  getVehicleBrandsApi,
  getVehicleModelsApi,
  getVehicleVersionsApi,
  resolveMediaUrl,
  toMediaPath,
  updateSellerInventoryProductApi,
} from '../services/api';

const MAX_PHOTOS = 4;
const CURRENT_YEAR = new Date().getFullYear() + 2;
const YEARS = Array.from({ length: CURRENT_YEAR - 1990 + 1 }, (_, index) => CURRENT_YEAR - index);

const emptyCompatibility = () => ({ brandId: '', brand: '', model: '', yearFrom: '', yearTo: '', motor: '', oem: '', vehicleCatalogIds: [] });

function parseCompatibilitiesFromProduct(product) {
  if (!product) return [emptyCompatibility()];

  if (product.compatibilityGroupsJson) {
    try {
      const groups = typeof product.compatibilityGroupsJson === 'string'
        ? JSON.parse(product.compatibilityGroupsJson)
        : product.compatibilityGroupsJson;
      if (Array.isArray(groups) && groups.length > 0) {
        return groups.map((g) => ({
          ...emptyCompatibility(),
          brandId: g.brandId ? String(g.brandId) : '',
          brand: g.marca || g.brand || '',
          model: g.modelo || g.model || '',
          yearFrom: g.anioDesde != null ? String(g.anioDesde) : g.yearFrom != null ? String(g.yearFrom) : '',
          yearTo: g.anioHasta != null ? String(g.anioHasta) : g.yearTo != null ? String(g.yearTo) : '',
          motor: g.motor || g.engine || '',
          oem: g.referenciaOem || g.oem || g.oemReference || '',
          vehicleCatalogIds: Array.isArray(g.vehiculoCatalogoIds)
            ? g.vehiculoCatalogoIds.map(String)
            : Array.isArray(g.vehicleCatalogIds)
              ? g.vehicleCatalogIds.map(String)
              : [],
        }));
      }
    } catch {
      // Fallback
    }
  }

  if (Array.isArray(product.compatibilityGroups) && product.compatibilityGroups.length > 0) {
    return product.compatibilityGroups.map((g) => ({
      ...emptyCompatibility(),
      brandId: g.brandId ? String(g.brandId) : '',
      brand: g.marca || g.brand || '',
      model: g.modelo || g.model || '',
      yearFrom: g.anioDesde != null ? String(g.anioDesde) : g.yearFrom != null ? String(g.yearFrom) : '',
      yearTo: g.anioHasta != null ? String(g.anioHasta) : g.yearTo != null ? String(g.yearTo) : '',
      motor: g.motor || g.engine || '',
      oem: g.referenciaOem || g.oem || g.oemReference || '',
      vehicleCatalogIds: Array.isArray(g.vehiculoCatalogoIds)
        ? g.vehiculoCatalogoIds.map(String)
        : Array.isArray(g.vehicleCatalogIds)
          ? g.vehicleCatalogIds.map(String)
          : [],
    }));
  }

  if (Array.isArray(product.compatibilidad) && product.compatibilidad.length > 0) {
    return product.compatibilidad.map((c) => ({
      ...emptyCompatibility(),
      brand: c.marca || c.brand || '',
      model: c.modelo || c.model || '',
      yearFrom: c.anioInicio != null ? String(c.anioInicio) : c.anioDesde != null ? String(c.anioDesde) : '',
      yearTo: c.anioFin != null ? String(c.anioFin) : c.anioHasta != null ? String(c.anioHasta) : '',
      motor: c.motor || '',
      oem: product.referenciaOem || product.oemCode || '',
      vehicleCatalogIds: Array.isArray(c.vehiculoCatalogoIds)
        ? c.vehiculoCatalogoIds.map(String)
        : Array.isArray(c.vehicleCatalogIds)
          ? c.vehicleCatalogIds.map(String)
          : [],
    }));
  }

  if (product.compatibilidadMarca || product.compatibilidadModelo) {
    return [{
      ...emptyCompatibility(),
      brand: product.compatibilidadMarca || '',
      model: product.compatibilidadModelo || '',
      yearFrom: product.anioDesde != null ? String(product.anioDesde) : '',
      yearTo: product.anioHasta != null ? String(product.anioHasta) : '',
      motor: product.motor || '',
      oem: product.referenciaOem || '',
      vehicleCatalogIds: (product.vehiculoCatalogoIds || []).map(String),
    }];
  }

  return [emptyCompatibility()];
}

const initialForm = (product = null) => ({
  name: product?.nombrePublicado || product?.repuestoNombre || product?.nombre || '',
  sku: product?.skuProveedor || product?.sku || product?.codigoSKU || '',
  category: product?.categoria || product?.categoriaNombre || product?.category || '',
  subcategory: product?.subcategoria || '',
  partBrand: product?.marcaRepuesto || product?.marca || product?.productBrand || '',
  pricingMode: product?.pricingMode || 'SHOW_PRICE',
  price: product?.precio ?? '',
  stock: product?.stock ?? '1',
  requiresChassis: Boolean(product?.requiereChasis),
  isUniversal: Boolean(product?.esUniversal),
  condition: product?.condicion || 'ORIGINAL',
  description: product?.descripcion || '',
  compatibilities: parseCompatibilitiesFromProduct(product),
});

function CatalogField({ label, optional, children }) {
  return <label className="catalog-product-field"><span>{label}{optional && <small>Opcional</small>}</span>{children}</label>;
}

function SearchableDropdown({ value, options, placeholder, onChange, disabled = false, emptyText = 'No hay resultados.', allowCustom = false, customOptionLabel, onCustomOption }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const filtered = options.filter((option) => option.label.toLocaleLowerCase('es').includes(normalizedQuery));
  const selected = options.find((option) => String(option.value) === String(value));

  useEffect(() => {
    const closeOnOutside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

  return <div className={`catalog-search-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
    <button type="button" className="catalog-search-select-trigger" disabled={disabled} onClick={() => { setOpen((current) => !current); setQuery(''); }}>
      <span className={selected || value ? '' : 'catalog-search-select-placeholder'}>{selected?.label || value || placeholder}</span><ChevronDown size={16} />
    </button>
    {open && <div className="catalog-search-select-menu">
      <div className="catalog-search-select-search"><Search size={15} /><input autoFocus value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." /></div>
      <div className="catalog-search-select-options">
        {filtered.map((option) => <button type="button" key={option.value} className={String(option.value) === String(value) ? 'selected' : ''} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{String(option.value) === String(value) && <Check size={15} />}</button>)}
        {allowCustom && query.trim() && !options.some((option) => option.label.toLocaleLowerCase('es') === normalizedQuery) && <button type="button" className="catalog-search-select-custom" onClick={() => { onChange(query.trim()); setOpen(false); }}><span>Usar “{query.trim()}”</span><Plus size={15} /></button>}
        {customOptionLabel && <button type="button" className="catalog-search-select-custom" onClick={() => { onCustomOption?.(); setOpen(false); }}><span>{customOptionLabel}</span><Plus size={15} /></button>}
        {!filtered.length && !(allowCustom && query.trim()) && <p>{emptyText}</p>}
      </div>
    </div>}
  </div>;
}

export default function NewCatalogProductModal({ sellerId, product = null, onClose, onCreated, isFounder = false }) {
  const [form, setForm] = useState(() => initialForm(product));
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [partBrands, setPartBrands] = useState([]);
  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [modelOptions, setModelOptions] = useState({});
  const [versionOptions, setVersionOptions] = useState({});
  const [versionsModalIndex, setVersionsModalIndex] = useState(null);
  const [versionSearch, setVersionSearch] = useState('');
  const [versionModalError, setVersionModalError] = useState(null);
  const [isCustomPartBrand, setIsCustomPartBrand] = useState(false);
  const isEditing = Boolean(product?.id);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getPartCategoriesApi(), getPartBrandsApi(), getVehicleBrandsApi()])
      .then(async ([categoryData, partBrandData, vehicleBrandData]) => {
        const categoryItems = Array.isArray(categoryData) ? categoryData : [];
        const brandItems = Array.isArray(partBrandData) ? partBrandData : [];
        const vehicleBrandItems = Array.isArray(vehicleBrandData) ? vehicleBrandData : [];
        setCategories(categoryItems);
        setPartBrands(brandItems);
        setVehicleBrands(vehicleBrandItems);
        if (product?.categoria) {
          const selectedCategory = categoryItems.find((item) => item.nombre === product.categoria);
          if (selectedCategory?.id) {
            const [subcategoryItems, filteredBrands] = await Promise.all([getPartSubcategoriesApi(selectedCategory.id), getPartBrandsApi(product.categoria)]);
            setSubcategories(Array.isArray(subcategoryItems) ? subcategoryItems : []);
            if (Array.isArray(filteredBrands)) setPartBrands(filteredBrands);
          }
        }
      })
      .catch(() => setError('No se pudieron cargar todos los catálogos. Puedes completar los datos manualmente.'));
  }, []);

  useEffect(() => {
    const initialCompatibilities = parseCompatibilitiesFromProduct(product);
    const enrichedCompatibilities = initialCompatibilities.map((item) => {
      if (item.brandId) return item;
      const matched = vehicleBrands.find((brand) => brand.nombre?.trim().toLowerCase() === item.brand?.trim().toLowerCase());
      return matched ? { ...item, brandId: String(matched.id), brand: matched.nombre } : item;
    });

    setForm({
      ...initialForm(product),
      compatibilities: enrichedCompatibilities,
    });
    setFiles([]);
    const existing = [];
    if (product?.imageUrls && Array.isArray(product.imageUrls)) {
      product.imageUrls.forEach((url) => { if (url) existing.push(url); });
    } else if (product?.imagenUrl || product?.imageUrl) {
      existing.push(product.imagenUrl || product.imageUrl);
    }
    setExistingPhotos(existing);
    setIsCustomPartBrand(false);

    enrichedCompatibilities.forEach((c) => {
      if (c.brandId) {
        getVehicleModelsApi(c.brandId)
          .then((models) => {
            setModelOptions((previous) => ({ ...previous, [c.brandId]: Array.isArray(models) ? models : [] }));
          })
          .catch(() => {
            setModelOptions((previous) => ({ ...previous, [c.brandId]: [] }));
          });
      }
    });
  }, [product, vehicleBrands]);

  useEffect(() => () => files.forEach(({ preview }) => URL.revokeObjectURL(preview)), [files]);

  const hasQuoteOnly = form.pricingMode === 'QUOTE_ONLY';
  const canSave = useMemo(() => form.name.trim() && form.sku.trim() && form.category.trim() && form.partBrand.trim()
    && form.stock !== '' && (hasQuoteOnly || form.price !== ''), [form, hasQuoteOnly]);

  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const changeCategory = async (category) => {
    const categoryName = String(category);
    const selectedCategory = categories.find((item) => item.nombre === categoryName);
    setForm((previous) => ({ ...previous, category: categoryName, subcategory: '', partBrand: '' }));
    setIsCustomPartBrand(false);
    setSubcategories([]);
    if (!selectedCategory?.id) return;
    try {
      const [items, brands] = await Promise.all([
        getPartSubcategoriesApi(selectedCategory.id),
        getPartBrandsApi(categoryName),
      ]);
      setSubcategories(Array.isArray(items) ? items : []);
      if (Array.isArray(brands)) setPartBrands(brands);
    } catch {
      setSubcategories([]);
    }
  };
  const updateCompatibility = (index, patch) => {
    setForm((previous) => ({
      ...previous,
      compatibilities: previous.compatibilities.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  };

  const changeVehicleBrand = async (index, brandId) => {
    const selected = vehicleBrands.find((brand) => String(brand.id) === brandId);
    updateCompatibility(index, { brandId, brand: selected?.nombre || '', model: '', vehicleCatalogIds: [] });
    if (!brandId || modelOptions[brandId]) return;
    try {
      const models = await getVehicleModelsApi(brandId);
      setModelOptions((previous) => ({ ...previous, [brandId]: Array.isArray(models) ? models : [] }));
    } catch {
      setModelOptions((previous) => ({ ...previous, [brandId]: [] }));
    }
  };

  const openVersions = async (index) => {
    const compatibility = form.compatibilities[index];
    if (!compatibility.brand || !compatibility.model) {
      setError('Primero selecciona la marca y el modelo del vehículo para ver las versiones disponibles.');
      return;
    }
    setError(null);
    setVersionModalError(null);
    setVersionSearch('');
    setVersionsModalIndex(index);
    const key = `${compatibility.brand}|${compatibility.model}|${compatibility.yearFrom}|${compatibility.yearTo}`;
    if (versionOptions[key]) return;
    try {
      const versions = await getVehicleVersionsApi({ marca: compatibility.brand, modelo: compatibility.model, anioDesde: compatibility.yearFrom, anioHasta: compatibility.yearTo });
      setVersionOptions((previous) => ({ ...previous, [key]: Array.isArray(versions) ? versions : [] }));
    } catch {
      setVersionModalError('No pudimos cargar las versiones disponibles. Inténtalo nuevamente.');
    }
  };

  const totalPhotosCount = existingPhotos.length + files.length;

  const handleFiles = (event) => {
    const incoming = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    const allowed = incoming.slice(0, MAX_PHOTOS - totalPhotosCount).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setFiles((previous) => [...previous, ...allowed]);
    event.target.value = '';
  };

  const removeFile = (index) => setFiles((previous) => {
    URL.revokeObjectURL(previous[index].preview);
    return previous.filter((_, itemIndex) => itemIndex !== index);
  });

  const removeExistingPhoto = (index) => {
    setExistingPhotos((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canSave) {
      setError('Completa los campos obligatorios antes de registrar el producto.');
      return;
    }
    setSaving(true);
    setError(null);
    // Un repuesto universal no declara vehiculos: la Specification del backend lo rescata
    // con su `OR esUniversal`, y dejarle compatibilidad cargada lo haria aparecer DOS veces
    // en la busqueda por patente (por universal y por el cruce relacional).
    const primary = form.isUniversal ? emptyCompatibility() : (form.compatibilities[0] || emptyCompatibility());
    const compatibilityGroups = form.isUniversal ? [] : form.compatibilities
      .filter((item) => item.brand || item.model || item.yearFrom || item.yearTo || item.motor || item.oem)
      .map((item) => {
        const key = `${item.brand}|${item.model}|${item.yearFrom}|${item.yearTo}`;
        const available = versionOptions[key] || [];
        const selectedNames = (item.vehicleCatalogIds || [])
          .map((id) => available.find((v) => String(v.id) === String(id))?.nombre)
          .filter(Boolean);
        const versionLabel = selectedNames.length > 0
          ? selectedNames.join(', ')
          : (item.version || (item.vehicleCatalogIds?.length ? `${item.vehicleCatalogIds.length} versiones` : ''));

        return {
          marca: item.brand,
          modelo: item.model,
          anioDesde: item.yearFrom ? Number(item.yearFrom) : null,
          anioHasta: item.yearTo ? Number(item.yearTo) : null,
          motor: item.motor,
          referenciaOem: item.oem,
          version: versionLabel,
          versionLabels: selectedNames,
          vehiculoCatalogoIds: item.vehicleCatalogIds.map(Number).filter(Number.isFinite),
        };
      });
    const payload = new FormData();
    const append = (key, value) => payload.append(key, String(value ?? ''));
    append('skuProveedor', form.sku.trim().toUpperCase());
    append('nombrePublicado', form.name.trim());
    append('categoria', form.category.trim());
    append('subcategoria', form.subcategory.trim());
    const selectedSubcategory = subcategories.find((item) => item.nombre === form.subcategory);
    if (selectedSubcategory?.id) append('subcategoriaId', selectedSubcategory.id);
    append('marcaRepuesto', form.partBrand.trim());
    append('referenciaOem', primary.oem);
    append('compatibilidadMarca', primary.brand);
    append('compatibilidadModelo', primary.model);
    append('anioDesde', primary.yearFrom);
    append('anioHasta', primary.yearTo || primary.yearFrom);
    append('motor', primary.motor);
    append('compatibilityGroupsJson', JSON.stringify(compatibilityGroups));
    append('pricingMode', form.pricingMode);
    append('precio', hasQuoteOnly ? 0 : form.price);
    append('stock', form.stock);
    append('descripcion', form.description.trim());
    append('condicion', form.condition);
    append('requiereChasis', form.requiresChassis);
    append('esUniversal', form.isUniversal);
    append('activo', true);
    compatibilityGroups.flatMap((group) => group.vehiculoCatalogoIds).forEach((id) => payload.append('vehiculoCatalogoIds', id));
    // `existingPhotos` le dice al backend cuales de las fotos ya guardadas sobreviven.
    // Sin este campo `reemplazarImagenes()` cae al modo antiguo (todo-o-nada) y basta
    // con subir una foto nueva para que borre de R2 las anteriores. Por eso al editar se
    // manda SIEMPRE, y con la lista vacia se manda una cadena vacia como marca explicita
    // de "no conservar ninguna": un campo ausente y un campo vacio significan cosas
    // distintas y el backend las distingue.
    //
    // Van como ruta relativa (`toMediaPath`) porque asi las arma el backend: si se
    // reenvia la URL absoluta que se ve en pantalla, la comparacion no calza y la foto
    // se borra igual.
    if (isEditing) {
      const keptPaths = existingPhotos.map(toMediaPath).filter(Boolean);
      if (keptPaths.length > 0) {
        keptPaths.forEach((url) => payload.append('existingPhotos', url));
      } else {
        payload.append('existingPhotos', '');
      }
    }
    files.forEach(({ file }) => payload.append('imagenes', file));

    try {
      const savedProduct = isEditing
        ? await updateSellerInventoryProductApi(sellerId, product.id, payload)
        : await createSellerInventoryProductApi(sellerId, payload);
      onCreated(savedProduct);
      onClose();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo registrar el producto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="catalog-product-modal-backdrop" onMouseDown={onClose}>
      <section className="catalog-product-modal" role="dialog" aria-modal="true" aria-label="Agregar producto al catálogo" onMouseDown={(event) => event.stopPropagation()}>
        <header className="catalog-product-modal-header">
          <div className="catalog-product-modal-title"><span className="catalog-product-header-icon"><PackagePlus size={22} /></span><div><h2>{isEditing ? 'Editar producto' : 'Nuevo producto'}</h2><p>{isEditing ? 'Actualiza la información publicada en tu catálogo.' : 'Completa la información para publicarlo en tu catálogo.'}</p></div></div>
          <span className="catalog-product-header-badge">{isEditing ? 'Edición de producto' : 'Carga individual'}</span>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <form onSubmit={submit} className="catalog-product-form">
          <nav className="catalog-product-steps" aria-label="Secciones del formulario">
            <a href="#catalog-basic"><Tag size={14} /><span>Datos</span></a>
            <a href="#catalog-pricing"><CircleDollarSign size={14} /><span>Venta</span></a>
            <a href="#catalog-compatibility"><ClipboardList size={14} /><span>Compatibilidad</span></a>
            <a href="#catalog-media"><Images size={14} /><span>Fotos</span></a>
          </nav>
          {error && <div className="catalog-product-alert"><AlertTriangle size={17} />{error}</div>}
          <section className="catalog-product-section" id="catalog-basic">
            <h3><b>1</b> Información básica</h3>
            <div className="catalog-product-grid">
              <CatalogField label="Nombre del producto"><input autoFocus value={form.name} onChange={(e) => update('name', e.target.value)} maxLength="120" placeholder="Ej. Pastillas de freno delanteras" required /></CatalogField>
              <CatalogField label="SKU (código interno)"><input value={form.sku} onChange={(e) => update('sku', e.target.value.replace(/\s+/g, '').toUpperCase().slice(0, 30))} maxLength="30" placeholder="Ej. PFD1234" required /></CatalogField>
              <CatalogField label="Categoría"><SearchableDropdown value={form.category} options={categories.map((item) => ({ value: item.nombre, label: item.nombre }))} placeholder="Selecciona o busca una categoría" onChange={changeCategory} allowCustom emptyText="No encontramos esa categoría." /></CatalogField>
              <CatalogField label="Subcategoría" optional><SearchableDropdown value={form.subcategory} options={subcategories.map((item) => ({ value: item.nombre, label: item.nombre }))} placeholder={form.category ? 'Selecciona una subcategoría' : 'Selecciona primero una categoría'} onChange={(subcategory) => update('subcategory', String(subcategory))} disabled={!form.category || !subcategories.length} emptyText="No hay subcategorías disponibles." /></CatalogField>
              <CatalogField label="Marca del repuesto">{isCustomPartBrand ? <div className="catalog-custom-brand-entry"><input autoFocus value={form.partBrand} maxLength="80" onChange={(event) => update('partBrand', event.target.value)} placeholder="Escribe la marca del repuesto" required /><button type="button" onClick={() => { setIsCustomPartBrand(false); update('partBrand', ''); }}>Ver marcas</button></div> : <SearchableDropdown value={form.partBrand} options={partBrands.map((item) => ({ value: item.nombre, label: item.nombre }))} placeholder="Selecciona o busca una marca" onChange={(partBrand) => update('partBrand', String(partBrand))} emptyText="No encontramos esa marca." customOptionLabel="Otro: registrar una marca" onCustomOption={() => { setIsCustomPartBrand(true); update('partBrand', ''); }} />}</CatalogField>
            </div>
          </section>
          <section className="catalog-product-section" id="catalog-pricing">
            <h3><b>2</b> Precio y disponibilidad</h3>
            <div className="catalog-pricing-options">
              <button type="button" className={form.pricingMode === 'SHOW_PRICE' ? 'active' : ''} onClick={() => update('pricingMode', 'SHOW_PRICE')}><strong>Mostrar precio</strong><span>El precio será visible</span></button>
              <button type="button" className={hasQuoteOnly ? 'active' : ''} onClick={() => update('pricingMode', 'QUOTE_ONLY')}><strong>Solo cotizar</strong><span>El comprador solicitará cotización</span></button>
            </div>
            <div className="catalog-product-grid compact">
              <CatalogField label="Precio de venta" optional={hasQuoteOnly}>
                <input
                  type="number"
                  min="0"
                  max="99999999"
                  disabled={hasQuoteOnly}
                  value={hasQuoteOnly ? '' : form.price}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                    const num = digits === '' ? '' : Math.min(Number(digits), 99999999);
                    update('price', num === '' ? '' : String(num));
                  }}
                  placeholder="0"
                  required={!hasQuoteOnly}
                />
              </CatalogField>
              <CatalogField label="Stock disponible">
                <input
                  type="number"
                  min="0"
                  max="99999"
                  value={form.stock}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
                    const num = digits === '' ? '' : Math.min(Number(digits), 99999);
                    update('stock', num === '' ? '' : String(num));
                  }}
                  required
                />
              </CatalogField>
              <CatalogField label="¿Requiere chasis?"><SearchableDropdown value={String(form.requiresChassis)} options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Sí, solo cotizar' }]} placeholder="Selecciona una opción" onChange={(value) => { const requiresChassis = value === 'true'; setForm((previous) => ({ ...previous, requiresChassis, pricingMode: requiresChassis ? 'QUOTE_ONLY' : previous.pricingMode })); }} /></CatalogField>
            </div>
            {form.pricingMode === 'SHOW_PRICE' && (
              <CommissionSummaryCard
                basePrice={Number(form.price) || 0}
                isFounder={isFounder}
                onApplySuggested={(suggestedPrice) => update('price', String(Math.min(suggestedPrice, 99999999)))}
              />
            )}
          </section>
          <section className="catalog-product-section" id="catalog-compatibility">
            <div className="catalog-section-title-row"><h3><b>3</b> Compatibilidad</h3>{!form.isUniversal && <button type="button" className="catalog-add-compatibility" onClick={() => update('compatibilities', [...form.compatibilities, emptyCompatibility()])}><Plus size={15} /> Agregar</button>}</div>
            <div className="catalog-condition-row"><span>¿Es un repuesto universal?</span>{[false, true].map((value) => <button type="button" key={String(value)} className={form.isUniversal === value ? 'active' : ''} onClick={() => update('isUniversal', value)}><Check size={14} />{value ? 'Sí, sirve para cualquier vehículo' : 'No'}</button>)}</div>
            {form.isUniversal
              ? <p className="catalog-universal-hint">Aparecerá en las búsquedas de todos los vehículos, así que no necesita declarar marca ni modelo. Úsalo solo para aceites, lubricantes, accesorios y similares.</p>
              : form.compatibilities.map((compatibility, index) => <div className="catalog-compatibility" key={index}>
              <div className="catalog-compatibility-heading"><strong>Compatibilidad {index + 1}</strong>{index > 0 && <button type="button" onClick={() => update('compatibilities', form.compatibilities.filter((_, itemIndex) => itemIndex !== index))} aria-label="Eliminar compatibilidad"><Trash2 size={15} /></button>}</div>
              <div className="catalog-product-grid compact">
                <CatalogField label="Marca vehículo"><SearchableDropdown value={compatibility.brandId} options={vehicleBrands.map((brand) => ({ value: brand.id, label: brand.nombre }))} placeholder="Selecciona una marca" onChange={(brandId) => changeVehicleBrand(index, String(brandId))} emptyText="No encontramos esa marca." /></CatalogField>
                <CatalogField label="Modelo"><SearchableDropdown value={compatibility.model} options={(modelOptions[compatibility.brandId] || []).map((model) => ({ value: model.nombre, label: model.nombre }))} placeholder={compatibility.brand ? 'Selecciona un modelo' : 'Selecciona primero una marca'} disabled={!compatibility.brand} onChange={(model) => updateCompatibility(index, { model: String(model), vehicleCatalogIds: [] })} emptyText="No encontramos ese modelo." /></CatalogField>
                <CatalogField label="Año desde"><SearchableDropdown value={compatibility.yearFrom} options={YEARS.map((year) => ({ value: String(year), label: String(year) }))} placeholder="Selecciona un año" onChange={(yearFrom) => updateCompatibility(index, { yearFrom: String(yearFrom), yearTo: compatibility.yearTo && Number(compatibility.yearTo) < Number(yearFrom) ? '' : compatibility.yearTo, vehicleCatalogIds: [] })} /></CatalogField>
                <CatalogField label="Año hasta"><SearchableDropdown value={compatibility.yearTo} options={YEARS.filter((year) => !compatibility.yearFrom || year >= Number(compatibility.yearFrom)).map((year) => ({ value: String(year), label: String(year) }))} placeholder="Selecciona un año" onChange={(yearTo) => updateCompatibility(index, { yearTo: String(yearTo), vehicleCatalogIds: [] })} /></CatalogField>
                <CatalogField label="Versiones" optional><button type="button" className="catalog-versions-open-button" onClick={() => openVersions(index)} disabled={!compatibility.brand || !compatibility.model}><ListChecks size={16} /><span>Ver versiones disponibles</span><em>{compatibility.vehicleCatalogIds.length ? `${compatibility.vehicleCatalogIds.length} elegida${compatibility.vehicleCatalogIds.length === 1 ? '' : 's'}` : 'Opcional'}</em></button></CatalogField>
                <CatalogField label="Motor" optional><input value={compatibility.motor} maxLength="40" onChange={(e) => updateCompatibility(index, { motor: e.target.value.slice(0, 40) })} placeholder="Ej. 2.0" /></CatalogField>
                <CatalogField label="Referencia OEM" optional><input value={compatibility.oem} maxLength="40" onChange={(e) => updateCompatibility(index, { oem: e.target.value.toUpperCase().slice(0, 40) })} placeholder="Ej. 04465-0K090" /></CatalogField>
              </div>
            </div>)}
          </section>
          <section className="catalog-product-section" id="catalog-media">
            <h3><b>4</b> Fotos <small>Opcional · hasta 4</small></h3>
            <div className="catalog-photo-grid">
              {existingPhotos.map((photoUrl, index) => (
                <div className="catalog-photo-preview" key={`existing-${photoUrl}-${index}`}>
                  <img src={resolveMediaUrl(photoUrl)} alt={`Foto ${index + 1}`} />
                  <button type="button" onClick={() => removeExistingPhoto(index)} aria-label="Quitar foto"><X size={14} /></button>
                </div>
              ))}
              {files.map(({ preview }, index) => (
                <div className="catalog-photo-preview" key={preview}>
                  <img src={preview} alt={`Vista previa ${index + 1}`} />
                  <button type="button" onClick={() => removeFile(index)} aria-label="Quitar foto"><X size={14} /></button>
                </div>
              ))}
              <label className="catalog-photo-upload">
                <Upload size={19} />
                <span>Agregar fotos<br /><small>{totalPhotosCount}/4</small></span>
                <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={totalPhotosCount >= MAX_PHOTOS} />
              </label>
            </div>
            {totalPhotosCount === 0 && <p className="catalog-photo-note"><ImageIcon size={15} /> Si no agregas fotos, el producto se publicará con la imagen genérica de RepuesTop.</p>}
          </section>
          <section className="catalog-product-section">
            <h3><b>5</b> Descripción y calidad</h3>
            <CatalogField label="Descripción"><textarea rows="4" maxLength="1000" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Describe el producto, sus características y detalles importantes." required /><small className="catalog-char-counter">{form.description.length}/1000</small></CatalogField>
            <div className="catalog-condition-row"><span>Calidad del producto</span>{['ORIGINAL', 'ALTERNATIVO'].map((condition) => <button type="button" key={condition} className={form.condition === condition ? 'active' : ''} onClick={() => update('condition', condition)}><Check size={14} />{condition === 'ORIGINAL' ? 'Original' : 'Alternativo'}</button>)}</div>
          </section>
          <footer className="catalog-product-footer"><button type="button" className="catalog-cancel-button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="catalog-save-button" disabled={saving || !canSave}>{saving ? <><Loader2 size={16} className="spin-icon" /> Guardando…</> : isEditing ? <><Check size={16} /> Guardar cambios</> : <><Plus size={16} /> Registrar producto</>}</button></footer>
        </form>
        {versionsModalIndex !== null && (() => {
          const compatibility = form.compatibilities[versionsModalIndex];
          const key = `${compatibility.brand}|${compatibility.model}|${compatibility.yearFrom}|${compatibility.yearTo}`;
          const availableVersions = versionOptions[key] || [];
          const needle = versionSearch.trim().toLocaleLowerCase('es');
          const filteredVersions = availableVersions.filter((version) => version.nombre.toLocaleLowerCase('es').includes(needle));
          const selectedIds = compatibility.vehicleCatalogIds;
          return <div className="catalog-versions-modal-backdrop" onMouseDown={() => setVersionsModalIndex(null)}>
            <section className="catalog-versions-modal" role="dialog" aria-modal="true" aria-label="Versiones disponibles" onMouseDown={(event) => event.stopPropagation()}>
              <header><div><span className="catalog-versions-modal-icon"><ListChecks size={20} /></span><div><h3>Versiones disponibles</h3><p>{compatibility.brand} · {compatibility.model}{compatibility.yearFrom ? ` · desde ${compatibility.yearFrom}` : ''}{compatibility.yearTo ? ` hasta ${compatibility.yearTo}` : ''}</p></div></div><button type="button" onClick={() => setVersionsModalIndex(null)} aria-label="Cerrar versiones"><X size={18} /></button></header>
              <div className="catalog-versions-selection-summary"><Check size={16} /><strong>{selectedIds.length}</strong> versión{selectedIds.length === 1 ? '' : 'es'} seleccionada{selectedIds.length === 1 ? '' : 's'}<button type="button" disabled={!selectedIds.length} onClick={() => updateCompatibility(versionsModalIndex, { vehicleCatalogIds: [] })}>Limpiar selección</button></div>
              <div className="catalog-versions-search"><Search size={17} /><input autoFocus value={versionSearch} maxLength={80} onChange={(event) => setVersionSearch(event.target.value)} placeholder="Buscar por versión, motor o transmisión..." /></div>
              <div className="catalog-versions-list">{versionModalError ? <p className="catalog-versions-empty">{versionModalError}</p> : filteredVersions.length ? filteredVersions.map((version) => { const isSelected = selectedIds.includes(String(version.id)); return <button type="button" key={version.id} className={isSelected ? 'selected' : ''} onClick={() => updateCompatibility(versionsModalIndex, { vehicleCatalogIds: isSelected ? selectedIds.filter((id) => id !== String(version.id)) : [...selectedIds, String(version.id)] })}><span className="catalog-version-checkbox">{isSelected && <Check size={14} />}</span><span>{version.nombre}</span></button>; }) : <p className="catalog-versions-empty">No hay versiones para los filtros seleccionados.</p>}</div>
              <footer><button type="button" className="catalog-save-button" onClick={() => setVersionsModalIndex(null)}><Check size={16} /> Confirmar selección</button></footer>
            </section>
          </div>;
        })()}
      </section>
    </div>
  );
}
