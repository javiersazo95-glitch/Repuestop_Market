import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { getVehicleBrandsApi, getVehicleModelsApi } from '../services/api';
import { ANIOS_DISPONIBLES } from '../data/sampleVehicles';

const nameOf = (item) => item?.nombre || item?.name || '';

/**
 * Búsqueda manual del vehículo (marca, modelo y año del catálogo), para quien no tiene la patente a mano.
 * `onUse({ marca, modelo, anio })` entrega el vehículo elegido.
 */
export default function AuctionManualVehicle({ onUse }) {
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getVehicleBrandsApi().then((list) => { if (active) setBrands(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setModels([]);
    setModelId('');
    if (!brandId) return undefined;
    let active = true;
    getVehicleModelsApi(brandId).then((list) => { if (active) setModels(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { active = false; };
  }, [brandId]);

  const brandName = nameOf(brands.find((item) => String(item.id) === brandId));
  const modelName = nameOf(models.find((item) => String(item.id || item.nombre) === modelId));

  const use = () => {
    if (!brandName) return setError('Selecciona la marca del vehículo.');
    if (!modelName) return setError('Selecciona el modelo del vehículo.');
    if (!year) return setError('Selecciona el año del vehículo.');
    setError('');
    return onUse({ marca: brandName, modelo: modelName, anio: Number(year) });
  };

  return (
    <div className="ft-vehicle-step">
      <div className="ft-row">
        <label className="ft-field">
          <span>Marca *</span>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Seleccionar</option>
            {brands.map((item) => <option key={item.id} value={String(item.id)}>{nameOf(item)}</option>)}
          </select>
        </label>
        <label className="ft-field">
          <span>Modelo *</span>
          <select value={modelId} disabled={!brandId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">Seleccionar</option>
            {models.map((item) => <option key={item.id || item.nombre} value={String(item.id || item.nombre)}>{nameOf(item)}</option>)}
          </select>
        </label>
      </div>
      <label className="ft-field">
        <span>Año *</span>
        <select value={year} disabled={!modelId} onChange={(e) => setYear(e.target.value)}>
          <option value="">Seleccionar</option>
          {ANIOS_DISPONIBLES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      {error && <p className="ft-error" role="alert"><AlertCircle size={15} /> {error}</p>}
      <button type="button" className="ft-btn ft-btn-primary ft-vehicle-use" disabled={!brandName || !modelName || !year} onClick={use}>
        Usar este vehículo
      </button>
    </div>
  );
}
