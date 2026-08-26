/**
 * Redimensiona y recomprime una imagen ANTES de subirla.
 *
 * Es la pieza que decide cuánto dura el bucket. R2 son 10 GB compartidos con las fotos
 * de productos, anuncios, perfiles y comprobantes de envío; una foto de celular sale
 * entre 3 y 8 MB en crudo, así que a ese ritmo el chat solo se comería el espacio con
 * unas mil imágenes. Bajando el lado mayor a 1600 px y guardando en JPEG al 80%, una
 * foto de repuesto queda en 200-400 KB: el mismo bucket aguanta decenas de miles.
 *
 * 1600 px es de sobra para mirar una pieza en pantalla o ampliarla; el detalle que
 * importa (un número de parte, una rotura) se sigue leyendo.
 *
 * Si algo falla —formato raro, canvas bloqueado— se devuelve el archivo original y
 * decide el tope de peso. Nunca se pierde la foto por culpa de la compresión.
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export async function compressImageFile(file, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) {
  if (!file || !file.type?.startsWith('image/')) return file;
  // Los GIF pierden la animación al pasar por canvas y los SVG no son raster.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const largest = Math.max(width, height);
    const scale = largest > maxDimension ? maxDimension / largest : 1;

    // Ya es chica y liviana: recomprimir solo agregaría pérdida sin ganar nada.
    if (scale === 1 && file.size <= 400 * 1024) {
      bitmap.close?.();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close?.();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

export default compressImageFile;
