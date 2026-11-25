import { resolveMediaUrl } from '../../services/api';

/** Menos pestañas con datos que esto: se deja el detalle de siempre, sin pestañas. */
const MINIMO_PESTANAS_CON_DATOS = 2;
/** Filas a la vista antes de "Ver más". */
export const FILAS_VISIBLES = 8;

const lista = (valor) => (Array.isArray(valor) ? valor : []);
const medio = (valor) => (valor?.url ? { ...valor, url: resolveMediaUrl(valor.url) } : null);
const plano = (valor) => String(valor || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * La ficha técnica del backend (GET /inventario/productos/{id}/ficha-tecnica) lista para pintar: URLs
 * absolutas y listas siempre presentes. `null` si el repuesto no tiene ficha.
 */
export function adaptFicha(dto) {
  const d = dto?.detalle;
  if (!d) return null;
  const i = d.instalacion;
  return {
    codigo: dto.codigo || '',
    marca: dto.marca || '',
    nombre: dto.nombre || '',
    verificada: Boolean(dto.verificada),
    destacados: lista(d.destacados),
    resumen: lista(d.resumen),
    tecnicos: lista(d.tecnicos),
    medidas: lista(d.medidas),
    plano: medio(d.plano),
    fotos: lista(d.fotos).map(medio).filter(Boolean),
    instalacion: i ? {
      diagrama: medio(i.diagrama),
      puntos: lista(i.puntos),
      piezas: lista(i.piezas),
      documentos: lista(i.documentos).map(medio).filter(Boolean),
      accesorios: lista(i.accesorios),
    } : null,
    codigos: {
      fabricante: d.codigos?.fabricante || dto.codigo || '',
      originales: lista(d.codigos?.originales),
      codigosBarras: lista(d.codigos?.codigosBarras),
      equivalentes: lista(d.codigos?.equivalentes),
    },
    vehiculos: lista(d.vehiculos),
  };
}

/** Qué pestañas tiene este repuesto. Una sin datos no existe. */
export function pestanasDeFicha(ficha, { compatibles = 0, universal = false } = {}) {
  if (!ficha) return [];
  const conDatos = [
    (compatibles > 0 || universal) && { id: 'compatibilidad', label: 'Compatibilidad', cuenta: universal ? null : compatibles },
    (ficha.medidas.length > 0 || ficha.plano) && { id: 'medidas', label: 'Medidas' },
    ficha.instalacion && { id: 'instalacion', label: 'Instalación' },
    (ficha.codigos.originales.length > 0 || ficha.codigos.equivalentes.length > 0 || ficha.codigos.codigosBarras.length > 0)
      && { id: 'codigos', label: 'Códigos' },
  ].filter(Boolean);
  if (conDatos.length < MINIMO_PESTANAS_CON_DATOS) return [];
  return [{ id: 'resumen', label: 'Resumen' }, ...conDatos];
}

/**
 * Fotos de la galería: primero las de la tienda, después las del catálogo del fabricante y al final el plano y el
 * diagrama. Cada una dice qué es, para que nadie crea que la del catálogo es del ejemplar que se vende.
 */
export function galeriaConFicha(fotosTienda, ficha) {
  // Al repuesto publicado sin foto el backend le pone la del catálogo: es la misma, y sigue diciendo de quién es.
  const delCatalogo = new Set((ficha?.fotos || []).map((m) => m.url));
  const propias = fotosTienda.filter((url) => !delCatalogo.has(url)).map((url) => ({ url, rotulo: '' }));
  if (!ficha) return propias;
  return [
    ...propias,
    ...ficha.fotos.map((m) => ({ url: m.url, rotulo: 'Imagen del catálogo del fabricante' })),
    ...(ficha.plano ? [{ url: ficha.plano.url, rotulo: 'Plano de medidas' }] : []),
    ...(ficha.instalacion?.diagrama ? [{ url: ficha.instalacion.diagrama.url, rotulo: 'Diagrama del repuesto' }] : []),
  ];
}

/** "1.600" (así lo guarda el catálogo) -> "1.6". */
const motorLegible = (motor) => String(motor || '').trim().replace(/^(\d{1,2})[.,](\d)00$/, '$1.$2');

/** Une los tramos que se tocan: 2007-2010 y 2011-2014 son 2007-2014, pero 2007-2011 y 2014-2019 quedan separados. */
function unirTramos(tramos) {
  const orden = [...tramos].sort((a, b) => a[0] - b[0]);
  return orden.reduce((unidos, [desde, hasta]) => {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && desde <= ultimo[1] + 1) ultimo[1] = Math.max(ultimo[1], hasta);
    else unidos.push([desde, hasta]);
    return unidos;
  }, []);
}

/**
 * Las filas de compatibilidad publicadas, una por marca y modelo, con los años de CADA motor: juntarlos en un solo rango
 * diría que sirve en años en que no. Es lo que la tienda ofrece, no lo que dice el catálogo.
 */
export function gruposCompatibles(filas) {
  const grupos = new Map();
  filas.forEach((f) => {
    const clave = `${plano(f.marca)}|${plano(f.modelo)}`;
    const g = grupos.get(clave) || { clave, marca: f.marca, modelo: f.modelo, desde: null, hasta: null, motores: new Map() };
    const motor = motorLegible(f.motor);
    if (!g.motores.has(motor)) g.motores.set(motor, []);
    const desde = Number(f.anioInicio) || null;
    if (desde) {
      const hasta = Math.max(desde, Number(f.anioFin) || desde);
      g.motores.get(motor).push([desde, hasta]);
      g.desde = g.desde ? Math.min(g.desde, desde) : desde;
      g.hasta = g.hasta ? Math.max(g.hasta, hasta) : hasta;
    }
    grupos.set(clave, g);
  });
  return [...grupos.values()]
    .map((g) => ({
      ...g,
      motores: [...g.motores.keys()].filter(Boolean),
      tramos: [...g.motores.entries()]
        .map(([motor, t]) => ({ motor, anios: unirTramos(t).map(([d, h]) => rangoAnios(d, h)).join(' y ') }))
        .sort((a, b) => a.motor.localeCompare(b.motor, 'es', { numeric: true })),
    }))
    .sort((a, b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, 'es'));
}

/** Datos para taller de un grupo: solo vehículos del catálogo que la tienda también publicó. */
export function vehiculosParaTaller(grupo, vehiculos) {
  const marca = plano(grupo.marca);
  const modelo = plano(grupo.modelo).replace(/[^a-z0-9]/g, '');
  return vehiculos.filter((v) => plano(v.marca) === marca && plano(v.modelo).replace(/[^a-z0-9]/g, '') === modelo
    && (!grupo.hasta || !v.anioDesde || v.anioDesde <= grupo.hasta) && (!grupo.desde || !v.anioHasta || v.anioHasta >= grupo.desde));
}

export function rangoAnios(desde, hasta) {
  if (!desde && !hasta) return '';
  if (!hasta || desde === hasta) return String(desde || hasta);
  return `${desde || '…'}–${hasta}`;
}
