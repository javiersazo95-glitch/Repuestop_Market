/**
 * Validación de los archivos que se suben desde el cliente.
 *
 * Se centraliza porque había diez entradas de tipo file y cada una hacía lo suyo: seis
 * comprobaban tamaño con un número distinto escrito a mano y cuatro no comprobaban nada,
 * así que en `AdForm` o en el comprobante de un pedido se podía elegir un archivo de
 * 200 MB y descubrirlo recién cuando el backend cortaba la subida.
 *
 * Esto es comodidad para quien sube, NO un control de seguridad. `file.type` lo declara
 * el navegador a partir de la extensión y se falsifica renombrando el archivo; el límite
 * de verdad lo pone el backend, que es quien debe mirar los magic bytes y el tamaño real.
 * Duplicarlo aquí solo evita un viaje inútil y un mensaje de error confuso.
 */

/** Tamaños en bytes, con nombre para que no queden números sueltos en los componentes. */
export const FILE_LIMITS = {
  /** Imágenes de chat y evidencia: ya pasan por `compressImageFile` antes de llegar aquí. */
  CHAT_IMAGE: 3 * 1024 * 1024,
  /** Fotos de producto, anuncio y perfil. */
  IMAGE: 5 * 1024 * 1024,
  /** Documentos tributarios y de verificación, que vienen escaneados y pesan más. */
  DOCUMENT: 10 * 1024 * 1024,
};

function formatearMb(bytes) {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Comprueba un archivo contra un tamaño máximo y, si se indica, contra los tipos aceptados.
 *
 * Devuelve `null` cuando está todo bien, o el mensaje de error ya redactado en español
 * listo para pintar. Se devuelve el mensaje en vez de lanzar porque quien llama lo pone en
 * su propio estado de error, que es distinto en cada formulario.
 *
 * @param {File|null} file
 * @param {{ maxBytes?: number, accept?: 'image'|'pdf'|'image-or-pdf', label?: string }} opciones
 */
export function validateUpload(file, { maxBytes = FILE_LIMITS.IMAGE, accept, label = 'El archivo' } = {}) {
  if (!file) return null;

  if (accept) {
    const tipo = String(file.type || '');
    const esImagen = tipo.startsWith('image/');
    const esPdf = tipo === 'application/pdf';
    const permitido = accept === 'image' ? esImagen
      : accept === 'pdf' ? esPdf
        : esImagen || esPdf;
    if (!permitido) {
      const esperado = accept === 'image' ? 'una imagen'
        : accept === 'pdf' ? 'un PDF'
          : 'una imagen o un PDF';
      return `${label} debe ser ${esperado}.`;
    }
  }

  if (file.size > maxBytes) {
    return `${label} debe pesar menos de ${formatearMb(maxBytes)}.`;
  }

  return null;
}
