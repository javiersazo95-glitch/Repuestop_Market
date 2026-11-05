import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Upload, Trash2, AlertCircle, CheckCircle2, Plus, Package, Car,
} from 'lucide-react';
import { normalizePlate } from '../utils/vehicleLookup';
import usePlateLookup, { maskPlate } from '../utils/usePlateLookup';
import { shippingClass } from '../utils/auctionOfferFit';
import { createAddressApi, getAddressesApi, resolveMediaUrl } from '../services/api';
import { resolverUbicacionPorNombre } from '../services/geoLookup';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import AuctionCreateMobile from './AuctionCreateMobile';
import AuctionManualVehicle from './AuctionManualVehicle';
import { PlateBenefitHint, RecommendedBadge } from './PlateRecommended';
import { useIsMobile } from '../hooks/useIsMobile';
import { createAuction, updateAuction, uploadAuctionPhoto } from '../services/auctionApi';
import { useAuth } from '../context/AuthContext';
import '../styles/auctions.css';
import '../styles/faults.css';
import { MAX_PRICE, MAX_QUANTITY, onlyDigits } from '../utils/inputLimits';
import '../styles/auction-vehicle.css';

const MAX_ITEMS = 20;
let itemSeq = 0;
const NEW_ADDRESS = '__new__';
const newItem = (otroVehiculo = false) => ({ key: `item-${++itemSeq}`, nombre: '', cantidad: 1, descripcion: '', otroVehiculo, patente: '' });

/** Sección numerada, igual a la del formulario de registrar falla. */
function FormSection({ number, title, hint, children }) {
  return (
    <section className="ft-section" aria-labelledby={`ac-section-${number}`}>
      <header className="ft-section-head">
        <span className="ft-section-num" aria-hidden="true">{number}</span>
        <div>
          <h3 id={`ac-section-${number}`}>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Tarjeta del vehículo identificado por patente (marca, modelo, año y chasis). */
function VehicleSummary({ vehicle, note }) {
  return (
    <div className="ft-vehicle-card">
      <div className="ft-vehicle-head"><span><CheckCircle2 size={16} /> Vehículo identificado</span></div>
      <dl>
        {[['Marca', vehicle.marca], ['Modelo', vehicle.modelo], ['Año', vehicle.anio || ''], ['Versión', vehicle.version], ['Chasis / VIN', vehicle.chasis]]
          .filter(([, value]) => value).map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
      </dl>
      {note && <small className="ft-hint">{note}</small>}
    </div>
  );
}

/** Un repuesto del encargo: nombre, cantidad, detalle y, si va para otro auto, su propia patente. */
function ItemEditor({ item, index, canRemove, forLabel, onChange, onRemove, onVehicle }) {
  const { vehicle, error, looking } = usePlateLookup(item.otroVehiculo ? item.patente : '', { subject: 'el encargo' });

  useEffect(() => { onVehicle(item.key, vehicle); }, [vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <fieldset className="acv-item">
      <legend><Package size={15} /> Repuesto {index + 1}</legend>
      {canRemove && (
        <button type="button" className="acv-item-remove" onClick={() => onRemove(item.key)} aria-label={`Quitar el repuesto ${index + 1}`}>
          <Trash2 size={14} /> Quitar
        </button>
      )}

      <div className="acv-item-grid">
        <label className="ft-field acv-field-wide">
          <span>Repuesto *</span>
          <input
            type="text"
            value={item.nombre}
            maxLength={180}
            onChange={(e) => onChange(item.key, { nombre: e.target.value })}
            placeholder="Ej: Bomba de agua con empaquetadura"
            required
          />
        </label>
        <label className="ft-field">
          <span>Cantidad *</span>
          <input type="text" inputMode="numeric" maxLength={3} value={item.cantidad} onChange={(e) => onChange(item.key, { cantidad: onlyDigits(e.target.value, 3) })} required />
        </label>
        <label className="ft-field acv-field-wide">
          <span>Detalle o falla <small>Opcional</small></span>
          <textarea
            rows={2}
            value={item.descripcion}
            maxLength={1000}
            onChange={(e) => onChange(item.key, { descripcion: e.target.value })}
            placeholder="Lado (izq/der), síntoma, medidas, referencia…"
          />
        </label>
      </div>

      <p className="acv-item-for"><Car size={14} aria-hidden="true" /> {forLabel}</p>

      {item.otroVehiculo && (
        <div className="acv-item-vehicle">
          {vehicle ? (
            <>
              <div className="acv-plate is-confirmed">
                <span className="acv-plate-label">Patente</span>
                <strong className="acv-plate-value">{maskPlate(item.patente)}</strong>
                <button type="button" className="acv-plate-change" onClick={() => onChange(item.key, { patente: '' })}>Cambiar patente</button>
              </div>
              <VehicleSummary vehicle={vehicle} />
            </>
          ) : (
            <div className="acv-plate">
              <label className="acv-plate-label" htmlFor={`plate-${item.key}`}>Patente de ese vehículo *</label>
              <input
                id={`plate-${item.key}`}
                type="text"
                value={item.patente}
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => onChange(item.key, { patente: e.target.value.toUpperCase().replace(/[^A-Z0-9-\s]/g, '') })}
                placeholder="ABCD12"
                className="acv-plate-input is-compact"
              />
              <small className="acv-plate-hint">{looking ? 'Consultando patente…' : 'Obtenemos su marca, modelo, año y chasis.'}</small>
            </div>
          )}
          {error && <p className="acv-error" role="alert"><AlertCircle size={15} /> {error}</p>}
        </div>
      )}
    </fieldset>
  );
}

/** Alta mínima de una dirección: un solo campo con sugerencias; la comuna y la región salen de la sugerencia elegida. */
function QuickAddressForm({ userId, onCreated }) {
  const [text, setText] = useState('');
  const [place, setPlace] = useState(null);   // { comunaId, comunaNombre, regionNombre } de la sugerencia elegida
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pickSuggestion = async ({ comuna, region }) => {
    const resolved = await resolverUbicacionPorNombre({ comuna, region });
    setPlace(resolved.comunaId ? { comunaId: resolved.comunaId, comunaNombre: comuna, regionNombre: region || '' } : null);
  };

  const save = async () => {
    if (!text.trim() || !place) {
      setError('Escribe la dirección y elige una de las sugerencias para ubicar la comuna.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createAddressApi(userId, {
        comunaId: Number(place.comunaId),
        comunaNombre: place.comunaNombre || '',
        regionNombre: place.regionNombre || '',
        calleYNumero: text.trim(),
        tipoDireccion: 'PERSONAL',
      });
      setText('');
      setPlace(null);
      await onCreated();
    } catch (err) {
      setError(err?.message || 'No pudimos guardar la dirección.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acv-quick-address">
      <AddressAutocompleteInput
        value={text}
        onChange={(value) => { setText(value); setPlace(null); }}
        onSelectLocation={pickSuggestion}
        requireComuna={false}
        placeholder="Calle y número, comuna (Ej: Av. Italia 1234, Ñuñoa)"
      />
      <button type="button" className="ft-btn ft-btn-primary" onClick={save} disabled={saving || !text.trim()}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {place && <small className="acv-address-note">Comuna: <strong>{[place.comunaNombre, place.regionNombre].filter(Boolean).join(', ')}</strong></small>}
      {error && <small className="acv-address-error">{error}</small>}
    </div>
  );
}

/** Un encargo ya publicado vuelve a ser el formulario: cada repuesto conserva su nombre, categoría, mensaje y patente. */
function itemsFromAuction(auction) {
  const list = (auction?.items || []).map((item) => ({
    ...newItem(),
    nombre: item.repuesto || '',
    cantidad: item.cantidad || 1,
    descripcion: item.descripcion || '',
    otroVehiculo: Boolean(item.vehiculoPropio),
    patente: item.patente || '',
  }));
  return list.length ? list : [newItem()];
}

/**
 * `auction`: editar esa búsqueda. `template`: "Publicar de nuevo" una búsqueda vencida o cancelada; el formulario
 * parte con sus datos (vehiculo, repuestos, fotos, entrega) pero publica una búsqueda nueva.
 */
function CreateAuctionModalContent({ onClose, onSuccess, auction = null, template = null, initialPatente = '' }) {
  const isEditing = Boolean(auction);
  const source = auction || template;
  const { user } = useAuth();

  const userId = user?.userId ?? user?.id;
  // La búsqueda se publica con la ubicación de una dirección registrada: la del comprador o la que cree aquí mismo.
  const [addresses, setAddresses] = useState([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [addressChoice, setAddressChoice] = useState('');   // id elegido, o NEW_ADDRESS para crear una
  const knownAddressIds = useRef(new Set());
  const loadAddresses = useCallback(async () => {
    if (!userId) { setAddressesLoaded(true); return; }
    try {
      const data = await getAddressesApi(userId);
      const list = Array.isArray(data) ? data : [];
      const created = list.find((address) => !knownAddressIds.current.has(String(address.id)));
      const firstLoad = knownAddressIds.current.size === 0;
      knownAddressIds.current = new Set(list.map((address) => String(address.id)));
      setAddresses(list);
      setAddressChoice((current) => {
        if (!firstLoad && created) return String(created.id);              // recién creada en este formulario
        if (current && current !== NEW_ADDRESS && list.some((address) => String(address.id) === current)) return current;
        const main = list.find((address) => address.esPrincipal) || list[0];
        return main ? String(main.id) : NEW_ADDRESS;
      });
    } catch {
      setAddresses([]);
      setAddressChoice(NEW_ADDRESS);
    } finally {
      setAddressesLoaded(true);
    }
  }, [userId]);
  useEffect(() => { loadAddresses(); }, [loadAddresses]);
  const mainAddress = useMemo(() => addresses.find((address) => String(address.id) === addressChoice) || null, [addresses, addressChoice]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [patente, setPatente] = useState(() => source?.patente || initialPatente);
  const { vehicle: plateVehicle, error: plateError, looking: lookingUpPlate } = usePlateLookup(patente);
  // Sin patente a mano: marca, modelo y año del catálogo (búsqueda manual, como en repuestos y fallas).
  const [vehicleMode, setVehicleMode] = useState(() => (source && !source.patente && source.marca ? 'manual' : 'plate'));
  const [manualVehicle, setManualVehicle] = useState(() => (source && !source.patente && source.marca
    ? { marca: source.marca, modelo: source.modelo, anio: source.anio || undefined, version: source.version || undefined, motor: source.motor || undefined, chasis: source.chasis || undefined } : null));
  const vehicle = manualVehicle || plateVehicle;

  const [items, setItems] = useState(() => (source ? itemsFromAuction(source) : [newItem()]));
  const [itemVehicles, setItemVehicles] = useState({});

  const [tiempoVigenciaHoras, setTiempoVigenciaHoras] = useState(() => source?.tiempoVigenciaHoras || 48);
  const [tiempoMaximoEnvio, setTiempoMaximoEnvio] = useState(() => source?.tiempoMaximoEnvio || '24 horas');
  const [tipoEnvio, setTipoEnvio] = useState(() => (source?.tipoEnvio && shippingClass(source.tipoEnvio) === 'pickup' ? 'Retiro en tienda' : 'Despacho a domicilio'));
  const [presupuestoMaximo, setPresupuestoMaximo] = useState(() => (source?.presupuestoMaximo ? String(Math.round(source.presupuestoMaximo)) : ''));

  const [fotos, setFotos] = useState(() => source?.fotos || []);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const changeItem = (key, patch) => setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const removeItem = (key) => setItems((current) => current.filter((item) => item.key !== key));
  const registerVehicle = (key, found) => setItemVehicles((current) => (current[key] === found ? current : { ...current, [key]: found }));
  const [askingNext, setAskingNext] = useState(false);
  const addItem = (otroVehiculo) => {
    setItems((current) => (current.length >= MAX_ITEMS ? current : [...current, newItem(otroVehiculo)]));
    setAskingNext(false);
  };

  const totalUnits = useMemo(() => items.reduce((sum, item) => sum + (parseInt(item.cantidad, 10) || 0), 0), [items]);
  const vehicleName = (found, plate) => [[found?.marca, found?.modelo, found?.anio].filter(Boolean).join(' '), plate ? maskPlate(plate) : ''].filter(Boolean).join(' · ');
  const forLabelFor = (item) => {
    if (item.otroVehiculo) {
      const text = vehicleName(itemVehicles[item.key], item.patente);
      return text ? `Para: ${text}` : 'Para otro vehículo · ingresa su patente';
    }
    const text = vehicleName(vehicle, manualVehicle ? '' : patente);
    return text ? `Para: ${text}` : 'Para el vehículo ingresado';
  };
  const itemsMissingVehicle = items.filter((item) => item.otroVehiculo && !itemVehicles[item.key]);

  // Al editar, "Guardar cambios" solo se activa si algo cambió respecto a lo que se abrió (se toma la foto una vez cargada la dirección).
  const formSignature = JSON.stringify([
    manualVehicle ? null : normalizePlate(patente), manualVehicle,
    items.map((item) => [item.nombre, String(item.cantidad), item.descripcion, item.otroVehiculo, item.otroVehiculo ? item.patente : '']),
    tiempoVigenciaHoras, tiempoMaximoEnvio, tipoEnvio, presupuestoMaximo, fotos, addressChoice,
  ]);
  const baselineSignature = useRef(null);
  if (isEditing && addressesLoaded && baselineSignature.current === null) baselineSignature.current = formSignature;
  const hasChanges = !isEditing || (baselineSignature.current !== null && baselineSignature.current !== formSignature);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (fotos.length + files.length > 5) {
      setError('Puedes subir un máximo de 5 fotografías.');
      return;
    }
    setUploadingFoto(true);
    setError(null);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          setError('Cada fotografía no puede pesar más de 5 MB.');
          continue;
        }
        const res = await uploadAuctionPhoto(file);
        if (res && res.url) setFotos((prev) => [...prev, res.url]);
      }
    } catch (err) {
      setError('Error al subir una o más imágenes. Inténtalo de nuevo.');
    } finally {
      setUploadingFoto(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mainAddress) {
      setError('Registra una dirección para publicar tu encargo: la usamos para ubicarlo y para que las tiendas sepan si despachan a tu comuna.');
      return;
    }
    if (!manualVehicle && !vehicle?.chasis) {
      setError('Ingresa la patente de tu vehículo o usa la búsqueda manual.');
      return;
    }
    const blank = items.findIndex((item) => !item.nombre.trim());
    if (blank >= 0) {
      setError(`Indica el nombre del repuesto ${blank + 1}.`);
      return;
    }
    if (itemsMissingVehicle.length > 0) {
      setError('Hay repuestos para otro vehículo sin patente identificada. Ingresa su patente o desmarca la opción.');
      return;
    }
    const badQuantity = items.findIndex((item) => { const value = parseInt(item.cantidad, 10); return !(value >= 1 && value <= MAX_QUANTITY); });
    if (badQuantity >= 0) {
      setError(`La cantidad del repuesto ${badQuantity + 1} debe estar entre 1 y ${MAX_QUANTITY}.`);
      return;
    }
    if (presupuestoMaximo && parseInt(presupuestoMaximo, 10) > MAX_PRICE) {
      setError(`El presupuesto no puede superar $${MAX_PRICE.toLocaleString('es-CL')}.`);
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      patente: manualVehicle ? undefined : normalizePlate(patente),
      marca: vehicle.marca || undefined,
      modelo: vehicle.modelo || undefined,
      anio: vehicle.anio || undefined,
      version: vehicle.version || undefined,
      motor: manualVehicle ? manualVehicle.motor || undefined : undefined,
      chasis: vehicle.chasis || undefined,
      // El servidor arma el título del encargo a partir de los repuestos; estos campos son el respaldo.
      repuestoSolicitado: items[0].nombre.trim(),
      cantidad: totalUnits || 1,
      items: items.map((item) => ({
        repuestoSolicitado: item.nombre.trim(),
        descripcion: item.descripcion.trim() || undefined,
        cantidad: parseInt(item.cantidad, 10) || 1,
        patente: item.otroVehiculo ? normalizePlate(item.patente) : undefined,
      })),
      tiempoVigenciaHoras: parseInt(tiempoVigenciaHoras, 10) || 48,
      tiempoMaximoEnvio,
      tipoEnvio,
      presupuestoMaximo: presupuestoMaximo ? parseFloat(presupuestoMaximo) : undefined,
      region: mainAddress?.regionNombre || undefined,
      comuna: mainAddress?.comunaNombre || undefined,
      fotos,
    };

    try {
      const creada = isEditing ? await updateAuction(auction.id, payload) : await createAuction(payload);
      if (onSuccess) onSuccess(creada);
      onClose();
    } catch (err) {
      setError(err?.message || (isEditing ? 'No pudimos guardar los cambios de tu encargo.' : 'Hubo un error al publicar el encargo de repuestos.'));
    } finally {
      setLoading(false);
    }
  };

  const title = isEditing ? 'Editar encargo de repuestos' : template ? 'Publicar de nuevo tu encargo' : 'Publicar encargo de repuestos';

  return (
    <div className="ft-modal-backdrop ft-page" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <form className="ft-modal ft-form" style={{ width: 'min(720px, 100%)' }} role="dialog" aria-modal="true" aria-label={title} onSubmit={handleSubmit}>
        <div className="ft-modal-head">
          <h2>{title}</h2>
          <button type="button" className="ft-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <p className="ft-sub">Cuéntanos qué repuestos necesitas. Las tiendas te enviarán sus ofertas y tú eliges con cuál comprar.</p>

        <FormSection number={1} title="Vehículo del encargo" hint={vehicle ? 'Verifica que los datos de tu vehículo estén correctos.' : 'Indícalo con la patente o ingrésalo a mano.'}>
          {manualVehicle ? (
            <div className="ft-vehicle-card">
              <div className="ft-vehicle-head">
                <span><CheckCircle2 size={16} /> Vehículo ingresado a mano</span>
                <button type="button" className="ft-link" onClick={() => setManualVehicle(null)}>Cambiar vehículo</button>
              </div>
              <dl>
                {[['Marca', manualVehicle.marca], ['Modelo', manualVehicle.modelo], ['Año', manualVehicle.anio || ''], ['Versión', manualVehicle.version], ['Motor', manualVehicle.motor], ['Chasis / VIN', manualVehicle.chasis]]
                  .filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            </div>
          ) : (
            <>
              {!plateVehicle && (
                <div className="ft-tabs" role="tablist" aria-label="Cómo indicar el vehículo">
                  <button type="button" role="tab" aria-selected={vehicleMode === 'plate'} className={`ft-tab ${vehicleMode === 'plate' ? 'is-active' : ''}`} onClick={() => setVehicleMode('plate')}>Por patente<RecommendedBadge /></button>
                  <button type="button" role="tab" aria-selected={vehicleMode === 'manual'} className={`ft-tab ${vehicleMode === 'manual' ? 'is-active' : ''}`} onClick={() => setVehicleMode('manual')}>Encargo manual</button>
                </div>
              )}
              {!plateVehicle && vehicleMode === 'plate' && <PlateBenefitHint />}
              {!plateVehicle && vehicleMode === 'manual' ? (
                <AuctionManualVehicle onUse={setManualVehicle} initial={manualVehicle} />
              ) : plateVehicle ? (
                <div className="acv-plate is-confirmed">
                  <span className="acv-plate-label">Patente</span>
                  <strong className="acv-plate-value" aria-label="Patente parcialmente oculta">{maskPlate(patente)}</strong>
                  <button type="button" className="ft-link" onClick={() => setPatente('')}>Cambiar patente</button>
                </div>
              ) : (
                <div className="acv-plate">
                  <label className="acv-plate-label" htmlFor="auction-plate">Patente del vehículo *</label>
                  <input
                    id="auction-plate"
                    type="text"
                    value={patente}
                    maxLength={8}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    onChange={(e) => setPatente(e.target.value.toUpperCase().replace(/[^A-Z0-9-\s]/g, ''))}
                    placeholder="ABCD12"
                    className="acv-plate-input"
                  />
                  <small className="acv-plate-hint">
                    {lookingUpPlate ? 'Consultando patente…' : <>¿No la tienes a mano? <button type="button" className="ft-link" onClick={() => setVehicleMode('manual')}>Ingresa el vehículo a mano</button>.</>}
                  </small>
                </div>
              )}
              {plateError && !manualVehicle && <p className="ft-error" role="alert"><AlertCircle size={15} /> {plateError}</p>}
              {plateVehicle && (
                <VehicleSummary
                  vehicle={plateVehicle}
                  note="El chasis lo ven las tiendas para cotizar la pieza exacta; tu patente se muestra siempre parcialmente oculta."
                />
              )}
            </>
          )}
        </FormSection>

        <FormSection
          number={2}
          title="¿Qué repuestos necesitas?"
          hint="Agrega todo lo que necesitas en un solo encargo. Cada tienda ofrece los que tenga y tú eliges qué aceptar."
        >
          <div className="acv-count-row"><em className="acv-count">{items.length} {items.length === 1 ? 'repuesto' : 'repuestos'} · {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}</em></div>
          <div className="acv-items">
            {items.map((item, index) => (
              <ItemEditor
                key={item.key}
                item={item}
                index={index}
                canRemove={items.length > 1}
                forLabel={forLabelFor(item)}
                onChange={changeItem}
                onRemove={removeItem}
                onVehicle={registerVehicle}
              />
            ))}
          </div>
          {items.length < MAX_ITEMS && (askingNext ? (
            <div className="acv-ask" role="group" aria-label="¿Es para el mismo vehículo?">
              <strong>¿Es para el mismo vehículo?</strong>
              <div className="acv-ask-actions">
                <button type="button" className="ft-btn ft-btn-primary" onClick={() => addItem(false)}>Sí, el mismo</button>
                <button type="button" className="ft-btn ft-btn-outline" onClick={() => addItem(true)}>No, otro vehículo</button>
                <button type="button" className="ft-link" onClick={() => setAskingNext(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" className="acv-add-item" onClick={() => setAskingNext(true)}>
              <Plus size={16} /> Agregar otro repuesto
            </button>
          ))}

        </FormSection>

        <FormSection number={3} title="Fotos de muestra" hint="Opcional: el repuesto dañado, su etiqueta o su número de parte ayudan a las tiendas a ofertar lo correcto.">
          <div className="ft-field">
            <span>Fotografías de muestra o falla <small>Opcional · hasta 5 · {fotos.length}/5</small></span>
            <div className="ft-photos" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {fotos.map((url, idx) => (
                <div key={idx} className="auction-photo-thumb-wrap">
                  <img src={resolveMediaUrl(url)} alt={`Foto ${idx + 1}`} />
                  <button type="button" onClick={() => setFotos((prev) => prev.filter((_, i) => i !== idx))} className="auction-photo-remove-btn" aria-label={`Quitar la foto ${idx + 1}`}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {fotos.length < 5 && (
                <label className="ft-btn ft-btn-outline" style={{ cursor: 'pointer' }}>
                  <Upload size={16} /> {uploadingFoto ? 'Subiendo…' : 'Agregar foto'}
                  <input type="file" accept="image/*" multiple onChange={handleFileChange} disabled={uploadingFoto} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection number={4} title="Plazos y condiciones" hint="Cuánto tiempo reciben ofertas las tiendas, cómo te llega el repuesto y dónde se publica.">
          <div className="ft-row">
            <label className="ft-field">
              <span>Vigencia para ofertas</span>
              <select value={tiempoVigenciaHoras} onChange={(e) => setTiempoVigenciaHoras(e.target.value)}>
                <option value={24}>24 horas (Urgente)</option>
                <option value={48}>48 horas (Recomendado)</option>
                <option value={72}>72 horas (3 días)</option>
                <option value={120}>5 días</option>
                <option value={168}>7 días</option>
              </select>
            </label>
            <label className="ft-field">
              <span>Presupuesto máximo <small>Opcional</small></span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={presupuestoMaximo}
                onChange={(e) => setPresupuestoMaximo(onlyDigits(e.target.value, 9))}
                placeholder="Ej: 150000"
              />
            </label>
          </div>
          <div className="ft-row">
            <label className="ft-field">
              <span>Plazo máx. de envío *</span>
              <select value={tiempoMaximoEnvio} onChange={(e) => setTiempoMaximoEnvio(e.target.value)}>
                <option value="Mismo día / Inmediato">Mismo día / Inmediato</option>
                <option value="24 horas">24 horas</option>
                <option value="48 horas">48 horas</option>
                <option value="3 a 5 días hábiles">3 a 5 días hábiles</option>
                <option value="A convenir">A convenir</option>
              </select>
            </label>
            <label className="ft-field">
              <span>Tipo de envío *</span>
              <select value={tipoEnvio} onChange={(e) => setTipoEnvio(e.target.value)}>
                <option value="Despacho a domicilio">Despacho a domicilio</option>
                <option value="Retiro en tienda">Retiro en tienda</option>
              </select>
            </label>
          </div>
          <p className="ft-hint">
            Las tiendas de tu comuna podrán ofrecerte retiro en tienda o despacho dentro de la comuna (con el costo del envío). Las de otras comunas solo podrán ofrecer despacho a domicilio por pagar (courier): el envío lo pagas aparte.
          </p>
          <label className="ft-field">
            <span>Dirección de entrega <small>Obligatoria</small></span>
            <select
              value={addressChoice}
              onChange={(e) => setAddressChoice(e.target.value)}
              disabled={!addressesLoaded}
              aria-label="Dirección del encargo"
            >
              {!addressesLoaded && <option value="">Cargando tus direcciones…</option>}
              {addresses.map((address) => (
                <option key={address.id} value={String(address.id)}>
                  {address.calleYNumero} · {[address.comunaNombre, address.regionNombre].filter(Boolean).join(', ')}{address.esPrincipal ? ' (principal)' : ''}
                </option>
              ))}
              <option value={NEW_ADDRESS}>+ Agregar una dirección nueva</option>
            </select>
            {addressesLoaded && addresses.length === 0 && addressChoice === NEW_ADDRESS && (
              <small>Aún no tienes direcciones: agrega una para poder publicar.</small>
            )}
          </label>
          {addressChoice === NEW_ADDRESS && (
            <QuickAddressForm userId={userId} onCreated={loadAddresses} />
          )}
        </FormSection>

        {error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
        <div className="ft-actions">
          <button type="submit" disabled={loading || !vehicle || !mainAddress || !hasChanges} className="ft-btn ft-btn-primary" title={!mainAddress ? 'Registra una dirección para publicar' : (!hasChanges ? 'Modifica algo para guardar los cambios' : undefined)}>
            {loading ? (isEditing ? 'Guardando…' : 'Publicando…') : `${isEditing ? 'Guardar cambios' : 'Publicar encargo'} (${items.length} ${items.length === 1 ? 'repuesto' : 'repuestos'})`}
          </button>
          <button type="button" onClick={onClose} disabled={loading} className="ft-btn ft-btn-outline">Cancelar</button>
        </div>
      </form>
    </div>
  );
}

/* El contenido tiene hooks: se monta solo con el modal abierto. */
export default function CreateAuctionModal(props) {
  const isMobile = useIsMobile();
  if (!props.isOpen) return null;
  // En el celular, publicar y editar usan el formulario idéntico al de la app.
  const view = isMobile
    ? <AuctionCreateMobile auction={props.auction || null} template={props.template || null} initialPatente={props.initialPatente || ''} onClose={props.onClose} onSuccess={props.onSuccess} />
    : <CreateAuctionModalContent {...props} />;
  // Fuera del panel del perfil: los contenedores del intranet (scroll, apilado) recortaban el popup y dejaban
  // el menú y la barra superior encima de los campos.
  return typeof document !== 'undefined' ? createPortal(view, document.body) : view;
}
