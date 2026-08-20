import { getPaisesApi, getRegionesApi, getComunasApi } from './api';

/**
 * El catálogo de geografía guarda los nombres SIN tildes ("Nunoa", "Region del
 * Libertador General Bernardo O'Higgins") y el autocompletado los devuelve CON tildes,
 * así que comparar en crudo no calza ninguno. NFD descompone también la eñe, que es lo
 * que hace funcionar el caso "Ñuñoa" -> "Nunoa".
 */
export function normalizarNombreGeografico(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Traduce los NOMBRES de comuna y región que entrega `GET /ubicaciones/direcciones` a
 * los IDS que espera el backend al guardar una dirección.
 *
 * Devuelve también las listas consultadas para que quien las pinte en selects no tenga
 * que volver a pedirlas. Lo que no calza vuelve en `null`: la idea es rellenar lo que se
 * pueda y dejar que la persona complete el resto a mano, nunca inventar un id.
 */
export async function resolverUbicacionPorNombre({ comuna, region }, { paises: paisesCache } = {}) {
  const vacio = { paisId: null, regionId: null, comunaId: null, paises: paisesCache || [], regiones: [], comunas: [] };
  if (!comuna && !region) return vacio;

  try {
    let paises = paisesCache;
    if (!paises?.length) {
      const data = await getPaisesApi();
      paises = Array.isArray(data) ? data : [];
    }
    const chile = paises.find((pais) => normalizarNombreGeografico(pais.nombre).includes('chile')) || paises[0];
    if (!chile) return { ...vacio, paises };

    const dataRegiones = await getRegionesApi(chile.id);
    const regiones = Array.isArray(dataRegiones) ? dataRegiones : [];

    const objetivoRegion = normalizarNombreGeografico(region);
    const regionMatch = region
      ? regiones.find((item) => {
        const nombre = normalizarNombreGeografico(item.nombre);
        return nombre.includes(objetivoRegion) || objetivoRegion.includes(nombre);
      })
      : null;

    if (!regionMatch) return { ...vacio, paises, paisId: chile.id, regiones };

    const dataComunas = await getComunasApi(regionMatch.id);
    const comunas = Array.isArray(dataComunas) ? dataComunas : [];

    const objetivoComuna = normalizarNombreGeografico(comuna);
    const comunaMatch = comuna
      ? comunas.find((item) => normalizarNombreGeografico(item.nombre) === objetivoComuna)
        || comunas.find((item) => normalizarNombreGeografico(item.nombre).includes(objetivoComuna))
      : null;

    return {
      paises,
      regiones,
      comunas,
      paisId: chile.id,
      regionId: regionMatch.id,
      comunaId: comunaMatch ? comunaMatch.id : null,
      comunaNombre: comunaMatch ? comunaMatch.nombre : null,
      regionNombre: regionMatch.nombre,
    };
  } catch {
    // Sin catálogo no se rellena nada; los selects manuales siguen disponibles.
    return vacio;
  }
}
