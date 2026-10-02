import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Car, CheckCircle2, Loader2, X } from 'lucide-react';
import { searchVehicleByPatenteApi } from '../services/api';
import { formatVehicleLabel, isValidPlate, lookupVehicleByPlate, normalizePlate } from '../utils/vehicleLookup';

/**
 * Agrega o edita un vehículo de la compra (el propio o el de un familiar), igual que la app
 * (CartVehicleEditor): la patente se identifica sola y completa marca, modelo y año; si no se
 * identifica, se escriben a mano. `plateCache` evita consultar dos veces la misma patente.
 */
export default function CheckoutVehicleDialog({ vehicle, plateCache, onClose, onSave }) {
  const [form, setForm] = useState({
    patente: vehicle?.patente || '',
    marca: vehicle?.marca || '',
    modelo: vehicle?.modelo || '',
    anio: vehicle?.anio || '',
  });
  const [catalogoId, setCatalogoId] = useState(vehicle?.catalogoId ?? null);
  const [status, setStatus] = useState(() => (plateCache.get(normalizePlate(vehicle?.patente || '')) ? 'found' : 'idle'));
  const patenteRef = useRef(form.patente);
  patenteRef.current = form.patente;

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
    if (!found) return;
    setForm((current) => ({
      ...current,
      marca: found.marca || current.marca,
      modelo: found.modelo || current.modelo,
      anio: found.anio > 0 ? String(found.anio) : current.anio,
    }));
    setCatalogoId(found.catalogoId || null);
  };

  useEffect(() => {
    const plate = normalizePlate(form.patente);
    if (plate.length !== 6 || !isValidPlate(plate)) return undefined;
    const timer = window.setTimeout(() => { identify(plate); }, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.patente]);

  const identified = status === 'found';
  const complete = identified || Boolean(form.marca.trim() && form.modelo.trim() && Number(form.anio));
  const found = plateCache.get(normalizePlate(form.patente));

  const save = (event) => {
    event.preventDefault();
    if (!complete) return;
    onSave({
      key: vehicle?.key || `v-${Date.now()}`,
      patente: normalizePlate(form.patente),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      anio: form.anio.trim(),
      catalogoId,
    }, identified);
  };

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
            <p>Puede ser el tuyo o el de un familiar. Escribe la patente y completamos el resto.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="cart-invoice-fields">
          <label>
            <span>Patente</span>
            <input
              className="checkout-plate-input"
              autoComplete="off"
              value={form.patente}
              onChange={(event) => setForm((current) => ({ ...current, patente: event.target.value.toUpperCase() }))}
              onBlur={(event) => identify(event.target.value)}
              placeholder="ABCD12"
              maxLength={12}
              autoFocus
            />
            {status === 'loading' && <small className="checkout-plate-status"><Loader2 size={12} className="spin-icon" /> Identificando patente…</small>}
            {identified && found && <small className="checkout-plate-status is-found"><CheckCircle2 size={12} /> Identificado: <strong>{formatVehicleLabel(found)}</strong></small>}
            {status === 'notfound' && <small className="checkout-plate-status">No pudimos identificarla: completa marca, modelo y año.</small>}
          </label>
          <label><span>Marca</span><input value={form.marca} maxLength={80} placeholder="Toyota" onChange={(event) => setForm((current) => ({ ...current, marca: event.target.value }))} /></label>
          <label><span>Modelo</span><input value={form.modelo} maxLength={120} placeholder="Yaris" onChange={(event) => setForm((current) => ({ ...current, modelo: event.target.value }))} /></label>
          <label><span>Año</span><input value={form.anio} inputMode="numeric" maxLength={4} placeholder="2018" onChange={(event) => setForm((current) => ({ ...current, anio: event.target.value.replace(/\D/g, '').slice(0, 4) }))} /></label>
        </div>
        <small className="checkout-vehicle-dialog-privacy">A la tienda le llega la patente parcial; para validar usa el chasis y el modelo.</small>
        <button type="submit" className="checkout-vehicle-dialog-save" aria-disabled={!complete}>
          <CheckCircle2 size={16} /> Usar este vehículo
        </button>
        {!complete && <small className="checkout-item-delivery-note">Escribe una patente que podamos identificar o la marca, el modelo y el año.</small>}
      </form>
    </div>,
    document.body,
  );
}
