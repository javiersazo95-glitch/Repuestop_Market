import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { vehicleSheetTitle } from '../utils/vehicleSheet';
import '../styles/vehicle-sheet.css';

const MANUAL_NOTICE = 'Datos ingresados a mano por el comprador: revísalos con cuidado.';

/**
 * Ficha del vehículo del comprador para la TIENDA (19-oct, decisión del usuario): la misma en el
 * checklist "Confirmar pedido", en el detalle del pedido y en la solicitud de cotización. Siempre en
 * este orden: patente (como venga, enmascarada) · marca modelo año · versión · motor · chasis, y el
 * aviso cuando el comprador ingresó el vehículo a mano.
 *
 * `vehicle` sale de las funciones de utils/vehicleSheet.js. `compact` la deja en una línea (el
 * "Para:" de cada producto del checklist), con `prefix` delante.
 */
export default function VehicleSheet({ vehicle, compact = false, prefix = '', className = '' }) {
  if (!vehicle) return null;
  const title = vehicleSheetTitle(vehicle);
  const manual = vehicle.origen === 'MANUAL';

  if (compact) {
    const parts = [
      vehicle.patente,
      title,
      vehicle.version ? `Versión ${vehicle.version}` : '',
      vehicle.motor ? `Motor ${vehicle.motor}` : '',
      vehicle.chasis ? `Chasis ${vehicle.chasis}` : 'Chasis no informado',
    ].filter(Boolean);
    return (
      <span className={`vehicle-sheet is-compact ${className}`.trim()}>
        <span className="vehicle-sheet-line">{prefix}{parts.join(' · ')}</span>
        {manual && <span className="vehicle-sheet-manual"><AlertTriangle size={12} /> {MANUAL_NOTICE}</span>}
      </span>
    );
  }

  const rows = [
    { key: 'patente', label: 'Patente', value: vehicle.patente || 'No informada' },
    { key: 'vehiculo', label: 'Marca, modelo y año', value: title || 'No informado' },
    { key: 'version', label: 'Versión', value: vehicle.version || 'No informada' },
    { key: 'motor', label: 'Motor', value: vehicle.motor || 'No informado' },
    { key: 'chasis', label: 'Chasis', value: vehicle.chasis || 'No informado', copyable: Boolean(vehicle.chasis) },
  ];
  return (
    <div className={`vehicle-sheet ${className}`.trim()}>
      <dl className="vehicle-sheet-grid">
        {rows.map((row) => (
          <div key={row.key} className={`vehicle-sheet-row is-${row.key}`}>
            <dt>{row.label}</dt>
            <dd className={row.copyable ? 'is-copyable' : ''}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {manual && <p className="vehicle-sheet-manual"><AlertTriangle size={13} /> {MANUAL_NOTICE}</p>}
    </div>
  );
}
