import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Pencil, Plus, Search, Trash2, Wrench, X } from 'lucide-react';
import {
  createWorkshopService, deleteWorkshopService, getDiagnosticStatus, getWorkshopServiceCategories, getWorkshopServices, updateWorkshopService,
} from '../../services/workshopApi';
import { getVehicleBrandsApi } from '../../services/api';
import { MAX_PRICE, MAX_SEARCH_LENGTH } from '../../utils/inputLimits';
import ConfirmDialog from '../ConfirmDialog';
import SheetSelect from '../SheetSelect';
import SpecialistBrandsManager from '../SpecialistBrandsManager';
import EditDialog from '../talleres/EditDialog';
import '../../styles/faults.css';
import '../talleres/taller-editor.css';

const EMPTY = { nombre: '', categoria: '', incluye: [], descripcion: '', cotizar: false, precio: '', duracion: '', marcas: [] };
// Mismos topes que `ServicioTallerDTOs.Request`.
const MAX_DURATION = 1440;
const MAX_BRANDS = 20;
const MAX_INCLUDES = 20;
const OTHER_NAME = '__otro__';

const normalize = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function toForm(service) {
  return {
    nombre: service.nombre || '', categoria: service.categoria || '', incluye: service.incluye || [], descripcion: service.descripcion || '',
    cotizar: service.tipoPrecio === 'quote', precio: service.precio != null ? String(service.precio) : '',
    duracion: service.duracionMinutos != null ? String(service.duracionMinutos) : '',
    marcas: service.marcasEspecialistas || [],
  };
}

function toPayload(form) {
  const duration = parseInt(form.duracion.replace(/\D/g, ''), 10);
  return {
    nombre: form.nombre.trim(),
    categoria: form.categoria.trim() || null,
    incluye: form.incluye,
    descripcion: form.descripcion.trim() || null,
    tipoPrecio: form.cotizar ? 'quote' : 'fixed',
    precio: form.cotizar ? null : parseInt(form.precio.replace(/\D/g, ''), 10),
    duracionMinutos: Number.isFinite(duration) && duration > 0 ? duration : null,
    marcasEspecialistas: form.marcas.slice(0, MAX_BRANDS),
  };
}

/**
 * Catálogo de servicios del taller, con la misma organización de `mobile/components/workshop/WorkshopServicesManager.tsx`:
 * lista con búsqueda y filtro, y alta o edición en una ventana. El nombre se elige de las subcategorías del catálogo para
 * evitar errores de tipeo; «Otro» deja escribir uno propio. Se llega desde Mi taller (`onBack` vuelve); `?nuevo=1` abre uno nuevo.
 */
export default function ProfileWorkshopServicesPanel({ onBack }) {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // 'new' | servicio
  const [form, setForm] = useState(EMPTY);
  const [customName, setCustomName] = useState(false);
  const [includeText, setIncludeText] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [brandOptions, setBrandOptions] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [data, catalog] = await Promise.all([getWorkshopServices(), getWorkshopServiceCategories().catch(() => [])]);
      setServices(Array.isArray(data) ? data : []);
      setCategories(Array.isArray(catalog) ? catalog : []);
    } catch (err) {
      setLoadError(err?.message || 'No pudimos cargar tus servicios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    getVehicleBrandsApi()
      .then((list) => setBrandOptions((Array.isArray(list) ? list : []).map((item) => ({ id: item.id, nombre: item.nombre || item.name }))))
      .catch(() => {});
  }, []);

  // Todas las subcategorías del catálogo, cada una con su categoría.
  const nameOptions = useMemo(() => categories.flatMap((category) => (category.subcategorias || []).map((nombre) => ({
    value: `${category.id}::${nombre}`, label: `${nombre} · ${category.nombre}`, nombre, categoria: category.id,
  }))), [categories]);
  const nameSelectOptions = useMemo(() => [...nameOptions, { value: OTHER_NAME, label: 'Otro (escribir el nombre)', alwaysVisible: true }], [nameOptions]);
  const categorySelected = categories.find((category) => category.id === form.categoria);

  // Las marcas del servicio se guardan por nombre; el selector parte de las del catalogo al abrir el formulario
  // (no en cada cambio, o se reiniciaria mientras el taller elige).
  const open = (service) => {
    const next = service === 'new' ? EMPTY : toForm(service);
    const byName = new Map(brandOptions.map((brand) => [String(brand.nombre).toLowerCase(), brand]));
    setSelectedBrands(next.marcas.map((name) => byName.get(String(name).toLowerCase()) || { id: `nombre:${name}`, nombre: name }));
    setEditing(service);
    setForm(next);
    setCustomName(service !== 'new' && !nameOptions.some((option) => normalize(option.nombre) === normalize(next.nombre)));
    setIncludeText('');
    setFormError('');
  };

  // El «+» de Mi taller llega con `?nuevo=1`: se consume una sola vez.
  useEffect(() => {
    if (searchParams.get('nuevo') !== '1') return;
    open('new');
    const next = new URLSearchParams(searchParams);
    next.delete('nuevo');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const pickName = (value) => {
    if (value === OTHER_NAME) {
      setCustomName(true);
      setForm((current) => ({ ...current, nombre: '' }));
      return;
    }
    const option = nameOptions.find((item) => item.value === value);
    if (!option) return;
    setCustomName(false);
    setForm((current) => ({ ...current, nombre: option.nombre, categoria: option.categoria }));
  };
  const nameValue = customName ? OTHER_NAME : (nameOptions.find((option) => normalize(option.nombre) === normalize(form.nombre) && option.categoria === form.categoria)?.value || '');

  const addInclude = () => {
    const item = includeText.trim();
    if (!item || form.incluye.length >= MAX_INCLUDES) return;
    if (!form.incluye.some((current) => normalize(current) === normalize(item))) setForm({ ...form, incluye: [...form.incluye, item] });
    setIncludeText('');
  };

  // Al registrar un servicio se recuerda que el servicio de agendamiento habilita las citas.
  const announceDiagnostic = async () => {
    const status = await getDiagnosticStatus().catch(() => null);
    setNotice(status?.activo
      ? 'Servicio registrado. Tu servicio de agendamiento está activo: puedes recibir citas y ofrecerlas en tus comentarios de fallas.'
      : 'Servicio registrado. Activa el servicio de agendamiento para recibir citas y ofrecerlas en tus comentarios de fallas.');
  };

  const save = async () => {
    if (!form.nombre.trim()) return setFormError('Elige el servicio de la lista, o usa «Otro» para escribir su nombre.');
    if (!form.categoria) return setFormError('Elige la categoría del servicio (usa «Otros» si ninguna calza).');
    if (!form.cotizar) {
      const price = parseInt(form.precio, 10);
      if (!Number.isFinite(price)) return setFormError('Indica el precio o márcalo como «A cotizar».');
      if (price < 1 || price > MAX_PRICE) return setFormError(`El precio debe estar entre $1 y $${MAX_PRICE.toLocaleString('es-CL')}.`);
    }
    const duration = parseInt(form.duracion, 10);
    if (Number.isFinite(duration) && duration > MAX_DURATION) return setFormError(`La duración no puede superar ${MAX_DURATION} minutos (24 horas).`);
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      const isNew = editing === 'new';
      if (isNew) await createWorkshopService(toPayload(form));
      else await updateWorkshopService(editing.id, toPayload(form));
      setEditing(null);
      await load();
      if (isNew) await announceDiagnostic();
    } catch (err) {
      setFormError(err?.message || 'No pudimos guardar el servicio.');
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteWorkshopService(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setDeleteError(err?.message || 'No pudimos eliminar el servicio.');
    } finally {
      setDeleting(false);
    }
  };

  const categoriesInUse = useMemo(() => {
    const ids = new Set(services.map((service) => service.categoria));
    return categories.filter((category) => ids.has(category.id));
  }, [services, categories]);
  const visible = useMemo(() => {
    const needle = normalize(search);
    return services.filter((service) => (!categoryFilter || service.categoria === categoryFilter)
      && (!needle || normalize(`${service.nombre} ${service.categoriaNombre || ''}`).includes(needle)));
  }, [services, search, categoryFilter]);

  return (
    <div className="ft-page" style={{ background: 'transparent', minHeight: 0, paddingBottom: 0 }}>
      <div className="ft-shell" style={{ padding: 0 }}>
        <div className="ft-head">
          <div>
            {onBack && <button type="button" className="ft-btn ft-btn-outline" style={{ marginBottom: 10 }} onClick={onBack}><ArrowLeft size={15} /> Volver a Mi taller</button>}
            <h2>Servicios y precios</h2>
            <p>Regístralos con su precio y las marcas en que eres especialista. Sin al menos un servicio, tu taller no aparece en el buscador.</p>
          </div>
          <button type="button" className="ft-btn ft-btn-primary" onClick={() => open('new')}><Plus size={16} /> Nuevo servicio</button>
        </div>

        {notice && <div className="taller-editor__ok" role="status"><CheckCircle2 size={15} /> {notice}</div>}

        {services.length > 0 && (
          <div className="taller-editor__list-tools">
            <label className="ft-field">
              <span className="taller-editor__search"><Search size={15} /><input type="search" value={search} maxLength={MAX_SEARCH_LENGTH} placeholder="Buscar servicio…" aria-label="Buscar servicio" onChange={(event) => setSearch(event.target.value)} /></span>
            </label>
            {categoriesInUse.length > 1 && (
              <div className="ft-chips" role="group" aria-label="Filtrar por categoría">
                <button type="button" className={`ft-chip is-toggle ${!categoryFilter ? 'is-on' : ''}`} aria-pressed={!categoryFilter} onClick={() => setCategoryFilter('')}>Todas</button>
                {categoriesInUse.map((category) => (
                  <button key={category.id} type="button" className={`ft-chip is-toggle ${categoryFilter === category.id ? 'is-on' : ''}`} aria-pressed={categoryFilter === category.id} onClick={() => setCategoryFilter(categoryFilter === category.id ? '' : category.id)}>{category.nombre}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando tus servicios…</div>
        ) : loadError ? (
          <div className="ft-empty" role="alert"><AlertCircle size={20} /><strong>No pudimos cargar tus servicios</strong>{loadError}<br />
            <button type="button" className="ft-btn ft-btn-outline" style={{ marginTop: 10 }} onClick={load}>Reintentar</button></div>
        ) : services.length === 0 ? (
          <div className="ft-empty"><Wrench size={22} /><strong>Aún no registras servicios</strong>Agrega cada servicio con su precio y las marcas en que eres especialista.</div>
        ) : visible.length === 0 ? (
          <div className="ft-empty"><Search size={22} /><strong>Sin resultados</strong>Ningún servicio coincide con tu búsqueda.</div>
        ) : (
          <div className="ft-list">
            {visible.map((service) => (
              <div key={service.id} className="ft-card">
                <div className="ft-card-top">
                  <div><h3>{service.nombre}</h3><span className="ft-price">{service.precioTexto}</span></div>
                  <div className="ft-actions">
                    <button type="button" className="ft-icon-btn" onClick={() => open(service)} aria-label={`Editar ${service.nombre}`}><Pencil size={17} /></button>
                    <button type="button" className="ft-icon-btn" onClick={() => { setDeleteError(''); setPendingDelete(service); }} aria-label={`Eliminar ${service.nombre}`}><Trash2 size={17} /></button>
                  </div>
                </div>
                {service.descripcion && <p className="ft-sub">{service.descripcion}</p>}
                {service.incluye?.length > 0 && <div className="ft-chips">{service.incluye.map((item) => <span key={item} className="ft-chip">{item}</span>)}</div>}
                <p className="ft-sub">{[service.categoriaNombre || service.categoria, service.duracionMinutos ? `${service.duracionMinutos} min` : null, service.marcasEspecialistas?.length ? `Especialista: ${service.marcasEspecialistas.join(', ')}` : null].filter(Boolean).join(' · ')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditDialog
          icon={Wrench}
          title={editing === 'new' ? 'Nuevo servicio' : 'Editar servicio'}
          subtitle="Lo que elijas es el título que ven tus clientes."
          busy={saving}
          error={formError}
          saveLabel="Guardar servicio"
          onClose={() => setEditing(null)}
          onSave={save}
        >
          <div className="form-group">
            <label>Servicio</label>
            <SheetSelect label="Servicio" ariaLabel="Servicio" searchable value={nameValue} options={nameSelectOptions} placeholder="Busca y elige el servicio" onChange={pickName} />
          </div>
          {customName && (
            <div className="taller-editor__pair">
              <div className="form-group">
                <label htmlFor="service-custom-name">Nombre del servicio</label>
                <input id="service-custom-name" type="text" maxLength={120} value={form.nombre} placeholder="Ej: Cambio de pastillas de freno" onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="service-category">Categoría</label>
                <select id="service-category" value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })}>
                  <option value="">Selecciona una categoría</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}
                </select>
              </div>
            </div>
          )}
          {!customName && categorySelected && <p className="ft-sub">Categoría: {categorySelected.nombre}</p>}

          <div className="form-group">
            <label>Precio</label>
            <div className="workshop-hours-yesno" role="radiogroup" aria-label="Tipo de precio">
              {[[false, 'Precio fijo'], [true, 'A cotizar']].map(([value, label]) => (
                <label key={label} className={`workshop-hours-option ${form.cotizar === value ? 'is-active' : ''}`}>
                  <input type="radio" name="service-price-type" checked={form.cotizar === value} onChange={() => setForm({ ...form, cotizar: value })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="taller-editor__pair">
            {!form.cotizar && (
              <div className="form-group">
                <label htmlFor="service-price">Precio (CLP)</label>
                <input id="service-price" type="text" inputMode="numeric" maxLength={9} value={form.precio} placeholder="35000" onChange={(event) => setForm({ ...form, precio: event.target.value.replace(/\D/g, '') })} />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="service-duration">Duración en minutos (opcional)</label>
              <input id="service-duration" type="text" inputMode="numeric" maxLength={4} value={form.duracion} placeholder="60" onChange={(event) => setForm({ ...form, duracion: event.target.value.replace(/\D/g, '') })} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="service-include">Qué incluye ({form.incluye.length}/{MAX_INCLUDES}, opcional)</label>
            <div className="taller-editor__include">
              <input
                id="service-include"
                type="text"
                maxLength={120}
                value={includeText}
                placeholder="Ej: Revisión de discos"
                onChange={(event) => setIncludeText(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addInclude(); } }}
              />
              <button type="button" className="agenda-cfg-icon" aria-label="Agregar a lo que incluye" disabled={!includeText.trim() || form.incluye.length >= MAX_INCLUDES} onClick={addInclude}><Plus size={16} /></button>
            </div>
            {form.incluye.length > 0 && (
              <div className="taller-editor__chips">
                {form.incluye.map((item) => (
                  <button key={item} type="button" aria-label={`Quitar ${item}`} onClick={() => setForm({ ...form, incluye: form.incluye.filter((value) => value !== item) })}>
                    {item} <X size={12} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Marcas especialistas (opcional)</label>
            <SpecialistBrandsManager
              selectionOnly
              forWorkshop
              initialBrands={selectedBrands}
              onBrandsChange={(brands) => setForm((current) => ({ ...current, marcas: brands.map((brand) => brand.nombre).slice(0, MAX_BRANDS) }))}
            />
          </div>
        </EditDialog>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="¿Eliminar este servicio?"
        message={pendingDelete ? `«${pendingDelete.nombre}» dejará de mostrarse en tu perfil y en el buscador.` : ''}
        confirmLabel="Sí, eliminar"
        cancelLabel="No, volver"
        isBusy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
      />
    </div>
  );
}
