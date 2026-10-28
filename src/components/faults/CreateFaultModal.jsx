import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Camera, Loader2, Trash2, X } from 'lucide-react';
import { createFault, updateFault, uploadFaultPhoto } from '../../services/faultApi';
import { resolveMediaUrl } from '../../services/api';
import { isValidPlate, lookupVehicleByPlate, normalizePlate } from '../../utils/vehicleLookup';
import { searchVehicleByPatenteApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SERVICE_CATEGORIES } from '../../data/automotiveAdsData';
import '../../styles/faults.css';

const SYMPTOMS = [
  'Ruido extraño', 'Vibración', 'Humo', 'Luz de check engine', 'Pérdida de potencia', 'No parte',
  'Se sobrecalienta', 'Fuga de líquido', 'Frenos', 'Dirección', 'Batería / eléctrico', 'Olor extraño',
];
const OTHER_SYMPTOM = 'Otro';
const MAX_EVIDENCE_PHOTOS = 4;
const MAX_SYMPTOMS = 8;
const FAULT_CATEGORIES = SERVICE_CATEGORIES.filter((category) => category.id !== 'TODAS');

/** Registro de una falla automotriz: el vehiculo, lo que paso y donde esta. Los talleres acreditados la diagnostican. */
export default function CreateFaultModal({ isOpen, onClose, onCreated, onUpdated, fault = null }) {
  const { user, role } = useAuth();
  const isEditing = Boolean(fault?.id);
  const [plate, setPlate] = useState('');
  const [vehicle, setVehicle] = useState({ marca: '', modelo: '', anio: '', version: '', motor: '' });
  const [lookingPlate, setLookingPlate] = useState(false);
  const [mileage, setMileage] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [before, setBefore] = useState('');
  const [category, setCategory] = useState('');
  const [symptoms, setSymptoms] = useState([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [canMove, setCanMove] = useState(null);
  const [priority, setPriority] = useState('MEDIA');
  const [region, setRegion] = useState(user?.region || '');
  const [comuna, setComuna] = useState(user?.comuna || '');
  const [vehiclePhoto, setVehiclePhoto] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lastPlate = useRef('');

  useEffect(() => {
    if (!isOpen || !fault) return;
    const initialPlate = normalizePlate(fault.patente || '');
    lastPlate.current = initialPlate;
    setPlate(initialPlate);
    setVehicle({
      marca: fault.marca || '', modelo: fault.modelo || '', anio: fault.anio ? String(fault.anio) : '',
      version: fault.version || '', motor: fault.motor || '',
    });
    setMileage(fault.kilometraje != null ? String(fault.kilometraje) : '');
    setTitle(fault.titulo || '');
    setDescription(fault.descripcion || '');
    setBefore(fault.antesDelFallo || '');
    setCategory(fault.categoria || '');
    const savedSymptoms = Array.isArray(fault.sintomas) ? fault.sintomas : [];
    const knownSymptoms = savedSymptoms.filter((symptom) => SYMPTOMS.includes(symptom));
    const otherSymptoms = savedSymptoms.filter((symptom) => !SYMPTOMS.includes(symptom));
    setSymptoms([...knownSymptoms, ...(otherSymptoms.length ? [OTHER_SYMPTOM] : [])].slice(0, MAX_SYMPTOMS));
    setCustomSymptom(otherSymptoms.join(', '));
    setCanMove(fault.seMueve ?? null);
    setPriority(fault.prioridad || 'MEDIA');
    setRegion(fault.region || '');
    setComuna(fault.comuna || '');
    const existingPhotos = Array.isArray(fault.fotos) ? fault.fotos : [];
    const hasSeparateVehiclePhoto = Boolean(fault.fotoVehiculo || fault.fotoUrl);
    setVehiclePhoto(fault.fotoVehiculo || fault.fotoUrl || existingPhotos[0] || '');
    // Compatibilidad con registros antiguos, donde la primera foto de `fotos` era la portada.
    setPhotos((hasSeparateVehiclePhoto ? existingPhotos : existingPhotos.slice(1)).filter((photo, index, list) => list.indexOf(photo) === index));
    setError('');
  }, [fault, isOpen]);

  // Con una patente completa los datos del vehiculo se rellenan solos.
  useEffect(() => {
    const normalized = normalizePlate(plate);
    if (!isValidPlate(normalized)) { lastPlate.current = ''; return undefined; }
    if (normalized === lastPlate.current) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      lastPlate.current = normalized;
      setLookingPlate(true);
      try {
        const data = await lookupVehicleByPlate(normalized, { searchVehicleByPatenteApi });
        if (!active || !data) return;
        setVehicle({
          marca: data.marca || '', modelo: data.modelo || '', anio: data.anio ? String(data.anio) : '',
          version: data.version || '', motor: data.motor || '',
        });
      } catch {
        // Sin consulta disponible el vehiculo se completa a mano.
      } finally {
        if (active) setLookingPlate(false);
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [plate]);

  if (!isOpen) return null;

  const toggleSymptom = (symptom) => setSymptoms((current) => (
    current.includes(symptom) ? current.filter((s) => s !== symptom) : (current.length >= MAX_SYMPTOMS ? current : [...current, symptom])));

  const uploadPhoto = async (file) => {
    setUploading(true);
    setError('');
    try {
      const response = await uploadFaultPhoto(file);
      return response?.url || '';
    } catch (err) {
      setError(err?.message || 'No pudimos subir la foto.');
      return '';
    } finally {
      setUploading(false);
    }
  };

  const addVehiclePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const url = await uploadPhoto(file);
    if (url) setVehiclePhoto(url);
  };

  const addPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || photos.length >= MAX_EVIDENCE_PHOTOS) return;
    const url = await uploadPhoto(file);
    if (url) setPhotos((current) => [...current, url]);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!isEditing && role !== 'BUYER') return setError('Solo los perfiles Comprador pueden registrar fallas automotrices.');
    if (!isValidPlate(normalizePlate(plate))) return setError('Ingresa la patente de tu vehículo.');
    if (!vehicle.marca.trim() || !vehicle.modelo.trim()) return setError('Indica la marca y el modelo de tu vehículo.');
    if (!vehiclePhoto) return setError('Agrega una foto del vehículo; será la imagen principal del aviso.');
    if (!title.trim()) return setError('Resume la falla en una frase, por ejemplo "Ruido al frenar".');
    if (!description.trim()) return setError('Cuéntanos qué le pasó a tu vehículo.');
    if (symptoms.includes(OTHER_SYMPTOM) && !customSymptom.trim()) return setError('Escribe cuál es el otro síntoma.');
    if (photos.length === 0) return setError('Agrega al menos una foto de evidencia de la falla.');
    if (!comuna.trim()) return setError('Indica tu comuna: los talleres cercanos son los más útiles.');
    const km = parseInt(String(mileage).replace(/\D/g, ''), 10);
    setSaving(true);
    try {
      const payload = {
        patente: normalizePlate(plate),
        marca: vehicle.marca.trim(),
        modelo: vehicle.modelo.trim(),
        anio: vehicle.anio ? parseInt(vehicle.anio, 10) : null,
        version: vehicle.version.trim() || null,
        motor: vehicle.motor.trim() || null,
        kilometraje: Number.isFinite(km) ? km : null,
        titulo: title.trim(),
        categoria: category || null,
        descripcion: description.trim(),
        antesDelFallo: before.trim() || null,
        sintomas: symptoms.map((symptom) => symptom === OTHER_SYMPTOM ? customSymptom.trim() : symptom),
        seMueve: canMove,
        prioridad: priority,
        region: region.trim() || null,
        comuna: comuna.trim(),
        fotoVehiculo: vehiclePhoto,
        fotos: photos,
      };
      const saved = isEditing ? await updateFault(fault.id, payload) : await createFault(payload);
      if (isEditing) onUpdated?.(saved);
      else onCreated?.(saved);
    } catch (err) {
      setError(err?.message || (isEditing ? 'No pudimos guardar los cambios.' : 'No pudimos registrar la falla.'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="ft-modal-backdrop ft-page" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form className="ft-modal ft-form" role="dialog" aria-modal="true" aria-label={isEditing ? 'Editar falla' : 'Registrar falla'} onSubmit={submit}>
        <div className="ft-modal-head">
          <h2>{isEditing ? 'Editar falla' : 'Registrar falla'}</h2>
          <button type="button" className="ft-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <p className="ft-sub">{isEditing ? 'Actualiza la información de tu falla para que los talleres tengan los antecedentes correctos.' : 'Cuéntanos qué le pasó a tu vehículo antes del fallo. Los talleres acreditados te enviarán su diagnóstico y tú decides con cuál agendar.'}</p>

        <div className="ft-field">
          <span>Foto del vehículo <small>Una imagen · será la portada del aviso</small></span>
          <div className="ft-photos">
            {vehiclePhoto && (
              <div key={vehiclePhoto} style={{ position: 'relative' }}>
                <img src={resolveMediaUrl(vehiclePhoto)} alt="Vehículo: imagen principal del aviso" />
                <button type="button" className="ft-icon-btn" style={{ position: 'absolute', top: 2, right: 2, background: '#fff', borderRadius: 6 }}
                  onClick={() => setVehiclePhoto('')} aria-label="Quitar foto del vehículo"><Trash2 size={14} /></button>
              </div>
            )}
            {!vehiclePhoto && (
              <label className="ft-btn ft-btn-outline" style={{ cursor: 'pointer' }}>
                {uploading ? <Loader2 size={16} className="spin-icon" /> : <Camera size={16} />} Agregar foto del vehículo
                <input type="file" accept="image/*" hidden disabled={uploading} onChange={addVehiclePhoto} />
              </label>
            )}
            {vehiclePhoto && (
              <label className="ft-btn ft-btn-outline" style={{ cursor: 'pointer' }}>
                {uploading ? <Loader2 size={16} className="spin-icon" /> : <Camera size={16} />} Cambiar foto
                <input type="file" accept="image/*" hidden disabled={uploading} onChange={addVehiclePhoto} />
              </label>
            )}
          </div>
        </div>

        <label className="ft-field">
          <span>Patente</span>
          <input value={plate} maxLength={8} autoCapitalize="characters" placeholder="ABCD12"
            onChange={(e) => setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9-\s]/g, ''))} />
          <small>{lookingPlate ? 'Consultando patente…' : 'Completamos la marca, el modelo y el año por ti.'}</small>
        </label>
        <div className="ft-row">
          <label className="ft-field"><span>Marca</span><input value={vehicle.marca} maxLength={100} onChange={(e) => setVehicle({ ...vehicle, marca: e.target.value })} /></label>
          <label className="ft-field"><span>Modelo</span><input value={vehicle.modelo} maxLength={100} onChange={(e) => setVehicle({ ...vehicle, modelo: e.target.value })} /></label>
        </div>
        <div className="ft-row">
          <label className="ft-field"><span>Año</span><input inputMode="numeric" value={vehicle.anio} maxLength={4} onChange={(e) => setVehicle({ ...vehicle, anio: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="ft-field"><span>Kilometraje <small>Opcional</small></span><input inputMode="numeric" value={mileage} maxLength={7} onChange={(e) => setMileage(e.target.value.replace(/\D/g, ''))} /></label>
        </div>

        <label className="ft-field"><span>Título de la falla</span><input value={title} maxLength={160} placeholder="Ej: Ruido metálico al frenar" onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="ft-field"><span>Qué pasó</span><textarea rows={4} value={description} maxLength={2000} placeholder="Describe lo que notas y cuándo ocurre" onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="ft-field"><span>Qué pasaba antes del fallo <small>Opcional</small></span><textarea rows={3} value={before} maxLength={1000} placeholder="Mantenciones recientes, golpes, luces encendidas…" onChange={(e) => setBefore(e.target.value)} /></label>

        <div className="ft-field">
          <span>Posible categoría <small>Opcional</small></span>
          <small>Si no sabes cuál elegir, no pasa nada: puedes dejarla sin seleccionar. Los talleres te ayudarán a identificarla.</small>
          <div className="ft-category-options">
            {FAULT_CATEGORIES.map((option) => {
              const selected = category === option.id;
              return <button key={option.id} type="button" className={`ft-category-option ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={() => setCategory((current) => current === option.id ? '' : option.id)}>
                <span aria-hidden="true">{option.emoji}</span><span>{option.label}</span>
              </button>;
            })}
          </div>
        </div>

        <div className="ft-field">
          <span>Síntomas ({symptoms.length}/{MAX_SYMPTOMS})</span>
          <details className="ft-symptom-dropdown">
            <summary>{symptoms.length ? `${symptoms.length} síntoma${symptoms.length === 1 ? '' : 's'} seleccionado${symptoms.length === 1 ? '' : 's'}` : 'Selecciona los síntomas'}</summary>
            <div className="ft-symptom-options">
              {SYMPTOMS.map((symptom) => (
                <label key={symptom} className="ft-symptom-option">
                  <input type="checkbox" checked={symptoms.includes(symptom)} disabled={!symptoms.includes(symptom) && symptoms.length >= MAX_SYMPTOMS} onChange={() => toggleSymptom(symptom)} />
                  {symptom}
                </label>
              ))}
              <label className="ft-symptom-option">
                <input type="checkbox" checked={symptoms.includes(OTHER_SYMPTOM)} disabled={!symptoms.includes(OTHER_SYMPTOM) && symptoms.length >= MAX_SYMPTOMS} onChange={() => toggleSymptom(OTHER_SYMPTOM)} />
                {OTHER_SYMPTOM}
              </label>
              {symptoms.includes(OTHER_SYMPTOM) && (
                <input className="ft-other-symptom" value={customSymptom} maxLength={100} placeholder="Escribe el síntoma" onChange={(event) => setCustomSymptom(event.target.value)} />
              )}
            </div>
          </details>
        </div>
        <div className="ft-field">
          <span>¿El vehículo se puede mover?</span>
          <div className="ft-chips">
            <button type="button" className={`ft-chip is-toggle ${canMove === true ? 'is-on' : ''}`} aria-pressed={canMove === true} onClick={() => setCanMove(canMove === true ? null : true)}>Sí, se puede mover</button>
            <button type="button" className={`ft-chip is-toggle ${canMove === false ? 'is-on' : ''}`} aria-pressed={canMove === false} onClick={() => setCanMove(canMove === false ? null : false)}>No, necesita grúa</button>
          </div>
        </div>
        <div className="ft-field">
          <span>Prioridad</span>
          <div className="ft-chips">
            {[['BAJA', 'Baja'], ['MEDIA', 'Media'], ['ALTA', 'Alta']].map(([value, label]) => (
              <button key={value} type="button" className={`ft-chip is-toggle ${priority === value ? 'is-on' : ''}`} aria-pressed={priority === value} onClick={() => setPriority(value)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="ft-row">
          <label className="ft-field"><span>Región</span><input value={region} maxLength={100} onChange={(e) => setRegion(e.target.value)} /></label>
          <label className="ft-field"><span>Comuna</span><input value={comuna} maxLength={100} onChange={(e) => setComuna(e.target.value)} /></label>
        </div>

        <div className="ft-field">
          <span>Evidencia de la falla <small>Agrega hasta {MAX_EVIDENCE_PHOTOS} fotos del tablero, motor o pieza afectada</small></span>
          <div className="ft-photos">
            {photos.map((photo) => (
              <div key={photo} style={{ position: 'relative' }}>
                <img src={resolveMediaUrl(photo)} alt="Foto de la falla" />
                <button type="button" className="ft-icon-btn" style={{ position: 'absolute', top: 2, right: 2, background: '#fff', borderRadius: 6 }}
                  onClick={() => setPhotos((current) => current.filter((p) => p !== photo))} aria-label="Quitar foto"><Trash2 size={14} /></button>
              </div>
            ))}
            {photos.length < MAX_EVIDENCE_PHOTOS && (
              <label className="ft-btn ft-btn-outline" style={{ cursor: 'pointer' }}>
                {uploading ? <Loader2 size={16} className="spin-icon" /> : <Camera size={16} />} Agregar foto
                <input type="file" accept="image/*" hidden disabled={uploading} onChange={addPhoto} />
              </label>
            )}
          </div>
        </div>

        {error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
        <div className="ft-actions">
          <button type="submit" className="ft-btn ft-btn-primary" disabled={saving}>{saving ? (isEditing ? 'Guardando…' : 'Registrando…') : (isEditing ? 'Guardar cambios' : 'Registrar falla')}</button>
          <button type="button" className="ft-btn ft-btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
