import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Car, Loader2, Plus, Trash2, X } from 'lucide-react';
import { normalizePlate } from '../utils/vehicleLookup';
import usePlateLookup, { maskPlate } from '../utils/usePlateLookup';
import { getComunasApi, getRegionesApi } from '../services/api';
import { createAuction, updateAuction, uploadAuctionPhoto } from '../services/auctionApi';
import { resolveMediaUrl } from '../services/api';
import { useCategories } from '../data/categories';
import { MAX_PRICE, MAX_QUANTITY, onlyDigits } from '../utils/inputLimits';
import '../styles/auction-app-mobile.css';

// Mismas opciones que la app y el formulario de escritorio.
const PLAZO_OPTIONS = ['Mismo día / Inmediato', '24 horas', '48 horas', '3 a 5 días hábiles', 'A convenir'];
const TIPO_ENVIO_OPTIONS = ['Despacho a domicilio', 'Retiro en tienda'];
const MAX_PHOTOS = 5;
const MAX_ITEMS = 20;
let itemSeq = 0;
const newItem = (otroVehiculo = false) => ({ key: `item-${++itemSeq}`, nombre: '', categoria: '', cantidad: '1', descripcion: '', otroVehiculo, patente: '' });


function Field({ label, children }) {
  return (
    <label className="am-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Un pedido ya publicado vuelve a ser el formulario: cada repuesto conserva su nombre, categoría, detalle y patente. */
function itemsFromAuction(auction) {
  const list = (auction?.items || []).map((item) => ({
    ...newItem(),
    nombre: item.repuesto || '',
    categoria: item.categoria || '',
    cantidad: String(item.cantidad || 1),
    descripcion: item.descripcion || '',
    otroVehiculo: Boolean(item.vehiculoPropio),
    patente: item.patente || '',
  }));
  if (list.length) return list;
  return [{ ...newItem(), nombre: auction?.repuestoSolicitado || '', categoria: auction?.categoria || '', cantidad: String(auction?.cantidad || 1), descripcion: auction?.descripcion || '' }];
}

/** Patente de un repuesto para otro vehículo: se identifica sola y avisa el resultado al formulario. */
function ItemVehicle({ itemKey, patente, onChange, onVehicle }) {
  const { vehicle, error, looking } = usePlateLookup(patente, { subject: 'este repuesto' });
  useEffect(() => { onVehicle(itemKey, vehicle); }, [itemKey, vehicle, onVehicle]);
  return (
    <div className="am-item-vehicle">
      <Field label="Patente del otro vehículo *">
        <span className="am-input-wrap">
          <input type="text" value={patente} onChange={(event) => onChange(event.target.value.toUpperCase())} placeholder="Ej: AB-CD-12" maxLength={12} autoComplete="off" />
          {looking && <Loader2 size={18} className="am-spin" />}
        </span>
      </Field>
      {error && <p className="am-error" role="alert">{error}</p>}
      {vehicle && <p className="am-vehicle-found">{[vehicle.marca, vehicle.modelo, vehicle.anio].filter(Boolean).join(' ')}{vehicle.version ? ` · ${vehicle.version}` : ''}</p>}
    </div>
  );
}

/**
 * Formulario para publicar una necesidad de compra en el celular: idéntico al de la app (tres tarjetas:
 * datos del vehículo con la patente que se autocompleta, qué repuesto se necesita con fotos, y plazos y
 * condiciones con listas desplegables) y un botón para volver. Solo crea; editar usa el formulario de escritorio.
 */
/** `template`: "Publicar de nuevo" una necesidad vencida o cancelada (precarga sus datos y publica una nueva). */
export default function AuctionCreateMobile({ onClose, onSuccess, auction = null, template = null, initialPatente = '' }) {
  const isEditing = Boolean(auction);
  const source = auction || template;
  const { HEADER_CATEGORIES } = useCategories();
  const [patente, setPatente] = useState(() => source?.patente || initialPatente);
  const { vehicle, error: plateError, looking } = usePlateLookup(patente);

  const [items, setItems] = useState(() => (source ? itemsFromAuction(source) : [newItem()]));
  const [itemVehicles, setItemVehicles] = useState({});
  const [askingNext, setAskingNext] = useState(false);
  const [fotos, setFotos] = useState(() => source?.fotos || []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const [presupuesto, setPresupuesto] = useState(() => (source?.presupuestoMaximo ? String(Math.round(source.presupuestoMaximo)) : ''));
  const [plazo, setPlazo] = useState(() => source?.tiempoMaximoEnvio || '24 horas');
  const [tipoEnvio, setTipoEnvio] = useState(() => (/retiro/i.test(source?.tipoEnvio || '') ? 'Retiro en tienda' : 'Despacho a domicilio'));
  const [regiones, setRegiones] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [comunaId, setComunaId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getRegionesApi('CL').then((list) => { if (active) setRegiones(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!regionId) { setComunas([]); return undefined; }
    let active = true;
    getComunasApi(regionId).then((list) => { if (active) setComunas(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, [regionId]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const changeItem = (key, patch) => setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const removeItem = (key) => setItems((current) => current.filter((item) => item.key !== key));
  const registerVehicle = useCallback((key, found) => setItemVehicles((current) => (current[key] === found ? current : { ...current, [key]: found })), []);
  const addItem = (otroVehiculo) => {
    setItems((current) => (current.length >= MAX_ITEMS ? current : [...current, newItem(otroVehiculo)]));
    setAskingNext(false);
  };
  const vehicleText = (found, plate) => {
    const name = [found?.marca, found?.modelo, found?.anio].filter(Boolean).join(' ');
    return [name, maskPlate(plate)].filter(Boolean).join(' · ');
  };
  const vehicleLabelFor = (item) => {
    if (item.otroVehiculo) {
      const text = vehicleText(itemVehicles[item.key], item.patente);
      return text ? `Para: ${text}` : 'Para otro vehículo · ingresa su patente';
    }
    const text = vehicleText(vehicle, patente);
    return text ? `Para: ${text}` : 'Para el vehículo del pedido · ingresa su patente arriba';
  };
  const totalUnits = items.reduce((sum, item) => sum + (parseInt(item.cantidad, 10) || 0), 0);

  const handlePhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (fotos.length + files.length > MAX_PHOTOS) { setError(`Puedes subir un máximo de ${MAX_PHOTOS} fotografías.`); return; }
    setUploading(true);
    setError('');
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) { setError('Cada fotografía no puede pesar más de 5 MB.'); continue; }
        const res = await uploadAuctionPhoto(file);
        if (res?.url) setFotos((current) => [...current, res.url]);
      }
    } catch {
      setError('No se pudo subir la fotografía. Inténtalo nuevamente.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!vehicle?.chasis) { setError('Ingresa la patente de tu vehículo: la usamos para obtener sus datos y su chasis.'); return; }
    const blank = items.findIndex((item) => !item.nombre.trim());
    if (blank >= 0) { setError(`Indica el nombre del repuesto ${blank + 1}.`); return; }
    const noCategory = items.findIndex((item) => !item.categoria);
    if (noCategory >= 0) { setError(`Selecciona la categoría del repuesto ${noCategory + 1}.`); return; }
    if (items.some((item) => item.otroVehiculo && !itemVehicles[item.key])) {
      setError('Hay repuestos para otro vehículo sin patente identificada. Ingresa su patente o cámbialo al mismo vehículo.');
      return;
    }
    const badQuantity = items.findIndex((item) => { const value = parseInt(item.cantidad, 10); return !(value >= 1 && value <= MAX_QUANTITY); });
    if (badQuantity >= 0) { setError(`La cantidad del repuesto ${badQuantity + 1} debe estar entre 1 y ${MAX_QUANTITY}.`); return; }
    if (presupuesto && parseInt(presupuesto, 10) > MAX_PRICE) { setError(`El presupuesto no puede superar $${MAX_PRICE.toLocaleString('es-CL')}.`); return; }
    setLoading(true);
    setError('');
    try {
      const payload = {
        patente: normalizePlate(patente),
        marca: vehicle.marca || undefined,
        modelo: vehicle.modelo || undefined,
        anio: vehicle.anio || undefined,
        version: vehicle.version || undefined,
        chasis: vehicle.chasis,
        repuestoSolicitado: items[0].nombre.trim(),
        categoria: items[0].categoria,
        cantidad: totalUnits || 1,
        items: items.map((item) => ({
          repuestoSolicitado: item.nombre.trim(),
          categoria: item.categoria,
          descripcion: item.descripcion.trim() || undefined,
          cantidad: parseInt(item.cantidad, 10) || 1,
          patente: item.otroVehiculo ? normalizePlate(item.patente) : undefined,
        })),
        tiempoVigenciaHoras: source?.tiempoVigenciaHoras || 48,
        tiempoMaximoEnvio: plazo,
        tipoEnvio,
        presupuestoMaximo: presupuesto ? parseFloat(presupuesto) : undefined,
        region: regiones.find((r) => String(r.id) === String(regionId))?.nombre || undefined,
        comuna: comunas.find((c) => String(c.id) === String(comunaId))?.nombre || undefined,
        fotos,
      };
      const created = isEditing ? await updateAuction(auction.id, payload) : await createAuction(payload);
      if (onSuccess) onSuccess(created);
      onClose();
    } catch (err) {
      setError(err?.message || (isEditing ? 'No pudimos guardar los cambios de tu pedido.' : 'No se pudo publicar la necesidad de compra.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="am-create" role="dialog" aria-modal="true" aria-label={isEditing ? 'Editar necesidad' : 'Publicar necesidad'}>
      <form className="am-page am-form" onSubmit={submit} noValidate>
        <button type="button" className="am-back" onClick={onClose}><ArrowLeft size={16} /> Volver</button>
        {(isEditing || template) && <h1 className="am-form-heading">{isEditing ? 'Editar necesidad de compra' : 'Publicar de nuevo tu necesidad'}</h1>}

        <section className="am-card">
          <h3 className="am-form-title">1. Datos del vehículo</h3>
          <Field label="Patente chilena *">
            <span className="am-input-wrap">
              <input
                type="text"
                value={patente}
                onChange={(event) => setPatente(event.target.value.toUpperCase())}
                placeholder="Ej: AB-CD-12"
                maxLength={12}
                autoCapitalize="characters"
                autoComplete="off"
              />
              {looking && <Loader2 size={18} className="am-spin" />}
            </span>
          </Field>
          {plateError && <p className="am-error" role="alert">{plateError}</p>}
          <div className="am-two">
            <Field label="Marca"><input type="text" value={vehicle?.marca || ''} placeholder="Toyota" readOnly /></Field>
            <Field label="Modelo"><input type="text" value={vehicle?.modelo || ''} placeholder="Yaris" readOnly /></Field>
          </div>
          <div className="am-two">
            <Field label="Año"><input type="text" value={vehicle?.anio || ''} placeholder="2018" readOnly /></Field>
            <Field label="Motor"><input type="text" value={vehicle?.motor || ''} placeholder="1.5L" readOnly /></Field>
          </div>
          <Field label="Versión"><input type="text" value={vehicle?.version || ''} placeholder="GLI" readOnly /></Field>
          <Field label="Chasis / VIN"><input type="text" value={vehicle?.chasis || ''} placeholder="Se completa con la patente" readOnly /></Field>
        </section>

        <section className="am-card">
          <h3 className="am-form-title">2. ¿Qué repuesto necesitas?</h3>
          {items.map((item, index) => (
            <div key={item.key} className="am-item-card">
              <div className="am-item-card-head">
                <strong>Repuesto {index + 1}</strong>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(item.key)} aria-label={`Quitar repuesto ${index + 1}`}><Trash2 size={16} /></button>
                )}
              </div>
              {/* Para qué vehículo es este repuesto: siempre visible, en una sola fila */}
              <p className="am-item-for" title={vehicleLabelFor(item)}><Car size={14} /><span>{vehicleLabelFor(item)}</span></p>
              <Field label="Repuesto solicitado *">
                <input type="text" value={item.nombre} onChange={(event) => changeItem(item.key, { nombre: event.target.value })} placeholder="Ej: Bomba de agua con empaquetadura" maxLength={180} />
              </Field>
              <div className="am-two">
                <Field label="Cantidad *">
                  <input type="text" inputMode="numeric" maxLength={3} value={item.cantidad} onChange={(event) => changeItem(item.key, { cantidad: onlyDigits(event.target.value, 3) })} />
                </Field>
                <Field label="Categoría *">
                  <select value={item.categoria} onChange={(event) => changeItem(item.key, { categoria: event.target.value })}>
                    <option value="">Selecciona</option>
                    {HEADER_CATEGORIES.map((cat) => <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Descripción de la falla / requerimiento">
                <textarea value={item.descripcion} onChange={(event) => changeItem(item.key, { descripcion: event.target.value })} rows={2} maxLength={1000} placeholder="Detalla qué problema presenta o especificaciones particulares..." />
              </Field>
              {item.otroVehiculo && (
                <ItemVehicle itemKey={item.key} patente={item.patente} onChange={(value) => changeItem(item.key, { patente: value })} onVehicle={registerVehicle} />
              )}
            </div>
          ))}

          {items.length < MAX_ITEMS && (askingNext ? (
            <div className="am-ask" role="group" aria-label="¿Es para el mismo vehículo?">
              <strong>¿Es para el mismo vehículo?</strong>
              <div className="am-ask-actions">
                <button type="button" className="am-btn am-btn-sm" onClick={() => addItem(false)}>Sí, el mismo</button>
                <button type="button" className="am-btn am-btn-sm am-btn-outline" onClick={() => addItem(true)}>No, otro vehículo</button>
              </div>
              <button type="button" className="am-link" onClick={() => setAskingNext(false)}>Cancelar</button>
            </div>
          ) : (
            <div className="am-ask">
              <strong>¿Deseas agregar otro repuesto?</strong>
              <button type="button" className="am-btn am-btn-sm am-btn-outline" onClick={() => setAskingNext(true)}><Plus size={16} /> Agregar otro repuesto</button>
            </div>
          ))}
          <span className="am-field-label">Fotografías de muestra (hasta {MAX_PHOTOS})</span>
          <div className="am-photo-row">
            {fotos.map((url, index) => (
              <div key={url} className="am-photo-thumb">
                <img src={resolveMediaUrl(url)} alt={`Fotografía ${index + 1}`} />
                <button type="button" onClick={() => setFotos((current) => current.filter((_, i) => i !== index))} aria-label="Quitar fotografía"><X size={14} /></button>
              </div>
            ))}
            {fotos.length < MAX_PHOTOS && (
              <button type="button" className="am-photo-add" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 size={22} className="am-spin" /> : <><Camera size={22} /><span>Subir</span></>}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handlePhotos} />
          </div>
        </section>

        <section className="am-card">
          <h3 className="am-form-title">3. Plazos y condiciones</h3>
          <Field label="Presupuesto sugerido (opcional)"><input type="text" inputMode="numeric" maxLength={9} value={presupuesto} onChange={(event) => setPresupuesto(onlyDigits(event.target.value, 9))} placeholder="Ej: 50000" /></Field>
          {totalUnits > 0 && <p className="am-muted">{items.length} {items.length === 1 ? 'repuesto' : 'repuestos'} · {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}</p>}
          <Field label="Plazo máximo de envío">
            <select value={plazo} onChange={(event) => setPlazo(event.target.value)}>
              {PLAZO_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="Tipo de envío">
            <select value={tipoEnvio} onChange={(event) => setTipoEnvio(event.target.value)}>
              {TIPO_ENVIO_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="Región">
            <select value={regionId} onChange={(event) => { setRegionId(event.target.value); setComunaId(''); }}>
              <option value="">Selecciona una región</option>
              {regiones.map((region) => <option key={region.id} value={region.id}>{region.nombre}</option>)}
            </select>
          </Field>
          <Field label="Comuna">
            <select value={comunaId} onChange={(event) => setComunaId(event.target.value)} disabled={!regionId}>
              <option value="">{regionId ? 'Selecciona una comuna' : 'Elige una región primero'}</option>
              {comunas.map((comuna) => <option key={comuna.id} value={comuna.id}>{comuna.nombre}</option>)}
            </select>
          </Field>
        </section>

        {error && <p className="am-error am-error-box" role="alert">{error}</p>}
        <button type="submit" className="am-btn" disabled={loading}>
          {loading ? <Loader2 size={18} className="am-spin" /> : null} {isEditing ? 'Guardar cambios' : 'Publicar necesidad de compra'}
        </button>
      </form>
    </div>
  );
}
