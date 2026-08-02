// Icon/color/image below are kept together per category id so the same
// visual identity appears everywhere that category shows up (sidebar,
// category grid, product cards, latest parts, cart, etc):
// - `iconName` maps to a lucide-react component (via <CategoryIconTile>)
// - `color` is that system's brand accent (red=frenos, orange=motor, etc)
// - `image` is a real reference photo of that part/system

export const SIDEBAR_CATEGORIES = [
  { id: 'frenos', nombre: 'Sistema de Frenos', count: '14.280 repuestos', iconName: 'Disc3', color: '#ef4444', image: '/cat_frenos.jpg' },
  { id: 'motor', nombre: 'Motor y Distribución', count: '28.940 repuestos', iconName: 'Cog', color: '#f97316', image: '/cat_motor.jpg' },
  { id: 'suspension', nombre: 'Suspensión y Dirección', count: '19.450 repuestos', iconName: 'ArrowUpDown', color: '#8b5cf6', image: '/cat_suspension.jpg' },
  { id: 'iluminacion', nombre: 'Iluminación y Ampolletas', count: '11.820 repuestos', iconName: 'Lightbulb', color: '#eab308', image: '/cat_iluminacion.jpg' },
  { id: 'aceites', nombre: 'Aceites y Filtros', count: '32.100 repuestos', iconName: 'Droplets', color: '#14b8a6', image: '/cat_aceites.jpg' },
  { id: 'electrico', nombre: 'Sistema Eléctrico y Encendido', count: '16.540 repuestos', iconName: 'Zap', color: '#6366f1', image: '/cat_electrico.jpg' },
  { id: 'carroceria', nombre: 'Espejos y Carrocería', count: '22.310 repuestos', iconName: 'CarFront', color: '#ec4899', image: '/cat_carroceria.jpg' },
  { id: 'neumaticos', nombre: 'Neumáticos y Llantas', count: '9.870 repuestos', iconName: 'CircleDot', color: '#0891b2', image: '/cat_neumaticos.jpg' }
];

// Quick lookups used by product/part cards to resolve the right icon, color
// and reference image from a product's `categoria` id without duplicating
// the mapping everywhere.
export const CATEGORY_ICON_BY_ID = Object.fromEntries(
  SIDEBAR_CATEGORIES.map(cat => [cat.id, cat.iconName])
);

export const CATEGORY_COLOR_BY_ID = Object.fromEntries(
  SIDEBAR_CATEGORIES.map(cat => [cat.id, cat.color])
);

export const CATEGORY_IMAGE_BY_ID = Object.fromEntries(
  SIDEBAR_CATEGORIES.map(cat => [cat.id, cat.image])
);

export const CATEGORY_GRID_ITEMS = [
  {
    id: 'frenos',
    nombre: 'Frenos y Pastillas',
    count: '14.280 disponibles',
    badge: 'MÁS COTIZADO',
    subcategorias: ['Pastillas Brembo', 'Discos Ventilados', 'Líquido de Freno Dot 4', 'Cálipers'],
    iconName: 'Disc3',
    color: '#ef4444',
    image: '/cat_frenos.jpg'
  },
  {
    id: 'motor',
    nombre: 'Motor y Distribución',
    count: '28.940 disponibles',
    badge: '100% GARANTIZADO',
    subcategorias: ['Kits de Distribución', 'Bombas de Agua', 'Bujías Iridium', 'Empaquetaduras'],
    iconName: 'Cog',
    color: '#f97316',
    image: '/cat_motor.jpg'
  },
  {
    id: 'suspension',
    nombre: 'Suspensión y Dirección',
    count: '19.450 disponibles',
    badge: 'DESPACHO 24H',
    subcategorias: ['Amortiguadores KYB', 'Brazos de Control', 'Cremalleras', 'Bandejas'],
    iconName: 'ArrowUpDown',
    color: '#8b5cf6',
    image: '/cat_suspension.jpg'
  },
  {
    id: 'iluminacion',
    nombre: 'Ampolletas y Focos LED',
    count: '11.820 disponibles',
    badge: 'STOCK EN VIVO',
    subcategorias: ['Focos LED H7/H4', 'Ampolletas XENON', 'Faros Neblineros', 'Focos Traseros'],
    iconName: 'Lightbulb',
    color: '#eab308',
    image: '/cat_iluminacion.jpg'
  },
  {
    id: 'aceites',
    nombre: 'Aceites y Filtros',
    count: '32.100 disponibles',
    badge: 'OFERTAS FLASH',
    subcategorias: ['Aceite 5W30 Sintético', 'Filtro de Aceite Mann', 'Filtro de Aire', 'Filtro Polen'],
    iconName: 'Droplets',
    color: '#14b8a6',
    image: '/cat_aceites.jpg'
  },
  {
    id: 'electrico',
    nombre: 'Baterías y Encendido',
    count: '16.540 disponibles',
    badge: 'TIENDAS OFICIALES',
    subcategorias: ['Baterías Bosch 12V', 'Alternadores', 'Motor de Arranque', 'Bobinas'],
    iconName: 'Zap',
    color: '#6366f1',
    image: '/cat_electrico.jpg'
  },
  {
    id: 'carroceria',
    nombre: 'Espejos y Carrocería',
    count: '22.310 disponibles',
    badge: 'DESARME PROBADO',
    subcategorias: ['Espejos Retrovisores', 'Manillas de Puertas', 'Parachoques', 'Placas'],
    iconName: 'CarFront',
    color: '#ec4899',
    image: '/cat_carroceria.jpg'
  },
  {
    id: 'neumaticos',
    nombre: 'Neumáticos y Llantas',
    count: '9.870 disponibles',
    badge: 'ENVÍO GRATIS',
    subcategorias: ['Neumáticos 205/55 R16', 'Llantas de Aleación', 'Válvulas', 'Pernos'],
    iconName: 'CircleDot',
    color: '#0891b2',
    image: '/cat_neumaticos.jpg'
  }
];

export const CATEGORIES = CATEGORY_GRID_ITEMS;

export const POPULAR_CATEGORIES = [
  { id: 'frenos', label: 'Pastillas de Freno', count: '8.400', iconName: 'Disc3', color: '#ef4444', image: '/cat_frenos.jpg' },
  { id: 'filtros', label: 'Filtros de Aceite', count: '12.100', iconName: 'Droplets', color: '#14b8a6', image: '/cat_aceites.jpg' },
  { id: 'amortiguadores', label: 'Amortiguadores', count: '6.900', iconName: 'ArrowUpDown', color: '#8b5cf6', image: '/cat_suspension.jpg' },
  { id: 'bujias', label: 'Bujías Iridium', count: '5.300', iconName: 'Zap', color: '#6366f1', image: '/cat_electrico.jpg' },
  { id: 'aceites', label: 'Aceite 5W-30', count: '15.400', iconName: 'Droplets', color: '#14b8a6', image: '/cat_aceites.jpg' },
  { id: 'baterias', label: 'Baterías 12V', count: '4.100', iconName: 'Zap', color: '#6366f1', image: '/cat_electrico.jpg' }
];
