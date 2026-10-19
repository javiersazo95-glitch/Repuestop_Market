// Garantia del producto (2026-10-19). Parte en 6 meses: los repuestos nuevos ya tienen esa
// garantia legal, y una opcion menor haria creer al comprador que tiene menos proteccion. El
// backend guarda el texto tal cual (maximo 80 caracteres); "Otra" deja escribirla a mano. Mismas
// opciones que la app y el panel del vendedor.
export const PRODUCT_WARRANTY_PRESETS = [
  '6 meses (garantía legal)',
  '1 año',
  '2 años',
  '3 años',
  'Garantía del fabricante',
];

export const PRODUCT_WARRANTY_OTHER = '__other__';
export const PRODUCT_WARRANTY_MAX = 80;

export const PRODUCT_WARRANTY_OPTIONS = [
  ...PRODUCT_WARRANTY_PRESETS.map((value) => ({ value, label: value })),
  { value: PRODUCT_WARRANTY_OTHER, label: 'Otra (escribirla)' },
];

export const normalizeWarranty = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Separa una garantia guardada en la opcion del desplegable y el texto de "Otra". */
export function warrantyToForm(stored) {
  const text = normalizeWarranty(stored);
  if (!text) return { warranty: '', warrantyOther: '' };
  return PRODUCT_WARRANTY_PRESETS.includes(text)
    ? { warranty: text, warrantyOther: '' }
    : { warranty: PRODUCT_WARRANTY_OTHER, warrantyOther: text };
}

/** Garantia final a enviar: la opcion elegida o el texto escrito con "Otra". */
export const resolveWarranty = (warranty, warrantyOther) =>
  normalizeWarranty(warranty === PRODUCT_WARRANTY_OTHER ? warrantyOther : warranty);
