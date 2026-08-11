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

function tabTitle(doc, drawIcon, title, x, y, width) {
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(x, y, width, 8, 1.2, 1.2, 'F');
  drawIcon(doc, x + 3.4, y + 2, 4.2, COLORS.white);
  setText(doc, COLORS.white, 9.5, 'bold');
  doc.text(title, x + 11, y + 5.4);
}

function split(doc, value, width) {
  return doc.splitTextToSize(String(value || ''), width);
}

function loadImageElement(url, crossOrigin) {
  return new Promise((resolve, reject) => {
    const element = new Image();
    if (crossOrigin) element.crossOrigin = crossOrigin;
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    element.src = url;
  });
}

// Respaldo cuando `fetch` no puede leer el archivo (host sin CORS para XHR o
// respuesta protegida): el <img> sí lo carga y el canvas lo exporta.
async function imageElementToDataUrl(url) {
  if (typeof document === 'undefined') return null;
  const image = await loadImageElement(url, 'anonymous');
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

async function urlToDataUrl(url) {
  if (!url) return null;
  if (/^data:/i.test(url)) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo cargar la imagen (${response.status})`);
    const mime = response.headers.get('content-type') || 'image/png';
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return imageElementToDataUrl(url);
  }
}

// Recorta la imagen en un círculo (mismo encuadre que la foto de perfil de la tienda).
async function toCircularDataUrl(dataUrl, size = 512) {
  if (!dataUrl || typeof document === 'undefined') return dataUrl;
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.crossOrigin = 'anonymous';
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('No se pudo procesar el logo de la tienda'));
    element.src = dataUrl;
  });
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
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  context.restore();
  return canvas.toDataURL('image/png');
}

// El logo de la tienda siempre se registra en el PDF: si el recorte circular
// falla, se usa la imagen original en vez de perder el logo.
async function loadStoreLogo(url) {
  const dataUrl = await urlToDataUrl(url).catch(() => null);
  if (!dataUrl) return null;
  return toCircularDataUrl(dataUrl).catch(() => dataUrl);
}

function addContainedImage(doc, dataUrl, x, y, maxWidth, maxHeight, align = 'center') {
  if (!dataUrl) return false;
  try {
    const properties = doc.getImageProperties(dataUrl);
    const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height);
    const width = properties.width * ratio;
    const height = properties.height * ratio;
    const offsetX = align === 'left' ? 0 : (maxWidth - width) / 2;
    doc.addImage(dataUrl, properties.fileType, x + offsetX, y + (maxHeight - height) / 2, width, height, undefined, 'FAST');
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

function fileIcon(doc, x, y, s, color = COLORS.navy) {
  doc.setDrawColor(...color);
  doc.setLineWidth(s * 0.09);
  doc.lines(
    [[s * 0.52, 0], [s * 0.24, s * 0.24], [0, s * 0.76], [-s * 0.76, 0]],
    x + s * 0.12,
    y,
    [1, 1],
    'S',
    true,
  );
  doc.line(x + s * 0.64, y, x + s * 0.64, y + s * 0.24);
  doc.line(x + s * 0.64, y + s * 0.24, x + s * 0.88, y + s * 0.24);
  doc.line(x + s * 0.26, y + s * 0.46, x + s * 0.7, y + s * 0.46);
  doc.line(x + s * 0.26, y + s * 0.64, x + s * 0.7, y + s * 0.64);
  doc.line(x + s * 0.26, y + s * 0.82, x + s * 0.56, y + s * 0.82);
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

function drawStamp(doc, logoDataUrl, cx, cy, radius = 16.5) {
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.7);
  doc.circle(cx, cy, radius, 'S');
  doc.setLineWidth(0.3);
  doc.circle(cx, cy, radius - 2.6, 'S');

  setText(doc, COLORS.navy, 4.6, 'bold');
  arcText(doc, 'COTIZACIÓN PROCESADA POR', cx, cy, radius - 4.6);
  arcText(doc, 'SISTEMA REPUESTOP', cx, cy, radius - 4.6, { bottom: true });

  star(doc, cx - radius + 3.4, cy + 6.6, 1.1);
  star(doc, cx + radius - 3.4, cy + 6.6, 1.1);

  if (!addContainedImage(doc, logoDataUrl, cx - 8.5, cy - 6.4, 17, 7.4)) {
    setText(doc, COLORS.navy, 8.5, 'bold');
    doc.text('RepuesTop', cx, cy - 1, { align: 'center' });
  }
  setText(doc, COLORS.navy, 8.6, 'bold');
  doc.text('RepuesTop', cx, cy + 4, { align: 'center' });
}

export function quoteDocumentFilename(conversationId) {
  return `Cotizacion_RepuesTop_${String(conversationId || '').padStart(4, '0')}.pdf`;
}

export async function buildQuotePdfBlob({
  conversationId,
  quote,
  productName,
  storeName,
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

  setText(doc, COLORS.navy, 25, 'bold');
  doc.text('COTIZACIÓN', 121, 22);
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.35);
  doc.line(121, 27, 186, 27);
  setText(doc, COLORS.text, 10.5, 'bold');
  doc.text(`Cotización N° ${conversationId}`, 121, 35);
  doc.text('Fecha: ', 121, 42);
  setText(doc, COLORS.blue, 10.5, 'bold');
  doc.text(shortDate(quote?.createdAt), 121 + doc.getTextWidth('Fecha:  '), 42);
  setText(doc, COLORS.text, 7.8);
  doc.text(['Documento generado automáticamente por la', 'plataforma RepuesTop.'], 121, 48, { lineHeightFactor: 1.35 });
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.75);
  doc.line(7, 57, 203, 57);

  // Datos generales de proveedor y comprador.
  sectionTitle(doc, 'DATOS GENERALES', 66);
  roundedCard(doc, 13, 74, 91, 44);
  roundedCard(doc, 107, 74, 90, 44);
  tabTitle(doc, storeIcon, 'PROVEEDOR', 16, 71.5, 43);
  tabTitle(doc, personIcon, 'COMPRADOR', 110, 71.5, 43);

  // Logo circular de la tienda (misma foto que su perfil).
  const logoCenter = [58.5, 93.5];
  const logoRadius = 12.5;
  if (addContainedImage(doc, storeLogo, logoCenter[0] - logoRadius, logoCenter[1] - logoRadius, logoRadius * 2, logoRadius * 2)) {
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.circle(logoCenter[0], logoCenter[1], logoRadius, 'S');
  } else {
    doc.setDrawColor(...COLORS.border);
    doc.setFillColor(...COLORS.pale);
    doc.setLineWidth(0.4);
    doc.circle(logoCenter[0], logoCenter[1], logoRadius, 'FD');
    setText(doc, COLORS.muted, 7.6);
    doc.text('Logo de', logoCenter[0], logoCenter[1] - 0.5, { align: 'center' });
    doc.text('la tienda', logoCenter[0], logoCenter[1] + 3.5, { align: 'center' });
  }
  storeIcon(doc, 17.5, 108.6, 4.6);
  setText(doc, COLORS.text, 8.7, 'bold');
  doc.text('Tienda:', 24.5, 112);
  setText(doc, COLORS.navy, 8.7, 'bold');
  doc.text(split(doc, storeName || 'Tienda RepuesTop', 60)[0], 40, 112);

  const hasVehicle = Boolean(vehicleConsulted);
  const buyerRowY = hasVehicle ? 91 : 96;
  personIcon(doc, 113, buyerRowY - 5.4, 6.4);
  setText(doc, COLORS.text, 8.8, 'bold');
  doc.text('Comprador:', 122, buyerRowY);
  setText(doc, COLORS.navy, 8.8, 'bold');
  doc.text(split(doc, buyerName || 'Comprador RepuesTop', 48)[0], 144, buyerRowY);
  if (hasVehicle) {
    setText(doc, COLORS.text, 8.5, 'bold');
    doc.text('Vehículo consultado:', 122, 103);
    setText(doc, COLORS.navy, 8.5, 'bold');
    doc.text(split(doc, vehicleConsulted, 40)[0], 160, 103);
  }

  // Tabla de detalle y resumen monetario.
  sectionTitle(doc, 'DETALLE DE LA COTIZACIÓN', 128);
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
  sectionTitle(doc, 'CONDICIONES DE LA COTIZACIÓN', 199);
  const conditions = [
    [boxIcon, 'Disponibilidad:', quote?.disponibilidad || 'No informada'],
    [truckIcon, 'Condiciones de entrega:', quote?.condicionesEntrega || 'A convenir'],
    [shieldIcon, 'Garantía:', quote?.garantia || 'No informada'],
    [clockIcon, 'Vigencia:', quote?.vigencia || 'No informada'],
  ];
  conditions.forEach(([drawIcon, label, value], index) => {
    const y = 208 + index * 8;
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
    doc.text('Nota adicional:', 15, 244);
    setText(doc, COLORS.muted, 7.3);
    doc.text(split(doc, quote.notas, 148).slice(0, 2), 38, 244, { lineHeightFactor: 1.25 });
  }

  // Certificación, timbre y pie.
  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.4);
  doc.line(7, 251, 203, 251);
  drawStamp(doc, stampLogo, 52, 269);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.line(84, 256, 84, 282);
  doc.setFillColor(...COLORS.navy);
  doc.circle(96, 262, 4.6, 'F');
  fileIcon(doc, 93.4, 259.4, 5.2, COLORS.white);
  setText(doc, COLORS.navy, 9, 'bold');
  doc.text('Cotización procesada por RepuesTop', 104, 264);
  doc.setDrawColor(...COLORS.border);
  doc.line(92, 269, 173, 269);
  setText(doc, COLORS.text, 7.7);
  doc.text(['Esta cotización ha sido emitida a través de', 'la plataforma RepuesTop.'], 92, 276, { lineHeightFactor: 1.4 });
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.65);
  doc.line(7, 288, 203, 288);
  setText(doc, COLORS.navy, 7.2);
  doc.text('RepuesTop - Tu marketplace de repuestos automotrices', 105, 292, { align: 'center' });
  setText(doc, COLORS.navy, 7.2, 'bold');
  doc.text('www.repuestop.cl', 105, 295, { align: 'center' });

  return doc.output('blob');
}
