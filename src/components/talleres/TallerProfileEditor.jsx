import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, ImagePlus, Loader2, AlertTriangle, CheckCircle2, Save, Home, Calendar, MessageCircle, X
} from 'lucide-react';
import { SERVICE_CATEGORIES, TALLER_FEATURE_TAGS } from '../../data/talleresData';
import { fetchMiTaller, updateMiTallerPerfil, uploadTallerPhotos } from '../../services/talleresStorage';
import { apiErrorMessage } from '../../services/walletStorage';
import { getVehicleBrandsApi } from '../../services/api';
import SpecialistBrandsManager from '../SpecialistBrandsManager';
import './taller-editor.css';

const MAX_PHOTOS = 6;
const MAX_SERVICES = 30;
const MAX_FEATURES = 12;
const EMPTY_SERVICE = { name: '', category: '', priceType: 'fixed', priceFrom: '' };

const toDraft = (taller) => ({
  description: taller?.description || '',
  photos: taller?.photos || [],
  categories: taller?.categories || [],
  services: (taller?.services || []).map((service) => ({
    name: service.name,
    category: service.category || '',
    priceType: service.priceType === 'fixed' && service.priceFrom != null ? 'fixed' : 'quote',
    priceFrom: service.priceFrom != null ? String(service.priceFrom) : '',
  })),
  specialistBrands: taller?.specialistBrands || [],
  features: taller?.features || [],
  whatsapp: taller?.whatsapp ? String(taller.whatsapp).replace(/^\+?56\s?/, '') : '',
  homeService: taller?.homeService === true,
  hasOnlineBooking: taller?.hasOnlineBooking === true,
});

/**
 * Editor del perfil publico del taller: lo que ven los clientes en la card del buscador y en el
 * perfil. Guarda con `PUT /automotive-services/me/perfil`. Contraparte de
 * `mobile/components/talleres/TallerProfileEditor.tsx`.
 *
 * - `hasAgenda`: el taller ya registro su horario principal (requisito para recibir citas en linea).
 * - `only24Hours`: un taller solo 24/7 se contacta directo, sin agenda.
 */
export default function TallerProfileEditor({ hasAgenda, only24Hours = false, onOpenAgenda, onSaved }) {
  const [draft, setDraft] = useState(() => toDraft(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [brandOptions, setBrandOptions] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchMiTaller({ signal: controller.signal })
      .then((taller) => { setDraft(toDraft(taller)); setLoadError(''); })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setLoadError(apiErrorMessage(error, 'No pudimos cargar el perfil de tu taller.'));
      })
      .finally(() => setLoading(false));
    getVehicleBrandsApi({ signal: controller.signal })
      .then((list) => setBrandOptions((Array.isArray(list) ? list : []).map((item) => ({ id: item.id, nombre: item.nombre || item.name }))))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const update = (patch) => { setDraft((current) => ({ ...current, ...patch })); setSavedAt(null); };
  const updateService = (index, patch) => update({
    services: draft.services.map((service, i) => (i === index ? { ...service, ...patch } : service)),
  });

  const selectedBrands = useMemo(() => {
    const byName = new Map(brandOptions.map((brand) => [String(brand.nombre).toLowerCase(), brand]));
    return draft.specialistBrands.map((name) => byName.get(name.toLowerCase())).filter(Boolean);
  }, [brandOptions, draft.specialistBrands]);

  const toggleCategory = (id) => update({
    categories: draft.categories.includes(id)
      ? draft.categories.filter((item) => item !== id)
      : [...draft.categories, id].slice(0, 10),
  });
  const toggleFeature = (feature) => update({
    features: draft.features.includes(feature)
      ? draft.features.filter((item) => item !== feature)
      : [...draft.features, feature].slice(0, MAX_FEATURES),
  });

  const handlePickPhotos = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_PHOTOS - draft.photos.length);
    event.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    setSaveError('');
    try {
      const urls = await uploadTallerPhotos(files);
      update({ photos: [...draft.photos, ...urls].slice(0, MAX_PHOTOS) });
    } catch (error) {
      setSaveError(apiErrorMessage(error, 'No se pudieron subir las fotos.'));
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    const names = new Set();
    for (const service of draft.services) {
      const name = service.name.trim();
      if (!name) return 'Cada servicio necesita un nombre. Borra las filas vacías.';
      if (names.has(name.toLowerCase())) return `«${name}» está repetido.`;
      names.add(name.toLowerCase());
      if (service.priceType === 'fixed' && !(Number(service.priceFrom) >= 0 && service.priceFrom !== '')) {
        return `Ingresa el precio desde de «${name}» o márcalo como «A cotizar».`;
      }
    }
    if (draft.whatsapp.trim() && draft.whatsapp.replace(/\D/g, '').replace(/^56/, '').length !== 9) {
      return 'El WhatsApp debe tener 9 dígitos.';
    }
    return '';
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) { setSaveError(problem); return; }
    setSaving(true);
    setSaveError('');
    try {
      const saved = await updateMiTallerPerfil({
        description: draft.description,
        photos: draft.photos,
        categories: draft.categories,
        services: draft.services,
        specialistBrands: draft.specialistBrands,
        features: draft.features,
        whatsapp: draft.whatsapp.trim() ? `56${draft.whatsapp.replace(/\D/g, '').replace(/^56/, '')}` : '',
        homeService: draft.homeService,
        hasOnlineBooking: draft.hasOnlineBooking && !only24Hours,
      });
      setDraft(toDraft(saved));
      setSavedAt(new Date());
      onSaved?.(saved);
    } catch (error) {
      setSaveError(apiErrorMessage(error, 'No se pudo guardar el perfil.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="taller-editor taller-editor--loading"><Loader2 size={20} className="spin-icon" /> Cargando el perfil de tu taller…</div>;
  }
  if (loadError) {
    return <div className="taller-editor"><div className="ad-form-error"><AlertTriangle size={15} /><span>{loadError}</span></div></div>;
  }

  return (
    <section className="taller-editor" aria-labelledby="taller-editor-title">
      <header className="taller-editor__head">
        <div>
          <h3 id="taller-editor-title">Perfil de tu taller</h3>
          <p>Esto es lo que ven los clientes cuando te encuentran. Sin al menos un servicio, tu taller no aparece en el buscador.</p>
        </div>
        <button type="button" className="taller-editor__save" onClick={handleSave} disabled={saving || uploading}>
          {saving ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />} Guardar perfil
        </button>
      </header>

      {saveError && <div className="ad-form-error" role="alert"><AlertTriangle size={15} /><span>{saveError}</span></div>}
      {savedAt && !saveError && <div className="taller-editor__ok" role="status"><CheckCircle2 size={15} /> Perfil guardado. Ya está visible para los clientes.</div>}

      {/* Servicios y precios */}
      <div className="taller-editor__block">
        <h4>Servicios y precios <small>{draft.services.length}/{MAX_SERVICES}</small></h4>
        <p className="taller-editor__hint">Lista lo que haces con su precio «desde». Los clientes buscan por servicio: mientras más claro, más te encuentran.</p>
        <div className="taller-editor__services">
          {draft.services.map((service, index) => (
            <div className="taller-editor__service" key={index}>
              <input
                type="text"
                value={service.name}
                maxLength={120}
                placeholder="Ej: Cambio de pastillas de freno"
                aria-label={`Nombre del servicio ${index + 1}`}
                onChange={(event) => updateService(index, { name: event.target.value })}
              />
              <select
                value={service.category}
                aria-label={`Categoría del servicio ${index + 1}`}
                onChange={(event) => updateService(index, { category: event.target.value })}
              >
                <option value="">Categoría</option>
                {SERVICE_CATEGORIES.filter((category) => category.id !== 'TODAS').map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
              <select
                value={service.priceType}
                aria-label={`Tipo de precio del servicio ${index + 1}`}
                onChange={(event) => updateService(index, { priceType: event.target.value })}
              >
                <option value="fixed">Desde $</option>
                <option value="quote">A cotizar</option>
              </select>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={service.priceType === 'fixed' ? service.priceFrom : ''}
                disabled={service.priceType !== 'fixed'}
                placeholder="30000"
                aria-label={`Precio desde del servicio ${index + 1}`}
                onChange={(event) => updateService(index, { priceFrom: event.target.value })}
              />
              <button
                type="button"
                className="taller-editor__remove"
                onClick={() => update({ services: draft.services.filter((_, i) => i !== index) })}
                aria-label={`Quitar servicio ${index + 1}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="taller-editor__add"
          disabled={draft.services.length >= MAX_SERVICES}
          onClick={() => update({ services: [...draft.services, { ...EMPTY_SERVICE }] })}
        >
          <Plus size={15} /> Agregar servicio
        </button>
      </div>

      {/* Especialidades */}
      <div className="taller-editor__block">
        <h4>Especialidades</h4>
        <p className="taller-editor__hint">Marca en qué áreas trabajas: así apareces al filtrar por categoría.</p>
        <div className="taller-editor__chips">
          {SERVICE_CATEGORIES.filter((category) => category.id !== 'TODAS').map((category) => (
            <button
              type="button"
              key={category.id}
              className={draft.categories.includes(category.id) ? 'is-on' : ''}
              aria-pressed={draft.categories.includes(category.id)}
              onClick={() => toggleCategory(category.id)}
            >
              <span aria-hidden="true">{category.emoji}</span> {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Marcas */}
      <div className="taller-editor__block">
        <h4>Marcas en las que eres especialista</h4>
        <p className="taller-editor__hint">Opcional. Sin marcas se te muestra como taller multimarca.</p>
        <SpecialistBrandsManager
          selectionOnly
          initialBrands={selectedBrands}
          onBrandsChange={(brands) => update({ specialistBrands: brands.map((brand) => brand.nombre) })}
        />
      </div>

      {/* Fotos */}
      <div className="taller-editor__block">
        <h4>Fotos <small>{draft.photos.length}/{MAX_PHOTOS}</small></h4>
        <p className="taller-editor__hint">La primera es la portada de tu card. Muestra el taller, el equipo y trabajos terminados.</p>
        <div className="taller-editor__photos">
          {draft.photos.map((src, index) => (
            <div className="taller-editor__photo" key={`${src}-${index}`}>
              <img src={src} alt={`Foto ${index + 1} del taller`} />
              {index === 0 && <span>Portada</span>}
              <button type="button" onClick={() => update({ photos: draft.photos.filter((_, i) => i !== index) })} aria-label={`Quitar foto ${index + 1}`}>
                <X size={14} />
              </button>
            </div>
          ))}
          {draft.photos.length < MAX_PHOTOS && (
            <button type="button" className="taller-editor__photo-add" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={20} className="spin-icon" /> : <ImagePlus size={20} />}
              <span>{uploading ? 'Subiendo…' : 'Agregar'}</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handlePickPhotos} />
        </div>
      </div>

      {/* Atención */}
      <div className="taller-editor__block">
        <h4>Atención</h4>
        <label className="taller-editor__switch">
          <input type="checkbox" checked={draft.homeService} onChange={(event) => update({ homeService: event.target.checked })} />
          <span><Home size={15} /> <strong>Voy a domicilio</strong><small>Dentro de la comuna de tu taller.</small></span>
        </label>
        <label className={`taller-editor__switch ${only24Hours || !hasAgenda ? 'is-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={draft.hasOnlineBooking && !only24Hours}
            disabled={only24Hours || !hasAgenda}
            onChange={(event) => update({ hasOnlineBooking: event.target.checked })}
          />
          <span>
            <Calendar size={15} /> <strong>Recibir citas en línea</strong>
            <small>
              {only24Hours
                ? 'Un taller que atiende solo 24/7 se contacta directo.'
                : hasAgenda
                  ? 'Los clientes reservan dentro de tu horario principal.'
                  : <>Primero registra tu horario. <button type="button" onClick={onOpenAgenda}>Registrar horario</button></>}
            </small>
          </span>
        </label>
        <div className="taller-editor__field">
          <label htmlFor="taller-whatsapp"><MessageCircle size={14} /> WhatsApp</label>
          <div className="taller-editor__phone">
            <span>+56</span>
            <input
              id="taller-whatsapp"
              type="tel"
              inputMode="numeric"
              maxLength={9}
              placeholder="9XXXXXXXX"
              value={draft.whatsapp}
              onChange={(event) => update({ whatsapp: event.target.value.replace(/\D/g, '').slice(0, 9) })}
            />
          </div>
          <small>Opcional. Aparece como botón de contacto directo.</small>
        </div>
      </div>

      {/* Descripción y características */}
      <div className="taller-editor__block">
        <h4>Sobre tu taller</h4>
        <textarea
          rows={4}
          maxLength={2000}
          value={draft.description}
          placeholder="Cuéntales a los clientes quién eres, tu experiencia y por qué confiar en tu taller."
          onChange={(event) => update({ description: event.target.value })}
          aria-label="Descripción del taller"
        />
        <small className="taller-editor__counter">{draft.description.length}/2000</small>
        <div className="taller-editor__chips">
          {TALLER_FEATURE_TAGS.slice(0, 20).map((feature) => (
            <button
              type="button"
              key={feature}
              className={draft.features.includes(feature) ? 'is-on' : ''}
              aria-pressed={draft.features.includes(feature)}
              onClick={() => toggleFeature(feature)}
            >
              {feature}
            </button>
          ))}
        </div>
      </div>

      <footer className="taller-editor__foot">
        <button type="button" className="taller-editor__save" onClick={handleSave} disabled={saving || uploading}>
          {saving ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />} Guardar perfil
        </button>
      </footer>
    </section>
  );
}
