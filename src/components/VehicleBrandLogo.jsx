import React, { useState } from 'react';
import { CarFront } from 'lucide-react';

// Marcas de vehículo frecuentes en el catálogo. Simple Icons entrega los emblemas
// vectoriales y el respaldo evita volver a mostrar letras para marcas sin logo.
const BRAND_SLUGS = {
  acura: 'acura', 'alfa romeo': 'alfaromeo', astonmartin: 'astonmartin', audi: 'audi',
  bentley: 'bentley', bmw: 'bmw', byd: 'byd', cadillac: 'cadillac', chevrolet: 'chevrolet',
  chrysler: 'chrysler', citroen: 'citroen', cupra: 'cupra', dacia: 'dacia', dodge: 'dodge',
  ferrari: 'ferrari', fiat: 'fiat', ford: 'ford', geely: 'geely', honda: 'honda',
  hyundai: 'hyundai', infiniti: 'infiniti', isuzu: 'isuzu', jaguar: 'jaguar', jeep: 'jeep',
  kia: 'kia', 'kia motors': 'kia', lamborghini: 'lamborghini', 'land rover': 'landrover',
  lexus: 'lexus', lotus: 'lotus', mazda: 'mazda', 'mercedes benz': 'mercedes', 'mercedes-benz': 'mercedes',
  mini: 'mini', mitsubishi: 'mitsubishi', nissan: 'nissan', opel: 'opel', peugeot: 'peugeot',
  porsche: 'porsche', ram: 'ram', renault: 'renault', saab: 'saab', subaru: 'subaru',
  suzuki: 'suzuki', tesla: 'tesla', toyota: 'toyota', volkswagen: 'volkswagen', volvo: 'volvo',
};

function normalizedBrand(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function VehicleBrandLogo({ brand, className = '', title }) {
  const [failed, setFailed] = useState(false);
  const slug = BRAND_SLUGS[normalizedBrand(brand)];
  const label = title || brand;

  return (
    <span className={`vehicle-brand-icon ${className}`.trim()} data-tooltip={label} title={label} aria-label={label}>
      {slug && !failed ? (
        <img src={`https://cdn.simpleicons.org/${slug}/1268f3`} alt="" onError={() => setFailed(true)} />
      ) : <CarFront size={12} aria-hidden="true" />}
    </span>
  );
}
