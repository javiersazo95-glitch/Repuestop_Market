import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Car, CheckCircle2, Loader2, PencilLine, X } from 'lucide-react';
import { getVehicleBrandsApi, getVehicleModelsApi, getVehicleMotorsApi, getVehicleVersionsApi, searchVehicleByPatenteApi } from '../services/api';
import { formatVehicleLabel, isValidPlate, lookupVehicleByPlate, normalizePlate } from '../utils/vehicleLookup';
import { buildCartVehicle, initialVehicleMode, normalizeChassis, vehicleFormMissing, vehicleYearOptions } from '../utils/cartVehicleForm';
import SearchableDropdown from './SearchableDropdown';

const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const toOptions = (list) => (Array.isArray(list) ? list : []).map((item) => ({ value: String(item.id), label: item.nombre }));

/**
 * Agrega o edita un vehículo de la compra (el propio o el de un familiar), igual que la app
 * (CartVehicleEditor), con dos modos como la búsqueda del home (8-oct): "Por patente" (se
 * identifica sola) o "Búsqueda manual" con marca, modelo, año y versión del catálogo, con
 * buscador. Solo se ve uno a la vez y solo se guarda lo del activo. Antes marca, modelo y año eran
 * texto libre y un "yaris" mal escrito daba un "no coincide" falso en la compatibilidad.
 * `plateCache` evita consultar dos veces la misma patente.
 *
 * 19-oct (decisión del usuario): a mano, versión y motor son obligatorios (del catálogo cuando lo
 * hay; si no aparece, se escribe) y se suma el chasis (VIN), opcional: la tienda ve la misma ficha
 * del vehículo en una compra y en una cotización. Lo usan el carro y el checkout de una cotización
 * (`initialMode="manual"` abre directo en la búsqueda manual).
 */
const OTHER_OPTION = '__otra__';

export default function CheckoutVehicleDialog({ vehicle, plateCache, initialMode, onClose, onSave }) {
  const [mode, setMode] = useState(() => initialMode || initialVehicleMode(vehicle));
  const [patente, setPatente] = useState(vehicle?.patente || '');
  const [status, setStatus] = useState(() => {
    const plate = normalizePlate(vehicle?.patente || '');
    if (plate && plateCache.get(plate)) return 'found';
    return plate && plateCache.has(plate) ? 'notfound' : 'idle';
  });
  const patenteRef = useRef(patente);
  patenteRef.current = patente;

  const startsManual = initialVehicleMode(vehicle) === 'manual';
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [versions, setVersions] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [customModel, setCustomModel] = useState(false);
  const [modelText, setModelText] = useState('');
  const [anio, setAnio] = useState(startsManual ? vehicle?.anio || '' : '');
  const [version, setVersion] = useState(startsManual ? vehicle?.version || '' : '');
  // Versión o motor que no aparece en el catálogo: se escribe a mano.
  const [versionFree, setVersionFree] = useState(false);
  const [motors, setMotors] = useState([]);
  const [motor, setMotor] = useState(startsManual ? vehicle?.motor || '' : '');
  const [motorFree, setMotorFree] = useState(false);
  const [chasis, setChasis] = useState(startsManual ? vehicle?.chasis || '' : '');
  const versionRef = useRef(version);
  versionRef.current = version;
  const motorRef = useRef(motor);
  motorRef.current = motor;
  const [catalogError, setCatalogError] = useState('');
  // Al editar un vehículo manual, sus textos se buscan en el catálogo cuando cargan las listas.
  const pendingBrand = useRef(startsManual ? vehicle?.marca || '' : '');
  const pendingModel = useRef(startsManual ? vehicle?.modelo || '' : '');

  const yearOptions = useMemo(() => vehicleYearOptions(), []);
  const brandName = brands.find((option) => option.value === brandId)?.label || '';
  const modelName = customModel ? modelText : models.find((option) => option.value === modelId)?.label || '';

  useEffect(() => {
    let active = true;
    getVehicleBrandsApi()
      .then((list) => {
        if (!active) return;
        const options = toOptions(list);
        setBrands(options);
        if (pendingBrand.current) {
          const match = options.find((option) => sameText(option.label, pendingBrand.current));
          pendingBrand.current = '';
          if (match) setBrandId(match.value);
        }
      })
      .catch(() => { if (active) setCatalogError('No pudimos cargar las marcas. Revisa tu conexión.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setModels([]);
    if (!brandId) return undefined;
    let active = true;
    getVehicleModelsApi(brandId)
      .then((list) => {
        if (!active) return;
        const options = toOptions(list);
        setModels(options);
        if (pendingModel.current) {
          const match = options.find((option) => sameText(option.label, pendingModel.current));
          if (match) setModelId(match.value);
          else {
            setCustomModel(true);
            setModelText(pendingModel.current);
          }
          pendingModel.current = '';
        }
      })
      .catch(() => { if (active) setCatalogError('No pudimos cargar los modelos de esa marca.'); });
    return () => { active = false; };
  }, [brandId]);

  useEffect(() => {
    setVersions([]);
    setMotors([]);
    if (customModel || !brandName || !modelName || !anio) return undefined;
    let active = true;
    const sameVehicle = { marca: brandName, modelo: modelName, anioDesde: anio, anioHasta: anio };
    getVehicleVersionsApi(sameVehicle)
      .then((list) => {
        if (!active) return;
        const options = (Array.isArray(list) ? list : []).map((item) => ({ value: item.nombre, label: item.nombre }));
        setVersions(options);
        // Al editar, una versión escrita a mano que no está en la lista se mantiene como texto.
        if (versionRef.current && !options.some((option) => sameText(option.value, versionRef.current))) setVersionFree(true);
      })
      .catch(() => undefined);
    // Motor: las cilindradas y códigos del catálogo de ese modelo y año (1.5L, 2NR-FE...).
    getVehicleMotorsApi(sameVehicle)
      .then((list) => {
        if (!active) return;
        const options = (Array.isArray(list) ? list : [])
          .map((item) => ({ value: item.valor || item.etiqueta, label: item.etiqueta || item.valor }))
          .filter((option) => option.value);
        setMotors(options);
        if (motorRef.current && !options.some((option) => sameText(option.value, motorRef.current))) setMotorFree(true);
        // Con un solo motor en el catálogo no hay nada que elegir.
        else if (!motorRef.current && options.length === 1) setMotor(options[0].value);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [brandName, modelName, anio, customModel]);

  const identify = async (raw) => {
    const plate = normalizePlate(raw);
    if (!isValidPlate(plate)) return;
    let found;
    if (plateCache.has(plate)) {
      found = plateCache.get(plate);
    } else {
      setStatus('loading');
      try {
        found = await lookupVehicleByPlate(plate, { searchVehicleByPatenteApi });
        plateCache.set(plate, found);
      } catch {
        found = null;
      }
    }
    if (normalizePlate(patenteRef.current) !== plate) return;
    setStatus(found ? 'found' : 'notfound');
  };

  useEffect(() => {
    const plate = normalizePlate(patente);
    if (plate.length !== 6 || !isValidPlate(plate)) return undefined;
    const timer = window.setTimeout(() => { identify(plate); }, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patente]);

  const found = plateCache.get(normalizePlate(patente)) || null;
  const identified = status === 'found' && Boolean(found);
  const plateState = identified ? 'found' : status === 'found' ? 'idle' : status;
  const manual = { marca: brandName, modelo: modelName, anio, version, motor, chasis };
  const missing = vehicleFormMissing({ mode, plateState, manual });

  const save = (event) => {
    event.preventDefault();
    if (missing) return;
    onSave(buildCartVehicle({
      key: vehicle?.key || `v-${Date.now()}`,
      mode,
      patente,
      plateState,
      identified: found
        ? { marca: found.marca || '', modelo: found.modelo || '', anio: found.anio > 0 ? String(found.anio) : '', catalogoId: found.catalogoId || null }
        : null,
      manual,
    }), mode === 'plate' && identified);
  };

  // Versión y motor dependen del modelo y del año: al cambiarlos se vuelven a elegir.
  const resetVersionAndMotor = () => {
    setVersion('');
    setVersionFree(false);
    setMotor('');
    setMotorFree(false);
  };

  const resetModel = () => {
    setModelId('');
    setModelText('');
    resetVersionAndMotor();
  };

  const versionFromList = !customModel && versions.length > 0 && !versionFree;
  const motorFromList = !customModel && motors.length > 0 && !motorFree;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="checkout-vehicle-dialog-backdrop" onClick={onClose}>
      <form
        className="checkout-vehicle-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={vehicle ? 'Editar vehículo' : 'Agregar vehículo'}
        onClick={(event) => event.stopPropagation()}
        onSubmit={save}
      >
        <header>
          <span className="checkout-vehicle-icon"><Car size={16} /></span>
          <div>
            <h2>{vehicle ? 'Editar vehículo' : 'Agregar vehículo'}</h2>
            <p>Puede ser el tuyo o el de un familiar.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="checkout-vehicle-modes" role="tablist" aria-label="Cómo indicar el vehículo">
          <button type="button" role="tab" aria-selected={mode === 'plate'} className={mode === 'plate' ? 'is-active' : ''} onClick={() => setMode('plate')}>
            <Car size={15} /> Por patente
          </button>
          <button type="button" role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? 'is-active' : ''} onClick={() => setMode('manual')}>
            <PencilLine size={15} /> Búsqueda manual
          </button>
        </div>
        {mode === 'plate' ? (
          <div className="cart-invoice-fields">
            <label>
              <span>Patente</span>
              <input
                className="checkout-plate-input"
                autoComplete="off"
                value={patente}
                onChange={(event) => setPatente(event.target.value.toUpperCase())}
                onBlur={(event) => identify(event.target.value)}
                placeholder="ABCD12"
                maxLength={12}
                autoFocus
              />
              {status === 'loading' && <small className="checkout-plate-status"><Loader2 size={12} className="spin-icon" /> Identificando patente…</small>}
              {identified && <small className="checkout-plate-status is-found"><CheckCircle2 size={12} /> Identificado: <strong>{formatVehicleLabel(found)}</strong></small>}
              {status === 'notfound' && (
                <small className="checkout-plate-status">
                  No pudimos identificar esta patente.{' '}
                  <button type="button" className="checkout-item-link" onClick={() => setMode('manual')}>Ingresar los datos a mano</button>
                </small>
              )}
              {status === 'idle' && <small className="checkout-plate-status">Escribe la patente y completamos marca, modelo y año.</small>}
            </label>
          </div>
        ) : (
          <div className="cart-invoice-fields">
            {catalogError && <small className="checkout-item-delivery-error">{catalogError}</small>}
            {/* div y no label: dentro de un label, elegir una opción reabría el menú. */}
            <div className="checkout-vehicle-field">
              <span>Marca</span>
              <SearchableDropdown
                value={brandId}
                options={brands}
                placeholder="Busca y elige la marca"
                emptyText="No encontramos esa marca."
                onChange={(value) => { setBrandId(String(value)); setCustomModel(false); resetModel(); }}
              />
            </div>
            <div className="checkout-vehicle-field">
              <span>Modelo</span>
              {customModel ? (
                <input value={modelText} maxLength={120} placeholder="Escribe el modelo" onChange={(event) => setModelText(event.target.value)} />
              ) : (
                <SearchableDropdown
                  value={modelId}
                  options={models}
                  disabled={!brandId}
                  placeholder={brandId ? 'Busca y elige el modelo' : 'Primero elige la marca'}
                  emptyText="No encontramos ese modelo."
                  customOptionLabel="Mi modelo no aparece"
                  onCustomOption={() => { setCustomModel(true); resetModel(); }}
                  onChange={(value) => { setModelId(String(value)); resetVersionAndMotor(); }}
                />
              )}
              {customModel && (
                <small className="checkout-plate-status">
                  La tienda verá que este modelo lo escribiste a mano.{' '}
                  <button type="button" className="checkout-item-link" onClick={() => { setCustomModel(false); resetModel(); }}>Elegir de la lista</button>
                </small>
              )}
            </div>
            <label>
              <span>Año</span>
              <select value={anio} onChange={(event) => { setAnio(event.target.value); resetVersionAndMotor(); }}>
                <option value="" disabled>Elige el año</option>
                {yearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Versión</span>
              {versionFromList ? (
                <select
                  value={version}
                  onChange={(event) => {
                    if (event.target.value === OTHER_OPTION) {
                      setVersionFree(true);
                      setVersion('');
                    } else setVersion(event.target.value);
                  }}
                >
                  <option value="" disabled>Elige la versión</option>
                  {versions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  <option value={OTHER_OPTION}>Mi versión no aparece</option>
                </select>
              ) : (
                <input value={version} maxLength={120} placeholder="Ej. GLI 1.5 MT" onChange={(event) => setVersion(event.target.value)} />
              )}
              {versionFree && versions.length > 0 && !customModel && (
                <small className="checkout-plate-status">
                  <button type="button" className="checkout-item-link" onClick={() => { setVersionFree(false); setVersion(''); }}>Elegir de la lista</button>
                </small>
              )}
            </label>
            <label>
              <span>Motor</span>
              {motorFromList ? (
                <select
                  value={motor}
                  onChange={(event) => {
                    if (event.target.value === OTHER_OPTION) {
                      setMotorFree(true);
                      setMotor('');
                    } else setMotor(event.target.value);
                  }}
                >
                  <option value="" disabled>Elige el motor</option>
                  {motors.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  <option value={OTHER_OPTION}>Mi motor no aparece</option>
                </select>
              ) : (
                <input value={motor} maxLength={80} placeholder="Cilindrada o código, ej. 1.5L 2NR-FE" onChange={(event) => setMotor(event.target.value)} />
              )}
              {motorFree && motors.length > 0 && !customModel && (
                <small className="checkout-plate-status">
                  <button type="button" className="checkout-item-link" onClick={() => { setMotorFree(false); setMotor(''); }}>Elegir de la lista</button>
                </small>
              )}
            </label>
            <label>
              <span>N° de chasis (VIN) (opcional)</span>
              <input
                className="checkout-plate-input"
                autoComplete="off"
                value={chasis}
                maxLength={30}
                placeholder="Ej. 9BWZZZ377VT004251"
                onChange={(event) => setChasis(normalizeChassis(event.target.value))}
              />
              <small className="checkout-plate-status">Con el chasis la tienda valida el repuesto con más seguridad.</small>
            </label>
            {status === 'notfound' && normalizePlate(patente) && (
              <small className="checkout-plate-status">La patente {normalizePlate(patente)} (sin identificar) también le llega a la tienda.</small>
            )}
          </div>
        )}
        <small className="checkout-vehicle-dialog-privacy">A la tienda le llega la patente parcial; para validar usa el chasis y el modelo.</small>
        <button type="submit" className="checkout-vehicle-dialog-save" aria-disabled={Boolean(missing)}>
          <CheckCircle2 size={16} /> Usar este vehículo
        </button>
        {missing && <small className="checkout-item-delivery-note">{missing}</small>}
      </form>
    </div>,
    document.body,
  );
}
