/**
 * Base de datos y resolución de orientación referencial de marcas de repuestos automotrices.
 * Modela el origen corporativo, posicionamiento general y sitio oficial para informar
 * al comprador de forma transparente y amigable antes de su compra.
 */

export const BRAND_COLORS = ['#155EEF', '#0E9384', '#7A5AF8', '#B54708', '#C11574', '#067647', '#2563EB', '#D97706'];

export function getBrandColor(brandName = '') {
  const clean = String(brandName || '').trim();
  if (!clean) return BRAND_COLORS[0];
  const hash = Array.from(clean).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return BRAND_COLORS[hash % BRAND_COLORS.length];
}

export function getBrandInitials(brandName = '') {
  const clean = String(brandName || '').trim();
  if (!clean) return 'M';
  const parts = clean.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * Catálogo de referencia de marcas frecuentes en el mercado automotriz chileno y global.
 * Funciona en armonía con los datos servidos por el backend (`RT_marca_repuesto`),
 * sirviendo de respaldo enriquecido inmediato.
 */
export const POPULAR_BRANDS_GUIDANCE = {
  'bosch': {
    nombre: 'Bosch',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Proveedor global líder en equipo original y aftermarket automotriz. Reconocido por sus sistemas de inyección, frenos, encendido, sensores y componentes eléctricos de alta ingeniería.',
    fuenteUrl: 'https://www.boschaftermarket.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.boschaftermarket.com&sz=128',
  },
  'brembo': {
    nombre: 'Brembo',
    paisOrigen: 'Italia',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Especialista de prestigio mundial en sistemas de frenos de alto rendimiento, tanto para fabricantes de equipo original (OEM) como para el mercado de recambio y competición.',
    fuenteUrl: 'https://www.bremboparts.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.bremboparts.com&sz=128',
  },
  'mann-filter': {
    nombre: 'Mann-Filter',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Especialista global en filtración automotriz (aceite, aire, combustible y habitáculo). Fabricante directo para las principales marcas de vehículos a nivel mundial.',
    fuenteUrl: 'https://www.mann-filter.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.mann-filter.com&sz=128',
  },
  'mann filter': {
    nombre: 'Mann-Filter',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Especialista global en filtración automotriz (aceite, aire, combustible y habitáculo). Fabricante directo para las principales marcas de vehículos a nivel mundial.',
    fuenteUrl: 'https://www.mann-filter.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.mann-filter.com&sz=128',
  },
  'valeo': {
    nombre: 'Valeo',
    paisOrigen: 'Francia',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Proveedor tecnológico multinacional de equipo original y aftermarket en sistemas de embrague, climatización, iluminación, limpiaparabrisas y sistemas eléctricos.',
    fuenteUrl: 'https://www.valeoservice.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.valeoservice.com&sz=128',
  },
  'hella': {
    nombre: 'Hella',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Especialista global líder en iluminación automotriz, ópticas, electrónica y sensores para vehículos comerciales y de pasajeros, con estándares de equipo original.',
    fuenteUrl: 'https://www.hella.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.hella.com&sz=128',
  },
  'depo': {
    nombre: 'Depo',
    paisOrigen: 'Taiwán',
    calidadReferencial: 'Aftermarket certificado',
    descripcionCalidad: 'Uno de los mayores fabricantes mundiales de focos, faros y componentes ópticos para reposición automotriz. Cumple certificaciones internacionales SAE, DOT y E-Mark.',
    fuenteUrl: 'https://www.depoautolamp.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.depoautolamp.com&sz=128',
  },
  'febi': {
    nombre: 'Febi',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Aftermarket premium (Bilstein Group)',
    descripcionCalidad: 'Marca alemana pionera del grupo Ferdinand Bilstein con más de 175 años de trayectoria. Fabricante de repuestos de alta precisión para dirección, suspensión, frenos y motor.',
    fuenteUrl: 'https://partsfinder.bilsteingroup.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.bilsteingroup.com&sz=128',
  },
  'bilstein': {
    nombre: 'Bilstein',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Aftermarket premium',
    descripcionCalidad: 'Especialista legendario en amortiguación y suspensión para autos de calle y alta competición. Reconocido internacionalmente por su precisión y durabilidad.',
    fuenteUrl: 'https://bilstein.com/en/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=bilstein.com&sz=128',
  },
  'denso': {
    nombre: 'Denso',
    paisOrigen: 'Japón',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Proveedor japonés de referencia para las principales marcas asiáticas y globales en bujías, alternadores, motores de arranque, compresión de A/C y radiadores.',
    fuenteUrl: 'https://www.denso-am.eu/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.denso-am.eu&sz=128',
  },
  'ngk': {
    nombre: 'NGK',
    paisOrigen: 'Japón',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Especialista número uno mundial en bujías de encendido, calentadores diésel y sondas lambda (NTK), presente de fábrica en la gran mayoría de fabricantes.',
    fuenteUrl: 'https://www.ngkntk.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.ngkntk.com&sz=128',
  },
  'kyb': {
    nombre: 'KYB',
    paisOrigen: 'Japón',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Uno de los mayores fabricantes mundiales de amortiguadores y sistemas hidráulicos. 1 de cada 4 autos nuevos que salen de fábrica en el mundo incorpora KYB.',
    fuenteUrl: 'https://www.kyb.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.kyb.com&sz=128',
  },
  'monroe': {
    nombre: 'Monroe',
    paisOrigen: 'Estados Unidos',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Marca icónica del grupo Tenneco en suspensión y amortiguadores para vehículos livianos y pesados, ofreciendo seguridad y estabilidad de marcha.',
    fuenteUrl: 'https://www.monroe.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.monroe.com&sz=128',
  },
  'gates': {
    nombre: 'Gates',
    paisOrigen: 'Estados Unidos',
    calidadReferencial: 'Aftermarket premium',
    descripcionCalidad: 'Líder en correas de distribución, correas auxiliares Poly-V, mangueras y kits de transmisión de potencia para equipo original y recambio.',
    fuenteUrl: 'https://www.gates.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.gates.com&sz=128',
  },
  'skf': {
    nombre: 'SKF',
    paisOrigen: 'Suecia',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Referente mundial en rodamientos, masas de rueda, retenes y soluciones de distribución con altísimos estándares de tolerancia y calidad.',
    fuenteUrl: 'https://vehicleaftermarket.skf.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=vehicleaftermarket.skf.com&sz=128',
  },
  'luk': {
    nombre: 'LuK',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Marca del grupo Schaeffler especializada en sistemas de embrague, volantes bimasa (DMF) y componentes de transmisión para fabricantes y recambio.',
    fuenteUrl: 'https://www.schaeffler-aftermarket.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.schaeffler-aftermarket.com&sz=128',
  },
  'mahle': {
    nombre: 'Mahle',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Proveedor global en componentes de motor (pistones, válvulas, camisas), termostatos y sistemas de filtración para equipo original y aftermarket.',
    fuenteUrl: 'https://www.mahle-aftermarket.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.mahle-aftermarket.com&sz=128',
  },
  'sachs': {
    nombre: 'Sachs',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Marca del grupo ZF especializada en embragues y amortiguadores de alta resistencia para equipo original y aftermarket.',
    fuenteUrl: 'https://aftermarket.zf.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=aftermarket.zf.com&sz=128',
  },
  'trw': {
    nombre: 'TRW',
    paisOrigen: 'Estados Unidos / Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Marca del grupo ZF enfocada en seguridad activa: sistemas de freno, pastillas, discos, rótulas, terminales de dirección y suspensión.',
    fuenteUrl: 'https://aftermarket.zf.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=aftermarket.zf.com&sz=128',
  },
  'acdelco': {
    nombre: 'ACDelco',
    paisOrigen: 'Estados Unidos',
    calidadReferencial: 'Repuesto original / gama alta',
    descripcionCalidad: 'Línea de repuestos oficial de General Motors para Chevrolet y multimarca, con cobertura completa en frenos, baterías, filtros y suspensión.',
    fuenteUrl: 'https://www.acdelco.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.acdelco.com&sz=128',
  },
  'varta': {
    nombre: 'Varta',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Batería de gama reconocida',
    descripcionCalidad: 'Marca alemana líder en acumuladores de energía, tecnología AGM y baterías Start-Stop para vehículos modernos.',
    fuenteUrl: 'https://www.varta-automotive.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.varta-automotive.com&sz=128',
  },
  'liqui moly': {
    nombre: 'Liqui Moly',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Lubricante premium',
    descripcionCalidad: 'Especialista alemán en aceites de motor, aditivos y productos de cuidado automotriz con homologaciones de los principales constructores alemanes.',
    fuenteUrl: 'https://www.liqui-moly.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.liqui-moly.com&sz=128',
  },
  'motul': {
    nombre: 'Motul',
    paisOrigen: 'Francia',
    calidadReferencial: 'Lubricante premium',
    descripcionCalidad: 'Marca francesa de lubricantes sintéticos de alto desempeño, reconocida por su tecnología Ester Core y presencia en competición.',
    fuenteUrl: 'https://www.motul.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.motul.com&sz=128',
  },
  'castrol': {
    nombre: 'Castrol',
    paisOrigen: 'Reino Unido',
    calidadReferencial: 'Lubricante de gama reconocida',
    descripcionCalidad: 'Marca internacional de lubricantes automotrices e industriales, con homologaciones y alianzas con fabricantes automotrices mundiales.',
    fuenteUrl: 'https://www.castrol.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.castrol.com&sz=128',
  },
  'mobil': {
    nombre: 'Mobil',
    paisOrigen: 'Estados Unidos',
    calidadReferencial: 'Lubricante premium',
    descripcionCalidad: 'Marca de lubricantes sintéticos y minerales (Mobil 1) con amplia trayectoria y homologaciones de fabricantes internacionales.',
    fuenteUrl: 'https://mobil.copec.cl/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=mobil.copec.cl&sz=128',
  },
  'tyc': {
    nombre: 'TYC',
    paisOrigen: 'Taiwán',
    calidadReferencial: 'Aftermarket certificado',
    descripcionCalidad: 'Fabricante de iluminación, espejos y componentes térmicos para el mercado de recambio, certificado bajo normativas ISO y SAE/DOT.',
    fuenteUrl: 'https://www.tyc.com.tw/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.tyc.com.tw&sz=128',
  },
  'delphi': {
    nombre: 'Delphi',
    paisOrigen: 'Estados Unidos / Reino Unido',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Pionero en inyección diésel y gasolina, bobinas de encendido, bombas de combustible, sensores de gestión de motor y frenos.',
    fuenteUrl: 'https://www.delphiautoparts.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.delphiautoparts.com&sz=128',
  },
  'ferodo': {
    nombre: 'Ferodo',
    paisOrigen: 'Reino Unido',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Especialista histórico en fricción y pastillas de freno para equipo original y mercado de recambio, sinónimo de seguridad en frenado.',
    fuenteUrl: 'https://www.ferodo.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.ferodo.com&sz=128',
  },
  'lpr': {
    nombre: 'LPR',
    paisOrigen: 'Italia',
    calidadReferencial: 'Aftermarket reconocido',
    descripcionCalidad: 'Fabricante italiano especializado en componentes hidráulicos de freno (cilindros de freno, bombas de embrague) y pastillas.',
    fuenteUrl: 'https://www.lpr.it/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.lpr.it&sz=128',
  },
  'aisin': {
    nombre: 'Aisin',
    paisOrigen: 'Japón',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Filial del grupo Toyota y mayor fabricante mundial de transmisiones automáticas, embragues y bombas de agua para equipo original.',
    fuenteUrl: 'https://www.aisinaftermarket.jp/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.aisinaftermarket.jp&sz=128',
  },
  'ate': {
    nombre: 'ATE',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Marca del grupo Continental, referente mundial en sistemas de frenos hidráulicos, discos, pastillas de freno y líquido de frenos.',
    fuenteUrl: 'https://www.ate-brakes.com/',
    logoUrl: 'https://www.google.com/s2/favicons?domain=www.ate-brakes.com&sz=128',
  },
  'dayco': {
    nombre: 'Dayco',
    paisOrigen: 'Estados Unidos',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Líder global en diseño y fabricación de correas de distribución, correas de accesorios, tensores y poleas para automoción.',
    fuenteUrl: 'https://www.dayco.com/',
    logoUrl: '/brand-logos/dayco.svg',
  },
  'philips': {
    nombre: 'Philips',
    paisOrigen: 'Países Bajos',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Pionero mundial en iluminación automotriz, ampolletas halógenas, xenón y LED de máximo rendimiento y seguridad vial.',
    fuenteUrl: 'https://www.philips.cl/c-m-au/iluminacion-para-automoviles',
    logoUrl: '/brand-logos/philips.svg',
  },
  'osram': {
    nombre: 'Osram',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Especialista alemán líder en iluminación automotriz para fabricantes de equipo original y recambio de alta durabilidad.',
    fuenteUrl: 'https://www.osram.com/am/',
    logoUrl: '/brand-logos/osram.svg',
  },
  'continental': {
    nombre: 'Continental',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Corporación tecnológica alemana líder en neumáticos, correas de distribución, electrónica y sistemas de frenos.',
    fuenteUrl: 'https://www.continental-aftermarket.com/',
    logoUrl: '/brand-logos/continental.svg',
  },
  'wahler': {
    nombre: 'Wahler',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Especialista alemán en termostatos, válvulas EGR y sistemas de gestión térmica del motor (perteneciente a BorgWarner).',
    fuenteUrl: 'https://www.borgwarner.com/',
    logoUrl: '/brand-logos/autopart.svg',
  },
  'stabilus': {
    nombre: 'Stabilus',
    paisOrigen: 'Alemania',
    calidadReferencial: 'Proveedor OEM / gama alta',
    descripcionCalidad: 'Líder mundial en amortiguadores a gas y actuadores electromecánicos para capots, maleteros y portones traseros.',
    fuenteUrl: 'https://www.stabilus.com/',
    logoUrl: '/brand-logos/autopart.svg',
  },
  'toyota genuine': {
    nombre: 'Toyota Genuine',
    paisOrigen: 'Japón',
    calidadReferencial: 'Repuesto original (OEM)',
    descripcionCalidad: 'Repuestos genuinos de fábrica Toyota diseñados y fabricados con las tolerancias originales de fábrica para un ajuste y desempeño exactos.',
    fuenteUrl: 'https://www.toyota.com/owners/parts-service/parts',
    logoUrl: '/brand-logos/toyota.svg',
  },
  'toyota': {
    nombre: 'Toyota',
    paisOrigen: 'Japón',
    calidadReferencial: 'Repuesto original (OEM)',
    descripcionCalidad: 'Piezas genuinas del fabricante con certificación y especificaciones de equipo original.',
    fuenteUrl: 'https://www.toyota.com/',
    logoUrl: '/brand-logos/toyota.svg',
  },
};

export const LOCAL_BRAND_SVG_SLUGS = new Set([
  'bosch', 'brembo', 'valeo', 'hella', 'mann-filter', 'continental', 'philips', 'osram',
  'mahle', 'denso', 'ngk', 'castrol', 'mobil', 'monroe', 'febi', 'skf', 'delphi',
  'depo', 'tyc', 'gates', 'kyb', 'autopart',
  'toyota', 'chevrolet', 'nissan', 'hyundai', 'ford', 'bmw', 'audi', 'volkswagen',
  'kia', 'peugeot', 'renault', 'fiat', 'suzuki', 'subaru', 'mazda', 'honda', 'jeep',
  'volvo', 'citroen', 'mitsubishi', 'opel', 'seat', 'skoda', 'tesla'
]);

/**
 * Resuelve la URL del logo de la marca priorizando archivos vectoriales locales SVG
 * garantizados, antes de consultar URLs externas.
 */
export function getBrandLogoUrl(brandName = '', productData = {}) {
  const raw = String(brandName || productData.marca || productData.marcaRepuesto || '').trim();
  if (!raw) return null;

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const compact = slug.replace(/-/g, '');

  if (LOCAL_BRAND_SVG_SLUGS.has(slug)) {
    return `/brand-logos/${slug}.svg`;
  }
  if (LOCAL_BRAND_SVG_SLUGS.has(compact)) {
    return `/brand-logos/${compact}.svg`;
  }

  // Buscar en el catálogo enriquecido si tiene un logo local o específico
  const catalogEntry = POPULAR_BRANDS_GUIDANCE[normalized]
    || POPULAR_BRANDS_GUIDANCE[slug]
    || POPULAR_BRANDS_GUIDANCE[compact];

  if (catalogEntry?.logoUrl) {
    return catalogEntry.logoUrl;
  }

  if (productData.brandLogoUrl) {
    return productData.brandLogoUrl;
  }

  // Para marcas genéricas o no identificadas, se ofrece el isotipo de autopart
  return '/brand-logos/autopart.svg';
}

/**
 * Resuelve la información referencial de una marca para la ficha de producto.
 * Combina la información provista por el backend con el catálogo enriquecido cliente.
 */
export function resolveBrandGuidance(brandName = '', productData = {}) {
  const cleanName = String(brandName || productData.marca || productData.marcaRepuesto || '').trim();
  if (!cleanName) {
    return null;
  }

  const key = cleanName.toLowerCase();
  const catalogEntry = POPULAR_BRANDS_GUIDANCE[key]
    || POPULAR_BRANDS_GUIDANCE[key.replace(/\s+/g, '-')]
    || POPULAR_BRANDS_GUIDANCE[key.replace(/-/g, ' ')];

  const nombre = cleanName;
  const paisOrigen = productData.brandOrigin
    || catalogEntry?.paisOrigen
    || 'Información en revisión';
  const calidadReferencial = productData.brandQuality
    || catalogEntry?.calidadReferencial
    || 'Aftermarket verificado';
  const descripcionCalidad = productData.brandDescription
    || catalogEntry?.descripcionCalidad
    || `Marca registrada presente en el catálogo de RepuesTop. Consulta con el vendedor la procedencia y compatibilidad de la pieza antes de comprar.`;
  const logoUrl = getBrandLogoUrl(cleanName, productData);
  const fuenteUrl = productData.brandSourceUrl
    || catalogEntry?.fuenteUrl
    || null;

  return {
    nombre,
    paisOrigen,
    calidadReferencial,
    descripcionCalidad,
    logoUrl,
    fuenteUrl,
  };
}
