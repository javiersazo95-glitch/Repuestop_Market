import React, { useState } from 'react';
import { vehicleBrandLogoUrl, vehicleBrandMonogram } from '../data/vehicleBrands';

/**
 * Emblema de una marca de vehículo. Los logos se sirven desde public/brand-logos
 * (antes se pedían a un CDN externo que fue dando de baja emblemas de autos: varias
 * marcas ya mapeadas —Mercedes, Lexus, Dodge, Jaguar, Land Rover, Alfa Romeo— caían
 * en 404 y terminaban mostrando el mismo ícono genérico).
 *
 * Cualquier marca sin emblema disponible se dibuja con su monograma, así que toda
 * marca que el vendedor registre como especialista se distingue de las demás.
 */
// El tamaño depende del largo: tres letras anchas (MOR, WOL, XMO) no caben en el
// círculo de 17px con el cuerpo que usan las de dos.
function Monogram({ brand }) {
  const text = vehicleBrandMonogram(brand);
  return (
    <span className="vehicle-brand-monogram" data-length={text.length} aria-hidden="true">{text}</span>
  );
}

export default function VehicleBrandLogo({ brand, className = '', title }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = vehicleBrandLogoUrl(brand);
  const label = title || brand;

  return (
    <span className={`vehicle-brand-icon ${className}`.trim()} data-tooltip={label} title={label} aria-label={label}>
      {logoUrl && !failed ? (
        <img src={logoUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        <Monogram brand={brand} />
      )}
    </span>
  );
}
