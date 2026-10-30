import React, { useEffect, useRef, useState } from 'react';
import {
  ImagePlus, Loader2, AlertTriangle, CheckCircle2, Save, Home, Calendar, MessageCircle, X
} from 'lucide-react';
import { fetchMiTaller, updateMiTallerPerfil, uploadTallerPhotos } from '../../services/talleresStorage';
import { getTallerInfo, saveTallerInfo } from '../../services/workshopApi';
import { apiErrorMessage } from '../../services/walletStorage';
import './taller-editor.css';

const MAX_PHOTOS = 6;
// Mismos topes que `TallerInfoDTOs.Request` del backend.
const MAX_DESCRIPTION = 400;
const MAX_YEARS = 80;
const MAX_EQUIPMENT = 10;

const toDraft = (taller) => ({
  photos: taller?.photos || [],
  whatsapp: taller?.whatsapp ? String(taller.whatsapp).replace(/^\+?56\s?/, '') : '',
  homeService: taller?.homeService === true,
  hasOnlineBooking: taller?.hasOnlineBooking === true,
});

const toInfo = (data) => {
  const info = data?.info || {};
  return {
    descripcion: info.descripcion || '',
    anios: info.aniosExperiencia != null ? String(info.aniosExperiencia) : '',
    garantia: info.garantia || '',
    equipamiento: Array.isArray(info.equipamiento) ? info.equipamiento : [],
  };
};

/**
 * Editor del perfil publico del taller: fotos, atencion, contacto y «Sobre tu taller», todo con un solo Guardar.
 * Por dentro son dos recursos: `PUT /automotive-services/me/perfil` (fotos, WhatsApp, domicilio y reservas) y
 * `PUT /taller/informacion` (descripcion, experiencia, garantia y equipamiento). Los servicios con precio van en su
 * propia seccion de Mi taller. Contraparte de `mobile/components/talleres/TallerProfileEditor.tsx` y
 * `mobile/components/workshop/TallerInfoCard.tsx`.
 *
 * - `hasAgenda`: el taller ya registro su horario principal (requisito para recibir citas en linea).
 * - `only24Hours`: un taller solo 24/7 se contacta directo, sin agenda.
 */
export default function TallerProfileEditor({ hasAgenda, only24Hours = false, onOpenAgenda, onSaved }) {
  const [draft, setDraft] = useState(() => toDraft(null));
  const [info, setInfo] = useState(() => toInfo(null));
  const [infoOptions, setInfoOptions] = useState({ equipamiento: [], garantia: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const applyInfo = (data) => {
    setInfo(toInfo(data));
    setInfoOptions({
      equipamiento: Array.isArray(data?.opcionesEquipamiento) ? data.opcionesEquipamiento : [],
      garantia: Array.isArray(data?.opcionesGarantia) ? data.opcionesGarantia : [],
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.all([fetchMiTaller({ signal: controller.signal }), getTallerInfo()])
      .then(([taller, infoData]) => {
        if (controller.signal.aborted) return;
        setDraft(toDraft(taller));
        applyInfo(infoData);
        setLoadError('');
      })
      .catch((error) => {
        if (error?.name === 'AbortError' || controller.signal.aborted) return;
        setLoadError(apiErrorMessage(error, 'No pudimos cargar el perfil de tu taller.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const update = (patch) => { setDraft((current) => ({ ...current, ...patch })); setSavedAt(null); };
  const updateInfo = (patch) => { setInfo((current) => ({ ...current, ...patch })); setSavedAt(null); };
  const toggleEquipment = (item) => updateInfo({
    equipamiento: info.equipamiento.includes(item)
      ? info.equipamiento.filter((value) => value !== item)
      : [...info.equipamiento, item].slice(0, MAX_EQUIPMENT),
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

  // «Sobre tu taller» es opcional, pero si se empieza hay que completarlo (el backend pide los tres datos juntos).
  const infoStarted = Boolean(info.descripcion.trim() || info.anios || info.garantia || info.equipamiento.length > 0);

  const validate = () => {
    if (draft.whatsapp.trim() && draft.whatsapp.replace(/\D/g, '').length !== 9) return 'El WhatsApp debe tener 9 dígitos.';
    if (!infoStarted) return '';
    const years = parseInt(info.anios, 10);
    if (!info.descripcion.trim()) return 'En «Sobre tu taller», cuéntales a los clientes quién eres en la descripción.';
    if (!Number.isFinite(years) || years > MAX_YEARS) return `En «Sobre tu taller», indica tus años de experiencia (entre 0 y ${MAX_YEARS}).`;
    if (!info.garantia) return 'En «Sobre tu taller», elige la garantía que das a tus trabajos.';
    return '';
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) { setSaveError(problem); return; }
    setSaving(true);
    setSaveError('');
    try {
      const saved = await updateMiTallerPerfil({
        photos: draft.photos,
        whatsapp: draft.whatsapp.trim() ? `56${draft.whatsapp.replace(/\D/g, '')}` : '',
        homeService: draft.homeService,
        hasOnlineBooking: draft.hasOnlineBooking && !only24Hours,
      });
      setDraft(toDraft(saved));
      if (infoStarted) {
        applyInfo(await saveTallerInfo({
          descripcion: info.descripcion.trim(),
          aniosExperiencia: parseInt(info.anios, 10),
          garantia: info.garantia,
          equipamiento: info.equipamiento,
        }));
      }
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
          <p>Fotos, atención y presentación que ven los clientes en tu card y en tu perfil.</p>
        </div>
      </header>

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

      {/* Sobre tu taller */}
      <div className="taller-editor__block">
        <h4>Sobre tu taller</h4>
        <p className="taller-editor__hint">Una presentación breve que ayuda al cliente a elegirte.</p>
        <textarea
          rows={4}
          maxLength={MAX_DESCRIPTION}
          value={info.descripcion}
          placeholder="Ej: Taller familiar con 15 años en Maipú. Especialistas en frenos y suspensión; entregamos presupuesto antes de cada trabajo."
          onChange={(event) => updateInfo({ descripcion: event.target.value })}
          aria-label="Descripción del taller"
        />
        <small className="taller-editor__counter">{info.descripcion.length}/{MAX_DESCRIPTION}</small>
        <div className="taller-editor__pair">
          <label className="taller-editor__field">
            <span>Años de experiencia</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={info.anios}
              placeholder="Ej: 10"
              onChange={(event) => updateInfo({ anios: event.target.value.replace(/\D/g, '').slice(0, 2) })}
            />
          </label>
          <label className="taller-editor__field">
            <span>Garantía de tus trabajos</span>
            <select value={info.garantia} onChange={(event) => updateInfo({ garantia: event.target.value })}>
              <option value="">Selecciona</option>
              {infoOptions.garantia.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        {infoOptions.equipamiento.length > 0 && (
          <>
            <span className="taller-editor__label">Equipamiento <small>Opcional</small></span>
            <div className="taller-editor__checks">
              {infoOptions.equipamiento.map((item) => (
                <label key={item} className={info.equipamiento.includes(item) ? 'is-on' : ''}>
                  <input type="checkbox" checked={info.equipamiento.includes(item)} onChange={() => toggleEquipment(item)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {saveError && <div className="ad-form-error" role="alert"><AlertTriangle size={15} /><span>{saveError}</span></div>}
      {savedAt && !saveError && <div className="taller-editor__ok" role="status"><CheckCircle2 size={15} /> Perfil guardado. Ya está visible para los clientes.</div>}

      <footer className="taller-editor__foot">
        <button type="button" className="taller-editor__save" onClick={handleSave} disabled={saving || uploading}>
          {saving ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />} Guardar perfil
        </button>
      </footer>
    </section>
  );
}
