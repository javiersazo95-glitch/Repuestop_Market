import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Camera, Loader2, Trash2, X } from 'lucide-react';
import AddressAutocompleteInput from '../AddressAutocompleteInput';
import { createFault, getFaultCategories, updateFault, uploadFaultPhoto } from '../../services/faultApi';
import { resolveMediaUrl } from '../../services/api';
import { isValidPlate, lookupVehicleByPlate, normalizePlate } from '../../utils/vehicleLookup';
import { getComunasApi, getRegionesApi, searchVehicleByPatenteApi } from '../../services/api';
import { normalizarNombreGeografico } from '../../services/geoLookup';
import { useAuth } from '../../context/AuthContext';
import { SERVICE_CATEGORIES } from '../../data/talleresData';
import { MAX_MILEAGE, MIN_VEHICLE_YEAR, maxVehicleYear } from '../../utils/inputLimits';
import '../../styles/faults.css';

const SYMPTOMS = [
  'Ruido extraño', 'Vibración', 'Humo', 'Luz de check engine', 'Pérdida de potencia', 'No parte',
  'Se sobrecalienta', 'Fuga de líquido', 'Frenos', 'Dirección', 'Batería / eléctrico', 'Olor extraño',
];
const OTHER_SYMPTOM = 'Otro';
const MAX_EVIDENCE_PHOTOS = 4;
const MAX_SYMPTOMS = 8;
// Cada sintoma tiene tope de 60 caracteres en el backend (`sintomas` de FallaAutomotrizDTOs.CrearRequest).
const MAX_SYMPTOM_LENGTH = 60;
const FAULT_CATEGORIES = SERVICE_CATEGORIES.filter((category) => category.id !== 'TODAS');

// "Metropolitana" calza con "Region Metropolitana de Santiago": los nombres guardados (perfil, fallas antiguas o la
// direccion elegida) no siempre traen el prefijo ni las tildes del catalogo de `/geografia`.
const sameRegion = (a, b) => {
  const left = normalizarNombreGeografico(a);
  const right = normalizarNombreGeografico(b);
  return Boolean(left && right) && (left === right || left.includes(right) || right.includes(left));
};
const sameComuna = (a, b) => Boolean(a && b) && normalizarNombreGeografico(a) === normalizarNombreGeografico(b);

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
  const [subcategory, setSubcategory] = useState('');
  const [categoryCatalog, setCategoryCatalog] = useState(FAULT_CATEGORIES);
  const [symptoms, setSymptoms] = useState([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [canMove, setCanMove] = useState(null);
  const [priority, setPriority] = useState('MEDIA');
  // Region y comuna se eligen del catalogo (`/geografia`) y viajan como nombre, igual que antes: el filtro "Mi comuna"
  // del mural compara nombres y con texto libre ("Nunoa", "nuñoa") no calzaban.
  const [region, setRegion] = useState(user?.region || '');
  const [comuna, setComuna] = useState(user?.comuna || '');
  const [regions, setRegions] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [communes, setCommunes] = useState([]);
  // Recogida: null = sin responder (obligatorio), true/false = elegido. Con coordenadas el mapa del taller ubica al cliente.
  const [needsPickup, setNeedsPickup] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
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
    setSubcategory(fault.subcategoria || '');
    const savedSymptoms = Array.isArray(fault.sintomas) ? fault.sintomas : [];
    const knownSymptoms = savedSymptoms.filter((symptom) => SYMPTOMS.includes(symptom));
    const otherSymptoms = savedSymptoms.filter((symptom) => !SYMPTOMS.includes(symptom));
    setSymptoms([...knownSymptoms, ...(otherSymptoms.length ? [OTHER_SYMPTOM] : [])].slice(0, MAX_SYMPTOMS));
    setCustomSymptom(otherSymptoms.join(', '));
    setCanMove(fault.seMueve ?? null);
    setPriority(fault.prioridad || 'MEDIA');
    setRegion(fault.region || '');
    setComuna(fault.comuna || '');
    setNeedsPickup(Boolean(fault.requiereRecogida));
    setPickupAddress(fault.direccionRecogida || '');
    setPickupCoords(fault.latitud != null && fault.longitud != null ? { latitud: fault.latitud, longitud: fault.longitud } : null);
    const existingPhotos = Array.isArray(fault.fotos) ? fault.fotos : [];
    const hasSeparateVehiclePhoto = Boolean(fault.fotoVehiculo || fault.fotoUrl);
    setVehiclePhoto(fault.fotoVehiculo || fault.fotoUrl || existingPhotos[0] || '');
    // Compatibilidad con registros antiguos, donde la primera foto de `fotos` era la portada.
    setPhotos((hasSeparateVehiclePhoto ? existingPhotos : existingPhotos.slice(1)).filter((photo, index, list) => list.indexOf(photo) === index));
    setError('');
  }, [fault, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    getFaultCategories().then((items) => {
      if (!active || !Array.isArray(items)) return;
      setCategoryCatalog(items.map((item) => ({
        id: item.id,
        label: item.nombre,
        subcategories: item.subcategorias || item.incluye || [],
      })));
    }).catch(() => {});
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    getRegionesApi('CL').then((list) => { if (active) setRegions(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, [isOpen]);

  // El nombre de la region (perfil, falla editada o direccion de recogida) elige su opcion del catalogo.
  useEffect(() => {
    if (!regions.length || !region) return;
    const match = regions.find((item) => sameRegion(item.nombre, region));
    if (match && String(match.id) !== String(regionId)) {
      setRegionId(String(match.id));
      setRegion(match.nombre);
    }
  }, [regions, region, regionId]);

  useEffect(() => {
    if (!regionId) { setCommunes([]); return undefined; }
    let active = true;
    getComunasApi(regionId).then((list) => {
      if (!active) return;
      const items = Array.isArray(list) ? list : [];
      setCommunes(items);
      // La comuna guardada queda escrita como en el catalogo, para que los filtros la reconozcan.
      setComuna((current) => items.find((item) => sameComuna(item.nombre, current))?.nombre || current);
    }).catch(() => {});
    return () => { active = false; };
  }, [regionId]);

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
    if (!comuna.trim()) return setError('Elige tu región y tu comuna: los talleres cercanos son los más útiles.');
    if (needsPickup === null) return setError('Indica si necesitas que el taller recoja tu vehículo.');
    if (needsPickup && !pickupAddress.trim()) return setError('Indica la dirección donde el taller debe recoger tu vehículo.');
    const year = vehicle.anio ? parseInt(vehicle.anio, 10) : null;
    if (year != null && (year < MIN_VEHICLE_YEAR || year > maxVehicleYear())) return setError(`Indica un año entre ${MIN_VEHICLE_YEAR} y ${maxVehicleYear()}.`);
    const km = parseInt(String(mileage).replace(/\D/g, ''), 10);
    if (Number.isFinite(km) && km > MAX_MILEAGE) return setError(`El kilometraje no puede superar ${MAX_MILEAGE.toLocaleString('es-CL')} km.`);
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
        subcategoria: subcategory || null,
        descripcion: description.trim(),
        antesDelFallo: before.trim() || null,
        sintomas: symptoms.map((symptom) => symptom === OTHER_SYMPTOM ? customSymptom.trim() : symptom),
        seMueve: canMove,
        prioridad: priority,
        region: region.trim() || null,
        comuna: comuna.trim(),
        fotoVehiculo: vehiclePhoto,
        fotos: photos,
        requiereRecogida: needsPickup === true,
        direccionRecogida: needsPickup ? pickupAddress.trim() : null,
        latitud: needsPickup && pickupCoords ? pickupCoords.latitud : null,
        longitud: needsPickup && pickupCoords ? pickupCoords.longitud : null,
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
            {categoryCatalog.map((option) => {
              const selected = category === option.id;
              return <button key={option.id} type="button" className={`ft-category-option ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={() => { setCategory((current) => current === option.id ? '' : option.id); setSubcategory(''); }}>
                <span>{option.label}</span>
              </button>;
            })}
          </div>
          {category && (
            <label className="ft-field ft-subcategory-field">
              <span>Servicio relacionado <small>Opcional</small></span>
              <select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>
                <option value="">No sé cuál es</option>
                {(categoryCatalog.find((option) => option.id === category)?.subcategories || []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <small>Elige el trabajo que probablemente necesitas; el taller confirmará el diagnóstico.</small>
            </label>
          )}
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
                <input className="ft-other-symptom" value={customSymptom} maxLength={MAX_SYMPTOM_LENGTH} placeholder="Escribe el síntoma" onChange={(event) => setCustomSymptom(event.target.value)} />
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
          <label className="ft-field"><span>Región</span>
            <select value={regionId} onChange={(e) => {
              const picked = regions.find((item) => String(item.id) === e.target.value);
              setRegionId(e.target.value); setRegion(picked?.nombre || ''); setComuna('');
            }}>
              <option value="">{regions.length ? 'Selecciona una región' : 'Cargando regiones…'}</option>
              {regions.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <label className="ft-field"><span>Comuna</span>
            <select value={comuna} disabled={!regionId} onChange={(e) => setComuna(e.target.value)}>
              <option value="">{regionId ? 'Selecciona una comuna' : 'Elige una región primero'}</option>
              {/* Una falla antigua con una comuna escrita a mano que no esta en el catalogo la conserva. */}
              {comuna && communes.length > 0 && !communes.some((item) => item.nombre === comuna) && <option value={comuna}>{comuna}</option>}
              {communes.map((item) => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}
            </select>
          </label>
        </div>

        <div className="ft-field">
          <span>¿Necesitas que el taller recoja tu vehículo?</span>
          <div className="ft-chips">
            <button type="button" className={`ft-chip is-toggle ${needsPickup === true ? 'is-on' : ''}`} aria-pressed={needsPickup === true} onClick={() => setNeedsPickup(true)}>Sí, que vengan por él</button>
            <button type="button" className={`ft-chip is-toggle ${needsPickup === false ? 'is-on' : ''}`} aria-pressed={needsPickup === false} onClick={() => setNeedsPickup(false)}>No, lo llevo yo</button>
          </div>
          {needsPickup && (
            <>
              <span>Dirección de recogida</span>
              <AddressAutocompleteInput
                locatable
                requireComuna={false}
                value={pickupAddress}
                maxLength={300}
                comuna={comuna}
                region={region}
                placeholder="Calle y número donde debe pasar el taller"
                onChange={(value) => { setPickupAddress(value); setPickupCoords(null); }}
                onSelectLocation={({ comuna: pickedComuna, region: pickedRegion, latitud, longitud }) => {
                  if (latitud != null && longitud != null) setPickupCoords({ latitud, longitud });
                  if (pickedComuna && !comuna.trim()) setComuna(pickedComuna);
                  if (pickedRegion && !region.trim()) setRegion(pickedRegion);
                }}
              />
              <small>{pickupCoords ? 'Ubicación marcada: los talleres verán a qué distancia estás.' : 'Elige una sugerencia o usa el ícono de ubicación para marcar el punto exacto. Solo la ven los talleres.'}</small>
            </>
          )}
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
