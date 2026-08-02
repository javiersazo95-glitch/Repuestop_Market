export const SIDEBAR_CATEGORIES = [
  { id: 'frenos', nombre: 'Sistema de Frenos', count: '14.280 repuestos', iconName: 'Disc', emoji: '🛞' },
  { id: 'motor', nombre: 'Motor y Distribución', count: '28.940 repuestos', iconName: 'Cpu', emoji: '⚙️' },
  { id: 'suspension', nombre: 'Suspensión y Dirección', count: '19.450 repuestos', iconName: 'Activity', emoji: '🔩' },
  { id: 'iluminacion', nombre: 'Iluminación y Ampolletas', count: '11.820 repuestos', iconName: 'Zap', emoji: '💡' },
  { id: 'aceites', nombre: 'Aceites y Filtros', count: '32.100 repuestos', iconName: 'Droplet', emoji: '🛢️' },
  { id: 'electrico', nombre: 'Sistema Eléctrico y Encendido', count: '16.540 repuestos', iconName: 'Sun', emoji: '⚡' },
  { id: 'carroceria', nombre: 'Espejos y Carrocería', count: '22.310 repuestos', iconName: 'Shield', emoji: '🚪' },
  { id: 'neumaticos', nombre: 'Neumáticos y Llantas', count: '9.870 repuestos', iconName: 'Wind', emoji: '🏎️' }
];

export const CATEGORY_GRID_ITEMS = [
  {
    id: 'frenos',
    nombre: 'Frenos y Pastillas',
    count: '14.280 disponibles',
    badge: 'MÁS COTIZADO',
    subcategorias: ['Pastillas Brembo', 'Discos Ventilados', 'Líquido de Freno Dot 4', 'Cálipers'],
    imagen: '/repuestos_warehouse_bg.jpg',
    emoji: '🛞'
  },
  {
    id: 'motor',
    nombre: 'Motor y Distribución',
    count: '28.940 disponibles',
    badge: '100% GARANTIZADO',
    subcategorias: ['Kits de Distribución', 'Bombas de Agua', 'Bujías Iridium', 'Empaquetaduras'],
    imagen: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=400&q=80',
    emoji: '⚙️'
  },
  {
    id: 'suspension',
    nombre: 'Suspensión y Dirección',
    count: '19.450 disponibles',
    badge: 'DESPACHO 24H',
    subcategorias: ['Amortiguadores KYB', 'Brazos de Control', 'Cremalleras', 'Bandejas'],
    imagen: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=400&q=80',
    emoji: '🔩'
  },
  {
    id: 'iluminacion',
    nombre: 'Ampolletas y Focos LED',
    count: '11.820 disponibles',
    badge: 'STOCK EN VIVO',
    subcategorias: ['Focos LED H7/H4', 'Ampolletas XENON', 'Faros Neblineros', 'Focos Traseros'],
    imagen: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80',
    emoji: '💡'
  },
  {
    id: 'aceites',
    nombre: 'Aceites y Filtros',
    count: '32.100 disponibles',
    badge: 'OFERTAS FLASH',
    subcategorias: ['Aceite 5W30 Sintético', 'Filtro de Aceite Mann', 'Filtro de Aire', 'Filtro Polen'],
    imagen: 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=400&q=80',
    emoji: '🛢️'
  },
  {
    id: 'electrico',
    nombre: 'Baterías y Encendido',
    count: '16.540 disponibles',
    badge: 'TIENDAS OFICIALES',
    subcategorias: ['Baterías Bosch 12V', 'Alternadores', 'Motor de Arranque', 'Bobinas'],
    imagen: 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&w=400&q=80',
    emoji: '⚡'
  },
  {
    id: 'carroceria',
    nombre: 'Espejos y Carrocería',
    count: '22.310 disponibles',
    badge: 'DESARME PROBADO',
    subcategorias: ['Espejos Retrovisores', 'Manillas de Puertas', 'Parachoques', 'Placas'],
    imagen: '/repuestos_warehouse_bg.jpg',
    emoji: '🚪'
  },
  {
    id: 'neumaticos',
    nombre: 'Neumáticos y Llantas',
    count: '9.870 disponibles',
    badge: 'ENVÍO GRATIS',
    subcategorias: ['Neumáticos 205/55 R16', 'Llantas de Aleación', 'Válvulas', 'Pernos'],
    imagen: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=400&q=80',
    emoji: '🏎️'
  }
];

export const CATEGORIES = CATEGORY_GRID_ITEMS;

export const POPULAR_CATEGORIES = [
  { id: 'frenos', label: 'Pastillas de Freno', count: '8.400', image: '/repuestos_warehouse_bg.jpg' },
  { id: 'filtros', label: 'Filtros de Aceite', count: '12.100', image: 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=150&q=80' },
  { id: 'amortiguadores', label: 'Amortiguadores', count: '6.900', image: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=150&q=80' },
  { id: 'bujias', label: 'Bujías Iridium', count: '5.300', image: 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&w=150&q=80' },
  { id: 'aceites', label: 'Aceite 5W-30', count: '15.400', image: 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?auto=format&fit=crop&w=150&q=80' },
  { id: 'baterias', label: 'Baterías 12V', count: '4.100', image: 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&w=150&q=80' }
];
