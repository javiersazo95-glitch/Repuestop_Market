/**
 * El repuesto a partir del código del fabricante impreso en la caja (25-nov-2026), para la carga 1:1 del Market.
 * Misma regla que el panel del vendedor: qué vehículos le sirven lo decide el backend contra el catálogo chileno.
 */

export const FLAG_FICHA_CODIGO = 'global.ficha-codigo';
export const CODIGO_MAX = 60;

/** Sólo los vehículos que el catálogo confirma: con años y con versiones. */
export const gruposSeguros = (ficha) => (ficha?.compatibilidad?.grupos || []).filter((g) => g.segura && g.anioDesde);

/** Los que hay que revisar a mano antes de publicarlos. */
export const gruposPorRevisar = (ficha) => (ficha?.compatibilidad?.grupos || []).filter((g) => !g.segura && g.anioDesde);

export const textoGrupo = (g) => [
  `${g.marca} ${g.modelo}`,
  g.anioDesde ? (g.anioHasta && g.anioHasta !== g.anioDesde ? `${g.anioDesde}-${g.anioHasta}` : String(g.anioDesde)) : '',
  g.motor ? `motor ${g.motor}` : '',
].filter(Boolean).join(' · ');

/** Una tarjeta de compatibilidad del formulario a partir de un vehículo de la ficha. */
export const compatibilidadDesdeGrupo = (g) => ({
  brandId: '',
  brand: g.marca,
  model: g.modelo,
  yearFrom: g.anioDesde != null ? String(g.anioDesde) : '',
  yearTo: g.anioHasta != null ? String(g.anioHasta) : (g.anioDesde != null ? String(g.anioDesde) : ''),
  motor: g.motor || '',
  oem: '',
  vehicleCatalogIds: (g.vehiculoCatalogoIds || []).map(String),
});

/** "Juego de pastillas de freno, freno de disco" + TRW + GDB3424 -> título corto de la publicación. */
export function nombrePropuesto(ficha, maximo = 120) {
  const pieza = ficha.nombre.split(',')[0].trim();
  const conMarca = `${pieza} ${ficha.marca}`.trim();
  const completo = `${conMarca} ${ficha.codigo}`.trim();
  if (completo.length <= maximo) return completo;
  return (conMarca.length <= maximo ? conMarca : pieza).slice(0, maximo).trim();
}

/** Descripción sólo con datos que la tienda ya está confirmando (pieza, marca, código y vehículos). */
export function descripcionPropuesta(ficha, grupos) {
  const autos = [...new Set(grupos.map((g) => `${g.marca} ${g.modelo}`))];
  const lista = autos.slice(0, 6).join(', ') + (autos.length > 6 ? ` y ${autos.length - 6} modelos más` : '');
  return [
    `${ficha.nombre.split(',')[0].trim()} marca ${ficha.marca}, código ${ficha.codigo}.`,
    autos.length > 0 ? `Sirve para: ${lista}. Revisa los años y el motor en la compatibilidad o compruébalo con tu patente.` : '',
  ].filter(Boolean).join(' ');
}

const sinTildes = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Mismo nombre de marca aunque difieran tildes, mayúsculas o signos. */
export const mismoNombre = (a, b) => sinTildes(a) !== '' && sinTildes(a) === sinTildes(b);
