import React, { useEffect, useMemo, useState } from 'react';
import { vehicleBrandLogoSources, vehicleBrandMonogram } from '../data/vehicleBrands';
import { useCatalogo } from '../remoteConfig/hooks';

/**
 * Emblema de una marca de vehículo. Los logos se sirven desde public/brand-logos
 * (antes se pedían a un CDN externo que fue dando de baja emblemas de autos: varias
 * marcas ya mapeadas —Mercedes, Lexus, Dodge, Jaguar, Land Rover, Alfa Romeo— caían
 * en 404 y terminaban mostrando el mismo ícono genérico).
 *
 * Desde el Mantenedor comun el emblema puede venir de R2 (`iconoUrl` de `marcasVehiculo`);
 * si esa imagen falla se cae al SVG local y, si tampoco hay, al monograma.
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
  const marcasRemotas = useCatalogo('marcasVehiculo', null);
  const sources = useMemo(() => vehicleBrandLogoSources(brand, marcasRemotas), [brand, marcasRemotas]);
  const sourcesKey = sources.join('|');
  // Indice de la fuente que se esta intentando; al fallar una se pasa a la siguiente.
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => { setSourceIndex(0); }, [sourcesKey]);
  const logoUrl = sources[sourceIndex] || null;
  const label = title || brand;

  return (
    <span className={`vehicle-brand-icon ${className}`.trim()} data-tooltip={label} title={label} aria-label={label}>
      {logoUrl ? (
        <img src={logoUrl} alt="" onError={() => setSourceIndex((index) => index + 1)} />
      ) : (
        <Monogram brand={brand} />
      )}
    </span>
  );
}
