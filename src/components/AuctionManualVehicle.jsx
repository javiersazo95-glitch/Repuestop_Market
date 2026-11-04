import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { getVehicleBrandsApi, getVehicleModelsApi, getVehicleMotorsApi, getVehicleVersionsApi } from '../services/api';
import { ANIOS_DISPONIBLES } from '../data/sampleVehicles';

const nameOf = (item) => item?.nombre || item?.name || '';
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** "Sport 1.5" -> "1.5": la cilindrada que dice la versión, para proponer el motor. */
const litersFromVersion = (version) => {
  const match = String(version || '').match(/(?:^|[^\d.])(\d[.,]\d)(?![\d.,])/);
  return match ? match[1].replace(',', '.') : '';
};

/**
 * Búsqueda manual del vehículo, igual a la de la app: marca, modelo, año, versión y motor (obligatorios; de la lista
 * del catálogo o escritos si no aparecen) y N° de chasis (VIN), opcional.
 * `onUse({ marca, modelo, anio, version, motor, chasis })` entrega el vehículo elegido.
 * `initial` precarga los datos de un vehículo ya ingresado a mano (al editar un pedido).
 */
export default function AuctionManualVehicle({ onUse, initial = null }) {
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [versions, setVersions] = useState([]);
  const [motors, setMotors] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [customModel, setCustomModel] = useState(false);
  const [modelText, setModelText] = useState('');
  const [year, setYear] = useState(initial?.anio ? String(initial.anio) : '');
  const [version, setVersion] = useState(initial?.version || '');
  const [customVersion, setCustomVersion] = useState(false);
  const [motor, setMotor] = useState(initial?.motor || '');
  const [customMotor, setCustomMotor] = useState(false);
  const [chassis, setChassis] = useState(initial?.chasis || '');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(() => (initial?.marca ? { marca: initial.marca, modelo: initial.modelo } : null));

  useEffect(() => {
    let active = true;
    getVehicleBrandsApi().then((list) => { if (active) setBrands(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Al editar: la marca guardada se busca en el catálogo apenas carga.
  useEffect(() => {
    if (!pending?.marca || brands.length === 0) return;
    const match = brands.find((item) => sameText(nameOf(item), pending.marca));
    if (match) setBrandId(String(match.id)); else setPending(null);
  }, [pending, brands]);

  useEffect(() => {
    setModels([]);
    setModelId('');
    if (!brandId) return undefined;
    let active = true;
    getVehicleModelsApi(brandId).then((list) => {
      if (!active) return;
      const options = Array.isArray(list) ? list : [];
      setModels(options);
      if (pending?.modelo) {
        const match = options.find((item) => sameText(nameOf(item), pending.modelo));
        if (match) setModelId(String(match.id || match.nombre));
        else { setCustomModel(true); setModelText(pending.modelo); }
        setPending(null);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [brandId]); // eslint-disable-line react-hooks/exhaustive-deps

  const brandName = nameOf(brands.find((item) => String(item.id) === brandId));
  const modelName = customModel ? modelText.trim() : nameOf(models.find((item) => String(item.id || item.nombre) === modelId));

  // Versiones y motores del catálogo para ese modelo y año; sin lista se escriben.
  useEffect(() => {
    setVersions([]);
    setMotors([]);
    if (customModel || !brandName || !modelName || !year) return undefined;
    let active = true;
    const range = { marca: brandName, modelo: modelName, anioDesde: year, anioHasta: year };
    getVehicleVersionsApi(range).then((list) => { if (active) setVersions((Array.isArray(list) ? list : []).map(nameOf).filter(Boolean)); }).catch(() => {});
    getVehicleMotorsApi(range).then((list) => { if (active) setMotors(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, [brandName, modelName, year, customModel]);

  const motorLabels = useMemo(() => motors.map((item) => item.etiqueta || item.valor).filter(Boolean), [motors]);
  const showVersionPicker = !customModel && !customVersion && versions.length > 0 && (!version || versions.includes(version));
  const showMotorPicker = !customModel && !customMotor && motorLabels.length > 0 && (!motor || motorLabels.includes(motor));

  const chooseVersion = (value) => {
    setVersion(value);
    if (motor.trim()) return;
    const liters = litersFromVersion(value);
    if (!liters) return;
    const match = motors.find((item) => item.litros === liters || String(item.etiqueta || '').startsWith(liters));
    setMotor(match ? (match.etiqueta || match.valor) : liters);
  };

  const missing = () => {
    if (!brandName) return 'Elige la marca.';
    if (!modelName) return 'Elige o escribe el modelo.';
    if (!year) return 'Elige el año.';
    if (!version.trim()) return 'Elige o escribe la versión.';
    if (!motor.trim()) return 'Elige o escribe el motor.';
    return '';
  };

  const use = () => {
    const problem = missing();
    if (problem) { setError(problem); return; }
    setError('');
    onUse({ marca: brandName, modelo: modelName, anio: Number(year), version: version.trim(), motor: motor.trim(), chasis: chassis.trim() || undefined });
  };

  return (
    <div className="ft-vehicle-step">
      <div className="ft-row">
        <label className="ft-field">
          <span>Marca *</span>
          <select value={brandId} onChange={(e) => { setBrandId(e.target.value); setCustomModel(false); setModelText(''); setVersion(''); setMotor(''); setCustomVersion(false); setCustomMotor(false); }}>
            <option value="">Busca y elige la marca</option>
            {brands.map((item) => <option key={item.id} value={String(item.id)}>{nameOf(item)}</option>)}
          </select>
        </label>
        <label className="ft-field">
          <span>Modelo *</span>
          {customModel ? (
            <input type="text" value={modelText} maxLength={100} placeholder="Escribe el modelo" onChange={(e) => setModelText(e.target.value)} />
          ) : (
            <select value={modelId} disabled={!brandId} onChange={(e) => { setModelId(e.target.value); setVersion(''); setMotor(''); }}>
              <option value="">{brandId ? 'Busca y elige el modelo' : 'Primero elige la marca'}</option>
              {models.map((item) => <option key={item.id || item.nombre} value={String(item.id || item.nombre)}>{nameOf(item)}</option>)}
            </select>
          )}
          {brandId && (
            <button type="button" className="ft-link" style={{ alignSelf: 'flex-start' }} onClick={() => { setCustomModel((v) => !v); setModelId(''); setModelText(''); }}>
              {customModel ? 'Elegir de la lista' : 'Mi modelo no aparece'}
            </button>
          )}
        </label>
      </div>

      <label className="ft-field">
        <span>Año *</span>
        <select value={year} onChange={(e) => { setYear(e.target.value); setVersion(''); setMotor(''); setCustomVersion(false); setCustomMotor(false); }}>
          <option value="">Elige el año</option>
          {ANIOS_DISPONIBLES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>

      <div className="ft-row">
        <label className="ft-field">
          <span>Versión *</span>
          {showVersionPicker ? (
            <select value={version} onChange={(e) => chooseVersion(e.target.value)}>
              <option value="">Busca y elige la versión</option>
              {versions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : (
            <input type="text" value={version} maxLength={100} placeholder="Ej. 1.5 XLI" onChange={(e) => setVersion(e.target.value)} />
          )}
          {!customModel && versions.length > 0 && (
            <button type="button" className="ft-link" style={{ alignSelf: 'flex-start' }} onClick={() => setCustomVersion((v) => !v)}>
              {showVersionPicker ? 'Mi versión no aparece' : 'Elegir de la lista'}
            </button>
          )}
        </label>
        <label className="ft-field">
          <span>Motor *</span>
          {showMotorPicker ? (
            <select value={motor} onChange={(e) => setMotor(e.target.value)}>
              <option value="">Elige el motor</option>
              {motorLabels.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : (
            <input type="text" value={motor} maxLength={100} placeholder="Ej. 1.6 o 1.6 G4FC" onChange={(e) => setMotor(e.target.value)} />
          )}
          {!customModel && motorLabels.length > 0 && (
            <button type="button" className="ft-link" style={{ alignSelf: 'flex-start' }} onClick={() => setCustomMotor((v) => !v)}>
              {showMotorPicker ? 'Mi motor no aparece' : 'Elegir de la lista'}
            </button>
          )}
        </label>
      </div>

      <label className="ft-field">
        <span>N° de chasis (VIN) <small>Opcional</small></span>
        <input type="text" value={chassis} maxLength={40} placeholder="Ej. 9BWZZZ377VT004251" onChange={(e) => setChassis(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        <small>Permite a las tiendas confirmar la compatibilidad exacta de la pieza.</small>
      </label>

      {error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
      <button type="button" className="ft-btn ft-btn-primary ft-vehicle-use" onClick={use}>
        Usar este vehículo
      </button>
    </div>
  );
}
