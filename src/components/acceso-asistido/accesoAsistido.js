/**
 * Acceso asistido (17-nov): soporte carga repuestos por el vendedor, con su permiso. Lo comun de la pestana del
 * perfil, el banner del header y la pagina del enlace del correo: textos, duraciones y el contador con el reloj
 * del servidor.
 */

/** Duraciones que el vendedor puede conceder, en horas (las mismas que valida el backend). */
export const DURACIONES = [
  { horas: 2, etiqueta: '2 horas' },
  { horas: 8, etiqueta: '8 horas' },
  { horas: 24, etiqueta: '1 día' },
  { horas: 72, etiqueta: '3 días' },
];

export const NIVELES = [
  { valor: 'BASICO', titulo: 'Carga uno a uno', detalle: 'Soporte crea tus repuestos nuevos con el formulario, uno a uno.' },
  { valor: 'MEDIO', titulo: 'Carga uno a uno y precios', detalle: 'Lo anterior, y cambia el precio de repuestos que ya tienes (el stock no se toca).' },
  { valor: 'COMPLETO', titulo: 'Carga completa con Excel', detalle: 'Lo anterior, y sube tus repuestos nuevos con un archivo Excel.' },
];

const ORDEN = ['BASICO', 'MEDIO', 'COMPLETO'];

export const tituloNivel = (valor) => NIVELES.find((n) => n.valor === valor)?.titulo || valor || '';

/** Niveles que el vendedor puede conceder: el pedido o uno menor, nunca uno mayor. */
export const nivelesHasta = (pedido) => NIVELES.filter((n) => ORDEN.indexOf(n.valor) <= ORDEN.indexOf(pedido));

export const TEXTO_ESTADO = {
  PENDIENTE_VENDEDOR: 'Soporte pide acceso a tu panel',
  PENDIENTE_SOPORTE: 'Tu solicitud espera a soporte',
  ACTIVO: 'Soporte tiene acceso a tu panel',
  RECHAZADO: 'Rechazaste la solicitud',
  REVOCADO: 'Cortaste el acceso',
  EXPIRADO: 'Venció',
  CANCELADO: 'Cancelada',
  FINALIZADO: 'Soporte terminó',
};

export const TEXTO_EVENTO = {
  SOLICITADO: 'Se solicitó el acceso',
  REENVIADO: 'Se reenvió el correo',
  AUTORIZADO: 'Autorizaste el acceso',
  ACEPTADO: 'Soporte aceptó tu solicitud',
  RECHAZADO: 'Rechazaste la solicitud',
  CANCELADO: 'Se canceló la solicitud',
  INGRESO: 'Soporte entró a tu panel',
  PRODUCTO_CREADO: 'Soporte creó un repuesto',
  PRECIO_ACTUALIZADO: 'Soporte cambió un precio',
  EXCEL_CARGADO: 'Soporte cargó un Excel',
  REVOCADO: 'Cortaste el acceso',
  FINALIZADO: 'Soporte salió de tu panel',
  EXPIRADO: 'Venció',
};

const dos = (n) => String(n).padStart(2, '0');

/** { ms, vencido, texto: 'hh:mm:ss' | '2d hh:mm:ss', tono } con el reloj del servidor (offsetMs = servidor - navegador). */
export function restanteHasta(finIso, offsetMs = 0, ahora = Date.now()) {
  const fin = finIso ? Date.parse(finIso) : NaN;
  if (Number.isNaN(fin)) return { ms: 0, vencido: true, texto: '00:00:00', tono: 'rojo' };
  const ms = Math.max(0, fin - (ahora + offsetMs));
  const total = Math.floor(ms / 1000);
  const dias = Math.floor(total / 86400);
  const hms = `${dos(Math.floor((total % 86400) / 3600))}:${dos(Math.floor((total % 3600) / 60))}:${dos(total % 60)}`;
  const tono = ms < 3_600_000 ? 'rojo' : ms < 6 * 3_600_000 ? 'ambar' : 'normal';
  return { ms, vencido: ms === 0, texto: dias > 0 ? `${dias}d ${hms}` : hms, tono };
}

export function offsetDe(serverTime, recibidoEn = Date.now()) {
  const t = serverTime ? Date.parse(serverTime) : NaN;
  return Number.isNaN(t) ? 0 : t - recibidoEn;
}

export function fechaHora(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

/** "2 h", "1 día", "3 días" a partir de las horas concedidas. */
export function etiquetaDuracion(horas) {
  return DURACIONES.find((d) => d.horas === horas)?.etiqueta || (horas ? `${horas} h` : '');
}

/** Precio en pesos chilenos ("$12.990"), o una raya si no hay. */
export const pesos = (valor) => (valor == null || Number.isNaN(Number(valor)) ? '—' : `$${Number(valor).toLocaleString('es-CL')}`);
