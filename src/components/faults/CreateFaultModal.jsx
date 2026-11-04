import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Camera, CheckCircle2, CircleHelp, Loader2, MapPin, Trash2, X } from 'lucide-react';
import AddressAutocompleteInput from '../AddressAutocompleteInput';
import { createFault, getFaultCategories, updateFault, uploadFaultPhoto } from '../../services/faultApi';
import { getAddressesApi, resolveMediaUrl } from '../../services/api';
import { addRecentPlate, getRecentPlates, isValidPlate, lookupVehicleByPlate, normalizePlate } from '../../utils/vehicleLookup';
import { getComunasApi, getRegionesApi, getVehicleBrandsApi, getVehicleModelsApi, getVehicleVersionsApi, searchVehicleByPatenteApi } from '../../services/api';
import { normalizarNombreGeografico } from '../../services/geoLookup';
import { useAuth } from '../../context/AuthContext';
import { SERVICE_CATEGORIES } from '../../data/talleresData';
import { MAX_MILEAGE, MIN_VEHICLE_YEAR, maxVehicleYear } from '../../utils/inputLimits';
import CharCount from './CharCount';
import { PlateBenefitHint, RecommendedBadge } from '../PlateRecommended';
import { maskPlate } from '../../utils/usePlateLookup';
import { ANIOS_DISPONIBLES } from '../../data/sampleVehicles';
import { useCombustibles } from '../../data/vehicleOptions';
import '../../styles/faults.css';

const TITLE_MAX = 160;
const DESCRIPTION_MAX = 2000;
const BEFORE_MAX = 1000;
/**
 * Formulario corto (2-nov): solo lo imprescindible (vehículo, qué pasa con una foto, si se mueve y dónde está). El resto de los campos
 * sigue en el código, apagado, con valores por defecto, para ir sumándolos de a poco. Al editar se conservan los valores ya guardados.
 */
const SHOW_ADVANCED_FIELDS = false;
const nameOf = (item) => item?.nombre || item?.name || '';

/** Seccion numerada del formulario: titulo y una linea que explica que se pide ahi. */
function FormSection({ number, title, hint, children }) {
  return (
    <section className="ft-section" aria-labelledby={`ft-section-${number}`}>
      <header className="ft-section-head">
        <span className="ft-section-num" aria-hidden="true">{number}</span>
        <div>
          <h3 id={`ft-section-${number}`}>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

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
  // El vehiculo va primero: por patente (se identifica sola) o a mano con el catalogo, como en la busqueda de repuestos.
  // `resolved` es el vehiculo ya definido ({ patente, marca, modelo, anio, version, motor }); sin el no se muestra el resto.
  const [mode, setMode] = useState('plate');
  const [plate, setPlate] = useState('');
  const [plateStatus, setPlateStatus] = useState('idle');
  const [resolved, setResolved] = useState(null);
  // Busqueda manual: los mismos campos y orden que la del buscador del home (patente opcional, marca, modelo, año,
  // version, combustible y chasis opcional).
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [versions, setVersions] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualVersion, setManualVersion] = useState('');
  const [manualFuel, setManualFuel] = useState('');
  const [manualChassis, setManualChassis] = useState('');
  const [manualPlate, setManualPlate] = useState('');
  const [manualError, setManualError] = useState('');
  const fuels = useCombustibles();
  const [mileage, setMileage] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [before, setBefore] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [categoryCatalog, setCategoryCatalog] = useState(FAULT_CATEGORIES);
  const [symptoms, setSymptoms] = useState([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [canMove, setCanMove] = useState(true);
  const [priority, setPriority] = useState('MEDIA');
  // Region y comuna se eligen del catalogo (`/geografia`) y viajan como nombre, igual que antes: el filtro "Mi comuna"
  // del mural compara nombres y con texto libre ("Nunoa", "nuñoa") no calzaban.
  const [region, setRegion] = useState(user?.region || '');
  const [comuna, setComuna] = useState(user?.comuna || '');
  const [regions, setRegions] = useState([]);
  const [regionId, setRegionId] = useState('');
  // A qué talleres avisar (1-nov): así una falla de Temuco no le llega a un taller de Arica.
  const [scope, setScope] = useState('REGION');
  const [extraRegions, setExtraRegions] = useState([]);
  const [communes, setCommunes] = useState([]);
  // Recogida: null = sin responder (obligatorio), true/false = elegido. Con coordenadas el mapa del taller ubica al cliente.
  const [needsPickup, setNeedsPickup] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [vehiclePhoto, setVehiclePhoto] = useState('');
  const [photos, setPhotos] = useState([]);
  const [editLocation, setEditLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lastPlate = useRef('');
  // Últimas patentes consultadas en este navegador: se ofrecen como atajo para no volver a escribirlas.
  const [recentPlates, setRecentPlates] = useState([]);
  // Kilometraje de la última revisión técnica de la patente: se propone en el campo y sirve de mínimo (el odómetro no baja).
  const [techReview, setTechReview] = useState(null);
  useEffect(() => { if (isOpen) setRecentPlates(getRecentPlates()); }, [isOpen]);
  // Un solo grupo de fotos para el usuario: la primera hace de portada (con el formulario corto no hay una foto aparte del vehículo).
  const evidencePhotos = photos;
  const totalPhotos = photos.length + (vehiclePhoto ? 1 : 0);
  const removePhoto = (photo) => {
    setPhotos((current) => current.filter((item) => item !== photo));
  };
  // Recogida: solo se pregunta si el vehículo no se puede mover (o si la falla que se edita ya la tenía).
  const showPickup = SHOW_ADVANCED_FIELDS || canMove === false || (isEditing && needsPickup === true);
  // Al pedir que recojan el vehículo se propone la dirección principal de la libreta (una vez, y solo si el campo sigue vacío).
  const pickupPrefilled = useRef(false);
  const buyerId = user?.userId ?? user?.id;
  useEffect(() => {
    if (!isOpen) pickupPrefilled.current = false;
    if (!isOpen || !showPickup || !needsPickup || pickupPrefilled.current || !buyerId) return undefined;
    pickupPrefilled.current = true;
    let active = true;
    getAddressesApi(buyerId)
      .then((list) => {
        const saved = (Array.isArray(list) ? list : []).find((item) => item.esPrincipal) || list?.[0];
        const text = [saved?.calleYNumero, saved?.comunaNombre].filter(Boolean).join(', ');
        if (active && text) setPickupAddress((current) => (current.trim() ? current : text));
      })
      .catch(() => {});
    return () => { active = false; };
    // Solo reacciona a la elección: lo que se escriba después no debe cancelar la carga en curso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, showPickup, needsPickup, buyerId]);

  useEffect(() => {
    if (!isOpen || !fault) return;
    const initialPlate = normalizePlate(fault.patente || '');
    lastPlate.current = initialPlate;
    setPlate(initialPlate);
    setMode(initialPlate ? 'plate' : 'manual');
    setResolved({
      patente: initialPlate, marca: fault.marca || '', modelo: fault.modelo || '', anio: fault.anio ? String(fault.anio) : '',
      version: fault.version || '', motor: fault.motor || '', combustible: fault.combustible || '', chasis: fault.chasis || '',
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
    if (fault.alcance) setScope(fault.alcance);
    setExtraRegions((fault.regionesAviso || []).filter((name) => !sameRegion(name, fault.region)));
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

  // Con una patente completa se identifica el vehiculo y pasa a la tarjeta; si no se encuentra, se ofrece ingresarlo a mano.
  useEffect(() => {
    if (resolved) return undefined;
    const normalized = normalizePlate(plate);
    if (!isValidPlate(normalized)) { lastPlate.current = ''; setPlateStatus('idle'); return undefined; }
    if (normalized === lastPlate.current) return undefined;
    let active = true;
    setPlateStatus('loading');
    const timer = setTimeout(async () => {
      lastPlate.current = normalized;
      try {
        const data = await lookupVehicleByPlate(normalized, { searchVehicleByPatenteApi });
        if (!active) return;
        if (!data || !data.marca || !data.modelo) { setPlateStatus('notfound'); return; }
        setPlateStatus('found');
        addRecentPlate(normalized);
        if (data.kilometraje > 0) {
          setTechReview({ km: data.kilometraje, fecha: data.fechaRevisionTecnica });
          setMileage((current) => (parseInt(current, 10) >= data.kilometraje ? current : String(data.kilometraje)));
        } else setTechReview(null);
        setResolved({
          patente: normalized, marca: data.marca, modelo: data.modelo, anio: data.anio ? String(data.anio) : '',
          version: data.version || '', motor: data.motor || '',
        });
      } catch {
        if (active) setPlateStatus('notfound');
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [plate, resolved]);

  // Catalogo de marcas y modelos para la busqueda manual (se carga solo si se usa).
  useEffect(() => {
    if (!isOpen || mode !== 'manual' || resolved || brands.length) return undefined;
    let active = true;
    getVehicleBrandsApi().then((list) => { if (active) setBrands(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, [isOpen, mode, resolved, brands.length]);

  useEffect(() => {
    setModels([]);
    if (!brandId) return undefined;
    let active = true;
    getVehicleModelsApi(brandId).then((list) => { if (active) setModels(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, [brandId]);

  const brandName = nameOf(brands.find((item) => String(item.id) === brandId));
  const modelName = nameOf(models.find((item) => String(item.id || item.nombre) === modelId));

  // La version depende del modelo y del año, igual que en el buscador del home.
  useEffect(() => {
    setVersions([]);
    if (!brandName || !modelName || !manualYear) return undefined;
    let active = true;
    getVehicleVersionsApi({ marca: brandName, modelo: modelName, anioDesde: manualYear, anioHasta: manualYear })
      .then((list) => { if (active) setVersions(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, [brandName, modelName, manualYear]);

  if (!isOpen) return null;

  const useManualVehicle = () => {
    if (!brandName) return setManualError('Por favor selecciona la marca del vehículo.');
    if (!modelName) return setManualError('Por favor selecciona el modelo del vehículo.');
    if (!manualYear) return setManualError('Por favor selecciona el año del vehículo.');
    const manualPlateNormalized = normalizePlate(manualPlate);
    if (manualPlateNormalized && !isValidPlate(manualPlateNormalized)) return setManualError('Patente no válida. Formato: ABCD12 o BB-CL-12');
    setManualError('');
    return setResolved({
      patente: manualPlateNormalized, marca: brandName, modelo: modelName, anio: manualYear, version: manualVersion, motor: '',
      combustible: manualFuel, chasis: manualChassis.trim(),
    });
  };

  const changeVehicle = () => {
    setTechReview(null);
    setResolved(null);
    setPlate('');
    setPlateStatus('idle');
    lastPlate.current = '';
  };

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
    if (!file || evidencePhotos.length >= MAX_EVIDENCE_PHOTOS) return;
    const url = await uploadPhoto(file);
    if (url) setPhotos((current) => [...current, url]);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!isEditing && role !== 'BUYER') return setError('Solo los perfiles Comprador pueden registrar fallas automotrices.');
    if (!resolved?.marca || !resolved?.modelo) return setError('Indica tu vehículo con la patente o a mano.');
    const vehicle = resolved;
    if (SHOW_ADVANCED_FIELDS && !vehiclePhoto) return setError('Agrega una foto del vehículo; será la imagen principal del aviso.');
    if (!title.trim()) return setError('Resume la falla en una frase, por ejemplo "Ruido al frenar".');
    if (!description.trim()) return setError('Cuéntanos qué le pasó a tu vehículo.');
    if (symptoms.includes(OTHER_SYMPTOM) && !customSymptom.trim()) return setError('Escribe cuál es el otro síntoma.');
    if (totalPhotos === 0) return setError('Agrega una foto de la falla: ayuda mucho al diagnóstico.');
    if (!comuna.trim()) return setError('Elige tu región y tu comuna: los talleres cercanos son los más útiles.');
    if (scope === 'REGIONES' && extraRegions.length === 0) return setError('Elige al menos otra región, además de la del vehículo, o avisa solo a tu región.');
    if (showPickup && needsPickup === null) return setError('Indica si necesitas que el taller recoja tu vehículo.');
    if (showPickup && needsPickup && !pickupAddress.trim()) return setError('Indica la dirección donde el taller debe recoger tu vehículo.');
    // Foto de portada y fotos extra, prioridad y recogida cuando el formulario corto no las pregunta.
    const cover = vehiclePhoto || photos[0];
    const extras = vehiclePhoto ? photos : photos.slice(1);
    const autoPriority = SHOW_ADVANCED_FIELDS || isEditing ? priority : (canMove === false ? 'ALTA' : 'MEDIA');
    const year = vehicle.anio ? parseInt(vehicle.anio, 10) : null;
    if (year != null && (year < MIN_VEHICLE_YEAR || year > maxVehicleYear())) return setError(`Indica un año entre ${MIN_VEHICLE_YEAR} y ${maxVehicleYear()}.`);
    const km = parseInt(String(mileage).replace(/\D/g, ''), 10);
    if (techReview && Number.isFinite(km) && km < techReview.km) return setError(`El kilometraje no puede ser menor al de la última revisión técnica (${techReview.km.toLocaleString('es-CL')} km).`);
    if (Number.isFinite(km) && km > MAX_MILEAGE) return setError(`El kilometraje no puede superar ${MAX_MILEAGE.toLocaleString('es-CL')} km.`);
    setSaving(true);
    try {
      const payload = {
        patente: vehicle.patente || null,
        marca: vehicle.marca.trim(),
        modelo: vehicle.modelo.trim(),
        anio: vehicle.anio ? parseInt(vehicle.anio, 10) : null,
        version: vehicle.version?.trim() || null,
        motor: vehicle.motor?.trim() || null,
        combustible: vehicle.combustible?.trim() || null,
        chasis: vehicle.chasis?.trim() || null,
        kilometraje: Number.isFinite(km) ? km : null,
        titulo: title.trim(),
        categoria: category || null,
        subcategoria: subcategory || null,
        descripcion: description.trim(),
        antesDelFallo: before.trim() || null,
        sintomas: symptoms.map((symptom) => symptom === OTHER_SYMPTOM ? customSymptom.trim() : symptom),
        seMueve: canMove,
        prioridad: autoPriority,
        region: region.trim() || null,
        comuna: comuna.trim(),
        fotoVehiculo: cover,
        fotos: extras,
        requiereRecogida: showPickup && needsPickup === true,
        direccionRecogida: showPickup && needsPickup ? pickupAddress.trim() : null,
        latitud: showPickup && needsPickup && pickupCoords ? pickupCoords.latitud : null,
        longitud: showPickup && needsPickup && pickupCoords ? pickupCoords.longitud : null,
        alcance: scope,
        regionesAviso: scope === 'REGIONES' ? extraRegions : null,
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
        <p className="ft-sub">{isEditing ? 'Actualiza la información de tu falla para que los talleres tengan los antecedentes correctos.' : 'Cuéntanos qué le pasa a tu vehículo. Los talleres acreditados te enviarán su diagnóstico y tú decides con cuál agendar.'}</p>

        <FormSection number={1} title="Tu vehículo" hint={resolved ? 'Verifica que los datos de tu vehículo estén correctos.' : 'Indícalo con la patente o ingrésalo a mano.'}>
        {resolved ? (
          <div className="ft-vehicle-card">
            <div className="ft-vehicle-head">
              <span><CheckCircle2 size={16} /> {resolved.patente ? 'Vehículo identificado' : 'Vehículo ingresado a mano'}</span>
              <button type="button" className="ft-link" onClick={changeVehicle}>{resolved.patente ? 'Cambiar patente' : 'Cambiar vehículo'}</button>
            </div>
            <dl>
              {[['Patente', maskPlate(resolved.patente)], ['Marca', resolved.marca], ['Modelo', resolved.modelo], ['Año', resolved.anio], ...(SHOW_ADVANCED_FIELDS ? [['Versión', resolved.version], ['Combustible', resolved.combustible], ['Chasis', resolved.chasis]] : [])]
                .filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          </div>
        ) : (
          <div className="ft-vehicle-step">
            <div className="ft-field">
              <div className="ft-tabs" role="tablist" aria-label="Cómo indicar el vehículo">
                <button type="button" role="tab" aria-selected={mode === 'plate'} className={`ft-tab ${mode === 'plate' ? 'is-active' : ''}`} onClick={() => setMode('plate')}>Por patente<RecommendedBadge /></button>
                <button type="button" role="tab" aria-selected={mode === 'manual'} className={`ft-tab ${mode === 'manual' ? 'is-active' : ''}`} onClick={() => setMode('manual')}>Búsqueda manual</button>
              </div>
            </div>
            {mode === 'plate' && <PlateBenefitHint />}
            {mode === 'plate' ? (
              <label className="ft-field">
                <span>Patente</span>
                <input value={plate} maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABCD12" autoFocus
                  onChange={(e) => setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9-\s]/g, ''))} />
                {recentPlates.length > 0 && !isValidPlate(normalizePlate(plate)) && (
                  <div className="ft-recent-plates" aria-label="Tus últimas patentes">
                    <small>Tus últimas patentes:</small>
                    {recentPlates.map((recent) => (
                      <button key={recent} type="button" className="ft-chip is-toggle" onClick={() => setPlate(recent)}>{maskPlate(recent)}</button>
                    ))}
                  </div>
                )}
                {plateStatus === 'loading' && <small><Loader2 size={12} className="spin-icon" /> Consultando patente…</small>}
                {plateStatus === 'notfound' && <small>No pudimos identificar esta patente. Revísala o <button type="button" className="ft-link" onClick={() => setMode('manual')}>ingresa los datos a mano</button>.</small>}
                {(plateStatus === 'idle') && <small>¿No la tienes a mano? <button type="button" className="ft-link" onClick={() => setMode('manual')}>Ingresa el vehículo a mano</button>.</small>}
              </label>
            ) : (
              <div className="hero-manual-form">
                <div className="hero-manual-grid">
                  {SHOW_ADVANCED_FIELDS && (
                  <div className="hero-manual-field">
                    <div className="field-label-with-tooltip">
                      <label>Patente (opcional)</label>
                      <span className="field-tooltip-trigger" tabIndex={0} aria-label="Información sobre patente opcional">
                        <CircleHelp size={13} />
                        <span className="field-tooltip-box">Si la ingresas, los talleres la usan para identificar tu vehículo. Nunca se muestra a otros usuarios.</span>
                      </span>
                    </div>
                    <div className="plate-input-with-counter">
                      <input type="text" className="hero-manual-input" placeholder="Ej: ABCD-12" value={manualPlate} maxLength={8}
                        onChange={(e) => setManualPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9-\s]/g, ''))} />
                      <span className="plate-char-counter">{manualPlate.length}/8</span>
                    </div>
                  </div>
                  )}
                  <div className="hero-manual-field">
                    <label>Marca</label>
                    <select className="hero-manual-select" value={brandId}
                      onChange={(e) => { setBrandId(e.target.value); setModelId(''); setManualVersion(''); }}>
                      <option value="">{brands.length ? 'Seleccionar' : 'Cargando...'}</option>
                      {brands.map((item) => <option key={item.id} value={item.id}>{nameOf(item)}</option>)}
                    </select>
                  </div>
                  <div className="hero-manual-field">
                    <label>Modelo</label>
                    <select className="hero-manual-select" value={modelId} disabled={!brandId}
                      onChange={(e) => { setModelId(e.target.value); setManualVersion(''); }}>
                      <option value="">Seleccionar</option>
                      {models.map((item, index) => <option key={item.id || `${item.nombre}-${index}`} value={item.id || item.nombre}>{nameOf(item)}</option>)}
                    </select>
                  </div>
                  <div className="hero-manual-field">
                    <label>Año</label>
                    <select className="hero-manual-select" value={manualYear} disabled={!modelId} onChange={(e) => { setManualYear(e.target.value); setManualVersion(''); }}>
                      <option value="">Seleccionar</option>
                      {ANIOS_DISPONIBLES.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                  {SHOW_ADVANCED_FIELDS && (<>
                  <div className="hero-manual-field">
                    <label>Versión</label>
                    <select className="hero-manual-select" value={manualVersion} disabled={!modelName || !manualYear} onChange={(e) => setManualVersion(e.target.value)}>
                      <option value="">Seleccionar</option>
                      {versions.map((item, index) => <option key={item.id || index} value={nameOf(item)}>{nameOf(item)}</option>)}
                    </select>
                  </div>
                  <div className="hero-manual-field">
                    <label>Combustible</label>
                    <select className="hero-manual-select" value={manualFuel} onChange={(e) => setManualFuel(e.target.value)}>
                      <option value="">Seleccionar</option>
                      {fuels.map((fuel) => <option key={fuel} value={fuel}>{fuel}</option>)}
                    </select>
                  </div>
                  <div className="hero-manual-field full-width">
                    <div className="field-label-with-tooltip">
                      <label>Nro Chasis (opcional)</label>
                      <span className="field-tooltip-trigger" tabIndex={0} aria-label="Información sobre número de chasis">
                        <CircleHelp size={13} />
                        <span className="field-tooltip-box">Con este dato los talleres pueden validar con mayor precisión la compatibilidad exacta de tu vehículo.</span>
                      </span>
                    </div>
                    <input type="text" className="hero-manual-input" placeholder="Ej: Número de chasis (VIN)" value={manualChassis} maxLength={30}
                      onChange={(e) => setManualChassis(e.target.value.toUpperCase())} />
                    <span className="field-help-text">Permite a los talleres confirmar la compatibilidad técnica exacta del vehículo.</span>
                  </div>
                  </>)}
                </div>
                {manualError && <p className="ft-error" role="alert"><AlertCircle size={15} /> {manualError}</p>}
                <button type="button" className="btn-hero-manual-submit" disabled={!brandName || !modelName || !manualYear} onClick={useManualVehicle}>
                  <CheckCircle2 size={18} /><span>Usar este vehículo</span>
                </button>
              </div>
            )}
          </div>
        )}

        {resolved && (<>
        <label className="ft-field"><span>Kilometraje <small>Opcional</small></span><input inputMode="numeric" value={mileage} maxLength={7} placeholder="Ej: 85000" onChange={(e) => setMileage(e.target.value.replace(/\D/g, ''))} /><small>{techReview ? `Última revisión técnica${techReview.fecha ? ` (${techReview.fecha.slice(0, 7)})` : ''}: ${techReview.km.toLocaleString('es-CL')} km. Actualízalo si conoces el actual.` : ''}</small></label>

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
        </>)}
        </FormSection>

        {resolved && (<>
        <FormSection number={2} title="Qué le pasa" hint="Cuéntalo con tus palabras y suma una foto: así el diagnóstico es más preciso.">
        <label className="ft-field"><span>Título de la falla</span><input value={title} maxLength={TITLE_MAX} placeholder="Ej: Ruido metálico al frenar" onChange={(e) => setTitle(e.target.value)} /><CharCount value={title} max={TITLE_MAX} /></label>
        <label className="ft-field"><span>Qué pasó</span><textarea rows={4} value={description} maxLength={DESCRIPTION_MAX} placeholder="Describe lo que notas y cuándo ocurre" onChange={(e) => setDescription(e.target.value)} /><CharCount value={description} max={DESCRIPTION_MAX} /></label>
        {SHOW_ADVANCED_FIELDS && (
        <label className="ft-field"><span>Qué pasaba antes del fallo <small>Opcional</small></span><textarea rows={3} value={before} maxLength={BEFORE_MAX} placeholder="Mantenciones recientes, golpes, luces encendidas…" onChange={(e) => setBefore(e.target.value)} /><CharCount value={before} max={BEFORE_MAX} /></label>
        )}
        <div className="ft-field">
          <span>Foto de la falla <small>{vehiclePhoto ? 'Opcional' : 'Obligatoria'} · {evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS}</small></span>
          <div className="ft-photos">
            {evidencePhotos.map((photo) => (
              <div key={photo} style={{ position: 'relative' }}>
                <img src={resolveMediaUrl(photo)} alt="Foto de la falla" />
                <button type="button" className="ft-icon-btn" style={{ position: 'absolute', top: 2, right: 2, background: '#fff', borderRadius: 6 }}
                  onClick={() => removePhoto(photo)} aria-label="Quitar foto"><Trash2 size={14} /></button>
              </div>
            ))}
            {evidencePhotos.length < MAX_EVIDENCE_PHOTOS && (
              <label className="ft-btn ft-btn-outline" style={{ cursor: 'pointer' }}>
                {uploading ? <Loader2 size={16} className="spin-icon" /> : <Camera size={16} />} {evidencePhotos.length === 0 ? 'Agregar foto' : 'Agregar otra foto'}
                <input type="file" accept="image/*" hidden disabled={uploading} onChange={addPhoto} />
              </label>
            )}
          </div>
        </div>
        </FormSection>

        {SHOW_ADVANCED_FIELDS && (
        <FormSection number={3} title="Clasifica la falla" hint="Opcional: ayuda a que lleguen los talleres indicados.">
        <div className="ft-field">
          <span>Posible categoría <small>Opcional</small></span>
          <small>Si no sabes cuál elegir, no pasa nada: puedes dejarla sin seleccionar. Los talleres te ayudarán a identificarla.</small>
          <div className="ft-chips">
            {categoryCatalog.map((option) => {
              const selected = category === option.id;
              return <button key={option.id} type="button" className={`ft-chip is-toggle is-pick ${selected ? 'is-on' : ''}`} aria-pressed={selected} onClick={() => { setCategory((current) => current === option.id ? '' : option.id); setSubcategory(''); }}>
                {option.label}
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
          <span>Síntomas <small>Opcional · {symptoms.length}/{MAX_SYMPTOMS} elegidos</small></span>
          <div className="ft-chips">
            {[...SYMPTOMS, OTHER_SYMPTOM].map((symptom) => {
              const selected = symptoms.includes(symptom);
              return <button key={symptom} type="button" className={`ft-chip is-toggle is-pick ${selected ? 'is-on' : ''}`} aria-pressed={selected}
                disabled={!selected && symptoms.length >= MAX_SYMPTOMS} onClick={() => toggleSymptom(symptom)}>{symptom}</button>;
            })}
          </div>
          {symptoms.includes(OTHER_SYMPTOM) && (
            <>
              <input value={customSymptom} maxLength={MAX_SYMPTOM_LENGTH} placeholder="Escribe el síntoma" onChange={(event) => setCustomSymptom(event.target.value)} />
              <CharCount value={customSymptom} max={MAX_SYMPTOM_LENGTH} />
            </>
          )}
        </div>
        </FormSection>
        )}

        <FormSection number={3} title="Estado y ubicación" hint="Así el taller sabe si necesita grúa y qué talleres cercanos te sirven.">
        <div className="ft-field">
          <span>¿El vehículo se puede mover?</span>
          <div className="ft-chips">
            <button type="button" className={`ft-chip is-toggle ${canMove === true ? 'is-on' : ''}`} aria-pressed={canMove === true} onClick={() => setCanMove(canMove === true ? null : true)}>Sí, se puede mover</button>
            <button type="button" className={`ft-chip is-toggle ${canMove === false ? 'is-on' : ''}`} aria-pressed={canMove === false} onClick={() => setCanMove(canMove === false ? null : false)}>No, necesita grúa</button>
          </div>
        </div>
        {showPickup && (
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
        )}
        {SHOW_ADVANCED_FIELDS && (
        <div className="ft-field">
          <span>Prioridad</span>
          <div className="ft-chips">
            {[['BAJA', 'Baja'], ['MEDIA', 'Media'], ['ALTA', 'Alta']].map(([value, label]) => (
              <button key={value} type="button" className={`ft-chip is-toggle ${priority === value ? 'is-on' : ''}`} aria-pressed={priority === value} onClick={() => setPriority(value)}>{label}</button>
            ))}
          </div>
        </div>
        )}
        {!editLocation && comuna.trim() ? (
          <div className="ft-location-line">
            <MapPin size={15} aria-hidden="true" />
            <span>Tu vehículo está en <strong>{comuna}{region ? `, ${region}` : ''}</strong></span>
            <button type="button" className="ft-link" onClick={() => setEditLocation(true)}>Cambiar</button>
          </div>
        ) : (<>
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
        {!isEditing && sameComuna(user?.comuna, comuna) && (
          <small className="ft-hint">Tomamos tu región y comuna de tu perfil. Cámbialas si el vehículo está en otro lugar.</small>
        )}
        </>)}
        <div className="ft-field">
          <span>¿En qué regiones llevarías tu vehículo a reparar?</span>
          <small className="ft-hint">Solo los talleres de las regiones que elijas verán tu falla y recibirán el aviso. Así no le llega a un taller que te queda lejos.</small>
          <div className="ft-chips">
            {[['COMUNA', comuna ? `Solo ${comuna}` : 'Solo mi comuna'], ['REGION', 'Toda mi región'], ['REGIONES', 'Varias regiones']].map(([value, label]) => (
              <button key={value} type="button" className={`ft-chip is-toggle is-pick ${scope === value ? 'is-on' : ''}`} aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>
            ))}
          </div>
          {scope === 'REGIONES' && (
            <>
              <small className="ft-hint">{region ? `${region} va siempre. Suma las regiones cercanas que quieras:` : 'Primero elige la región del vehículo. Luego suma las regiones cercanas:'}</small>
              <div className="ft-chips">
                {regions.filter((item) => !sameRegion(item.nombre, region)).map((item) => {
                  const on = extraRegions.some((name) => sameRegion(name, item.nombre));
                  return (
                    <button key={item.id} type="button" className={`ft-chip is-toggle is-pick ${on ? 'is-on' : ''}`} aria-pressed={on}
                      onClick={() => setExtraRegions((current) => (on ? current.filter((name) => !sameRegion(name, item.nombre)) : [...current, item.nombre]))}>
                      {item.nombre}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        </FormSection>
        </>)}

        {error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
        <div className="ft-actions">
          {resolved && <button type="submit" className="ft-btn ft-btn-primary" disabled={saving}>{saving ? (isEditing ? 'Guardando…' : 'Registrando…') : (isEditing ? 'Guardar cambios' : 'Registrar falla')}</button>}
          <button type="button" className="ft-btn ft-btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
