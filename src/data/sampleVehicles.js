// Base de datos de patentes y vehículos para demostración
export const SAMPLE_PATENTES = {
  'BBCL12': {
    patente: 'BB-CL-12',
    marca: 'Toyota',
    modelo: 'RAV4 LE 4WD',
    anio: 2021,
    motor: '2.5L 4 Cilindros DOHC',
    transmision: 'Automática 8 Velocidades',
    vin: 'JTM33REV5MD094821',
    combustible: 'Bencina',
    color: 'Gris Metalizado',
    imagen: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80',
    totalRepuestos: 485
  },
  'HG8921': {
    patente: 'HG-89-21',
    marca: 'Chevrolet',
    modelo: 'Sail Sedan LT',
    anio: 2018,
    motor: '1.5L 16V VVT',
    transmision: 'Manual 5 Velocidades',
    vin: 'KL1SF3589JC103982',
    combustible: 'Bencina',
    color: 'Blanco Invierno',
    imagen: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80',
    totalRepuestos: 320
  },
  'AA123BB': {
    patente: 'AA-123-BB',
    marca: 'Nissan',
    modelo: 'Qashqai Sense CVT',
    anio: 2020,
    motor: '2.0L MR20DD',
    transmision: 'Automática X-Tronic CVT',
    vin: 'JN1TDAJ11U0492817',
    combustible: 'Bencina',
    color: 'Rojo Burdeo',
    imagen: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80',
    totalRepuestos: 512
  },
  'KJ4590': {
    patente: 'KJ-45-90',
    marca: 'Hyundai',
    modelo: 'Accent RB Sedan',
    anio: 2019,
    motor: '1.6L CRDi Turbo',
    transmision: 'Manual 6 Velocidades',
    vin: 'KMHCT41CBKU847291',
    combustible: 'Diésel',
    color: 'Azul Marino',
    imagen: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=80',
    totalRepuestos: 290
  },
  'DF7711': {
    patente: 'DF-77-11',
    marca: 'Ford',
    modelo: 'Ranger XLT 4x4',
    anio: 2022,
    motor: '3.2L 5 Cilindros TDCi',
    transmision: 'Automática 6 Velocidades',
    vin: 'MNAUMFE50MW294810',
    combustible: 'Diésel',
    color: 'Negro Azabache',
    imagen: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
    totalRepuestos: 610
  },
  'ST3456': {
    patente: 'ST-34-56',
    marca: 'Volkswagen',
    modelo: 'Gol Trend 1.6',
    anio: 2017,
    motor: '1.6L MSI 8V',
    transmision: 'Manual 5 Velocidades',
    vin: '9BWCA05U8HT104928',
    combustible: 'Bencina',
    color: 'Plata Plata',
    imagen: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
    totalRepuestos: 230
  }
};

export const POPULAR_MARCAS = [
  'Toyota', 'Chevrolet', 'Nissan', 'Hyundai', 'Ford', 'Volkswagen', 'Kia', 'Suzuki', 'Peugeot', 'Honda', 'Mazda', 'BMW', 'Mercedes-Benz'
];

export const ANIOS_DISPONIBLES = Array.from({ length: 26 }, (_, i) => 2026 - i);

// Helper para parsear la patente ingresada y buscar o generar datos dinámicos
export function searchVehicleByPatente(rawInput) {
  if (!rawInput) return null;
  const cleaned = rawInput.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  if (SAMPLE_PATENTES[cleaned]) {
    return SAMPLE_PATENTES[cleaned];
  }

  const formattedPatente = cleaned.length >= 6 
    ? `${cleaned.substring(0,2)}-${cleaned.substring(2,4)}-${cleaned.substring(4,6)}` 
    : cleaned;

  const marcas = ['Toyota', 'Nissan', 'Chevrolet', 'Hyundai', 'Kia', 'Ford', 'Volkswagen'];
  const modelos = {
    'Toyota': ['Yaris 1.5L', 'Corolla 1.8L', 'RAV4 2.0L', 'Hilux 2.4L Diesel'],
    'Nissan': ['Kicks 1.6L', 'Versa 1.6L', 'NP300 2.5L Diesel', 'Qashqai 2.0L'],
    'Chevrolet': ['Sail 1.5L', 'Onix 1.0L Turbo', 'Tracker 1.2L', 'D-Max 3.0L'],
    'Hyundai': ['Grand i10 1.2L', 'Tucson 2.0L', 'Creta 1.6L', 'Santa Fe 2.2L'],
    'Kia': ['Rio5 1.4L', 'Sportage 2.0L', 'Soluto 1.4L', 'Frontier 2.5L'],
    'Ford': ['EcoSport 1.5L', 'Ranger 2.2L', 'F-150 3.5L EcoBoost', 'Focus 2.0L'],
    'Volkswagen': ['Gol 1.6L', 'Polo 1.6L', 'Tiguan 2.0L TSI', 'Amarok 2.0L TDI']
  };

  const hash = cleaned.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const marcaSel = marcas[hash % marcas.length];
  const modelList = modelos[marcaSel];
  const modeloSel = modelList[hash % modelList.length];
  const anioSel = 2015 + (hash % 10);

  return {
    patente: formattedPatente,
    marca: marcaSel,
    modelo: modeloSel,
    anio: anioSel,
    motor: 'Engine Spec Verified VVT-i',
    transmision: 'Automática / Manual',
    vin: `PAT${hash}902817263`,
    combustible: 'Bencina / Diesel',
    color: 'Vehículo Verificado',
    imagen: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
    totalRepuestos: 340 + (hash % 200)
  };
}
