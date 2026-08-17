// Datos para el Mural de Anuncios Clasificados de Servicios Automotrices
export const SERVICE_CATEGORIES = [
  { id: 'TODAS', label: 'Todas las categorías', emoji: '🌟', count: 24 },
  { id: 'mecanica', label: 'Mecánica', emoji: '🔧', count: 8 },
  { id: 'electricidad-electronica', label: 'Electricidad y Electrónica', emoji: '🔌', count: 5 },
  { id: 'neumaticos', label: 'Neumáticos', emoji: '🛞', count: 4 },
  { id: 'asistencia-vehicular', label: 'Asistencia Vehicular', emoji: '🚨', count: 3 },
  { id: 'carroceria-pintura', label: 'Carrocería y Pintura', emoji: '🎨', count: 4 },
  { id: 'estetica-automotriz', label: 'Estética Automotriz', emoji: '✨', count: 4 },
  { id: 'climatizacion', label: 'Climatización', emoji: '❄️', count: 3 },
  { id: 'cerrajeria-seguridad', label: 'Cerrajería y Seguridad', emoji: '🔑', count: 2 },
  { id: 'servicios-inspeccion', label: 'Servicios de Inspección', emoji: '📋', count: 2 },
  { id: 'motos', label: 'Motos', emoji: '🏍️', count: 2 },
  { id: 'camiones-maquinaria', label: 'Camiones y Maquinaria', emoji: '🚚', count: 2 },
  { id: 'compra-venta-arriendo', label: 'Compra, Venta y Arriendo', emoji: '🚗', count: 2 },
  { id: 'servicios-domicilio', label: 'Servicios a Domicilio', emoji: '🏠', count: 3 },
  { id: 'otros-servicios', label: 'Otros Servicios Automotrices', emoji: '📦', count: 2 }
];

export const AD_TIERS = {
  basica: {
    id: 'basica',
    name: 'Básica',
    badge: 'Gratuito',
    badgeColor: '#64748b',
    maxImages: 2,
    hasWhatsapp: false,
    hasBooking: false,
    cardTheme: 'tier-basic',
    description: 'Publicación estándar con hasta 2 fotos, datos de contacto telefónico y dirección.'
  },
  destacada: {
    id: 'destacada',
    name: 'Destacada',
    badge: '⭐ Destacado',
    badgeColor: '#d97706',
    maxImages: 2,
    hasWhatsapp: false,
    hasBooking: false,
    cardTheme: 'tier-destacada',
    description: 'Mayor visibilidad con tarjeta en amarillo suave y etiqueta destacada.'
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    badge: '⚡ Premium',
    badgeColor: '#7c3aed',
    maxImages: 4,
    hasWhatsapp: true,
    hasBooking: false,
    cardTheme: 'tier-premium',
    description: 'Tarjeta en tono morado con botón de acceso rápido y directo a WhatsApp.'
  },
  empresarial: {
    id: 'empresarial',
    name: 'Empresarial',
    badge: '👑 Empresarial Verificado',
    badgeColor: '#059669',
    maxImages: 6,
    hasWhatsapp: true,
    hasBooking: true,
    cardTheme: 'tier-empresarial',
    description: 'Máxima categoría corporativa con agendamiento de citas en línea directo desde la plataforma.'
  }
};

export const CHILE_COMMUNES = [
  'Todas las comunas',
  'Santiago Centro',
  'Providencia',
  'Las Condes',
  'Ñuñoa',
  'Maipú',
  'San Miguel',
  'La Florida',
  'Puente Alto',
  'Quilicura',
  'Macul',
  'Huechuraba',
  'Viña del Mar',
  'Valparaíso',
  'Concepción',
  'Antofagasta',
  'Temuco',
  'Rancagua',
  'La Serena'
];

// Empresas destacadas para el carrusel superior estilo Instagram Stories
export const COMPANY_STORIES = [
  {
    id: 'story-bosch',
    companyName: 'Bosch Car Service',
    logo: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=150&auto=format&fit=crop&q=80',
    verified: true,
    category: 'Mecánica & Diagnóstico',
    phone: '+56 9 8452 1100',
    whatsapp: '56984521100',
    address: 'Av. Vitacura 4120, Vitacura',
    stories: [
      {
        id: 's1-1',
        type: 'promo',
        image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=900&auto=format&fit=crop&q=80',
        title: 'Diagnóstico Electrónico Computarizado',
        subtitle: 'Promoción de Temporada',
        description: 'Escaner original Bosch multimarca. Detección precisa de fallas en motor, ABS y transmisión.',
        offer: '20% OFF en tu primera mantención',
        tag: 'Tecnología Alemana',
        duration: 5000
      },
      {
        id: 's1-2',
        type: 'facility',
        image: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=900&auto=format&fit=crop&q=80',
        title: 'Taller de Alta Precisión',
        subtitle: 'Elevadores Hidráulicos & Sala de Espera VIP',
        description: 'Personal altamente capacitado y certificado por Bosch Alemania. Garantía escrita de 6 meses.',
        offer: 'Revisión preventiva de 25 puntos GRATIS',
        tag: 'Garantía Total',
        duration: 5000
      }
    ]
  },
  {
    id: 'story-glasurit',
    companyName: 'Pinturas & Desabolladura Glasurit',
    logo: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=150&auto=format&fit=crop&q=80',
    verified: true,
    category: 'Pintura & Carrocería',
    phone: '+56 9 9234 5678',
    whatsapp: '56992345678',
    address: 'Av. Vicuña Mackenna 7320, La Florida',
    stories: [
      {
        id: 's2-1',
        type: 'process',
        image: 'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=900&auto=format&fit=crop&q=80',
        title: 'Horno de Pintura Presurizado',
        subtitle: 'Acabado Original de Fábrica',
        description: 'Colorimetría computarizada exacta con pinturas hidrosolubles Glasurit BASF.',
        offer: 'Pulido cerámico de cortesía por paño completo',
        tag: 'Pintura Premium',
        duration: 5000
      },
      {
        id: 's2-2',
        type: 'before_after',
        image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&auto=format&fit=crop&q=80',
        title: 'Desabolladura sin Dañar Pintura (PDR)',
        subtitle: 'Reparación de Granizo y Golpes',
        description: 'Técnica de varillas alemanas que mantiene la originalidad del vehículo sin repintar.',
        offer: 'Presupuesto express por fotos en 15 min',
        tag: 'PDR Express',
        duration: 5000
      }
    ]
  },
  {
    id: 'story-midas',
    companyName: 'Midas Taller Integral',
    logo: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=150&auto=format&fit=crop&q=80',
    verified: true,
    category: 'Frenos & Suspensión',
    phone: '+56 9 7788 9900',
    whatsapp: '56977889900',
    address: 'Av. Manquehue Sur 520, Las Condes',
    stories: [
      {
        id: 's3-1',
        type: 'promo',
        image: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=900&auto=format&fit=crop&q=80',
        title: 'Especialistas en Frenos & Suspensión',
        subtitle: 'Seguridad para tu Familia',
        description: 'Cambio de pastillas, rectificado de discos, amortiguadores y líquido de frenos DOT 4/5.1.',
        offer: 'Test de frenado computarizado SIN COSTO',
        tag: 'Seguridad Vial',
        duration: 5000
      }
    ]
  },
  {
    id: 'story-detailing',
    companyName: 'Apex Ceramic Lab & Detailing',
    logo: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=150&auto=format&fit=crop&q=80',
    verified: true,
    category: 'Detailing & Estética',
    phone: '+56 9 6341 8822',
    whatsapp: '56963418822',
    address: 'Av. Kennedy 8800, Vitacura',
    stories: [
      {
        id: 's4-1',
        type: 'highlight',
        image: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=900&auto=format&fit=crop&q=80',
        title: 'Tratamiento Cerámico 9H Gyeon',
        subtitle: 'Brillo Extremo & Hidrofobia 3 Años',
        description: 'Corrección de laca en 3 etapas, eliminación de swirls y protección nanocerámica certificada.',
        offer: 'Tratamiento de llantas y vidrios GRATIS',
        tag: 'Gyeon Certified',
        duration: 5000
      }
    ]
  },
  {
    id: 'story-clima',
    companyName: 'ClimaCar Pro Santiago',
    logo: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=150&auto=format&fit=crop&q=80',
    verified: true,
    category: 'Aire Acondicionado',
    phone: '+56 9 5512 3456',
    whatsapp: '56955123456',
    address: 'Gran Avenida 4820, San Miguel',
    stories: [
      {
        id: 's5-1',
        type: 'promo',
        image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=900&auto=format&fit=crop&q=80',
        title: 'Carga de Gas Ecológico R134a & 1234yf',
        subtitle: 'Detección Láser de Fugas UV',
        description: 'Vaciado al vacío, reposición de aceite de compresor PAG y sanitización con ozono anti-bacterias.',
        offer: 'Sanitización de cabina GRATIS con la recarga',
        tag: 'Cero Malos Olores',
        duration: 5000
      }
    ]
  },
  {
    id: 'story-gruas',
    companyName: 'Rescate Vial 24/7 Chile',
    logo: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=150&auto=format&fit=crop&q=80',
    verified: true,
    category: 'Grúas & Asistencia',
    phone: '+56 9 4433 2211',
    whatsapp: '56944332211',
    address: 'Base Central Américo Vespucio Norte, Quilicura',
    stories: [
      {
        id: 's6-1',
        type: 'urgent',
        image: 'https://images.unsplash.com/photo-1562911791-c7a97b729ec5?w=900&auto=format&fit=crop&q=80',
        title: 'Grúas Hidráulicas Cama Baja 24 Horas',
        subtitle: 'Cobertura en Toda la RM y Regiones',
        description: 'Llegada promedio en 25 minutos. Grúas equipadas con seguro de carga hasta 500 UF.',
        offer: 'Tarifa preferencial para clientes RepuesTop',
        tag: 'Respuesta 25 min',
        duration: 5000
      }
    ]
  }
];

// Listado inicial de Anuncios Clasificados
export const INITIAL_CLASSIFIED_ADS = [
  // ===================== EMPRESARIAL =====================
  {
    id: 'ad-emp-01',
    tier: 'empresarial',
    title: 'Centro Automotriz Bosch Service - Mantención por Pauta & Escáner Oficial',
    company: 'Bosch Car Service Vitacura',
    category: 'mecanica',
    categoryLabel: 'Mecánica',
    description: 'Taller certificado con tecnología de diagnóstico alemana de última generación. Mantenciones por kilometraje sin perder garantía de fábrica, cambio de kit de distribución, embragues y frenos. Facturación electrónica inmediata y garantía por escrito.',
    priceType: 'quote',
    priceText: 'Desde $45.000 / Cotización',
    priceValue: 45000,
    region: 'Región Metropolitana',
    commune: 'Las Condes',
    address: 'Av. Vitacura 4120, Local 3',
    phone: '+56 2 2845 2100',
    whatsapp: '56984521100',
    openingHours: 'Lun a Vie 08:30 - 19:00 / Sáb 09:00 - 14:00',
    rating: 4.9,
    reviewsCount: 128,
    images: [
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Garantía 6 meses', 'Factura electrónica', 'Sala de espera con Wi-Fi', 'Repuestos certificados OEM'],
    servicesOffered: [
      'Mantención por kilometraje (10k, 20k, 50k, 100k)',
      'Diagnóstico computarizado por escáner Bosch KTS',
      'Cambio de pastillas y rectificado de discos de freno',
      'Reemplazo de kit de embrague y volante bimasa',
      'Cambio de correa o cadena de distribución'
    ],
    is24Hours: false,
    hasOnlineBooking: true,
    publishedAt: '2026-08-15'
  },
  {
    id: 'ad-emp-02',
    tier: 'empresarial',
    title: 'Glasurit Pro - Desabolladura y Pintura al Horno con Colorimetría Láser',
    company: 'Glasurit Carrocerías & Pintura',
    category: 'carroceria-pintura',
    categoryLabel: 'Carrocería y Pintura',
    description: 'Laboratorio de colorimetría computarizada y cabina de horneado presurizada. Especialistas en reparaciones de siniestros, retoques de paños express en 24h y tratamiento anti-corrosión con garantía de por vida en pintura.',
    priceType: 'fixed',
    priceText: '$75.000 por paño / Cotización express',
    priceValue: 75000,
    region: 'Región Metropolitana',
    commune: 'La Florida',
    address: 'Av. Vicuña Mackenna 7320',
    phone: '+56 9 9234 5678',
    whatsapp: '56992345678',
    openingHours: 'Lun a Sáb 08:30 - 18:30',
    rating: 4.95,
    reviewsCount: 94,
    images: [
      'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Cabina Presurizada', 'Pintura BASF Glasurit', 'Presupuesto gratis por foto', 'Auto de reemplazo disponible'],
    servicesOffered: [
      'Pintura al horno por paño o auto completo',
      'Desabolladura express sin pintar (PDR / Varillaje)',
      'Reparación de parachoques plásticos y ópticos',
      'Pulido tri-etapa y sellado acrílico de terminación'
    ],
    is24Hours: false,
    hasOnlineBooking: true,
    publishedAt: '2026-08-16'
  },
  {
    id: 'ad-emp-03',
    tier: 'empresarial',
    title: 'AutoCheck Inspección Pre-Compra - Scanner e Informe Legal y Mecánico',
    company: 'AutoCheck Chile Certificaciones',
    category: 'servicios-inspeccion',
    categoryLabel: 'Servicios de Inspección',
    description: 'Servicio integral de revisión mecánica y legal antes de comprar un auto usado. Más de 180 puntos de control: compresión de motor, espesímetro de pintura (choques ocultos), escáner de kilometraje real y autofact.',
    priceType: 'fixed',
    priceText: '$49.990 Informe Completo',
    priceValue: 49990,
    region: 'Región Metropolitana',
    commune: 'Providencia',
    address: 'Av. Andrés Bello 2711',
    phone: '+56 2 2552 9010',
    whatsapp: '56955290100',
    openingHours: 'Lun a Sáb 08:30 - 19:00',
    rating: 4.96,
    reviewsCount: 110,
    images: [
      'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Informe PDF en el acto', 'Medidor de espesor de pintura', 'Prueba de ruta asistida'],
    servicesOffered: [
      'Inspección pre-compra a domicilio y concesionarias',
      'Detección de choques y repintados con espesímetro',
      'Revisión legal de multas, prendas y kilometraje real',
      'Chequeo de fugas de compresión y tren rodante'
    ],
    is24Hours: false,
    hasOnlineBooking: true,
    publishedAt: '2026-08-14'
  },

  // ===================== PREMIUM =====================
  {
    id: 'ad-prem-01',
    tier: 'premium',
    title: 'ProScan Electrónica Automotriz - Reprogramación ECU, DPF & Airbags',
    company: 'ProScan Laboratorio Automotriz',
    category: 'electricidad-electronica',
    categoryLabel: 'Electricidad y Electrónica',
    description: 'Diagnóstico avanzado osciloscopio, clonación de computadoras de motor (ECU/ECM), reseteo de módulos de airbag post-choque, regeneración forzada de DPF/FAP y eliminación de fallas Check Engine.',
    priceType: 'fixed',
    priceText: '$35.000 Escáner Completo',
    priceValue: 35000,
    region: 'Región Metropolitana',
    commune: 'Providencia',
    address: 'Av. Francisco Bilbao 2340',
    phone: '+56 9 8122 3344',
    whatsapp: '56981223344',
    openingHours: 'Lun a Sáb 09:00 - 19:00',
    rating: 4.85,
    reviewsCount: 62,
    images: [
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Escáner Autel & Launch Oficial', 'Diagnóstico a domicilio disponible', 'Respuesta WhatsApp inmediata'],
    servicesOffered: [
      'Lectura y borrado de códigos OBD2/OEM',
      'Programación de inyectores diésel common rail',
      'Reparación de cuadros de instrumentos y tableros',
      'Diagnóstico de sensores de oxígeno y catalizadores'
    ],
    is24Hours: false,
    hasOnlineBooking: false,
    publishedAt: '2026-08-16'
  },
  {
    id: 'ad-prem-02',
    tier: 'premium',
    title: 'Apex Ceramic Lab - Detailing Profesional, Sellado Cerámico 9H & PPF',
    company: 'Apex Detailing Studio',
    category: 'estetica-automotriz',
    categoryLabel: 'Estética Automotriz',
    description: 'Transformación estética de vehículos de alta gama y uso diario. Pulido en 3 pasos con cortes de micro-rayas (swirls), aplicación de recubrimiento cerámico certificado Gyeon 3 años e instalación de film protector PPF frontal.',
    priceType: 'fixed',
    priceText: '$140.000 Sellado Cerámico',
    priceValue: 140000,
    region: 'Región Metropolitana',
    commune: 'Las Condes',
    address: 'Av. Kennedy 8800, Local 12',
    phone: '+56 9 6341 8822',
    whatsapp: '56963418822',
    openingHours: 'Lun a Sáb 09:00 - 19:30',
    rating: 4.92,
    reviewsCount: 88,
    images: [
      'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Insumos Gyeon & Rupes', 'Lavado sin contacto pH neutro', 'Descontaminado férrico con clay bar'],
    servicesOffered: [
      'Tratamiento cerámico 9H (1 a 5 años)',
      'Lavado de motor a vapor seguro sin agua a presión',
      'Limpieza profunda y restauración de tapicería de cuero',
      'Pulido y vitrificado de focos opacos'
    ],
    is24Hours: false,
    hasOnlineBooking: false,
    publishedAt: '2026-08-15'
  },
  {
    id: 'ad-prem-03',
    tier: 'premium',
    title: 'ClimaCar Pro - Carga de Aire Acondicionado R134a/R1234yf con Detección UV',
    company: 'ClimaCar Pro Climatización',
    category: 'climatizacion',
    categoryLabel: 'Climatización',
    description: 'Mantención integral de aire acondicionado automotriz. Prueba de vacío para fugas, inyección de contraste fluorescente UV, recarga de gas con balanza digital y sanitización con vapor ozonizado para erradicar hongos y malos olores.',
    priceType: 'fixed',
    priceText: '$29.990 Carga Completa',
    priceValue: 29990,
    region: 'Región Metropolitana',
    commune: 'Ñuñoa',
    address: 'Av. Irarrázaval 3450',
    phone: '+56 9 5512 3456',
    whatsapp: '56955123456',
    openingHours: 'Lun a Sáb 09:00 - 18:30',
    rating: 4.81,
    reviewsCount: 53,
    images: [
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Prueba de vacío digital', 'Contraste UV incluido', 'Filtro de polen con descuento'],
    servicesOffered: [
      'Recarga de gas refrigerante R134a y R1234yf',
      'Cambio de compresor de aire y condensador',
      'Reparación de mangueras y tuberías de aluminio',
      'Limpieza de evaporador y ductos con ozono'
    ],
    is24Hours: false,
    hasOnlineBooking: false,
    publishedAt: '2026-08-16'
  },
  {
    id: 'ad-prem-04',
    tier: 'premium',
    title: 'Rescate Vial Grúas Cama Baja - Asistencia 24 Horas RM y Litoral',
    company: 'Rescate Vial 24/7 SpA',
    category: 'asistencia-vehicular',
    categoryLabel: 'Asistencia Vehicular',
    description: 'Servicio de grúas hidráulicas tipo plataforma para autos particulares, camionetas 4x4, SUVs y vehículos de lujo/bajos. Cobertura total en Santiago, Ruta 68, Ruta 78 y V Región. Salida inmediata.',
    priceType: 'quote',
    priceText: 'Desde $35.000 / Cotiza por WhatsApp',
    priceValue: 35000,
    region: 'Región Metropolitana',
    commune: 'Santiago Centro',
    address: 'Av. Matta 1280 (Base Central)',
    phone: '+56 9 4433 2211',
    whatsapp: '56944332211',
    openingHours: 'Atención 24 Horas / 365 días',
    rating: 4.96,
    reviewsCount: 142,
    images: [
      'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1562911791-c7a97b729ec5?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Llegada en 25 minutos promedio', 'Seguro de carga activo', 'Puente de batería y cambio de rueda'],
    servicesOffered: [
      'Traslado en grúa plataforma cama baja',
      'Rescate en subterráneos de edificios',
      'Puente de batería 12V y 24V in situ',
      'Apertura de puertas de emergencia'
    ],
    is24Hours: true,
    hasOnlineBooking: false,
    publishedAt: '2026-08-17'
  },

  // ===================== DESTACADA =====================
  {
    id: 'ad-dest-01',
    tier: 'destacada',
    title: 'Frenos & Alineación 3D El Trébol - Pastillas Brembo y Amortiguadores',
    company: 'Frenos El Trébol',
    category: 'mecanica',
    categoryLabel: 'Mecánica',
    description: 'Revisión y cambio de pastillas de freno en el acto. Rectificado de discos sin desmontar, alineación computarizada 3D y balanceo dinámico de neumáticos. Gran stock de repuestos de frenos para todas las marcas.',
    priceType: 'quote',
    priceText: 'Pastillas desde $24.990 + Instalación',
    priceValue: 24990,
    region: 'Región Metropolitana',
    commune: 'Maipú',
    address: 'Av. Pajaritos 3120',
    phone: '+56 2 2741 8899',
    whatsapp: null,
    openingHours: 'Lun a Sáb 08:30 - 19:00',
    rating: 4.75,
    reviewsCount: 45,
    images: [
      'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Alineación 3D Láser', 'Discos y pastillas en stock', 'Revisión visual gratis'],
    servicesOffered: [
      'Cambio de pastillas y balatas de freno',
      'Alineación láser 3D en 4 ruedas',
      'Diagnóstico de tren delantero y bujes'
    ],
    is24Hours: false,
    hasOnlineBooking: false,
    publishedAt: '2026-08-14'
  },
  {
    id: 'ad-dest-02',
    tier: 'destacada',
    title: 'Vulcanización Express 24 Horas & Parches Vulcanizados en Caliente',
    company: 'Vulcanización Los Leones',
    category: 'neumaticos',
    categoryLabel: 'Neumáticos',
    description: 'Reparación de pinchazos de autos, camionetas y furgones. Parches en frío y vulcanizado en caliente para cortes laterales. Venta de neumáticos nuevos y balanceo computarizado. Abierto toda la noche.',
    priceType: 'fixed',
    priceText: '$5.000 Parche / $8.000 Balanceo',
    priceValue: 5000,
    region: 'Región Metropolitana',
    commune: 'Providencia',
    address: 'Av. Los Leones 1890',
    phone: '+56 9 7332 1100',
    whatsapp: null,
    openingHours: 'Abierto 24 Horas continuo',
    rating: 4.7,
    reviewsCount: 38,
    images: [
      'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Atención 24/7', 'Inflado con nitrógeno', 'Parches reforzados'],
    servicesOffered: [
      'Parche vulcanizado en frío y calor',
      'Desmontaje de llantas de perfil bajo',
      'Enderezado de llantas de aleación'
    ],
    is24Hours: true,
    hasOnlineBooking: false,
    publishedAt: '2026-08-13'
  },
  {
    id: 'ad-dest-03',
    tier: 'destacada',
    title: 'Cerrajería Automotriz ChipMaster - Copia de Llaves Inteligentes & Mandos',
    company: 'ChipMaster Cerrajería SpA',
    category: 'cerrajeria-seguridad',
    categoryLabel: 'Cerrajería y Seguridad',
    description: 'Copia y programación de llaves con transponder/chip, telemandos originales y llaves Smart Key (presencia con botón Start). Confección de llaves por pérdida total mediante lectura de cilindro o código PIN.',
    priceType: 'quote',
    priceText: 'Desde $30.000 con programación',
    priceValue: 30000,
    region: 'Región Metropolitana',
    commune: 'Santiago Centro',
    address: 'Av. 10 de Julio Huamachuco 640',
    phone: '+56 9 8877 6655',
    whatsapp: null,
    openingHours: 'Lun a Sáb 09:30 - 18:30',
    rating: 4.82,
    reviewsCount: 51,
    images: [
      'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Copia en 20 minutos', 'Carcasas y botones de repuesto', 'Atención en 10 de Julio'],
    servicesOffered: [
      'Copia de llave tipo navaja y smart key',
      'Programación inmovilizador y chip',
      'Reparación de cilindro de chapa y switch de ignición'
    ],
    is24Hours: false,
    hasOnlineBooking: false,
    publishedAt: '2026-08-12'
  },

  // ===================== BASICA =====================
  {
    id: 'ad-bas-01',
    tier: 'basica',
    title: 'Taller Mecánico Don Pepe - Cambio de Aceite, Filtros y Mantención Básica',
    company: 'Taller Mecánico Don Pepe',
    category: 'mecanica',
    categoryLabel: 'Mecánica',
    description: 'Mecánica tradicional con más de 20 años en el barrio. Cambio de aceite con lubricantes de primera marca (Castrol, Mobil, Total), cambio de filtro de aire, bujías y revisión de niveles de fluidos. Atención personalizada.',
    priceType: 'fixed',
    priceText: '$18.000 Mano de Obra Mantención',
    priceValue: 18000,
    region: 'Región Metropolitana',
    commune: 'San Miguel',
    address: 'Calle Teresa Vial 1045',
    phone: '+56 9 7112 4433',
    whatsapp: null,
    openingHours: 'Lun a Vie 09:00 - 18:30 / Sáb 09:00 - 13:30',
    rating: 4.6,
    reviewsCount: 22,
    images: [
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Atención directa por dueño', 'Precios accesibles'],
    servicesOffered: [
      'Cambio de aceite y filtro de motor',
      'Cambio de pastillas de freno delanteras',
      'Afinamiento menor y bujías'
    ],
    is24Hours: false,
    hasOnlineBooking: false,
    publishedAt: '2026-08-10'
  },
  {
    id: 'ad-bas-02',
    tier: 'basica',
    title: 'Lavado y Aspirado Express San Joaquín - Limpieza de Tapices y Carrocería',
    company: 'Car Wash San Joaquín',
    category: 'estetica-automotriz',
    categoryLabel: 'Estética Automotriz',
    description: 'Lavado manual con shampoo encerador y aspirado profundo de alfombras, asientos y maletero. Lavado de chasis y aplicación de renovador de gomas. Rapidez y buen cuidado de la pintura.',
    priceType: 'fixed',
    priceText: '$9.900 Lavado Full Auto',
    priceValue: 9900,
    region: 'Región Metropolitana',
    commune: 'San Miguel',
    address: 'Av. Las Industrias 4200',
    phone: '+56 9 6554 1122',
    whatsapp: null,
    openingHours: 'Lun a Dom 09:00 - 19:00',
    rating: 4.4,
    reviewsCount: 16,
    images: [
      'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Lavado manual', 'Atención por orden de llegada'],
    servicesOffered: [
      'Lavado de carrocería y secado con microfibra',
      'Aspirado interior completo y maletero',
      'Renovador de molduras y neumáticos'
    ],
    is24Hours: false,
    hasOnlineBooking: false,
    publishedAt: '2026-08-08'
  },
  {
    id: 'ad-bas-03',
    tier: 'basica',
    title: 'Electricidad Automotriz Silva - Alternadores, Motores de Partida y Baterías',
    company: 'Electromecánica Silva',
    category: 'electricidad-electronica',
    categoryLabel: 'Electricidad y Electrónica',
    description: 'Reparación de alternadores, cambio de carbones y regulador de voltaje. Reparación de motores de partida / arranque y diagnóstico de fuga de corriente de batería. Instalación de focos y neblineros LED.',
    priceType: 'quote',
    priceText: 'Desde $15.000 / Cotización en taller',
    priceValue: 15000,
    region: 'Región Metropolitana',
    commune: 'Quilicura',
    address: 'Av. O\'Higgins 450',
    phone: '+56 2 2603 5511',
    whatsapp: null,
    openingHours: 'Lun a Vie 09:00 - 18:00',
    rating: 4.55,
    reviewsCount: 29,
    images: [
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Banco de prueba de alternador', 'Repuestos eléctricos en stock'],
    servicesOffered: [
      'Reparación de alternador y motor de partida',
      'Detección de consumo fantasma de batería',
      'Instalación de luces y cableado'
    ],
    is24Hours: false,
    hasOnlineBooking: false,
    publishedAt: '2026-08-05'
  },
  {
    id: 'ad-bas-04',
    tier: 'basica',
    title: 'Conversión GNC/GLP GasChile - Ahorro de Combustible Certificado SEC',
    company: 'GasChile Conversiones',
    category: 'otros-servicios',
    categoryLabel: 'Otros Servicios Automotrices',
    description: 'Conversión de vehículos bencineros a gas GLP / GNC de 5ta generación con inyección secuencial. Tramitación de sello verde y certificación SEC ante el Ministerio de Transportes. Gran ahorro en taxis, aplicaciones y particulares.',
    priceType: 'quote',
    priceText: 'Desde $650.000 / Consulta técnica',
    priceValue: 650000,
    region: 'Región Metropolitana',
    commune: 'Puente Alto',
    address: 'Av. Concha y Toro 2410',
    phone: '+56 9 8765 4321',
    whatsapp: null,
    openingHours: 'Lun a Vie 09:00 - 18:00',
    rating: 4.65,
    reviewsCount: 31,
    images: [
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&auto=format&fit=crop&q=80'
    ],
    features: ['Equipos Tomasetto Achille', 'Certificación SEC incluida'],
    servicesOffered: [
      'Conversión de 5ta generación con ECU dedicada',
      'Calibración y cambio de filtros de gas',
      'Prueba hidrostática y re-certificación decenal'
    ],
    is24Hours: false,
    hasOnlineBooking: false,
    publishedAt: '2026-08-01'
  }
];
