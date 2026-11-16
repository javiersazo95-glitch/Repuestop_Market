// Linea de compatibilidad de un repuesto. Vive aparte de adapters.js (16-nov) porque tambien la
// usa la funcion de Vercel `api/ficha.js`, que corre en Node sin Vite: este archivo no importa nada.

/** "XLI 151MC1 - 1.500 - Mecánica" -> "XLI 151MC1 Mecánica": sin la cilindrada repetida. */
function versionCorta(label) {
  const [nombre, ...resto] = String(label || '').split(' - ').map((parte) => parte.trim()).filter(Boolean);
  const transmision = resto.find((parte) => /mec|autom/i.test(parte));
  return [nombre, transmision].filter(Boolean).join(' ');
}

/**
 * Linea de compatibilidad de la card (5-oct): marca, modelo, anios y version del primer vehiculo
 * declarado ("Toyota Yaris 2016–2027 · XLI +1"), y cuantos vehiculos mas declara. Vacia si no
 * declara vehiculo.
 */
export function compatibilidadLinea(compatibilidad) {
  if (!Array.isArray(compatibilidad) || compatibilidad.length === 0) return '';
  const [primera] = compatibilidad;
  const anios = primera.anioInicio && primera.anioFin
    ? (primera.anioInicio === primera.anioFin ? `${primera.anioInicio}` : `${primera.anioInicio}–${primera.anioFin}`)
    : `${primera.anioInicio || primera.anioFin || ''}`;
  const vehiculo = [primera.marca, primera.modelo, anios].filter(Boolean).join(' ').trim();
  if (!vehiculo) return '';
  const versiones = Array.isArray(primera.versionLabels) && primera.versionLabels.length
    ? primera.versionLabels
    : String(primera.version || '').split(',').map((v) => v.trim()).filter((v) => v && !/^\d+ versi/i.test(v));
  const version = versiones.length > 1
    ? `${versionCorta(versiones[0])} +${versiones.length - 1}`
    : versiones.length === 1 ? versionCorta(versiones[0]) : '';
  const mas = compatibilidad.length > 1
    ? `+${compatibilidad.length - 1} ${compatibilidad.length === 2 ? 'vehículo' : 'vehículos'}`
    : '';
  return [vehiculo, version, mas].filter(Boolean).join(' · ');
}
