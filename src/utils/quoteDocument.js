import { formatRut } from '../services/adapters';

const COLORS = {
  navy: [7, 43, 101],
  blue: [13, 85, 181],
  brightBlue: [22, 96, 206],
  text: [25, 46, 76],
  muted: [88, 111, 143],
  border: [177, 193, 214],
  pale: [241, 246, 253],
  green: [20, 125, 82],
  red: [210, 52, 62],
  white: [255, 255, 255],
};

function money(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')} CLP`;
}

function shortDate(value) {
  const date = new Date(value || Date.now());
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santiago',
  }).format(date).replaceAll('/', '-');
}

function setText(doc, color = COLORS.text, size = 9, style = 'normal') {
  doc.setTextColor(...color);
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
}

function roundedCard(doc, x, y, width, height, fill = COLORS.white) {
  doc.setDrawColor(...COLORS.border);
  doc.setFillColor(...fill);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');
}

function sectionTitle(doc, title, y) {
  setText(doc, COLORS.navy, 11.5, 'bold');
  doc.text(title, 13, y);
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.45);
  doc.line(13, y + 2, 32, y + 2);
}

function cardBanner(doc, x, y, width, title, drawIcon) {
  const bannerHeight = 7.5;
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(x, y, width, bannerHeight, 1.5, 1.5, 'F');
  doc.rect(x, y + bannerHeight - 1.5, width, 1.5, 'F');
  drawIcon(doc, x + 3.5, y + 1.8, 3.8, COLORS.white);
  setText(doc, COLORS.white, 8.2, 'bold');
  doc.text(title, x + 10.5, y + 5.2);
}

function split(doc, value, width) {
  return doc.splitTextToSize(String(value || ''), width);
}

function loadImageElement(url, crossOrigin) {
  return new Promise((resolve, reject) => {
    const element = new Image();
    if (crossOrigin && /^https?:\/\//i.test(url)) {
      element.crossOrigin = crossOrigin;
    }
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    element.src = url;
  });
}

// Respaldo cuando `fetch` no puede leer el archivo (host sin CORS para XHR o
// respuesta protegida): el <img> sí lo carga y el canvas lo exporta a PNG.
async function imageElementToDataUrl(url) {
  if (typeof document === 'undefined' || !url) return null;
  try {
    const image = await loadImageElement(url, 'anonymous');
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || 200;
    canvas.height = image.naturalHeight || 200;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    try {
      const imageWithoutCors = await loadImageElement(url, null);
      const canvas = document.createElement('canvas');
      canvas.width = imageWithoutCors.naturalWidth || 200;
      canvas.height = imageWithoutCors.naturalHeight || 200;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageWithoutCors, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }
}

async function urlToDataUrl(url) {
  if (!url) return null;
  if (/^data:image\/png;base64,/i.test(url)) return url;
  if (/^data:/i.test(url)) {
    return imageElementToDataUrl(url);
  }
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo cargar la imagen (${response.status})`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const dataUrl = await imageElementToDataUrl(objectUrl);
      return dataUrl;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return imageElementToDataUrl(url);
  }
}

// Recorta la imagen en un círculo (mismo encuadre que la foto de perfil de la tienda).
async function toCircularDataUrl(dataUrl, size = 512) {
  if (!dataUrl || typeof document === 'undefined') return dataUrl;
  try {
    const image = await loadImageElement(dataUrl, null);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.save();
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.clip();
    const scale = Math.max(size / (image.naturalWidth || size), size / (image.naturalHeight || size));
    const width = (image.naturalWidth || size) * scale;
    const height = (image.naturalHeight || size) * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    context.restore();
    return canvas.toDataURL('image/png');
  } catch {
    return dataUrl;
  }
}

// El logo de la tienda siempre se registra en el PDF: si el recorte circular
// falla, se usa la imagen original en vez de perder el logo.
async function loadStoreLogo(url) {
  if (!url || typeof url !== 'string') return null;
  const dataUrl = await urlToDataUrl(url).catch(() => null);
  if (!dataUrl) return null;
  return toCircularDataUrl(dataUrl).catch(() => dataUrl);
}

function addContainedImage(doc, dataUrl, x, y, maxWidth, maxHeight, align = 'center') {
  if (!dataUrl) return false;
  try {
    let formattedDataUrl = dataUrl;
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:') && !dataUrl.startsWith('data:image/')) {
      formattedDataUrl = dataUrl.replace(/^data:[^;]+;/, 'data:image/png;');
    }
    const properties = doc.getImageProperties(formattedDataUrl);
    const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height);
    const width = properties.width * ratio;
    const height = properties.height * ratio;
    const offsetX = align === 'left' ? 0 : (maxWidth - width) / 2;
    doc.addImage(formattedDataUrl, properties.fileType || 'PNG', x + offsetX, y + (maxHeight - height) / 2, width, height, undefined, 'FAST');
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------- Iconos --------------------------------- */

function storeIcon(doc, x, y, s, color = COLORS.navy) {
  doc.setDrawColor(...color);
  doc.setFillColor(...color);
  doc.setLineWidth(s * 0.09);
  doc.lines(
    [[s * 0.76, 0], [s * 0.12, s * 0.28], [-s, 0]],
    x + s * 0.12,
    y,
    [1, 1],
    'F',
    true,
  );
  doc.rect(x + s * 0.1, y + s * 0.28, s * 0.8, s * 0.72, 'S');
  doc.rect(x + s * 0.36, y + s * 0.58, s * 0.28, s * 0.42, 'F');
}

function personIcon(doc, x, y, s, color = COLORS.navy) {
  doc.setDrawColor(...color);
  doc.setLineWidth(s * 0.09);
  doc.circle(x + s * 0.5, y + s * 0.26, s * 0.24, 'S');
  doc.lines(
    [[s * 0.06, -s * 0.42, s * 0.74, -s * 0.42, s * 0.8, 0]],
    x + s * 0.1,
    y + s,
    [1, 1],
    'S',
  );
}

// Paquete en volumen (cara superior + dos caras frontales), como en la plantilla.
function boxIcon(doc, x, y, s, color = COLORS.navy) {
  doc.setFillColor(...color);
  doc.lines(
    [
      [s * 0.5, s * 0.25],
      [0, s * 0.5],
      [-s * 0.5, s * 0.25],
      [-s * 0.5, -s * 0.25],
      [0, -s * 0.5],
    ],
    x + s * 0.5,
    y + s * 0.02,
    [1, 1],
    'F',
    true,
  );
  doc.setDrawColor(...COLORS.white);
  doc.setLineWidth(s * 0.08);
  doc.line(x, y + s * 0.27, x + s * 0.5, y + s * 0.52);
  doc.line(x + s, y + s * 0.27, x + s * 0.5, y + s * 0.52);
  doc.line(x + s * 0.5, y + s * 0.52, x + s * 0.5, y + s * 1.02);
}

function truckIcon(doc, x, y, s, color = COLORS.navy) {
  doc.setFillColor(...color);
  doc.rect(x, y + s * 0.16, s * 0.5, s * 0.5, 'F');
  doc.lines(
    [[s * 0.16, 0], [s * 0.12, s * 0.16], [0, s * 0.34], [-s * 0.28, 0]],
    x + s * 0.56,
    y + s * 0.16,
    [1, 1],
    'F',
    true,
  );
  doc.circle(x + s * 0.16, y + s * 0.8, s * 0.14, 'F');
  doc.circle(x + s * 0.7, y + s * 0.8, s * 0.14, 'F');
  doc.setFillColor(...COLORS.white);
  doc.circle(x + s * 0.16, y + s * 0.8, s * 0.05, 'F');
  doc.circle(x + s * 0.7, y + s * 0.8, s * 0.05, 'F');
  doc.rect(x + s * 0.6, y + s * 0.24, s * 0.16, s * 0.14, 'F');
}

function shieldIcon(doc, x, y, s, color = COLORS.navy) {
  doc.setFillColor(...color);
  doc.lines(
    [
      [s, 0],
      [0, s * 0.45],
      [-s * 0.05, s * 0.3, -s * 0.3, s * 0.48, -s * 0.5, s * 0.55],
      [-s * 0.2, -s * 0.07, -s * 0.45, -s * 0.25, -s * 0.5, -s * 0.55],
    ],
    x,
    y + s * 0.05,
    [1, 1],
    'F',
    true,
  );
  doc.setDrawColor(...COLORS.white);
  doc.setLineWidth(s * 0.12);
  doc.line(x + s * 0.27, y + s * 0.45, x + s * 0.43, y + s * 0.61);
  doc.line(x + s * 0.43, y + s * 0.61, x + s * 0.74, y + s * 0.29);
}

function clockIcon(doc, x, y, s, color = COLORS.navy) {
  doc.setDrawColor(...color);
  doc.setLineWidth(s * 0.1);
  doc.circle(x + s * 0.5, y + s * 0.5, s * 0.44, 'S');
  doc.setLineWidth(s * 0.09);
  doc.line(x + s * 0.5, y + s * 0.5, x + s * 0.5, y + s * 0.24);
  doc.line(x + s * 0.5, y + s * 0.5, x + s * 0.72, y + s * 0.58);
}

function mapPinIcon(doc, x, y, s, color = COLORS.brightBlue) {
  doc.setFillColor(...color);
  doc.circle(x + s * 0.5, y + s * 0.36, s * 0.34, 'F');
  doc.lines(
    [[s * 0.24, -s * 0.34], [-s * 0.48, 0]],
    x + s * 0.26,
    y + s * 0.48,
    [1, 1],
    'F',
    true,
  );
  doc.setFillColor(...COLORS.white);
  doc.circle(x + s * 0.5, y + s * 0.36, s * 0.12, 'F');
}

function phoneIcon(doc, x, y, s, color = COLORS.brightBlue) {
  doc.setFillColor(...color);
  doc.roundedRect(x + s * 0.18, y + s * 0.08, s * 0.64, s * 0.84, s * 0.15, s * 0.15, 'F');
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(x + s * 0.26, y + s * 0.2, s * 0.48, s * 0.52, s * 0.06, s * 0.06, 'F');
  doc.circle(x + s * 0.5, y + s * 0.8, s * 0.05, 'F');
}

function carIcon(doc, x, y, s, color = COLORS.brightBlue) {
  doc.setFillColor(...color);
  doc.roundedRect(x + s * 0.05, y + s * 0.36, s * 0.9, s * 0.34, s * 0.08, s * 0.08, 'F');
  doc.roundedRect(x + s * 0.22, y + s * 0.14, s * 0.54, s * 0.32, s * 0.08, s * 0.08, 'F');
  doc.setFillColor(...COLORS.white);
  doc.circle(x + s * 0.26, y + s * 0.72, s * 0.15, 'F');
  doc.circle(x + s * 0.74, y + s * 0.72, s * 0.15, 'F');
  doc.setFillColor(...color);
  doc.circle(x + s * 0.26, y + s * 0.72, s * 0.08, 'F');
  doc.circle(x + s * 0.74, y + s * 0.72, s * 0.08, 'F');
}


function star(doc, cx, cy, radius, color = COLORS.navy) {
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const distance = index % 2 === 0 ? radius : radius * 0.44;
    const angle = (Math.PI / 180) * (90 + index * 36);
    points.push([cx + distance * Math.cos(angle), cy - distance * Math.sin(angle)]);
  }
  const segments = points.slice(1).map((point, index) => [point[0] - points[index][0], point[1] - points[index][1]]);
  doc.setFillColor(...color);
  doc.lines(segments, points[0][0], points[0][1], [1, 1], 'F', true);
}

// Texto curvado sobre la circunferencia del timbre.
function arcText(doc, text, cx, cy, radius, { bottom = false, spacing = 1.25 } = {}) {
  const chars = [...String(text)];
  const widths = chars.map((char) => doc.getTextWidth(char) * spacing);
  const toDegrees = (length) => (length / radius) * (180 / Math.PI);
  const totalDegrees = toDegrees(widths.reduce((sum, width) => sum + width, 0));
  const center = bottom ? 270 : 90;
  let cursor = bottom ? center - totalDegrees / 2 : center + totalDegrees / 2;

  chars.forEach((char, index) => {
    const charDegrees = toDegrees(widths[index]);
    const alpha = bottom ? cursor + charDegrees / 2 : cursor - charDegrees / 2;
    const angle = bottom ? alpha + 90 : alpha - 90;
    const radians = (alpha * Math.PI) / 180;
    const angleRadians = (angle * Math.PI) / 180;
    const halfWidth = doc.getTextWidth(char) / 2;
    const x = cx + radius * Math.cos(radians) - halfWidth * Math.cos(angleRadians);
    const y = cy - radius * Math.sin(radians) + halfWidth * Math.sin(angleRadians);
    doc.text(char, x, y, { angle });
    cursor = bottom ? cursor + charDegrees : cursor - charDegrees;
  });
}

function drawStamp(doc, logoDataUrl, cx, cy, radius = 15.5) {
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.7);
  doc.circle(cx, cy, radius, 'S');
  doc.setLineWidth(0.3);
  doc.circle(cx, cy, radius - 2.4, 'S');

  setText(doc, COLORS.navy, 4.3, 'bold');
  arcText(doc, 'VALIDEZ EXCLUSIVA EN PLATAFORMA', cx, cy, radius - 4.4);
  arcText(doc, 'WWW.REPUESTOP.CL · PAGO SEGURO', cx, cy, radius - 4.4, { bottom: true });

  star(doc, cx - radius + 3.2, cy + 6.2, 1.0);
  star(doc, cx + radius - 3.2, cy + 6.2, 1.0);

  if (!addContainedImage(doc, logoDataUrl, cx - 8, cy - 6, 16, 7)) {
    setText(doc, COLORS.navy, 8, 'bold');
    doc.text('RepuesTop', cx, cy - 1, { align: 'center' });
  }
  setText(doc, COLORS.navy, 6, 'bold');
  doc.text('COMPRA PROTEGIDA', cx, cy + 3.8, { align: 'center' });
}

export function quoteDocumentFilename(conversationId) {
  return `Cotizacion_RepuesTop_${String(conversationId || '').padStart(4, '0')}.pdf`;
}

export async function buildQuotePdfBlob({
  conversationId,
  quote,
  productName,
  storeName,
  storeTaxId,
  storeGiro,
  storeAddress,
  storeCity,
  storePhone,
  storeEmail,
  storeHours,
  buyerName,
  vehicleConsulted,
  storeLogoUrl,
  platformLogoUrl = '/repuestop_icon.png',
  stampLogoUrl = '/repuestop_icon.png',
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const total = Number(quote?.precioFinal ?? quote?.precio ?? 0);
  const unitPrice = Number(quote?.precioUnitario ?? total);
  const discount = Number(quote?.descuento || 0);
  const quantity = quote?.cantidad || '1 unidad';
  const subtotal = Math.max(0, total + discount);
  const [storeLogo, platformLogo, stampLogo] = await Promise.all([
    loadStoreLogo(storeLogoUrl),
    urlToDataUrl(platformLogoUrl).catch(() => null),
    urlToDataUrl(stampLogoUrl).catch(() => null),
  ]);

  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, 210, 297, 'F');

  // Cabecera institucional y metadatos.
  addContainedImage(doc, platformLogo, 11, 15, 30, 30);
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.45);
  doc.line(44, 16, 44, 45);
  setText(doc, COLORS.navy, 9.2, 'bold');
  doc.text('SISTEMA DE COTIZACIÓN', 49, 25);
  setText(doc, COLORS.text, 10.5, 'bold');
  doc.text('Repues', 49, 32);
  setText(doc, COLORS.blue, 10.5, 'bold');
  doc.text('Top', 49 + doc.getTextWidth('Repues'), 32);
  setText(doc, COLORS.text, 8.3);
  doc.text(['Soluciones confiables para', 'tu taller automotriz.'], 49, 38, { lineHeightFactor: 1.35 });
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(101, 12, 101, 49);

  setText(doc, COLORS.navy, 23, 'bold');
  doc.text('COTIZACIÓN', 119, 21);
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.35);
  doc.line(119, 24.5, 192, 24.5);
  setText(doc, COLORS.text, 9.2, 'bold');
  doc.text(`Cotización N° ${conversationId}`, 119, 30.5);
  doc.text('Fecha: ', 119, 36);
  setText(doc, COLORS.blue, 9.2, 'bold');
  doc.text(shortDate(quote?.createdAt), 119 + doc.getTextWidth('Fecha:  '), 36);

  // Badge institucional de Validez Exclusiva en cabecera
  doc.setFillColor(...COLORS.pale);
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.25);
  doc.roundedRect(119, 39.5, 78, 12, 1.2, 1.2, 'FD');
  shieldIcon(doc, 121, 41.5, 4.2, COLORS.blue);
  setText(doc, COLORS.navy, 6.8, 'bold');
  doc.text('VÁLIDA EXCLUSIVAMENTE EN REPUESTOP', 127, 44.5);
  setText(doc, COLORS.muted, 5.8);
  doc.text('Precios preferenciales y garantía legal vinculantes solo en plataforma.', 127, 48);
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.75);
  doc.line(7, 57, 203, 57);

  // Datos generales de proveedor y comprador.
  sectionTitle(doc, 'DATOS GENERALES', 64);
  const cardY = 70;
  const cardHeight = 51;
  roundedCard(doc, 13, cardY, 91, cardHeight);
  roundedCard(doc, 107, cardY, 90, cardHeight);
  cardBanner(doc, 13, cardY, 91, 'PROVEEDOR / EMISOR', storeIcon);
  cardBanner(doc, 107, cardY, 90, 'COMPRADOR / CLIENTE', personIcon);

  // Logo de la tienda (en la cabecera del card de proveedor)
  const logoCenter = [23.5, cardY + 16.5];
  const logoRadius = 6;
  const logoX = logoCenter[0] - logoRadius;
  const logoY = logoCenter[1] - logoRadius;
  const logoSize = logoRadius * 2;
  if (addContainedImage(doc, storeLogo, logoX, logoY, logoSize, logoSize)) {
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.4);
    doc.circle(logoCenter[0], logoCenter[1], logoRadius, 'S');
  } else {
    doc.setDrawColor(...COLORS.border);
    doc.setFillColor(...COLORS.pale);
    doc.setLineWidth(0.3);
    doc.circle(logoCenter[0], logoCenter[1], logoRadius, 'FD');
    storeIcon(doc, logoX + 1.8, logoY + 1.8, logoSize - 3.6, COLORS.blue);
  }

  // Cabecera de la tienda (junto al logo)
  const storeHeaderX = 33;
  setText(doc, COLORS.navy, 9.5, 'bold');
  const storeNameLines = split(doc, storeName || 'Tienda RepuesTop', 68);
  doc.text(storeNameLines[0], storeHeaderX, cardY + 13.5);

  setText(doc, COLORS.text, 7.5, 'bold');
  doc.text('RUT: ', storeHeaderX, cardY + 18);
  setText(doc, COLORS.navy, 7.5, 'bold');
  const rutFormatted = storeTaxId ? formatRut(storeTaxId) : 'No informado';
  const rutWidth = doc.getTextWidth(rutFormatted);
  const rutLabelWidth = doc.getTextWidth('RUT: ');
  doc.text(rutFormatted, storeHeaderX + rutLabelWidth, cardY + 18);

  // Badge de verificación
  const badgeShieldX = storeHeaderX + rutLabelWidth + rutWidth + 3.5;
  shieldIcon(doc, badgeShieldX, cardY + 15.6, 3, COLORS.green);
  setText(doc, COLORS.green, 6.8, 'bold');
  doc.text('Verificada', badgeShieldX + 4.2, cardY + 18);

  setText(doc, COLORS.muted, 6.8);
  const giroClean = storeGiro || 'Venta y distribución de repuestos automotrices';
  doc.text(split(doc, `Giro: ${giroClean}`, 68)[0], storeHeaderX, cardY + 22);

  // Línea divisoria interior
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(16, cardY + 24.5, 101, cardY + 24.5);

  // Rejilla de información de contacto y ubicación
  // Fila 1: Dirección
  mapPinIcon(doc, 16.5, cardY + 26.8, 3.4, COLORS.brightBlue);
  setText(doc, COLORS.text, 7.2, 'bold');
  doc.text('Dirección:', 22, cardY + 29.5);
  setText(doc, COLORS.text, 7.0);
  const fullAddress = [storeAddress, storeCity].filter(Boolean).join(', ') || 'Casa matriz / Despacho a todo Chile';
  doc.text(split(doc, fullAddress, 63)[0], 36, cardY + 29.5);

  // Fila 2: Contacto
  phoneIcon(doc, 16.5, cardY + 32.3, 3.4, COLORS.brightBlue);
  setText(doc, COLORS.text, 7.2, 'bold');
  doc.text('Contacto:', 22, cardY + 35);
  const contactChannel = storePhone ? `Chat RepuesTop · Posventa: ${storePhone}` : 'Chat y mensajería oficial RepuesTop';
  const contactText = storeEmail ? `${contactChannel} (${storeEmail})` : contactChannel;
  doc.text(split(doc, contactText, 63)[0], 36, cardY + 35);

  // Fila 3: Horario
  clockIcon(doc, 16.5, cardY + 37.8, 3.4, COLORS.brightBlue);
  setText(doc, COLORS.text, 7.2, 'bold');
  doc.text('Horario:', 22, cardY + 40.5);
  setText(doc, COLORS.text, 7.0);
  const fullHours = storeHours || 'Lunes a Viernes 08:30 - 18:30 hrs';
  doc.text(split(doc, fullHours, 63)[0], 36, cardY + 40.5);

  // Fila 4: Distintivo de acreditación
  shieldIcon(doc, 16.5, cardY + 43.3, 3.4, COLORS.green);
  setText(doc, COLORS.green, 6.8, 'bold');
  doc.text('Tienda adherida al programa Transacción Protegida RepuesTop', 22, cardY + 46);

  // Tarjeta COMPRADOR / CLIENTE
  const buyerCenter = [117.5, cardY + 16.5];
  const buyerRadius = 6;
  doc.setDrawColor(...COLORS.border);
  doc.setFillColor(...COLORS.pale);
  doc.setLineWidth(0.3);
  doc.circle(buyerCenter[0], buyerCenter[1], buyerRadius, 'FD');
  personIcon(doc, buyerCenter[0] - 3.4, buyerCenter[1] - 3.4, 6.8, COLORS.navy);

  const buyerHeaderX = 127;
  setText(doc, COLORS.navy, 9.5, 'bold');
  doc.text(split(doc, buyerName || 'Comprador RepuesTop', 68)[0], buyerHeaderX, cardY + 13.5);

  setText(doc, COLORS.text, 7.5, 'bold');
  doc.text('Cliente: ', buyerHeaderX, cardY + 18);
  const clientWidth = doc.getTextWidth('Cliente: ');
  shieldIcon(doc, buyerHeaderX + clientWidth + 0.5, cardY + 15.6, 3, COLORS.green);
  setText(doc, COLORS.green, 7.0, 'bold');
  doc.text('Usuario Verificado', buyerHeaderX + clientWidth + 4.5, cardY + 18);

  setText(doc, COLORS.muted, 6.8);
  doc.text(`Solicitud de cotización vía chat #${conversationId}`, buyerHeaderX, cardY + 22);

  // Línea divisoria interior comprador
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(110, cardY + 24.5, 194, cardY + 24.5);

  // Rejilla de información del comprador y solicitud
  // Fila 1: Vehículo consultado
  carIcon(doc, 110.5, cardY + 26.8, 3.4, COLORS.brightBlue);
  setText(doc, COLORS.text, 7.2, 'bold');
  doc.text('Vehículo:', 116, cardY + 29.5);
  setText(doc, COLORS.text, 7.0);
  const vehicleText = vehicleConsulted || 'Repuesto de catálogo / universal';
  doc.text(split(doc, vehicleText, 60)[0], 130, cardY + 29.5);

  // Fila 2: Modalidad de entrega
  truckIcon(doc, 110.5, cardY + 32.3, 3.4, COLORS.brightBlue);
  setText(doc, COLORS.text, 7.2, 'bold');
  doc.text('Entrega:', 116, cardY + 35);
  setText(doc, COLORS.text, 7.0);
  const deliveryText = quote?.condicionesEntrega || 'A convenir con la tienda';
  doc.text(split(doc, deliveryText, 60)[0], 130, cardY + 35);

  // Fila 3: Garantía
  shieldIcon(doc, 110.5, cardY + 37.8, 3.4, COLORS.brightBlue);
  setText(doc, COLORS.text, 7.2, 'bold');
  doc.text('Garantía:', 116, cardY + 40.5);
  setText(doc, COLORS.text, 7.0);
  doc.text(split(doc, quote?.garantia || 'Garantía legal / del fabricante', 60)[0], 130, cardY + 40.5);

  // Fila 4: Compra protegida
  shieldIcon(doc, 110.5, cardY + 43.3, 3.4, COLORS.green);
  setText(doc, COLORS.green, 6.8, 'bold');
  doc.text('Garantía y mediación válidas exclusivamente por RepuesTop', 116, cardY + 46);

  // Tabla de detalle y resumen monetario.
  sectionTitle(doc, 'DETALLE DE LA COTIZACIÓN', 126);
  const columns = [13, 60, 91, 128, 164, 197];
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(13, 134, 184, 9, 1.2, 1.2, 'F');
  ['Descripción', 'Cantidad', 'Precio unitario', 'Descuento', 'Total'].forEach((label, index) => {
    setText(doc, COLORS.white, 7.8, 'bold');
    doc.text(label, (columns[index] + columns[index + 1]) / 2, 139.7, { align: 'center' });
  });
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.rect(13, 143, 184, 12, 'S');
  columns.slice(1, -1).forEach((x) => doc.line(x, 134, x, 155));
  const cells = [productName || 'Producto cotizado', quantity, money(unitPrice), money(discount), money(total)];
  cells.forEach((value, index) => {
    setText(doc, COLORS.text, index === 0 ? 7.8 : 7.5);
    const text = split(doc, value, columns[index + 1] - columns[index] - 4).slice(0, 2);
    doc.text(text, (columns[index] + columns[index + 1]) / 2, 149.7 - ((text.length - 1) * 1.7), { align: 'center', lineHeightFactor: 1.2 });
  });

  roundedCard(doc, 96, 162, 101, 27, COLORS.pale);
  const totalRows = [
    ['Subtotal:', money(subtotal), COLORS.text],
    ['Descuento:', `-${money(discount)}`, COLORS.red],
  ];
  totalRows.forEach(([label, value, color], index) => {
    const y = 168 + index * 7;
    setText(doc, COLORS.text, 8, 'bold');
    doc.text(label, 101, y);
    setText(doc, color, 8);
    doc.text(value, 192, y, { align: 'right' });
  });
  doc.setDrawColor(...COLORS.border);
  doc.line(98, 177.5, 195, 177.5);
  setText(doc, COLORS.navy, 9.4, 'bold');
  doc.text('TOTAL COTIZADO:', 101, 185);
  setText(doc, COLORS.navy, 13.5, 'bold');
  doc.text(money(total), 192, 185, { align: 'right' });

  // Condiciones y notas de la propuesta.
  sectionTitle(doc, 'CONDICIONES DE LA COTIZACIÓN', 198);
  const conditions = [
    [boxIcon, 'Disponibilidad:', quote?.disponibilidad || 'No informada'],
    [truckIcon, 'Condiciones de entrega:', quote?.condicionesEntrega || 'A convenir'],
    [shieldIcon, 'Garantía:', quote?.garantia || 'No informada'],
    [clockIcon, 'Vigencia:', quote?.vigencia || 'No informada'],
  ];
  conditions.forEach(([drawIcon, label, value], index) => {
    const y = 207 + index * 8;
    drawIcon(doc, 15.5, y - 4.6, 5.2, COLORS.brightBlue);
    setText(doc, COLORS.text, 8.2, 'bold');
    doc.text(label, 26, y);
    setText(doc, COLORS.text, 8.2);
    doc.text(split(doc, value, 105)[0], 77, y);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.25);
    doc.line(15, y + 2.2, 195, y + 2.2);
  });
  if (quote?.notas) {
    setText(doc, COLORS.text, 7.5, 'bold');
    doc.text('Nota adicional:', 15, 242);
    setText(doc, COLORS.muted, 7.3);
    doc.text(split(doc, quote.notas, 148).slice(0, 2), 38, 242, { lineHeightFactor: 1.25 });
  }

  // Certificación, timbre y cláusula de validez exclusiva.
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.4);
  doc.line(7, 248, 203, 248);

  // Sello / Timbre oficial en el cuadrante izquierdo
  const stampCx = 35;
  const stampCy = 266;
  drawStamp(doc, stampLogo, stampCx, stampCy, 15);

  // Separador vertical sutil
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.line(57, 251, 57, 281);

  // Módulo Institucional de Validez Exclusiva y Compra Protegida
  const clauseX = 61;
  const clauseWidth = 142;
  const clauseY = 250.5;
  const clauseHeight = 31.5;

  doc.setFillColor(...COLORS.pale);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(clauseX, clauseY, clauseWidth, clauseHeight, 1.5, 1.5, 'FD');

  // Franja decorativa izquierda en azul institucional
  doc.setFillColor(...COLORS.blue);
  doc.rect(clauseX, clauseY, 2.2, clauseHeight, 'F');

  // Encabezado del módulo
  shieldIcon(doc, clauseX + 4.5, clauseY + 2.2, 3.8, COLORS.blue);
  setText(doc, COLORS.navy, 7.8, 'bold');
  doc.text('CLÁUSULA DE VALIDEZ EXCLUSIVA Y COMPRA PROTEGIDA', clauseX + 9.5, clauseY + 5.2);

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(clauseX + 4.5, clauseY + 7.5, clauseX + clauseWidth - 4.5, clauseY + 7.5);

  // Cláusula 1: Validez de precios y exclusividad comercial
  setText(doc, COLORS.text, 6.3, 'bold');
  doc.text('Validez comercial y precios:', clauseX + 5, clauseY + 11.2);
  setText(doc, COLORS.text, 6.1);
  const p1 = 'Precios preferenciales, descuentos y disponibilidad rigen y son exigibles ÚNICAMENTE mediante orden pagada en la plataforma RepuesTop (Ley N° 19.496). Esta cotización carece de validez legal para compra o liquidación directa fuera del sistema.';
  doc.text(p1, clauseX + 5, clauseY + 14.5, { maxWidth: clauseWidth - 10, lineHeightFactor: 1.25 });

  // Cláusula 2: Garantías y mediación técnica
  setText(doc, COLORS.text, 6.3, 'bold');
  doc.text('Garantía y mediación:', clauseX + 5, clauseY + 21.5);
  setText(doc, COLORS.text, 6.1);
  const p2 = 'La verificación de compatibilidad vehicular, derecho a devolución y mediación operan solo para transacciones completadas en RepuesTop. Compras por fuera anulan la garantía y el seguro de compra protegida.';
  doc.text(p2, clauseX + 5, clauseY + 24.8, { maxWidth: clauseWidth - 10, lineHeightFactor: 1.25 });

  // Nota de seguridad y enlace de activación
  setText(doc, COLORS.navy, 6.4, 'bold');
  doc.text('Para concretar tu compra protegida con boleta o factura ingresa a tu cuenta en www.repuestop.cl', clauseX + 5, clauseY + 29.5);

  // Línea final y pie de página
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.65);
  doc.line(7, 286.5, 203, 286.5);
  setText(doc, COLORS.navy, 7.2);
  doc.text('RepuesTop - Tu marketplace de repuestos automotrices · Compra Protegida y Garantizada', 105, 290.5, { align: 'center' });
  setText(doc, COLORS.navy, 7.2, 'bold');
  doc.text('www.repuestop.cl', 105, 293.8, { align: 'center' });

  return doc.output('blob');
}
