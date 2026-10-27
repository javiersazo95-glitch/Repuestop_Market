import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Camera, Loader2, Trash2, X } from 'lucide-react';
import { createFault, uploadFaultPhoto } from '../../services/faultApi';
import { resolveMediaUrl } from '../../services/api';
import { isValidPlate, lookupVehicleByPlate, normalizePlate } from '../../utils/vehicleLookup';
import { searchVehicleByPatenteApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import '../../styles/faults.css';

const SYMPTOMS = [
  'Ruido extraño', 'Vibración', 'Humo', 'Luz de check engine', 'Pérdida de potencia', 'No parte',
  'Se sobrecalienta', 'Fuga de líquido', 'Frenos', 'Dirección', 'Batería / eléctrico', 'Olor extraño',
];
const MAX_PHOTOS = 4;
const MAX_SYMPTOMS = 8;

/** Registro de una falla automotriz: el vehiculo, lo que paso y donde esta. Los talleres acreditados la diagnostican. */
export default function CreateFaultModal({ isOpen, onClose, onCreated }) {
  const { user } = useAuth();
  const [plate, setPlate] = useState('');
  const [vehicle, setVehicle] = useState({ marca: '', modelo: '', anio: '', version: '', motor: '' });
  const [lookingPlate, setLookingPlate] = useState(false);
  const [mileage, setMileage] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [before, setBefore] = useState('');
  const [symptoms, setSymptoms] = useState([]);
  const [canMove, setCanMove] = useState(null);
  const [priority, setPriority] = useState('MEDIA');
  const [region, setRegion] = useState(user?.region || '');
  const [comuna, setComuna] = useState(user?.comuna || '');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lastPlate = useRef('');

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

  const addPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || photos.length >= MAX_PHOTOS) return;
    setUploading(true);
    setError('');
    try {
      const response = await uploadFaultPhoto(file);
      if (response?.url) setPhotos((current) => [...current, response.url]);
    } catch (err) {
      setError(err?.message || 'No pudimos subir la foto.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!isValidPlate(normalizePlate(plate))) return setError('Ingresa la patente de tu vehículo.');
    if (!vehicle.marca.trim() || !vehicle.modelo.trim()) return setError('Indica la marca y el modelo de tu vehículo.');
    if (!title.trim()) return setError('Resume la falla en una frase, por ejemplo "Ruido al frenar".');
    if (!description.trim()) return setError('Cuéntanos qué le pasó a tu vehículo.');
    if (!comuna.trim()) return setError('Indica tu comuna: los talleres cercanos son los más útiles.');
    const km = parseInt(String(mileage).replace(/\D/g, ''), 10);
    setSaving(true);
    try {
      const created = await createFault({
        patente: normalizePlate(plate),
        marca: vehicle.marca.trim(),
        modelo: vehicle.modelo.trim(),
        anio: vehicle.anio ? parseInt(vehicle.anio, 10) : null,
        version: vehicle.version.trim() || null,
        motor: vehicle.motor.trim() || null,
        kilometraje: Number.isFinite(km) ? km : null,
        titulo: title.trim(),
        descripcion: description.trim(),
        antesDelFallo: before.trim() || null,
        sintomas: symptoms,
        seMueve: canMove,
        prioridad: priority,
        region: region.trim() || null,
        comuna: comuna.trim(),
        fotos: photos,
      });
      onCreated?.(created);
    } catch (err) {
      setError(err?.message || 'No pudimos registrar la falla.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="ft-modal-backdrop ft-page" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form className="ft-modal ft-form" role="dialog" aria-modal="true" aria-label="Registrar falla" onSubmit={submit}>
        <div className="ft-modal-head">
          <h2>Registrar falla</h2>
          <button type="button" className="ft-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <p className="ft-sub">Cuéntanos qué le pasó a tu vehículo antes del fallo. Los talleres acreditados te enviarán su diagnóstico y tú decides con cuál agendar.</p>

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

        <label className="ft-field"><span>Resumen de la falla</span><input value={title} maxLength={160} placeholder="Ej: Ruido metálico al frenar" onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="ft-field"><span>Qué pasó</span><textarea rows={4} value={description} maxLength={2000} placeholder="Describe lo que notas y cuándo ocurre" onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="ft-field"><span>Qué pasaba antes del fallo <small>Opcional</small></span><textarea rows={3} value={before} maxLength={1000} placeholder="Mantenciones recientes, golpes, luces encendidas…" onChange={(e) => setBefore(e.target.value)} /></label>

        <div className="ft-field">
          <span>Síntomas ({symptoms.length}/{MAX_SYMPTOMS})</span>
          <div className="ft-chips">
            {SYMPTOMS.map((symptom) => (
              <button key={symptom} type="button" className={`ft-chip is-toggle ${symptoms.includes(symptom) ? 'is-on' : ''}`} aria-pressed={symptoms.includes(symptom)} onClick={() => toggleSymptom(symptom)}>{symptom}</button>
            ))}
          </div>
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
          <span>Fotos <small>Opcional, hasta {MAX_PHOTOS}</small></span>
          <div className="ft-photos">
            {photos.map((photo) => (
              <div key={photo} style={{ position: 'relative' }}>
                <img src={resolveMediaUrl(photo)} alt="Foto de la falla" />
                <button type="button" className="ft-icon-btn" style={{ position: 'absolute', top: 2, right: 2, background: '#fff', borderRadius: 6 }}
                  onClick={() => setPhotos((current) => current.filter((p) => p !== photo))} aria-label="Quitar foto"><Trash2 size={14} /></button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="ft-btn ft-btn-outline" style={{ cursor: 'pointer' }}>
                {uploading ? <Loader2 size={16} className="spin-icon" /> : <Camera size={16} />} Agregar foto
                <input type="file" accept="image/*" hidden disabled={uploading} onChange={addPhoto} />
              </label>
            )}
          </div>
        </div>

        {error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
        <div className="ft-actions">
          <button type="submit" className="ft-btn ft-btn-primary" disabled={saving}>{saving ? 'Registrando…' : 'Registrar falla'}</button>
          <button type="button" className="ft-btn ft-btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
