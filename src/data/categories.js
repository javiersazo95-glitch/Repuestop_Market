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

// Categorías técnicas disponibles desde el menú principal. Mantenerlas separadas
// de SIDEBAR_CATEGORIES permite ampliar el catálogo sin alterar la identidad visual
// de las ocho familias que usan las cards y los filtros resumidos actuales.
export const HEADER_CATEGORIES = [
  {
    id: 'accesorios',
    nombre: 'Accesorios',
    filterId: 'carroceria',
    image: '/cat_accesorios.jpg',
    subcategories: [
      'Interior',
      'Exterior',
      'Seguridad',
      'Iluminación',
      'Audio y Tecnología',
      'Limpieza y Cuidado',
      'Herramientas y Emergencia',
      'Neumáticos y Llantas',
    ],
    subcategoryImages: {
      Interior: '/category-parts/accessories-subcategories/interior.png',
      Exterior: '/category-parts/accessories-subcategories/exterior.png',
      Seguridad: '/category-parts/accessories-subcategories/seguridad.png',
      Iluminación: '/category-parts/accessories-subcategories/iluminacion.png',
      'Audio y Tecnología': '/category-parts/accessories-subcategories/audio-tecnologia.png',
      'Limpieza y Cuidado': '/category-parts/accessories-subcategories/limpieza-cuidado.png',
      'Herramientas y Emergencia': '/category-parts/accessories-subcategories/herramientas-emergencia.png',
      'Neumáticos y Llantas': '/category-parts/accessories-subcategories/neumaticos-llantas.png',
    },
  },
  {
    id: 'aceite',
    nombre: 'Aceite',
    filterId: 'aceites',
    image: '/cat_aceites.jpg',
    subcategories: ['Bomba de Aceite', 'Aceite de Caja', 'Aceite de Motor', 'Filtro de Aceite', 'Radiador de Aceite', 'Válvula Control Aceite', 'Cárter', 'Inyector Aceite'],
    subcategoryImages: {
      'Bomba de Aceite': '/category-parts/oil-subcategories/bomba-de-aceite.png',
      'Aceite de Caja': '/category-parts/oil-subcategories/aceite-de-caja.png',
      'Aceite de Motor': '/category-parts/oil-subcategories/aceite-de-motor.png',
      'Filtro de Aceite': '/category-parts/oil-subcategories/filtro-de-aceite.png',
      'Radiador de Aceite': '/category-parts/oil-subcategories/radiador-de-aceite.png',
      'Válvula Control Aceite': '/category-parts/oil-subcategories/valvula-control-aceite.png',
      'Cárter': '/category-parts/oil-subcategories/carter.png',
      'Inyector Aceite': '/category-parts/oil-subcategories/inyector-aceite.png',
    },
  },
  {
    id: 'admision-aire',
    nombre: 'Admisión de Aire',
    filterId: 'motor',
    image: '/cat_motor.jpg',
    subcategories: ['Múltiple Admisión', 'Válvula IAC', 'Cuerpo Aceleración'],
    subcategoryImages: {
      'Múltiple Admisión': '/category-parts/air-intake-subcategories/multiple-admision.png',
      'Válvula IAC': '/category-parts/air-intake-subcategories/valvula-iac.png',
      'Cuerpo Aceleración': '/category-parts/air-intake-subcategories/cuerpo-aceleracion.png',
    },
  },
  {
    id: 'calefaccion-aire-acondicionado',
    nombre: 'Calefacción y Aire Acondicionado',
    filterId: 'iluminacion',
    image: '/cat_iluminacion.jpg',
    subcategories: ['Compresor', 'Condensador', 'Filtro de Polen', 'Radiador de Calefacción', 'Evaporador'],
    subcategoryImages: {
      Compresor: '/category-parts/heating-subcategories/compresor.png',
      Condensador: '/category-parts/heating-subcategories/condensador.png',
      'Filtro de Polen': '/category-parts/heating-subcategories/filtro-polen.png',
      'Radiador de Calefacción': '/category-parts/heating-subcategories/radiador-calefaccion.png',
      Evaporador: '/category-parts/heating-subcategories/evaporador.png',
    },
  },
  {
    id: 'carroceria',
    nombre: 'Carrocería',
    filterId: 'carroceria',
    image: '/cat_carroceria.jpg',
    subcategories: ['Parachoques', 'Maleta & Portalón', 'Capot', 'Cubre Frontal', 'Cubre Motor', 'Espejos', 'Focos Traseros', 'Frontal', 'Guardafangos', 'Guías de Parachoques', 'Manillas', 'Neblineros', 'Focos Delanteros', 'Paneles y Cunas de Motor', 'Puertas', 'Refuerzos', 'Rejilla Torpedo', 'Tapabarros'],
    subcategoryImages: {
      Parachoques: '/category-parts/body-subcategories/parachoques.png',
      'Maleta & Portalón': '/category-parts/body-subcategories/maleta-portalon.png',
      Capot: '/category-parts/body-subcategories/capot.png',
      'Cubre Frontal': '/category-parts/body-subcategories/cubre-frontal.png',
      'Cubre Motor': '/category-parts/body-subcategories/cubre-motor.png',
      Espejos: '/category-parts/body-subcategories/espejos.png',
      'Focos Traseros': '/category-parts/body-subcategories/focos-traseros.png',
      Frontal: '/category-parts/body-subcategories/frontal.png',
      Guardafangos: '/category-parts/body-subcategories/guardafangos.png',
      'Guías de Parachoques': '/category-parts/body-subcategories/guias-parachoques.png',
      Manillas: '/category-parts/body-subcategories/manillas.png',
      Neblineros: '/category-parts/body-subcategories/neblineros.png',
      'Focos Delanteros': '/category-parts/body-subcategories/focos-delanteros.png',
      'Paneles y Cunas de Motor': '/category-parts/body-subcategories/paneles-cunas-motor.png',
      Puertas: '/category-parts/body-subcategories/puertas.png',
      Refuerzos: '/category-parts/body-subcategories/refuerzos.png',
      'Rejilla Torpedo': '/category-parts/body-subcategories/rejilla-torpedo.png',
      Tapabarros: '/category-parts/body-subcategories/tapabarros.png',
    },
  },
  {
    id: 'cerraduras',
    nombre: 'Cerraduras',
    filterId: 'carroceria',
    image: '/cat_carroceria.jpg',
    subcategories: ['Chapas y Cilindros', 'Actuadores'],
    subcategoryImages: {
      'Chapas y Cilindros': '/category-parts/locks-subcategories/chapas-cilindros.png',
      Actuadores: '/category-parts/locks-subcategories/actuadores.png',
    },
  },
  {
    id: 'combustible',
    nombre: 'Combustible',
    filterId: 'motor',
    image: '/cat_motor.jpg',
    subcategories: ['Bomba de Bencina', 'Filtro de Combustible', 'Inyector', 'Bomba de Petróleo', 'Reguladores de Presión'],
    subcategoryImages: {
      'Bomba de Bencina': '/category-parts/fuel-subcategories/bomba-bencina.png',
      'Filtro de Combustible': '/category-parts/fuel-subcategories/filtro-combustible.png',
      Inyector: '/category-parts/fuel-subcategories/inyector.png',
      'Bomba de Petróleo': '/category-parts/fuel-subcategories/bomba-petroleo.png',
      'Reguladores de Presión': '/category-parts/fuel-subcategories/reguladores-presion.png',
    },
  },
  {
    id: 'correas',
    nombre: 'Correas',
    filterId: 'motor',
    image: '/cat_motor.jpg',
    subcategories: ['Correa Aire Acondicionado', 'Correas de Alternador', 'Correas Distribución', 'Correa Dirección Hidráulica'],
    subcategoryImages: {
      'Correa Aire Acondicionado': '/category-parts/belt-subcategories/correa-aire-acondicionado.png',
      'Correas de Alternador': '/category-parts/belt-subcategories/correa-alternador.png',
      'Correas Distribución': '/category-parts/belt-subcategories/correa-distribucion.png',
      'Correa Dirección Hidráulica': '/category-parts/belt-subcategories/correa-direccion-hidraulica.png',
    },
  },
  {
    id: 'direccion',
    nombre: 'Dirección',
    filterId: 'suspension',
    image: '/cat_suspension.jpg',
    subcategories: ['Columna de Dirección', 'Cremallera de Dirección', 'Junta Cardánica', 'Módulo EPS', 'Terminal Axial', 'Terminal de Dirección', 'Bomba de Dirección', 'Correa Dirección Hidráulica'],
    subcategoryImages: {
      'Columna de Dirección': '/category-parts/steering-subcategories/columna-direccion.png',
      'Cremallera de Dirección': '/category-parts/steering-subcategories/cremallera-direccion.png',
      'Junta Cardánica': '/category-parts/steering-subcategories/junta-cardanica.png',
      'Módulo EPS': '/category-parts/steering-subcategories/modulo-eps.png',
      'Terminal Axial': '/category-parts/steering-subcategories/terminal-axial.png',
      'Terminal de Dirección': '/category-parts/steering-subcategories/terminal-direccion.png',
      'Bomba de Dirección': '/category-parts/steering-subcategories/bomba-direccion.png',
      'Correa Dirección Hidráulica': '/category-parts/steering-subcategories/correa-direccion-hidraulica.png',
    },
  },
  { id: 'distribucion', nombre: 'Distribución', filterId: 'motor', image: '/cat_motor.jpg', subcategories: ['Rodamiento Tensor Distribución', 'Tapa Distribución', 'Cadenas Distribución', 'Conjunto CVVT', 'Guías de Cadena', 'Piñones', 'Tensores Hidráulicos Distribución', 'Bombas de Agua'], subcategoryImages: { 'Rodamiento Tensor Distribución': '/category-parts/distribution-subcategories/rodamiento-tensor-distribucion.png', 'Tapa Distribución': '/category-parts/distribution-subcategories/tapa-distribucion.png', 'Cadenas Distribución': '/category-parts/distribution-subcategories/cadenas-distribucion.png', 'Conjunto CVVT': '/category-parts/distribution-subcategories/conjunto-cvvt.png', 'Guías de Cadena': '/category-parts/distribution-subcategories/guias-cadena.png', Piñones: '/category-parts/distribution-subcategories/pinones.png', 'Tensores Hidráulicos Distribución': '/category-parts/distribution-subcategories/tensores-hidraulicos-distribucion.png', 'Bombas de Agua': '/category-parts/distribution-subcategories/bombas-agua.png' } },
  { id: 'egr', nombre: 'EGR', filterId: 'motor', image: '/cat_motor.jpg', subcategories: ['Válvula EGR', 'Enfriador EGR'], subcategoryImages: { 'Válvula EGR': '/category-parts/egr-subcategories/valvula-egr.png', 'Enfriador EGR': '/category-parts/egr-subcategories/enfriador-egr.png' } },
  { id: 'ejes-delantero-trasero', nombre: 'Ejes Delantero y Trasero', filterId: 'suspension', image: '/cat_suspension.jpg', subcategories: ['Mazas', 'Muñones', 'Puente Trasero', 'Rodamiento de Rueda'], subcategoryImages: { Mazas: '/category-parts/axles-subcategories/mazas.png', Muñones: '/category-parts/axles-subcategories/munones.png', 'Puente Trasero': '/category-parts/axles-subcategories/puente-trasero.png', 'Rodamiento de Rueda': '/category-parts/axles-subcategories/rodamiento-rueda.png' } },
  { id: 'electrico', nombre: 'Eléctrico', filterId: 'electrico', image: '/cat_electrico.jpg', subcategories: ['Botones Alza Vidrios', 'Limpia Parabrisas', 'Bobinas', 'Comando de Luces', 'Pedal Acelerador', 'Switch Intermitente', 'Comando de Limpiaparabrisas', 'Fusibles y Relé', 'Alternador'], subcategoryImages: { 'Botones Alza Vidrios': '/category-parts/electrical-subcategories/botones-alza-vidrios.png', 'Limpia Parabrisas': '/category-parts/electrical-subcategories/limpia-parabrisas.png', Bobinas: '/category-parts/electrical-subcategories/bobinas.png', 'Comando de Luces': '/category-parts/electrical-subcategories/comando-luces.png', 'Pedal Acelerador': '/category-parts/electrical-subcategories/pedal-acelerador.png', 'Switch Intermitente': '/category-parts/electrical-subcategories/switch-intermitente.png', 'Comando de Limpiaparabrisas': '/category-parts/electrical-subcategories/comando-limpiaparabrisas.png', 'Fusibles y Relé': '/category-parts/electrical-subcategories/fusibles-rele.png', Alternador: '/category-parts/electrical-subcategories/alternador.png' } },
  { id: 'embrague', nombre: 'Embrague', filterId: 'motor', image: '/cat_motor.jpg', subcategories: ['Bombas de Embrague', 'Cilindro de Embragues', 'Kit de Embragues', 'Piola Embrague', 'Volantes de Motor', 'Horquilla de Embrague'], subcategoryImages: { 'Bombas de Embrague': '/category-parts/clutch-subcategories/bombas-embrague.png', 'Cilindro de Embragues': '/category-parts/clutch-subcategories/cilindro-embragues.png', 'Kit de Embragues': '/category-parts/clutch-subcategories/kit-embragues.png', 'Piola Embrague': '/category-parts/clutch-subcategories/piola-embrague.png', 'Volantes de Motor': '/category-parts/clutch-subcategories/volantes-motor.png', 'Horquilla de Embrague': '/category-parts/clutch-subcategories/horquilla-embrague.png' } },
  { id: 'empaquetaduras-retenes', nombre: 'Empaquetaduras y Retenes', filterId: 'motor', image: '/cat_motor.jpg', subcategories: ['Retén Cigüeñal', 'Retenes de Válvula', 'Sellos', 'Empaquetadura de Culata', 'Empaquetadura de Tapa de Válvulas', 'Juego de Empaquetaduras de Motor', 'Retenes de Eje Leva', 'Retenes Salida de Caja'], subcategoryImages: { 'Retén Cigüeñal': '/category-parts/gaskets-subcategories/reten-ciguenal.png', 'Retenes de Válvula': '/category-parts/gaskets-subcategories/retenes-valvula.png', Sellos: '/category-parts/gaskets-subcategories/sellos.png', 'Empaquetadura de Culata': '/category-parts/gaskets-subcategories/empaquetadura-culata.png', 'Empaquetadura de Tapa de Válvulas': '/category-parts/gaskets-subcategories/empaquetadura-tapa-valvulas.png', 'Juego de Empaquetaduras de Motor': '/category-parts/gaskets-subcategories/juego-empaquetaduras-motor.png', 'Retenes de Eje Leva': '/category-parts/gaskets-subcategories/retenes-eje-leva.png', 'Retenes Salida de Caja': '/category-parts/gaskets-subcategories/retenes-salida-caja.png' } },
  { id: 'encendido', nombre: 'Encendido', filterId: 'electrico', image: '/cat_electrico.jpg', subcategories: ['Bobinas', 'Bujías', 'Cables de Bujía', 'Motor de Partida'], subcategoryImages: { Bobinas: '/category-parts/ignition-subcategories/bobinas.png', Bujías: '/category-parts/ignition-subcategories/bujias.png', 'Cables de Bujía': '/category-parts/ignition-subcategories/cables-bujia.png', 'Motor de Partida': '/category-parts/ignition-subcategories/motor-partida.png' } },
  { id: 'filtros', nombre: 'Filtros', filterId: 'aceites', image: '/cat_aceites.jpg', subcategories: ['Filtro de Aire', 'Filtro de Combustible', 'Filtro de Polen', 'Filtro de Aceite'], subcategoryImages: { 'Filtro de Aire': '/category-parts/filters-subcategories/filtro-aire.png', 'Filtro de Combustible': '/category-parts/filters-subcategories/filtro-combustible.png', 'Filtro de Polen': '/category-parts/filters-subcategories/filtro-polen.png', 'Filtro de Aceite': '/category-parts/filters-subcategories/filtro-aceite.png' } },
  { id: 'frenos', nombre: 'Frenos', filterId: 'frenos', image: '/cat_frenos.jpg', subcategories: ['Bomba de Freno', 'Cilindro de Freno', 'Discos', 'Pastillas de Freno', 'Patines de Freno', 'Piola Freno de Mano', 'Servo Freno', 'Tambores', 'Depresor', 'Switch de Freno', 'Válvula Compensadora', 'Caliper'], subcategoryImages: { 'Bomba de Freno': '/category-parts/brakes-subcategories/bomba-freno.png', 'Cilindro de Freno': '/category-parts/brakes-subcategories/cilindro-freno.png', Discos: '/category-parts/brakes-subcategories/discos.png', 'Pastillas de Freno': '/category-parts/brakes-subcategories/pastillas-freno.png', 'Patines de Freno': '/category-parts/brakes-subcategories/patines-freno.png', 'Piola Freno de Mano': '/category-parts/brakes-subcategories/piola-freno-mano.png', 'Servo Freno': '/category-parts/brakes-subcategories/servo-freno.png', Tambores: '/category-parts/brakes-subcategories/tambores.png', Depresor: '/category-parts/brakes-subcategories/depresor.png', 'Switch de Freno': '/category-parts/brakes-subcategories/switch-freno.png', 'Válvula Compensadora': '/category-parts/brakes-subcategories/valvula-compensadora.png', Caliper: '/category-parts/brakes-subcategories/caliper.png' } },
  { id: 'motor', nombre: 'Motor', filterId: 'motor', image: '/cat_motor.jpg', subcategories: ['Empaquetaduras', 'Balancín', 'Bielas', 'Cigüeñales', 'Culata', 'Ejes Compensadores', 'Eje de Levas', 'Guías de Válvula', 'Anillos de Pistón', 'Metales Axiales', 'Pistones', 'Metales de Bancada', 'Metales de Biela', 'Metales Compensadores', 'Pernos de Culata', 'Retén Cigüeñal', 'Retenes de Válvula', 'Tapa de Válvula', 'Taqués', 'Válvula de Admisión y Escape', 'Bombas de Agua', 'Camisas', 'Retenes de Eje Leva'], subcategoryImages: { Empaquetaduras: '/category-parts/motor-subcategories/empaquetaduras.png', Balancín: '/category-parts/motor-subcategories/balancin.png', Bielas: '/category-parts/motor-subcategories/bielas.png', Cigüeñales: '/category-parts/motor-subcategories/ciguenales.png', Culata: '/category-parts/motor-subcategories/culata.png', 'Ejes Compensadores': '/category-parts/motor-subcategories/ejes-compensadores.png', 'Eje de Levas': '/category-parts/motor-subcategories/eje-levas.png', 'Guías de Válvula': '/category-parts/motor-subcategories/guias-valvula.png', 'Anillos de Pistón': '/category-parts/motor-subcategories/anillos-piston.png', 'Metales Axiales': '/category-parts/motor-subcategories/metales-axiales.png', Pistones: '/category-parts/motor-subcategories/pistones.png', 'Metales de Bancada': '/category-parts/motor-subcategories/metales-bancada.png', 'Metales de Biela': '/category-parts/motor-subcategories/metales-biela.png', 'Metales Compensadores': '/category-parts/motor-subcategories/metales-compensadores.png', 'Pernos de Culata': '/category-parts/motor-subcategories/pernos-culata.png', 'Retén Cigüeñal': '/category-parts/motor-subcategories/reten-ciguenal.png', 'Retenes de Válvula': '/category-parts/motor-subcategories/retenes-valvula.png', 'Tapa de Válvula': '/category-parts/motor-subcategories/tapa-valvula.png', Taqués: '/category-parts/motor-subcategories/taques.png', 'Válvula de Admisión y Escape': '/category-parts/motor-subcategories/valvula-admision-escape.png', 'Bombas de Agua': '/category-parts/motor-subcategories/bombas-agua.png', Camisas: '/category-parts/motor-subcategories/camisas.png', 'Retenes de Eje Leva': '/category-parts/motor-subcategories/retenes-eje-leva.png' } },
  { id: 'piolas', nombre: 'Piolas', filterId: 'suspension', image: '/cat_suspension.jpg', subcategories: ['Piola Selectora de Cambio', 'Piola Embrague', 'Piola Freno de Mano'], subcategoryImages: { 'Piola Selectora de Cambio': '/category-parts/cables-subcategories/piola-selectora-cambio.png', 'Piola Embrague': '/category-parts/cables-subcategories/piola-embrague.png', 'Piola Freno de Mano': '/category-parts/cables-subcategories/piola-freno-mano.png' } },
  { id: 'refrigeracion', nombre: 'Refrigeración', filterId: 'motor', image: '/cat_motor.jpg', subcategories: ['Manguera Radiador', 'Depósito Radiador', 'Electroventilador', 'Radiador de Agua', 'Sensor Temperatura', 'Termostato', 'Radiador de Aceite', 'Bombas de Agua', 'Cañerías', 'Centrífugo', 'Polea Bombas de Agua'], subcategoryImages: { 'Manguera Radiador': '/category-parts/cooling-subcategories/manguera-radiador.png', 'Depósito Radiador': '/category-parts/cooling-subcategories/deposito-radiador.png', Electroventilador: '/category-parts/cooling-subcategories/electroventilador.png', 'Radiador de Agua': '/category-parts/cooling-subcategories/radiador-agua.png', 'Sensor Temperatura': '/category-parts/cooling-subcategories/sensor-temperatura.png', Termostato: '/category-parts/cooling-subcategories/termostato.png', 'Radiador de Aceite': '/category-parts/cooling-subcategories/radiador-aceite.png', 'Bombas de Agua': '/category-parts/cooling-subcategories/bombas-agua.png', Cañerías: '/category-parts/cooling-subcategories/canerias.png', Centrífugo: '/category-parts/cooling-subcategories/centrifugo.png', 'Polea Bombas de Agua': '/category-parts/cooling-subcategories/polea-bombas-agua.png' } },
  { id: 'rodamientos', nombre: 'Rodamientos', filterId: 'suspension', image: '/cat_suspension.jpg', subcategories: ['Rodamiento de Rueda', 'Rodamiento Tensor Distribución', 'Polea Alternador', 'Polea Cigüeñal', 'Rodamiento Alternador'], subcategoryImages: { 'Rodamiento de Rueda': '/category-parts/bearings-subcategories/rodamiento-rueda.png', 'Rodamiento Tensor Distribución': '/category-parts/bearings-subcategories/rodamiento-tensor-distribucion.png', 'Polea Alternador': '/category-parts/bearings-subcategories/polea-alternador.png', 'Polea Cigüeñal': '/category-parts/bearings-subcategories/polea-ciguenal.png', 'Rodamiento Alternador': '/category-parts/bearings-subcategories/rodamiento-alternador.png' } },
  { id: 'sensores', nombre: 'Sensores', filterId: 'electrico', image: '/cat_electrico.jpg', subcategories: ['Cinta de Airbag', 'Sensor ABS', 'Sensor MAP', 'Sensor de Temperatura', 'Flujómetro', 'Sensor de Oxígeno', 'Sensor Posición Cigüeñal', 'Marcha Atrás', 'Sensor Posición Eje Leva', 'Sensor de Golpe', 'Bulbo Presión Aceite', 'Sensor Presión Catalítico', 'Sensor TPS', 'Sensor Velocidad'], subcategoryImages: { 'Cinta de Airbag': '/category-parts/sensor-subcategories/cinta-airbag.png', 'Sensor ABS': '/category-parts/sensor-subcategories/sensor-abs.png', 'Sensor MAP': '/category-parts/sensor-subcategories/sensor-map.png', 'Sensor de Temperatura': '/category-parts/sensor-subcategories/sensor-temperatura.png', Flujómetro: '/category-parts/sensor-subcategories/flujometro.png', 'Sensor de Oxígeno': '/category-parts/sensor-subcategories/sensor-oxigeno.png', 'Sensor Posición Cigüeñal': '/category-parts/sensor-subcategories/sensor-posicion-ciguenal.png', 'Marcha Atrás': '/category-parts/sensor-subcategories/marcha-atras.png', 'Sensor Posición Eje Leva': '/category-parts/sensor-subcategories/sensor-posicion-eje-leva.png', 'Sensor de Golpe': '/category-parts/sensor-subcategories/sensor-golpe.png', 'Bulbo Presión Aceite': '/category-parts/sensor-subcategories/bulbo-presion-aceite.png', 'Sensor Presión Catalítico': '/category-parts/sensor-subcategories/sensor-presion-catalitico.png', 'Sensor TPS': '/category-parts/sensor-subcategories/sensor-tps.png', 'Sensor Velocidad': '/category-parts/sensor-subcategories/sensor-velocidad.png' } },
  { id: 'soportes-motor', nombre: 'Soportes de Motor', filterId: 'motor', image: '/cat_motor.jpg', subcategories: ['Soporte de Motor', 'Soporte de Caja', 'Base de Motor'], subcategoryImages: { 'Soporte de Motor': '/category-parts/engine-mount-subcategories/soporte-motor.png', 'Soporte de Caja': '/category-parts/engine-mount-subcategories/soporte-caja.png', 'Base de Motor': '/category-parts/engine-mount-subcategories/base-motor.png' } },
  { id: 'suspension', nombre: 'Suspensión', filterId: 'suspension', image: '/cat_suspension.jpg', subcategories: ['Amortiguadores', 'Bandejas', 'Bieletas', 'Bujes', 'Cazoletas', 'Espirales', 'Barra Tensora', 'Rótulas', 'Barra Torsión'], subcategoryImages: { Amortiguadores: '/category-parts/suspension-subcategories/amortiguadores.png', Bandejas: '/category-parts/suspension-subcategories/bandejas.png', Bieletas: '/category-parts/suspension-subcategories/bieletas.png', Bujes: '/category-parts/suspension-subcategories/bujes.png', Cazoletas: '/category-parts/suspension-subcategories/cazoletas.png', Espirales: '/category-parts/suspension-subcategories/espirales.png', 'Barra Tensora': '/category-parts/suspension-subcategories/barra-tensora.png', Rótulas: '/category-parts/suspension-subcategories/rotulas.png', 'Barra Torsión': '/category-parts/suspension-subcategories/barra-torsion.png' } },
];

// Identidad visual común para el mega menú y el carrusel del home. Las fotografías
// extraídas de la referencia se usan en su categoría equivalente; el recurso de
// catálogo generado cubre las familias que no estaban presentes en esa lámina.
export const CATEGORY_VISUALS = {
  accesorios: { iconName: 'Sparkles', color: '#06b6d4', image: '/category-parts/accesorios-v2.png' },
  aceite: { iconName: 'Droplets', color: '#14b8a6', image: '/category-parts/aceite-card-v2.png' },
  'admision-aire': { iconName: 'Wind', color: '#0ea5e9', image: '/category-parts/admision-aire-v2.png' },
  'calefaccion-aire-acondicionado': { iconName: 'ThermometerSun', color: '#f59e0b', image: '/category-parts/calefaccion-v2.png' },
  carroceria: { iconName: 'CarFront', color: '#ec4899', image: '/category-parts/carroceria-v2.png' },
  cerraduras: { iconName: 'KeyRound', color: '#64748b', image: '/category-parts/cerraduras-v2.png' },
  combustible: { iconName: 'Fuel', color: '#eab308', image: '/category-parts/combustible-v2.png' },
  correas: { iconName: 'Gauge', color: '#f97316', image: '/category-parts/correas-v2.png' },
  direccion: { iconName: 'CircleGauge', color: '#8b5cf6', image: '/category-parts/direccion-v2.png' },
  distribucion: { iconName: 'Cog', color: '#f97316', image: '/category-parts/distribucion-v2.png' },
  egr: { iconName: 'Recycle', color: '#22c55e', image: '/category-parts/egr-v2.png' },
  'ejes-delantero-trasero': { iconName: 'GitFork', color: '#6366f1', image: '/category-parts/ejes-v2.png' },
  electrico: { iconName: 'Zap', color: '#6366f1', image: '/category-parts/electrico-v2.png' },
  embrague: { iconName: 'Disc3', color: '#d946ef', image: '/category-parts/embrague-v2.png' },
  'empaquetaduras-retenes': { iconName: 'Layers', color: '#a16207', image: '/category-parts/empaquetaduras-v2.png' },
  encendido: { iconName: 'Zap', color: '#4f46e5', image: '/category-parts/encendido-v2.png' },
  filtros: { iconName: 'Filter', color: '#14b8a6', image: '/category-parts/filtros-v2.png' },
  frenos: { iconName: 'Disc3', color: '#ef4444', image: '/category-parts/frenos-v2.png' },
  motor: { iconName: 'Cog', color: '#f97316', image: '/category-parts/motor-v2.png' },
  piolas: { iconName: 'Cable', color: '#0f766e', image: '/category-parts/piolas-v2.png' },
  refrigeracion: { iconName: 'Snowflake', color: '#0ea5e9', image: '/category-parts/refrigeracion-v2.png' },
  rodamientos: { iconName: 'CircleDot', color: '#0891b2', image: '/category-parts/rodamientos-v2.png' },
  sensores: { iconName: 'Radar', color: '#db2777', image: '/category-parts/sensores-v2.png' },
  'soportes-motor': { iconName: 'Box', color: '#475569', image: '/category-parts/soportes-motor-v2.png' },
  suspension: { iconName: 'ArrowUpDown', color: '#8b5cf6', image: '/category-parts/suspension-v2.png' },
};

// Fuente única para los listados de navegación y filtros. Cada categoría técnica
// conserva el `filterId` del inventario para que los controles sigan filtrando
// por los IDs reales que entrega el backend.
export const NAVIGATION_CATEGORIES = HEADER_CATEGORIES.map((category) => ({
  ...category,
  ...CATEGORY_VISUALS[category.id],
}));

export const CAROUSEL_CATEGORIES = HEADER_CATEGORIES.map((category) => ({
  ...category,
  ...CATEGORY_VISUALS[category.id],
  count: '',
  badge: '',
}));

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

/**
 * Asocia dinámicamente cualquier categoría/subcategoría recibida del backend con
 * su imagen de alta resolución, icono de Lucide, color de marca y miniaturas PNG.
 */
export function getCategoryVisuals(categoryOrName) {
  if (!categoryOrName) {
    return { iconName: 'Cog', color: '#f97316', image: '/cat_motor.jpg' };
  }

  const name = typeof categoryOrName === 'string'
    ? categoryOrName.toLowerCase().trim()
    : (categoryOrName.nombre || categoryOrName.id || '').toLowerCase().trim();

  const matchSidebar = SIDEBAR_CATEGORIES.find(c =>
    name.includes(c.id) || c.nombre.toLowerCase().includes(name) || name.includes(c.nombre.toLowerCase())
  );
  if (matchSidebar) {
    return { iconName: matchSidebar.iconName, color: matchSidebar.color, image: matchSidebar.image };
  }

  const matchHeader = HEADER_CATEGORIES.find(c =>
    name.includes(c.id) || c.nombre.toLowerCase().includes(name) || name.includes(c.nombre.toLowerCase())
  );
  if (matchHeader) {
    const filterMatch = SIDEBAR_CATEGORIES.find(s => s.id === matchHeader.filterId);
    return {
      iconName: filterMatch?.iconName || 'Cog',
      color: filterMatch?.color || '#f97316',
      image: matchHeader.image || filterMatch?.image || '/cat_motor.jpg'
    };
  }

  if (name.includes('freno') || name.includes('disco') || name.includes('pastilla')) {
    return { iconName: 'Disc3', color: '#ef4444', image: '/cat_frenos.jpg' };
  }
  if (name.includes('aceite') || name.includes('filtro') || name.includes('lubric')) {
    return { iconName: 'Droplets', color: '#14b8a6', image: '/cat_aceites.jpg' };
  }
  if (name.includes('suspens') || name.includes('direcc') || name.includes('amortigua')) {
    return { iconName: 'ArrowUpDown', color: '#8b5cf6', image: '/cat_suspension.jpg' };
  }
  if (name.includes('luz') || name.includes('ampolleta') || name.includes('foco') || name.includes('ilumina')) {
    return { iconName: 'Lightbulb', color: '#eab308', image: '/cat_iluminacion.jpg' };
  }
  if (name.includes('electric') || name.includes('bateria') || name.includes('encendido') || name.includes('bujia')) {
    return { iconName: 'Zap', color: '#6366f1', image: '/cat_electrico.jpg' };
  }
  if (name.includes('espejo') || name.includes('carroc') || name.includes('parachoq') || name.includes('puerta')) {
    return { iconName: 'CarFront', color: '#ec4899', image: '/cat_carroceria.jpg' };
  }
  if (name.includes('neumat') || name.includes('llanta') || name.includes('rueda')) {
    return { iconName: 'CircleDot', color: '#0891b2', image: '/cat_neumaticos.jpg' };
  }

  return { iconName: 'Cog', color: '#f97316', image: '/cat_motor.jpg' };
}
