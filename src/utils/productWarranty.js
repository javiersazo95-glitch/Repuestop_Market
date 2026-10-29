import { useMemo } from 'react';
import { useLista } from '../remoteConfig/hooks';
import { remoteConfig } from '../remoteConfig/remoteConfig';

// Garantia del producto (2026-10-19). Parte en 6 meses: los repuestos nuevos ya tienen esa
// garantia legal, y una opcion menor haria creer al comprador que tiene menos proteccion. El
// backend guarda el texto tal cual (maximo 80 caracteres); "Otra" deja escribirla a mano. Mismas
// opciones que la app y el panel del vendedor.
//
// Mantenedor comun (2026-10-20): las opciones salen de la lista `GARANTIA_PRODUCTO` (el `valor` es
// el texto que se guarda). Esta constante es el respaldo cuando el bootstrap no esta.
export const PRODUCT_WARRANTY_PRESETS_FALLBACK = [
  '6 meses (garantía legal)',
  '1 año',
  '2 años',
  '3 años',
  'Garantía del fabricante',
];

export const PRODUCT_WARRANTY_OTHER = '__other__';
export const PRODUCT_WARRANTY_MAX = 80;

const toPresets = (opciones) => opciones.map((opcion) => opcion.valor).filter(Boolean);

/** Presets vigentes (lista del mantenedor o respaldo), para codigo fuera de React. */
export function getWarrantyPresets() {
  const opciones = remoteConfig.lista('GARANTIA_PRODUCTO', null);
  return opciones ? toPresets(opciones) : PRODUCT_WARRANTY_PRESETS_FALLBACK;
}

// "Otra" va siempre: la lista declara `permiteTextoLibre`, pero el bootstrap no trae metadata de
// lista (solo de opcion), y el backend acepta cualquier texto de hasta 80 caracteres.
function buildWarrantyOptions(presets) {
  return [
    ...presets.map((value) => ({ value, label: value })),
    { value: PRODUCT_WARRANTY_OTHER, label: 'Otra (escribirla)' },
  ];
}

export const PRODUCT_WARRANTY_OPTIONS_FALLBACK = buildWarrantyOptions(PRODUCT_WARRANTY_PRESETS_FALLBACK);

/** Opciones del desplegable de garantia, al dia con el mantenedor. */
export function useWarrantyOptions() {
  const presets = useLista('GARANTIA_PRODUCTO', PRODUCT_WARRANTY_PRESETS_FALLBACK, toPresets);
  return useMemo(
    () => (presets === PRODUCT_WARRANTY_PRESETS_FALLBACK ? PRODUCT_WARRANTY_OPTIONS_FALLBACK : buildWarrantyOptions(presets)),
    [presets],
  );
}

export const normalizeWarranty = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * Separa una garantia guardada en la opcion del desplegable y el texto de "Otra". Una garantia que
 * el dueno saco de la lista sigue intacta: se muestra como "Otra" con su texto.
 */
export function warrantyToForm(stored) {
  const text = normalizeWarranty(stored);
  if (!text) return { warranty: '', warrantyOther: '' };
  return getWarrantyPresets().includes(text)
    ? { warranty: text, warrantyOther: '' }
    : { warranty: PRODUCT_WARRANTY_OTHER, warrantyOther: text };
}

/** Garantia final a enviar: la opcion elegida o el texto escrito con "Otra". */
export const resolveWarranty = (warranty, warrantyOther) =>
  normalizeWarranty(warranty === PRODUCT_WARRANTY_OTHER ? warrantyOther : warranty);
