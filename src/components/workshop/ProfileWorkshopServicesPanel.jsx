import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import {
  createWorkshopService, deleteWorkshopService, getWorkshopServiceCategories, getWorkshopServices, updateWorkshopService,
} from '../../services/workshopApi';
import '../../styles/faults.css';

const EMPTY = { nombre: '', categoria: '', incluye: [], descripcion: '', cotizar: false, precio: '', duracion: '', marcas: '' };

function toForm(service) {
  return {
    nombre: service.nombre || '', categoria: service.categoria || '', incluye: service.incluye || [], descripcion: service.descripcion || '',
    cotizar: service.tipoPrecio === 'quote', precio: service.precio != null ? String(service.precio) : '',
    duracion: service.duracionMinutos != null ? String(service.duracionMinutos) : '',
    marcas: (service.marcasEspecialistas || []).join(', '),
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
    marcasEspecialistas: form.marcas.split(',').map((brand) => brand.trim()).filter(Boolean).slice(0, 20),
  };
}

/** Catálogo de servicios del taller: se registran una vez y se muestran en el perfil del taller. */
export default function ProfileWorkshopServicesPanel() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // 'new' | servicio
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

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

  const open = (service) => { setEditing(service); setForm(service === 'new' ? EMPTY : toForm(service)); setFormError(''); };

  const save = async (event) => {
    event.preventDefault();
    if (!form.nombre.trim()) return setFormError('Indica el nombre del servicio.');
    if (!form.categoria) return setFormError('Selecciona la categoría del servicio.');
    if (!form.cotizar && !form.precio.replace(/\D/g, '')) return setFormError('Indica el precio o márcalo como "a cotizar".');
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') await createWorkshopService(toPayload(form));
      else await updateWorkshopService(editing.id, toPayload(form));
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err?.message || 'No pudimos guardar el servicio.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (service) => {
    if (!window.confirm(`"${service.nombre}" dejará de mostrarse en tu perfil. ¿Eliminarlo?`)) return;
    try { await deleteWorkshopService(service.id); await load(); } catch (err) { setLoadError(err?.message || 'No pudimos eliminar el servicio.'); }
  };

  return (
    <div className="ft-page" style={{ background: 'transparent', minHeight: 0, paddingBottom: 0 }}>
      <div className="ft-shell" style={{ padding: 0 }}>
        <div className="ft-head">
          <div><h2>Mis servicios</h2><p>Regístralos una vez, con su precio y las marcas en que eres especialista, y los clientes los ven en tu perfil.</p></div>
          <button type="button" className="ft-btn ft-btn-primary" onClick={() => open('new')}><Plus size={16} /> Nuevo servicio</button>
        </div>

        {editing && (
          <form className="ft-card ft-form" onSubmit={save}>
            <strong>{editing === 'new' ? 'Nuevo servicio' : 'Editar servicio'}</strong>
            <label className="ft-field"><span>Nombre del servicio</span><input value={form.nombre} maxLength={120} placeholder="Ej: Cambio de pastillas de freno" onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
            <div className="ft-row">
              <label className="ft-field"><span>Categoría</span><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value, incluye: [] })}><option value="">Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label>
              <label className="ft-field"><span>Duración en minutos <small>Opcional</small></span><input inputMode="numeric" value={form.duracion} maxLength={4} onChange={(e) => setForm({ ...form, duracion: e.target.value.replace(/\D/g, '') })} /></label>
            </div>
            <div className="ft-field">
              <span>Subcategorías del servicio <small>Selecciona todas las que correspondan</small></span>
              <div className="ft-chips">
                {(categories.find((category) => category.id === form.categoria)?.subcategorias || []).map((subcategory) => {
                  const selected = form.incluye.includes(subcategory);
                  return <button key={subcategory} type="button" className={`ft-chip is-toggle ${selected ? 'is-on' : ''}`} aria-pressed={selected} onClick={() => setForm({ ...form, incluye: selected ? form.incluye.filter((item) => item !== subcategory) : [...form.incluye, subcategory] })}>{subcategory}</button>;
                })}
              </div>
              {!form.categoria && <small>Elige primero una categoría.</small>}
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={form.cotizar} onChange={(e) => setForm({ ...form, cotizar: e.target.checked })} /> Precio a cotizar
            </label>
            {!form.cotizar && <label className="ft-field"><span>Precio (CLP)</span><input inputMode="numeric" value={form.precio} maxLength={9} placeholder="35000" onChange={(e) => setForm({ ...form, precio: e.target.value.replace(/\D/g, '') })} /></label>}
            <label className="ft-field"><span>Descripción <small>Opcional</small></span><textarea rows={3} value={form.descripcion} maxLength={2000} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></label>
            <label className="ft-field"><span>Marcas especialistas <small>Opcional, separadas por coma</small></span><input value={form.marcas} placeholder="Toyota, Kia" onChange={(e) => setForm({ ...form, marcas: e.target.value })} /></label>
            {formError && <p className="ft-error" role="alert"><AlertCircle size={15} /> {formError}</p>}
            <div className="ft-actions">
              <button type="submit" className="ft-btn ft-btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar servicio'}</button>
              <button type="button" className="ft-btn ft-btn-outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando tus servicios…</div>
        ) : loadError ? (
          <div className="ft-empty" role="alert"><AlertCircle size={20} /><strong>No pudimos cargar tus servicios</strong>{loadError}<br />
            <button type="button" className="ft-btn ft-btn-outline" style={{ marginTop: 10 }} onClick={load}>Reintentar</button></div>
        ) : services.length === 0 ? (
          <div className="ft-empty"><Wrench size={22} /><strong>Aún no registras servicios</strong>Agrega cada servicio con su precio y las marcas en que eres especialista.</div>
        ) : (
          <div className="ft-list">
            {services.map((service) => (
              <div key={service.id} className="ft-card">
                <div className="ft-card-top">
                  <div><h3>{service.nombre}</h3><span className="ft-price">{service.precioTexto}</span></div>
                  <div className="ft-actions">
                    <button type="button" className="ft-icon-btn" onClick={() => open(service)} aria-label={`Editar ${service.nombre}`}><Pencil size={17} /></button>
                    <button type="button" className="ft-icon-btn" onClick={() => remove(service)} aria-label={`Eliminar ${service.nombre}`}><Trash2 size={17} /></button>
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
    </div>
  );
}
